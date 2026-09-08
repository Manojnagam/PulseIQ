import { getSupabaseConfig } from '../_owner-helper.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { center_id } = req.query || {};

  // M5: center_id is REQUIRED. Missing or malformed returns 400.
  if (!center_id || typeof center_id !== 'string' || !UUID_REGEX.test(center_id)) {
    return res.status(400).json({
      error: 'invalid_center_id',
      message: 'A valid center_id UUID is required'
    });
  }

  const { supabaseUrl, serviceKey } = getSupabaseConfig();
  if (!serviceKey) {
    return res.status(500).json({ error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY missing' });
  }

  try {
    // M5 / F1: Return ONLY non-sensitive fields for published + consent rows, limit 50, ordered by created_at.desc
    const queryUrl = `${supabaseUrl}/rest/v1/transformations?center_id=eq.${encodeURIComponent(center_id)}&status=eq.published&consent_given=eq.true&select=id,customer_name,duration_weeks,start_weight_kg,end_weight_kg,ai_summary,created_at&order=created_at.desc&limit=50`;

    const dbRes = await fetch(queryUrl, {
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
      center_id,
      transformations: rows || []
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
