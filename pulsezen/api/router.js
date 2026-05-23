import fs from 'fs';
import path from 'path';

const CENTER_MAP = {
  'dharanis':  'dharanis.html',
  'bksprime':  'bks-prime.html',
  'bks-prime': 'bks-prime.html',
};

export default function handler(req, res) {
  const host = (req.headers.host || '').toLowerCase();
  const sub  = host.split('.')[0];
  const file = CENTER_MAP[sub] || 'index.html';

  try {
    const html = fs.readFileSync(path.join(process.cwd(), file), 'utf-8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(html);
  } catch {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf-8'));
  }
}
