import http from 'node:http';
import ownerHandler from './pulsezen_candidate_v2/api/owner.js';
import { signOwnerSession } from './pulsezen_candidate_v2/api/_session.js';

const PORT = 9992;
const BASE_URL = `http://127.0.0.1:${PORT}`;

const db = {
  transformations: {}
};

const centerA = '22222222-2222-2222-2222-222222222222';
const secret = 'test-secret-must-be-32-chars-long-abcdef';
process.env.SUPABASE_URL = BASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = secret;
process.env.OWNER_SESSION_SECRET = secret;

let pausePublishHook = null;
let pauseSummaryHook = null;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, BASE_URL);
  const pathname = url.pathname;
  let bodyStr = '';
  req.on('data', c => bodyStr += c);
  req.on('end', async () => {
    if (pathname === '/rest/v1/transformations') {
      const idMatch = url.search.match(/[?&]id=eq\.([a-f0-9-]+)/);
      const id = idMatch ? idMatch[1] : null;

      if (req.method === 'GET') {
        const row = id ? db.transformations[id] : null;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(row ? [row] : []));
      }

      if (req.method === 'PATCH') {
        // If publish was read and is now attempting write, pause before write and run interleaving hook
        if (bodyStr.includes('"status":"published"') && pausePublishHook) {
          const hook = pausePublishHook;
          pausePublishHook = null;
          await hook();
        }

        // If summary select was read and is now attempting write, pause before write and run interleaving hook
        if (bodyStr.includes('"ai_summary"') && pauseSummaryHook) {
          const hook = pauseSummaryHook;
          pauseSummaryHook = null;
          await hook();
        }

        if (!id || !db.transformations[id]) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify([]));
        }

        const current = db.transformations[id];

        // 1. Check status condition if requested
        const statusMatch = url.search.match(/[?&]status=eq\.([a-zA-Z0-9_-]+)/);
        if (statusMatch && decodeURIComponent(statusMatch[1]) !== current.status) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify([])); // 0 rows updated
        }

        // 2. Check consent_given condition if requested
        const consentMatch = url.search.match(/[?&]consent_given=eq\.([a-zA-Z0-9_-]+)/);
        if (consentMatch && (consentMatch[1] === 'true') !== Boolean(current.consent_given)) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify([])); // 0 rows updated
        }

        // 3. Check customer_name condition if requested
        const nameMatch = url.search.match(/[?&]customer_name=eq\.([^&]+)/);
        if (nameMatch && decodeURIComponent(nameMatch[1]) !== current.customer_name) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify([])); // 0 rows updated
        }

        // 4. Check customer_words condition if requested
        const wordsMatch = url.search.match(/[?&]customer_words=eq\.([^&]+)/);
        if (wordsMatch && decodeURIComponent(wordsMatch[1]) !== current.customer_words) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify([])); // 0 rows updated
        }

        // 5. Check ai_summary condition if requested
        const summaryMatch = url.search.match(/[?&]ai_summary=eq\.([^&]+)/);
        if (summaryMatch && decodeURIComponent(summaryMatch[1]) !== current.ai_summary) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify([])); // 0 rows updated
        }

        // 6. Check duration_weeks condition if requested
        const durationMatch = url.search.match(/[?&]duration_weeks=(eq\.([0-9]+)|is\.null)/);
        if (durationMatch) {
          if (durationMatch[1] === 'is.null' && current.duration_weeks !== null) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify([]));
          } else if (durationMatch[2] && Number(durationMatch[2]) !== current.duration_weeks) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify([]));
          }
        }

        // 7. Check start_weight_kg condition if requested
        const startWtMatch = url.search.match(/[?&]start_weight_kg=(eq\.([0-9.]+)|is\.null)/);
        if (startWtMatch) {
          if (startWtMatch[1] === 'is.null' && current.start_weight_kg !== null) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify([]));
          } else if (startWtMatch[2] && Number(startWtMatch[2]) !== Number(current.start_weight_kg)) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify([]));
          }
        }

        // 8. Check end_weight_kg condition if requested
        const endWtMatch = url.search.match(/[?&]end_weight_kg=(eq\.([0-9.]+)|is\.null)/);
        if (endWtMatch) {
          if (endWtMatch[1] === 'is.null' && current.end_weight_kg !== null) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify([]));
          } else if (endWtMatch[2] && Number(endWtMatch[2]) !== Number(current.end_weight_kg)) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify([]));
          }
        }

        // 9. Check health_issue condition if requested
        const issueMatch = url.search.match(/[?&]health_issue=(eq\.([^&]+)|is\.null)/);
        if (issueMatch) {
          if (issueMatch[1] === 'is.null' && current.health_issue !== null) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify([]));
          } else if (issueMatch[2] && decodeURIComponent(issueMatch[2]) !== current.health_issue) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify([]));
          }
        }

        const patch = JSON.parse(bodyStr);
        Object.assign(db.transformations[id], patch);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify([db.transformations[id]]));
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

