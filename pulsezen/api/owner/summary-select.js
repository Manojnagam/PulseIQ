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

  const { id, text } = req.body || {};
  if (!id || !text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Transformation id and summary text are required' });
  }

  const cleanText = text.trim();

  // 2. B2 Compliance Gate: Server-side post-filter check
  const hits = findBannedTerms(cleanText);
  if (hits.length > 0) {
    return res.status(400).json({
      error: 'claim_blocked',
      message: `Selected text contains prohibited medical terms: ${hits.join(', ')}. Please remove medical claims before saving.`,
      banned_terms: hits
    });
  }

  const { supabaseUrl, serviceKey } = getSupabaseConfig();
  if (!serviceKey) {
    return res.status(500).json({ error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY missing' });
  }

  try {
    // 3. Save selected summary scoped to center_id
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
        ai_summary: cleanText
      })
    });

    if (!updateRes.ok) {
      return res.status(502).json({ error: 'Failed to save summary' });
    }

    const updated = await updateRes.json();
    if (!updated || updated.length === 0) {
      return res.status(404).json({ error: 'Transformation not found or unauthorized' });
    }

    return res.status(200).json({
      success: true,
      id: updated[0].id,
      ai_summary: updated[0].ai_summary
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
