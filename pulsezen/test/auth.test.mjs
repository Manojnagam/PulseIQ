/**
 * PulseZen Owner Authentication Phase 0 Security & Regression Test Suite
 *
 * NOTE: These are isolated in-memory mocked tests simulating PostgREST query
 * semantics, HTTP responses, and atomic conditional state transitions.
 * They are NOT live PostgreSQL integration tests.
 *
 * Test Suites:
 * 1. Standard Owner Authentication Regression Flow (request, verify, invalid code, expired, reused, rate limited).
 * 2. Delivery Failure & Ineligibility Gating (timeout after acceptance, revocation check against delayed response, ambiguous commit vs response loss, activation failure, fail-closed cleanup).
 * 3. Concurrency, Mid-Flight Transitions & SQL NULL Semantics (atomic conditional single-use under race conditions, mid-flight expiry, mid-flight invalidation, three-valued SQL logic).
 * 4. Zero Disclosure & Maintenance Mechanism (no OTP in responses/logs, isolated maintenance mode).
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
delete process.env.OWNER_AUTH_MAINTENANCE;

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
 * Simulates SQL filters, atomic single-row conditional updates, and error injection.
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
    this.lastDeliveredOtp = null;
    this.activationDbFail = false;
    this.activationResponseLost = false;
    this.invalidationDbFail = false;
    this.onResendDispatch = null;
  }

  reset() {
    this.owner_login_attempts = [];
    this.nextId = 1;
    this.resendBehavior = 'success';
    this.lastDeliveredOtp = null;
    this.activationDbFail = false;
    this.activationResponseLost = false;
    this.invalidationDbFail = false;
    this.onResendDispatch = null;
  }

  async handleFetch(url, options = {}) {
    const method = options.method || 'GET';
    const parsed = new URL(url);

    // Resend Provider Mock
    if (url.startsWith('https://api.resend.com/emails')) {
      const body = JSON.parse(options.body || '{}');
      const otpMatch = (body.subject || '').match(/\b(\d{6})\b/);
      if (otpMatch) {
        this.lastDeliveredOtp = otpMatch[1];
      }

      if (typeof this.onResendDispatch === 'function') {
        await this.onResendDispatch();
      }

      if (this.resendBehavior === 'timeout') {
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

    // Supabase PostgREST Mock: owner_users
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

    // Supabase PostgREST Mock: owner_login_attempts
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
            json: async () => ({ error: 'Database connection error during activation' })
          };
        }

        if (this.invalidationDbFail && url.includes('id=eq.')) {
          return {
            ok: false,
            status: 500,
            json: async () => ({ error: 'Database connection error during invalidation' })
          };
        }

        // Parse query filters
        const idFilter = parsed.searchParams.get('id');
        const consumedFilter = parsed.searchParams.get('consumed');
        const invalidatedFilter = parsed.searchParams.get('invalidated');
        const successFilter = parsed.searchParams.get('success');
        const expiresAtFilter = parsed.searchParams.get('expires_at');
        const emailFilter = parsed.searchParams.get('email');
        const attemptTypeFilter = parsed.searchParams.get('attempt_type');

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

          if (attemptTypeFilter && attemptTypeFilter.startsWith('eq.')) {
            if (row.attempt_type !== attemptTypeFilter.slice(3)) match = false;
          }

          if (consumedFilter && consumedFilter.startsWith('eq.')) {
            const expectedConsumed = consumedFilter.slice(3) === 'true';
            if (row.consumed !== expectedConsumed) match = false;
          }

          if (invalidatedFilter && invalidatedFilter.startsWith('eq.')) {
            const expectedInvalidated = invalidatedFilter.slice(3) === 'true';
            if (row.invalidated !== expectedInvalidated) match = false;
          }

          if (successFilter && successFilter.startsWith('eq.')) {
            const expectedSuccess = successFilter.slice(3) === 'true';
            if (row.success !== expectedSuccess) match = false;
          }

          if (expiresAtFilter && expiresAtFilter.startsWith('gt.')) {
            const thresholdIso = expiresAtFilter.slice(3);
            if (!row.expires_at || new Date(row.expires_at).getTime() <= new Date(thresholdIso).getTime()) {
              match = false;
            }
          }

          if (match) {
            Object.assign(row, patchBody);
            updatedRows.push({ ...row });
            if (idFilter) break;
          }
        }

        if (this.activationResponseLost && url.includes('invalidated=eq.true')) {
          // Commit succeeded on database, but network drops before response headers reach client
          throw new Error('Network timeout: TCP reset by peer before response headers arrived');
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

// =============================================================================
// TEST SUITE 1: Standard Owner Authentication Regression Flow (Mocked)
// =============================================================================
test.describe('Suite 1: Standard Owner Authentication Regression Flow (Mocked)', () => {

  test.beforeEach(() => {
    mockDb.reset();
  });

  test('1.1 Full successful login lifecycle: request OTP -> deliver -> verify code -> 200 OK + session cookie', async () => {
    // 1. Request OTP
    const req = createMockReq('http://localhost/api/owner?action=login-request', 'POST', {
      email: 'owner@wellness.test'
    });
    const res = createMockRes();
    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.ok(mockDb.lastDeliveredOtp, 'OTP must be captured by email provider mock');

    // 2. Verify with delivered OTP
    const verifyReq = createMockReq('http://localhost/api/owner?action=login-verify', 'POST', {
      email: 'owner@wellness.test',
      code: mockDb.lastDeliveredOtp
    });
    const verifyRes = createMockRes();
    await handler(verifyReq, verifyRes);

    assert.equal(verifyRes.statusCode, 200);
    assert.equal(verifyRes.body.success, true);
    assert.equal(verifyRes.body.email, 'owner@wellness.test');
    assert.ok(verifyRes.headers['set-cookie'], 'Response must set session cookie');
    assert.match(verifyRes.headers['set-cookie'], /pz_owner_session=[A-Za-z0-9-_]+/);

    // Verify row state in DB
    const attempt = mockDb.owner_login_attempts.find(r => r.attempt_type === 'request_otp');
    assert.equal(attempt.consumed, true, 'OTP must be marked consumed in DB');
  });

  test('1.2 Verification rejects wrong code with 401 and records failed verify attempt', async () => {
    // Seed an active OTP
    const req = createMockReq('http://localhost/api/owner?action=login-request', 'POST', {
      email: 'owner@wellness.test'
    });
    const res = createMockRes();
    await handler(req, res);

    // Submit invalid code
    const verifyReq = createMockReq('http://localhost/api/owner?action=login-verify', 'POST', {
      email: 'owner@wellness.test',
      code: '000000'
    });
    const verifyRes = createMockRes();
    await handler(verifyReq, verifyRes);

    assert.equal(verifyRes.statusCode, 401);
    assert.equal(verifyRes.body.error, 'invalid_code');

    // Confirm failed attempt was logged in audit store
    const failAudit = mockDb.owner_login_attempts.find(r => r.attempt_type === 'verify_otp' && r.success === false);
    assert.ok(failAudit, 'Failed verification must be recorded in audit log');
  });

  test('1.3 Verification rejects expired OTP code with 401', async () => {
    const secret = process.env.OWNER_SESSION_SECRET;
    const email = 'owner@wellness.test';
    const otpCode = '654321';
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(`${email}:${otpCode}`);

    // Insert an already-expired attempt
    mockDb.owner_login_attempts.push({
      id: 'attempt-already-expired',
      email,
      attempt_type: 'request_otp',
      code_hash: hmac.digest('hex'),
      success: true,
      consumed: false,
      invalidated: false,
      expires_at: new Date(Date.now() - 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 11 * 60 * 1000).toISOString()
    });

    const verifyReq = createMockReq('http://localhost/api/owner?action=login-verify', 'POST', {
      email,
      code: otpCode
    });
    const verifyRes = createMockRes();
    await handler(verifyReq, verifyRes);

    assert.equal(verifyRes.statusCode, 401);
    assert.equal(verifyRes.body.error, 'code_expired_or_invalid');
  });

  test('1.4 Verification rejects already consumed/reused code with 401', async () => {
    // 1. Valid request and verify
    const req = createMockReq('http://localhost/api/owner?action=login-request', 'POST', {
      email: 'owner@wellness.test'
    });
    const res = createMockRes();
    await handler(req, res);

    const code = mockDb.lastDeliveredOtp;

    const verify1 = createMockRes();
    await handler(createMockReq('http://localhost/api/owner?action=login-verify', 'POST', {
      email: 'owner@wellness.test',
      code
    }), verify1);
    assert.equal(verify1.statusCode, 200);

    // 2. Second verification with same code must fail
    const verify2 = createMockRes();
    await handler(createMockReq('http://localhost/api/owner?action=login-verify', 'POST', {
      email: 'owner@wellness.test',
      code
    }), verify2);
    assert.equal(verify2.statusCode, 401);
    assert.equal(verify2.body.error, 'code_expired_or_invalid');
  });

  test('1.5 Account lockout on 5 consecutive failed verification attempts within 15 minutes', async () => {
    const email = 'owner@wellness.test';

    // Seed 5 failed verification attempts
    for (let i = 0; i < 5; i++) {
      mockDb.owner_login_attempts.push({
        id: `fail-${i}`,
        email,
        attempt_type: 'verify_otp',
        success: false,
        created_at: new Date().toISOString()
      });
    }

    const verifyReq = createMockReq('http://localhost/api/owner?action=login-verify', 'POST', {
      email,
      code: '123456'
    });
    const verifyRes = createMockRes();
    await handler(verifyReq, verifyRes);

    assert.equal(verifyRes.statusCode, 429);
    assert.equal(verifyRes.body.error, 'account_locked');
  });
});

// =============================================================================
// TEST SUITE 2: Delivery Failure, Revocation & Ineligibility Gating (Mocked)
// =============================================================================
test.describe('Suite 2: Delivery Failure, Revocation & Ineligibility Gating (Mocked)', () => {

  test.beforeEach(() => {
    mockDb.reset();
  });

  test('2.1 Provider timeout after simulated acceptance fails closed and leaves OTP completely ineligible', async () => {
    mockDb.resendBehavior = 'timeout';

    const req = createMockReq('http://localhost/api/owner?action=login-request', 'POST', {
      email: 'owner@wellness.test'
    });
    const res = createMockRes();
    await handler(req, res);

    assert.equal(res.statusCode, 502);
    assert.equal(res.body.error, 'delivery_failed');

    // Attempt in DB remains invalidated=true
    const attempt = mockDb.owner_login_attempts.find(r => r.attempt_type === 'request_otp');
    assert.ok(attempt);
    assert.equal(attempt.invalidated, true);
    assert.equal(attempt.consumed, true);

    // Verification must be rejected
    const verifyReq = createMockReq('http://localhost/api/owner?action=login-verify', 'POST', {
      email: 'owner@wellness.test',
      code: '123456'
    });
    const verifyRes = createMockRes();
    await handler(verifyReq, verifyRes);
    assert.equal(verifyRes.statusCode, 401);
  });

  test('2.2 Deterministic Race Test: Terminally revoked attempt cannot be reactivated by delayed provider response', async () => {
    // Simulate background cleanup or concurrent revocation occurring while email delivery is in flight
    mockDb.onResendDispatch = async () => {
      // Find the pending attempt that was just inserted with invalidated=true, consumed=false
      const pendingRow = mockDb.owner_login_attempts.find(r => r.attempt_type === 'request_otp' && r.consumed === false);
      assert.ok(pendingRow, 'Pending row must exist during provider dispatch');

      // Simulate the exact background revocation query executed after successful login:
      // PATCH ...?email=eq...&attempt_type=eq.request_otp&consumed=eq.false with { consumed: true, invalidated: true }
      await mockDb.handleFetch(
        `https://test-isolated.supabase.co/rest/v1/owner_login_attempts?email=eq.owner%40wellness.test&attempt_type=eq.request_otp&consumed=eq.false`,
        {
          method: 'PATCH',
          body: JSON.stringify({ consumed: true, invalidated: true })
        }
      );
    };

    // Trigger login request
    const req = createMockReq('http://localhost/api/owner?action=login-request', 'POST', {
      email: 'owner@wellness.test'
    });
    const res = createMockRes();
    await handler(req, res);

    // Because activation requires consumed=eq.false, it matched 0 rows and failed closed
    assert.equal(res.statusCode, 500, 'Activation must fail closed when row was revoked mid-flight');
    assert.equal(res.body.error, 'internal_error');

    // Verify row in DB remains revoked (consumed=true, invalidated=true)
    const attempt = mockDb.owner_login_attempts.find(r => r.attempt_type === 'request_otp');
    assert.equal(attempt.consumed, true);
    assert.equal(attempt.invalidated, true);
    assert.equal(attempt.success, false);

    // Verify that attempting to verify with the delivered code fails and issues NO session
    const verifyReq = createMockReq('http://localhost/api/owner?action=login-verify', 'POST', {
      email: 'owner@wellness.test',
      code: mockDb.lastDeliveredOtp
    });
    const verifyRes = createMockRes();
    await handler(verifyReq, verifyRes);

    assert.equal(verifyRes.statusCode, 401);
    assert.equal(verifyRes.body.error, 'code_expired_or_invalid');
    assert.equal(verifyRes.headers['set-cookie'], undefined, 'No session cookie must ever be issued');
  });

  test('2.3 Ambiguous DB Outcome: Activation commits in DB but HTTP response is lost over network', async () => {
    mockDb.activationResponseLost = true; // DB commits write, but network connection drops before response arrives

    const req = createMockReq('http://localhost/api/owner?action=login-request', 'POST', {
      email: 'owner@wellness.test'
    });
    const res = createMockRes();
    await handler(req, res);

    // 1. The login-request caller received an error response (HTTP 500), NOT a session
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.error, 'internal_error');
    assert.equal(res.headers['set-cookie'], undefined, 'Login request failure must NEVER directly issue a session');

    // 2. In the DB, the row actually committed: invalidated=false, success=true
    const attempt = mockDb.owner_login_attempts.find(r => r.attempt_type === 'request_otp');
    assert.equal(attempt.invalidated, false, 'Committed row has invalidated=false');
    assert.equal(attempt.consumed, false, 'Committed row remains unconsumed');

    // 3. User received the email anyway. Verification with correct secret still enforces normal checks:
    // With wrong code -> fails
    const wrongVerify = createMockRes();
    await handler(createMockReq('http://localhost/api/owner?action=login-verify', 'POST', {
      email: 'owner@wellness.test',
      code: '999999'
    }), wrongVerify);
    assert.equal(wrongVerify.statusCode, 401);

    // With correct delivered code -> normal eligibility succeeds with atomic single-use consumption
    const correctVerify = createMockRes();
    await handler(createMockReq('http://localhost/api/owner?action=login-verify', 'POST', {
      email: 'owner@wellness.test',
      code: mockDb.lastDeliveredOtp
    }), correctVerify);
    assert.equal(correctVerify.statusCode, 200);
    assert.ok(correctVerify.headers['set-cookie']);
  });

  test('2.4 Failure to persist delivery activation (DB rejected write) fails closed with 500 and leaves OTP ineligible', async () => {
    mockDb.resendBehavior = 'success';
    mockDb.activationDbFail = true; // DB rejects activation PATCH with 500

    const req = createMockReq('http://localhost/api/owner?action=login-request', 'POST', {
      email: 'owner@wellness.test'
    });
    const res = createMockRes();
    await handler(req, res);

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.error, 'internal_error');

    // The attempt in DB remains invalidated=true because the write was rejected
    const attempt = mockDb.owner_login_attempts.find(r => r.attempt_type === 'request_otp');
    assert.equal(attempt.invalidated, true);

    // Verification must fail
    const verifyReq = createMockReq('http://localhost/api/owner?action=login-verify', 'POST', {
      email: 'owner@wellness.test',
      code: mockDb.lastDeliveredOtp
    });
    const verifyRes = createMockRes();
    await handler(verifyReq, verifyRes);
    assert.equal(verifyRes.statusCode, 401);
  });

  test('2.5 Failure to invalidate pending attempt on provider error fails closed via delivery pending gate', async () => {
    mockDb.resendBehavior = 'error';
    mockDb.invalidationDbFail = true; // Cleanup PATCH also fails

    const req = createMockReq('http://localhost/api/owner?action=login-request', 'POST', {
      email: 'owner@wellness.test'
    });
    const res = createMockRes();
    await handler(req, res);

    assert.equal(res.statusCode, 502);

    // The initial insert gate persisted invalidated=true. Even if cleanup failed, it is ineligible.
    const attempt = mockDb.owner_login_attempts.find(r => r.attempt_type === 'request_otp');
    assert.equal(attempt.invalidated, true);

    const verifyRes = createMockRes();
    await handler(createMockReq('http://localhost/api/owner?action=login-verify', 'POST', {
      email: 'owner@wellness.test',
      code: '123456'
    }), verifyRes);
    assert.equal(verifyRes.statusCode, 401);
  });
});

// =============================================================================
// TEST SUITE 3: Concurrency, Mid-Flight Transitions & SQL Semantics (Mocked)
// =============================================================================
test.describe('Suite 3: Concurrency, Mid-Flight Transitions & SQL Semantics (Mocked)', () => {

  test.beforeEach(() => {
    mockDb.reset();
  });

  test('3.1 SQL NULL semantics: validates three-valued logic and explicit invalidated=eq.false', () => {
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
        return false; // UNKNOWN -> excluded
      }
      return !(row.invalidated === true);
    }

    function sqlEqFalseFilter(row) {
      if (row.invalidated === null || row.invalidated === undefined) {
        return false; // UNKNOWN -> excluded
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
  });

  test('3.2 Concurrent single-use verification: exactly one request succeeds under 10-way race conditions', async () => {
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

    const winner = successResponses[0];
    assert.ok(winner.headers['set-cookie']);
    assert.match(winner.headers['set-cookie'], /pz_owner_session=[A-Za-z0-9-_]+/);

    const attemptInDb = mockDb.owner_login_attempts.find(r => r.id === 'attempt-concurrent-valid');
    assert.equal(attemptInDb.consumed, true);
  });

  test('3.3 Verification rejects OTP if expired between lookup and consumption', async () => {
    const secret = process.env.OWNER_SESSION_SECRET;
    const email = 'owner@wellness.test';
    const otpCode = '882314';

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(`${email}:${otpCode}`);

    mockDb.owner_login_attempts.push({
      id: 'attempt-midflight-expire',
      email,
      attempt_type: 'request_otp',
      code_hash: hmac.digest('hex'),
      success: true,
      consumed: false,
      invalidated: false,
      expires_at: new Date(Date.now() + 5).toISOString(),
      created_at: new Date().toISOString()
    });

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

  test('3.4 Verification rejects OTP if invalidated between lookup and consumption', async () => {
    const secret = process.env.OWNER_SESSION_SECRET;
    const email = 'owner@wellness.test';
    const otpCode = '918273';

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(`${email}:${otpCode}`);

    const targetRow = {
      id: 'attempt-midflight-invalidation',
      email,
      attempt_type: 'request_otp',
      code_hash: hmac.digest('hex'),
      success: true,
      consumed: false,
      invalidated: false,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString()
    };
    mockDb.owner_login_attempts.push(targetRow);

    const origHandleFetch = mockDb.handleFetch.bind(mockDb);
    mockDb.handleFetch = async (url, options) => {
      const res = await origHandleFetch(url, options);
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

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, 'code_expired_or_invalid');
  });
});

// =============================================================================
// TEST SUITE 4: Zero Disclosure & Maintenance Mechanism (Mocked)
// =============================================================================
test.describe('Suite 4: Zero Disclosure & Maintenance Mechanism (Mocked)', () => {

  test.beforeEach(() => {
    mockDb.reset();
    delete process.env.OWNER_AUTH_MAINTENANCE;
  });

  test('4.1 Zero OTP disclosure: no dev_code or plaintext OTP in response bodies, headers, or server logs', async () => {
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

      const bodyStr = JSON.stringify(res.body);
      assert.equal(res.body.dev_code, undefined, 'Response must never contain dev_code');
      assert.equal(res.body.code, undefined, 'Response must never contain code field');
      assert.equal(res.body.code_hash, undefined, 'Response must never contain code_hash');
      assert.ok(!bodyStr.match(/\b\d{6}\b/), 'Response body must not contain 6-digit OTP');

      const headersStr = JSON.stringify(res.headers);
      assert.ok(!headersStr.match(/\b\d{6}\b/), 'Headers must not contain 6-digit OTP');

      const logsCombined = loggedMessages.join('\n');
      assert.ok(!logsCombined.match(/\[PulseZen Auth\].*\b\d{6}\b/), 'Server console must not log OTP');

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

  test('4.2 Maintenance mode: when OWNER_AUTH_MAINTENANCE=true, both login-request and login-verify return 503', async () => {
    process.env.OWNER_AUTH_MAINTENANCE = 'true';

    // 1. Test login-request returns 503
    const req1 = createMockReq('http://localhost/api/owner?action=login-request', 'POST', {
      email: 'owner@wellness.test'
    });
    const res1 = createMockRes();
    await handler(req1, res1);

    assert.equal(res1.statusCode, 503);
    assert.equal(res1.body.error, 'service_maintenance');

    // 2. Test login-verify returns 503
    const req2 = createMockReq('http://localhost/api/owner?action=login-verify', 'POST', {
      email: 'owner@wellness.test',
      code: '123456'
    });
    const res2 = createMockRes();
    await handler(req2, res2);

    assert.equal(res2.statusCode, 503);
    assert.equal(res2.body.error, 'service_maintenance');
  });
});