function resetDb(transId) {
  db.transformations[transId] = {
    id: transId,
    center_id: centerA,
    customer_name: 'Anjali Sharma',
    duration_weeks: 10,
    start_weight_kg: 82.0,
    end_weight_kg: 72.0,
    health_issue: 'Lack of stamina',
    customer_words: 'I had low stamina climbing stairs every evening. After 10 weeks of healthy nutrition, I feel active all day.',
    ai_summary: 'I followed the routine for 10 weeks and feel energetic all day.',
    status: 'draft',
    consent_given: true,
    consent_name: 'Anjali Sharma',
    consent_phone_last4: '1234',
    before_path: `${centerA}/before.jpg`,
    after_path: `${centerA}/after.jpg`
  };
}

async function runDeterministicRaceTests() {
  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`Mock DB server listening on http://127.0.0.1:${PORT}`);

  const token = signOwnerSession({ userId: 'u-1', center_id: centerA, email: 'owner@pulsezen.in', typ: 'owner' });
  const headers = { cookie: `pz_owner_session=${token}` };
  const transId = '33333333-3333-3333-3333-333333333333';

  console.log('=== TEST SUITE: DETERMINISTIC STALE PUBLISH & SUMMARY RACES ===');

  // ---------------------------------------------------------------------------
  // TEST 1: Missing and Invalid Review Snapshots
  // ---------------------------------------------------------------------------
  console.log('\n--- 1. Testing Missing & Invalid Review Snapshots ---');
  resetDb(transId);

  // 1a. summary-select missing review_snapshot
  const missingSnapRes1 = makeRes();
  await ownerHandler({
    method: 'POST',
    query: { action: 'summary-select' },
    headers,
    body: { id: transId, text: 'A great journey.' }
  }, missingSnapRes1);
  if (missingSnapRes1.statusCode !== 400 || missingSnapRes1.body?.error !== 'missing_review_snapshot') {
    throw new Error(`Expected HTTP 400 missing_review_snapshot for summary-select, got ${missingSnapRes1.statusCode}`);
  }
  console.log('✓ 1a PASSED: summary-select rejected missing snapshot with HTTP 400 missing_review_snapshot.');

  // 1b. publish missing review_snapshot
  const missingSnapRes2 = makeRes();
  await ownerHandler({
    method: 'POST',
    query: { action: 'publish' },
    headers,
    body: { id: transId }
  }, missingSnapRes2);
  if (missingSnapRes2.statusCode !== 400 || missingSnapRes2.body?.error !== 'missing_review_snapshot') {
    throw new Error(`Expected HTTP 400 missing_review_snapshot for publish, got ${missingSnapRes2.statusCode}`);
  }
  console.log('✓ 1b PASSED: publish rejected missing snapshot with HTTP 400 missing_review_snapshot.');

  // 1c. summary-select invalid/incomplete review_snapshot
  const invalidSnapRes = makeRes();
  await ownerHandler({
    method: 'POST',
    query: { action: 'summary-select' },
    headers,
    body: {
      id: transId,
      text: 'A great journey.',
      review_snapshot: { customer_name: 'Anjali' } // missing customer_words
    }
  }, invalidSnapRes);
  if (invalidSnapRes.statusCode !== 400 || invalidSnapRes.body?.error !== 'invalid_review_snapshot') {
    throw new Error(`Expected HTTP 400 invalid_review_snapshot for incomplete snapshot, got ${invalidSnapRes.statusCode}`);
  }
  console.log('✓ 1c PASSED: summary-select rejected incomplete snapshot with HTTP 400 invalid_review_snapshot.');

  // ---------------------------------------------------------------------------
  // TEST 2: Deterministic Interleaving Race on Customer Words During Publish
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Testing Deterministic Publish Interleaving Race (Customer Words) ---');
  resetDb(transId);
  const initialSnapshot = {
    customer_name: db.transformations[transId].customer_name,
    duration_weeks: db.transformations[transId].duration_weeks,
    start_weight_kg: db.transformations[transId].start_weight_kg,
    end_weight_kg: db.transformations[transId].end_weight_kg,
    health_issue: db.transformations[transId].health_issue,
    customer_words: db.transformations[transId].customer_words
  };

  let editCompleted1 = false;
  pausePublishHook = async () => {
    console.log('[Interleaving Hook 1] Publish has completed row read. Pausing publish mid-flight...');
    console.log('[Interleaving Hook 1] Concurrently executing factual edit (customer_words)...');

    const editRes = makeRes();
    await ownerHandler({
      method: 'POST',
      query: { action: 'edit' },
      headers,
      body: {
        id: transId,
        customer_words: 'Revised statement: I lost 12 kg and now run 5k with full vitality.'
      }
    }, editRes);

    console.log(`[Interleaving Hook 1] Factual edit finished: HTTP ${editRes.statusCode}`);
    if (editRes.statusCode !== 200) {
      throw new Error(`Concurrent edit failed with HTTP ${editRes.statusCode}`);
    }
    editCompleted1 = true;
    console.log('[Interleaving Hook 1] Resuming paused publish operation...');
  };

  const pubRes1 = makeRes();
  await ownerHandler({
    method: 'POST',
    query: { action: 'publish' },
    headers,
    body: {
      id: transId,
      review_snapshot: initialSnapshot
    }
  }, pubRes1);

  console.log(`Publish result post-interleaving: HTTP ${pubRes1.statusCode} (${pubRes1.body?.error})`);
  if (!editCompleted1) throw new Error('Interleaving race did not complete concurrent edit');
  if (pubRes1.statusCode !== 409 || pubRes1.body?.error !== 'stale_factual_revision') {
    throw new Error(`Expected HTTP 409 stale_factual_revision, got ${pubRes1.statusCode}`);
  }
  if (db.transformations[transId].status !== 'draft') {
    throw new Error(`Expected status to remain draft, got ${db.transformations[transId].status}`);
  }
  console.log('✓ TEST 2 PASSED: Publish interleaving on customer_words failed closed with HTTP 409 stale_factual_revision.');

  // ---------------------------------------------------------------------------
  // TEST 3: Deterministic Interleaving Race on Metric-Only Edit During Publish
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Testing Deterministic Publish Interleaving Race (Metric-Only Edit) ---');
  resetDb(transId);
  const metricSnapshot = {
    customer_name: db.transformations[transId].customer_name,
    duration_weeks: db.transformations[transId].duration_weeks, // 10
    start_weight_kg: db.transformations[transId].start_weight_kg,
    end_weight_kg: db.transformations[transId].end_weight_kg,
    health_issue: db.transformations[transId].health_issue,
    customer_words: db.transformations[transId].customer_words
  };

  let metricEditCompleted = false;
  pausePublishHook = async () => {
    console.log('[Interleaving Hook 2] Publish has completed row read. Pausing publish mid-flight...');
    console.log('[Interleaving Hook 2] Concurrently executing metric-only edit (duration_weeks 10 -> 14)...');

    const editRes = makeRes();
    await ownerHandler({
      method: 'POST',
      query: { action: 'edit' },
      headers,
      body: {
        id: transId,
        duration_weeks: '14' // metric-only change
      }
    }, editRes);

    console.log(`[Interleaving Hook 2] Metric-only edit finished: HTTP ${editRes.statusCode}`);
    if (editRes.statusCode !== 200) {
      throw new Error(`Concurrent metric edit failed with HTTP ${editRes.statusCode}`);
    }
    metricEditCompleted = true;
    console.log('[Interleaving Hook 2] Resuming paused publish operation...');
  };

  const pubRes2 = makeRes();
  await ownerHandler({
    method: 'POST',
    query: { action: 'publish' },
    headers,
    body: {
      id: transId,
      review_snapshot: metricSnapshot
    }
  }, pubRes2);

  console.log(`Publish result post-metric-interleaving: HTTP ${pubRes2.statusCode} (${pubRes2.body?.error})`);
  if (!metricEditCompleted) throw new Error('Interleaving race did not complete metric edit');
  if (pubRes2.statusCode !== 409 || pubRes2.body?.error !== 'stale_factual_revision') {
    throw new Error(`Expected HTTP 409 stale_factual_revision on metric-only change, got ${pubRes2.statusCode}`);
  }
  if (db.transformations[transId].status !== 'draft') {
    throw new Error(`Expected status to remain draft, got ${db.transformations[transId].status}`);
  }
  console.log('✓ TEST 3 PASSED: Metric-only edit interleaving failed closed with HTTP 409 stale_factual_revision.');

  // ---------------------------------------------------------------------------
  // TEST 4: Deterministic Interleaving Race on Consent Withdrawal During Publish
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Testing Deterministic Publish Interleaving Race (Consent Withdrawal) ---');
  resetDb(transId);
  const consentSnapshot = {
    customer_name: db.transformations[transId].customer_name,
    duration_weeks: db.transformations[transId].duration_weeks,
    start_weight_kg: db.transformations[transId].start_weight_kg,
    end_weight_kg: db.transformations[transId].end_weight_kg,
    health_issue: db.transformations[transId].health_issue,
    customer_words: db.transformations[transId].customer_words
  };

  let consentWithdrawn = false;
  pausePublishHook = async () => {
    console.log('[Interleaving Hook 3] Publish has completed row read. Pausing publish mid-flight...');
    console.log('[Interleaving Hook 3] Concurrently unpublishing / withdrawing consent...');

    const unpubRes = makeRes();
    await ownerHandler({
      method: 'POST',
      query: { action: 'unpublish' },
      headers,
      body: { id: transId }
    }, unpubRes);

    console.log(`[Interleaving Hook 3] Consent withdrawal finished: HTTP ${unpubRes.statusCode}, consent_given=${db.transformations[transId].consent_given}`);
    if (unpubRes.statusCode !== 200) {
      throw new Error(`Concurrent unpublish failed with HTTP ${unpubRes.statusCode}`);
    }
    consentWithdrawn = true;
    console.log('[Interleaving Hook 3] Resuming paused publish operation...');
  };

  const pubRes3 = makeRes();
  await ownerHandler({
    method: 'POST',
    query: { action: 'publish' },
    headers,
    body: {
      id: transId,
      review_snapshot: consentSnapshot
    }
  }, pubRes3);

  console.log(`Publish result post-consent-withdrawal: HTTP ${pubRes3.statusCode} (${pubRes3.body?.error})`);
  if (!consentWithdrawn) throw new Error('Interleaving race did not complete consent withdrawal');
  if (pubRes3.statusCode !== 409 || pubRes3.body?.error !== 'stale_factual_revision') {
    throw new Error(`Expected HTTP 409 stale_factual_revision on consent withdrawal race, got ${pubRes3.statusCode}`);
  }
  if (db.transformations[transId].status !== 'draft') {
    throw new Error(`Expected status to remain draft, got ${db.transformations[transId].status}`);
  }
  console.log('✓ TEST 4 PASSED: Consent withdrawal interleaving failed closed with HTTP 409 stale_factual_revision.');

  // ---------------------------------------------------------------------------
  // TEST 5: Stale Summary Selection After Factual Edit
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Testing Stale Summary Selection After Factual Edit ---');
  resetDb(transId);
  const oldSnapshot = {
    customer_name: db.transformations[transId].customer_name,
    duration_weeks: db.transformations[transId].duration_weeks,
    start_weight_kg: db.transformations[transId].start_weight_kg,
    end_weight_kg: db.transformations[transId].end_weight_kg,
    health_issue: db.transformations[transId].health_issue,
    customer_words: db.transformations[transId].customer_words
  };

  // Perform factual edit modifying customer_words and clearing ai_summary
  const editRes5 = makeRes();
  await ownerHandler({
    method: 'POST',
    query: { action: 'edit' },
    headers,
    body: {
      id: transId,
      customer_words: 'I had low stamina in the evenings. After proper nutrition, I feel energetic all day.'
    }
  }, editRes5);
  if (editRes5.statusCode !== 200) throw new Error(`Edit failed: HTTP ${editRes5.statusCode}`);

  // Now attempt summary-select passing the old snapshot from before the edit
  const staleSelectRes = makeRes();
  await ownerHandler({
    method: 'POST',
    query: { action: 'summary-select' },
    headers,
    body: {
      id: transId,
      text: 'I followed the 10-week routine and climbed stairs easily.',
      review_snapshot: oldSnapshot
    }
  }, staleSelectRes);

  console.log(`Stale summary select result: HTTP ${staleSelectRes.statusCode} (${staleSelectRes.body?.error})`);
  if (staleSelectRes.statusCode !== 409 || staleSelectRes.body?.error !== 'stale_factual_revision') {
    throw new Error(`Expected HTTP 409 stale_factual_revision for stale summary selection, got ${staleSelectRes.statusCode}`);
  }
  if (db.transformations[transId].ai_summary !== null) {
    throw new Error(`Expected ai_summary to remain null, got ${db.transformations[transId].ai_summary}`);
  }
  console.log('✓ TEST 5 PASSED: Stale summary selection rejected with HTTP 409 stale_factual_revision.');

  // ---------------------------------------------------------------------------
  // TEST 6: Concurrent Summary Selection Interleaving Race
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. Testing Concurrent Summary Selection Interleaving Race ---');
  resetDb(transId);
  const snap6 = {
    customer_name: db.transformations[transId].customer_name,
    duration_weeks: db.transformations[transId].duration_weeks,
    start_weight_kg: db.transformations[transId].start_weight_kg,
    end_weight_kg: db.transformations[transId].end_weight_kg,
    health_issue: db.transformations[transId].health_issue,
    customer_words: db.transformations[transId].customer_words
  };

  let concurrentSummaryEditDone = false;
  pauseSummaryHook = async () => {
    console.log('[Interleaving Hook 4] Summary select has read row. Pausing summary select...');
    console.log('[Interleaving Hook 4] Concurrently executing another factual edit...');
    const editRes6 = makeRes();
    await ownerHandler({
      method: 'POST',
      query: { action: 'edit' },
      headers,
      body: {
        id: transId,
        customer_words: 'Third revision: I lost 14 kg and feel energetic in daily life.'
      }
    }, editRes6);
    console.log(`[Interleaving Hook 4] Concurrent edit finished: HTTP ${editRes6.statusCode}`);
    concurrentSummaryEditDone = true;
  };

  const concurrentSummaryRes = makeRes();
  await ownerHandler({
    method: 'POST',
    query: { action: 'summary-select' },
    headers,
    body: {
      id: transId,
      text: 'Selected compliant summary for snapshot 6.',
      review_snapshot: snap6
    }
  }, concurrentSummaryRes);

  console.log(`Concurrent summary select result: HTTP ${concurrentSummaryRes.statusCode} (${concurrentSummaryRes.body?.error})`);
  if (!concurrentSummaryEditDone) throw new Error('Concurrent summary edit hook did not run');
  if (concurrentSummaryRes.statusCode !== 409 || concurrentSummaryRes.body?.error !== 'stale_factual_revision') {
    throw new Error(`Expected HTTP 409 for concurrent summary select race, got ${concurrentSummaryRes.statusCode}`);
  }
  console.log('✓ TEST 6 PASSED: Concurrent summary selection interleaving race failed closed with HTTP 409.');

  // ---------------------------------------------------------------------------
  // TEST 7: Happy Path: Fresh Review Snapshot and Compliant Publication
  // ---------------------------------------------------------------------------
  console.log('\n--- 7. Testing Fresh Review Snapshot and Successful Publication ---');
  // At this point, db has 'Third revision: I lost 14 kg and feel energetic in daily life.'
  const freshSnapshot = {
    customer_name: db.transformations[transId].customer_name,
    duration_weeks: db.transformations[transId].duration_weeks,
    start_weight_kg: db.transformations[transId].start_weight_kg,
    end_weight_kg: db.transformations[transId].end_weight_kg,
    health_issue: db.transformations[transId].health_issue,
    customer_words: db.transformations[transId].customer_words
  };

  const validSelectRes = makeRes();
  await ownerHandler({
    method: 'POST',
    query: { action: 'summary-select' },
    headers,
    body: {
      id: transId,
      text: 'I lost weight steadily and feel energetic in my daily life.',
      review_snapshot: freshSnapshot
    }
  }, validSelectRes);

  console.log(`Fresh summary select: HTTP ${validSelectRes.statusCode}, ai_summary="${db.transformations[transId].ai_summary}"`);
  if (validSelectRes.statusCode !== 200) {
    throw new Error(`Expected HTTP 200 for fresh summary select, got ${validSelectRes.statusCode}`);
  }

  // Ensure consent is given
  db.transformations[transId].consent_given = true;

  const validPubRes = makeRes();
  await ownerHandler({
    method: 'POST',
    query: { action: 'publish' },
    headers,
    body: {
      id: transId,
      review_snapshot: freshSnapshot
    }
  }, validPubRes);

  console.log(`Fresh publish: HTTP ${validPubRes.statusCode}, status=${validPubRes.body?.status}`);
  if (validPubRes.statusCode !== 200 || validPubRes.body?.status !== 'published') {
    throw new Error(`Expected HTTP 200 and status='published', got ${validPubRes.statusCode}`);
  }
  console.log('✓ TEST 7 PASSED: Valid fresh review snapshot and publication completed successfully.');

  server.close();
  console.log('\n=== ALL DETERMINISTIC RACE & SNAPSHOT TESTS COMPLETED SUCCESSFULLY ===');
}

runDeterministicRaceTests().catch(err => {
  console.error(err);
  server.close();
  process.exit(1);
});
