import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { signOwnerSession } from './pulsezen_candidate_v2/api/_session.js';
import { getBrowserExecutablePath } from './browser_finder.js';

const PORT = 9987;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const BROWSER_PATH = getBrowserExecutablePath();
const centerId = '2c1c3a6e-35b4-4e30-bbae-a0cf02d8dd7a';
const secret = 'test-secret-must-be-32-chars-long-123456';
process.env.OWNER_SESSION_SECRET = secret;

const sessionCookie = signOwnerSession({
  userId: 'usr-1',
  center_id: centerId,
  email: 'owner@pulsezen.in',
  typ: 'owner'
});

// Dynamic mock handlers
let mockTransformationHandler = null;
let mockSummarizeHandler = null;
let mockSummarySelectHandler = null;

let lastTransformationPayload = null;
let lastSummarizePayload = null;
let lastSummarySelectPayload = null;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, BASE_URL);
  let bodyStr = '';
  req.on('data', chunk => bodyStr += chunk);
  req.on('end', () => {
    // Serve HTML
    if (url.pathname === '/owner' || url.pathname === '/owner.html') {
      const html = fs.readFileSync(path.resolve('pulsezen_candidate_v2/owner.html'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    }

    if (url.pathname === '/api/owner/list') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        center: { id: centerId, name: "Dharani's Wellness Centre" },
        transformations: []
      }));
    }

    if (url.pathname === '/api/owner/upload-url') {
      const parsed = JSON.parse(bodyStr || '{}');
      const mockPath = `${centerId}/mock-${parsed.kind}-${Date.now()}.jpg`;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        upload_url: `${BASE_URL}/mock-storage-upload`,
        path: mockPath
      }));
    }

    if (url.pathname === '/mock-storage-upload') {
      res.writeHead(200);
      return res.end();
    }

    if (url.pathname === '/api/owner/transformation') {
      lastTransformationPayload = JSON.parse(bodyStr || '{}');
      if (mockTransformationHandler) {
        return mockTransformationHandler(req, res, lastTransformationPayload);
      }
      res.writeHead(201, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        id: 'trans-default-100',
        row: {
          id: 'trans-default-100',
          ...lastTransformationPayload
        }
      }));
    }

    if (url.pathname === '/api/owner/summarize') {
      lastSummarizePayload = JSON.parse(bodyStr || '{}');
      if (mockSummarizeHandler) {
        return mockSummarizeHandler(req, res, lastSummarizePayload);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        id: lastSummarizePayload.id,
        variants: [
          'Routine and energy improved noticeably with coaching.',
          'Daily consistency helped me feel active and healthy.'
        ]
      }));
    }

    if (url.pathname === '/api/owner/summary-select') {
      lastSummarySelectPayload = JSON.parse(bodyStr || '{}');
      if (mockSummarySelectHandler) {
        return mockSummarySelectHandler(req, res, lastSummarySelectPayload);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: true,
        id: lastSummarySelectPayload.id,
        ai_summary: lastSummarySelectPayload.text
      }));
    }

    res.writeHead(404);
    res.end();
  });
});

