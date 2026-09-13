import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import test from 'node:test';
import { signOwnerSession } from './pulsezen_candidate_v2/api/_session.js';

const PORT = 9991;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const centerId = '2c1c3a6e-35b4-4e30-bbae-a0cf02d8dd7a';
const secret = 'test-secret-must-be-32-chars-long-123456';
process.env.OWNER_SESSION_SECRET = secret;

const sessionCookie = signOwnerSession({
  userId: 'usr-1',
  center_id: centerId,
  email: 'owner@pulsezen.in',
  typ: 'owner'
});

let mockSummarizeHandler = null;
let lastSavedSummary = null;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, BASE_URL);

  let bodyStr = '';
  req.on('data', chunk => bodyStr += chunk);
  req.on('end', () => {
    // Static HTML
    if (url.pathname === '/owner' || url.pathname === '/owner.html') {
      const html = fs.readFileSync(path.resolve('pulsezen_candidate_v2/owner.html'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    }

    if (url.pathname === '/api/owner/list') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        center: { id: centerId, name: "Dharani's Wellness Centre" },
        transformations: [
          {
            id: 'trans-123',
            customer_name: 'Pooja Reddy',
            customer_words: 'I joined the wellness program and lost 5.5 kg in 10 weeks.',
            status: 'draft',
            ai_summary: null,
            duration_weeks: 10,
            start_weight_kg: 68.5,
            end_weight_kg: 63.0,
            health_issue: 'Low energy'
          }
        ]
      }));
    }

    if (url.pathname === '/api/owner/summarize') {
      return mockSummarizeHandler(req, res, JSON.parse(bodyStr || '{}'));
    }

    if (url.pathname === '/api/owner/summary-select') {
      const payload = JSON.parse(bodyStr || '{}');
      lastSavedSummary = payload.text;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, ai_summary: payload.text }));
    }

    if (url.pathname === '/api/owner/transformation') {
      res.writeHead(201, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        id: 'trans-new-456',
        row: {
          id: 'trans-new-456',
          customer_name: 'Test Customer',
          customer_words: 'Lost weight and feeling energetic.'
        }
      }));
    }

    res.writeHead(404);
    res.end();
  });
});

