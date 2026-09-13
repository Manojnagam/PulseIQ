import crypto from 'crypto';
import { getOwnerSession, getSupabaseConfig, findBannedTerms } from './_owner-helper.js';
import { signOwnerSession, getSessionSecret } from './_session.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const SYSTEM_PROMPT = `You are a factual, honest testimonial editor.
You must strictly enforce ALL of these rules without exception:
1. Rewrite ONLY the text supplied in customer_words. Do not add any fact, number, symptom, or outcome not present in the input.
2. Output in the first person ("I"), as the customer, maximum 45 words, simple English.
3. Never claim to cure, treat, reverse or heal any disease. Never use any of these words: cure, cured, cures, treat, treats, heal, heals, reverse, reversed, medicine, medical, doctor, prescription, diabetes-free, disease-free.
4. Never mention "Herbalife" or any brand name.
5. Output plain text only. No quotes, no markdown, no emoji.`;

function parseStrictInt(val) {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'number') {
    return Number.isInteger(val) ? val : null;
  }
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!/^-?\d+$/.test(trimmed)) return null;
  const num = Number(trimmed);
  return Number.isSafeInteger(num) ? num : null;
}

function parseStrictFloat(val) {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : null;
  }
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

// -----------------------------------------------------------------------------
// 1. LOGIN REQUEST
// -----------------------------------------------------------------------------
async function handleLoginRequest(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (process.env.OWNER_AUTH_MAINTENANCE === 'true') {
    return res.status(503).json({
      error: 'service_maintenance',
      message: 'Owner portal authentication is temporarily undergoing maintenance. Please check back shortly.'
    });
  }

  const sessionSecret = getSessionSecret();
  if (!sessionSecret) {
    console.error('[PulseZen Auth] Session secret is not configured; failing closed');
    return res.status(500).json({ error: 'server_misconfiguration', message: 'Authentication service is not properly configured.' });
  }
  const { email } = req.body || {};
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email address is required' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const { supabaseUrl, serviceKey } = getSupabaseConfig();
  if (!serviceKey) {
    return res.status(500).json({ error: 'server_misconfiguration', message: 'SUPABASE_SERVICE_ROLE_KEY is not configured' });
  }

  const rawIp = req.headers['x-real-ip'] || req.headers['x-vercel-forwarded-for'] || (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',').pop().trim() : null);
  const clientIp = rawIp && rawIp !== 'unknown' && rawIp !== '127.0.0.1' && rawIp !== '::1' ? rawIp : null;

  try {
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const emailCheckUrl = `${supabaseUrl}/rest/v1/owner_login_attempts?email=eq.${encodeURIComponent(normalizedEmail)}&attempt_type=eq.request_otp&created_at=gte.${encodeURIComponent(fifteenMinsAgo)}&select=id`;
    const emailRes = await fetch(emailCheckUrl, {
      headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
    });
    if (!emailRes.ok) {
      console.error('[PulseZen Auth] Database error querying email rate limits; failing closed');
      return res.status(500).json({ error: 'internal_error', message: 'Unable to process login request. Please try again.' });
    }
    const emailRows = await emailRes.json().catch(() => null);
    if (!Array.isArray(emailRows)) {
      console.error('[PulseZen Auth] Unexpected response structure for email rate limits; failing closed');
      return res.status(500).json({ error: 'internal_error', message: 'Unable to process login request. Please try again.' });
    }
    if (emailRows.length >= 8) {
      return res.status(429).json({
        error: 'rate_limited_email',
        message: 'Too many login requests for this email. Please wait a few minutes before trying again.'
      });
    }

    if (clientIp) {
      const ipCheckUrl = `${supabaseUrl}/rest/v1/owner_login_attempts?ip_address=eq.${encodeURIComponent(clientIp)}&attempt_type=eq.request_otp&created_at=gte.${encodeURIComponent(fifteenMinsAgo)}&select=id`;
      const ipRes = await fetch(ipCheckUrl, {
        headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
      });
      if (!ipRes.ok) {
        console.error('[PulseZen Auth] Database error querying IP rate limits; failing closed');
        return res.status(500).json({ error: 'internal_error', message: 'Unable to process login request. Please try again.' });
      }
      const ipRows = await ipRes.json().catch(() => null);
      if (!Array.isArray(ipRows)) {
        console.error('[PulseZen Auth] Unexpected response structure for IP rate limits; failing closed');
        return res.status(500).json({ error: 'internal_error', message: 'Unable to process login request. Please try again.' });
      }
      if (ipRows.length >= 20) {
        return res.status(429).json({
          error: 'rate_limited_ip',
          message: 'Too many login requests from this IP. Please wait a few minutes before trying again.'
        });
      }
    }

    // Provider configuration check: fail closed early before user lookup to prevent account enumeration
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      console.error('[PulseZen Auth] RESEND_API_KEY is not configured; failing closed');
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
          code_hash: null,
          success: false,
          consumed: true,
          invalidated: true,
          expires_at: null
        })
      }).catch(err => console.error('[PulseZen Auth] Failed to record unconfigured provider attempt:', err.message));
      return res.status(503).json({
        error: 'service_unavailable',
        message: 'Email delivery service is currently unavailable. Please contact support.'
      });
    }

    const lookupUrl = `${supabaseUrl}/rest/v1/owner_users?email=eq.${encodeURIComponent(normalizedEmail)}&status=eq.active&select=id,center_id`;
    const lookupRes = await fetch(lookupUrl, {
      headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
    });
    if (!lookupRes.ok) {
      console.error('[PulseZen Auth] Database error during owner user lookup; failing closed');
      return res.status(500).json({ error: 'internal_error', message: 'Unable to process login request. Please try again.' });
    }
    const users = await lookupRes.json().catch(() => null);
    if (!Array.isArray(users)) {
      console.error('[PulseZen Auth] Unexpected response structure for owner user lookup; failing closed');
      return res.status(500).json({ error: 'internal_error', message: 'Unable to process login request. Please try again.' });
    }
    const userExists = users.length > 0;

    // If user does not exist, record rate-limiting attempt (without usable OTP) and return generic outward response
    if (!userExists) {
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
          code_hash: null,
          success: false,
          consumed: true,
          invalidated: true,
          expires_at: null
        })
      }).catch(err => console.error('[PulseZen Auth] Failed to record non-existent user attempt:', err.message));
      return res.status(200).json({
        success: true,
        message: 'If this email is registered and eligible, a verification code will be sent.'
      });
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    const hmac = crypto.createHmac('sha256', sessionSecret);
    hmac.update(`${normalizedEmail}:${otp}`);
    const codeHash = hmac.digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Step 1: Persist pending attempt record with invalidated=true (DELIVERY PENDING GATE).
    // The OTP is completely ineligible for verification while delivery is pending.
    const attemptInsertRes = await fetch(`${supabaseUrl}/rest/v1/owner_login_attempts`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        email: normalizedEmail,
        ip_address: clientIp,
        attempt_type: 'request_otp',
        code_hash: codeHash,
        success: false,
        consumed: false,
        invalidated: true, // Ineligible until delivery confirmation
        expires_at: expiresAt
      })
    });

    if (!attemptInsertRes.ok) {
      console.error('[PulseZen Auth] Failed to persist pending OTP attempt; aborting email dispatch');
      return res.status(500).json({ error: 'internal_error', message: 'Unable to process login request. Please try again.' });
    }

    const insertedRows = await attemptInsertRes.json().catch(() => []);
    if (!Array.isArray(insertedRows) || insertedRows.length !== 1) {
      console.error('[PulseZen Auth] Unexpected insert response structure; aborting email dispatch');
      return res.status(500).json({ error: 'internal_error', message: 'Unable to process login request. Please try again.' });
    }
    const attemptId = insertedRows[0].id;

    // Step 2: Deliver email via provider
    const emailBody = {
      to: [normalizedEmail],
      subject: `Your PulseZen Portal Login Code: ${otp}`,
      html: `
        <div style="font-family:sans-serif; max-width:460px; margin:0 auto; padding:24px; border:1px solid #e5e7eb; border-radius:12px;">
          <h2 style="color:#1a3a28; margin-top:0;">PulseZen Owner Portal</h2>
          <p style="font-size:15px; color:#374151;">Your 6-digit login verification code is:</p>
          <div style="font-size:32px; font-weight:800; letter-spacing:6px; color:#1a3a28; background:#f3f4f6; padding:14px; text-align:center; border-radius:8px; margin:18px 0;">
            ${otp}
          </div>
          <p style="font-size:13px; color:#6b7280;">This code expires in 10 minutes. If you did not request this, please ignore this message.</p>
        </div>
      `
    };

    let emailSent = false;
    try {
      let emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...emailBody,
          from: 'PulseZen <no-reply@pulsezen.in>'
        })
      });

      if (!emailRes.ok) {
        emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ...emailBody,
            from: 'PulseZen <onboarding@resend.dev>'
          })
        });
      }

      if (emailRes.ok) {
        emailSent = true;
      }
    } catch (e) {
      console.error('[PulseZen Auth] Failed to deliver verification code via email provider (timeout/error)');
    }

    // Step 3: Provider failure or timeout: fail closed internally.
    // The attempt remains invalidated=true (and marked consumed=true) in the database.
    if (!emailSent) {
      console.error('[PulseZen Auth] Email provider failed or timed out during dispatch; failing closed internally');
      await fetch(`${supabaseUrl}/rest/v1/owner_login_attempts?id=eq.${encodeURIComponent(attemptId)}`, {
        method: 'PATCH',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ consumed: true, invalidated: true, success: false })
      }).catch(err => console.error('[PulseZen Auth] Failed to mark failed attempt consumed:', err.message));

      // Return generic outward response without exposing account existence or provider delivery state
      return res.status(200).json({
        success: true,
        message: 'If this email is registered and eligible, a verification code will be sent.'
      });
    }

    // Step 4: Provider succeeded: ACTIVATE the OTP attempt by setting invalidated=false.
    // Guard against race with background revocation or delayed delivery:
    // Requires: matching id, invalidated=true (pending), consumed=false (unrevoked), success=false, and unexpired.
    const activateTimeIso = new Date().toISOString();
    const activateRes = await fetch(
      `${supabaseUrl}/rest/v1/owner_login_attempts?id=eq.${encodeURIComponent(attemptId)}&invalidated=eq.true&consumed=eq.false&success=eq.false&expires_at=gt.${encodeURIComponent(activateTimeIso)}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({ invalidated: false, success: true })
      }
    );

    if (!activateRes.ok) {
      console.error('[PulseZen Auth] Failed to persist activation for delivered OTP; failing closed');
      return res.status(500).json({ error: 'internal_error', message: 'Unable to activate verification code. Please try again.' });
    }

    const activatedRows = await activateRes.json().catch(() => []);
    if (!Array.isArray(activatedRows) || activatedRows.length !== 1) {
      console.error('[PulseZen Auth] Activation row count mismatch; failing closed');
      return res.status(500).json({ error: 'internal_error', message: 'Unable to activate verification code. Please try again.' });
    }

    return res.status(200).json({
      success: true,
      message: 'If this email is registered and eligible, a verification code will be sent.'
    });
  } catch (err) {
    return res.status(500).json({ error: 'internal_error', details: 'An internal error occurred' });
  }
}

