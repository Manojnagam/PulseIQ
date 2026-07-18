import crypto from 'crypto';

export function signSession(payload, expiresInSeconds) {
  const secret = process.env.APP_SESSION_SECRET;
  if (!secret) {
    throw new Error('APP_SESSION_SECRET is not configured');
  }

  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const data = {
    ...payload,
    exp: exp
  };

  const dataString = Buffer.from(JSON.stringify(data)).toString('base64url');
  
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(dataString);
  const signature = hmac.digest('base64url');

  return `${dataString}.${signature}`;
}

export function verifySession(token) {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const secret = process.env.APP_SESSION_SECRET;
  if (!secret) {
    throw new Error('APP_SESSION_SECRET is not configured');
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
    
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
      return null;
    }
    
    return payload;
  } catch (err) {
    return null;
  }
}
