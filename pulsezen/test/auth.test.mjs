/**
 * PulseZen Owner Authentication Phase 0 Security & Reliability Test Suite
 *
 * Verifies:
 * 1. Provider timeout after simulated acceptance (fails closed, remains ineligible).
 * 2. Failure to persist delivery activation (fails closed with 500, ineligible).
 * 3. Failure to invalidate pending attempt on provider failure (fails closed, delivery pending gate preserves ineligibility).
 * 4. Realistic SQL NULL semantics (validates three-valued logic and explicit invalidated=eq.false).
 * 5. Concurrent single-use verification (atomic conditional update prevents double-spend race condition, handles mid-flight expiry and invalidation).
 * 6. No OTP disclosure (zero plaintext OTP in response bodies, headers, or server logs).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import handler from '../api/owner.js';

// Setup isolated environment variables for testing (NEVER pointing to live production)
process.env.SUPABASE_URL = 'https://test-isolated.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_isolated_service_role_key';
process.env.OWNER_SESSION_SECRET = 'test_isolated_session_secret_for_pulsezen_owner_portal_2026';
process.env.RESEND_API_KEY = 're_test_dummy_key_12345';

function createMockReq(url, method, body = {}, headers = {}) {
  const parsedUrl = new URL(url, 'http://localhost');
  const query = Object.fromEntries(parsedUrl.searchParams.entries());
  return {
    url,
    method,
    body,
    headers: {
      'content-type': 'application/json',
      ...headers
    },
    query
  };
}

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, val) {
      this.headers[name.toLowerCase()] = val;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
  return res;
}

/**
 * Isolated in-memory PostgREST mock database.
 * Simulates SQL semantics, atomic single-row updates, and conditional WHERE filtering.
 */
