/**
 * /api/analyze — Server-side AI Wellness Scan & Consultation analyst
 * Keeps GROQ_API_KEY secure.
 * Accepts: POST { age, gender, weight, bmi, bodyFat, visceralFat, muscleMass, energyLevels, dietHydration, digestionIssues, primaryGoal }
 * Returns: Structured JSON report
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

  const {
    age,
    gender,
    weight,
    bmi,
    bodyFat,
    visceralFat,
    muscleMass,
    energyLevels,
    dietHydration,
    digestionIssues,
    primaryGoal
  } = req.body || {};

  // Formulate the prompt dynamically based on individual parameters
  const userPrompt = `
Here is the client data to analyze:
- Age/Gender: ${age || 'Unknown'}, ${gender || 'Unknown'}
- Weight / BMI: ${weight || 'Unknown'} kg / ${bmi || 'Unknown'}
- Body Fat % / Visceral Fat Level: ${bodyFat || 'Unknown'}% / Level ${visceralFat || 'Unknown'}
- Muscle Mass / Skeletal Muscle: ${muscleMass || 'Unknown'}
- How they feel / Energy levels: ${energyLevels || 'Unknown'}
- Diet & Hydration: ${dietHydration || 'Unknown'}
- Digestion / Health Issues: ${digestionIssues || 'Unknown'}
- Primary Goal: ${primaryGoal || 'Unknown'}
`;

  const systemPrompt = `
Act as an expert clinical nutritionist and wellness consultant. Analyze the client's body composition and lifestyle data.

Your job is to return a strictly structured JSON object. Do not include any conversational filler, markdown formatting blocks (like \`\`\`json), or prose outside the JSON.

The JSON structure MUST follow this exact schema:
{
  "client_summary": {
    "status": "String summarizing current health bracket",
    "primary_concern": "String highlighting the biggest single risk factor"
  },
  "health_risk_report": {
    "metabolic_risks": "String detailing BMI, visceral fat impact, and metabolic rate risks",
    "energy_and_fatigue_analysis": "String explaining the root causes of their fatigue and energy crashes",
    "digestive_analysis": "String explaining how their diet, hydration, and symptoms like bloating/acidity interlink"
  },
  "empathic_communication_strategy": {
    "recommended_tone": "String describing how to talk to them (e.g., encouraging, non-judgmental)",
    "icebreaker_phrases": ["Array of 2-3 specific opening sentences to start the conversation smoothly"]
  },
  "nutrient_gaps": ["Array of tags representing what their body needs. Choose ONLY from these exact tags: 'low_protein', 'breakfast_replacement', 'calorie_deficit', 'digestive_soothing', 'hydration_boost', 'cellular_energy'"]
}
`;

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 1000,
        temperature: 0.3, // Lower temperature to ensure strict JSON adherence
        response_format: { type: "json_object" } // Enforce JSON output format
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

    // Try parsing the text content to make sure it's valid JSON before returning
    const textContent = data.choices[0].message.content.trim();
    try {
      const parsedJson = JSON.parse(textContent);
      return res.status(200).json(parsedJson);
    } catch (parseError) {
      // In case it has markdown markers or is malformed, we send it as text so client can try to parse or handle
      console.error("JSON parsing error on Groq output:", parseError, textContent);
      return res.status(500).json({ error: "Failed to parse AI output as JSON", raw: textContent });
    }
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
