export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // B1 Fix: Clear session cookie via Set-Cookie Max-Age=0, HttpOnly, Secure, SameSite=Lax
  const clearCookie = 'pz_owner_session=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax';
  res.setHeader('Set-Cookie', clearCookie);

  return res.status(200).json({ success: true, message: 'Logged out successfully' });
}
