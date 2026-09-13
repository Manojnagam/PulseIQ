import http from 'node:http';
import ownerHandler from './pulsezen_candidate_v2/api/owner.js';
import publicHandler from './pulsezen_candidate_v2/api/public.js';
import { signOwnerSession } from './pulsezen_candidate_v2/api/_session.js';

const PORT = 9989;
const BASE_URL = `http://127.0.0.1:${PORT}`;

const db = {
  transformations: {},
  storage: new Set(),
  dbFailDelete: false,
  storageFailDelete: false,
  sharingCheckFail: false
};

const centerA = '11111111-1111-1111-1111-111111111111';
const centerB = '22222222-2222-2222-2222-222222222222';
const secret = 'test-secret-must-be-32-chars-long-123456';
process.env.SUPABASE_URL = BASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = secret;
process.env.OWNER_SESSION_SECRET = secret;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, BASE_URL);
  const pathname = url.pathname;
  let bodyStr = '';
  req.on('data', c => bodyStr += c);
  req.on('end', () => {
    // 1. Storage
    if (pathname.startsWith('/storage/v1/object/authenticated/transformations/')) {
      res.writeHead(200, { 'Content-Type': 'image/jpeg' });
      return res.end(Buffer.from('IMG'));
    }

    if (pathname === '/storage/v1/object/transformations' && req.method === 'DELETE') {
      if (db.storageFailDelete) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Storage timeout' }));
      }
      const { prefixes } = JSON.parse(bodyStr || '{}');
      if (prefixes) prefixes.forEach(p => db.storage.delete(p));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ message: 'Deleted' }));
    }

    // 2. Database
    if (pathname === '/rest/v1/transformations') {
      if (req.method === 'GET') {
        if (db.sharingCheckFail && url.search.includes('id=neq.')) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Database network timeout' }));
        }

        const idMatch = url.search.match(/[?&]id=eq\.([a-f0-9-]+)/);
        const centerMatch = url.search.match(/[?&]center_id=eq\.([a-f0-9-]+)/);
        const isPublic = url.search.includes('status=eq.published') && url.search.includes('consent_given=eq.true');

        if (isPublic) {
          const cId = centerMatch ? centerMatch[1] : null;
          const rows = Object.values(db.transformations).filter(r => r.center_id === cId && r.status === 'published' && r.consent_given === true);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(rows));
        }

        if (idMatch) {
          const row = db.transformations[idMatch[1]];
          const matchesCenter = centerMatch ? (row && row.center_id === centerMatch[1]) : true;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(row && matchesCenter ? [row] : []));
        }

        if (url.search.includes('id=neq.')) {
          const notIdMatch = url.search.match(/[?&]id=neq\.([a-f0-9-]+)/);
          const excludedId = notIdMatch ? notIdMatch[1] : '';
          const photoMatch = decodeURIComponent(url.search).match(/before_path\.eq\.([^,)]+)/);
          const targetPhoto = photoMatch ? photoMatch[1] : '';
          const sharingRows = Object.values(db.transformations).filter(r =>
            r.id !== excludedId && (r.before_path === targetPhoto || r.after_path === targetPhoto)
          );
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(sharingRows));
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(Object.values(db.transformations)));
      }

      if (req.method === 'PATCH') {
        const idMatch = url.search.match(/[?&]id=eq\.([a-f0-9-]+)/);
        const centerMatch = url.search.match(/[?&]center_id=eq\.([a-f0-9-]+)/);
        const id = idMatch ? idMatch[1] : null;
        const center = centerMatch ? centerMatch[1] : null;

        if (!id || !db.transformations[id] || (center && db.transformations[id].center_id !== center)) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify([]));
        }
        Object.assign(db.transformations[id], JSON.parse(bodyStr));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify([db.transformations[id]]));
      }

      if (req.method === 'DELETE') {
        if (db.dbFailDelete) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'DB failure' }));
        }
        const idMatch = url.search.match(/[?&]id=eq\.([a-f0-9-]+)/);
        const centerMatch = url.search.match(/[?&]center_id=eq\.([a-f0-9-]+)/);
        const id = idMatch ? idMatch[1] : null;
        const center = centerMatch ? centerMatch[1] : null;

        if (!id || !db.transformations[id] || (center && db.transformations[id].center_id !== center)) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify([]));
        }
        const deleted = db.transformations[id];
        delete db.transformations[id];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify([deleted]));
      }
    }

    res.writeHead(404);
    res.end();
  });
});

function makeRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(d) { this.body = d; return this; },
    send(d) { this.body = d; return this; },
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; return this; },
    getHeader(k) { return this.headers[k.toLowerCase()]; },
    end(d) { if (d) this.body = d; return this; }
  };
}