// -----------------------------------------------------------------------------
// 2. LOGIN VERIFY
// -----------------------------------------------------------------------------
async function handleLoginVerify(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (process.env.OWNER_AUTH_MAINTENANCE === 'true') {
    return res.status(503).json({
      error: 'service_maintenance',
      message: 'Owner portal authentication is temporarily undergoing maintenance. Please check back shortly.'
    });
  }

  const sessionSecret = getSessionSecret();
  if (!sessionSecret) {
    console.error('[PulseZen Auth] Session secret is not configured; failing closed');
    return res.status(500).json({ error: 'server_misconfiguration', message: 'Authentication service is not properly configured.' });
  }
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

  const rawIp = req.headers['x-real-ip'] || req.headers['x-vercel-forwarded-for'] || (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',').pop().trim() : null);
  const clientIp = rawIp && rawIp !== 'unknown' && rawIp !== '127.0.0.1' && rawIp !== '::1' ? rawIp : null;

  try {
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const failCheckUrl = `${supabaseUrl}/rest/v1/owner_login_attempts?email=eq.${encodeURIComponent(normalizedEmail)}&attempt_type=eq.verify_otp&success=eq.false&created_at=gte.${encodeURIComponent(fifteenMinsAgo)}&select=id`;
    const failRes = await fetch(failCheckUrl, {
      headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
    });
    if (!failRes.ok) {
      console.error('[PulseZen Auth] Database error querying verification failure limits; failing closed');
      return res.status(500).json({ error: 'internal_error', message: 'Unable to process verification. Please try again.' });
    }
    const failRows = await failRes.json().catch(() => null);
    if (!Array.isArray(failRows)) {
      console.error('[PulseZen Auth] Unexpected response structure for verification failures; failing closed');
      return res.status(500).json({ error: 'internal_error', message: 'Unable to process verification. Please try again.' });
    }
    if (failRows.length >= 5) {
      return res.status(429).json({
        error: 'account_locked',
        message: 'Too many failed verification attempts. Please wait 15 minutes before trying again.'
      });
    }

    const userUrl = `${supabaseUrl}/rest/v1/owner_users?email=eq.${encodeURIComponent(normalizedEmail)}&status=eq.active&select=id,center_id,email`;
    const userRes = await fetch(userUrl, {
      headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
    });
    if (!userRes.ok) {
      console.error('[PulseZen Auth] Database error querying owner user; failing closed');
      return res.status(500).json({ error: 'internal_error', message: 'Unable to process verification. Please try again.' });
    }
    const users = await userRes.json().catch(() => null);
    if (!Array.isArray(users)) {
      console.error('[PulseZen Auth] Unexpected response structure for owner user query; failing closed');
      return res.status(500).json({ error: 'internal_error', message: 'Unable to process verification. Please try again.' });
    }
    const user = users.length > 0 ? users[0] : null;

    if (!user) {
      const recorded = await recordVerifyAttempt(supabaseUrl, serviceKey, normalizedEmail, clientIp, false);
      if (!recorded) {
        console.error('[PulseZen Auth] Failed to record verification failure audit (unknown user); failing closed');
        return res.status(500).json({ error: 'internal_error', message: 'Unable to process verification. Please try again.' });
      }
      return res.status(401).json({ error: 'invalid_credentials', message: 'Invalid verification code or email' });
    }

    const nowIso = new Date().toISOString();
    // Strictly enforce active eligibility: unconsumed, non-invalidated (explicitly false for verified NOT NULL schema), unexpired
    const otpUrl = `${supabaseUrl}/rest/v1/owner_login_attempts?email=eq.${encodeURIComponent(normalizedEmail)}&attempt_type=eq.request_otp&consumed=eq.false&invalidated=eq.false&expires_at=gt.${encodeURIComponent(nowIso)}&order=created_at.desc&limit=5`;
    const otpRes = await fetch(otpUrl, {
      headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
    });
    if (!otpRes.ok) {
      console.error('[PulseZen Auth] Database error querying active OTP attempts; failing closed');
      return res.status(500).json({ error: 'internal_error', message: 'Unable to process verification. Please try again.' });
    }
    const otps = await otpRes.json().catch(() => null);
    if (!Array.isArray(otps)) {
      console.error('[PulseZen Auth] Unexpected response structure for active OTP query; failing closed');
      return res.status(500).json({ error: 'internal_error', message: 'Unable to process verification. Please try again.' });
    }
    if (otps.length === 0) {
      const recorded = await recordVerifyAttempt(supabaseUrl, serviceKey, normalizedEmail, clientIp, false);
      if (!recorded) {
        console.error('[PulseZen Auth] Failed to record verification failure audit (expired/missing OTP); failing closed');
        return res.status(500).json({ error: 'internal_error', message: 'Unable to process verification. Please try again.' });
      }
      return res.status(401).json({ error: 'code_expired_or_invalid', message: 'Verification code has expired. Please request a new one.' });
    }

    const candidateHmac = crypto.createHmac('sha256', sessionSecret);
    candidateHmac.update(`${normalizedEmail}:${tokenCode}`);
    const candidateHash = candidateHmac.digest('hex');
    const actualBuf = Buffer.from(candidateHash, 'hex');

    const matchingOtp = otps.find(row => {
      if (!row.code_hash) return false;
      const expectedBuf = Buffer.from(row.code_hash, 'hex');
      return expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf);
    });

    if (!matchingOtp) {
      const recorded = await recordVerifyAttempt(supabaseUrl, serviceKey, normalizedEmail, clientIp, false);
      if (!recorded) {
        console.error('[PulseZen Auth] Failed to record verification failure audit (wrong code); failing closed');
        return res.status(500).json({ error: 'internal_error', message: 'Unable to process verification. Please try again.' });
      }
      return res.status(401).json({ error: 'invalid_code', message: 'Invalid verification code. Please check your latest email.' });
    }

    // Atomic conditional consumption under concurrency:
    // Rechecks ALL applicable eligibility conditions at the UPDATE step:
    // 1. matching id
    // 2. consumed = false (single-use lock)
    // 3. invalidated = false (not invalidated during/after lookup)
    // 4. expires_at > updateTimeIso (not expired between lookup and consumption)
    const updateTimeIso = new Date().toISOString();
    const consumeRes = await fetch(
      `${supabaseUrl}/rest/v1/owner_login_attempts?id=eq.${encodeURIComponent(matchingOtp.id)}&consumed=eq.false&invalidated=eq.false&expires_at=gt.${encodeURIComponent(updateTimeIso)}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({ consumed: true })
      }
    );

    if (!consumeRes.ok) {
      await recordVerifyAttempt(supabaseUrl, serviceKey, normalizedEmail, clientIp, false);
      return res.status(500).json({ error: 'internal_error', message: 'Failed to record session verification. Please try again.' });
    }

    const consumedRows = await consumeRes.json().catch(() => []);
    if (!Array.isArray(consumedRows) || consumedRows.length !== 1) {
      // Concurrency collision, late invalidation, or expiry between lookup and consumption
      const recorded = await recordVerifyAttempt(supabaseUrl, serviceKey, normalizedEmail, clientIp, false);
      if (!recorded) {
        console.error('[PulseZen Auth] Failed to record verification failure audit (collision/consumption conflict); failing closed');
        return res.status(500).json({ error: 'internal_error', message: 'Unable to process verification. Please try again.' });
      }
      return res.status(401).json({ error: 'code_expired_or_invalid', message: 'Verification code has already been used or expired.' });
    }

    // Invalidate any remaining active OTPs for this email in the background
    fetch(`${supabaseUrl}/rest/v1/owner_login_attempts?email=eq.${encodeURIComponent(normalizedEmail)}&attempt_type=eq.request_otp&consumed=eq.false`, {
      method: 'PATCH',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ consumed: true, invalidated: true })
    }).catch(err => console.error('[PulseZen Auth] Background active OTP invalidation error:', err.message));

    const recordSuccess = await recordVerifyAttempt(supabaseUrl, serviceKey, normalizedEmail, clientIp, true);
    if (!recordSuccess) {
      console.error('[PulseZen Auth] Failed mandatory audit persistence before session issuance; failing closed');
      return res.status(500).json({ error: 'internal_error', message: 'Unable to complete verification audit. Please try again.' });
    }

    const token = signOwnerSession({
      owner_id: user.id,
      center_id: user.center_id,
      email: user.email
    }, 604800);

    const cookieHeader = `pz_owner_session=${token}; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax`;
    res.setHeader('Set-Cookie', cookieHeader);

    return res.status(200).json({
      success: true,
      owner_id: user.id,
      center_id: user.center_id,
      email: user.email
    });
  } catch (err) {
    return res.status(500).json({ error: 'internal_error', details: err.message });
  }
}

async function recordVerifyAttempt(supabaseUrl, serviceKey, email, ip, success) {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/owner_login_attempts`, {
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
        consumed: false,
        invalidated: false
      })
    });
    if (!res.ok) {
      console.error(`[PulseZen Auth] Failed to persist verify attempt record (status=${res.status})`);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[PulseZen Auth] Error persisting verify attempt record:', e.message);
    return false;
  }
}

