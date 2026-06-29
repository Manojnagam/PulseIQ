/**
 * /api/gemini — Server-side Google Gemini proxy
 * Keeps GEMINI_API_KEY out of the browser.
 * Accepts: POST { systemPrompt?, userPrompt, model?, maxTokens?, temperature? }
 * Returns: { text: string, model: string }
 */
export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server. Please configure it in your Vercel Environment Variables.' });
  }

  const { systemPrompt, userPrompt, model, maxTokens, temperature } = req.body || {};

  if (!userPrompt) {
    return res.status(400).json({ error: 'userPrompt is required' });
  }

  const targetModel = model || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${key}`;

  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: userPrompt }]
      }
    ],
    generationConfig: {
      maxOutputTokens: maxTokens || 500,
      temperature: temperature !== undefined ? temperature : 0.85
    }
  };

  if (systemPrompt) {
    body.systemInstruction = {
      parts: [{ text: systemPrompt }]
    };
  }

  try {
    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      return res.status(geminiRes.status).json({
        error: data.error?.message || `Gemini API error ${geminiRes.status}`
      });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return res.status(200).json({
      text: text.trim(),
      model: targetModel
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
