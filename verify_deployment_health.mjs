const checks = [
  { name: 'Homepage', url: 'https://pulsezen.in/' },
  { name: 'Owner Login', url: 'https://pulsezen.in/owner-login.html' },
  { name: 'Owner Portal', url: 'https://pulsezen.in/owner.html' },
  { name: 'Centre Dharanis', url: 'https://pulsezen.in/dharanis.html' },
  { name: 'Centre BKS Prime', url: 'https://pulsezen.in/bks-prime.html' },
  { name: 'Centre Template', url: 'https://pulsezen.in/center.html' },
  { name: 'Public API Ping (Transformations)', url: 'https://pulsezen.in/api/public?action=transformations&center_id=2c1c3a6e-35b4-4e30-bbae-a0cf02d8dd7a' },
  { name: 'Owner API Auth Guard (/api/owner/upload-url)', url: 'https://pulsezen.in/api/owner/upload-url', method: 'POST' },
  { name: 'Separate CRM (app.pulsezen.in)', url: 'https://app.pulsezen.in/' }
];

async function runChecks() {
  console.log('=== POST-DEPLOYMENT READ-ONLY CHECKS ===');
  for (const c of checks) {
    try {
      const res = await fetch(c.url, { method: c.method || 'GET' });
      const text = await res.text();
      console.log(`[HTTP ${res.status}] ${c.name.padEnd(45)} -> ${text.length} bytes received`);
    } catch (e) {
      console.log(`[FAIL] ${c.name} -> Error: ${e.message}`);
    }
  }
}

runChecks();
