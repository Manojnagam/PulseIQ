const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

async function captureScreenshots() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const artifactDir = 'C:\\Users\\nagam\\.gemini\\antigravity-cli\\brain\\fa9e9589-0cdf-47a0-bbd8-90d401653236';
  
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const fileUrl = 'file:///' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');

  const viewports = [
    { name: '360px', width: 360, height: 800 },
    { name: '390px', width: 390, height: 844 },
    { name: '412px', width: 412, height: 915 },
    { name: '480px', width: 480, height: 800 }
  ];

  for (const vp of viewports) {
    console.log(`\nCapturing mobile screenshots for ${vp.name}...`);
    await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36');
    
    await page.goto(fileUrl, { waitUntil: 'load' });

    // Initialize mock DOM data
    await page.evaluate(() => {
      const loader = document.getElementById('app-loading');
      if (loader) loader.style.display = 'none';
      const setup = document.getElementById('setup');
      if (setup) setup.style.display = 'none';
      const app = document.getElementById('app');
      if (app) app.style.display = 'block';

      window.D = {
        customers: [
          { id: '1', name: 'Rohan Verma', status: 'active', start_date: '2026-01-01', phone: '9876543210', total_paid: 5000 },
          { id: '2', name: 'Anita Roy', status: 'active', start_date: '2026-02-01', phone: '9876543211', total_paid: 7500 }
        ],
        attendance: [{ customer_id: '1', date: '2026-07-29', status: 'present' }],
        finance: [{ amount: 5000, type: 'income', date: '2026-07-29', category: 'Wellness Package' }],
        coaches: [{ id: 'ch1', name: 'Siddharth Rao', herbalife_pin: 'Millionaire Team' }],
        centers: [{ id: 'ctr1', name: 'Hyderabad Central' }],
        inventory: [{ id: 'p1', name: 'Formula 1 Shake', stock_quantity: 15 }],
        body: [],
        expenses: []
      };

      if (typeof window.renderOverview === 'function') window.renderOverview();
      if (typeof window.renderCustomers === 'function') window.renderCustomers();
      if (typeof window.renderAnalytics === 'function') window.renderAnalytics();
      if (typeof window.PulseIQ_BI !== 'undefined' && typeof window.PulseIQ_BI.runAnalysis === 'function') {
        window.PulseIQ_BI.runAnalysis(window.D);
      }
    });

    // 1. Dashboard Screenshot
    await page.evaluate(() => { if (typeof goTo === 'function') goTo('overview'); });
    await page.screenshot({ path: path.join(artifactDir, `mobile_dashboard_${vp.name}.png`), fullPage: false });

    // 2. Customers Screenshot
    await page.evaluate(() => { if (typeof goTo === 'function') goTo('customers'); });
    await page.screenshot({ path: path.join(artifactDir, `mobile_customers_${vp.name}.png`), fullPage: false });

    // 3. Reports / Analytics Screenshot
    await page.evaluate(() => { if (typeof goTo === 'function') goTo('analytics'); });
    await page.screenshot({ path: path.join(artifactDir, `mobile_reports_${vp.name}.png`), fullPage: false });

    // 4. AI Summary Screenshot
    await page.evaluate(() => { if (typeof goTo === 'function') goTo('bizanalyst'); });
    await page.screenshot({ path: path.join(artifactDir, `mobile_ai_summary_${vp.name}.png`), fullPage: false });

    // 5. Navigation Sidebar Open Screenshot
    await page.evaluate(() => {
      const sb = document.getElementById('sidebar');
      const sbo = document.getElementById('sb-overlay');
      if (sb) sb.classList.add('open');
      if (sbo) sbo.classList.add('open');
    });
    await page.screenshot({ path: path.join(artifactDir, `mobile_navigation_${vp.name}.png`), fullPage: false });
  }

  await browser.close();
  console.log('\nAll mobile screenshots captured successfully!');
}

captureScreenshots().catch(err => console.error(err));
