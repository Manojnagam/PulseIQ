const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

async function auditTargetBanners() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const artifactDir = 'C:\\Users\\nagam\\.gemini\\antigravity-cli\\brain\\fa9e9589-0cdf-47a0-bbd8-90d401653236';

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36');
  
  await page.goto('https://app.pulsezen.in', { waitUntil: 'networkidle2' });

  const audit = await page.evaluate(() => {
    const login = document.getElementById('login-screen'); if (login) login.style.display = 'none';
    const loader = document.getElementById('app-loading'); if (loader) loader.style.display = 'none';
    const tmpl = document.getElementById('dashboard-template');
    if (tmpl && !document.getElementById('app')) document.body.appendChild(tmpl.content.cloneNode(true));
    const setup = document.getElementById('setup'); if (setup) setup.style.display = 'none';
    const app = document.getElementById('app'); if (app) app.style.display = 'block';

    // Mock data with 35 leads to trigger the exact "35 overdue follow-ups" and "Untouched Lead Potential" banner
    window.D = {
      customers: [{ id: '1', name: 'Rohan Verma', status: 'active', start_date: '2026-01-01' }],
      attendance: [{ customer_id: '1', date: '2026-07-29', status: 'present' }],
      finance: [{ amount: 5000, type: 'income', date: '2026-07-29' }],
      coaches: [{ id: 'ch1', name: 'Siddharth Rao' }],
      centers: [{ id: 'ctr1', name: 'Test Center' }],
      leads: Array.from({ length: 35 }, (_, i) => ({ id: 'l' + i, status: 'new', created_at: '2026-07-01' })),
      inventory: [], body: [], expenses: []
    };

    if (typeof window.renderOverview === 'function') window.renderOverview();

    // Find element containing "Untouched Lead" text
    const allEls = Array.from(document.querySelectorAll('*'));
    const untouchedEl = allEls.find(el => el.children.length === 0 && el.textContent.includes('Untouched Lead'));

    if (!untouchedEl) {
      return { error: 'Could not find element containing "Untouched Lead"' };
    }

    const parent = untouchedEl.parentElement;
    const grandparent = parent ? parent.parentElement : null;
    const container = grandparent ? grandparent.parentElement : null;

    function inspect(el) {
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const st = window.getComputedStyle(el);
      return {
        tagName: el.tagName,
        id: el.id,
        className: el.className,
        styleAttr: el.getAttribute('style'),
        outerHTML: el.outerHTML,
        rect: {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          left: Math.round(rect.left),
          right: Math.round(rect.right)
        },
        computed: {
          display: st.display,
          position: st.position,
          width: st.width,
          height: st.height,
          flexDirection: st.flexDirection,
          justifyContent: st.justifyContent,
          alignItems: st.alignItems,
          flex: st.flex,
          flexBasis: st.flexBasis,
          maxWidth: st.maxWidth,
          minWidth: st.minWidth,
          transform: st.transform,
          overflow: st.overflow
        }
      };
    }

    // Inspect overdue leads banner, trial banner, and revenue banner
    const overdueBanner = document.getElementById('overdue-leads-banner');
    const trialBanner = document.getElementById('trial-countdown-banner');
    const leadsBanner = document.getElementById('leads-revenue-banner');

    return {
      untouchedElement: inspect(untouchedEl),
      parent: inspect(parent),
      grandparent: inspect(grandparent),
      container: inspect(container),
      overdueBanner: inspect(overdueBanner),
      trialBanner: inspect(trialBanner),
      leadsBanner: inspect(leadsBanner)
    };
  });

  console.log('\n=================== UNTOUCHED LEAD BANNER DEEP AUDIT ===================');
  console.log(JSON.stringify(audit, null, 2));

  await page.screenshot({ path: path.join(artifactDir, 'untouched_lead_banner_audit.png'), fullPage: false });
  await browser.close();
}

auditTargetBanners().catch(console.error);
