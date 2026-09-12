import crypto from 'crypto';
import { getOwnerSession, getSupabaseConfig, findBannedTerms } from './_owner-helper.js';
import { signOwnerSession } from './_session.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const SYSTEM_PROMPT = `You are a factual, honest testimonial editor.
You must strictly enforce ALL of these rules without exception:
1. Rewrite ONLY the text supplied in customer_words. Do not add any fact, number, symptom, or outcome not present in the input.
2. Output in the first person ("I"), as the customer, maximum 45 words, simple English.
3. Never claim to cure, treat, reverse or heal any disease. Never use any of these words: cure, cured, cures, treat, treats, heal, heals, reverse, reversed, medicine, medical, doctor, prescription, diabetes-free, disease-free.
4. Never mention "Herbalife" or any brand name.
5. Output plain text only. No quotes, no markdown, no emoji.`;

function getSessionSecret() {
  return process.env.OWNER_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'pulsezen_owner_fallback_secret_key_2026';
}

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

// -----------------------------------------------------------------------------
// 1. LOGIN REQUEST
// -----------------------------------------------------------------------------
async function handleLoginRequest(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const sessionSecret = getSessionSecret();
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
    const emailRows = await emailRes.json();
    if (Array.isArray(emailRows) && emailRows.length >= 8) {
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
      const ipRows = await ipRes.json();
      if (Array.isArray(ipRows) && ipRows.length >= 20) {
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
      });
      return res.status(503).json({
        error: 'service_unavailable',
        message: 'Email delivery service is currently unavailable. Please contact support.'
      });
    }

    const lookupUrl = `${supabaseUrl}/rest/v1/owner_users?email=eq.${encodeURIComponent(normalizedEmail)}&status=eq.active&select=id,center_id`;
    const lookupRes = await fetch(lookupUrl, {
      headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
    });
    const users = await lookupRes.json();
    const userExists = Array.isArray(users) && users.length > 0;

    // If user does not exist, record rate-limiting attempt (without usable OTP) and return anti-enumeration response
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
      });
      return res.status(200).json({
        success: true,
        message: 'If this email is registered, a verification code has been sent.'
      });
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    const hmac = crypto.createHmac('sha256', sessionSecret);
    hmac.update(`${normalizedEmail}:${otp}`);
    const codeHash = hmac.digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Step 1: Persist attempt record BEFORE dispatching email. If persistence fails, abort before email is sent
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
        invalidated: false,
        expires_at: expiresAt
      })
    });

    if (!attemptInsertRes.ok) {
      console.error('[PulseZen Auth] Failed to persist OTP attempt; aborting email dispatch');
      return res.status(500).json({ error: 'internal_error', message: 'Unable to process login request. Please try again.' });
    }

    const insertedRows = await attemptInsertRes.json().catch(() => []);
    const attemptId = insertedRows && insertedRows[0] ? insertedRows[0].id : null;

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
      console.error('[PulseZen Auth] Failed to deliver verification code via email provider');
    }

    // Step 3: If email delivery failed, invalidate the persisted attempt and fail closed
    if (!emailSent) {
      if (attemptId) {
        try {
          await fetch(`${supabaseUrl}/rest/v1/owner_login_attempts?id=eq.${encodeURIComponent(attemptId)}`, {
            method: 'PATCH',
            headers: {
              'apikey': serviceKey,
              'Authorization': `Bearer ${serviceKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              consumed: true,
              invalidated: true,
              success: false
            })
          });
        } catch (patchErr) {
          console.error('[PulseZen Auth] Failed to invalidate un-delivered attempt in persistence store');
        }
      }
      return res.status(502).json({
        error: 'delivery_failed',
        message: 'Unable to deliver verification code. Please try again later.'
      });
    }

    // Step 4: Email delivery succeeded; mark attempt as successful
    if (attemptId) {
      await fetch(`${supabaseUrl}/rest/v1/owner_login_attempts?id=eq.${encodeURIComponent(attemptId)}`, {
        method: 'PATCH',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ success: true })
      }).catch(() => {});
    }

    return res.status(200).json({
      success: true,
      message: 'If this email is registered, a verification code has been sent.'
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

  const sessionSecret = getSessionSecret();
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
    const failRows = await failRes.json();
    if (Array.isArray(failRows) && failRows.length >= 5) {
      return res.status(429).json({
        error: 'account_locked',
        message: 'Too many failed verification attempts. Please wait 15 minutes before trying again.'
      });
    }

    const userUrl = `${supabaseUrl}/rest/v1/owner_users?email=eq.${encodeURIComponent(normalizedEmail)}&status=eq.active&select=id,center_id,email`;
    const userRes = await fetch(userUrl, {
      headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
    });
    const users = await userRes.json();
    const user = Array.isArray(users) && users.length > 0 ? users[0] : null;

    if (!user) {
      await recordVerifyAttempt(supabaseUrl, serviceKey, normalizedEmail, clientIp, false);
      return res.status(401).json({ error: 'invalid_credentials', message: 'Invalid verification code or email' });
    }

    const nowIso = new Date().toISOString();
    // Use invalidated=not.eq.true for NULL safety across legacy rows
    const otpUrl = `${supabaseUrl}/rest/v1/owner_login_attempts?email=eq.${encodeURIComponent(normalizedEmail)}&attempt_type=eq.request_otp&consumed=eq.false&invalidated=not.eq.true&expires_at=gt.${encodeURIComponent(nowIso)}&order=created_at.desc&limit=5`;
    const otpRes = await fetch(otpUrl, {
      headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
    });
    const otps = await otpRes.json();
    if (!Array.isArray(otps) || otps.length === 0) {
      await recordVerifyAttempt(supabaseUrl, serviceKey, normalizedEmail, clientIp, false);
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
      await recordVerifyAttempt(supabaseUrl, serviceKey, normalizedEmail, clientIp, false);
      return res.status(401).json({ error: 'invalid_code', message: 'Invalid verification code. Please check your latest email.' });
    }

    // Atomic conditional consumption under concurrency:
    // Only the request that successfully updates consumed from false -> true RETURNING * is granted the session.
    const consumeRes = await fetch(
      `${supabaseUrl}/rest/v1/owner_login_attempts?id=eq.${encodeURIComponent(matchingOtp.id)}&consumed=eq.false`,
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
    if (!Array.isArray(consumedRows) || consumedRows.length === 0) {
      // Concurrency collision: another request already consumed this OTP in a race
      await recordVerifyAttempt(supabaseUrl, serviceKey, normalizedEmail, clientIp, false);
      return res.status(401).json({ error: 'code_expired_or_invalid', message: 'Verification code has already been used or expired.' });
    }

    // Cleanup: Invalidate any remaining active OTPs for this email in the background
    fetch(`${supabaseUrl}/rest/v1/owner_login_attempts?email=eq.${encodeURIComponent(normalizedEmail)}&attempt_type=eq.request_otp&consumed=eq.false`, {
      method: 'PATCH',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ consumed: true, invalidated: true })
    }).catch(() => {});

    await recordVerifyAttempt(supabaseUrl, serviceKey, normalizedEmail, clientIp, true);

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
        consumed: false,
        invalidated: false
      })
    });
  } catch (e) {}
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
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    if (!signRes.ok) {
      const err = await signRes.json().catch(() => ({}));
      return res.status(502).json({ error: 'Failed to create signed upload URL', details: err });
    }
    const data = await signRes.json();
    const rawUrl = data.url || '';
    const uploadPath = rawUrl.startsWith('/storage/v1')
      ? rawUrl
      : `/storage/v1${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
    return res.status(200).json({ upload_url: `${supabaseUrl}${uploadPath}`, path: targetPath, token: data.token });
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
    const insertPayload = {
      center_id: centerId,
      customer_name: customer_name.trim(),
      before_path,
      after_path,
      duration_weeks: parseOptionalInt(duration_weeks),
      start_weight_kg: parseOptionalFloat(start_weight_kg),
      end_weight_kg: parseOptionalFloat(end_weight_kg),
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

// -----------------------------------------------------------------------------
// 8. SUMMARY SELECT
// -----------------------------------------------------------------------------
async function handleSummarySelect(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const session = getOwnerSession(req);
  if (!session || !session.center_id) return res.status(401).json({ error: 'Unauthorized' });

  const { id, text } = req.body || {};
  if (!id || !text || typeof text !== 'string') return res.status(400).json({ error: 'Transformation id and summary text are required' });

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
    const updateUrl = `${supabaseUrl}/rest/v1/transformations?id=eq.${encodeURIComponent(id)}&center_id=eq.${encodeURIComponent(session.center_id)}`;
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
    const updated = await updateRes.json();
    if (!updated || updated.length === 0) return res.status(404).json({ error: 'Transformation not found or unauthorized' });
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

  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'Transformation id is required' });

  const { supabaseUrl, serviceKey } = getSupabaseConfig();
  if (!serviceKey) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY missing' });

  try {
    const fetchUrl = `${supabaseUrl}/rest/v1/transformations?id=eq.${encodeURIComponent(id)}&center_id=eq.${encodeURIComponent(session.center_id)}&select=*`;
    const rowRes = await fetch(fetchUrl, {
      headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
    });
    const rows = await rowRes.json();
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Transformation record not found or unauthorized' });

    const row = rows[0];
    if (!row.consent_given) return res.status(400).json({ error: 'consent_required', message: 'Cannot publish without customer consent.' });
    if (!row.ai_summary) return res.status(400).json({ error: 'summary_required', message: 'Cannot publish without selecting a compliant AI summary.' });

    const hits = findBannedTerms(row.ai_summary);
    if (hits.length > 0) {
      return res.status(400).json({ error: 'claim_blocked', message: `Publication blocked: Summary contains prohibited terms: ${hits.join(', ')}.` });
    }

    const updateUrl = `${supabaseUrl}/rest/v1/transformations?id=eq.${encodeURIComponent(id)}&center_id=eq.${encodeURIComponent(session.center_id)}`;
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
    const updated = await updateRes.json();
    const publishedRow = updated && updated[0] ? updated[0] : row;

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
    default:
      return res.status(404).json({ error: `Unknown action: ${action}` });
  }
}
