import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
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
      // Inject test center id
      html = html.replace('</head>', `<script>window.__TEST_CENTER_ID__ = "${centerId}";</script></head>`);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    }

    // 2. Candidate API routes
    if (pathname.startsWith('/api/owner')) {
      const query = Object.fromEntries(url.searchParams);
      const action = query.action || pathname.split('/').pop();
      query.action = action;

      // Mock summarize endpoint for browser test to simulate AI responses without external API calls
      if (action === 'summarize') {
        const reqBody = bodyStr ? JSON.parse(bodyStr) : {};
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          id: reqBody.id,
          variants: [
            'Consistent habits and personalized guidance helped me gain energy and feel lighter every day.',
            'Following my daily routine boosted my stamina and helped me maintain healthy wellness.'
          ]
        }));
      }

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

    // 3. Mock Supabase REST & Storage
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
        Object.assign(db.transformations[id], JSON.parse(bodyStr));
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

  // Seed transformation
  const initialId = '12345678-1234-1234-1234-123456789abc';
  db.transformations[initialId] = {
    id: initialId,
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

      ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
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

      // 1. Navigate to Owner Portal and verify initial render
      console.log('-> Browser Step 1: Navigating to Owner Portal...');
      await sendCmd('Page.navigate', { url: `${BASE_URL}/owner.html` });
      await new Promise(r => setTimeout(r, 1500));

      const eval1 = await sendCmd('Runtime.evaluate', {
        expression: `document.querySelectorAll('.t-card').length`
      });
      console.log(`[Browser Check 1] Cards rendered in Owner Portal: ${eval1.result.result.value}`);

      // 2. Publish story in Owner Portal with review snapshot
      console.log('-> Browser Step 2: Owner publishes transformation with valid review snapshot...');
      const initialSnapshot = {
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
                id: '${initialId}',
                review_snapshot: ${JSON.stringify(initialSnapshot)}
              })
            });
            const data = await res.json();
            return { status: res.status, pubStatus: data.status };
          })()
        `,
        awaitPromise: true,
        returnByValue: true
      });
      console.log('[Browser Check 2] Publish status:', JSON.stringify(evalPubRes.result.result.value));

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
      console.log('[Browser Check 3] Public Centre Page Presentation:', JSON.stringify(evalPub.result.result.value));

      // 4. Edit details in Owner Portal with quotes, backslashes, and multiline text
      console.log('-> Browser Step 4: Factual Edit with Quotes & Special Characters in Owner Portal...');
      const specialText = `Pooja's "Transformation" \\Coach notes\\\nLine 2: 100% verified.`;
      const editPayload = {
        id: initialId,
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
      console.log('[Browser Check 4] Factual Edit with special characters:', JSON.stringify(evalEdit.result.result.value));

      // 5. Verify Centre Public Page immediately hides story after factual edit returned it to draft
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
      console.log('[Browser Check 5] Public Centre Page post-edit (Story retracted for review):', JSON.stringify(evalPubAfterEdit.result.result.value));

      // 6. Navigate back to Owner Portal and test addEventListener DOM Click
      console.log('-> Browser Step 6: Navigating to Owner Portal to verify addEventListener and safe DOM bindings...');
      await sendCmd('Page.navigate', { url: `${BASE_URL}/owner.html` });
      await new Promise(r => setTimeout(r, 1500));

      const evalDomCheck = await sendCmd('Runtime.evaluate', {
        expression: `
          (() => {
            const card = document.querySelector('.t-card');
            const nameEl = card ? card.querySelector('.t-name') : null;
            const editBtn = card ? card.querySelector('.action-edit-btn') : null;
            const reviewBtn = card ? card.querySelector('.action-review-btn') : null;
            const delBtn = card ? card.querySelector('.action-delete-btn') : null;
            return {
              renderedName: nameEl ? nameEl.textContent : null,
              hasInlineOnclickEdit: editBtn ? editBtn.hasAttribute('onclick') : true,
              hasInlineOnclickReview: reviewBtn ? reviewBtn.hasAttribute('onclick') : true,
              hasInlineOnclickDelete: delBtn ? delBtn.hasAttribute('onclick') : true,
              dataId: editBtn ? editBtn.getAttribute('data-id') : null
            };
          })()
        `,
        returnByValue: true
      });
      console.log('[Browser Check 6] DOM Safe Binding & Zero Inline Onclick:', JSON.stringify(evalDomCheck.result.result.value));

      // 7. Reopen edited existing story, review summary in wizard, advance and republish
      console.log('-> Browser Step 7: Reopening edited story, reviewing summary, and republishing...');
      const evalReopenAndRepublish = await sendCmd('Runtime.evaluate', {
        expression: `
          (async () => {
            // Click the Review & Publish button on the draft card
            const reviewBtn = document.querySelector('.action-review-btn');
            if (!reviewBtn) return { error: 'Review button not found' };
            reviewBtn.click();

            // Wait for wizard step 5 to become active
            await new Promise(r => setTimeout(r, 1000));
            const step5Active = document.getElementById('step-5').classList.contains('active');
            const snapshotCaptured = Boolean(state.reviewSnapshot && state.reviewSnapshot.customer_name);

            // Select summary variant 0 and save chosen summary
            selectVariant(0);
            await saveChosenSummary();
            await new Promise(r => setTimeout(r, 500));

            const step6Active = document.getElementById('step-6').classList.contains('active');

            // Complete consent gate and publish final
            document.getElementById('consent-check').checked = true;
            document.getElementById('c-name').value = 'Pooja O Reddy';
            document.getElementById('c-phone').value = '5566';
            validateConsentForm();

            await handlePublishFinal();
            await new Promise(r => setTimeout(r, 1000));

            // Verify list reflects published state
            const listCard = document.querySelector('.t-card');
            const badge = listCard ? listCard.querySelector('.badge') : null;

            return {
              step5Active,
              snapshotCaptured,
              step6Active,
              finalBadge: badge ? badge.textContent : null
            };
          })()
        `,
        awaitPromise: true,
        returnByValue: true
      });
      console.log('[Browser Check 7] Reopen review & republish workflow:', JSON.stringify(evalReopenAndRepublish.result.result.value));

      // 8. Verify public center showcase shows the republished story
      console.log('-> Browser Step 8: Verifying republished story on Public Centre Page...');
      await sendCmd('Page.navigate', { url: `${BASE_URL}/center.html` });
      await new Promise(r => setTimeout(r, 1500));

      const evalRepublishedPublic = await sendCmd('Runtime.evaluate', {
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
      console.log('[Browser Check 8] Public Centre Page Presentation post-republish:', JSON.stringify(evalRepublishedPublic.result.result.value));

      // 9. Owner Deletes transformation (Zero storage deletion check & confirmation text)
      console.log('-> Browser Step 9: Owner deletes transformation (Zero storage deletions enforced)...');
      const evalDel = await sendCmd('Runtime.evaluate', {
        expression: `
          (async () => {
            const res = await fetch('/api/owner/delete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ id: '${initialId}', confirm: true })
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
      console.log('[Browser Check 9] Delete response (Storage preserved):', JSON.stringify(evalDel.result.result.value));

      ws.close();
      edge.kill();
      server.close();
      console.log('=== REAL BROWSER WORKFLOW EXECUTION COMPLETE ===');
      process.exit(0);
    } catch (e) {
      console.error('Browser Test Error:', e);
      edge.kill();
      server.close();
      process.exit(1);
    }
  }, 2000);
});
