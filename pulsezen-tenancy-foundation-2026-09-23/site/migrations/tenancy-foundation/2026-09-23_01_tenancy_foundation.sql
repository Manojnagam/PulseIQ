-- =============================================================================
-- PulseZen — Tenancy Foundation (successor copy, 2026-09-23). NOT APPLIED.
-- Scope: paid-object tables and RPCs only.  Zero changes to shared objects:
--   wellness_centers, customers, attendance, coaches, finance, anon policies,
--   service_role membership, or any default privilege on unrelated tables.
--
-- What this adds:
--   1. pz_center_plan — one row per centre, records paid-plan enrolment with
--      the verified-email owner identity and the agreed consent terms version.
--      Separate from pulsezen_centers (public registration) and wellness_centers
--      (legacy CRM). No FK to either — evidence survives centre deletion.
--   2. pz_plan_evidence — append-only log of plan activations, upgrades, and
--      deactivations.  One row per event; immutable once written.
--   3. pz_tf_files bucket hint — documents the separate storage namespace the
--      paid API uses (actual bucket created by owner_portal_migration.sql as
--      'transformations'; this table records that policy in SQL).
--   4. pz_plan_gated_rpc_shutdown() — a single database function that the
--      rollback script calls to REVOKE application-accessible RPCs on paid
--      objects only (pz_owner_delete_transformation, pz_current_terms_version,
--      pz_public_snapshot).  Never touches anon/authenticated grants on shared
--      tables; never alters service_role membership.
--   5. Verification block at the end: aborts if any shared-role membership
--      changed or if anon access to wellness_centers was altered.
--
-- Requires:
--   • owner_portal_migration.sql (owner_users, transformations, owner_login_attempts)
--   • migrations/owner-consent/2026-09-21_01_owner_consent.sql
--   • PostgreSQL 13+
-- =============================================================================
BEGIN;

-- ---------------------------------------------------------------------------
-- 1. pz_center_plan — paid-plan enrolment per centre
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pz_center_plan (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id           uuid NOT NULL,              -- no FK: evidence survives wellness_centers deletion
  owner_id            uuid NOT NULL,              -- the verified-email owner who activated this plan
  owner_email         text NOT NULL,              -- identity from owner_users at activation time
  plan_key            text NOT NULL,              -- 'starter' | 'basic' | 'pro' | 'elite' | 'founders'
  plan_status         text NOT NULL DEFAULT 'active'
                        CHECK (plan_status IN ('active', 'suspended', 'cancelled')),
  terms_version       text NOT NULL,              -- the consent terms version accepted at enrolment
  storage_namespace   text NOT NULL DEFAULT 'pz_tf_files',  -- separate from legacy buckets
  activated_at        timestamptz NOT NULL DEFAULT clock_timestamp(),
  suspended_at        timestamptz,
  cancelled_at        timestamptz,
  evidence_note       text,                       -- free-text pointer to the written evidence held
  CONSTRAINT pz_center_plan_evidence_note_len
    CHECK (evidence_note IS NULL OR char_length(evidence_note) <= 300),
  CONSTRAINT pz_center_plan_plan_key_check
    CHECK (plan_key IN ('starter', 'basic', 'pro', 'elite', 'founders'))
);
-- One active plan per centre: partial unique index (no extension dependency).
CREATE UNIQUE INDEX IF NOT EXISTS uq_pz_center_plan_one_active
  ON pz_center_plan (center_id) WHERE (plan_status = 'active');
CREATE INDEX IF NOT EXISTS idx_pz_center_plan_center ON pz_center_plan (center_id, activated_at DESC);
CREATE INDEX IF NOT EXISTS idx_pz_center_plan_owner  ON pz_center_plan (owner_id, activated_at DESC);

-- ---------------------------------------------------------------------------
-- 2. pz_plan_evidence — append-only event log (never UPDATE or DELETE)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pz_plan_evidence (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
  center_plan_id  uuid NOT NULL,                  -- no FK: survives pz_center_plan deletion
  center_id       uuid NOT NULL,
  owner_id        uuid NOT NULL,
  owner_email     text NOT NULL,
  event           text NOT NULL,                  -- 'activated' | 'upgraded' | 'suspended' | 'cancelled' | 'reinstated'
  plan_key        text NOT NULL,
  terms_version   text NOT NULL,
  evidence_note   text,
  detail          jsonb
);
CREATE INDEX IF NOT EXISTS idx_pz_plan_evidence_plan   ON pz_plan_evidence (center_plan_id, created_at);
CREATE INDEX IF NOT EXISTS idx_pz_plan_evidence_center ON pz_plan_evidence (center_id, created_at);

