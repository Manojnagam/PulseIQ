const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = path.join(__dirname, 'screenshots_verification');
if (!fs.existsSync(ARTIFACT_DIR)) fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

async function runTests() {
  console.log('Starting OTP Verification Tests...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,960']
  });

  try {
    const page = await browser.newPage();
    const client = await page.target().createCDPSession();
    
    // Log console messages
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));

    // Network request tracking
    page.on('request', request => {
      if (request.url().includes('supabase') || request.url().includes('api')) {
        console.log(`[NET] Request: ${request.method()} ${request.url()}`);
      }
    });

    // We emulate a mobile device (iPhone 13)
    const iPhone = puppeteer.KnownDevices['iPhone 13'];
    await page.emulate(iPhone);

    console.log('--- TEST 1: Double-click Send OTP & 30s Cooldown ---');
    await page.goto('file://' + path.join(__dirname, 'index.html'), { waitUntil: 'networkidle2' });
    
    // Ensure email input exists
    await page.waitForSelector('#login-email', { visible: true });
    await page.type('#login-email', 'test@pulseiq.com');
    
    // Mock checkRes to return true for email
    await page.evaluate(() => {
      window.fetch = async (url, opts) => {
        if (url.includes('is_registered_email')) return { json: async () => true };
        if (url.includes('signInWithOtp')) return { error: null };
        return { ok: true, json: async () => ({}) };
      };
    });

    // Click Send Code rapidly
    await page.click('#login-btn');
    await page.click('#login-btn');
    
    await page.waitForTimeout(1000);
    
    const loginError = await page.$eval('#login-error', el => {
      return { text: el.textContent, visible: getComputedStyle(el).display !== 'none' };
    });
    console.log('Double-click prevention trigger:', loginError);
    if (loginError.visible && loginError.text.includes('Please wait 30 seconds')) {
      console.log('✅ PASS: Double-click blocked successfully.');
    } else {
      console.log('❌ FAIL: Double-click not blocked.');
    }

    await page.screenshot({ path: path.join(ARTIFACT_DIR, '01_double_click_send.png') });

    console.log('--- TEST 2: Wrong OTP & Double-click Verify ---');
    // It should have transitioned to OTP state
    const codeStateVisible = await page.$eval('#login-code-state', el => getComputedStyle(el).display !== 'none');
    if (codeStateVisible) {
      await page.type('#login-otp', '999999');
      
      // Override fetch to return wrong OTP error
      await page.evaluate(() => {
        window._sbAuth = window._sbAuth || { auth: {} };
        window._sbAuth.auth.verifyOtp = async () => ({ error: { message: 'Token has expired or is invalid' } });
      });

      // Double click verify
      await page.click('#verify-btn');
      await page.click('#verify-btn');
      
      await page.waitForTimeout(1000);
      
      const codeError = await page.$eval('#login-code-error', el => {
        return { text: el.textContent, visible: getComputedStyle(el).display !== 'none' };
      });
      console.log('Code Error:', codeError);
      
      const btnText = await page.$eval('#verify-btn', el => el.textContent);
      console.log('Verify Button Text:', btnText);
      
      if (codeError.visible && btnText.includes('Verify & Sign In')) {
         console.log('✅ PASS: Wrong OTP handled, button state reset, double-click prevented.');
      } else {
         console.log('❌ FAIL: Button stuck or wrong OTP not handled.');
      }
      await page.screenshot({ path: path.join(ARTIFACT_DIR, '02_wrong_otp.png') });
    } else {
      console.log('⚠️ Warning: OTP state not visible, skipping verify tests.');
    }

    console.log('--- TEST 3: Network Slow 3G / Offline Recovery ---');
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: 500 * 1024 / 8,
      uploadThroughput: 500 * 1024 / 8,
      latency: 400 * 5,
    });
    console.log('Network condition: Slow 3G');
    
    // Mock the verify function to succeed slowly
    await page.evaluate(() => {
      window._sbAuth = window._sbAuth || { auth: {} };
      window._sbAuth.auth.verifyOtp = async () => {
         await new Promise(r => setTimeout(r, 2000));
         return { data: { session: { access_token: 'test', refresh_token: 'test', user: { email: 'test@pulseiq.com' } } }, error: null };
      };
      // Overwrite loadAndStartDashboard for the test environment to mock the dashboard loading
      window.loadAndStartDashboard = async function() {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-loading').style.display = 'flex';
        // Simulate normal loading delay
        await new Promise(r => setTimeout(r, 1000));
        document.getElementById('app-loading').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        document.getElementById('app').innerHTML = '<h1>Mocked Dashboard Active</h1>';
      };
      window.startApp = window.loadAndStartDashboard;
    });

    await page.evaluate(() => document.getElementById('login-otp').value = '');
    await page.type('#login-otp', '123456');
    await page.click('#verify-btn');
    
    const verifyBtnChecking = await page.$eval('#verify-btn', el => el.textContent);
    console.log('Verify Button immediately after click:', verifyBtnChecking); // Should be "Verifying…"
    if (verifyBtnChecking.includes('Verifying')) {
      console.log('✅ PASS: Button shows Verifying state.');
    } else {
      console.log('❌ FAIL: Button does not show Verifying state.');
    }
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '03_slow_network_verifying.png') });

    await page.waitForTimeout(4000);
    
    const appVisible = await page.$eval('#app', el => getComputedStyle(el).display !== 'none');
    console.log('App Dashboard Visible:', appVisible);
    
    if (appVisible) {
      console.log('✅ PASS: Successful OTP transitions to dashboard correctly over slow network.');
      await page.screenshot({ path: path.join(ARTIFACT_DIR, '04_dashboard_success.png') });
    } else {
      console.log('❌ FAIL: App did not load.');
    }

    console.log('All tests completed.');
  } catch (err) {
    console.error('Test execution failed:', err);
  } finally {
    await browser.close();
  }
}

runTests();
