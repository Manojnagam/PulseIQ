import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import ownerHandler from './pulsezen_candidate_v2/api/owner.js';
import publicHandler from './pulsezen_candidate_v2/api/public.js';
import { signOwnerSession } from './pulsezen_candidate_v2/api/_session.js';

const PORT = 9988;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const db = {
  transformations: {},
  storage: new Set()
};

const centerId = '11111111-1111-1111-1111-111111111111';
const secret = 'test-secret-must-be-32-chars-long-123456';
process.env.SUPABASE_URL = BASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = secret;
process.env.OWNER_SESSION_SECRET = secret;
process.env.GROQ_API_KEY = 'gsk_mock_live_test_key_12345';

// Intercept ONLY external AI provider calls (Groq API) while exercising the real handleSummarize handler
const origFetch = globalThis.fetch;
let mockGroqMode = 'normal'; // 'normal' | 'banned_claim'

globalThis.fetch = async (input, init) => {
  const urlStr = typeof input === 'string' ? input : input?.url || '';

  if (urlStr.includes('api.groq.com')) {
    const reqBody = JSON.parse(init?.body || '{}');
    const userPrompt = reqBody.messages?.find(m => m.role === 'user')?.content || '';

    if (mockGroqMode === 'banned_claim') {
      // Simulate external AI generating a medical claim ("cured diabetes") that must be blocked by handleSummarize
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'This program completely cured my chronic condition and healed all symptoms.'
              }
            }
          ]
        })
      };
    }

    // Normal compliant AI response
    const variantText = userPrompt.includes('Variant 1')
      ? 'Consistent habits and personalized guidance helped me gain energy and feel lighter every day.'
      : 'Following my daily routine boosted my stamina and helped me maintain healthy wellness.';

    return {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        choices: [
          {
            message: {
              role: 'assistant',
              content: variantText
            }
          }
        ]
      })
    };
  }

  return origFetch(input, init);
};

