const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

async function captureDesktop() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const artifactDir = 'C:\\Users\\nagam\\.gemini\\antigravity-cli\\brain\\fa9e9589-0cdf-47a0-bbd8-90d401653236';
  
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const fileUrl = 'file:///' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');

  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await page.goto(fileUrl, { waitUntil: 'load' });

  await page.evaluate(() => {
    const loader = document.getElementById('app-loading');
    if (loader) loader.style.display = 'none';
    const setup = document.getElementById('setup');
    if (setup) setup.style.display = 'none';
    const app = document.getElementById('app');
    if (app) app.style.display = 'block';

    window.D = {
      customers: [{ id: '1', name: 'Rohan Verma', status: 'active', start_date: '2026-01-01', phone: '9876543210' }],
      attendance: [{ customer_id: '1', date: '2026-07-29', status: 'present' }],
      finance: [{ amount: 5000, type: 'income', date: '2026-07-29' }],
      coaches: [{ id: 'ch1', name: 'Siddharth Rao' }],
      centers: [{ id: 'ctr1', name: 'Hyderabad Central' }],
      inventory: [],
      body: [],
      expenses: []
    };

    if (typeof window.renderOverview === 'function') window.renderOverview();
  });

  await page.screenshot({ path: path.join(artifactDir, `desktop_dashboard.png`), fullPage: false });
  await browser.close();
  console.log('Desktop screenshot captured successfully!');
}

captureDesktop().catch(err => console.error(err));
