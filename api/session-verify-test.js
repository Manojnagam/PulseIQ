import { verifySession } from './_session.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.headers['x-app-session'];
  
  if (!token) {
    return res.status(400).json({ valid: false, error: 'Missing x-app-session header' });
  }

  try {
    const payload = verifySession(token);
    
    if (payload) {
      return res.status(200).json({ valid: true, payload });
    } else {
      return res.status(401).json({ valid: false, error: 'Invalid or expired token' });
    }
  } catch (error) {
    return res.status(500).json({ valid: false, error: error.message });
  }
}
