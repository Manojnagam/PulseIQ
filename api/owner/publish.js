import { getOwnerSession, getSupabaseConfig } from './_owner-helper.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Validate session cookie BEFORE any DB call
  const session = getOwnerSession(req);
  if (!session || !session.center_id) {
    return res.status(401).json({ error: 'Unauthorized: Valid owner session required' });
  }

  const { id } = req.body || {};
  if (!id) {
    return res.status(400).json({ error: 'Transformation id is required' });
  }

  const { supabaseUrl, serviceKey } = getSupabaseConfig();
  if (!serviceKey) {
    return res.status(500).json({ error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY missing' });
  }

  try {
    // 2. Load transformation row scoped to session center_id
    const fetchUrl = `${supabaseUrl}/rest/v1/transformations?id=eq.${encodeURIComponent(id)}&center_id=eq.${encodeURIComponent(session.center_id)}&select=*`;
    const getRes = await fetch(fetchUrl, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!getRes.ok) {
      return res.status(502).json({ error: 'Failed to retrieve transformation record' });
    }

    const rows = await getRes.json();
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Transformation record not found' });
    }

    const row = rows[0];

    // 3. HARD ENFORCEMENT: Consent gate
    if (row.consent_given !== true) {
      return res.status(400).json({
        error: 'consent_required',
        message: 'Cannot publish transformation without customer consent.'
      });
    }

    // 4. HARD ENFORCEMENT: AI Summary required
    if (!row.ai_summary || !row.ai_summary.trim()) {
      return res.status(400).json({
        error: 'summary_required',
        message: 'Cannot publish transformation without an approved AI summary.'
      });
    }

    // 5. Update status to 'published'
    const updateUrl = `${supabaseUrl}/rest/v1/transformations?id=eq.${encodeURIComponent(id)}&center_id=eq.${encodeURIComponent(session.center_id)}`;
    const patchRes = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        status: 'published'
      })
    });

    if (!patchRes.ok) {
      return res.status(patchRes.status).json({ error: 'Failed to update publication status' });
    }

    return res.status(200).json({
      success: true,
      id: id,
      status: 'published'
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
