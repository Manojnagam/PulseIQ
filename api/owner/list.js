import { getOwnerSession, getSupabaseConfig } from './_owner-helper.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Validate session cookie BEFORE any DB call
  const session = getOwnerSession(req);
  if (!session || !session.center_id) {
    return res.status(401).json({ error: 'Unauthorized: Valid owner session required' });
  }

  const { supabaseUrl, serviceKey } = getSupabaseConfig();
  if (!serviceKey) {
    return res.status(500).json({ error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY missing' });
  }

  try {
    // 2. Query transformations scoped to session center_id, newest first
    const listUrl = `${supabaseUrl}/rest/v1/transformations?center_id=eq.${encodeURIComponent(session.center_id)}&order=created_at.desc&select=*`;
    const sbRes = await fetch(listUrl, {
      method: 'GET',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!sbRes.ok) {
      const errText = await sbRes.text();
      return res.status(sbRes.status).json({
        error: 'Failed to fetch transformations from database',
        details: errText
      });
    }

    const rows = await sbRes.json();
    return res.status(200).json({
      center_id: session.center_id,
      count: rows.length,
      transformations: rows
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