// -----------------------------------------------------------------------------
// 3. LOGOUT
// -----------------------------------------------------------------------------
async function handleLogout(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const clearCookie = 'pz_owner_session=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax';
  res.setHeader('Set-Cookie', clearCookie);
  return res.status(200).json({ success: true, message: 'Logged out successfully' });
}

// -----------------------------------------------------------------------------
// 4. LIST TRANSFORMATIONS
// -----------------------------------------------------------------------------
async function handleList(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const session = getOwnerSession(req);
  if (!session || !session.center_id) return res.status(401).json({ error: 'Unauthorized' });

  const { supabaseUrl, serviceKey } = getSupabaseConfig();
  if (!serviceKey) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY missing' });

  try {
    const queryUrl = `${supabaseUrl}/rest/v1/transformations?center_id=eq.${encodeURIComponent(session.center_id)}&select=*&order=created_at.desc`;
    const dbRes = await fetch(queryUrl, {
      headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
    });
    if (!dbRes.ok) return res.status(502).json({ error: 'Database query failed' });
    const rows = await dbRes.json();
    return res.status(200).json({ center_id: session.center_id, transformations: rows || [] });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}

// -----------------------------------------------------------------------------
// 5. UPLOAD URL
// -----------------------------------------------------------------------------
async function handleUploadUrl(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const session = getOwnerSession(req);
  if (!session || !session.center_id) return res.status(401).json({ error: 'Unauthorized' });

  const { kind, content_type, path: requestedPath } = req.body || {};
  if (!kind || (kind !== 'before' && kind !== 'after')) return res.status(400).json({ error: 'kind must be "before" or "after"' });
  if (!content_type || !ALLOWED_MIME_TYPES.includes(content_type)) return res.status(400).json({ error: `content_type must be one of: ${ALLOWED_MIME_TYPES.join(', ')}` });

  const centerId = session.center_id;
  let targetPath;
  if (requestedPath) {
    if (!requestedPath.startsWith(`${centerId}/`)) {
      return res.status(403).json({ error: 'Forbidden: Object path must begin with your center_id.' });
    }
    targetPath = requestedPath;
  } else {
    const ext = content_type === 'image/png' ? 'png' : (content_type === 'image/webp' ? 'webp' : 'jpg');
    targetPath = `${centerId}/${crypto.randomUUID()}.${ext}`;
  }

  const { supabaseUrl, serviceKey } = getSupabaseConfig();
  if (!serviceKey) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY missing' });

  try {
    const uploadSignUrl = `${supabaseUrl}/storage/v1/object/upload/sign/transformations/${targetPath}`;
    const signRes = await fetch(uploadSignUrl, {
      method: 'POST',
      headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }
    });
    if (!signRes.ok) {
      const err = await signRes.json().catch(() => ({}));
      return res.status(502).json({ error: 'Failed to create signed upload URL', details: err });
    }
    const data = await signRes.json();
    return res.status(200).json({ upload_url: `${supabaseUrl}${data.url}`, path: targetPath, token: data.token });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}

// -----------------------------------------------------------------------------
// 6. CREATE DRAFT TRANSFORMATION
// -----------------------------------------------------------------------------
async function handleCreateTransformation(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const session = getOwnerSession(req);
  if (!session || !session.center_id) return res.status(401).json({ error: 'Unauthorized' });

  const { customer_name, before_path, after_path, duration_weeks, start_weight_kg, end_weight_kg, health_issue, customer_words } = req.body || {};
  if (!customer_name || !before_path || !after_path || !customer_words) {
    return res.status(400).json({ error: 'Required fields missing: customer_name, before_path, after_path, customer_words' });
  }

  const centerId = session.center_id;
  if (!before_path.startsWith(`${centerId}/`) || !after_path.startsWith(`${centerId}/`)) {
    return res.status(403).json({ error: 'Forbidden: Photo paths must belong to your center' });
  }

  const { supabaseUrl, serviceKey } = getSupabaseConfig();
  if (!serviceKey) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY missing' });

  try {
    const parsedDuration = parseStrictInt(duration_weeks);
    if (duration_weeks !== undefined && duration_weeks !== null && duration_weeks !== '' && (parsedDuration === null || parsedDuration < 1 || parsedDuration > 520)) {
      return res.status(400).json({ error: 'duration_weeks must be a positive integer between 1 and 520' });
    }

    const parsedStartWt = parseStrictFloat(start_weight_kg);
    if (start_weight_kg !== undefined && start_weight_kg !== null && start_weight_kg !== '' && (parsedStartWt === null || parsedStartWt < 20 || parsedStartWt > 500)) {
      return res.status(400).json({ error: 'start_weight_kg must be a valid number between 20 and 500' });
    }

    const parsedEndWt = parseStrictFloat(end_weight_kg);
    if (end_weight_kg !== undefined && end_weight_kg !== null && end_weight_kg !== '' && (parsedEndWt === null || parsedEndWt < 20 || parsedEndWt > 500)) {
      return res.status(400).json({ error: 'end_weight_kg must be a valid number between 20 and 500' });
    }

    const insertPayload = {
      center_id: centerId,
      customer_name: customer_name.trim(),
      before_path,
      after_path,
      duration_weeks: parsedDuration,
      start_weight_kg: parsedStartWt,
      end_weight_kg: parsedEndWt,
      health_issue: (health_issue && health_issue.trim()) ? health_issue.trim() : null,
      customer_words: customer_words.trim(),
      status: 'draft',
      consent_given: false
    };

    const dbRes = await fetch(`${supabaseUrl}/rest/v1/transformations`, {
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
    return res.status(201).json({ id: row.id, status: 'draft', center_id: centerId, row });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}

// -----------------------------------------------------------------------------
// 7. SUMMARIZE (GROQ LLAMA-3)
// -----------------------------------------------------------------------------
async function callGroqVariant(groqKey, customerWords, styleHint) {
  let attempt = 0;
  let lastRawOutput = '';
  let lastHits = [];
  const attempts = [];

  while (attempt < 2) {
    attempt++;
    const userPrompt = attempt === 1
      ? `${styleHint}\nRewrite ONLY the following customer words:\n${customerWords}`
      : `IMPORTANT: Prohibited medical claims detected previously. You MUST NOT use words like cure, treat, heal, reverse, medicine, medical, doctor, prescription, diabetes-free, disease-free.\nRewrite ONLY the following customer words in simple English under 45 words:\n${customerWords}`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 120
      })
    });

    if (!groqRes.ok) {
      const errData = await groqRes.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Groq API HTTP ${groqRes.status}`);
    }

    const data = await groqRes.json();
    let text = (data.choices?.[0]?.message?.content || '').trim().replace(/^["'`]|["'`]$/g, '').trim();
    lastRawOutput = text;

    const hits = findBannedTerms(text);
    attempts.push({ attempt, user_prompt: userPrompt, raw_output: text, banned_terms_detected: hits });

    if (hits.length === 0) {
      return { ok: true, text, rawOutput: text, hits: [], attempts };
    }
    lastHits = hits;
  }

  return { ok: false, text: lastRawOutput, rawOutput: lastRawOutput, hits: lastHits, attempts };
}

async function handleSummarize(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const session = getOwnerSession(req);
  if (!session || !session.center_id) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'Transformation id is required' });

  const { supabaseUrl, serviceKey } = getSupabaseConfig();
  const groqKey = process.env.GROQ_API_KEY;
  if (!serviceKey || !groqKey) return res.status(500).json({ error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY or GROQ_API_KEY missing' });

  try {
    const fetchUrl = `${supabaseUrl}/rest/v1/transformations?id=eq.${encodeURIComponent(id)}&center_id=eq.${encodeURIComponent(session.center_id)}&select=*`;
    const rowRes = await fetch(fetchUrl, {
      headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
    });
    const rows = await rowRes.json();
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Transformation record not found' });

    const customerWords = rows[0].customer_words;
    const v1 = await callGroqVariant(groqKey, customerWords, 'Variant 1: Express feeling lighter, consistent habits, and personal well-being in simple first-person.');
    if (!v1.ok) {
      return res.status(400).json({
        error: 'claim_blocked',
        message: "The customer's words contain medical or curative claims which cannot be published. Please rewrite without medical claims.",
        banned_terms: v1.hits
      });
    }

    const v2 = await callGroqVariant(groqKey, customerWords, 'Variant 2: Express daily routine, energy to do everyday tasks, and positive personal changes in simple first-person.');
    if (!v2.ok) {
      return res.status(400).json({
        error: 'claim_blocked',
        message: "The customer's words contain medical or curative claims which cannot be published. Please rewrite without medical claims.",
        banned_terms: v2.hits
      });
    }

    return res.status(200).json({ id: rows[0].id, variants: [v1.text, v2.text] });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}

function validateReviewSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
  const { customer_name, duration_weeks, start_weight_kg, end_weight_kg, health_issue, customer_words } = snapshot;
  if (typeof customer_name !== 'string' || !customer_name.trim()) return null;
  if (typeof customer_words !== 'string' || !customer_words.trim()) return null;

  const parsedDuration = (duration_weeks === null || duration_weeks === undefined) ? null : parseStrictInt(duration_weeks);
  if (duration_weeks !== null && duration_weeks !== undefined && parsedDuration === null) return null;

  const parsedStart = (start_weight_kg === null || start_weight_kg === undefined) ? null : parseStrictFloat(start_weight_kg);
  if (start_weight_kg !== null && start_weight_kg !== undefined && parsedStart === null) return null;

  const parsedEnd = (end_weight_kg === null || end_weight_kg === undefined) ? null : parseStrictFloat(end_weight_kg);
  if (end_weight_kg !== null && end_weight_kg !== undefined && parsedEnd === null) return null;

  return {
    customer_name: customer_name.trim(),
    duration_weeks: parsedDuration,
    start_weight_kg: parsedStart,
    end_weight_kg: parsedEnd,
    health_issue: (health_issue && String(health_issue).trim()) ? String(health_issue).trim() : null,
    customer_words: customer_words.trim()
  };
}

// -----------------------------------------------------------------------------
// 8. SUMMARY SELECT
// -----------------------------------------------------------------------------
async function handleSummarySelect(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const session = getOwnerSession(req);
  if (!session || !session.center_id) return res.status(401).json({ error: 'Unauthorized' });

  const { id, text, review_snapshot } = req.body || {};
  if (!id || !text || typeof text !== 'string') return res.status(400).json({ error: 'Transformation id and summary text are required' });

  if (!review_snapshot) {
    return res.status(400).json({
      error: 'missing_review_snapshot',
      message: 'Explicit review snapshot covering all editable facts is required.'
    });
  }

  const snapshot = validateReviewSnapshot(review_snapshot);
  if (!snapshot) {
    return res.status(400).json({
      error: 'invalid_review_snapshot',
      message: 'Review snapshot must cover all editable facts (customer_name, duration_weeks, start_weight_kg, end_weight_kg, health_issue, customer_words).'
    });
  }

  const cleanText = text.trim();
  const hits = findBannedTerms(cleanText);
  if (hits.length > 0) {
    return res.status(400).json({
      error: 'claim_blocked',
      message: `Selected text contains prohibited medical terms: ${hits.join(', ')}.`,
      banned_terms: hits
    });
  }

  const { supabaseUrl, serviceKey } = getSupabaseConfig();
  if (!serviceKey) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY missing' });

  try {
    // 1. Fetch current transformation record to verify existence and check factual revision against snapshot
    const fetchUrl = `${supabaseUrl}/rest/v1/transformations?id=eq.${encodeURIComponent(id)}&center_id=eq.${encodeURIComponent(session.center_id)}&select=id,customer_name,duration_weeks,start_weight_kg,end_weight_kg,health_issue,customer_words,status`;
    const fetchRes = await fetch(fetchUrl, {
      headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
    });
    if (!fetchRes.ok) return res.status(502).json({ error: 'Database query failed' });
    const rows = await fetchRes.json();
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Transformation not found or unauthorized' });

    const row = rows[0];
    const factsMatch = (
      row.customer_name === snapshot.customer_name &&
      row.customer_words === snapshot.customer_words &&
      row.duration_weeks === snapshot.duration_weeks &&
      (row.start_weight_kg === null ? snapshot.start_weight_kg === null : Number(row.start_weight_kg) === snapshot.start_weight_kg) &&
      (row.end_weight_kg === null ? snapshot.end_weight_kg === null : Number(row.end_weight_kg) === snapshot.end_weight_kg) &&
      row.health_issue === snapshot.health_issue
    );

    if (!factsMatch) {
      return res.status(409).json({
        error: 'stale_factual_revision',
        message: 'Factual details or metrics were modified after review began. Please review and regenerate the AI summary.'
      });
    }

    // 2. Atomically conditional PATCH: require that DB matches the review snapshot across all editable facts
    let cond = `id=eq.${encodeURIComponent(id)}&center_id=eq.${encodeURIComponent(session.center_id)}`;
    cond += `&customer_name=eq.${encodeURIComponent(snapshot.customer_name)}`;
    cond += `&customer_words=eq.${encodeURIComponent(snapshot.customer_words)}`;
    if (snapshot.duration_weeks === null) cond += `&duration_weeks=is.null`;
    else cond += `&duration_weeks=eq.${snapshot.duration_weeks}`;
    if (snapshot.start_weight_kg === null) cond += `&start_weight_kg=is.null`;
    else cond += `&start_weight_kg=eq.${snapshot.start_weight_kg}`;
    if (snapshot.end_weight_kg === null) cond += `&end_weight_kg=is.null`;
    else cond += `&end_weight_kg=eq.${snapshot.end_weight_kg}`;
    if (snapshot.health_issue === null) cond += `&health_issue=is.null`;
    else cond += `&health_issue=eq.${encodeURIComponent(snapshot.health_issue)}`;

    const updateUrl = `${supabaseUrl}/rest/v1/transformations?${cond}`;
    const updateRes = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ ai_summary: cleanText })
    });
    if (!updateRes.ok) return res.status(502).json({ error: 'Database update failed' });
    const updated = await updateRes.json();
    if (!updated || updated.length === 0) {
      return res.status(409).json({
        error: 'stale_factual_revision',
        message: 'Factual details or metrics were modified concurrently. Summary selection rejected; please regenerate AI summary for the latest text.'
      });
    }
    return res.status(200).json({ success: true, id: updated[0].id, ai_summary: updated[0].ai_summary });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}

