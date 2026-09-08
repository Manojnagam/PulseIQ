import { getSupabaseConfig } from '../_owner-helper.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
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
    // 1. Look up row by id (NO session required)
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

    // 2. B5-v2 Gate check: Must be published AND consent_given
    if (row.status !== 'published' || row.consent_given !== true) {
      return res.status(404).end();
    }

    // 3. Determine object path
    const filePath = kind === 'before' ? row.before_path : row.after_path;
    if (!filePath) {
      return res.status(404).end();
    }

    // 4. Fetch private storage object using service role key
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

    // 5. Stream bytes back with no-store cache to ensure instant revocation
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    return res.status(200).send(Buffer.from(buffer));
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
