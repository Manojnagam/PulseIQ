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

  const { id, consent_name, consent_phone_last4 } = req.body || {};

  if (!id) {
    return res.status(400).json({ error: 'Transformation id is required' });
  }

  if (!consent_name || typeof consent_name !== 'string' || !consent_name.trim()) {
    return res.status(400).json({ error: 'Customer consent name is required' });
  }

  const phoneLast4 = (consent_phone_last4 || '').toString().trim();
  if (!/^\d{4}$/.test(phoneLast4)) {
    return res.status(400).json({ error: 'Last 4 digits of customer phone must be exactly 4 digits' });
  }

  const { supabaseUrl, serviceKey } = getSupabaseConfig();
  if (!serviceKey) {
    return res.status(500).json({ error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY missing' });
  }

  try {
    const nowIso = new Date().toISOString();
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
        consent_given: true,
        consent_name: consent_name.trim(),
        consent_phone_last4: phoneLast4,
        consent_at: nowIso
      })
    });

    if (!updateRes.ok) {
      return res.status(updateRes.status).json({ error: 'Failed to record customer consent' });
    }

    const updated = await updateRes.json();
    if (!updated || updated.length === 0) {
      return res.status(404).json({ error: 'Transformation not found or does not belong to your center' });
    }

    return res.status(200).json({
      success: true,
      id: id,
      consent_given: true,
      consent_name: consent_name.trim(),
      consent_phone_last4: phoneLast4,
      consent_at: nowIso
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
