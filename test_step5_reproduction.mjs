import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { signOwnerSession } from './pulsezen_candidate_v2/api/_session.js';

const PORT = 9989;
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

let mockSummarizeResponse = {
  status: 200,
  body: { id: 'trans-123', variants: ['', ''] }
};

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

    // Mock session auth
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
      res.writeHead(mockSummarizeResponse.status, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(mockSummarizeResponse.body));
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

async function runTest() {
  await new Promise(r => server.listen(PORT, r));
  console.log('Test server running at ' + BASE_URL);

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setCookie({
    name: 'pz_owner_session',
    value: sessionCookie,
    domain: '127.0.0.1'
  });

  console.log('\n--- 1. Testing Current Behavior on Empty Variants Response ["", ""] ---');
  mockSummarizeResponse = {
    status: 200,
    body: { id: 'trans-123', variants: ['', ''] }
  };

  await page.goto(`${BASE_URL}/owner.html`);
  await page.waitForSelector('#transformations-container');

  // Trigger review on existing story
  await page.evaluate(() => {
    handleReopenReview({
      id: 'trans-123',
      customer_name: 'Pooja Reddy',
      customer_words: 'I joined the wellness program and lost 5.5 kg in 10 weeks.',
      status: 'draft',
      ai_summary: null,
      duration_weeks: 10,
      start_weight_kg: 68.5,
      end_weight_kg: 63.0,
      health_issue: 'Low energy'
    });
  });

  await page.waitForSelector('#step-5.active');

  const cardV1Text = await page.$eval('#text-v1', el => el.textContent);
  const cardV2Text = await page.$eval('#text-v2', el => el.textContent);
  const cardV1Display = await page.$eval('#card-v1', el => getComputedStyle(el).display);
  const cardV2Display = await page.$eval('#card-v2', el => getComputedStyle(el).display);
  const chosenValInitial = await page.$eval('#chosen-text', el => el.value);

  console.log('Card V1 Display:', cardV1Display, '| Text:', JSON.stringify(cardV1Text));
  console.log('Card V2 Display:', cardV2Display, '| Text:', JSON.stringify(cardV2Text));
  console.log('Initial chosen-text:', JSON.stringify(chosenValInitial));

  // Click Variant B
  await page.click('#card-v2');
  const chosenValAfterClickB = await page.$eval('#chosen-text', el => el.value);
  console.log('Chosen text after clicking Card B:', JSON.stringify(chosenValAfterClickB));

  // Click Next
  await page.click('#btn-next-5');
  const alertText = await page.$eval('#global-alert', el => el.textContent);
  const alertDisplay = await page.$eval('#global-alert', el => getComputedStyle(el).display);
  console.log('Alert text after clicking Next:', JSON.stringify(alertText), '| Display:', alertDisplay);

  await browser.close();
  server.close();
}

runTest().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
