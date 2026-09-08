import { getOwnerSession, getSupabaseConfig } from '../_owner-helper.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  if (!id || typeof id !== 'string' || !UUID_REGEX.test(id)) {
    return res.status(400).json({ error: 'Valid transformation id UUID is required' });
  }

  const { supabaseUrl, serviceKey } = getSupabaseConfig();
  if (!serviceKey) {
    return res.status(500).json({ error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY missing' });
  }

  try {
    // 2. Unpublish: set status='draft' and clear consent_given
    // This immediately revokes access via /api/public/photo and /api/public/transformations
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
        status: 'draft',
        consent_given: false
      })
    });

    if (!updateRes.ok) {
      return res.status(502).json({ error: 'Failed to unpublish transformation' });
    }

    const updated = await updateRes.json();
    if (!updated || updated.length === 0) {
      return res.status(404).json({ error: 'Transformation not found or unauthorized' });
    }

    return res.status(200).json({
      success: true,
      id: updated[0].id,
      status: 'draft',
      consent_given: false,
      message: 'Transformation unpublished and public access revoked immediately.'
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
