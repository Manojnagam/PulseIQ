import { getSupabaseConfig } from './_owner-helper.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function handleTransformations(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { center_id } = req.query || {};
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

async function handlePhoto(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id, kind } = req.query || {};
  if (!id || typeof id !== 'string' || !UUID_REGEX.test(id)) {
    return res.status(400).json({ error: 'Valid transformation id UUID is required' });
  }

  if (kind !== 'before' && kind !== 'after') {
    return res.status(400).json({ error: 'kind must be "before" or "after"' });
  }

  const { supabaseUrl, serviceKey } = getSupabaseConfig();
  if (!serviceKey) {
    return res.status(500).json({ error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY missing' });
  }

  try {
    const fetchUrl = `${supabaseUrl}/rest/v1/transformations?id=eq.${encodeURIComponent(id)}&select=id,status,consent_given,before_path,after_path`;
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
      return res.status(404).end();
    }

    const row = rows[0];
    if (row.status !== 'published' || row.consent_given !== true) {
      return res.status(404).end();
    }

    const filePath = kind === 'before' ? row.before_path : row.after_path;
    if (!filePath) {
      return res.status(404).end();
    }

    const storageUrl = `${supabaseUrl}/storage/v1/object/authenticated/transformations/${filePath}`;
    const storageRes = await fetch(storageUrl, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`
      }
    });

    if (!storageRes.ok) {
      return res.status(storageRes.status === 404 ? 404 : 502).end();
    }

    const contentType = storageRes.headers.get('content-type') || 'image/jpeg';
    const buffer = await storageRes.arrayBuffer();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    return res.status(200).send(Buffer.from(buffer));
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}

export default async function handler(req, res) {
  const action = req.query.action || (req.url.split('?')[0].split('/').pop());

  if (action === 'transformations') {
    return handleTransformations(req, res);
  } else if (action === 'photo') {
    return handlePhoto(req, res);
  }

  return res.status(404).json({ error: 'Not found' });
}
