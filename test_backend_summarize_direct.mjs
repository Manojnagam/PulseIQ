import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import ownerHandler from './pulsezen_candidate_v2/api/owner.js';
import { signOwnerSession } from './pulsezen_candidate_v2/api/_session.js';

const PORT = 9984;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const centerId = '2c1c3a6e-35b4-4e30-bbae-a0cf02d8dd7a';
const secret = 'test-secret-must-be-32-chars-long-123456';

process.env.SUPABASE_URL = BASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = secret;
process.env.GROQ_API_KEY = 'mock-groq-key';
process.env.OWNER_SESSION_SECRET = secret;

const sessionCookie = `pz_owner_session=${signOwnerSession({
  userId: 'usr-1',
  center_id: centerId,
  email: 'owner@pulsezen.in',
  typ: 'owner'
})}`;

let mockGroqHandler = null;
let currentDbRow = {
  id: 'trans-123',
  center_id: centerId,
  customer_name: 'Pooja Reddy',
  customer_words: 'I joined the wellness program and lost 5.5 kg in 10 weeks.',
  status: 'draft',
  ai_summary: null,
  duration_weeks: 10,
  start_weight_kg: 68.5,
  end_weight_kg: 63.0,
  health_issue: 'Low energy'
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, BASE_URL);
  let bodyStr = '';
  req.on('data', chunk => bodyStr += chunk);
  req.on('end', () => {
    // Supabase REST GET transformations
    if (req.method === 'GET' && url.pathname.startsWith('/rest/v1/transformations')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify([currentDbRow]));
    }

    // Supabase REST PATCH transformations
    if (req.method === 'PATCH' && url.pathname.startsWith('/rest/v1/transformations')) {
      const payload = JSON.parse(bodyStr || '{}');
      if (url.searchParams.get('customer_name') && url.searchParams.get('customer_name') !== `eq.${currentDbRow.customer_name}`) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify([])); // 0 updated -> triggers 409
      }
      currentDbRow.ai_summary = payload.ai_summary;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify([currentDbRow]));
    }

    res.writeHead(404);
    res.end();
  });
});

// Intercept globalThis.fetch for api.groq.com
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const urlStr = typeof input === 'string' ? input : input.url;
  if (urlStr && urlStr.includes('api.groq.com')) {
    if (!mockGroqHandler) {
      throw new Error('No mockGroqHandler configured');
    }
    return mockGroqHandler(input, init);
  }
  return originalFetch(input, init);
};

function createMockReqRes({ action, method = 'POST', body = {} }) {
  const req = {
    method,
    url: `/api/owner/${action}`,
    query: { action },
    headers: {
      cookie: sessionCookie,
      'content-type': 'application/json'
    },
    body
  };

  let statusCode = 200;
  let responseData = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    }
  };

  return { req, res, getResult: () => ({ status: statusCode, data: responseData }) };
}

