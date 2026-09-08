import { getOwnerSession, getSupabaseConfig } from '../_owner-helper.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Validate session cookie BEFORE any DB call
  const session = getOwnerSession(req);
  if (!session || !session.center_id) {
    return res.status(401).json({ error: 'Unauthorized: Valid owner session required' });
  }

  const centerId = session.center_id;
  const { supabaseUrl, serviceKey } = getSupabaseConfig();

  if (!serviceKey) {
    return res.status(500).json({ error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY missing' });
  }

  try {
    // 2. T2 / F1: Query transformations scoped strictly to center_id with order=created_at.desc
    const queryUrl = `${supabaseUrl}/rest/v1/transformations?center_id=eq.${encodeURIComponent(centerId)}&select=*&order=created_at.desc`;
    const dbRes = await fetch(queryUrl, {
      method: 'GET',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!dbRes.ok) {
      return res.status(502).json({ error: 'Database query failed' });
    }

    const rows = await dbRes.json();
    return res.status(200).json({
      center_id: centerId,
      transformations: rows || []
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
