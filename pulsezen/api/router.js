import fs from 'fs';
import path from 'path';

// Hardcoded legacy centers with their own HTML files (photos/stories)
const LEGACY_MAP = {
  'dharanis':  'dharanis.html',
  'bksprime':  'bks-prime.html',
  'bks-prime': 'bks-prime.html',
};

// Known non-center subdomains that serve the main site
const MAIN_HOSTS = ['www', 'pulsezen', 'app', ''];

export default function handler(req, res) {
  const host = (req.headers.host || '').toLowerCase();
  const sub  = host.split('.')[0];

  let file;
  if (LEGACY_MAP[sub]) {
    // Legacy center with its own HTML file
    file = LEGACY_MAP[sub];
  } else if (MAIN_HOSTS.includes(sub)) {
    // Main marketing site
    file = 'index.html';
  } else {
    // Any other subdomain → dynamic center template (fetches from Supabase)
    file = 'center.html';
  }

  try {
    const html = fs.readFileSync(path.join(process.cwd(), file), 'utf-8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(html);
  } catch {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf-8'));
  }
}
