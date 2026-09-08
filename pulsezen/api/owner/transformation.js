import { getOwnerSession, getSupabaseConfig } from '../_owner-helper.js';

function parseOptionalInt(val) {
  if (val === undefined || val === null || val === '') return null;
  const num = parseInt(val, 10);
  return isNaN(num) ? null : num;
}

function parseOptionalFloat(val) {
  if (val === undefined || val === null || val === '') return null;
  const num = parseFloat(val);
  return isNaN(num) ? null : num;
}

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

  // Required validations
  if (!customer_name || typeof customer_name !== 'string') {
    return res.status(400).json({ error: 'Customer name is required' });
  }
  if (!before_path || typeof before_path !== 'string') {
    return res.status(400).json({ error: 'Before photo path is required' });
  }
  if (!after_path || typeof after_path !== 'string') {
    return res.status(400).json({ error: 'After photo path is required' });
  }
  if (!customer_words || typeof customer_words !== 'string') {
    return res.status(400).json({ error: "Customer's own words are required" });
  }

  // Ensure paths belong to session center_id
  const centerId = session.center_id;
  if (!before_path.startsWith(`${centerId}/`) || !after_path.startsWith(`${centerId}/`)) {
    return res.status(403).json({ error: 'Forbidden: Photo paths must belong to your center' });
  }

  // B4 Fix: coerce empty strings to SQL null
  const cleanWeeks = parseOptionalInt(duration_weeks);
  const cleanStartWt = parseOptionalFloat(start_weight_kg);
  const cleanEndWt = parseOptionalFloat(end_weight_kg);
  const cleanHealthIssue = health_issue && typeof health_issue === 'string' && health_issue.trim() !== ''
    ? health_issue.trim()
    : null;

  const { supabaseUrl, serviceKey } = getSupabaseConfig();
  if (!serviceKey) {
    return res.status(500).json({ error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY missing' });
  }

  try {
    const insertPayload = {
      center_id: centerId,
      customer_name: customer_name.trim(),
      before_path,
      after_path,
      duration_weeks: cleanWeeks,
      start_weight_kg: cleanStartWt,
      end_weight_kg: cleanEndWt,
      health_issue: cleanHealthIssue,
      customer_words: customer_words.trim(),
      status: 'draft',
      consent_given: false
    };

    const insertUrl = `${supabaseUrl}/rest/v1/transformations`;
    const dbRes = await fetch(insertUrl, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(insertPayload)
    });

    if (!dbRes.ok) {
      const err = await dbRes.json().catch(() => ({}));
      return res.status(502).json({ error: 'Database insert failed', details: err });
    }

    const inserted = await dbRes.json();
    const row = inserted && inserted[0] ? inserted[0] : {};

    return res.status(201).json({
      id: row.id,
      status: 'draft',
      center_id: centerId,
      row
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
