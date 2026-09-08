import { verifyOwnerSession } from './_session.js';

export const BANNED_TERMS = [
  'cure', 'cured', 'cures', 'curing',
  'treat', 'treated', 'treats', 'treating', 'treatment',
  'heal', 'healed', 'heals', 'healing',
  'reverse', 'reversed', 'reverses', 'reversing',
  'medicine', 'medicines', 'medication', 'medications', 'medical',
  'doctor', 'doctors', 'prescription', 'prescriptions',
  'diabetes-free', 'disease-free', 'remedy', 'remedies', 'pharmaceutical'
];

export function findBannedTerms(text) {
  if (!text || typeof text !== 'string') return [];
  const normalized = text.toLowerCase();
  const hits = [];

  for (const term of BANNED_TERMS) {
    const regex = new RegExp(`\\b${term}\\b`, 'i');
    if (regex.test(normalized)) {
      hits.push(term);
    }
  }

  return [...new Set(hits)];
}

export function parseCookies(req) {
  const header = req.headers?.cookie || req.headers?.Cookie || '';
  if (!header) return {};
  const cookies = {};
  header.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      cookies[key] = decodeURIComponent(val);
    }
  });
  return cookies;
}

export function getOwnerSession(req) {
  const cookies = parseCookies(req);
  const token = cookies.pz_owner_session;
  if (!token) return null;

  try {
    const session = verifyOwnerSession(token);
    if (!session || !session.center_id || session.typ !== 'owner') {
      return null;
    }
    return session;
  } catch (err) {
    return null;
  }
}

export function getSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL || 'https://erteibdxzdvsaujptxsd.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { supabaseUrl, serviceKey };
}