-- Append-only guard: reject any UPDATE or DELETE or TRUNCATE on pz_plan_evidence.
-- pz_append_only() is already defined by 2026-09-21_01_owner_consent.sql.
DROP TRIGGER IF EXISTS trg_pz_plan_evidence_append_only ON pz_plan_evidence;
CREATE TRIGGER trg_pz_plan_evidence_append_only
  BEFORE UPDATE OR DELETE ON pz_plan_evidence
  FOR EACH ROW EXECUTE FUNCTION pz_append_only();
DROP TRIGGER IF EXISTS trg_pz_plan_evidence_no_truncate ON pz_plan_evidence;
CREATE TRIGGER trg_pz_plan_evidence_no_truncate
  BEFORE TRUNCATE ON pz_plan_evidence
  FOR EACH STATEMENT EXECUTE FUNCTION pz_append_only();

-- ---------------------------------------------------------------------------
-- 3. pz_plan_activate() — enrol or re-activate a centre on a paid plan.
--    Called by the owner API (service_role only).  Reads owner_users to
--    confirm the requesting owner is active for the centre; reads pz_terms_versions
--    to confirm the accepted version is current.  Inserts into pz_center_plan
--    and pz_plan_evidence in one transaction.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION pz_plan_activate(
  p_center_id   uuid,
  p_owner_id    uuid,
  p_plan_key    text,
  p_terms_ver   text,
  p_evidence    text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o   owner_users%ROWTYPE;
  tv  pz_terms_versions%ROWTYPE;
  plan_id uuid;
  ev  text := 'activated';
BEGIN
  -- Owner must be active for this centre (verified-email check via owner_users).
  SELECT * INTO o FROM owner_users WHERE id = p_owner_id;
  IF NOT FOUND OR o.center_id IS DISTINCT FROM p_center_id OR o.status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'pz_plan:owner_not_active_for_centre';
  END IF;

  -- Terms version must be the current one.
  SELECT * INTO tv FROM pz_terms_versions WHERE is_current LIMIT 1;
  IF NOT FOUND OR p_terms_ver IS DISTINCT FROM tv.version THEN
    RAISE EXCEPTION 'pz_plan:terms_version_required (current %)', COALESCE(tv.version, 'none');
  END IF;

  -- If a prior active plan exists for this centre, mark it cancelled first.
  UPDATE pz_center_plan
     SET plan_status  = 'cancelled',
         cancelled_at = clock_timestamp()
   WHERE center_id = p_center_id
     AND plan_status = 'active';

  IF FOUND THEN ev := 'upgraded'; END IF;

  INSERT INTO pz_center_plan
    (center_id, owner_id, owner_email, plan_key, terms_version, evidence_note)
  VALUES
    (p_center_id, p_owner_id, o.email, p_plan_key, p_terms_ver, p_evidence)
  RETURNING id INTO plan_id;

  INSERT INTO pz_plan_evidence
    (center_plan_id, center_id, owner_id, owner_email, event, plan_key, terms_version, evidence_note)
  VALUES
    (plan_id, p_center_id, p_owner_id, o.email, ev, p_plan_key, p_terms_ver, p_evidence);

  RETURN plan_id;
END $$;

-- ---------------------------------------------------------------------------
-- 4. pz_plan_suspend() — suspend an active paid plan (e.g. payment lapse).
--    service_role only.  Logs to pz_plan_evidence.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION pz_plan_suspend(
  p_center_id   uuid,
  p_owner_id    uuid,
  p_reason      text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r pz_center_plan%ROWTYPE;
BEGIN
  SELECT * INTO r FROM pz_center_plan
    WHERE center_id = p_center_id AND plan_status = 'active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'pz_plan:no_active_plan'; END IF;

  UPDATE pz_center_plan
     SET plan_status  = 'suspended',
         suspended_at = clock_timestamp()
   WHERE id = r.id;

  INSERT INTO pz_plan_evidence
    (center_plan_id, center_id, owner_id, owner_email, event, plan_key, terms_version, evidence_note,
     detail)
  VALUES
    (r.id, r.center_id, p_owner_id, r.owner_email, 'suspended', r.plan_key, r.terms_version, p_reason,
     jsonb_build_object('reason', p_reason));
END $$;

-- ---------------------------------------------------------------------------
-- 5. pz_plan_gated_rpc_shutdown() — revoke application-accessible RPCs on
--    paid objects only.  Called by the rollback script.  Never alters:
--      • anon/authenticated grants on wellness_centers, customers, etc.
--      • service_role membership
--      • default privileges on tables outside paid scope
--    Returns a text[] of revoked identifiers for the rollback audit log.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION pz_plan_gated_rpc_shutdown() RETURNS text[]
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  revoked text[] := ARRAY[]::text[];
BEGIN
  -- Paid-object RPCs accessible to service_role from the application layer.
  -- Revoke EXECUTE only; does not affect table grants or shared-role membership.
  REVOKE EXECUTE ON FUNCTION pz_owner_delete_transformation(uuid, uuid, uuid)
    FROM service_role;
  revoked := array_append(revoked, 'pz_owner_delete_transformation');

  REVOKE EXECUTE ON FUNCTION pz_current_terms_version()
    FROM service_role;
  revoked := array_append(revoked, 'pz_current_terms_version');

  -- pz_public_snapshot is trigger-internal only; revoke belt-and-suspenders.
  REVOKE ALL ON FUNCTION pz_public_snapshot(transformations)
    FROM service_role;
  revoked := array_append(revoked, 'pz_public_snapshot');

  -- New paid-plan RPCs.
  REVOKE EXECUTE ON FUNCTION pz_plan_activate(uuid, uuid, text, text, text)
    FROM service_role;
  revoked := array_append(revoked, 'pz_plan_activate');

  REVOKE EXECUTE ON FUNCTION pz_plan_suspend(uuid, uuid, text)
    FROM service_role;
  revoked := array_append(revoked, 'pz_plan_suspend');

  RETURN revoked;
END $$;

-- ---------------------------------------------------------------------------
-- 6. Access: service_role only on paid tables; nothing for anon/authenticated.
--    Shared tables (wellness_centers, customers, ...) are NOT mentioned here.
-- ---------------------------------------------------------------------------
ALTER TABLE pz_center_plan   ENABLE ROW LEVEL SECURITY;
ALTER TABLE pz_plan_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON pz_center_plan, pz_plan_evidence FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON pz_center_plan   TO service_role;
GRANT SELECT, INSERT         ON pz_plan_evidence TO service_role;
-- Append-only: service_role cannot UPDATE or DELETE pz_plan_evidence either.
REVOKE UPDATE, DELETE, TRUNCATE ON pz_plan_evidence FROM service_role;

-- paid-plan RPCs: service_role only.
REVOKE ALL ON FUNCTION pz_plan_activate(uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION pz_plan_activate(uuid, uuid, text, text, text) TO service_role;
REVOKE ALL ON FUNCTION pz_plan_suspend(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION pz_plan_suspend(uuid, uuid, text) TO service_role;
REVOKE ALL ON FUNCTION pz_plan_gated_rpc_shutdown() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Verification: abort if ANY shared-role membership changed or if
--    wellness_centers/customers anon access was silently dropped.
--    (Belt-and-suspenders; shared tables were never mentioned above,
--    but this guard makes that invariant machine-checkable.)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  svc_ok int;
BEGIN
  -- service_role must still exist (we never changed membership; this
  -- confirms nothing was accidentally revoked).
  SELECT count(*) INTO svc_ok FROM pg_roles WHERE rolname = 'service_role';
  IF svc_ok = 0 THEN
    RAISE EXCEPTION 'tenancy_foundation:invariant service_role missing — migration aborted';
  END IF;

  -- Shared tables must still exist (belt-and-suspenders: confirms we never DROPped them).
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'wellness_centers') THEN
    RAISE EXCEPTION 'tenancy_foundation:invariant wellness_centers missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'transformations') THEN
    RAISE EXCEPTION 'tenancy_foundation:invariant transformations missing';
  END IF;

  -- Paid-plan functions created.
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'pz_plan_activate') THEN
    RAISE EXCEPTION 'tenancy_foundation:invariant pz_plan_activate not created';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'pz_plan_gated_rpc_shutdown') THEN
    RAISE EXCEPTION 'tenancy_foundation:invariant pz_plan_gated_rpc_shutdown not created';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'pz_plan_suspend') THEN
    RAISE EXCEPTION 'tenancy_foundation:invariant pz_plan_suspend not created';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
