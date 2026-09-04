import { signSession } from '../_session.js';
import { getSupabaseConfig } from './_owner-helper.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, code } = req.body || {};
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and verification code are required' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const tokenCode = code.toString().trim();

  const { supabaseUrl, serviceKey } = getSupabaseConfig();
  if (!serviceKey) {
    return res.status(500).json({ error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY missing' });
  }

  try {
    // 1. Verify OTP with Supabase Auth
    const verifyRes = await fetch(`${supabaseUrl}/auth/v1/verify`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'email',
        email: normalizedEmail,
        token: tokenCode
      })
    });

    if (!verifyRes.ok) {
      const errData = await verifyRes.json().catch(() => ({}));
      return res.status(401).json({
        error: errData.error_description || errData.msg || 'Invalid or expired verification code'
      });
    }

    // 2. Fetch owner record
    const ownerRes = await fetch(
      `${supabaseUrl}/rest/v1/owner_users?email=eq.${encodeURIComponent(normalizedEmail)}&select=id,center_id,email,status`,
      {
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!ownerRes.ok) {
      return res.status(502).json({ error: 'Failed to retrieve owner details' });
    }

    const owners = await ownerRes.json();
    if (!owners || owners.length === 0) {
      return res.status(403).json({ error: 'No owner account associated with this email' });
    }

    const owner = owners[0];
    if (owner.status !== 'active') {
      return res.status(403).json({ error: 'Owner account is suspended. Contact support.' });
    }

    // 3. Issue HMAC session via api/_session.js
    const payload = {
      owner_id: owner.id,
      center_id: owner.center_id,
      email: owner.email,
      role: 'owner'
    };

    const expiresInSeconds = 30 * 24 * 60 * 60; // 30 days
    const sessionToken = signSession(payload, expiresInSeconds);

    // 4. Set httpOnly, Secure, SameSite=Lax cookie
    const cookieHeader = `pz_owner_session=${sessionToken}; Path=/; Max-Age=${expiresInSeconds}; HttpOnly; Secure; SameSite=Lax`;
    res.setHeader('Set-Cookie', cookieHeader);

    return res.status(200).json({
      success: true,
      token: sessionToken,
      center_id: owner.center_id
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
