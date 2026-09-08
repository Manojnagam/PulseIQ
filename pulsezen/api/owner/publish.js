import { getOwnerSession, getSupabaseConfig, findBannedTerms } from '../_owner-helper.js';

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
    // 2. Fetch row scoped to center_id
    const fetchUrl = `${supabaseUrl}/rest/v1/transformations?id=eq.${encodeURIComponent(id)}&center_id=eq.${encodeURIComponent(session.center_id)}&select=*`;
    const rowRes = await fetch(fetchUrl, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!rowRes.ok) {
      return res.status(502).json({ error: 'Database fetch failed' });
    }

    const rows = await rowRes.json();
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Transformation record not found or unauthorized' });
    }

    const row = rows[0];

    // T1: HARD GATE: Cannot publish without customer consent
    if (!row.consent_given) {
      return res.status(400).json({
        error: 'consent_required',
        message: 'Cannot publish transformation without customer consent.'
      });
    }

    if (!row.ai_summary) {
      return res.status(400).json({
        error: 'summary_required',
        message: 'Cannot publish without selecting a compliant AI summary.'
      });
    }

    // B2: Final compliance gate on summary text
    const hits = findBannedTerms(row.ai_summary);
    if (hits.length > 0) {
      return res.status(400).json({
        error: 'claim_blocked',
        message: `Publication blocked: Summary contains prohibited medical terms: ${hits.join(', ')}.`,
        banned_terms: hits
      });
    }

    // 3. Update status to 'published' (photos are streamed via /api/public/photo?id=<id>&kind=...)
    const updateUrl = `${supabaseUrl}/rest/v1/transformations?id=eq.${encodeURIComponent(id)}&center_id=eq.${encodeURIComponent(session.center_id)}`;
    const updateRes = await fetch(updateUrl, {
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

    if (!updateRes.ok) {
      return res.status(502).json({ error: 'Failed to update publication status' });
    }

    const updated = await updateRes.json();
    const publishedRow = updated && updated[0] ? updated[0] : row;

    return res.status(200).json({
      success: true,
      id: publishedRow.id,
      status: 'published',
      photo_before_url: `/api/public/photo?id=${publishedRow.id}&kind=before`,
      photo_after_url: `/api/public/photo?id=${publishedRow.id}&kind=after`
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
