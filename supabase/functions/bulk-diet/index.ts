/**
 * Supabase Edge Function: bulk-diet
 * Generates 7-day diet plans for multiple customers via Groq AI.
 * Runs server-side — handles the 800ms delays and Groq calls without browser timeouts.
 *
 * Deploy: supabase functions deploy bulk-diet
 * Secrets: supabase secrets set GROQ_API_KEY=gsk_...
 *
 * POST body: { customerIds: string[], foodsDb: Food[] }
 * Returns:   { done: number, failed: number, errors: string[] }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'llama-3.3-70b-versatile'
const DELAY_MS = 800 // respect Groq rate limits

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Food {
  name: string
  calories: number
  protein: number
  carbs: number
  fiber: number
  fat: number
  meal_time: string
  category: string
}

interface Customer {
  id: string
  name: string
  goal: string
  diet_type: string
  activity_level: string
  training_type: string
  protein_ratio: string | number
  height: string | number
  age: string | number
  dob: string
  gender: string
}

interface BodyRecord {
  customer_id: string
  weight: string | number
  date: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const groqKey = Deno.env.get('GROQ_API_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  if (!groqKey) {
    return new Response(JSON.stringify({ error: 'GROQ_API_KEY secret not set' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  let body: { customerIds: string[]; foodsDb: Food[] }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const { customerIds, foodsDb } = body

  if (!customerIds?.length) {
    return new Response(JSON.stringify({ error: 'customerIds array is required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Fetch customer + body records from Supabase
  const [{ data: customers }, { data: bodyRecs }] = await Promise.all([
    supabase.from('customers').select('*').in('id', customerIds),
    supabase.from('body_composition').select('customer_id, weight, date')
      .in('customer_id', customerIds).order('date', { ascending: false })
  ])

  const results = { done: 0, failed: 0, errors: [] as string[] }

  for (const c of (customers as Customer[]) || []) {
    try {
      const cBodyRecs = ((bodyRecs as BodyRecord[]) || []).filter(b => b.customer_id === c.id)
      const latestWeight = cBodyRecs[0]?.weight ? parseFloat(String(cBodyRecs[0].weight)) : null
      const height = parseFloat(String(c.height)) || null
      const age = c.age
        ? parseInt(String(c.age))
        : c.dob
        ? Math.floor((Date.now() - new Date(c.dob).getTime()) / (365.25 * 24 * 3600 * 1000))
        : null
      const gender = (c.gender || '').toLowerCase()
      const goal = c.goal || 'Weight Loss'
      const dietType = c.diet_type || 'veg'
      const activity = c.activity_level || 'light'
      const proteinRatio = parseFloat(String(c.protein_ratio)) || 2.0

      if (!latestWeight || !height || !age) {
        results.errors.push(`${c.name}: missing weight/height/age`)
        results.failed++
        continue
      }

      const rmr = 10 * latestWeight + 6.25 * height - 5 * age + (gender === 'female' ? -161 : 5)
      const actMult: Record<string, number> = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 }
      const tdee = Math.round(rmr * (actMult[activity] || 1.375))
      const isWL = goal.toLowerCase().includes('loss')
      const targetCal = isWL ? Math.round(tdee - 400) : Math.round(tdee + 400)
      const targetProtein = Math.round(latestWeight * proteinRatio)

      // Filter available foods
      const foods = (foodsDb || []).filter(f => !(dietType === 'veg' && f.category === 'non-veg'))
      const foodList = foods.map(f =>
        `${f.name} (Cal:${f.calories} Protein:${f.protein}g Carbs:${f.carbs}g Fat:${f.fat}g per 100g, best for: ${f.meal_time})`
      ).join('\n')

      const dayTpl = '{"mid_morning":{"name":"","grams":0,"calories":0,"protein":0},"lunch":[{"name":"","grams":0,"calories":0,"protein":0}],"evening":{"name":"","grams":0,"calories":0,"protein":0},"dinner":[{"name":"","grams":0,"calories":0,"protein":0}],"total_calories":0,"total_protein":0}'

      const prompt = `You are a sports nutritionist at a nutrition wellness center in India. Create a 7-day meal plan (Monday to Sunday) for this client.\n\nClient: ${c.name}\nGoal: ${goal}\nDiet: ${dietType === 'veg' ? 'Vegetarian' : 'Non-Vegetarian'}\nTarget: ${targetCal} kcal/day | ${targetProtein}g protein/day (${proteinRatio}g/kg)\nWeight: ${latestWeight}kg | Height: ${height}cm | Age: ${age}\n\nRULES:\n- Breakfast is ALWAYS Protein Shake — do NOT include in JSON\n- Pick ONLY from the food list below\n- Specify exact grams for each item\n- Each day: Mid-Morning Snack (1 item), Lunch (2-3 items), Evening Snack (1 item), Dinner (2-3 items)\n- Vary meals across days\n- Must hit ${targetProtein}g protein/day\n\nAVAILABLE FOODS:\n${foodList}\n\nReturn ONLY valid JSON:\n{"target_calories":${targetCal},"target_protein":${targetProtein},"goal":"${goal}","protein_ratio":${proteinRatio},"note":"","days":{"monday":${dayTpl},"tuesday":${dayTpl},"wednesday":${dayTpl},"thursday":${dayTpl},"friday":${dayTpl},"saturday":${dayTpl},"sunday":${dayTpl}}}`

      const groqRes = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
        body: JSON.stringify({ model: GROQ_MODEL, messages: [{ role: 'user', content: prompt }], temperature: 0.3 })
      })

      if (!groqRes.ok) throw new Error(`Groq ${groqRes.status}`)

      const groqData = await groqRes.json()
      const raw: string = groqData.choices[0].message.content.trim()
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('AI did not return valid JSON')

      const plan = JSON.parse(jsonMatch[0])
      plan.generated = new Date().toISOString().split('T')[0]
      plan.client_name = c.name

      const { error: updateErr } = await supabase
        .from('customers')
        .update({ diet_plan: JSON.stringify(plan) })
        .eq('id', c.id)

      if (updateErr) throw new Error(`DB write failed: ${updateErr.message}`)

      results.done++
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      results.errors.push(`${c.name}: ${msg}`)
      results.failed++
    }

    // Respect Groq rate limits
    await new Promise(r => setTimeout(r, DELAY_MS))
  }

  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})