async function runTests() {
  await new Promise(r => server.listen(PORT, r));
  console.log('=== BACKEND RIGOROUS TEST SUITE START ===');

  const tokenA = signOwnerSession({ userId: 'u-1', center_id: centerA, email: 'a@pulsezen.in', typ: 'owner' });
  const tokenB = signOwnerSession({ userId: 'u-2', center_id: centerB, email: 'b@pulsezen.in', typ: 'owner' });
  const hA = { cookie: `pz_owner_session=${tokenA}` };
  const hB = { cookie: `pz_owner_session=${tokenB}` };

  const transId = '11112222-3333-4444-5555-666677778888';
  db.transformations[transId] = {
    id: transId,
    center_id: centerA,
    customer_name: 'Original Name',
    duration_weeks: 8,
    start_weight_kg: 80.0,
    end_weight_kg: 72.0,
    health_issue: 'Original Note',
    customer_words: 'Original Customer Words',
    ai_summary: 'Lost 8kg with coaching.',
    status: 'published',
    consent_given: true,
    before_path: `${centerA}/photo_before.jpg`,
    after_path: `${centerA}/photo_after.jpg`
  };
  db.storage.add(`${centerA}/photo_before.jpg`);
  db.storage.add(`${centerA}/photo_after.jpg`);

  // Test 1: Strict confirm === true enforcement (with false and non-boolean)
  const t1a = makeRes();
  await ownerHandler({ method: 'POST', query: { action: 'delete' }, headers: hA, body: { id: transId, confirm: 'true' } }, t1a);
  const t1b = makeRes();
  await ownerHandler({ method: 'POST', query: { action: 'delete' }, headers: hA, body: { id: transId, confirm: 1 } }, t1b);
  console.log(`[Test 1] Strict confirm===true: string 'true' -> HTTP ${t1a.statusCode} (${t1a.body?.error}), number 1 -> HTTP ${t1b.statusCode} (${t1b.body?.error})`);

  // Test 2: Field Types and Numeric Bounds
  const t2a = makeRes();
  await ownerHandler({ method: 'POST', query: { action: 'edit' }, headers: hA, body: { id: transId, duration_weeks: 0 } }, t2a);
  const t2b = makeRes();
  await ownerHandler({ method: 'POST', query: { action: 'edit' }, headers: hA, body: { id: transId, start_weight_kg: 15.0 } }, t2b);
  const t2c = makeRes();
  await ownerHandler({ method: 'POST', query: { action: 'edit' }, headers: hA, body: { id: transId, customer_name: '   ' } }, t2c);
  console.log(`[Test 2] Numeric/Type Validation: 0 weeks -> HTTP ${t2a.statusCode} (${t2a.body?.error}), 15kg -> HTTP ${t2b.statusCode} (${t2b.body?.error}), blank name -> HTTP ${t2c.statusCode} (${t2c.body?.error})`);

  // Test 3: Factual edit unpublishes story to draft requiring review
  const t3 = makeRes();
  await ownerHandler({ method: 'POST', query: { action: 'edit' }, headers: hA, body: { id: transId, customer_name: 'Reviewed Name', duration_weeks: 10 } }, t3);
  console.log(`[Test 3] Factual Edit on Published Story: HTTP ${t3.statusCode}, requires_review=${t3.body?.requires_review}, newStatus=${t3.body?.transformation?.status}`);

  // Test 4: Confirmed row deletion before storage deletion
  // If database DELETE fails, storage must NOT be called/deleted
  db.dbFailDelete = true;
  const t4 = makeRes();
  await ownerHandler({ method: 'POST', query: { action: 'delete' }, headers: hA, body: { id: transId, confirm: true } }, t4);
  db.dbFailDelete = false;
  const storageStillPresent = db.storage.has(`${centerA}/photo_before.jpg`);
  console.log(`[Test 4] DB Row Deletion Failure Guard: HTTP ${t4.statusCode} (${t4.body?.error}), StoragePreserved=${storageStillPresent}`);

  // Test 5: Safe shared-photo retention when sharing safety cannot be established (sharing check fails)
  db.sharingCheckFail = true;
  const t5 = makeRes();
  await ownerHandler({ method: 'POST', query: { action: 'delete' }, headers: hA, body: { id: transId, confirm: true } }, t5);
  db.sharingCheckFail = false;
  const t5DbDeleted = !db.transformations[transId];
  const t5StorageRetained = db.storage.has(`${centerA}/photo_before.jpg`);
  const t5DeferredReported = t5.body?.storage_cleanup_deferred?.length > 0;
  console.log(`[Test 5] Deferred Cleanup on Sharing Uncertainty: HTTP ${t5.statusCode}, dbDeleted=${t5DbDeleted}, storageRetained=${t5StorageRetained}, deferredReported=${t5DeferredReported}`);

  server.close();
  console.log('=== BACKEND RIGOROUS TEST SUITE COMPLETE ===');
}

runTests().catch(err => {
  console.error(err);
  server.close();
  process.exit(1);
});
