import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import ownerHandler from './pulsezen_candidate_v2/api/owner.js';
import { signOwnerSession } from './pulsezen_candidate_v2/api/_session.js';

const PORT = 9983;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const centerId = '2c1c3a6e-35b4-4e30-bbae-a0cf02d8dd7a';
const secret = 'test-secret-must-be-32-chars-long-123456';

process.env.SUPABASE_URL = BASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = secret;
process.env.OWNER_SESSION_SECRET = secret;

const sessionCookie = `pz_owner_session=${signOwnerSession({
  userId: 'usr-1',
  center_id: centerId,
  email: 'owner@pulsezen.in',
  typ: 'owner'
})}`;

let capturedUpstreamRequest = null;
let mockStorageResponseGenerator = null;

// Mock Upstream Fastify Storage Server reproducing exact Supabase Storage behavior
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, BASE_URL);

  let bodyStr = '';
  req.on('data', chunk => bodyStr += chunk);
  req.on('end', () => {
    capturedUpstreamRequest = {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: bodyStr
    };

    if (url.pathname.startsWith('/storage/v1/object/upload/sign/transformations/')) {
      const contentType = req.headers['content-type'] || '';
      // Fastify standard behavior: if Content-Type is application/json but body is empty, return 400
      if (contentType.includes('application/json') && (!bodyStr || bodyStr.trim() === '')) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({
          statusCode: '400',
          error: 'FastifyError',
          message: "Body cannot be empty when content-type is set to 'application/json'",
          code: 'InvalidRequest'
        }));
      }

      if (mockStorageResponseGenerator) {
        return mockStorageResponseGenerator(req, res, url);
      }

      // Default valid non-empty JSON body - returns relative path
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({
        url: `/object/upload/sign/transformations/${url.pathname.split('/').slice(-2).join('/')}?token=mock_jwt_token`,
        token: 'mock_jwt_token'
      }));
    }

    res.writeHead(404);
    res.end();
  });
});

