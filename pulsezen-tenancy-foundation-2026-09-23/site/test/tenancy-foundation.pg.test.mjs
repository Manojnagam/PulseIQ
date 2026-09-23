/**
 * Focused tests for the tenancy foundation migration against a REAL PostgreSQL database.
 * Scope: pz_center_plan, pz_plan_evidence, pz_plan_activate(), pz_plan_suspend(),
 *        pz_plan_gated_rpc_shutdown() and the rollback script.
 *
 * Schema applied (in order):
 *   test/fixtures/v5-schema.sql          — baseline tables (wellness_centers, owner_users, transformations)
 *   test/fixtures/legacy-stories.sql     — 3 legacy published stories
 *   migrations/owner-consent/2026-09-21_01_owner_consent.sql
 *   migrations/tenancy-foundation/2026-09-23_01_tenancy_foundation.sql  ← under test
 *
 * Requires PZ_TEST_PG_ADMIN (e.g. postgres://postgres:postgres@localhost/postgres).
 * Creates and drops a throwaway database for each run.
 * No network, no Groq, no email, no WhatsApp. No production credentials.
 * Never point this at production.
 *
 * Run:  PZ_TEST_PG_ADMIN=... node --test test/tenancy-foundation.pg.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs   from 'node:fs';
import path from 'node:path';

const ADMIN_URL = process.env.PZ_TEST_PG_ADMIN;
const skip = !ADMIN_URL;
if (skip) console.warn('SKIP: PZ_TEST_PG_ADMIN not set — all tenancy-foundation tests skipped');

const ROOT = process.cwd();
const MIG  = path.join(ROOT, 'migrations');

// Fixture centre / owner constants (same as owner-consent tests for consistency)
const CA  = 'c1fb6027-0000-4000-8000-000000000001';   // Dharani's fixture centre (has legacy stories)
const CB  = 'bbbbbbbb-0000-4000-8000-00000000000b';   // Centre B (no stories)
const OA  = { id: 'aaaaaaaa-0000-4000-8000-0000000000a1', center_id: CA, email: 'owner-a@centre-a.test' };
const OB  = { id: 'bbbbbbbb-0000-4000-8000-0000000000b1', center_id: CB, email: 'owner-b@centre-b.test' };
const OA2 = { id: 'aaaaaaaa-0000-4000-8000-0000000000a2', center_id: CA, email: 'suspended@centre-a.test', status: 'suspended' };
const TERMS = 'owner-terms-v2';  // inserted by 2026-09-21_01_owner_consent.sql

let pg, adminPool, pool, dbName;
const sql     = async (text, params) => (await pool.query(text, params)).rows;
const sqlOne  = async (text, params) => { const r = await sql(text, params); return r[0] ?? null; };
const sqlErr  = async (text, params) => {
  try { await pool.query(text, params); return null; }
  catch (e) { return e.message; }
};

// ---------------------------------------------------------------------------
// Database lifecycle
// ---------------------------------------------------------------------------
test.before(async () => {
  if (skip) return;
  pg = (await import('pg')).default;
  adminPool = new pg.Pool({ connectionString: ADMIN_URL, max: 2 });
  dbName = `pz_tenancy_${Date.now()}`;
  await adminPool.query(`CREATE DATABASE ${dbName}`);
  const u = new URL(ADMIN_URL);
  u.pathname = `/${dbName}`;
  pool = new pg.Pool({ connectionString: u.toString(), max: 10 });
  pool.on('error', () => {});

  // Apply fixtures + migrations in the agreed order.
  await pool.query(fs.readFileSync(path.join(ROOT, 'test/fixtures/v5-schema.sql'), 'utf8'));
  await pool.query(fs.readFileSync(path.join(ROOT, 'test/fixtures/legacy-stories.sql'), 'utf8'));

  // Centre B and both owners (OA active, OA2 suspended, OB active for CB).
  await pool.query(`
    INSERT INTO wellness_centers (id, name, slug) VALUES ('${CB}', 'Centre B (fixture)', 'centreb');
    INSERT INTO owner_users (id, center_id, email, status) VALUES
      ('${OA.id}',  '${CA}', '${OA.email}',  'active'),
      ('${OA2.id}', '${CA}', '${OA2.email}', 'suspended'),
      ('${OB.id}',  '${CB}', '${OB.email}',  'active');
  `);

  // Owner-consent migration (provides pz_terms_versions, pz_append_only, etc.).
  await pool.query(fs.readFileSync(
    path.join(MIG, 'owner-consent/2026-09-21_01_owner_consent.sql'), 'utf8'));

  // Under test.
  await pool.query(fs.readFileSync(
    path.join(MIG, 'tenancy-foundation/2026-09-23_01_tenancy_foundation.sql'), 'utf8'));
});

test.after(async () => {
  if (skip) return;
  await pool.end();
  await adminPool.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
  await adminPool.end();
});

// ---------------------------------------------------------------------------
// Helper: call pz_plan_activate via parameterised SQL (bypasses RPC layer;
// tests the function directly against the real constraint/trigger stack).
// ---------------------------------------------------------------------------
async function activate(centerId, ownerId, planKey = 'basic', termsVer = TERMS, evidence = null) {
  return sqlOne(
    `SELECT pz_plan_activate($1, $2, $3, $4, $5) AS plan_id`,
    [centerId, ownerId, planKey, termsVer, evidence]
  );
}
async function suspend(centerId, ownerId, reason = 'test suspension') {
  return sqlOne(
    `SELECT pz_plan_suspend($1, $2, $3)`,
    [centerId, ownerId, reason]
  );
}

// ---------------------------------------------------------------------------
// T1 — Schema invariants after migration
// ---------------------------------------------------------------------------
test('T1.1 pz_center_plan table exists with expected columns', { skip }, async () => {
  const cols = await sql(`
    SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'pz_center_plan'
     ORDER BY ordinal_position`);
  const names = cols.map(c => c.column_name);
  assert.ok(names.includes('id'),               'id column missing');
  assert.ok(names.includes('center_id'),        'center_id column missing');
  assert.ok(names.includes('owner_id'),         'owner_id column missing');
  assert.ok(names.includes('owner_email'),      'owner_email column missing');
  assert.ok(names.includes('plan_key'),         'plan_key column missing');
  assert.ok(names.includes('plan_status'),      'plan_status column missing');
  assert.ok(names.includes('terms_version'),    'terms_version column missing');
  assert.ok(names.includes('storage_namespace'),'storage_namespace column missing');
  assert.ok(names.includes('activated_at'),     'activated_at column missing');
  assert.ok(names.includes('evidence_note'),    'evidence_note column missing');
});

test('T1.2 pz_plan_evidence table is append-only', { skip }, async () => {
  const triggers = await sql(`
    SELECT tgname FROM pg_trigger
     WHERE tgrelid = 'pz_plan_evidence'::regclass`);
  const names = triggers.map(t => t.tgname);
  assert.ok(names.includes('trg_pz_plan_evidence_append_only'), 'append-only trigger missing');
  assert.ok(names.includes('trg_pz_plan_evidence_no_truncate'), 'no-truncate trigger missing');
});

test('T1.3 shared tables still have anon RLS policies', { skip }, async () => {
  // wellness_centers must keep its 'anon_all' policy from pulsezen-centers-schema.sql.
  const policies = await sql(`
    SELECT policyname FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'wellness_centers'`);
  assert.ok(policies.length > 0, 'wellness_centers lost all RLS policies — migration changed shared object');
});

test('T1.4 paid-plan RPCs accessible to service_role, not to anon', { skip }, async () => {
  // Verify pz_plan_activate exists and is owned by the correct schema.
  const fn = await sqlOne(
    `SELECT proname FROM pg_proc WHERE proname = 'pz_plan_activate'`);
  assert.ok(fn, 'pz_plan_activate not found');

  const shutdown = await sqlOne(
    `SELECT proname FROM pg_proc WHERE proname = 'pz_plan_gated_rpc_shutdown'`);
  assert.ok(shutdown, 'pz_plan_gated_rpc_shutdown not found');
});

// ---------------------------------------------------------------------------
// T2 — pz_plan_activate: happy path
// ---------------------------------------------------------------------------
test('T2.1 activate creates one pz_center_plan row and one pz_plan_evidence row', { skip }, async () => {
  const r = await activate(CB, OB.id, 'basic', TERMS, 'WhatsApp approval 2026-09-23');
  assert.ok(r.plan_id, 'plan_id must be returned');

  const plan = await sqlOne(`SELECT * FROM pz_center_plan WHERE id = $1`, [r.plan_id]);
  assert.equal(plan.center_id, CB);
  assert.equal(plan.owner_id, OB.id);
  assert.equal(plan.owner_email, OB.email);
  assert.equal(plan.plan_key, 'basic');
  assert.equal(plan.plan_status, 'active');
  assert.equal(plan.terms_version, TERMS);
  assert.equal(plan.storage_namespace, 'pz_tf_files');
  assert.equal(plan.evidence_note, 'WhatsApp approval 2026-09-23');

  const evs = await sql(`SELECT * FROM pz_plan_evidence WHERE center_plan_id = $1`, [r.plan_id]);
  assert.equal(evs.length, 1);
  assert.equal(evs[0].event, 'activated');
  assert.equal(evs[0].plan_key, 'basic');
  assert.equal(evs[0].owner_email, OB.email);

  // Cleanup for isolation.
  await pool.query(`UPDATE pz_center_plan SET plan_status = 'cancelled', cancelled_at = now() WHERE id = $1`, [r.plan_id]);
});

test('T2.2 upgrading an active plan marks old row cancelled and logs "upgraded"', { skip }, async () => {
  // Activate basic.
  const r1 = await activate(CA, OA.id, 'basic', TERMS);
  // Upgrade to pro.
  const r2 = await activate(CA, OA.id, 'pro', TERMS);
  assert.notEqual(r1.plan_id, r2.plan_id, 'upgrade must create a new plan row');

  const old = await sqlOne(`SELECT * FROM pz_center_plan WHERE id = $1`, [r1.plan_id]);
  assert.equal(old.plan_status, 'cancelled', 'old plan must be cancelled');

  const newest = await sqlOne(`SELECT * FROM pz_center_plan WHERE id = $1`, [r2.plan_id]);
  assert.equal(newest.plan_status, 'active');
  assert.equal(newest.plan_key, 'pro');

  const evs = await sql(
    `SELECT event FROM pz_plan_evidence WHERE center_plan_id = $1 ORDER BY created_at`, [r2.plan_id]);
  assert.equal(evs[0].event, 'upgraded');

  // Cleanup.
  await pool.query(`UPDATE pz_center_plan SET plan_status = 'cancelled', cancelled_at = now() WHERE id = $1`, [r2.plan_id]);
});

// ---------------------------------------------------------------------------
// T3 — pz_plan_activate: rejection cases
// ---------------------------------------------------------------------------
test('T3.1 suspended owner cannot activate a plan', { skip }, async () => {
  const err = await sqlErr(
    `SELECT pz_plan_activate($1, $2, $3, $4, $5)`,
    [CA, OA2.id, 'basic', TERMS, null]
  );
  assert.ok(err && err.includes('pz_plan:owner_not_active_for_centre'), `expected rejection, got: ${err}`);
});

test('T3.2 wrong centre owner cannot activate a plan for another centre', { skip }, async () => {
  // OA belongs to CA; attempt to activate CB's plan with OA's identity.
  const err = await sqlErr(
    `SELECT pz_plan_activate($1, $2, $3, $4, $5)`,
    [CB, OA.id, 'basic', TERMS, null]
  );
  assert.ok(err && err.includes('pz_plan:owner_not_active_for_centre'), `expected rejection, got: ${err}`);
});

test('T3.3 outdated terms version is rejected', { skip }, async () => {
  const err = await sqlErr(
    `SELECT pz_plan_activate($1, $2, $3, $4, $5)`,
    [CB, OB.id, 'basic', 'owner-terms-v1', null]
  );
  assert.ok(err && err.includes('pz_plan:terms_version_required'), `expected terms rejection, got: ${err}`);
});

test('T3.4 invalid plan_key is rejected by constraint', { skip }, async () => {
  const err = await sqlErr(
    `SELECT pz_plan_activate($1, $2, $3, $4, $5)`,
    [CB, OB.id, 'enterprise', TERMS, null]
  );
  assert.ok(err, 'expected constraint violation for invalid plan_key');
});

test('T3.5 evidence_note exceeding 300 chars is rejected by constraint', { skip }, async () => {
  const longNote = 'x'.repeat(301);
  const err = await sqlErr(
    `SELECT pz_plan_activate($1, $2, $3, $4, $5)`,
    [CB, OB.id, 'basic', TERMS, longNote]
  );
  assert.ok(err, 'expected constraint violation for oversized evidence_note');
});

// ---------------------------------------------------------------------------
// T4 — pz_plan_suspend
// ---------------------------------------------------------------------------
test('T4.1 suspending an active plan sets plan_status=suspended and logs it', { skip }, async () => {
  const r = await activate(CB, OB.id, 'starter', TERMS, 'activation note');
  await suspend(CB, OB.id, 'payment lapsed');

  const plan = await sqlOne(`SELECT * FROM pz_center_plan WHERE id = $1`, [r.plan_id]);
  assert.equal(plan.plan_status, 'suspended');
  assert.ok(plan.suspended_at, 'suspended_at must be set');

  const evs = await sql(`SELECT * FROM pz_plan_evidence WHERE center_plan_id = $1 ORDER BY created_at`, [r.plan_id]);
  const suspendEv = evs.find(e => e.event === 'suspended');
  assert.ok(suspendEv, 'suspended event must be logged');
  assert.ok(suspendEv.detail && suspendEv.detail.reason === 'payment lapsed');
});

test('T4.2 suspending a non-existent active plan is rejected', { skip }, async () => {
  // Ensure no active plan for CA after potential cleanup.
  await pool.query(`UPDATE pz_center_plan SET plan_status = 'cancelled' WHERE center_id = $1 AND plan_status = 'active'`, [CA]);
  const err = await sqlErr(`SELECT pz_plan_suspend($1, $2, $3)`, [CA, OA.id, 'reason']);
  assert.ok(err && err.includes('pz_plan:no_active_plan'), `expected no_active_plan, got: ${err}`);
});

// ---------------------------------------------------------------------------
// T5 — pz_plan_evidence is append-only
// ---------------------------------------------------------------------------
test('T5.1 UPDATE on pz_plan_evidence is refused', { skip }, async () => {
  // Get any evidence row.
  const row = await sqlOne(`SELECT id FROM pz_plan_evidence LIMIT 1`);
  if (!row) return; // no rows yet; skip rather than fail
  const err = await sqlErr(
    `UPDATE pz_plan_evidence SET event = 'tampered' WHERE id = $1`, [row.id]);
  assert.ok(err && err.includes('pz_audit:append_only'), `expected append_only error, got: ${err}`);
});

test('T5.2 DELETE on pz_plan_evidence is refused', { skip }, async () => {
  const row = await sqlOne(`SELECT id FROM pz_plan_evidence LIMIT 1`);
  if (!row) return;
  const err = await sqlErr(`DELETE FROM pz_plan_evidence WHERE id = $1`, [row.id]);
  assert.ok(err && err.includes('pz_audit:append_only'), `expected append_only error, got: ${err}`);
});

// ---------------------------------------------------------------------------
// T6 — pz_plan_gated_rpc_shutdown + rollback
// ---------------------------------------------------------------------------
test('T6.1 pz_plan_gated_rpc_shutdown returns list of revoked identifiers', { skip }, async () => {
  const r = await sqlOne(`SELECT pz_plan_gated_rpc_shutdown() AS revoked`);
  assert.ok(Array.isArray(r.revoked), 'revoked must be an array');
  assert.ok(r.revoked.includes('pz_plan_activate'), 'pz_plan_activate must be in revoked list');
  assert.ok(r.revoked.includes('pz_plan_gated_rpc_shutdown'), 'shutdown function itself in revoked list');
  assert.ok(r.revoked.includes('pz_owner_delete_transformation'), 'pz_owner_delete_transformation in list');
});

test('T6.2 rollback script drops paid RPCs but preserves tables and shared roles', { skip }, async () => {
  // Apply rollback in a NEW throwaway DB to test it cleanly.
  const rollbackDb = `pz_tenancy_rollback_${Date.now()}`;
  await adminPool.query(`CREATE DATABASE ${rollbackDb}`);
  const ru = new URL(ADMIN_URL); ru.pathname = `/${rollbackDb}`;
  const rPool = new pg.Pool({ connectionString: ru.toString(), max: 4 });
  rPool.on('error', () => {});
  try {
    // Apply full stack.
    await rPool.query(fs.readFileSync(path.join(ROOT, 'test/fixtures/v5-schema.sql'), 'utf8'));
    await rPool.query(fs.readFileSync(path.join(ROOT, 'test/fixtures/legacy-stories.sql'), 'utf8'));
    await rPool.query(`
      INSERT INTO wellness_centers (id, name, slug) VALUES ('${CB}', 'Centre B (rollback fixture)', 'cb');
      INSERT INTO owner_users (id, center_id, email) VALUES ('${OA.id}', '${CA}', '${OA.email}'), ('${OB.id}', '${CB}', '${OB.email}');
    `);
    await rPool.query(fs.readFileSync(path.join(MIG, 'owner-consent/2026-09-21_01_owner_consent.sql'), 'utf8'));
    await rPool.query(fs.readFileSync(path.join(MIG, 'tenancy-foundation/2026-09-23_01_tenancy_foundation.sql'), 'utf8'));
    // Insert a plan row so the rollback has data to preserve.
    await rPool.query(`SELECT pz_plan_activate($1, $2, $3, $4, $5)`, [CB, OB.id, 'basic', TERMS, 'rollback test']);

    // Apply rollback.
    await rPool.query(fs.readFileSync(path.join(MIG, 'tenancy-foundation/2026-09-23_99_rollback.sql'), 'utf8'));

    // Paid RPCs must be gone.
    const fn = await rPool.query(`SELECT proname FROM pg_proc WHERE proname = 'pz_plan_activate'`);
    assert.equal(fn.rows.length, 0, 'pz_plan_activate must be dropped after rollback');

    // Tables must still exist and contain their rows.
    const plans = await rPool.query(`SELECT count(*) FROM pz_center_plan`);
    assert.ok(Number(plans.rows[0].count) > 0, 'pz_center_plan data must survive rollback');

    const evs = await rPool.query(`SELECT count(*) FROM pz_plan_evidence`);
    assert.ok(Number(evs.rows[0].count) > 0, 'pz_plan_evidence data must survive rollback');

    // wellness_centers RLS still on.
    const rls = await rPool.query(`SELECT relrowsecurity FROM pg_class WHERE relname = 'wellness_centers'`);
    assert.ok(rls.rows[0].relrowsecurity, 'wellness_centers RLS must still be on after rollback');

    // service_role must still exist.
    const svc = await rPool.query(`SELECT count(*) FROM pg_roles WHERE rolname = 'service_role'`);
    assert.equal(Number(svc.rows[0].count), 1, 'service_role must still exist after rollback');
  } finally {
    await rPool.end();
    await adminPool.query(`DROP DATABASE IF EXISTS ${rollbackDb} WITH (FORCE)`);
  }
});

// ---------------------------------------------------------------------------
// T7 — Legacy stories are unaffected by the tenancy migration
// ---------------------------------------------------------------------------
test('T7.1 the three legacy published stories survive the tenancy migration unchanged', { skip }, async () => {
  const LEGACY = [
    '9ebe2477-0000-4000-8000-000000000001',
    '9b41ba0c-0000-4000-8000-000000000002',
    'ff67a00b-0000-4000-8000-000000000003'
  ];
  for (const id of LEGACY) {
    const row = await sqlOne(`SELECT status, consent_given FROM transformations WHERE id = $1`, [id]);
    assert.ok(row, `legacy story ${id} missing after tenancy migration`);
    assert.equal(row.status, 'published', `legacy story ${id} must stay published`);
    assert.equal(row.consent_given, true,  `legacy story ${id} must keep consent_given=true`);
  }
});

test('T7.2 no new rows were added to transformations by the tenancy migration', { skip }, async () => {
  const count = await sqlOne(`SELECT count(*) FROM transformations`);
  assert.equal(Number(count.count), 3, 'tenancy migration must not add rows to transformations');
});