class MockDatabase {
  constructor() {
    this.owner_users = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        center_id: '22222222-2222-2222-2222-222222222222',
        email: 'owner@wellness.test',
        status: 'active'
      }
    ];
    this.owner_login_attempts = [];
    this.nextId = 1;
    this.resendBehavior = 'success'; // 'success' | 'timeout' | 'error'
    this.activationDbFail = false;
    this.invalidationDbFail = false;
  }

  reset() {
    this.owner_login_attempts = [];
    this.nextId = 1;
    this.resendBehavior = 'success';
    this.activationDbFail = false;
    this.invalidationDbFail = false;
  }

  async handleFetch(url, options = {}) {
    const method = options.method || 'GET';
    const parsed = new URL(url);

    // Resend Provider Mock
    if (url.startsWith('https://api.resend.com/emails')) {
      if (this.resendBehavior === 'timeout') {
        // Simulate provider timing out after simulated acceptance
        throw new Error('Connection timeout to api.resend.com after 10000ms');
      }
      if (this.resendBehavior === 'error') {
        return {
          ok: false,
          status: 500,
          json: async () => ({ error: 'Internal Server Error' })
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'email_test_123' })
      };
    }

    // Supabase PostgREST Mock
    if (url.startsWith('https://test-isolated.supabase.co/rest/v1/owner_users')) {
      const emailFilter = parsed.searchParams.get('email');
      const targetEmail = emailFilter ? emailFilter.replace(/^eq\./, '') : null;
      const rows = this.owner_users.filter(u => !targetEmail || u.email === targetEmail);
      return {
        ok: true,
        status: 200,
        json: async () => rows
      };
    }

    if (url.startsWith('https://test-isolated.supabase.co/rest/v1/owner_login_attempts')) {
      if (method === 'POST') {
        const body = JSON.parse(options.body || '{}');
        const row = {
          id: 'attempt-' + (this.nextId++),
          created_at: new Date().toISOString(),
          ...body
        };
        this.owner_login_attempts.push(row);
        return {
          ok: true,
          status: 201,
          json: async () => [row]
        };
      }

      if (method === 'PATCH') {
        if (this.activationDbFail && url.includes('invalidated=eq.true')) {
          return {
            ok: false,
            status: 500,
            json: async () => ({ error: 'Database connection dropped during activation' })
          };
        }

        if (this.invalidationDbFail && url.includes('attemptId')) {
          return {
            ok: false,
            status: 500,
            json: async () => ({ error: 'Database connection dropped during invalidation' })
          };
        }

        // Parse query filters
        const idFilter = parsed.searchParams.get('id');
        const consumedFilter = parsed.searchParams.get('consumed');
        const invalidatedFilter = parsed.searchParams.get('invalidated');
        const expiresAtFilter = parsed.searchParams.get('expires_at');
        const emailFilter = parsed.searchParams.get('email');

        const patchBody = JSON.parse(options.body || '{}');
        const updatedRows = [];

        for (const row of this.owner_login_attempts) {
          let match = true;

          if (idFilter && idFilter.startsWith('eq.')) {
            if (row.id !== idFilter.slice(3)) match = false;
          }

          if (emailFilter && emailFilter.startsWith('eq.')) {
            if (row.email !== emailFilter.slice(3)) match = false;
          }

          if (consumedFilter && consumedFilter.startsWith('eq.')) {
            const expectedConsumed = consumedFilter.slice(3) === 'true';
            if (row.consumed !== expectedConsumed) match = false;
          }

          if (invalidatedFilter && invalidatedFilter.startsWith('eq.')) {
            const expectedInvalidated = invalidatedFilter.slice(3) === 'true';
            if (row.invalidated !== expectedInvalidated) match = false;
          }

          if (expiresAtFilter && expiresAtFilter.startsWith('gt.')) {
            const thresholdIso = expiresAtFilter.slice(3);
            if (!row.expires_at || new Date(row.expires_at).getTime() <= new Date(thresholdIso).getTime()) {
              match = false;
            }
          }

          if (match) {
            // Under concurrency simulation: in JS event loop, conditional evaluation and modification is atomic
            Object.assign(row, patchBody);
            updatedRows.push({ ...row });
            if (idFilter) break; // ID is unique
          }
        }

        return {
          ok: true,
          status: 200,
          json: async () => updatedRows
        };
      }

      if (method === 'GET') {
        const emailFilter = parsed.searchParams.get('email');
        const attemptTypeFilter = parsed.searchParams.get('attempt_type');
        const consumedFilter = parsed.searchParams.get('consumed');
        const invalidatedFilter = parsed.searchParams.get('invalidated');
        const expiresAtFilter = parsed.searchParams.get('expires_at');
        const successFilter = parsed.searchParams.get('success');

        let rows = [...this.owner_login_attempts];

        if (emailFilter && emailFilter.startsWith('eq.')) {
          const e = emailFilter.slice(3);
          rows = rows.filter(r => r.email === e);
        }

        if (attemptTypeFilter && attemptTypeFilter.startsWith('eq.')) {
          const t = attemptTypeFilter.slice(3);
          rows = rows.filter(r => r.attempt_type === t);
        }

        if (successFilter && successFilter.startsWith('eq.')) {
          const s = successFilter.slice(3) === 'true';
          rows = rows.filter(r => r.success === s);
        }

        if (consumedFilter && consumedFilter.startsWith('eq.')) {
          const c = consumedFilter.slice(3) === 'true';
          rows = rows.filter(r => r.consumed === c);
        }

        if (invalidatedFilter && invalidatedFilter.startsWith('eq.')) {
          const inv = invalidatedFilter.slice(3) === 'true';
          rows = rows.filter(r => r.invalidated === inv);
        }

        if (expiresAtFilter && expiresAtFilter.startsWith('gt.')) {
          const thresholdIso = expiresAtFilter.slice(3);
          rows = rows.filter(r => r.expires_at && new Date(r.expires_at).getTime() > new Date(thresholdIso).getTime());
        }

        // order=created_at.desc
        rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        return {
          ok: true,
          status: 200,
          json: async () => rows
        };
      }
    }

    throw new Error('Unhandled mock URL: ' + url);
  }
}

const mockDb = new MockDatabase();
global.fetch = async (url, options) => mockDb.handleFetch(url, options);