test('Upload URL Comprehensive Test Suite: Reproduction, Validation, Route Guarding & Normalization', async (t) => {
  await new Promise(resolve => server.listen(PORT, resolve));

  await t.test('1. Reproduction: Upstream Fastify returns 400 InvalidRequest when Content-Type: application/json is sent with empty body', async () => {
    capturedUpstreamRequest = null;
    const directRes = await fetch(`${BASE_URL}/storage/v1/object/upload/sign/transformations/${centerId}/test.jpg`, {
      method: 'POST',
      headers: {
        'apikey': secret,
        'Authorization': `Bearer ${secret}`,
        'Content-Type': 'application/json'
      }
      // body omitted -> empty body
    });

    assert.equal(directRes.status, 400, 'Upstream Fastify rejects empty body with 400');
    const errBody = await directRes.json();
    assert.equal(errBody.statusCode, '400');
    assert.equal(errBody.error, 'FastifyError');
    assert.equal(errBody.message, "Body cannot be empty when content-type is set to 'application/json'");
    assert.equal(errBody.code, 'InvalidRequest');
  });

  await t.test('2. Fix Verification: Fixed handler sends body: "{}" and returns HTTP 200 with signed upload URL', async () => {
    capturedUpstreamRequest = null;
    mockStorageResponseGenerator = null;
    const req = {
      method: 'POST',
      query: { action: 'upload-url' },
      headers: {
        'content-type': 'application/json',
        'cookie': sessionCookie
      },
      body: { kind: 'before', content_type: 'image/jpeg' }
    };

    let statusCode = 0;
    let resBody = null;
    const res = {
      status(c) { statusCode = c; return this; },
      json(d) { resBody = d; return this; }
    };

    await ownerHandler(req, res);

    assert.equal(statusCode, 200, 'Handler returns HTTP 200');
    assert.equal(capturedUpstreamRequest.body, '{}', 'Upstream received non-empty JSON body "{}"');
    assert.ok(resBody.upload_url, 'Response contains upload_url');
    assert.ok(resBody.upload_url.startsWith(`${BASE_URL}/storage/v1/object/upload/sign/transformations/`), 'URL includes /storage/v1 prefix');
    assert.ok(resBody.path.startsWith(`${centerId}/`), 'Path is isolated to owner centerId');
    assert.ok(resBody.path.endsWith('.jpg'), 'Correct extension applied');
    assert.equal(resBody.token, 'mock_jwt_token', 'Token passed through');
  });

  await t.test('3. URL Normalization: Documented relative format `/object/upload/sign/...` normalized without duplicating `/storage/v1`', async () => {
    mockStorageResponseGenerator = (req, res, url) => {
      const relPath = `/object/upload/sign/transformations/${url.pathname.split('/').slice(-2).join('/')}?token=rel_token_123`;
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ url: relPath, token: 'rel_token_123' }));
    };

    const req = {
      method: 'POST',
      query: { action: 'upload-url' },
      headers: {
        'content-type': 'application/json',
        'cookie': sessionCookie
      },
      body: { kind: 'after', content_type: 'image/png' }
    };

    let statusCode = 0;
    let resBody = null;
    const res = {
      status(c) { statusCode = c; return this; },
      json(d) { resBody = d; return this; }
    };

    await ownerHandler(req, res);
    assert.equal(statusCode, 200);
    assert.ok(!resBody.upload_url.includes('/storage/v1/storage/v1'), 'No duplicated /storage/v1');
    assert.ok(resBody.upload_url.startsWith(`${BASE_URL}/storage/v1/object/upload/sign/transformations/${centerId}/`));
    assert.ok(resBody.upload_url.endsWith('.png?token=rel_token_123'));
  });

  await t.test('4. URL Normalization: URL already starting with `/storage/v1/...` does not duplicate prefix', async () => {
    mockStorageResponseGenerator = (req, res, url) => {
      const fullPath = `/storage/v1/object/upload/sign/transformations/${url.pathname.split('/').slice(-2).join('/')}?token=v1_token_456`;
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ url: fullPath, token: 'v1_token_456' }));
    };

    const req = {
      method: 'POST',
      query: { action: 'upload-url' },
      headers: {
        'content-type': 'application/json',
        'cookie': sessionCookie
      },
      body: { kind: 'before', content_type: 'image/webp' }
    };

    let statusCode = 0;
    let resBody = null;
    const res = {
      status(c) { statusCode = c; return this; },
      json(d) { resBody = d; return this; }
    };

    await ownerHandler(req, res);
    assert.equal(statusCode, 200);
    assert.ok(!resBody.upload_url.includes('/storage/v1/storage/v1'), 'No duplicate /storage/v1');
    assert.ok(resBody.upload_url.startsWith(`${BASE_URL}/storage/v1/object/upload/sign/transformations/${centerId}/`));
    assert.ok(resBody.upload_url.endsWith('.webp?token=v1_token_456'));
  });

  await t.test('5. Validation: Missing URL in storage response fails with HTTP 502', async () => {
    // Test cases: undefined, null, empty string, whitespace string
    const missingCases = [
      {},
      { url: null },
      { url: '' },
      { url: '   ' }
    ];

    for (const testPayload of missingCases) {
      mockStorageResponseGenerator = (req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(testPayload));
      };

      const req = {
        method: 'POST',
        query: { action: 'upload-url' },
        headers: {
          'content-type': 'application/json',
          'cookie': sessionCookie
        },
        body: { kind: 'before', content_type: 'image/jpeg' }
      };

      let statusCode = 0;
      let resBody = null;
      const res = {
        status(c) { statusCode = c; return this; },
        json(d) { resBody = d; return this; }
      };

      await ownerHandler(req, res);
      assert.equal(statusCode, 502, `Missing URL case ${JSON.stringify(testPayload)} should return 502`);
      assert.equal(resBody.error, 'Failed to create signed upload URL');
      assert.match(resBody.details, /Missing signed upload URL/);
    }
  });

  await t.test('6. Validation: Malformed URL in storage response fails with HTTP 502', async () => {
    const malformedCases = [
      'http://[::1]:namedport/path',
      'https://',
      '://invalid-url',
      'http://'
    ];

    for (const badUrl of malformedCases) {
      mockStorageResponseGenerator = (req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ url: badUrl }));
      };

      const req = {
        method: 'POST',
        query: { action: 'upload-url' },
        headers: {
          'content-type': 'application/json',
          'cookie': sessionCookie
        },
        body: { kind: 'before', content_type: 'image/jpeg' }
      };

      let statusCode = 0;
      let resBody = null;
      const res = {
        status(c) { statusCode = c; return this; },
        json(d) { resBody = d; return this; }
      };

      await ownerHandler(req, res);
      assert.equal(statusCode, 502, `Malformed URL '${badUrl}' should return 502`);
      assert.equal(resBody.error, 'Failed to create signed upload URL');
    }
  });

  await t.test('7. Validation: Storage response URL outside expected route or origin fails with HTTP 502', async () => {
    const outOfRouteCases = [
      {
        desc: 'Untrusted external origin',
        url: 'https://attacker.com/object/upload/sign/transformations/some-file.jpg',
        expectedErrorPattern: /origin mismatch/
      },
      {
        desc: 'Wrong bucket',
        url: `/object/upload/sign/confidential_docs/${centerId}/file.jpg`,
        expectedErrorPattern: /outside expected upload-sign route/
      },
      {
        desc: 'Wrong action (read-sign instead of upload-sign)',
        url: `/object/sign/transformations/${centerId}/file.jpg`,
        expectedErrorPattern: /outside expected upload-sign route/
      },
      {
        desc: 'Different center target path',
        url: `/object/upload/sign/transformations/other-center-id/file.jpg`,
        expectedErrorPattern: /outside expected upload-sign route/
      },
      {
        desc: 'REST endpoint instead of storage',
        url: `/rest/v1/transformations`,
        expectedErrorPattern: /outside expected upload-sign route/
      }
    ];

    for (const tc of outOfRouteCases) {
      mockStorageResponseGenerator = (req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ url: tc.url }));
      };

      const req = {
        method: 'POST',
        query: { action: 'upload-url' },
        headers: {
          'content-type': 'application/json',
          'cookie': sessionCookie
        },
        body: { kind: 'before', content_type: 'image/jpeg' }
      };

      let statusCode = 0;
      let resBody = null;
      const res = {
        status(c) { statusCode = c; return this; },
        json(d) { resBody = d; return this; }
      };

      await ownerHandler(req, res);
      assert.equal(statusCode, 502, `${tc.desc} should return 502`);
      assert.equal(resBody.error, 'Failed to create signed upload URL');
      assert.match(resBody.details, tc.expectedErrorPattern);
    }
  });

  await t.test('8. Centre Isolation: requestedPath outside owner center is forbidden (403)', async () => {
    mockStorageResponseGenerator = null;
    const maliciousReq = {
      method: 'POST',
      query: { action: 'upload-url' },
      headers: {
        'content-type': 'application/json',
        'cookie': sessionCookie
      },
      body: {
        kind: 'before',
        content_type: 'image/jpeg',
        path: 'attacker-center-id/overwrite.jpg'
      }
    };

    let statusCode = 0;
    let resBody = null;
    const res = {
      status(c) { statusCode = c; return this; },
      json(d) { resBody = d; return this; }
    };

    await ownerHandler(maliciousReq, res);
    assert.equal(statusCode, 403, 'Cross-center requestedPath rejected with 403');
    assert.equal(resBody.error, 'Forbidden: Object path must begin with your center_id.');
  });

  await t.test('9. Centre Isolation: requestedPath within owner center is allowed (200)', async () => {
    mockStorageResponseGenerator = null;
    const validReq = {
      method: 'POST',
      query: { action: 'upload-url' },
      headers: {
        'content-type': 'application/json',
        'cookie': sessionCookie
      },
      body: {
        kind: 'before',
        content_type: 'image/jpeg',
        path: `${centerId}/custom-uuid-123.jpg`
      }
    };

    let statusCode = 0;
    let resBody = null;
    const res = {
      status(c) { statusCode = c; return this; },
      json(d) { resBody = d; return this; }
    };

    await ownerHandler(validReq, res);
    assert.equal(statusCode, 200, 'Same-center requestedPath allowed');
    assert.equal(resBody.path, `${centerId}/custom-uuid-123.jpg`);
  });

  await t.test('10. Upstream Error Propagation: Upstream failure properly returns 502 with details', async () => {
    mockStorageResponseGenerator = (req, res) => {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ statusCode: '500', error: 'DatabaseError', message: 'connection failed' }));
    };

    const req = {
      method: 'POST',
      query: { action: 'upload-url' },
      headers: {
        'content-type': 'application/json',
        'cookie': sessionCookie
      },
      body: { kind: 'before', content_type: 'image/jpeg' }
    };

    let statusCode = 0;
    let resBody = null;
    const res = {
      status(c) { statusCode = c; return this; },
      json(d) { resBody = d; return this; }
    };

    await ownerHandler(req, res);
    assert.equal(statusCode, 502, 'Upstream error returns 502 Bad Gateway');
    assert.equal(resBody.error, 'Failed to create signed upload URL');
    assert.equal(resBody.details?.statusCode, '500');
  });

  server.close();
});