test('Browser Flow: Actual New-Story Lifecycle (Draft -> Summarize -> Select/Manual -> Consent)', async (t) => {
  await new Promise(r => server.listen(PORT, r));

  const browser = await puppeteer.launch({
    executablePath: BROWSER_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  t.after(async () => {
    await browser.close();
    server.close();
  });

  const setupPage = async () => {
    const page = await browser.newPage();
    await page.setCookie({
      name: 'pz_owner_session',
      value: sessionCookie,
      domain: '127.0.0.1'
    });
    await page.goto(`${BASE_URL}/owner.html`);
    await page.waitForSelector('#transformations-container');
    return page;
  };

  // Helper to progress new story from Step 1 through Step 4
  const fillNewStoryUpToStep4 = async (page, customerWords, customerName = 'Pooja Reddy') => {
    // Populate dummy photo states to satisfy upload steps
    await page.evaluate(() => {
      state.beforePath = '2c1c3a6e-35b4-4e30-bbae-a0cf02d8dd7a/test-before.jpg';
      state.afterPath = '2c1c3a6e-35b4-4e30-bbae-a0cf02d8dd7a/test-after.jpg';
      goToStep(3);
    });

    await page.waitForSelector('#step-3.active');

    // Fill Step 3 Facts
    await page.focus('#f-name');
    await page.keyboard.type(customerName);
    await page.focus('#f-weeks');
    await page.keyboard.type('12');
    await page.focus('#f-start-wt');
    await page.keyboard.type('70');
    await page.focus('#f-end-wt');
    await page.keyboard.type('64');
    await page.focus('#f-issue');
    await page.keyboard.type('Low stamina');

    // Click Next to Step 4
    await page.click('#btn-next-3');
    await page.waitForSelector('#step-4.active');

    // Fill Step 4 Customer Words
    await page.focus('#f-words');
    await page.keyboard.type(customerWords);
  };

  await t.test('1. Valid Variants Flow: New story draft created, 2 variants displayed, Variant B selected, advances to Consent Step 6', async () => {
    mockTransformationHandler = (req, res, payload) => {
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        id: 'trans-new-001',
        row: { id: 'trans-new-001', ...payload }
      }));
    };

    mockSummarizeHandler = (req, res, payload) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        id: payload.id,
        variants: [
          'Routine and energy improved noticeably with coaching.',
          'Daily consistency helped me feel active and healthy.'
        ]
      }));
    };

    let savedSummaryText = null;
    let savedSnapshot = null;
    mockSummarySelectHandler = (req, res, payload) => {
      savedSummaryText = payload.text;
      savedSnapshot = payload.review_snapshot;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, id: payload.id, ai_summary: payload.text }));
    };

    const page = await setupPage();
    await fillNewStoryUpToStep4(page, 'I joined the wellness program and lost 6 kg with regular nutrition and coaching.');

    // Click Generate Clean Summary in Step 4
    await page.click('#btn-next-4');

    // Wait for Step 5 to become active
    await page.waitForSelector('#step-5.active');

    // Verify backend received creation
    assert.equal(lastTransformationPayload.customer_name, 'Pooja Reddy');
    assert.equal(lastSummarizePayload.id, 'trans-new-001');

    // Verify variant cards rendering
    const v1Display = await page.$eval('#card-v1', el => getComputedStyle(el).display);
    const v2Display = await page.$eval('#card-v2', el => getComputedStyle(el).display);
    const v1Text = await page.$eval('#text-v1', el => el.textContent.trim());
    const v2Text = await page.$eval('#text-v2', el => el.textContent.trim());
    assert.equal(v1Display, 'block', 'Variant A is visible');
    assert.equal(v2Display, 'block', 'Variant B is visible');
    assert.equal(v1Text, 'Routine and energy improved noticeably with coaching.');
    assert.equal(v2Text, 'Daily consistency helped me feel active and healthy.');

    // Click Variant B
    await page.click('#card-v2');
    const chosenVal = await page.$eval('#chosen-text', el => el.value.trim());
    assert.equal(chosenVal, 'Daily consistency helped me feel active and healthy.');

    // Click Next: Consent Gate
    await page.click('#btn-next-5');

    // Step 6 Consent Gate must become active
    await page.waitForSelector('#step-6.active');
    assert.equal(savedSummaryText, 'Daily consistency helped me feel active and healthy.');
    assert.ok(savedSnapshot, 'Review snapshot was submitted');
    assert.equal(savedSnapshot.customer_name, 'Pooja Reddy');

    // Confirm Consent form fields are visible and ready
    const consentName = await page.$eval('#c-name', el => el.value);
    assert.equal(consentName, 'Pooja Reddy');

    await page.close();
  });

  await t.test('2. Empty/Malformed Variants Flow: Empty variants hidden, clear notice shown, manual entry accepted, advances to Step 6', async () => {
    mockTransformationHandler = (req, res, payload) => {
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        id: 'trans-new-002',
        row: { id: 'trans-new-002', ...payload }
      }));
    };

    mockSummarizeHandler = (req, res, payload) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        id: payload.id,
        variants: ['', '']
      }));
    };

    let savedSummaryText = null;
    mockSummarySelectHandler = (req, res, payload) => {
      savedSummaryText = payload.text;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, id: payload.id, ai_summary: payload.text }));
    };

    const page = await setupPage();
    await fillNewStoryUpToStep4(page, 'I stayed dedicated to my health plan and achieved great personal fitness results.', 'Rohan Sharma');

    await page.click('#btn-next-4');
    await page.waitForSelector('#step-5.active');

    // Empty cards must be hidden
    const v1Display = await page.$eval('#card-v1', el => getComputedStyle(el).display);
    const v2Display = await page.$eval('#card-v2', el => getComputedStyle(el).display);
    assert.equal(v1Display, 'none', 'Variant A card hidden when empty');
    assert.equal(v2Display, 'none', 'Variant B card hidden when empty');

    // Notice alert displayed
    const alertText = await page.$eval('#global-alert', el => el.textContent);
    assert.match(alertText, /AI summary unavailable/i);

    // Enter manual clean testimonial
    await page.focus('#chosen-text');
    await page.keyboard.type('Consistent coaching helped me transform my health and daily stamina.');

    // Click Next
    await page.click('#btn-next-5');
    await page.waitForSelector('#step-6.active');

    assert.equal(savedSummaryText, 'Consistent coaching helped me transform my health and daily stamina.');
    await page.close();
  });

  await t.test('3. Provider Failure (HTTP 502): Clear message shown, cards hidden, accurate manual entry advances to Step 6', async () => {
    mockTransformationHandler = (req, res, payload) => {
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        id: 'trans-new-003',
        row: { id: 'trans-new-003', ...payload }
      }));
    };

    mockSummarizeHandler = (req, res) => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Failed to generate AI summary',
        details: 'AI provider returned an empty or invalid summary.'
      }));
    };

    let savedSummaryText = null;
    mockSummarySelectHandler = (req, res, payload) => {
      savedSummaryText = payload.text;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, id: payload.id, ai_summary: payload.text }));
    };

    const page = await setupPage();
    await fillNewStoryUpToStep4(page, 'I improved my lifestyle habits with regular support from the wellness centre.', 'Ananya Das');

    await page.click('#btn-next-4');
    await page.waitForSelector('#step-5.active');

    // Cards hidden
    const v1Display = await page.$eval('#card-v1', el => getComputedStyle(el).display);
    const v2Display = await page.$eval('#card-v2', el => getComputedStyle(el).display);
    assert.equal(v1Display, 'none', 'Variant A card hidden on provider failure');
    assert.equal(v2Display, 'none', 'Variant B card hidden on provider failure');

    // Service notice shown
    const alertText = await page.$eval('#global-alert', el => el.textContent);
    assert.match(alertText, /AI service notice/i);

    // Manual entry
    await page.focus('#chosen-text');
    await page.keyboard.type('I built healthy habits and feel more active throughout the day.');

    await page.click('#btn-next-5');
    await page.waitForSelector('#step-6.active');

    assert.equal(savedSummaryText, 'I built healthy habits and feel more active throughout the day.');
    await page.close();
  });

  await t.test('4. Draft-Creation Failure & Stale ID Guarding: Failed draft stops on Step 4, clears transformationId, cannot use previous ID', async () => {
    // Simulate draft creation failure
    mockTransformationHandler = (req, res) => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Database connection error during draft insert'
      }));
    };

    let summarizeWasCalled = false;
    mockSummarizeHandler = (req, res) => {
      summarizeWasCalled = true;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: 'dummy', variants: ['A', 'B'] }));
    };

    const page = await setupPage();

    // Set a pre-existing transformation ID into state (simulating leftover state from previous action)
    await page.evaluate(() => {
      state.transformationId = 'trans-stale-PREVIOUS-999';
    });

    await fillNewStoryUpToStep4(page, 'Customer words entered for story that will fail draft creation.', 'Failure Case User');

    // Click Next on Step 4
    await page.click('#btn-next-4');

    // Give time for fetch rejection handling
    await page.waitForFunction(() => {
      const btn = document.getElementById('btn-next-4');
      return !btn.disabled;
    });

    // Verify UI state:
    // 1. Must stay on Step 4
    const step4Active = await page.$eval('#step-4', el => el.classList.contains('active'));
    const step5Active = await page.$eval('#step-5', el => el.classList.contains('active'));
    assert.ok(step4Active, 'Step 4 remains active');
    assert.ok(!step5Active, 'Step 5 is NOT active');

    // 2. Alert displays the failure
    const alertText = await page.$eval('#global-alert', el => el.textContent);
    assert.match(alertText, /Database connection error during draft insert/);

    // 3. Summarize must NOT have been called
    assert.equal(summarizeWasCalled, false, 'Summarize was never called after draft failure');

    // 4. state.transformationId must be null (stale ID cleared, cannot continue using old ID)
    const currentTransId = await page.evaluate(() => state.transformationId);
    assert.equal(currentTransId, null, 'state.transformationId was cleared and is null');

    await page.close();
  });
});
