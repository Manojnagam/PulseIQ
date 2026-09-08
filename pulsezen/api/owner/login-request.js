import crypto from 'crypto';
import { getSupabaseConfig } from '../_owner-helper.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Session secret fallback for reliable operation
  const sessionSecret = process.env.OWNER_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'pulsezen_owner_fallback_secret_key_2026';

  const { email } = req.body || {};
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email address is required' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const { supabaseUrl, serviceKey } = getSupabaseConfig();

  if (!serviceKey) {
    return res.status(500).json({ error: 'server_misconfiguration', message: 'SUPABASE_SERVICE_ROLE_KEY is not configured' });
  }

  // F4 Guard: Determine IP, but skip per-IP check if undetermined (never bucket 'unknown')
  const rawIp = req.headers['x-real-ip'] || req.headers['x-vercel-forwarded-for'] || (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',').pop().trim() : null);
  const clientIp = rawIp && rawIp !== 'unknown' && rawIp !== '127.0.0.1' && rawIp !== '::1' ? rawIp : null;

  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    // 1. C3 Rate Limit: Max 3 requests per email per hour
    const emailCheckUrl = `${supabaseUrl}/rest/v1/owner_login_attempts?email=eq.${encodeURIComponent(normalizedEmail)}&attempt_type=eq.request_otp&created_at=gte.${encodeURIComponent(oneHourAgo)}&select=id`;
    const emailRes = await fetch(emailCheckUrl, {
      headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
    });
    const emailRows = await emailRes.json();
    if (Array.isArray(emailRows) && emailRows.length >= 3) {
      return res.status(429).json({
        error: 'rate_limited_email',
        message: 'Too many login requests for this email. Maximum 3 requests per hour.'
      });
    }

    // 2. C3 / F4 Rate Limit: Max 10 requests per IP per hour (evaluated only when clientIp is known)
    if (clientIp) {
      const ipCheckUrl = `${supabaseUrl}/rest/v1/owner_login_attempts?ip_address=eq.${encodeURIComponent(clientIp)}&attempt_type=eq.request_otp&created_at=gte.${encodeURIComponent(oneHourAgo)}&select=id`;
      const ipRes = await fetch(ipCheckUrl, {
        headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
      });
      const ipRows = await ipRes.json();
      if (Array.isArray(ipRows) && ipRows.length >= 10) {
        return res.status(429).json({
          error: 'rate_limited_ip',
          message: 'Too many login requests from this IP address. Please try again later.'
        });
      }
    }

    // 3. Verify owner exists and is active in owner_users
    const queryUrl = `${supabaseUrl}/rest/v1/owner_users?email=eq.${encodeURIComponent(normalizedEmail)}&status=eq.active&select=id,center_id,email`;
    const sbRes = await fetch(queryUrl, {
      method: 'GET',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      }
    });

    const owners = sbRes.ok ? await sbRes.json() : [];
    if (!owners || owners.length === 0) {
      // Return generic message to prevent email enumeration
      return res.status(200).json({
        success: true,
        message: 'If your email is registered as an owner, a 6-digit code has been sent.'
      });
    }

    // 4. Generate cryptographically secure 6-digit OTP
    const rawCode = crypto.randomInt(100000, 999999).toString();

    // E2: HMAC-SHA256 with sessionSecret (never reversible plaintext)
    const codeHash = crypto.createHmac('sha256', sessionSecret).update(String(rawCode)).digest('hex');

    // 5. Store in owner_login_attempts with 10-minute expiry
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await fetch(`${supabaseUrl}/rest/v1/owner_login_attempts`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: normalizedEmail,
        ip_address: clientIp,
        attempt_type: 'request_otp',
        code_hash: codeHash,
        expires_at: expiresAt,
        consumed: false,
        invalidated: false,
        created_at: new Date().toISOString()
      })
    });

    // 6. Deliver OTP via Resend or Supabase Auth
    if (process.env.RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'PulseZen <noreply@pulsezen.in>',
          to: [normalizedEmail],
          subject: `Your PulseZen Login Code: ${rawCode}`,
          html: `<p>Your PulseZen Owner verification code is: <strong>${rawCode}</strong></p><p>This code expires in 10 minutes.</p>`
        })
      }).catch(err => console.error('Resend delivery failed:', err));
    } else {
      // Fallback to Supabase Auth OTP delivery
      await fetch(`${supabaseUrl}/auth/v1/otp`, {
        method: 'POST',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: normalizedEmail, create_user: true })
      }).catch(() => {});
    }

    return res.status(200).json({
      success: true,
      message: 'If your email is registered as an owner, a 6-digit code has been sent.'
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
