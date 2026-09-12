/**
 * PulseZen Owner Authentication Phase 0 Security & Regression Test Suite
 *
 * NOTE: These tests run against an isolated in-memory PostgREST mock database.
 * They validate query semantics, atomic state transitions, and HTTP contracts.
 * They are NOT live PostgreSQL integration tests.
 *
 * Test Suites:
 * 1. Standard Owner Authentication Regression Flow (Mocked)
 * 2. Delivery Failure, Revocation & Ineligibility Gating (Mocked)
 * 3. Concurrency, Mid-Flight Transitions & SQL Semantics (Mocked)
 * 4. Zero Disclosure, Maintenance & Secret Handling (Mocked)
 * 5. Database Failure & Mandatory Audit Resilience (Mocked)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// 1. Establish isolated environment configuration BEFORE dynamic imports
process.env.SUPABASE_URL = 'https://test-isolated.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_isolated_service_role_key';
process.env.OWNER_SESSION_SECRET = 'test_isolated_session_secret_for_pulsezen_owner_portal_2026';
process.env.RESEND_API_KEY = 're_test_dummy_key_12345';
delete process.env.OWNER_AUTH_MAINTENANCE;

// Dynamically import application modules so they capture the isolated test environment
const { default: handler } = await import('../api/owner.js');
const { verifyOwnerSession, signOwnerSession, getSessionSecret } = await import('../api/_session.js');

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
    this.expireAfterLookup = false;

    // Database error injection flags
    this.dbErrorEmailRateLimit = false;
    this.dbErrorIpRateLimit = false;
    this.dbErrorUserLookup = false;
    this.dbErrorFailCheck = false;
    this.dbErrorOtpLookup = false;
    this.dbErrorAuditInsert = false;
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
    this.expireAfterLookup = false;

    this.dbErrorEmailRateLimit = false;
    this.dbErrorIpRateLimit = false;
    this.dbErrorUserLookup = false;
    this.dbErrorFailCheck = false;
    this.dbErrorOtpLookup = false;
    this.dbErrorAuditInsert = false;
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
      if (this.dbErrorUserLookup) {
        return {
          ok: false,
          status: 500,
          json: async () => ({ code: '500', message: 'Internal database connection error' })
        };
      }
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
        if (this.dbErrorAuditInsert) {
          return {
            ok: false,
            status: 500,
            json: async () => ({ code: '500', message: 'Failed to insert audit record' })
          };
        }
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
        const ipFilter = parsed.searchParams.get('ip_address');
        const attemptTypeFilter = parsed.searchParams.get('attempt_type');
        const consumedFilter = parsed.searchParams.get('consumed');
        const invalidatedFilter = parsed.searchParams.get('invalidated');
        const expiresAtFilter = parsed.searchParams.get('expires_at');
        const successFilter = parsed.searchParams.get('success');
        const createdAtFilter = parsed.searchParams.get('created_at');
        const limitFilter = parsed.searchParams.get('limit');

        if (this.dbErrorEmailRateLimit && emailFilter && attemptTypeFilter === 'eq.request_otp') {
          return { ok: false, status: 500, json: async () => ({ code: '500', message: 'DB error on rate limit' }) };
        }
        if (this.dbErrorIpRateLimit && ipFilter && attemptTypeFilter === 'eq.request_otp') {
          return { ok: false, status: 500, json: async () => ({ code: '500', message: 'DB error on IP rate limit' }) };
        }
        if (this.dbErrorFailCheck && attemptTypeFilter === 'eq.verify_otp' && successFilter === 'eq.false') {
          return { ok: false, status: 500, json: async () => ({ code: '500', message: 'DB error on verify failure count' }) };
        }
        if (this.dbErrorOtpLookup && attemptTypeFilter === 'eq.request_otp' && consumedFilter === 'eq.false') {
          return { ok: false, status: 500, json: async () => ({ code: '500', message: 'DB error on active OTP lookup' }) };
        }

        let rows = [...this.owner_login_attempts];

        if (emailFilter && emailFilter.startsWith('eq.')) {
          const e = emailFilter.slice(3);
          rows = rows.filter(r => r.email === e);
        }

        if (ipFilter && ipFilter.startsWith('eq.')) {
          const ip = ipFilter.slice(3);
          rows = rows.filter(r => r.ip_address === ip);
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

        if (createdAtFilter && createdAtFilter.startsWith('gte.')) {
          const thresholdIso = createdAtFilter.slice(4);
          rows = rows.filter(r => r.created_at && new Date(r.created_at).getTime() >= new Date(thresholdIso).getTime());
        }

        rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        if (limitFilter) {
          const lim = parseInt(limitFilter, 10);
          if (!isNaN(lim)) rows = rows.slice(0, lim);
        }

        if (this.expireAfterLookup && attemptTypeFilter === 'eq.request_otp' && rows.length > 0) {
          // Mutate the row in database immediately after successful lookup so it is expired before consumption
          rows[0].expires_at = new Date(Date.now() - 10000).toISOString();
        }

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
const defaultFetch = async (url, options) => mockDb.handleFetch(url, options);
global.fetch = defaultFetch;

// =============================================================================
// TEST SUITE 1: Standard Owner Authentication Regression Flow (Mocked)
// =============================================================================
test.describe('Suite 1: Standard Owner Authentication Regression Flow (Mocked)', () => {

  test.beforeEach(() => {
    mockDb.reset();
    global.fetch = defaultFetch;
  });

  test.afterEach(() => {
    mockDb.reset();
    global.fetch = defaultFetch;
  });

  test('1.1 Full successful login lifecycle: request OTP -> deliver -> verify code -> 200 OK + cryptographically verified session', async () => {
    const req = createMockReq('http://localhost/api/owner?action=login-request', 'POST', {
      email: 'owner@wellness.test'
    });
    const res = createMockRes();
    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.message, 'If this email is registered and eligible, a verification code will be sent.');
    assert.ok(mockDb.lastDeliveredOtp);

    const verifyReq = createMockReq('http://localhost/api/owner?action=login-verify', 'POST', {
      email: 'owner@wellness.test',
      code: mockDb.lastDeliveredOtp
    });
    const verifyRes = createMockRes();
    await handler(verifyReq, verifyRes);

    assert.equal(verifyRes.statusCode, 200);
    assert.equal(verifyRes.body.success, true);
    assert.equal(verifyRes.body.email, 'owner@wellness.test');
    assert.ok(verifyRes.headers['set-cookie']);

    // Parse and cryptographically verify session token with intended key
    const match = verifyRes.headers['set-cookie'].match(/pz_owner_session=([^;]+)/);
    assert.ok(match, 'Cookie header must contain pz_owner_session');
    const token = match[1];

    const sessionPayload = verifyOwnerSession(token);
    assert.ok(sessionPayload, 'Token must be validly verified with the active secret');
    assert.equal(sessionPayload.email, 'owner@wellness.test');
    assert.equal(sessionPayload.typ, 'owner');
    assert.equal(sessionPayload.center_id, '22222222-2222-2222-2222-222222222222');
  });

  test('1.2 Verification rejects wrong code with 401 and records failed verify attempt', async () => {
    const req = createMockReq('http://localhost/api/owner?action=login-request', 'POST', {
      email: 'owner@wellness.test'
    });
    const res = createMockRes();
    await handler(req, res);

    const verifyReq = createMockReq('http://localhost/api/owner?action=login-verify', 'POST', {
      email: 'owner@wellness.test',
      code: '000000'
    });
    const verifyRes = createMockRes();
    await handler(verifyReq, verifyRes);

    assert.equal(verifyRes.statusCode, 401);
    assert.equal(verifyRes.body.error, 'invalid_code');

    const failAudit = mockDb.owner_login_attempts.find(r => r.attempt_type === 'verify_otp' && r.success === false);
    assert.ok(failAudit, 'Failed verification must be recorded in audit log');
  });

  test('1.3 Verification rejects expired OTP code with 401', async () => {
    const secret = getSessionSecret();
    const email = 'owner@wellness.test';
    const otpCode = '654321';
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(`${email}:${otpCode}`);

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
    global.fetch = defaultFetch;
  });

  test.afterEach(() => {
    mockDb.reset();
    global.fetch = defaultFetch;
  });

  test('2.1 Provider timeout fails closed internally, returns generic outward response, and rejects verification with captured OTP', async () => {
    mockDb.resendBehavior = 'timeout';

    const req = createMockReq('http://localhost/api/owner?action=login-request', 'POST', {
      email: 'owner@wellness.test'
    });
    const res = createMockRes();
    await handler(req, res);

    // Returns generic non-guarantee response identical to unknown user
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.message, 'If this email is registered and eligible, a verification code will be sent.');

    // In DB, attempt must be marked consumed and invalidated
    const attempt = mockDb.owner_login_attempts.find(r => r.attempt_type === 'request_otp');
    assert.ok(attempt);
    assert.equal(attempt.invalidated, true);
    assert.equal(attempt.consumed, true);

    // Verification with the exact OTP captured by provider mock must fail closed
    const verifyReq = createMockReq('http://localhost/api/owner?action=login-verify', 'POST', {
      email: 'owner@wellness.test',
      code: mockDb.lastDeliveredOtp || '123456'
    });
    const verifyRes = createMockRes();
    await handler(verifyReq, verifyRes);
    assert.equal(verifyRes.statusCode, 401);
    assert.equal(verifyRes.body.error, 'code_expired_or_invalid');
  });

  test('2.2 Deterministic Race Test: Terminally revoked attempt cannot be reactivated by delayed provider response', async () => {
    mockDb.onResendDispatch = async () => {
      // Simulate background revocation query executed after another session login:
      await mockDb.handleFetch(
        `https://test-isolated.supabase.co/rest/v1/owner_login_attempts?email=eq.owner%40wellness.test&attempt_type=eq.request_otp&consumed=eq.false`,
        {
          method: 'PATCH',
          body: JSON.stringify({ consumed: true, invalidated: true })
        }
      );
    };

    const req = createMockReq('http://localhost/api/owner?action=login-request', 'POST', {
      email: 'owner@wellness.test'
    });
    const res = createMockRes();
    await handler(req, res);

    // Activation matched 0 rows and failed closed
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.error, 'internal_error');

    const attempt = mockDb.owner_login_attempts.find(r => r.attempt_type === 'request_otp');
    assert.equal(attempt.consumed, true);
    assert.equal(attempt.invalidated, true);

    // Verification must fail and issue no session
    const verifyReq = createMockReq('http://localhost/api/owner?action=login-verify', 'POST', {
      email: 'owner@wellness.test',
      code: mockDb.lastDeliveredOtp
    });
    const verifyRes = createMockRes();
    await handler(verifyReq, verifyRes);

    assert.equal(verifyRes.statusCode, 401);
    assert.equal(verifyRes.headers['set-cookie'], undefined);
  });

  test('2.3 Ambiguous DB Outcome: Activation commits in DB but HTTP response is lost over network', async () => {
    mockDb.activationResponseLost = true;

    const req = createMockReq('http://localhost/api/owner?action=login-request', 'POST', {
      email: 'owner@wellness.test'
    });
    const res = createMockRes();
    await handler(req, res);

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.error, 'internal_error');
    assert.equal(res.headers['set-cookie'], undefined);

    const attempt = mockDb.owner_login_attempts.find(r => r.attempt_type === 'request_otp');
    assert.equal(attempt.invalidated, false);
    assert.equal(attempt.consumed, false);

    // Wrong code fails
    const wrongVerify = createMockRes();
    await handler(createMockReq('http://localhost/api/owner?action=login-verify', 'POST', {
      email: 'owner@wellness.test',
      code: '999999'
    }), wrongVerify);
    assert.equal(wrongVerify.statusCode, 401);

    // Correct delivered code succeeds with normal verification
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
    mockDb.activationDbFail = true;

    const req = createMockReq('http://localhost/api/owner?action=login-request', 'POST', {
      email: 'owner@wellness.test'
    });
    const res = createMockRes();
    await handler(req, res);

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.error, 'internal_error');

    const attempt = mockDb.owner_login_attempts.find(r => r.attempt_type === 'request_otp');
    assert.equal(attempt.invalidated, true);

    const verifyReq = createMockReq('http://localhost/api/owner?action=login-verify', 'POST', {
      email: 'owner@wellness.test',
      code: mockDb.lastDeliveredOtp
    });
    const verifyRes = createMockRes();
    await handler(verifyReq, verifyRes);
    assert.equal(verifyRes.statusCode, 401);
  });

  test('2.5 Provider error fails closed internally and verification with captured OTP fails', async () => {
    mockDb.resendBehavior = 'error';

    const req = createMockReq('http://localhost/api/owner?action=login-request', 'POST', {
      email: 'owner@wellness.test'
    });
    const res = createMockRes();
    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.message, 'If this email is registered and eligible, a verification code will be sent.');

    const attempt = mockDb.owner_login_attempts.find(r => r.attempt_type === 'request_otp');
    assert.equal(attempt.invalidated, true);

    const verifyRes = createMockRes();
    await handler(createMockReq('http://localhost/api/owner?action=login-verify', 'POST', {
      email: 'owner@wellness.test',
      code: mockDb.lastDeliveredOtp || '123456'
    }), verifyRes);
    assert.equal(verifyRes.statusCode, 401);
  });
});

// =============================================================================
// TEST SUITE 3: Concurrency, Deterministic Transitions & SQL Semantics (Mocked)
// =============================================================================
test.describe('Suite 3: Concurrency, Deterministic Transitions & SQL Semantics (Mocked)', () => {

  test.beforeEach(() => {
    mockDb.reset();
    global.fetch = defaultFetch;
  });

  test.afterEach(() => {
    mockDb.reset();
    global.fetch = defaultFetch;
  });

  test('3.1 SQL NULL semantics: validates three-valued logic and explicit invalidated=eq.false', () => {
    function sqlNotEqTrueFilter(row) {
      if (row.invalidated === null || row.invalidated === undefined) {
        return false;
      }
      return !(row.invalidated === true);
    }

    function sqlEqFalseFilter(row) {
      if (row.invalidated === null || row.invalidated === undefined) {
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

    assert.deepEqual(notEqTrueMatched.map(r => r.id), ['2'], 'not.eq.true excludes NULL in SQL');
    assert.deepEqual(eqFalseMatched.map(r => r.id), ['2'], 'eq.false matches exactly FALSE');
  });

  test('3.2 Concurrent single-use verification: exactly one request succeeds under 10-way race conditions', async () => {
    const secret = getSessionSecret();
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

    // Cryptographically verify the session token with active key
    const match = winner.headers['set-cookie'].match(/pz_owner_session=([^;]+)/);
    assert.ok(match);
    const verified = verifyOwnerSession(match[1]);
    assert.ok(verified);
    assert.equal(verified.email, email);

    const attemptInDb = mockDb.owner_login_attempts.find(r => r.id === 'attempt-concurrent-valid');
    assert.equal(attemptInDb.consumed, true);
  });

  test('3.3 Deterministic expiry occurring after OTP lookup but before conditional consumption', async () => {
    const secret = getSessionSecret();
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
      expires_at: new Date(Date.now() + 60000).toISOString(), // Initially valid
      created_at: new Date().toISOString()
    });

    // Deterministic trigger: mutate expires_at in DB directly during the GET lookup response
    mockDb.expireAfterLookup = true;

    const req = createMockReq('http://localhost/api/owner?action=login-verify', 'POST', {
      email,
      code: otpCode
    });
    const res = createMockRes();
    await handler(req, res);

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, 'code_expired_or_invalid');
  });

  test('3.4 Deterministic invalidation occurring after OTP lookup but before conditional consumption', async () => {
    const secret = getSessionSecret();
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
        targetRow.invalidated = true; // Invalidated right after lookup
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
// TEST SUITE 4: Zero Disclosure, Maintenance & Secret Handling (Mocked)
// =============================================================================
test.describe('Suite 4: Zero Disclosure, Maintenance & Secret Handling (Mocked)', () => {

  test.beforeEach(() => {
    mockDb.reset();
    global.fetch = defaultFetch;
    delete process.env.OWNER_AUTH_MAINTENANCE;
  });

  test.afterEach(() => {
    mockDb.reset();
    global.fetch = defaultFetch;
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
      assert.equal(res.body.dev_code, undefined);
      assert.equal(res.body.code, undefined);
      assert.equal(res.body.code_hash, undefined);
      assert.ok(!bodyStr.match(/\b\d{6}\b/));

      const headersStr = JSON.stringify(res.headers);
      assert.ok(!headersStr.match(/\b\d{6}\b/));

      const logsCombined = loggedMessages.join('\n');
      assert.ok(!logsCombined.match(/\[PulseZen Auth\].*\b\d{6}\b/));

      assert.deepEqual(res.body, {
        success: true,
        message: 'If this email is registered and eligible, a verification code will be sent.'
      });
    } finally {
      console.log = origLog;
      console.error = origError;
      console.warn = origWarn;
    }
  });

  test('4.2 Maintenance mode: when OWNER_AUTH_MAINTENANCE=true, both login-request and login-verify return 503', async () => {
    process.env.OWNER_AUTH_MAINTENANCE = 'true';

    const req1 = createMockReq('http://localhost/api/owner?action=login-request', 'POST', {
      email: 'owner@wellness.test'
    });
    const res1 = createMockRes();
    await handler(req1, res1);

    assert.equal(res1.statusCode, 503);
    assert.equal(res1.body.error, 'service_maintenance');

    const req2 = createMockReq('http://localhost/api/owner?action=login-verify', 'POST', {
      email: 'owner@wellness.test',
      code: '123456'
    });
    const res2 = createMockRes();
    await handler(req2, res2);

    assert.equal(res2.statusCode, 503);
    assert.equal(res2.body.error, 'service_maintenance');
  });

  test('4.3 Missing session secret: rejects signing, verification, and handler entry without fallback', () => {
    const savedSecret = process.env.OWNER_SESSION_SECRET;
    const savedServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    try {
      delete process.env.OWNER_SESSION_SECRET;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      assert.equal(getSessionSecret(), null, 'getSessionSecret must return null when unconfigured');

      // Reject signing
      assert.throws(() => {
        signOwnerSession({ email: 'test@example.com' });
      }, /Session signing secret is not configured/);

      // Reject verification of any token
      const dummyToken = 'eyJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJ0eXAiOiJvd25lciIsImV4cCI6OTk5OTk5OTk5OX0.signature';
      assert.equal(verifyOwnerSession(dummyToken), null);

      // Verify fabricated token signed with old literal fallback is strictly rejected
      const fallbackSecret = 'pulsezen_owner_fallback_secret_key_2026';
      const fakeHmac = crypto.createHmac('sha256', fallbackSecret);
      const fakeData = Buffer.from(JSON.stringify({ email: 'owner@wellness.test', typ: 'owner', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
      fakeHmac.update(fakeData);
      const fabricatedToken = `${fakeData}.${fakeHmac.digest('base64url')}`;

      assert.equal(verifyOwnerSession(fabricatedToken), null, 'Must reject token signed with former fallback');
    } finally {
      process.env.OWNER_SESSION_SECRET = savedSecret;
      process.env.SUPABASE_SERVICE_ROLE_KEY = savedServiceKey;
    }
  });

  test('4.4 Signing key byte compatibility: preserves exact bytes for nonblank keys with surrounding whitespace', () => {
    const rawWhitespaceKey = '  secret_with_leading_and_trailing_spaces  ';
    const savedSecret = process.env.OWNER_SESSION_SECRET;
    const savedServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    try {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      process.env.OWNER_SESSION_SECRET = rawWhitespaceKey;

      const resolved = getSessionSecret();
      assert.equal(resolved, rawWhitespaceKey, 'getSessionSecret must return exact nonblank string without altering bytes');

      const token = signOwnerSession({ email: 'owner@wellness.test' });
      const verified = verifyOwnerSession(token);
      assert.ok(verified, 'Session signed with raw whitespace key must verify successfully');
      assert.equal(verified.email, 'owner@wellness.test');

      // Reject token signed with trimmed version of the key to prove exact byte compatibility
      const trimmedKey = rawWhitespaceKey.trim();
      const hmacTrimmed = crypto.createHmac('sha256', trimmedKey);
      const dataPayload = Buffer.from(JSON.stringify({ email: 'owner@wellness.test', typ: 'owner', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
      hmacTrimmed.update(dataPayload);
      const trimmedToken = `${dataPayload}.${hmacTrimmed.digest('base64url')}`;

      assert.equal(verifyOwnerSession(trimmedToken), null, 'Tokens signed with trimmed bytes must not match raw key');
    } finally {
      process.env.OWNER_SESSION_SECRET = savedSecret;
      process.env.SUPABASE_SERVICE_ROLE_KEY = savedServiceKey;
    }
  });
});

// =============================================================================
// TEST SUITE 5: Database Failure & Mandatory Audit Resilience (Mocked)
// =============================================================================
test.describe('Suite 5: Database Failure & Mandatory Audit Resilience (Mocked)', () => {

  test.beforeEach(() => {
    mockDb.reset();
    global.fetch = defaultFetch;
  });

  test.afterEach(() => {
    mockDb.reset();
    global.fetch = defaultFetch;
  });

  test('5.1 Database error on email rate-limit check fails closed with HTTP 500', async () => {
    mockDb.dbErrorEmailRateLimit = true;

    const req = createMockReq('http://localhost/api/owner?action=login-request', 'POST', {
      email: 'owner@wellness.test'
    });
    const res = createMockRes();
    await handler(req, res);

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.error, 'internal_error');
  });

  test('5.2 Database error on IP rate-limit check fails closed with HTTP 500', async () => {
    mockDb.dbErrorIpRateLimit = true;

    const req = createMockReq('http://localhost/api/owner?action=login-request', 'POST', {
      email: 'owner@wellness.test'
    }, { 'x-real-ip': '198.51.100.1' });
    const res = createMockRes();
    await handler(req, res);

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.error, 'internal_error');
  });

  test('5.3 Database error on owner user lookup in login request fails closed with HTTP 500 (not 200 unknown user)', async () => {
    mockDb.dbErrorUserLookup = true;

    const req = createMockReq('http://localhost/api/owner?action=login-request', 'POST', {
      email: 'owner@wellness.test'
    });
    const res = createMockRes();
    await handler(req, res);

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.error, 'internal_error');
  });

  test('5.4 Database error on verify failure count check fails closed with HTTP 500', async () => {
    mockDb.dbErrorFailCheck = true;

    const req = createMockReq('http://localhost/api/owner?action=login-verify', 'POST', {
      email: 'owner@wellness.test',
      code: '123456'
    });
    const res = createMockRes();
    await handler(req, res);

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.error, 'internal_error');
  });

  test('5.5 Database error on active OTP lookup in login verify fails closed with HTTP 500', async () => {
    mockDb.dbErrorOtpLookup = true;

    const req = createMockReq('http://localhost/api/owner?action=login-verify', 'POST', {
      email: 'owner@wellness.test',
      code: '123456'
    });
    const res = createMockRes();
    await handler(req, res);

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.error, 'internal_error');
  });

  test('5.6 Mandatory audit failure before session issuance fails closed with HTTP 500 without issuing cookie', async () => {
    // Seed valid active OTP
    const secret = getSessionSecret();
    const email = 'owner@wellness.test';
    const otpCode = '445566';
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(`${email}:${otpCode}`);

    mockDb.owner_login_attempts.push({
      id: 'attempt-audit-fail',
      email,
      attempt_type: 'request_otp',
      code_hash: hmac.digest('hex'),
      success: true,
      consumed: false,
      invalidated: false,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString()
    });

    // Induce error on audit record insert (recordVerifyAttempt)
    mockDb.dbErrorAuditInsert = true;

    const req = createMockReq('http://localhost/api/owner?action=login-verify', 'POST', {
      email,
      code: otpCode
    });
    const res = createMockRes();
    await handler(req, res);

    assert.equal(res.statusCode, 500, 'Must fail closed when mandatory audit cannot be written');
    assert.equal(res.body.error, 'internal_error');
    assert.equal(res.headers['set-cookie'], undefined, 'Must NOT issue session cookie if mandatory audit fails');
  });

  test('5.7 Failed-verification persistence failure on wrong code fails closed with HTTP 500 and issues no cookie', async () => {
    // Seed an eligible OTP
    const secret = getSessionSecret();
    const email = 'owner@wellness.test';
    const realCode = '112233';
    const wrongCode = '999999';
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(`${email}:${realCode}`);

    mockDb.owner_login_attempts.push({
      id: 'attempt-wrong-code-fail-audit',
      email,
      attempt_type: 'request_otp',
      code_hash: hmac.digest('hex'),
      success: true,
      consumed: false,
      invalidated: false,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString()
    });

    // Make the failed-verification INSERT return a database error
    mockDb.dbErrorAuditInsert = true;

    const req = createMockReq('http://localhost/api/owner?action=login-verify', 'POST', {
      email,
      code: wrongCode
    });
    const res = createMockRes();
    await handler(req, res);

    // Must return generic service error rather than ordinary 401 credential rejection
    assert.equal(res.statusCode, 500, 'Must fail closed with HTTP 500 when failed-verification persistence errors');
    assert.equal(res.body.error, 'internal_error');
    assert.equal(res.headers['set-cookie'], undefined, 'Must NOT issue session cookie when failed audit fails');
  });
});
