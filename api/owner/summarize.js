import { getOwnerSession, getSupabaseConfig, findBannedTerms, BANNED_TERMS } from './_owner-helper.js';

const SYSTEM_PROMPT = `You are a factual, honest testimonial editor.
You must strictly enforce ALL of these rules without exception:
1. Rewrite ONLY the text supplied in customer_words. Do not add any fact, number, symptom, or outcome not present in the input.
2. Output in the first person ("I"), as the customer, maximum 45 words, simple English.
3. Never claim to cure, treat, reverse or heal any disease. Never use any of these words: cure, cured, cures, treat, treats, heal, heals, reverse, reversed, medicine, medical, doctor, prescription, diabetes-free, disease-free.
4. Never mention "Herbalife" or any brand name.
5. Output plain text only. No quotes, no markdown, no emoji.`;

async function callGroqVariant(groqKey, customerWords, styleHint) {
  let attempt = 0;
  let lastRawOutput = '';
  let lastHits = [];

  while (attempt < 2) {
    attempt++;
    const userPrompt = attempt === 1
      ? `${styleHint}\nRewrite ONLY the following customer words:\n${customerWords}`
      : `IMPORTANT: The previous attempt contained prohibited medical/curative claims. You MUST NOT use words like cure, treat, heal, reverse, medicine, medical, doctor, prescription, diabetes-free, disease-free. Do not invent any numbers.\nRewrite ONLY the following customer words in simple English under 45 words:\n${customerWords}`;

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
    let text = (data.choices?.[0]?.message?.content || '').trim();
    text = text.replace(/^["'`]|["'`]$/g, '').trim();
    lastRawOutput = text;

    // Server-side post-filter scan
    const hits = findBannedTerms(text);
    if (hits.length === 0) {
      return { ok: true, text, rawOutput: text, hits: [] };
    }
    lastHits = hits;
  }

  return {
    ok: false,
    text: lastRawOutput,
    rawOutput: lastRawOutput,
    hits: lastHits,
    filterDecision: `Blocked: output contains banned term(s) [${lastHits.join(', ')}] after 2 generation attempts.`
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Validate session cookie BEFORE any DB call
  const session = getOwnerSession(req);
  if (!session || !session.center_id) {
    return res.status(401).json({ error: 'Unauthorized: Valid owner session required' });
  }

  const { id } = req.body || {};
  if (!id) {
    return res.status(400).json({ error: 'Transformation id is required' });
  }

  const { supabaseUrl, serviceKey } = getSupabaseConfig();
  const groqKey = process.env.GROQ_API_KEY;

  if (!serviceKey) {
    return res.status(500).json({ error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY missing' });
  }
  if (!groqKey) {
    return res.status(500).json({ error: 'Server misconfiguration: GROQ_API_KEY missing' });
  }

  try {
    // 2. Load row scoped to session center_id
    const fetchUrl = `${supabaseUrl}/rest/v1/transformations?id=eq.${encodeURIComponent(id)}&center_id=eq.${encodeURIComponent(session.center_id)}&select=*`;
    const rowRes = await fetch(fetchUrl, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!rowRes.ok) {
      return res.status(502).json({ error: 'Database query failed' });
    }

    const rows = await rowRes.json();
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Transformation record not found' });
    }

    const row = rows[0];
    const customerWords = row.customer_words;

    // 3. Generate 2 variants with server-side post-filter
    const v1 = await callGroqVariant(
      groqKey,
      customerWords,
      'Variant 1: Express feeling lighter, consistent habits, and personal well-being in simple first-person.'
    );

    if (!v1.ok) {
      return res.status(400).json({
        error: 'claim_blocked',
        message: "The customer's words contain medical or curative claims which cannot be published. Please rewrite without medical claims.",
        raw_output: v1.rawOutput,
        filter_decision: v1.filterDecision,
        banned_terms: v1.hits
      });
    }

    const v2 = await callGroqVariant(
      groqKey,
      customerWords,
      'Variant 2: Express daily routine, energy to do everyday tasks, and positive personal changes in simple first-person.'
    );

    if (!v2.ok) {
      return res.status(400).json({
        error: 'claim_blocked',
        message: "The customer's words contain medical or curative claims which cannot be published. Please rewrite without medical claims.",
        raw_output: v2.rawOutput,
        filter_decision: v2.filterDecision,
        banned_terms: v2.hits
      });
    }

    // Do NOT save until owner picks one
    return res.status(200).json({
      id: row.id,
      variants: [v1.text, v2.text]
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