const sessionToken = signOwnerSession({
  userId: 'usr-1',
  center_id: centerId,
  email: 'owner@pulsezen.in',
  typ: 'owner'
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, BASE_URL);
  const pathname = url.pathname;

  let bodyStr = '';
  req.on('data', c => bodyStr += c);
  req.on('end', async () => {
    if (pathname === '/favicon.ico') {
      res.writeHead(204);
      return res.end();
    }

    // 1. Static HTML serving
    if (pathname === '/owner' || pathname === '/owner.html') {
      let html = fs.readFileSync(path.join(process.cwd(), 'pulsezen_candidate_v2', 'owner.html'), 'utf8');
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Set-Cookie': `pz_owner_session=${sessionToken}; Path=/; HttpOnly`
      });
      return res.end(html);
    }

    if (pathname === '/center' || pathname === '/center.html') {
      let html = fs.readFileSync(path.join(process.cwd(), 'pulsezen_candidate_v2', 'center.html'), 'utf8');
      html = html.replace('</head>', `<script>window.__TEST_CENTER_ID__ = "${centerId}";</script></head>`);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    }

    // 2. Candidate Owner API routes - ALL routed to real ownerHandler (including summarize!)
    if (pathname.startsWith('/api/owner')) {
      const query = Object.fromEntries(url.searchParams);
      const action = query.action || pathname.split('/').pop();
      query.action = action;

      const mockReq = {
        method: req.method,
        query,
        headers: req.headers,
        body: bodyStr ? JSON.parse(bodyStr) : {}
      };
      const mockRes = {
        statusCode: 200,
        headers: {},
        status(c) { this.statusCode = c; return this; },
        json(d) {
          res.writeHead(this.statusCode, { 'Content-Type': 'application/json', ...this.headers });
          res.end(JSON.stringify(d));
        },
        end(d) {
          res.writeHead(this.statusCode, this.headers);
          res.end(d);
        }
      };
      return await ownerHandler(mockReq, mockRes);
    }

    // 3. Candidate Public API routes - Routed to real publicHandler
    if (pathname.startsWith('/api/public')) {
      const query = Object.fromEntries(url.searchParams);
      const action = query.action || pathname.split('/').pop();
      query.action = action;

      const mockReq = {
        method: req.method,
        query,
        headers: req.headers,
        body: bodyStr ? JSON.parse(bodyStr) : {}
      };
      const mockRes = {
        statusCode: 200,
        headers: {},
        status(c) { this.statusCode = c; return this; },
        json(d) {
          res.writeHead(this.statusCode, { 'Content-Type': 'application/json', ...this.headers });
          res.end(JSON.stringify(d));
        },
        setHeader(k, v) { this.headers[k.toLowerCase()] = v; return this; },
        send(d) {
          res.writeHead(this.statusCode, { 'Content-Type': 'image/jpeg', ...this.headers });
          res.end(d);
        },
        end(d) {
          res.writeHead(this.statusCode, this.headers);
          res.end(d);
        }
      };
      return await publicHandler(mockReq, mockRes);
    }

    // 4. Mock Supabase REST & Storage
    if (pathname.startsWith('/storage/v1/object/authenticated/transformations/')) {
      res.writeHead(200, { 'Content-Type': 'image/jpeg' });
      return res.end(Buffer.from('MOCK_JPEG_IMAGE_BYTES'));
    }

    if (pathname === '/storage/v1/object/transformations' && req.method === 'DELETE') {
      const { prefixes } = JSON.parse(bodyStr || '{}');
      if (prefixes) prefixes.forEach(p => db.storage.delete(p));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ message: 'Deleted' }));
    }

    if (pathname === '/rest/v1/transformations') {
      if (req.method === 'GET') {
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
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(row ? [row] : []));
        }

        // Shared photo check
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
        const id = idMatch ? idMatch[1] : null;
        if (!id || !db.transformations[id]) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify([]));
        }

        // Snapshot conditional update checks
        const patch = JSON.parse(bodyStr);
        const condParams = Object.fromEntries(url.searchParams);
        if (condParams['status'] === 'eq.draft' && db.transformations[id].status !== 'draft') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify([]));
        }
        if (condParams['customer_words'] && condParams['customer_words'].replace(/^eq\./, '') !== db.transformations[id].customer_words) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify([]));
        }

        Object.assign(db.transformations[id], patch);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify([db.transformations[id]]));
      }

      if (req.method === 'DELETE') {
        const idMatch = url.search.match(/[?&]id=eq\.([a-f0-9-]+)/);
        const id = idMatch ? idMatch[1] : null;
        const deleted = db.transformations[id];
        delete db.transformations[id];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(deleted ? [deleted] : []));
      }
    }

    res.writeHead(404);
    res.end();
  });
});

