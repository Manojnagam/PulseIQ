import crypto from 'crypto';
import { getOwnerSession, getSupabaseConfig } from '../_owner-helper.js';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Validate session cookie BEFORE any DB or storage operation
  const session = getOwnerSession(req);
  if (!session || !session.center_id) {
    return res.status(401).json({ error: 'Unauthorized: Valid owner session required' });
  }

  const { kind, content_type, path: requestedPath } = req.body || {};

  if (!kind || (kind !== 'before' && kind !== 'after')) {
    return res.status(400).json({ error: 'kind must be "before" or "after"' });
  }

  if (!content_type || !ALLOWED_MIME_TYPES.includes(content_type)) {
    return res.status(400).json({ error: `content_type must be one of: ${ALLOWED_MIME_TYPES.join(', ')}` });
  }

  // Determine target path: enforce center_id prefix
  const centerId = session.center_id;
  let targetPath;

  if (requestedPath) {
    // T3: Forged path check: MUST begin with session.center_id
    if (!requestedPath.startsWith(`${centerId}/`)) {
      return res.status(403).json({
        error: 'Forbidden: Forged path rejected. Object path must begin with your center_id.'
      });
    }
    targetPath = requestedPath;
  } else {
    // Generate fresh path: {center_id}/{uuid}.jpg
    const ext = content_type === 'image/png' ? 'png' : (content_type === 'image/webp' ? 'webp' : 'jpg');
    const fileUuid = crypto.randomUUID();
    targetPath = `${centerId}/${fileUuid}.${ext}`;
  }

  const { supabaseUrl, serviceKey } = getSupabaseConfig();
  if (!serviceKey) {
    return res.status(500).json({ error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY missing' });
  }

  try {
    // Request signed upload URL from Supabase Storage API
    const uploadSignUrl = `${supabaseUrl}/storage/v1/object/upload/sign/transformations/${targetPath}`;
    const signRes = await fetch(uploadSignUrl, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!signRes.ok) {
      const err = await signRes.json().catch(() => ({}));
      return res.status(502).json({ error: 'Failed to create signed upload URL', details: err });
    }

    const data = await signRes.json();
    const fullUploadUrl = `${supabaseUrl}${data.url}`;

    return res.status(200).json({
      upload_url: fullUploadUrl,
      path: targetPath,
      token: data.token
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
