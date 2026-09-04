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

  const {
    customer_name,
    before_path,
    after_path,
    duration_weeks,
    start_weight_kg,
    end_weight_kg,
    health_issue,
    customer_words
  } = req.body || {};

  // 2. Validate inputs
  if (!customer_name || typeof customer_name !== 'string' || !customer_name.trim()) {
    return res.status(400).json({ error: 'customer_name is required' });
  }

  if (!before_path || typeof before_path !== 'string' || !after_path || typeof after_path !== 'string') {
    return res.status(400).json({ error: 'before_path and after_path are required' });
  }

  // 3. Verify before_path and after_path both begin with session center_id + "/"
  const expectedPrefix = `${session.center_id}/`;
  if (!before_path.startsWith(expectedPrefix) || !after_path.startsWith(expectedPrefix)) {
    return res.status(403).json({
      error: `Invalid path: before_path and after_path must both begin with "${expectedPrefix}"`
    });
  }

  if (!customer_words || typeof customer_words !== 'string' || customer_words.trim().length < 20) {
    return res.status(400).json({ error: 'customer_words is required (minimum 20 characters)' });
  }

  const { supabaseUrl, serviceKey } = getSupabaseConfig();
  if (!serviceKey) {
    return res.status(500).json({ error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY missing' });
  }

  // 4. Build record scoped to session center_id (never from request body)
  const newTransformation = {
    center_id: session.center_id,
    customer_name: customer_name.trim(),
    before_path: before_path.trim(),
    after_path: after_path.trim(),
    duration_weeks: duration_weeks !== undefined && duration_weeks !== null && duration_weeks !== ''
      ? parseInt(duration_weeks, 10)
      : null,
    start_weight_kg: start_weight_kg !== undefined && start_weight_kg !== null && start_weight_kg !== ''
      ? Number(start_weight_kg)
      : null,
    end_weight_kg: end_weight_kg !== undefined && end_weight_kg !== null && end_weight_kg !== ''
      ? Number(end_weight_kg)
      : null,
    health_issue: health_issue ? health_issue.trim() : null,
    customer_words: customer_words.trim(),
    status: 'draft',
    consent_given: false
  };

  try {
    const insertRes = await fetch(`${supabaseUrl}/rest/v1/transformations`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(newTransformation)
    });

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      return res.status(insertRes.status).json({
        error: 'Failed to insert transformation draft',
        details: errText
      });
    }

    const inserted = await insertRes.json();
    const row = Array.isArray(inserted) ? inserted[0] : inserted;

    return res.status(201).json({
      id: row.id,
      status: row.status,
      center_id: row.center_id
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