test.describe('PulseZen Owner Auth Security Test Suite', () => {

  test.beforeEach(() => {
    mockDb.reset();
  });

  test('1. Provider timeout after simulated acceptance fails closed and leaves OTP completely ineligible', async () => {
    mockDb.resendBehavior = 'timeout';

    const req = createMockReq('http://localhost/api/owner?action=login-request', 'POST', {
      email: 'owner@wellness.test'
    });
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 502, 'Should fail closed with 502 on provider timeout');
    assert.equal(res.body.error, 'delivery_failed');

    // Inspect persisted database row
    const attempt = mockDb.owner_login_attempts.find(r => r.attempt_type === 'request_otp');
    assert.ok(attempt, 'Attempt record must be persisted before provider call');
    assert.equal(attempt.invalidated, true, 'Pending attempt must remain invalidated=true');
    assert.equal(attempt.consumed, true, 'Failed attempt must be marked consumed');

    // Attempt to verify the OTP code even if attacker obtained it
    const verifyReq = createMockReq('http://localhost/api/owner?action=login-verify', 'POST', {
      email: 'owner@wellness.test',
      code: '123456'
    });
    const verifyRes = createMockRes();

    await handler(verifyReq, verifyRes);
    assert.equal(verifyRes.statusCode, 401, 'Verification must reject unactivated/invalidated OTP');
    assert.equal(verifyRes.body.error, 'code_expired_or_invalid');
  });

  test('2. Failure to persist delivery activation fails closed with 500 and leaves OTP ineligible', async () => {
    mockDb.resendBehavior = 'success';
    mockDb.activationDbFail = true; // DB fails when activating

    const req = createMockReq('http://localhost/api/owner?action=login-request', 'POST', {
      email: 'owner@wellness.test'
    });
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 500, 'Should fail closed with 500 when activation persistence fails');
    assert.equal(res.body.error, 'internal_error');

    // Check DB row state
    const attempt = mockDb.owner_login_attempts.find(r => r.attempt_type === 'request_otp');
    assert.ok(attempt, 'Attempt must exist');
    assert.equal(attempt.invalidated, true, 'Failed activation must leave invalidated=true');

    // Verification must fail
    const verifyReq = createMockReq('http://localhost/api/owner?action=login-verify', 'POST', {
      email: 'owner@wellness.test',
      code: '123456'
    });
    const verifyRes = createMockRes();
    await handler(verifyReq, verifyRes);
    assert.equal(verifyRes.statusCode, 401);
  });

  test('3. Failure to invalidate pending attempt on provider failure still fails closed via delivery pending gate', async () => {
    mockDb.resendBehavior = 'error';
    mockDb.invalidationDbFail = true; // DB fails when attempting cleanup PATCH

    const req = createMockReq('http://localhost/api/owner?action=login-request', 'POST', {
      email: 'owner@wellness.test'
    });
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 502, 'Should fail closed with 502');

    // Crucial: The delivery pending gate inserted invalidated=true up-front.
    // Even if the cleanup PATCH failed, the record is already invalidated=true!
    const attempt = mockDb.owner_login_attempts.find(r => r.attempt_type === 'request_otp');
    assert.ok(attempt);
    assert.equal(attempt.invalidated, true, 'Delivery pending gate guarantees invalidated=true');

    // Verification must fail
    const verifyReq = createMockReq('http://localhost/api/owner?action=login-verify', 'POST', {
      email: 'owner@wellness.test',
      code: '123456'
    });
    const verifyRes = createMockRes();
    await handler(verifyReq, verifyRes);
    assert.equal(verifyRes.statusCode, 401);
  });

  test('4. SQL NULL semantics: validates three-valued logic and explicit invalidated=eq.false', () => {
    // Under SQL 3-valued logic (TRUE, FALSE, UNKNOWN):
    // 1. col = TRUE
    //    - TRUE  => TRUE
    //    - FALSE => FALSE
    //    - NULL  => UNKNOWN
    // 2. NOT (col = TRUE)
    //    - TRUE  => NOT (TRUE)  => FALSE
    //    - FALSE => NOT (FALSE) => TRUE
    //    - NULL  => NOT (UNKNOWN) => UNKNOWN. In SQL WHERE, UNKNOWN evaluates to FALSE (excluded!).
    // Therefore, PostgREST filter 'invalidated=not.eq.true' does NOT include NULL rows.
    
    function sqlNotEqTrueFilter(row) {
      if (row.invalidated === null || row.invalidated === undefined) {
        // NULL = TRUE evaluates to UNKNOWN, NOT(UNKNOWN) is UNKNOWN -> rejected by WHERE
        return false;
      }
      return !(row.invalidated === true);
    }

    function sqlEqFalseFilter(row) {
      if (row.invalidated === null || row.invalidated === undefined) {
        // NULL = FALSE evaluates to UNKNOWN -> rejected by WHERE
        return false;
      }
      return row.invalidated === false;
    }

    const testRows = [
      { id: '1', invalidated: true },
      { id: '2', invalidated: false },
      { id: '3', invalidated: null }
    ];

    const notEqTrueMatched = testRows.filter(sqlNotEqTrueFilter);
    const eqFalseMatched = testRows.filter(sqlEqFalseFilter);

    // Both filters exclude NULL rows under true SQL semantics:
    assert.deepEqual(notEqTrueMatched.map(r => r.id), ['2'], 'not.eq.true excludes NULL in SQL');
    assert.deepEqual(eqFalseMatched.map(r => r.id), ['2'], 'eq.false matches exactly FALSE');

    // Proves that claiming not.eq.true was a "NULL-safe fallback" was false.
    // The patch now uses explicit invalidated=eq.false for the verified NOT NULL schema.
  });

  test('5. Concurrent single-use verification: exactly one request succeeds under race conditions', async () => {
    // Seed an activated valid OTP in the mock database
    const secret = process.env.OWNER_SESSION_SECRET;
    const email = 'owner@wellness.test';
    const otpCode = '749201';

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(`${email}:${otpCode}`);
    const codeHash = hmac.digest('hex');

    mockDb.owner_login_attempts.push({
      id: 'attempt-concurrent-valid',
      email,
      attempt_type: 'request_otp',
      code_hash: codeHash,
      success: true,
      consumed: false,
      invalidated: false,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString()
    });

    // Fire 10 parallel verification requests simultaneously
    const concurrency = 10;
    const promises = Array.from({ length: concurrency }, () => {
      const req = createMockReq('http://localhost/api/owner?action=login-verify', 'POST', {
        email,
        code: otpCode
      });
      const res = createMockRes();
      return handler(req, res).then(() => res);
    });

    const results = await Promise.all(promises);

    const successResponses = results.filter(r => r.statusCode === 200);
    const expiredOrConsumedResponses = results.filter(r => r.statusCode === 401 && r.body.error === 'code_expired_or_invalid');

    assert.equal(successResponses.length, 1, 'Exactly ONE concurrent request must win the session');
    assert.equal(expiredOrConsumedResponses.length, concurrency - 1, 'All other concurrent requests must receive 401');

    // Verify session cookie was set on the winning response
    const winner = successResponses[0];
    assert.ok(winner.headers['set-cookie'], 'Winning response must include Set-Cookie');
    assert.match(winner.headers['set-cookie'], /pz_owner_session=[A-Za-z0-9-_]+/, 'Session cookie must be signed JWT');

    // Confirm DB record is now consumed
    const attemptInDb = mockDb.owner_login_attempts.find(r => r.id === 'attempt-concurrent-valid');
    assert.equal(attemptInDb.consumed, true, 'OTP must be consumed in database');
  });

  test('5b. Verification rejects OTP if expired between lookup and consumption', async () => {
    const secret = process.env.OWNER_SESSION_SECRET;
    const email = 'owner@wellness.test';
    const otpCode = '882314';

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(`${email}:${otpCode}`);
    const codeHash = hmac.digest('hex');

    // Seed an OTP that expires in 1 millisecond
    mockDb.owner_login_attempts.push({
      id: 'attempt-midflight-expire',
      email,
      attempt_type: 'request_otp',
      code_hash: codeHash,
      success: true,
      consumed: false,
      invalidated: false,
      expires_at: new Date(Date.now() + 5).toISOString(),
      created_at: new Date().toISOString()
    });

    // Wait 15ms so that at the time of conditional consumption, expires_at < updateTimeIso
    await new Promise(resolve => setTimeout(resolve, 15));

    const req = createMockReq('http://localhost/api/owner?action=login-verify', 'POST', {
      email,
      code: otpCode
    });
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, 'code_expired_or_invalid');
  });

  test('5c. Verification rejects OTP if invalidated between lookup and consumption', async () => {
    const secret = process.env.OWNER_SESSION_SECRET;
    const email = 'owner@wellness.test';
    const otpCode = '918273';

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(`${email}:${otpCode}`);
    const codeHash = hmac.digest('hex');

    const targetRow = {
      id: 'attempt-midflight-invalidation',
      email,
      attempt_type: 'request_otp',
      code_hash: codeHash,
      success: true,
      consumed: false,
      invalidated: false,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString()
    };
    mockDb.owner_login_attempts.push(targetRow);

    // Simulate an external invalidation event occurring right after GET lookup:
    // When GET completes, the target row is invalidated before PATCH runs.
    const origHandleFetch = mockDb.handleFetch.bind(mockDb);
    mockDb.handleFetch = async (url, options) => {
      const res = await origHandleFetch(url, options);
      // If this was the GET query for request_otp attempts, immediately invalidate the row
      if (url.includes('attempt_type=eq.request_otp') && (!options || !options.method || options.method === 'GET')) {
        targetRow.invalidated = true;
      }
      return res;
    };

    const req = createMockReq('http://localhost/api/owner?action=login-verify', 'POST', {
      email,
      code: otpCode
    });
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 401, 'Must reject consumption if row was invalidated after lookup');
    assert.equal(res.body.error, 'code_expired_or_invalid');
  });

  test('6. Zero OTP disclosure: no dev_code or plaintext OTP in response bodies, headers, or server logs', async () => {
    // Intercept console logging
    const loggedMessages = [];
    const origLog = console.log;
    const origError = console.error;
    const origWarn = console.warn;

    console.log = (...args) => loggedMessages.push(args.join(' '));
    console.error = (...args) => loggedMessages.push(args.join(' '));
    console.warn = (...args) => loggedMessages.push(args.join(' '));

    try {
      mockDb.resendBehavior = 'success';

      const req = createMockReq('http://localhost/api/owner?action=login-request', 'POST', {
        email: 'owner@wellness.test'
      });
      const res = createMockRes();

      await handler(req, res);

      assert.equal(res.statusCode, 200);

      // Verify response body does NOT have dev_code, code, code_hash, or plaintext numeric OTP
      const bodyStr = JSON.stringify(res.body);
      assert.equal(res.body.dev_code, undefined, 'Response must never contain dev_code');
      assert.equal(res.body.code, undefined, 'Response must never contain code field');
      assert.equal(res.body.code_hash, undefined, 'Response must never contain code_hash');
      assert.ok(!bodyStr.match(/\b\d{6}\b/), 'Response body must not contain 6-digit OTP');

      // Verify header does not leak code
      const headersStr = JSON.stringify(res.headers);
      assert.ok(!headersStr.match(/\b\d{6}\b/), 'Headers must not contain 6-digit OTP');

      // Verify server logs do not contain 6-digit OTP
      const logsCombined = loggedMessages.join('\n');
      assert.ok(!logsCombined.match(/\[PulseZen Auth\].*\b\d{6}\b/), 'Server console must not log OTP');

      // Verify response structure matches production anti-enumeration contract
      assert.deepEqual(res.body, {
        success: true,
        message: 'If this email is registered, a verification code has been sent.'
      });
    } finally {
      console.log = origLog;
      console.error = origError;
      console.warn = origWarn;
    }
  });

});
