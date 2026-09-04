import { getSupabaseConfig } from './_owner-helper.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body || {};
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email address is required' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const { supabaseUrl, serviceKey } = getSupabaseConfig();

  if (!serviceKey) {
    return res.status(500).json({ error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY missing' });
  }

  try {
    // 1. Look up owner_users by email
    const queryUrl = `${supabaseUrl}/rest/v1/owner_users?email=eq.${encodeURIComponent(normalizedEmail)}&status=eq.active&select=id,center_id,email`;
    const sbRes = await fetch(queryUrl, {
      method: 'GET',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!sbRes.ok) {
      // In case of query failure, still do not enumerate
      return res.status(200).json({
        success: true,
        message: 'If your email is registered as an owner, a 6-digit code has been sent.'
      });
    }

    const owners = await sbRes.json();
    if (!owners || owners.length === 0) {
      // Generic success to prevent email enumeration
      return res.status(200).json({
        success: true,
        message: 'If your email is registered as an owner, a 6-digit code has been sent.'
      });
    }

    const owner = owners[0];

    // 2. Send 6-digit OTP using Supabase Auth
    const otpRes = await fetch(`${supabaseUrl}/auth/v1/otp`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: owner.email,
        create_user: true
      })
    });

    return res.status(200).json({
      success: true,
      message: 'If your email is registered as an owner, a 6-digit code has been sent.'
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
