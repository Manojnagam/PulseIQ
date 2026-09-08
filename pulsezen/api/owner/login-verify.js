import crypto from 'crypto';
import { signOwnerSession } from '../_session.js';
import { getSupabaseConfig } from '../_owner-helper.js';

async function recordVerifyAttempt(supabaseUrl, serviceKey, email, ip, success) {
  try {
    await fetch(`${supabaseUrl}/rest/v1/owner_login_attempts`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        ip_address: ip,
        attempt_type: 'verify_otp',
        success,
        created_at: new Date().toISOString()
      })
    });
  } catch (e) {
    console.error('Failed to log verify attempt:', e);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Session secret fallback for reliable operation
  const sessionSecret = process.env.OWNER_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'pulsezen_owner_fallback_secret_key_2026';

  const { email, code } = req.body || {};
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and verification code are required' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const tokenCode = String(code).trim();

  const { supabaseUrl, serviceKey } = getSupabaseConfig();
  if (!serviceKey) {
    return res.status(500).json({ error: 'server_misconfiguration', message: 'SUPABASE_SERVICE_ROLE_KEY is not configured' });
  }

  // F4 Guard: Determine IP, skip if unknown
  const rawIp = req.headers['x-real-ip'] || req.headers['x-vercel-forwarded-for'] || (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',').pop().trim() : null);
  const clientIp = rawIp && rawIp !== 'unknown' && rawIp !== '127.0.0.1' && rawIp !== '::1' ? rawIp : null;

  try {
    // --------------------------------------------------------------------------
    // 1. M1: Check rolling 15-minute failed attempts per email
    // --------------------------------------------------------------------------
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const lockCheckUrl = `${supabaseUrl}/rest/v1/owner_login_attempts?email=eq.${encodeURIComponent(normalizedEmail)}&attempt_type=eq.verify_otp&success=eq.false&created_at=gte.${encodeURIComponent(fifteenMinutesAgo)}&select=id`;
    
    const lockRes = await fetch(lockCheckUrl, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`
      }
    });

    const failedRows = lockRes.ok ? await lockRes.json() : [];
    if (Array.isArray(failedRows) && failedRows.length >= 5) {
      return res.status(429).json({
        error: 'locked_out',
        message: 'Too many failed verification attempts. This account is locked for 15 minutes. Please request a new code.'
      });
    }

    // --------------------------------------------------------------------------
    // 2. Fetch latest active OTP code record for this email
    // --------------------------------------------------------------------------
    const codeQueryUrl = `${supabaseUrl}/rest/v1/owner_login_attempts?email=eq.${encodeURIComponent(normalizedEmail)}&attempt_type=eq.request_otp&consumed=eq.false&invalidated=eq.false&order=created_at.desc&limit=1`;
    const codeRes = await fetch(codeQueryUrl, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`
      }
    });

    const codeRows = codeRes.ok ? await codeRes.json() : [];
    if (!codeRows || codeRows.length === 0) {
      await recordVerifyAttempt(supabaseUrl, serviceKey, normalizedEmail, clientIp, false);
      return res.status(401).json({ error: 'invalid_code', message: 'Invalid or expired verification code' });
    }

    const activeRecord = codeRows[0];

    // Check 10-minute expiry
    if (new Date(activeRecord.expires_at).getTime() < Date.now()) {
      await recordVerifyAttempt(supabaseUrl, serviceKey, normalizedEmail, clientIp, false);
      return res.status(401).json({ error: 'expired_code', message: 'Verification code has expired. Please request a new code.' });
    }

    // --------------------------------------------------------------------------
    // 3. E2: Constant-time comparison using HMAC-SHA256 with try/catch
    // --------------------------------------------------------------------------
    const expectedHash = crypto.createHmac('sha256', sessionSecret).update(tokenCode).digest('hex');
    let isCodeMatch = false;

    try {
      if (activeRecord.code_hash && typeof activeRecord.code_hash === 'string') {
        const inputBuf = Buffer.from(expectedHash, 'hex');
        const storedBuf = Buffer.from(activeRecord.code_hash, 'hex');
        if (inputBuf.length === storedBuf.length && crypto.timingSafeEqual(inputBuf, storedBuf)) {
          isCodeMatch = true;
        }
      }
    } catch (err) {
      isCodeMatch = false;
    }

    // D3(c) FAILED attempt insert: recorded before returning 401
    if (!isCodeMatch) {
      await recordVerifyAttempt(supabaseUrl, serviceKey, normalizedEmail, clientIp, false);

      // If this was the 5th failure, invalidate the code row immediately
      if (failedRows.length + 1 >= 5) {
        await fetch(`${supabaseUrl}/rest/v1/owner_login_attempts?id=eq.${activeRecord.id}`, {
          method: 'PATCH',
          headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ invalidated: true })
        });
      }

      return res.status(401).json({
        error: 'invalid_code',
        message: 'Invalid verification code'
      });
    }

    // --------------------------------------------------------------------------
    // 4. Successful verification
    // --------------------------------------------------------------------------
    // Log success attempt
    await recordVerifyAttempt(supabaseUrl, serviceKey, normalizedEmail, clientIp, true);

    // Mark code as consumed (single-use)
    await fetch(`${supabaseUrl}/rest/v1/owner_login_attempts?id=eq.${activeRecord.id}`, {
      method: 'PATCH',
      headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ consumed: true })
    });

    // 5. Fetch owner details from owner_users
    const ownerRes = await fetch(
      `${supabaseUrl}/rest/v1/owner_users?email=eq.${encodeURIComponent(normalizedEmail)}&select=id,center_id,email,status`,
      {
        headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
      }
    );

    const owners = ownerRes.ok ? await ownerRes.json() : [];
    if (!owners || owners.length === 0) {
      return res.status(403).json({ error: 'No owner account associated with this email' });
    }

    const owner = owners[0];
    if (owner.status !== 'active') {
      return res.status(403).json({ error: 'Owner account is suspended. Contact support.' });
    }

    // 6. Issue HMAC session via pulsezen/api/_session.js
    const payload = {
      owner_id: owner.id,
      center_id: owner.center_id,
      email: owner.email,
      role: 'owner'
    };

    const expiresInSeconds = 7 * 24 * 60 * 60; // 7 days (604800 seconds)
    const sessionToken = signOwnerSession(payload, expiresInSeconds);

    // Set HttpOnly, Secure, SameSite=Lax cookie
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