test('Direct Backend Summarize Responses & Server-Side Manual Entry Validation', async (t) => {
  await new Promise(r => server.listen(PORT, r));

  t.after(() => {
    server.close();
    globalThis.fetch = originalFetch;
  });

  await t.test('1. Both variants empty -> HTTP 502 with error details', async () => {
    mockGroqHandler = async () => {
      return new Response(JSON.stringify({
        choices: [{ message: { content: '' } }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const { req, res, getResult } = createMockReqRes({
      action: 'summarize',
      body: { id: 'trans-123' }
    });

    await ownerHandler(req, res);
    const { status, data } = getResult();

    assert.equal(status, 502, 'HTTP status is 502 Bad Gateway');
    assert.equal(data.error, 'Failed to generate AI summary');
    assert.match(data.details, /no valid variants|empty or invalid/i);
  });

  await t.test('2. One valid, companion empty -> HTTP 200 with variants: [validVariant]', async () => {
    let callCount = 0;
    mockGroqHandler = async () => {
      callCount++;
      const content = (callCount === 1)
        ? 'I feel much lighter and have more vitality every day.'
        : ''; // companion variant (callCount >= 2) returns empty string
      return new Response(JSON.stringify({
        choices: [{ message: { content } }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const { req, res, getResult } = createMockReqRes({
      action: 'summarize',
      body: { id: 'trans-123' }
    });

    await ownerHandler(req, res);
    const { status, data } = getResult();

    assert.equal(status, 200, 'HTTP status is 200');
    assert.ok(Array.isArray(data.variants), 'variants is an array');
    assert.equal(data.variants.length, 1, 'contains exactly 1 valid variant');
    assert.equal(data.variants[0], 'I feel much lighter and have more vitality every day.');
  });

  await t.test('3. One valid, companion provider failure (thrown error) -> HTTP 200 with variants: [validVariant]', async () => {
    let callCount = 0;
    mockGroqHandler = async () => {
      callCount++;
      if (callCount === 1) {
        // Variant 1 provider failure
        return new Response(JSON.stringify({ error: { message: 'Service Unavailable' } }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      // Variant 2 succeeds
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'Consistent habits and daily workouts boosted my energy.' } }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const { req, res, getResult } = createMockReqRes({
      action: 'summarize',
      body: { id: 'trans-123' }
    });

    await ownerHandler(req, res);
    const { status, data } = getResult();

    assert.equal(status, 200, 'HTTP status is 200');
    assert.ok(Array.isArray(data.variants), 'variants is an array');
    assert.equal(data.variants.length, 1, 'contains exactly 1 valid variant');
    assert.equal(data.variants[0], 'Consistent habits and daily workouts boosted my energy.');
  });

  await t.test('4. Provider failure on both -> HTTP 502 with error details', async () => {
    mockGroqHandler = async () => {
      return new Response(JSON.stringify({ error: { message: 'Upstream rate limit exceeded' } }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const { req, res, getResult } = createMockReqRes({
      action: 'summarize',
      body: { id: 'trans-123' }
    });

    await ownerHandler(req, res);
    const { status, data } = getResult();

    assert.equal(status, 502, 'HTTP status is 502');
    assert.equal(data.error, 'Failed to generate AI summary');
    assert.match(data.details, /rate limit|Upstream/i);
  });

  await t.test('5. Claim blocking: prohibited medical terms in generation -> HTTP 400 claim_blocked', async () => {
    mockGroqHandler = async () => {
      // Returns medical/curative claims
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'The doctor cured my chronic diabetes with herbal medicine and treatment.' } }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const { req, res, getResult } = createMockReqRes({
      action: 'summarize',
      body: { id: 'trans-123' }
    });

    await ownerHandler(req, res);
    const { status, data } = getResult();

    assert.equal(status, 400, 'HTTP status is 400 Bad Request');
    assert.equal(data.error, 'claim_blocked');
    assert.ok(Array.isArray(data.banned_terms), 'banned_terms is an array');
    assert.ok(data.banned_terms.includes('doctor') || data.banned_terms.includes('cure') || data.banned_terms.includes('treatment'));
  });

  await t.test('6. Server-Side Validation: Valid clean manual entry with valid review snapshot -> HTTP 200', async () => {
    const validSnapshot = {
      customer_name: currentDbRow.customer_name,
      duration_weeks: currentDbRow.duration_weeks,
      start_weight_kg: currentDbRow.start_weight_kg,
      end_weight_kg: currentDbRow.end_weight_kg,
      health_issue: currentDbRow.health_issue,
      customer_words: currentDbRow.customer_words
    };

    const { req, res, getResult } = createMockReqRes({
      action: 'summary-select',
      body: {
        id: 'trans-123',
        text: 'Custom clean summary written manually by owner.',
        review_snapshot: validSnapshot
      }
    });

    await ownerHandler(req, res);
    const { status, data } = getResult();

    assert.equal(status, 200, 'HTTP status is 200');
    assert.equal(data.success, true);
    assert.equal(data.ai_summary, 'Custom clean summary written manually by owner.');
    assert.equal(currentDbRow.ai_summary, 'Custom clean summary written manually by owner.');
  });

  await t.test('7. Server-Side Validation: Manual entry with prohibited medical terms -> HTTP 400 claim_blocked', async () => {
    const validSnapshot = {
      customer_name: currentDbRow.customer_name,
      duration_weeks: currentDbRow.duration_weeks,
      start_weight_kg: currentDbRow.start_weight_kg,
      end_weight_kg: currentDbRow.end_weight_kg,
      health_issue: currentDbRow.health_issue,
      customer_words: currentDbRow.customer_words
    };

    const { req, res, getResult } = createMockReqRes({
      action: 'summary-select',
      body: {
        id: 'trans-123',
        text: 'Our clinic doctor cured all disease and eliminated medication.',
        review_snapshot: validSnapshot
      }
    });

    await ownerHandler(req, res);
    const { status, data } = getResult();

    assert.equal(status, 400, 'HTTP status is 400');
    assert.equal(data.error, 'claim_blocked');
    assert.ok(data.banned_terms.length > 0);
  });

  await t.test('8. Server-Side Validation: Empty or whitespace manual entry -> HTTP 400', async () => {
    const validSnapshot = {
      customer_name: currentDbRow.customer_name,
      duration_weeks: currentDbRow.duration_weeks,
      start_weight_kg: currentDbRow.start_weight_kg,
      end_weight_kg: currentDbRow.end_weight_kg,
      health_issue: currentDbRow.health_issue,
      customer_words: currentDbRow.customer_words
    };

    const { req, res, getResult } = createMockReqRes({
      action: 'summary-select',
      body: {
        id: 'trans-123',
        text: '    \t\n  ',
        review_snapshot: validSnapshot
      }
    });

    await ownerHandler(req, res);
    const { status, data } = getResult();

    assert.equal(status, 400, 'HTTP status is 400');
    assert.match(data.error, /required/i);
  });

  await t.test('9. Server-Side Validation: Missing review snapshot -> HTTP 400 missing_review_snapshot', async () => {
    const { req, res, getResult } = createMockReqRes({
      action: 'summary-select',
      body: {
        id: 'trans-123',
        text: 'Valid clean manual summary without snapshot.'
      }
    });

    await ownerHandler(req, res);
    const { status, data } = getResult();

    assert.equal(status, 400, 'HTTP status is 400');
    assert.equal(data.error, 'missing_review_snapshot');
  });

  await t.test('10. Server-Side Validation: Stale review snapshot -> HTTP 409 stale_factual_revision', async () => {
    const staleSnapshot = {
      customer_name: 'Old Customer Name', // does not match DB
      duration_weeks: currentDbRow.duration_weeks,
      start_weight_kg: currentDbRow.start_weight_kg,
      end_weight_kg: currentDbRow.end_weight_kg,
      health_issue: currentDbRow.health_issue,
      customer_words: currentDbRow.customer_words
    };

    const { req, res, getResult } = createMockReqRes({
      action: 'summary-select',
      body: {
        id: 'trans-123',
        text: 'Clean summary submitted against stale snapshot.',
        review_snapshot: staleSnapshot
      }
    });

    await ownerHandler(req, res);
    const { status, data } = getResult();

    assert.equal(status, 409, 'HTTP status is 409');
    assert.equal(data.error, 'stale_factual_revision');
  });
});
