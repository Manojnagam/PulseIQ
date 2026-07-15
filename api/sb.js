// Vercel Serverless Proxy for Supabase
// Allows app.pulsezen.in to bypass adblockers, Brave Shields, and network blocks against *.supabase.co
const DEFAULT_TARGET = 'https://erteibdxzdvsaujptxsd.supabase.co';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'apikey, Authorization, Content-Type, Prefer');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const targetBase = DEFAULT_TARGET.replace(/\/$/, '');
    const path = req.url.replace(/^\/api\/sb/, '');
    const targetUrl = targetBase + path;

    const headers = {};
    if (req.headers['apikey']) headers['apikey'] = req.headers['apikey'];
    if (req.headers['authorization']) headers['Authorization'] = req.headers['authorization'];
    if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];
    if (req.headers['prefer']) headers['Prefer'] = req.headers['prefer'];

    const fetchOpts = {
      method: req.method,
      headers: headers
    };

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.body) {
      fetchOpts.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const sbRes = await fetch(targetUrl, fetchOpts);
    const contentType = sbRes.headers.get('content-type') || '';

    res.status(sbRes.status);
    if (contentType.includes('application/json')) {
      const data = await sbRes.json();
      return res.json(data);
    } else {
      const text = await sbRes.text();
      return res.send(text);
    }
  } catch (err) {
    console.error('Supabase proxy error:', err);
    return res.status(502).json({ error: 'Proxy error connecting to Supabase', details: err.message });
  }
}