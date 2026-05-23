/**
 * /api/groq-models — Verifies the server-side Groq key is valid
 * Returns the list of available models from Groq.
 * Used by testGroqKey() in the UI.
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = process.env.GROQ_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'GROQ_API_KEY not configured on server' });
  }

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${key}` }
    });

    const data = await groqRes.json();

    if (!groqRes.ok) {
      return res.status(groqRes.status).json({
        error: data.error?.message || `Auth failed (HTTP ${groqRes.status})`
      });
    }

    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
