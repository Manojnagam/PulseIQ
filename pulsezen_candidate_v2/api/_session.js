import crypto from 'crypto';

export function getSessionSecret() {
  const secret = process.env.OWNER_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || typeof secret !== 'string' || secret.trim().length === 0) {
    return null;
  }
  return secret;
}

export function signOwnerSession(payload, expiresInSeconds = 604800) {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error('Session signing secret is not configured');
  }

  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const data = {
    ...payload,
    typ: 'owner',
    exp
  };

  const dataString = Buffer.from(JSON.stringify(data)).toString('base64url');
  
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(dataString);
  const signature = hmac.digest('base64url');

  return `${dataString}.${signature}`;
}

export function verifyOwnerSession(token) {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const secret = getSessionSecret();
  if (!secret) {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }

  const dataString = parts[0];
  const signature = parts[1];

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(dataString);
  const expectedSignature = hmac.digest('base64url');

  try {
    const sigBuf = Buffer.from(signature, 'base64url');
    const expectedBuf = Buffer.from(expectedSignature, 'base64url');
    
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }
  } catch (err) {
    return null;
  }

  try {
    const payloadJson = Buffer.from(dataString, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson);
    
    // Reject if exp is missing or expired
    if (!payload.exp || typeof payload.exp !== 'number' || Math.floor(Date.now() / 1000) > payload.exp) {
      return null;
    }

    // B13: Type-confusion guard: reject any token that is not explicitly typ='owner'
    if (payload.typ !== 'owner') {
      return null;
    }
    
    return payload;
  } catch (err) {
    return null;
  }
}
