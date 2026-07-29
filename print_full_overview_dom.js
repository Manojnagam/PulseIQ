const puppeteer = require('puppeteer-core');
const path = require('path');

async function printFullDom() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const fileUrl = 'file:///' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');
  await page.goto(fileUrl, { waitUntil: 'load' });

  const tree = await page.evaluate(() => {
    const login = document.getElementById('login-screen'); if (login) login.style.display = 'none';
    const loader = document.getElementById('app-loading'); if (loader) loader.style.display = 'none';
    const tmpl = document.getElementById('dashboard-template');
    if (tmpl && !document.getElementById('app')) document.body.appendChild(tmpl.content.cloneNode(true));
    const setup = document.getElementById('setup'); if (setup) setup.style.display = 'none';
    const app = document.getElementById('app'); if (app) app.style.display = 'block';

    window.D = {
      customers: [{ id: '1', name: 'Rohan Verma', status: 'active', start_date: '2026-01-01' }],
      attendance: [{ customer_id: '1', date: '2026-07-29', status: 'present' }],
      finance: [{ amount: 5000, type: 'income', date: '2026-07-29' }],
      coaches: [{ id: 'ch1', name: 'Siddharth Rao' }],
      centers: [{ id: 'ctr1', name: 'Test Center' }],
      inventory: [], body: [], expenses: []
    };
    if (typeof window.renderOverview === 'function') window.renderOverview();

    const sec = document.getElementById('sec-overview');
    const viewW = window.innerWidth;

    function buildTree(el, depth = 0) {
      const rect = el.getBoundingClientRect();
      const st = window.getComputedStyle(el);
      const w = Math.round(rect.width);
      const pct = Math.round((w / viewW) * 100);

      const info = {
        depth,
        tag: el.tagName,
        id: el.id,
        cls: el.className,
        width: w + 'px (' + pct + '%)',
        display: st.display,
        flex: st.flex,
        gridCols: st.gridTemplateColumns,
        children: []
      };

      for (let ch of el.children) {
        info.children.push(buildTree(ch, depth + 1));
      }
      return info;
    }

    return {
      viewportWidth: viewW,
      tree: buildTree(sec)
    };
  });

  console.log('=== FULL DOM TREE OF #sec-overview ON MOBILE 390px ===');
  console.log(JSON.stringify(tree, null, 2));

  await browser.close();
}

printFullDom().catch(console.error);