test('Step 5 Variant Rendering, Selection, Textarea State, and Error Handling', async (t) => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
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

  await t.test('1. Valid Variants: Both variants render, are selectable, and populate textarea', async () => {
    mockSummarizeHandler = (req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        id: 'trans-123',
        variants: [
          'Routine and energy improved with coaching.',
          'Consistent habits helped me feel lighter and active.'
        ]
      }));
    };

    const page = await setupPage();
    await page.evaluate(async () => {
      await handleReopenReview({
        id: 'trans-123',
        customer_name: 'Pooja Reddy',
        customer_words: 'Lost 5.5 kg in 10 weeks.',
        status: 'draft',
        ai_summary: null
      });
    });

    await page.waitForSelector('#step-5.active');

    const v1Display = await page.$eval('#card-v1', el => getComputedStyle(el).display);
    const v2Display = await page.$eval('#card-v2', el => getComputedStyle(el).display);
    const v1Text = await page.$eval('#text-v1', el => el.textContent.trim());
    const v2Text = await page.$eval('#text-v2', el => el.textContent.trim());
    const initialChosen = await page.$eval('#chosen-text', el => el.value.trim());

    assert.equal(v1Display, 'block', 'Variant A card visible');
    assert.equal(v2Display, 'block', 'Variant B card visible');
    assert.equal(v1Text, 'Routine and energy improved with coaching.');
    assert.equal(v2Text, 'Consistent habits helped me feel lighter and active.');
    assert.equal(initialChosen, v1Text, 'Variant A selected by default');

    // Click Variant B
    await page.click('#card-v2');
    const chosenAfterB = await page.$eval('#chosen-text', el => el.value.trim());
    assert.equal(chosenAfterB, v2Text, 'Variant B text populated into textarea');

    // Click Next
    lastSavedSummary = null;
    await page.click('#btn-next-5');
    await page.waitForSelector('#step-6.active');
    assert.equal(lastSavedSummary, v2Text, 'Saved summary matches Variant B');

    await page.close();
  });

  await t.test('2. Partial Variants: Empty Variant B is not selectable and does not wipe textarea', async () => {
    mockSummarizeHandler = (req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        id: 'trans-123',
        variants: [
          'Routine and energy improved with coaching.',
          ''
        ]
      }));
    };

    const page = await setupPage();
    await page.evaluate(async () => {
      await handleReopenReview({
        id: 'trans-123',
        customer_name: 'Pooja Reddy',
        customer_words: 'Lost 5.5 kg in 10 weeks.',
        status: 'draft',
        ai_summary: null
      });
    });

    await page.waitForSelector('#step-5.active');

    const v1Display = await page.$eval('#card-v1', el => getComputedStyle(el).display);
    const v2Display = await page.$eval('#card-v2', el => getComputedStyle(el).display);
    const chosenText = await page.$eval('#chosen-text', el => el.value.trim());

    assert.equal(v1Display, 'block', 'Variant A card visible');
    assert.equal(v2Display, 'none', 'Empty Variant B card must NOT appear selectable (hidden)');
    assert.equal(chosenText, 'Routine and energy improved with coaching.');

    // Attempting to select variant 1 programmatically must NOT wipe textarea
    await page.evaluate(() => { selectVariant(1); });
    const chosenAfterAttempt = await page.$eval('#chosen-text', el => el.value.trim());
    assert.equal(chosenAfterAttempt, 'Routine and energy improved with coaching.', 'Textarea not wiped out');

    // Click Next
    lastSavedSummary = null;
    await page.click('#btn-next-5');
    await page.waitForSelector('#step-6.active');
    assert.equal(lastSavedSummary, 'Routine and energy improved with coaching.');

    await page.close();
  });

  await t.test('3. Empty Variants Response ["", ""]: Neither card selectable, clear notice shown, manual entry works', async () => {
    mockSummarizeHandler = (req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        id: 'trans-123',
        variants: ['', '']
      }));
    };

    const page = await setupPage();
    await page.evaluate(async () => {
      await handleReopenReview({
        id: 'trans-123',
        customer_name: 'Pooja Reddy',
        customer_words: 'Lost 5.5 kg in 10 weeks.',
        status: 'draft',
        ai_summary: null
      });
    });

    await page.waitForSelector('#step-5.active');

    const v1Display = await page.$eval('#card-v1', el => getComputedStyle(el).display);
    const v2Display = await page.$eval('#card-v2', el => getComputedStyle(el).display);

    assert.equal(v1Display, 'none', 'Variant A card must not appear selectable');
    assert.equal(v2Display, 'none', 'Variant B card must not appear selectable');

    // Type manual summary
    await page.focus('#chosen-text');
    await page.keyboard.type('My custom clean testimonial entered manually.');

    // Click Next
    lastSavedSummary = null;
    await page.click('#btn-next-5');
    await page.waitForSelector('#step-6.active');
    assert.equal(lastSavedSummary, 'My custom clean testimonial entered manually.');

    await page.close();
  });

  await t.test('4. Malformed Response (null variants / empty object): Fallback / manual entry works', async () => {
    mockSummarizeHandler = (req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: 'trans-123', variants: null }));
    };

    const page = await setupPage();
    await page.evaluate(async () => {
      await handleReopenReview({
        id: 'trans-123',
        customer_name: 'Pooja Reddy',
        customer_words: 'Lost 5.5 kg in 10 weeks.',
        status: 'draft',
        ai_summary: null
      });
    });

    await page.waitForSelector('#step-5.active');

    const v1Display = await page.$eval('#card-v1', el => getComputedStyle(el).display);
    const v2Display = await page.$eval('#card-v2', el => getComputedStyle(el).display);

    assert.equal(v1Display, 'none', 'Variant A card hidden on malformed response');
    assert.equal(v2Display, 'none', 'Variant B card hidden on malformed response');

    // Type clean summary
    await page.$eval('#chosen-text', el => el.value = '');
    await page.type('#chosen-text', 'Manual summary for malformed response test.');

    lastSavedSummary = null;
    await page.click('#btn-next-5');
    await page.waitForSelector('#step-6.active');
    assert.equal(lastSavedSummary, 'Manual summary for malformed response test.');

    await page.close();
  });

  await t.test('5. API Failure (HTTP 500): Shows clear message, neither card selectable, allows manual entry', async () => {
    mockSummarizeHandler = (req, res) => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error', details: 'Groq API timeout' }));
    };

    const page = await setupPage();
    await page.evaluate(async () => {
      await handleReopenReview({
        id: 'trans-123',
        customer_name: 'Pooja Reddy',
        customer_words: 'Lost 5.5 kg in 10 weeks.',
        status: 'draft',
        ai_summary: null
      });
    });

    await page.waitForSelector('#step-5.active');

    const v1Display = await page.$eval('#card-v1', el => getComputedStyle(el).display);
    const v2Display = await page.$eval('#card-v2', el => getComputedStyle(el).display);
    const alertText = await page.$eval('#global-alert', el => el.textContent);
    const alertDisplay = await page.$eval('#global-alert', el => getComputedStyle(el).display);

    assert.equal(v1Display, 'none', 'Variant A card hidden on API failure');
    assert.equal(v2Display, 'none', 'Variant B card hidden on API failure');
    assert.equal(alertDisplay, 'block', 'Clear alert notice displayed');
    assert.match(alertText, /AI service notice|AI summary/i, 'Alert contains informative message');

    // Type clean summary
    await page.$eval('#chosen-text', el => el.value = '');
    await page.type('#chosen-text', 'Clean manual summary after API failure.');

    lastSavedSummary = null;
    await page.click('#btn-next-5');
    await page.waitForSelector('#step-6.active');
    assert.equal(lastSavedSummary, 'Clean manual summary after API failure.');

    await page.close();
  });

  await t.test('6. Malformed Collection: string ("just a string") rejected, cards hidden, manual entry works', async () => {
    mockSummarizeHandler = (req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: 'trans-123', variants: 'just a string' }));
    };

    const page = await setupPage();
    await page.evaluate(async () => {
      await handleReopenReview({
        id: 'trans-123',
        customer_name: 'Pooja Reddy',
        customer_words: 'Lost 5.5 kg in 10 weeks.',
        status: 'draft',
        ai_summary: null
      });
    });

    await page.waitForSelector('#step-5.active');
    const v1Display = await page.$eval('#card-v1', el => getComputedStyle(el).display);
    const v2Display = await page.$eval('#card-v2', el => getComputedStyle(el).display);
    assert.equal(v1Display, 'none', 'Variant A hidden when variants is a string');
    assert.equal(v2Display, 'none', 'Variant B hidden when variants is a string');

    await page.focus('#chosen-text');
    await page.keyboard.type('Manual entry when variants was a string.');
    lastSavedSummary = null;
    await page.click('#btn-next-5');
    await page.waitForSelector('#step-6.active');
    assert.equal(lastSavedSummary, 'Manual entry when variants was a string.');
    await page.close();
  });

  await t.test('7. Malformed Collection: object ({ 0: "obj text" }) rejected, cards hidden, manual entry works', async () => {
    mockSummarizeHandler = (req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: 'trans-123', variants: { 0: 'obj text', 1: 'another text' } }));
    };

    const page = await setupPage();
    await page.evaluate(async () => {
      await handleReopenReview({
        id: 'trans-123',
        customer_name: 'Pooja Reddy',
        customer_words: 'Lost 5.5 kg in 10 weeks.',
        status: 'draft',
        ai_summary: null
      });
    });

    await page.waitForSelector('#step-5.active');
    const v1Display = await page.$eval('#card-v1', el => getComputedStyle(el).display);
    const v2Display = await page.$eval('#card-v2', el => getComputedStyle(el).display);
    assert.equal(v1Display, 'none', 'Variant A hidden when variants is an object');
    assert.equal(v2Display, 'none', 'Variant B hidden when variants is an object');

    await page.focus('#chosen-text');
    await page.keyboard.type('Manual entry when variants was an object.');
    lastSavedSummary = null;
    await page.click('#btn-next-5');
    await page.waitForSelector('#step-6.active');
    assert.equal(lastSavedSummary, 'Manual entry when variants was an object.');
    await page.close();
  });

  await t.test('8. Malformed Entries: pure whitespace entries (["   ", "\\t\\n  "]) rejected, cards hidden, manual entry works', async () => {
    mockSummarizeHandler = (req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: 'trans-123', variants: ['   ', '\t\n  '] }));
    };

    const page = await setupPage();
    await page.evaluate(async () => {
      await handleReopenReview({
        id: 'trans-123',
        customer_name: 'Pooja Reddy',
        customer_words: 'Lost 5.5 kg in 10 weeks.',
        status: 'draft',
        ai_summary: null
      });
    });

    await page.waitForSelector('#step-5.active');
    const v1Display = await page.$eval('#card-v1', el => getComputedStyle(el).display);
    const v2Display = await page.$eval('#card-v2', el => getComputedStyle(el).display);
    assert.equal(v1Display, 'none', 'Variant A hidden when entries are whitespace');
    assert.equal(v2Display, 'none', 'Variant B hidden when entries are whitespace');

    await page.focus('#chosen-text');
    await page.keyboard.type('Manual entry when entries were pure whitespace.');
    lastSavedSummary = null;
    await page.click('#btn-next-5');
    await page.waitForSelector('#step-6.active');
    assert.equal(lastSavedSummary, 'Manual entry when entries were pure whitespace.');
    await page.close();
  });

  await t.test('9. Malformed Entries: non-string entries ([123, {text: "hi"}, null, true]) rejected, cards hidden, manual entry works', async () => {
    mockSummarizeHandler = (req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: 'trans-123', variants: [123, { text: 'hi' }, null, true] }));
    };

    const page = await setupPage();
    await page.evaluate(async () => {
      await handleReopenReview({
        id: 'trans-123',
        customer_name: 'Pooja Reddy',
        customer_words: 'Lost 5.5 kg in 10 weeks.',
        status: 'draft',
        ai_summary: null
      });
    });

    await page.waitForSelector('#step-5.active');
    const v1Display = await page.$eval('#card-v1', el => getComputedStyle(el).display);
    const v2Display = await page.$eval('#card-v2', el => getComputedStyle(el).display);
    assert.equal(v1Display, 'none', 'Variant A hidden for non-string entries');
    assert.equal(v2Display, 'none', 'Variant B hidden for non-string entries');

    await page.focus('#chosen-text');
    await page.keyboard.type('Manual entry when entries were non-strings.');
    lastSavedSummary = null;
    await page.click('#btn-next-5');
    await page.waitForSelector('#step-6.active');
    assert.equal(lastSavedSummary, 'Manual entry when entries were non-strings.');
    await page.close();
  });

  await t.test('10. Mixed Collection: 1 valid string + non-string/whitespace retains valid variant and hides second card', async () => {
    mockSummarizeHandler = (req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: 'trans-123', variants: ['Clean active lifestyle.', null, 456, '   '] }));
    };

    const page = await setupPage();
    await page.evaluate(async () => {
      await handleReopenReview({
        id: 'trans-123',
        customer_name: 'Pooja Reddy',
        customer_words: 'Lost 5.5 kg in 10 weeks.',
        status: 'draft',
        ai_summary: null
      });
    });

    await page.waitForSelector('#step-5.active');
    const v1Display = await page.$eval('#card-v1', el => getComputedStyle(el).display);
    const v2Display = await page.$eval('#card-v2', el => getComputedStyle(el).display);
    const v1Text = await page.$eval('#text-v1', el => el.textContent.trim());
    const chosenVal = await page.$eval('#chosen-text', el => el.value.trim());

    assert.equal(v1Display, 'block', 'Variant A is visible for valid entry');
    assert.equal(v2Display, 'none', 'Variant B is hidden for non-string/whitespace');
    assert.equal(v1Text, 'Clean active lifestyle.');
    assert.equal(chosenVal, 'Clean active lifestyle.');

    lastSavedSummary = null;
    await page.click('#btn-next-5');
    await page.waitForSelector('#step-6.active');
    assert.equal(lastSavedSummary, 'Clean active lifestyle.');
    await page.close();
  });

  await browser.close();
  server.close();
});