// -----------------------------------------------------------------------------
// 9. CONSENT GATE
// -----------------------------------------------------------------------------
async function handleConsent(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const session = getOwnerSession(req);
  if (!session || !session.center_id) return res.status(401).json({ error: 'Unauthorized' });

  const { id, consent_given, consent_name, consent_phone_last4 } = req.body || {};
  if (!id || consent_given !== true || !consent_name || String(consent_phone_last4 || '').replace(/\D/g, '').length < 4) {
    return res.status(400).json({ error: 'Valid customer full name, consent confirmation, and last 4 digits of phone are required' });
  }

  const last4 = String(consent_phone_last4).replace(/\D/g, '').slice(-4);
  const { supabaseUrl, serviceKey } = getSupabaseConfig();
  if (!serviceKey) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY missing' });

  try {
    const updateUrl = `${supabaseUrl}/rest/v1/transformations?id=eq.${encodeURIComponent(id)}&center_id=eq.${encodeURIComponent(session.center_id)}`;
    const updateRes = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        consent_given: true,
        consent_name: consent_name.trim(),
        consent_phone_last4: last4,
        consent_at: new Date().toISOString()
      })
    });
    const updated = await updateRes.json();
    if (!updated || updated.length === 0) return res.status(404).json({ error: 'Transformation not found or unauthorized' });
    return res.status(200).json({
      success: true,
      id: updated[0].id,
      consent_given: true,
      consent_name: updated[0].consent_name,
      consent_phone_last4: updated[0].consent_phone_last4,
      consent_at: updated[0].consent_at
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}

// -----------------------------------------------------------------------------
// 10. PUBLISH
// -----------------------------------------------------------------------------
async function handlePublish(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const session = getOwnerSession(req);
  if (!session || !session.center_id) return res.status(401).json({ error: 'Unauthorized' });

  const { id, review_snapshot } = req.body || {};
  if (!id) return res.status(400).json({ error: 'Transformation id is required' });

  if (!review_snapshot) {
    return res.status(400).json({
      error: 'missing_review_snapshot',
      message: 'Explicit review snapshot covering all editable facts is required.'
    });
  }

  const snapshot = validateReviewSnapshot(review_snapshot);
  if (!snapshot) {
    return res.status(400).json({
      error: 'invalid_review_snapshot',
      message: 'Review snapshot must cover all editable facts (customer_name, duration_weeks, start_weight_kg, end_weight_kg, health_issue, customer_words).'
    });
  }

  const { supabaseUrl, serviceKey } = getSupabaseConfig();
  if (!serviceKey) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY missing' });

  try {
    const fetchUrl = `${supabaseUrl}/rest/v1/transformations?id=eq.${encodeURIComponent(id)}&center_id=eq.${encodeURIComponent(session.center_id)}&select=*`;
    const rowRes = await fetch(fetchUrl, {
      headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
    });
    if (!rowRes.ok) return res.status(502).json({ error: 'Database query failed' });
    const rows = await rowRes.json();
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Transformation record not found or unauthorized' });

    const row = rows[0];
    if (!row.consent_given) return res.status(400).json({ error: 'consent_required', message: 'Cannot publish without customer consent.' });
    if (!row.ai_summary) {
      return res.status(400).json({
        error: 'summary_required',
        message: 'Factual details have been edited or no AI summary selected. Please review and select an AI summary before publishing.'
      });
    }

    const factsMatch = (
      row.customer_name === snapshot.customer_name &&
      row.customer_words === snapshot.customer_words &&
      row.duration_weeks === snapshot.duration_weeks &&
      (row.start_weight_kg === null ? snapshot.start_weight_kg === null : Number(row.start_weight_kg) === snapshot.start_weight_kg) &&
      (row.end_weight_kg === null ? snapshot.end_weight_kg === null : Number(row.end_weight_kg) === snapshot.end_weight_kg) &&
      row.health_issue === snapshot.health_issue
    );

    if (!factsMatch) {
      return res.status(409).json({
        error: 'stale_factual_revision',
        message: 'Factual details or metrics were modified after review began. Please review and republish.'
      });
    }

    const hits = findBannedTerms(row.ai_summary);
    if (hits.length > 0) {
      return res.status(400).json({ error: 'claim_blocked', message: `Publication blocked: Summary contains prohibited terms: ${hits.join(', ')}.` });
    }

    // Atomic conditional update tied to the review snapshot AND consent_given=true AND status=draft:
    // Guarantees that if facts, metrics, summary, or consent were modified concurrently, 0 rows match.
    let cond = `id=eq.${encodeURIComponent(id)}&center_id=eq.${encodeURIComponent(session.center_id)}&status=eq.draft&consent_given=eq.true`;
    cond += `&customer_name=eq.${encodeURIComponent(snapshot.customer_name)}`;
    cond += `&customer_words=eq.${encodeURIComponent(snapshot.customer_words)}`;
    cond += `&ai_summary=eq.${encodeURIComponent(row.ai_summary)}`;
    if (snapshot.duration_weeks === null) cond += `&duration_weeks=is.null`;
    else cond += `&duration_weeks=eq.${snapshot.duration_weeks}`;
    if (snapshot.start_weight_kg === null) cond += `&start_weight_kg=is.null`;
    else cond += `&start_weight_kg=eq.${snapshot.start_weight_kg}`;
    if (snapshot.end_weight_kg === null) cond += `&end_weight_kg=is.null`;
    else cond += `&end_weight_kg=eq.${snapshot.end_weight_kg}`;
    if (snapshot.health_issue === null) cond += `&health_issue=is.null`;
    else cond += `&health_issue=eq.${encodeURIComponent(snapshot.health_issue)}`;

    const updateUrl = `${supabaseUrl}/rest/v1/transformations?${cond}`;
    const updateRes = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ status: 'published' })
    });
    if (!updateRes.ok) return res.status(502).json({ error: 'Database update failed' });
    const updated = await updateRes.json();
    if (!updated || updated.length === 0) {
      return res.status(409).json({
        error: 'stale_factual_revision',
        message: 'Factual details, metrics, summary, or consent were modified concurrently. Publication rejected; please review the updated story before publishing.'
      });
    }

    const publishedRow = updated[0];
    return res.status(200).json({
      success: true,
      id: publishedRow.id,
      status: 'published',
      photo_before_url: `/api/public/photo?id=${publishedRow.id}&kind=before`,
      photo_after_url: `/api/public/photo?id=${publishedRow.id}&kind=after`
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}

// -----------------------------------------------------------------------------
// 11. UNPUBLISH
// -----------------------------------------------------------------------------
async function handleUnpublish(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const session = getOwnerSession(req);
  if (!session || !session.center_id) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.body || {};
  if (!id || typeof id !== 'string' || !UUID_REGEX.test(id)) {
    return res.status(400).json({ error: 'Valid transformation id UUID is required' });
  }

  const { supabaseUrl, serviceKey } = getSupabaseConfig();
  if (!serviceKey) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY missing' });

  try {
    const updateUrl = `${supabaseUrl}/rest/v1/transformations?id=eq.${encodeURIComponent(id)}&center_id=eq.${encodeURIComponent(session.center_id)}`;
    const updateRes = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ status: 'draft', consent_given: false })
    });
    const updated = await updateRes.json();
    if (!updated || updated.length === 0) return res.status(404).json({ error: 'Transformation not found or unauthorized' });

    return res.status(200).json({
      success: true,
      id: updated[0].id,
      status: 'draft',
      consent_given: false,
      message: 'Transformation unpublished and public access revoked immediately.'
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}

// -----------------------------------------------------------------------------
// 12. EDIT (FACTUAL FIELDS)
// -----------------------------------------------------------------------------
async function handleEdit(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const session = getOwnerSession(req);
  if (!session || !session.center_id) return res.status(401).json({ error: 'Unauthorized' });

  const { id, customer_name, duration_weeks, start_weight_kg, end_weight_kg, health_issue, customer_words } = req.body || {};
  if (!id || typeof id !== 'string' || !UUID_REGEX.test(id)) {
    return res.status(400).json({ error: 'Valid transformation id UUID is required' });
  }

  const centerId = session.center_id;
  const { supabaseUrl, serviceKey } = getSupabaseConfig();
  if (!serviceKey) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY missing' });

  // Validate editable fields and enforce exact types and boundaries
  const updates = {};
  if (customer_name !== undefined) {
    if (typeof customer_name !== 'string' || customer_name.trim().length === 0) {
      return res.status(400).json({ error: 'customer_name must be a non-empty string' });
    }
    updates.customer_name = customer_name.trim();
  }

  if (duration_weeks !== undefined) {
    const parsed = parseStrictInt(duration_weeks);
    if (duration_weeks !== null && duration_weeks !== '' && (parsed === null || parsed < 1 || parsed > 520)) {
      return res.status(400).json({ error: 'duration_weeks must be a positive integer between 1 and 520' });
    }
    updates.duration_weeks = parsed;
  }

  if (start_weight_kg !== undefined) {
    const parsed = parseStrictFloat(start_weight_kg);
    if (start_weight_kg !== null && start_weight_kg !== '' && (parsed === null || parsed < 20 || parsed > 500)) {
      return res.status(400).json({ error: 'start_weight_kg must be a valid number between 20 and 500' });
    }
    updates.start_weight_kg = parsed;
  }

  if (end_weight_kg !== undefined) {
    const parsed = parseStrictFloat(end_weight_kg);
    if (end_weight_kg !== null && end_weight_kg !== '' && (parsed === null || parsed < 20 || parsed > 500)) {
      return res.status(400).json({ error: 'end_weight_kg must be a valid number between 20 and 500' });
    }
    updates.end_weight_kg = parsed;
  }

  if (health_issue !== undefined) {
    updates.health_issue = (typeof health_issue === 'string' && health_issue.trim()) ? health_issue.trim() : null;
  }

  if (customer_words !== undefined) {
    if (typeof customer_words !== 'string' || customer_words.trim().length === 0) {
      return res.status(400).json({ error: 'customer_words cannot be empty' });
    }
    updates.customer_words = customer_words.trim();
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid editable fields provided' });
  }

  try {
    // 1. Fetch current transformation
    const getUrl = `${supabaseUrl}/rest/v1/transformations?id=eq.${encodeURIComponent(id)}&center_id=eq.${encodeURIComponent(centerId)}&select=id,status,ai_summary`;
    const getRes = await fetch(getUrl, {
      headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
    });
    if (!getRes.ok) return res.status(502).json({ error: 'Database query failed' });
    const rows = await getRes.json();
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Transformation not found or unauthorized' });
    }
    const current = rows[0];

    // Atomically return factual edits to draft and invalidate stale summary/publication review.
    // Any change to factual customer words or metrics requires fresh owner review before republication.
    // Clears ai_summary without assuming any unmigrated columns.
    updates.status = 'draft';
    updates.ai_summary = null;

    const updateUrl = `${supabaseUrl}/rest/v1/transformations?id=eq.${encodeURIComponent(id)}&center_id=eq.${encodeURIComponent(centerId)}`;
    const updateRes = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(updates)
    });

    if (!updateRes.ok) {
      const err = await updateRes.json().catch(() => ({}));
      return res.status(502).json({ error: 'Database update failed', details: err });
    }

    const updated = await updateRes.json();
    if (!updated || updated.length === 0) {
      return res.status(404).json({ error: 'Transformation not found or unauthorized' });
    }

    return res.status(200).json({
      success: true,
      transformation: updated[0],
      requires_review: true,
      message: 'Factual details updated. Story returned to draft to ensure AI testimonial consistency. Please review and republish.'
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}

// -----------------------------------------------------------------------------
// 13. DELETE (RECORD & ASSOCIATED STORAGE)
// -----------------------------------------------------------------------------
async function handleDelete(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const session = getOwnerSession(req);
  if (!session || !session.center_id) return res.status(401).json({ error: 'Unauthorized' });

  const { id, confirm } = req.body || {};
  if (!id || typeof id !== 'string' || !UUID_REGEX.test(id)) {
    return res.status(400).json({ error: 'Valid transformation id UUID is required' });
  }

  // Strict boolean check: confirm === true
  if (confirm !== true) {
    return res.status(400).json({
      error: 'confirmation_required',
      message: 'Explicit confirmation (confirm === true) is required to delete a transformation.'
    });
  }

  const centerId = session.center_id;
  const { supabaseUrl, serviceKey } = getSupabaseConfig();
  if (!serviceKey) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY missing' });

  try {
    // 1. Fetch record scoped strictly to center_id
    const fetchUrl = `${supabaseUrl}/rest/v1/transformations?id=eq.${encodeURIComponent(id)}&center_id=eq.${encodeURIComponent(centerId)}&select=id,center_id,before_path,after_path`;
    const fetchRes = await fetch(fetchUrl, {
      headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
    });

    if (!fetchRes.ok) return res.status(502).json({ error: 'Database query failed' });
    const rows = await fetchRes.json();
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Transformation not found or unauthorized' });
    }

    const row = rows[0];

    // 2. Delete database record FIRST and confirm deletion before cleanup/return
    const delUrl = `${supabaseUrl}/rest/v1/transformations?id=eq.${encodeURIComponent(id)}&center_id=eq.${encodeURIComponent(centerId)}`;
    const delRes = await fetch(delUrl, {
      method: 'DELETE',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Prefer': 'return=representation'
      }
    });

    if (!delRes.ok) {
      return res.status(502).json({ error: 'Failed to delete transformation record' });
    }
    const deleted = await delRes.json();
    if (!deleted || deleted.length === 0) {
      return res.status(404).json({ error: 'Transformation not found or unauthorized' });
    }

    // 3. Row deletion confirmed.
    // Defer ALL storage deletion: retain all storage objects safely to guarantee
    // zero risk of deleting shared or unrelated customer photos.
    const candidatePaths = [];
    const prefix = `${centerId}/`;
    if (row.before_path && typeof row.before_path === 'string' && row.before_path.startsWith(prefix)) {
      candidatePaths.push(row.before_path);
    }
    if (row.after_path && typeof row.after_path === 'string' && row.after_path.startsWith(prefix)) {
      candidatePaths.push(row.after_path);
    }

    const deferredStorageCleanups = candidatePaths.map(p => ({
      path: p,
      status: 'retained',
      reason: 'storage_deletion_deferred_policy'
    }));

    return res.status(200).json({
      success: true,
      id,
      message: 'Transformation record deleted successfully. Storage objects retained (cleanup deferred).',
      storage_deleted: [],
      storage_cleanup_deferred: deferredStorageCleanups
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}

// -----------------------------------------------------------------------------
// MAIN DISPATCHER
// -----------------------------------------------------------------------------
export default async function handler(req, res) {
  const action = req.query.action || (req.url.split('?')[0].split('/').pop());

  switch (action) {
    case 'ping':
    case 'version':
      return res.status(200).json({ status: 'ok', service: 'pulsezen-owner-api' });
    case 'login-request':
      return handleLoginRequest(req, res);
    case 'login-verify':
      return handleLoginVerify(req, res);
    case 'logout':
      return handleLogout(req, res);
    case 'list':
      return handleList(req, res);
    case 'upload-url':
      return handleUploadUrl(req, res);
    case 'transformation':
      return handleCreateTransformation(req, res);
    case 'summarize':
      return handleSummarize(req, res);
    case 'summary-select':
      return handleSummarySelect(req, res);
    case 'consent':
      return handleConsent(req, res);
    case 'publish':
      return handlePublish(req, res);
    case 'unpublish':
      return handleUnpublish(req, res);
    case 'edit':
      return handleEdit(req, res);
    case 'delete':
      return handleDelete(req, res);
    default:
      return res.status(404).json({ error: `Unknown action: ${action}` });
  }
}
