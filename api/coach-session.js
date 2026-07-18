import { signSession } from './_session.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { coach_id, pin } = req.body || {};

  if (!coach_id || !pin) {
    return res.status(400).json({ error: 'coach_id and pin are required' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || 'https://erteibdxzdvsaujptxsd.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    return res.status(500).json({ error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is missing' });
  }

  try {
    // Look up coach using the Service Role Key
    const fetchUrl = `${supabaseUrl}/rest/v1/coaches?id=eq.${coach_id}&select=id,coach_pin,wellness_center_id`;
    const sbRes = await fetch(fetchUrl, {
      method: 'GET',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!sbRes.ok) {
      return res.status(502).json({ error: 'Failed to fetch coach from database' });
    }

    const coaches = await sbRes.json();
    
    if (!coaches || coaches.length === 0) {
      return res.status(401).json({ error: 'Invalid PIN' });
    }

    const coach = coaches[0];

    // Verify PIN matches
    if (coach.coach_pin !== pin) {
      return res.status(401).json({ error: 'Invalid PIN' });
    }

    // PIN is valid, generate signed token
    const payload = {
      coach_id: coach.id,
      center_id: coach.wellness_center_id,
      role: 'coach'
    };
    
    const token = signSession(payload, 28800); // 8 hours

    return res.status(200).json({ token });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
