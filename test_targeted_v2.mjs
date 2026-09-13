import http from 'node:http';
import ownerHandler from './pulsezen_candidate_v2/api/owner.js';
import publicHandler from './pulsezen_candidate_v2/api/public.js';
import { signOwnerSession } from './pulsezen_candidate_v2/api/_session.js';

const PORT = 9991;
const BASE_URL = `http://127.0.0.1:${PORT}`;

const db = {
  transformations: {},
  storage: new Set()
};

const centerA = '11111111-1111-1111-1111-111111111111';
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
    // Storage delete
    if (pathname === '/storage/v1/object/transformations' && req.method === 'DELETE') {
      const { prefixes } = JSON.parse(bodyStr || '{}');
      if (prefixes) prefixes.forEach(p => db.storage.delete(p));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ message: 'Deleted' }));
    }

    // Database REST
    if (pathname === '/rest/v1/transformations') {
      if (req.method === 'GET') {
        const idMatch = url.search.match(/[?&]id=eq\.([a-f0-9-]+)/);
        const centerMatch = url.search.match(/[?&]center_id=eq\.([a-f0-9-]+)/);
        if (idMatch) {
          const row = db.transformations[idMatch[1]];
          const matchesCenter = centerMatch ? (row && row.center_id === centerMatch[1]) : true;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(row && matchesCenter ? [row] : []));
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(Object.values(db.transformations)));
      }

      if (req.method === 'PATCH') {
        const idMatch = url.search.match(/[?&]id=eq\.([a-f0-9-]+)/);
        const id = idMatch ? idMatch[1] : null;
        const statusDraftCheck = url.search.includes('status=eq.draft');

        if (!id || !db.transformations[id]) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify([]));
        }

        // Concurrency guard: if status=eq.draft was checked, only update if currently draft
        if (statusDraftCheck && db.transformations[id].status !== 'draft') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify([])); // 0 rows updated
        }

        // Atomic factual revision guard: check customer_words if in query
        const wordsMatch = url.search.match(/[?&]customer_words=eq\.([^&]+)/);
        if (wordsMatch && decodeURIComponent(wordsMatch[1]) !== db.transformations[id].customer_words) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify([])); // 0 rows updated
        }

        // Atomic summary guard: check ai_summary if in query
        const summaryMatch = url.search.match(/[?&]ai_summary=eq\.([^&]+)/);
        if (summaryMatch && decodeURIComponent(summaryMatch[1]) !== db.transformations[id].ai_summary) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify([])); // 0 rows updated
        }

        const patch = JSON.parse(bodyStr);
        Object.assign(db.transformations[id], patch);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify([db.transformations[id]]));
      }

      if (req.method === 'DELETE') {
        const idMatch = url.search.match(/[?&]id=eq\.([a-f0-9-]+)/);
        const id = idMatch ? idMatch[1] : null;
        if (!id || !db.transformations[id]) {
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

async function runTargetedTests() {
  await new Promise(r => server.listen(PORT, r));
  console.log('=== TARGETED TESTS: CANDIDATE V2 ===');

  const token = signOwnerSession({ userId: 'u-1', center_id: centerA, email: 'owner@pulsezen.in', typ: 'owner' });
  const headers = { cookie: `pz_owner_session=${token}` };
  const transId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  // Seed item
  db.transformations[transId] = {
    id: transId,
    center_id: centerA,
    customer_name: 'Initial Customer',
    duration_weeks: 10,
    start_weight_kg: 85.0,
    end_weight_kg: 77.0,
    health_issue: 'Initial Focus',
    customer_words: 'Initial notes',
    ai_summary: 'Initial compliant summary',
    status: 'published',
    consent_given: true,
    before_path: `${centerA}/test_before.jpg`,
    after_path: `${centerA}/test_after.jpg`
  };
  db.storage.add(`${centerA}/test_before.jpg`);
  db.storage.add(`${centerA}/test_after.jpg`);

  // 1. Target: Malformed numeric inputs (NaN, non-numeric strings, floats as int, negative)
  console.log('--- 1. Testing Malformed Number Inputs ---');
  const malformedChecks = [
    { field: 'duration_weeks', val: '12abc', expected: 400 },
    { field: 'duration_weeks', val: 'NaN', expected: 400 },
    { field: 'duration_weeks', val: '12.5', expected: 400 },
    { field: 'duration_weeks', val: '-5', expected: 400 },
    { field: 'duration_weeks', val: '0', expected: 400 },
    { field: 'duration_weeks', val: '600', expected: 400 },
    { field: 'start_weight_kg', val: 'abc', expected: 400 },
    { field: 'start_weight_kg', val: 'NaN', expected: 400 },
    { field: 'start_weight_kg', val: '15', expected: 400 },
    { field: 'start_weight_kg', val: '600', expected: 400 },
    { field: 'end_weight_kg', val: 'Infinity', expected: 400 },
    { field: 'end_weight_kg', val: '-1', expected: 400 }
  ];

  for (const c of malformedChecks) {
    const res = makeRes();
    await ownerHandler({
      method: 'POST',
      query: { action: 'edit' },
      headers,
      body: { id: transId, [c.field]: c.val }
    }, res);
    console.log(`Field [${c.field}=${c.val}]: HTTP ${res.statusCode} (${res.body?.error})`);
    if (res.statusCode !== c.expected) throw new Error(`Expected ${c.expected} for ${c.field}=${c.val}`);
  }

  // 2. Target: Customer text containing quotes, backslashes, and newlines
  console.log('--- 2. Testing Customer Text with Quotes, Backslashes, and Newlines ---');
  const specialCharsText = `Customer's "quote" with \\backslash\\ and\nmulti-line\r\nnotes: "Feeling 100% better!"`;
  const resSpecial = makeRes();
  await ownerHandler({
    method: 'POST',
    query: { action: 'edit' },
    headers,
    body: {
      id: transId,
      customer_words: specialCharsText,
      customer_name: `O'Connor "Test" \\Special\\`
    }
  }, resSpecial);

  console.log(`Special Characters Edit: HTTP ${resSpecial.statusCode}, customer_words stored intact: ${db.transformations[transId].customer_words === specialCharsText}`);
  if (db.transformations[transId].customer_words !== specialCharsText) {
    throw new Error('Special characters were corrupted or improperly handled');
  }

  // 3. Target: Concurrent edit / publication & stale publication prevention
  console.log('--- 3. Testing Concurrent Edit / Publication & Stale Publication Prevention ---');
  // Notice that after the edit in test 2, status was atomically reset to 'draft' and ai_summary was cleared to null
  console.log(`Current record status post-edit: status=${db.transformations[transId].status}, ai_summary=${db.transformations[transId].ai_summary}`);

  // Attempt to publish immediately WITHOUT reviewing the AI summary
  const resStalePub = makeRes();
  await ownerHandler({
    method: 'POST',
    query: { action: 'publish' },
    headers,
    body: {
      id: transId,
      review_snapshot: {
        customer_name: db.transformations[transId].customer_name,
        duration_weeks: db.transformations[transId].duration_weeks,
        start_weight_kg: db.transformations[transId].start_weight_kg,
        end_weight_kg: db.transformations[transId].end_weight_kg,
        health_issue: db.transformations[transId].health_issue,
        customer_words: db.transformations[transId].customer_words
      }
    }
  }, resStalePub);
  console.log(`Publishing without summary review: HTTP ${resStalePub.statusCode} (${resStalePub.body?.error}: ${resStalePub.body?.message})`);

  // Now perform owner review and update/confirm summary
  const resSummarySelect = makeRes();
  await ownerHandler({
    method: 'POST',
    query: { action: 'summary-select' },
    headers,
    body: {
      id: transId,
      text: 'Customer achieved sustainable wellness with dedicated coaching.',
      review_snapshot: {
        customer_name: db.transformations[transId].customer_name,
        duration_weeks: db.transformations[transId].duration_weeks,
        start_weight_kg: db.transformations[transId].start_weight_kg,
        end_weight_kg: db.transformations[transId].end_weight_kg,
        health_issue: db.transformations[transId].health_issue,
        customer_words: db.transformations[transId].customer_words
      }
    }
  }, resSummarySelect);
  console.log(`Owner reviews and selects AI summary: HTTP ${resSummarySelect.statusCode}, ai_summary=${db.transformations[transId].ai_summary}`);

  // Publish after review
  const resValidPub = makeRes();
  await ownerHandler({
    method: 'POST',
    query: { action: 'publish' },
    headers,
    body: {
      id: transId,
      review_snapshot: {
        customer_name: db.transformations[transId].customer_name,
        duration_weeks: db.transformations[transId].duration_weeks,
        start_weight_kg: db.transformations[transId].start_weight_kg,
        end_weight_kg: db.transformations[transId].end_weight_kg,
        health_issue: db.transformations[transId].health_issue,
        customer_words: db.transformations[transId].customer_words
      }
    }
  }, resValidPub);
  console.log(`Publishing after review: HTTP ${resValidPub.statusCode}, status=${resValidPub.body?.status}`);

  // 4. Target: Zero storage deletions (storage objects strictly retained on delete)
  console.log('--- 4. Testing Zero Storage Deletions On Transformation Delete ---');
  const initialStorageCount = db.storage.size;
  const resDel = makeRes();
  await ownerHandler({
    method: 'POST',
    query: { action: 'delete' },
    headers,
    body: { id: transId, confirm: true }
  }, resDel);

  const finalStorageCount = db.storage.size;
  const deletedFromDb = !db.transformations[transId];
  console.log(`Delete transformation: HTTP ${resDel.statusCode}, dbDeleted=${deletedFromDb}, storageDeletedCount=${resDel.body?.storage_deleted?.length}, deferredCount=${resDel.body?.storage_cleanup_deferred?.length}`);
  console.log(`Zero storage deletions verified: initialCount=${initialStorageCount}, finalCount=${finalStorageCount}, preserved=${initialStorageCount === finalStorageCount}`);

  if (resDel.body?.storage_deleted?.length !== 0 || initialStorageCount !== finalStorageCount) {
    throw new Error('Storage objects were deleted when zero storage deletion was required');
  }

  server.close();
  console.log('=== TARGETED TESTS COMPLETED SUCCESSFULLY ===');
}

runTargetedTests().catch(err => {
  console.error(err);
  server.close();
  process.exit(1);
});
