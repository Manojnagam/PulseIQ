const puppeteer = require('puppeteer-core');
const path = require('path');

async function inspectKPI() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const fileUrl = 'file:///' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');

  const viewports = [360, 390, 412];

  for (const width of viewports) {
    await page.setViewport({ width, height: 800, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.goto(fileUrl, { waitUntil: 'load' });

    // Mount dashboard template & render overview
    const result = await page.evaluate(() => {
      const login = document.getElementById('login-screen');
      if (login) login.style.display = 'none';
      const loader = document.getElementById('app-loading');
      if (loader) loader.style.display = 'none';

      const tmpl = document.getElementById('dashboard-template');
      if (tmpl) {
        const body = document.body;
        const clone = tmpl.content.cloneNode(true);
        body.appendChild(clone);
      }

      const setup = document.getElementById('setup');
      if (setup) setup.style.display = 'none';
      const app = document.getElementById('app');
      if (app) app.style.display = 'block';

      window.D = {
        customers: [{ id: '1', name: 'Rohan Verma', status: 'active', start_date: '2026-01-01' }],
        attendance: [{ customer_id: '1', date: '2026-07-29', status: 'present' }],
        finance: [{ amount: 5000, type: 'income', date: '2026-07-29' }],
        coaches: [{ id: 'ch1', name: 'Siddharth Rao' }],
        centers: [{ id: 'ctr1', name: 'Test Center' }],
        inventory: [], body: [], expenses: []
      };

      if (typeof window.renderOverview === 'function') window.renderOverview();

      const container = document.getElementById('overview-stats') || document.querySelector('.stats');
      const card = document.querySelector('.stat');

      if (!container || !card) {
        return { error: 'No .stats or .stat element found after template render' };
      }

      const cComp = window.getComputedStyle(container);
      const kComp = window.getComputedStyle(card);

      return {
        containerID: container.id,
        containerClass: container.className,
        containerParent: container.parentElement.tagName + '.' + container.parentElement.className,
        containerComputed: {
          display: cComp.display,
          gridTemplateColumns: cComp.gridTemplateColumns,
          width: cComp.width,
          maxWidth: cComp.maxWidth,
          flexDirection: cComp.flexDirection,
          flexWrap: cComp.flexWrap,
          gap: cComp.gap
        },
        cardComputed: {
          display: kComp.display,
          width: kComp.width,
          maxWidth: kComp.maxWidth,
          minWidth: kComp.minWidth,
          flexBasis: kComp.flexBasis,
          flexGrow: kComp.flexGrow,
          flexShrink: kComp.flexShrink,
          boxSizing: kComp.boxSizing
        }
      };
    });

    console.log(`\n=================== COMPUTED STYLES AT ${width}px ===================`);
    console.log(JSON.stringify(result, null, 2));
  }

  await browser.close();
}

inspectKPI().catch(console.error);
