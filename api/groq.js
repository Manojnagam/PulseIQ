/**
 * /api/groq — Server-side Groq proxy
 * Keeps GROQ_API_KEY out of the browser.
 * Accepts: POST { systemPrompt?, userPrompt, model?, maxTokens?, temperature? }
 * Returns: { text: string }
 */
export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = process.env.GROQ_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'GROQ_API_KEY not configured on server' });
  }

  const { systemPrompt, userPrompt, model, maxTokens, temperature } = req.body || {};

  if (!userPrompt) {
    return res.status(400).json({ error: 'userPrompt is required' });
  }

  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: userPrompt });

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: model || 'llama-3.3-70b-versatile',
        messages,
        max_tokens: maxTokens || 500,
        temperature: temperature !== undefined ? temperature : 0.85
      })
    });

    const data = await groqRes.json();

    if (!groqRes.ok) {
      return res.status(groqRes.status).json({
        error: data.error?.message || `Groq API error ${groqRes.status}`
      });
    }

    if (data.error) {
      return res.status(400).json({ error: data.error.message });
    }

    return res.status(200).json({
      text: data.choices[0].message.content.trim(),
      model: data.model
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
