import { verifySession } from '../_session.js';

export const BANNED_TERMS = [
  'cure', 'cured', 'cures',
  'treat', 'treats',
  'heal', 'heals',
  'reverse', 'reversed',
  'medicine', 'medical',
  'doctor',
  'prescription',
  'diabetes-free', 'disease-free'
];

// Regex matching banned words with word boundaries
const BANNED_REGEX = new RegExp(
  '\\b(' + BANNED_TERMS.map(t => t.replace('-', '[-\\s]')).join('|') + ')\\b',
  'i'
);

export function findBannedTerms(text) {
  if (!text || typeof text !== 'string') return [];
  const lower = text.toLowerCase();
  const hits = [];
  for (const term of BANNED_TERMS) {
    const termRegex = new RegExp('\\b' + term.replace('-', '[-\\s]') + '\\b', 'i');
    if (termRegex.test(lower)) {
      hits.push(term);
    }
  }
  return hits;
}

export function parseCookies(req) {
  const header = req.headers && req.headers.cookie;
  if (!header) return {};
  const cookies = {};
  header.split(';').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx > -1) {
      const key = pair.slice(0, idx).trim();
      const val = pair.slice(idx + 1).trim();
      try {
        cookies[key] = decodeURIComponent(val);
      } catch (e) {
        cookies[key] = val;
      }
    }
  });
  return cookies;
}

export function getOwnerSession(req) {
  const cookies = parseCookies(req);
  const token = cookies['pz_owner_session']
    || req.headers['x-app-session']
    || (req.headers['authorization'] && req.headers['authorization'].replace(/^Bearer\s+/i, ''));

  if (!token) return null;

  try {
    const payload = verifySession(token);
    if (payload && payload.center_id) {
      return payload;
    }
    return null;
  } catch (err) {
    return null;
  }
}

export function getSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL || 'https://erteibdxzdvsaujptxsd.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { supabaseUrl: supabaseUrl.replace(/\/$/, ''), serviceKey };
}
