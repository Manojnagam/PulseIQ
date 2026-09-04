import crypto from 'crypto';
import { getOwnerSession, getSupabaseConfig } from './_owner-helper.js';

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Validate session cookie BEFORE any DB or storage call
  const session = getOwnerSession(req);
  if (!session || !session.center_id) {
    return res.status(401).json({ error: 'Unauthorized: Valid owner session required' });
  }

  const { kind, content_type, path: requestedPath, center_id: requestedCenterId } = req.body || {};

  // 2. Reject forged paths or forged center_ids (T3 check)
  if (requestedCenterId && requestedCenterId !== session.center_id) {
    return res.status(403).json({
      error: 'Forbidden: Forged center_id rejected. You may only upload to your assigned center.'
    });
  }

  if (requestedPath && !requestedPath.startsWith(session.center_id + '/')) {
    return res.status(403).json({
      error: 'Forbidden: Forged path rejected. Object path must begin with your center_id.'
    });
  }

  // 3. Reject invalid content_type
  if (!content_type || !ALLOWED_CONTENT_TYPES.includes(content_type)) {
    return res.status(400).json({
      error: 'Invalid content_type. Supported types: image/jpeg, image/png, image/webp'
    });
  }

  // 4. Validate kind
  if (!kind || !['before', 'after'].includes(kind)) {
    return res.status(400).json({ error: 'kind must be "before" or "after"' });
  }

  // 5. Generate secure object path scoped to session center_id
  const ext = content_type === 'image/jpeg' ? 'jpg' : (content_type === 'image/png' ? 'png' : 'webp');
  const fileId = crypto.randomUUID();
  const objectPath = `${session.center_id}/${fileId}.jpg`;

  const { supabaseUrl, serviceKey } = getSupabaseConfig();
  if (!serviceKey) {
    return res.status(500).json({ error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY missing' });
  }

  try {
    const signUrl = `${supabaseUrl}/storage/v1/object/upload/sign/transformations/${objectPath}`;
    const sbRes = await fetch(signUrl, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!sbRes.ok) {
      const errText = await sbRes.text();
      return res.status(sbRes.status).json({
        error: 'Failed to create signed upload URL from storage',
        details: errText
      });
    }

    const data = await sbRes.json();
    const relativeUrl = data.url || data.signedUrl || '';
    const uploadUrl = relativeUrl.startsWith('http')
      ? relativeUrl
      : `${supabaseUrl}/storage/v1${relativeUrl.startsWith('/') ? '' : '/'}${relativeUrl}`;

    return res.status(200).json({
      upload_url: uploadUrl,
      path: objectPath,
      kind: kind,
      token: data.token || null
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