server.listen(PORT, async () => {
  console.log(`Test server running at ${BASE_URL}`);

  // Seed Story A (consented story)
  const storyAId = '12345678-1234-1234-1234-123456789abc';
  db.transformations[storyAId] = {
    id: storyAId,
    center_id: centerId,
    customer_name: 'Pooja Reddy',
    before_path: `${centerId}/pooja_before.jpg`,
    after_path: `${centerId}/pooja_after.jpg`,
    duration_weeks: 6,
    start_weight_kg: 68.0,
    end_weight_kg: 62.5,
    health_issue: 'Energy & posture',
    customer_words: 'Gained great morning energy and lost 5.5kg.',
    ai_summary: 'Lost 5.5kg and improved energy with dedicated coaching.',
    status: 'draft',
    consent_given: true,
    consent_name: 'Pooja Reddy',
    consent_phone_last4: '5566'
  };
  db.storage.add(`${centerId}/pooja_before.jpg`);
  db.storage.add(`${centerId}/pooja_after.jpg`);

  // Seed Story B (unconsented story - must not inherit Story A state)
  const storyBId = '87654321-4321-4321-4321-cba987654321';
  db.transformations[storyBId] = {
    id: storyBId,
    center_id: centerId,
    customer_name: 'Kiran Kumar',
    before_path: `${centerId}/kiran_before.jpg`,
    after_path: `${centerId}/kiran_after.jpg`,
    duration_weeks: 12,
    start_weight_kg: 85.0,
    end_weight_kg: 77.0,
    health_issue: 'Cardiovascular fitness',
    customer_words: 'Lost 8kg in 12 weeks with consistent workout and nutritious diet.',
    ai_summary: null,
    status: 'draft',
    consent_given: false,
    consent_name: null,
    consent_phone_last4: null
  };
  db.storage.add(`${centerId}/kiran_before.jpg`);
  db.storage.add(`${centerId}/kiran_after.jpg`);

  // Launch Edge with remote debugging
  const debuggingPort = 9222;
  const userDataDir = path.join(process.cwd(), '.edge-test-profile');
  const edge = spawn(EDGE_PATH, [
    `--remote-debugging-port=${debuggingPort}`,
    `--user-data-dir=${userDataDir}`,
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ]);

  // Connect CDP
  setTimeout(async () => {
    try {
      const versionRes = await fetch(`http://127.0.0.1:${debuggingPort}/json/version`);
      const versionData = await versionRes.json();
      console.log('Browser CDP Connected:', versionData.Browser);

      const listRes = await fetch(`http://127.0.0.1:${debuggingPort}/json/list`);
      const targets = await listRes.json();
      const pageTarget = targets.find(t => t.type === 'page');
      const wsUrl = pageTarget.webSocketDebuggerUrl;

      const { WebSocket: WS } = await import('ws').catch(async () => {
        return { WebSocket: globalThis.WebSocket };
      });

      const ws = new WS(wsUrl);
      let idCounter = 1;
      const callbacks = new Map();
      const cdpExceptions = [];
      const cdpConsoleErrors = [];

      ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data);

        // Track runtime exceptions and console errors
        if (data.method === 'Runtime.exceptionThrown') {
          cdpExceptions.push(data.params);
          console.error('[CDP Exception Caught]:', data.params.exceptionDetails?.text, data.params.exceptionDetails?.exception?.description);
        }
        if (data.method === 'Log.entryAdded' && data.params.entry?.level === 'error') {
          cdpConsoleErrors.push(data.params.entry);
          console.error('[CDP Log Error Caught]:', data.params.entry.text);
        }

        if (callbacks.has(data.id)) {
          callbacks.get(data.id)(data);
          callbacks.delete(data.id);
        }
      };

      function sendCmd(method, params = {}) {
        return new Promise((resolve) => {
          const id = idCounter++;
          callbacks.set(id, resolve);
          ws.send(JSON.stringify({ id, method, params }));
        });
      }

      await new Promise(r => ws.onopen = r);
      console.log('WebSocket Debugger session opened.');

      await sendCmd('Page.enable');
      await sendCmd('Runtime.enable');
      await sendCmd('Log.enable');

      // 0. Exercise Actual handleSummarize Handler directly with mock AI provider
      console.log('-> Browser Step 0: Exercising actual handleSummarize handler with AI mock...');
      const summarizeReq = {
        method: 'POST',
        query: { action: 'summarize' },
        headers: { 'content-type': 'application/json', cookie: `pz_owner_session=${sessionToken}` },
        body: { id: storyAId }
      };
      let summarizeResData = null;
      let summarizeStatus = 0;
      await ownerHandler(summarizeReq, {
        status(c) { summarizeStatus = c; return this; },
        json(d) { summarizeResData = d; }
      });
      assert.equal(summarizeStatus, 200, 'Actual handleSummarize must return 200 for valid words');
      assert.equal(summarizeResData.variants?.length, 2, 'Actual handleSummarize must return 2 variants');
      assert.match(summarizeResData.variants[0], /Consistent habits/, 'Variant 1 must match generated clean output');

      // Test claim blocking filter in actual handleSummarize
      mockGroqMode = 'banned_claim';
      let blockedStatus = 0;
      let blockedResData = null;
      await ownerHandler(summarizeReq, {
        status(c) { blockedStatus = c; return this; },
        json(d) { blockedResData = d; }
      });
      assert.equal(blockedStatus, 400, 'Actual handleSummarize must block curative medical claims with HTTP 400');
      assert.equal(blockedResData.error, 'claim_blocked', 'Must return error=claim_blocked');
      assert.ok(blockedResData.banned_terms?.includes('cured') || blockedResData.banned_terms?.includes('healed'), 'Must identify banned terms');
      mockGroqMode = 'normal'; // Reset back to normal

      // 1. Navigate to Owner Portal and verify initial render
      console.log('-> Browser Step 1: Navigating to Owner Portal...');
      await sendCmd('Page.navigate', { url: `${BASE_URL}/owner.html` });
      await new Promise(r => setTimeout(r, 1500));

      const eval1 = await sendCmd('Runtime.evaluate', {
        expression: `document.querySelectorAll('.t-card').length`
      });
      const initialCardsCount = eval1.result.result.value;
      console.log(`[Browser Check 1] Cards rendered in Owner Portal: ${initialCardsCount}`);
      assert.equal(initialCardsCount, 2, 'Owner portal must initially render 2 transformation cards');

      // 2. Publish Story A with valid review snapshot
      console.log('-> Browser Step 2: Owner publishes Story A with valid review snapshot...');
      const snapshotA = {
        customer_name: 'Pooja Reddy',
        duration_weeks: 6,
        start_weight_kg: 68.0,
        end_weight_kg: 62.5,
        health_issue: 'Energy & posture',
        customer_words: 'Gained great morning energy and lost 5.5kg.'
      };
      const evalPubRes = await sendCmd('Runtime.evaluate', {
        expression: `
          (async () => {
            const res = await fetch('/api/owner/publish', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                id: '${storyAId}',
                review_snapshot: ${JSON.stringify(snapshotA)}
              })
            });
            const data = await res.json();
            return { status: res.status, pubStatus: data.status };
          })()
        `,
        awaitPromise: true,
        returnByValue: true
      });
      const pubResult = evalPubRes.result.result.value;
      console.log('[Browser Check 2] Story A publish status:', JSON.stringify(pubResult));
      assert.equal(pubResult.status, 200, 'Publishing Story A must succeed with HTTP 200');
      assert.equal(pubResult.pubStatus, 'published', 'Story A status must transition to published');

      // 3. Navigate to Center Public Page and verify publication appearance
      console.log('-> Browser Step 3: Navigating to Public Centre Showcase...');
      await sendCmd('Page.navigate', { url: `${BASE_URL}/center.html` });
      await new Promise(r => setTimeout(r, 1500));

      const evalPub = await sendCmd('Runtime.evaluate', {
        expression: `
          (async () => {
            await loadTransformations('${centerId}');
            const sec = document.getElementById('transformations-section');
            const cards = document.querySelectorAll('.t-card-clean');
            return {
              display: sec ? sec.style.display : 'missing',
              cardCount: cards.length,
              cardName: cards[0] ? cards[0].querySelector('.t-name-clean')?.textContent : null,
              quote: cards[0] ? cards[0].querySelector('.t-quote-clean')?.textContent : null
            };
          })()
        `,
        awaitPromise: true,
        returnByValue: true
      });
      const publicPresentation = evalPub.result.result.value;
      console.log('[Browser Check 3] Public Centre Page Presentation:', JSON.stringify(publicPresentation));
      assert.equal(publicPresentation.cardCount, 1, 'Public centre page must display exactly 1 published story');
      assert.equal(publicPresentation.cardName, 'Pooja Reddy', 'Published card name must be Pooja Reddy');
      assert.match(publicPresentation.quote, /Lost 5.5kg/, 'Published quote must show approved AI summary');

      // 4. Edit details of Story A with quotes, backslashes, and multiline text
      console.log('-> Browser Step 4: Factual Edit with Quotes & Special Characters in Owner Portal...');
      const specialText = `Pooja's "Transformation" \\Coach notes\\\nLine 2: 100% verified.`;
      const editPayload = {
        id: storyAId,
        customer_name: 'Pooja "O\'Reddy" \\Test\\',
        duration_weeks: 8,
        end_weight_kg: 61.0,
        customer_words: specialText
      };
      const evalEdit = await sendCmd('Runtime.evaluate', {
        expression: `
          (async () => {
            const payload = ${JSON.stringify(editPayload)};
            const res = await fetch('/api/owner/edit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify(payload)
            });
            const data = await res.json();
            return { status: res.status, requires_review: data.requires_review, itemStatus: data.transformation?.status, customer_name: data.transformation?.customer_name };
          })()
        `,
        awaitPromise: true,
        returnByValue: true
      });
      const editResult = evalEdit.result.result.value;
      console.log('[Browser Check 4] Factual Edit with special characters:', JSON.stringify(editResult));
      assert.equal(editResult.status, 200, 'Factual edit must return HTTP 200');
      assert.equal(editResult.requires_review, true, 'Factual edit must require owner review');
      assert.equal(editResult.itemStatus, 'draft', 'Factual edit must atomically retract story to draft');
      assert.equal(db.transformations[storyAId].customer_words, specialText, 'Special characters and newlines must be preserved in DB');

      // 5. Verify Centre Public Page immediately hides Story A after factual edit returned it to draft
      console.log('-> Browser Step 5: Checking Centre Public Page after factual edit (Consistency Safety)...');
      const evalPubAfterEdit = await sendCmd('Runtime.evaluate', {
        expression: `
          (async () => {
            await loadTransformations('${centerId}');
            const res = await fetch('/api/public/transformations?center_id=${centerId}');
            const data = await res.json();
            return { publicCount: data.transformations?.length || 0 };
          })()
        `,
        awaitPromise: true,
        returnByValue: true
      });
      const publicPostEdit = evalPubAfterEdit.result.result.value;
      console.log('[Browser Check 5] Public Centre Page post-edit (Story retracted for review):', JSON.stringify(publicPostEdit));
      assert.equal(publicPostEdit.publicCount, 0, 'Public centre page must show 0 stories while edited story awaits re-review');

      // 6. Navigate back to Owner Portal and verify addEventListener DOM Safe Bindings
      console.log('-> Browser Step 6: Navigating to Owner Portal to verify addEventListener and safe DOM bindings...');
      await sendCmd('Page.navigate', { url: `${BASE_URL}/owner.html` });
      await new Promise(r => setTimeout(r, 1500));

      const evalDomCheck = await sendCmd('Runtime.evaluate', {
        expression: `
          (() => {
            const cards = document.querySelectorAll('.t-card');
            const editBtn = cards[0] ? cards[0].querySelector('.action-edit-btn') : null;
            const reviewBtn = cards[0] ? cards[0].querySelector('.action-review-btn') : null;
            const delBtn = cards[0] ? cards[0].querySelector('.action-delete-btn') : null;
            return {
              cardCount: cards.length,
              hasInlineOnclickEdit: editBtn ? editBtn.hasAttribute('onclick') : true,
              hasInlineOnclickReview: reviewBtn ? reviewBtn.hasAttribute('onclick') : true,
              hasInlineOnclickDelete: delBtn ? delBtn.hasAttribute('onclick') : true,
              dataId: editBtn ? editBtn.getAttribute('data-id') : null
            };
          })()
        `,
        returnByValue: true
      });
      const domCheck = evalDomCheck.result.result.value;
      console.log('[Browser Check 6] DOM Safe Binding & Zero Inline Onclick:', JSON.stringify(domCheck));
      assert.equal(domCheck.hasInlineOnclickEdit, false, 'Edit button must NOT have inline onclick');
      assert.equal(domCheck.hasInlineOnclickReview, false, 'Review button must NOT have inline onclick');
      assert.equal(domCheck.hasInlineOnclickDelete, false, 'Delete button must NOT have inline onclick');
      assert.ok(domCheck.dataId, 'Buttons must bind data-id for addEventListener handlers');

      // 7. Review-form State Isolation: Open Consented Story A followed by Unconsented Story B
      console.log('-> Browser Step 7: Testing Review-Form State Isolation (Consented Story A -> Unconsented Story B)...');
      const evalIsolation = await sendCmd('Runtime.evaluate', {
        expression: `
          (async () => {
            const results = {};

            // 7a: Reopen Consented Story A for review
            const reviewBtnA = document.querySelector('.action-review-btn[data-id="${storyAId}"]');
            if (!reviewBtnA) return { error: 'Review button for Story A not found' };
            reviewBtnA.click();
            await new Promise(r => setTimeout(r, 1000));

            // Select summary for Story A and advance to Step 6
            selectVariant(0);
            await saveChosenSummary();
            await new Promise(r => setTimeout(r, 500));

            // Simulate user interacting with Step 6 for Story A: checking consent and entering phone
            document.getElementById('consent-check').checked = true;
            document.getElementById('c-phone').value = '9988';
            validateConsentForm();

            results.storyA_consentChecked = document.getElementById('consent-check').checked;
            results.storyA_phone = document.getElementById('c-phone').value;
            results.storyA_publishEnabled = !document.getElementById('btn-publish').disabled;

            // 7b: Now switch directly to Unconsented Story B
            const reviewBtnB = document.querySelector('.action-review-btn[data-id="${storyBId}"]');
            if (!reviewBtnB) return { error: 'Review button for Story B not found' };
            reviewBtnB.click();
            await new Promise(r => setTimeout(r, 1000));

            // Verify Story B inherited NOTHING from Story A:
            // Checkbox must be reset to false, phone must be reset to empty, publish must be disabled
            results.storyB_inheritedConsentCheck = document.getElementById('consent-check').checked;
            results.storyB_inheritedPhone = document.getElementById('c-phone').value;
            results.storyB_name = document.getElementById('c-name').value;
            results.storyB_publishDisabled = document.getElementById('btn-publish').disabled;

            // 7c: Attempt to publish Story B WITHOUT explicit consent confirmation
            // Calling handlePublishFinal() directly must be rejected and must NOT publish
            await handlePublishFinal();
            const alertEl = document.getElementById('global-alert');
            results.unconfirmedPublishRejected = alertEl.style.display !== 'none' && alertEl.textContent.includes('consent');

            // 7d: Now provide EXPLICIT confirmation for Story B and publish
            selectVariant(1);
            await saveChosenSummary();
            await new Promise(r => setTimeout(r, 500));

            document.getElementById('consent-check').checked = true;
            document.getElementById('c-phone').value = '4321';
            validateConsentForm();
            results.storyB_explicitConfirmEnabled = !document.getElementById('btn-publish').disabled;

            await handlePublishFinal();
            await new Promise(r => setTimeout(r, 1000));

            // Verify Story B is published in DOM list
            const cardB = Array.from(document.querySelectorAll('.t-card')).find(c => c.textContent.includes('Kiran Kumar'));
            const badgeB = cardB ? cardB.querySelector('.badge') : null;
            results.storyB_finalStatusBadge = badgeB ? badgeB.textContent : null;

            return results;
          })()
        `,
        awaitPromise: true,
        returnByValue: true
      });
      const isolationRes = evalIsolation.result.result.value;
      console.log('[Browser Check 7] Review-form State Isolation & Unconsented Story B:', JSON.stringify(isolationRes));
      assert.equal(isolationRes.storyA_consentChecked, true, 'Story A consent check was set to true');
      assert.equal(isolationRes.storyA_phone, '9988', 'Story A phone was entered');
      assert.equal(isolationRes.storyA_publishEnabled, true, 'Story A publish button was enabled');
      assert.equal(isolationRes.storyB_inheritedConsentCheck, false, 'Story B MUST NOT inherit consent check (must be false)');
      assert.equal(isolationRes.storyB_inheritedPhone, '', 'Story B MUST NOT inherit phone digits (must be empty)');
      assert.equal(isolationRes.storyB_publishDisabled, true, 'Story B publish button must be disabled initially');
      assert.equal(isolationRes.unconfirmedPublishRejected, true, 'Story B publish without consent confirmation must be rejected');
      assert.equal(isolationRes.storyB_explicitConfirmEnabled, true, 'Explicit consent enables publish for Story B');
      assert.equal(isolationRes.storyB_finalStatusBadge.toLowerCase(), 'published', 'Story B must be published in DOM');

      // 8. Verify Centre Public Page shows republished Story B
      console.log('-> Browser Step 8: Verifying published Story B on Public Centre Showcase...');
      await sendCmd('Page.navigate', { url: `${BASE_URL}/center.html` });
      await new Promise(r => setTimeout(r, 1500));

      const evalPublicB = await sendCmd('Runtime.evaluate', {
        expression: `
          (async () => {
            await loadTransformations('${centerId}');
            const cards = document.querySelectorAll('.t-card-clean');
            return {
              cardCount: cards.length,
              cardName: cards[0] ? cards[0].querySelector('.t-name-clean')?.textContent : null,
              quote: cards[0] ? cards[0].querySelector('.t-quote-clean')?.textContent : null
            };
          })()
        `,
        awaitPromise: true,
        returnByValue: true
      });
      const publicB = evalPublicB.result.result.value;
      console.log('[Browser Check 8] Public Centre Page Presentation post-republish:', JSON.stringify(publicB));
      assert.equal(publicB.cardCount, 1, 'Public centre page must display Story B');
      assert.equal(publicB.cardName, 'Kiran Kumar', 'Public story name must match Story B (Kiran Kumar)');
      assert.ok(publicB.quote.length > 0, 'Public story quote must be present');

      // 9. Owner deletes Story B (Zero storage deletions enforced)
      console.log('-> Browser Step 9: Owner deletes transformation (Zero storage deletions enforced)...');
      const evalDel = await sendCmd('Runtime.evaluate', {
        expression: `
          (async () => {
            const res = await fetch('/api/owner/delete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ id: '${storyBId}', confirm: true })
            });
            const data = await res.json();
            return {
              status: res.status,
              success: data.success,
              storageDeletedCount: data.storage_deleted?.length || 0,
              deferredCount: data.storage_cleanup_deferred?.length || 0
            };
          })()
        `,
        awaitPromise: true,
        returnByValue: true
      });
      const delResult = evalDel.result.result.value;
      console.log('[Browser Check 9] Delete response (Storage preserved):', JSON.stringify(delResult));
      assert.equal(delResult.status, 200, 'Delete must return HTTP 200');
      assert.equal(delResult.success, true, 'Delete success flag must be true');
      assert.equal(delResult.storageDeletedCount, 0, 'ZERO storage deletions must be performed');
      assert.equal(delResult.deferredCount, 2, 'Both before and after photos must have deletion deferred');
      assert.equal(db.transformations[storyBId], undefined, 'Story B must be removed from transformations DB');

      // 10. Verify Public Centre Page after deletion
      console.log('-> Browser Step 10: Verifying Public Centre Page after deletion...');
      const evalPubAfterDel = await sendCmd('Runtime.evaluate', {
        expression: `
          (async () => {
            await loadTransformations('${centerId}');
            const res = await fetch('/api/public/transformations?center_id=${centerId}');
            const data = await res.json();
            return { publicCount: data.transformations?.length || 0 };
          })()
        `,
        awaitPromise: true,
        returnByValue: true
      });
      const pubAfterDel = evalPubAfterDel.result.result.value;
      console.log('[Browser Check 10] Public Centre Page post-deletion:', JSON.stringify(pubAfterDel));
      assert.equal(pubAfterDel.publicCount, 0, 'Public centre page must display 0 stories after deletion');

      // 11. Assert ZERO CDP Unhandled Exceptions and Console Errors
      console.log('-> Browser Step 11: Asserting CDP exception and error logs...');
      console.log(`CDP Exceptions Caught: ${cdpExceptions.length}`);
      console.log(`CDP Console Errors Caught: ${cdpConsoleErrors.length}`);
      assert.equal(cdpExceptions.length, 0, `There must be 0 unhandled CDP runtime exceptions. Caught: ${JSON.stringify(cdpExceptions)}`);
      assert.equal(cdpConsoleErrors.length, 0, `There must be 0 CDP console errors. Caught: ${JSON.stringify(cdpConsoleErrors)}`);

      ws.close();
      edge.kill();
      server.close();
      console.log('=== ALL BROWSER ASSERTIONS PASSED (100% SUCCESS) ===');
      process.exit(0);
    } catch (e) {
      console.error('Browser Test Assertion Failure:', e);
      edge.kill();
      server.close();
      process.exit(1);
    }
  }, 2000);
});
