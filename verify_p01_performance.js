const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

async function runPerformanceVerification() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const artifactDir = 'C:\\Users\\nagam\\.gemini\\antigravity-cli\\brain\\fa9e9589-0cdf-47a0-bbd8-90d401653236';

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const fileUrl = 'file:///' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');
  await page.goto(fileUrl, { waitUntil: 'load' });

  // Initialize mock data
  await page.evaluate(() => {
    const login = document.getElementById('login-screen'); if (login) login.style.display = 'none';
    const loader = document.getElementById('app-loading'); if (loader) loader.style.display = 'none';
    const tmpl = document.getElementById('dashboard-template');
    if (tmpl && !document.getElementById('app')) document.body.appendChild(tmpl.content.cloneNode(true));
    const setup = document.getElementById('setup'); if (setup) setup.style.display = 'none';
    const app = document.getElementById('app'); if (app) app.style.display = 'block';

    const mockCusts = [];
    for (let i = 1; i <= 500; i++) {
      mockCusts.push({ id: 'cust_' + i, name: 'Member ' + i, status: i % 5 === 0 ? 'inactive' : 'active', start_date: '2026-01-01', phone: '9876543210' });
    }
    const mockAtt = [];
    for (let i = 1; i <= 2000; i++) {
      mockAtt.push({ customer_id: 'cust_' + (i % 500 + 1), date: '2026-07-' + String((i % 28) + 1).padStart(2, '0'), status: 'present' });
    }
    const mockFin = [];
    for (let i = 1; i <= 1000; i++) {
      mockFin.push({ amount: (i * 150) % 5000 + 500, type: i % 3 === 0 ? 'expense' : 'income', date: '2026-07-' + String((i % 28) + 1).padStart(2, '0'), category: 'Wellness Package' });
    }

    window.D = {
      customers: mockCusts,
      attendance: mockAtt,
      finance: mockFin,
      coaches: [{ id: 'ch1', name: 'Siddharth Rao' }, { id: 'ch2', name: 'Priya Sharma' }],
      centers: [{ id: 'ctr1', name: 'Hyderabad Central' }],
      inventory: Array.from({ length: 50 }, (_, i) => ({ id: 'p' + i, name: 'Product ' + i, stock_quantity: 10 })),
      body: [],
      expenses: []
    };

    if (typeof window.renderOverview === 'function') window.renderOverview();
  });

  console.log('Testing Phase P0.1 Tab Switching Performance...');

  const domNodesBefore = await page.evaluate(() => document.getElementsByTagName('*').length);

  // 1st Pass: First Render for all major tabs
  const tabs = ['overview', 'customers', 'attendance', 'payments', 'leads', 'analytics', 'bizanalyst', 'coaches', 'reports'];
  const firstRenderMetrics = {};

  for (const tab of tabs) {
    const start = Date.now();
    await page.evaluate((t) => {
      const btn = document.querySelector(`[onclick*="${t}"]`);
      if (typeof goTo === 'function') goTo(t, btn);
    }, tab);
    const duration = Date.now() - start;
    firstRenderMetrics[tab] = duration;
  }

  // 2nd Pass: Cached Render for all major tabs (State Retention)
  const cachedRenderMetrics = {};
  for (const tab of tabs) {
    const start = Date.now();
    await page.evaluate((t) => {
      const btn = document.querySelector(`[onclick*="${t}"]`);
      if (typeof goTo === 'function') goTo(t, btn);
    }, tab);
    const duration = Date.now() - start;
    cachedRenderMetrics[tab] = duration;
  }

  const domNodesAfter = await page.evaluate(() => document.getElementsByTagName('*').length);
  const perfInstrumentation = await page.evaluate(() => window._tabPerfMetrics || {});

  const verificationSummary = {
    domNodeCountBefore: domNodesBefore,
    domNodeCountAfter: domNodesAfter,
    tabsTested: tabs.length,
    firstPassDurationsMs: firstRenderMetrics,
    cachedPassDurationsMs: cachedRenderMetrics,
    internalPerfMetrics: perfInstrumentation
  };

  console.log('\n================ PHASE P0.1 PERFORMANCE VERIFICATION ================');
  console.log(JSON.stringify(verificationSummary, null, 2));

  fs.writeFileSync(path.join(artifactDir, 'p01_performance_verification.json'), JSON.stringify(verificationSummary, null, 2));

  await browser.close();
}

runPerformanceVerification().catch(console.error);
