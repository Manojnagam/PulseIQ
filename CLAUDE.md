# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Deployment

**Primary working file**: `index.html` — always edit this, not `PulseIQ-v8 (1).html`

Before deploying:
1. Copy `index.html` → `deploy/index.html` (the Vercel deploy target)
2. Run `npx vercel --prod` from the repo root (or `./deploy-all.sh` to deploy all sub-projects in parallel)

Sub-projects each have their own `vercel.json` and are deployed independently:
- Root (`app.pulsezen.in`) — supervisor dashboard (`index.html`)
- `pulsezen/` — public wellness center website
- `coaches/`, `clients/`, `dharanis/`, `bksprime/` — per-center or role-specific sub-apps

**Supabase Edge Function deployment**:
```sh
supabase functions deploy bulk-diet
supabase secrets set GROQ_API_KEY=gsk_...
```

## Environment Variables

See `.env.example` for all keys. For Vercel, manage via `vercel env`.

- `GROQ_API_KEY` — server-side only, used by `/api/groq.js` Vercel Function proxy
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` — publishable, stored in `localStorage` after first setup
- `SUPABASE_SERVICE_ROLE_KEY` — Edge Functions only, never sent to browser

## Architecture

### Single-file SPA (`index.html`)
The entire supervisor dashboard is one HTML file (~1MB). Navigation works by showing/hiding sections via `goTo(sectionId)` — each section is a `<div class="sec">` that gets the `.active` class.

**Global state object `D`** holds all loaded data:
```js
D = { centers[], customers[], attendance[], coaches[], inventory[], body[], finance[], ... }
```

**DB helpers** wrap Supabase REST API:
- `req(method, table, body, params)` — low-level fetch with JWT auth header
- `dbGet(table, params)` → array
- `dbInsert(table, obj)`, `dbUpdate(table, id, obj)`, `dbDelete(table, id)`

**Active center filtering**: `ACTIVE_CENTER` global (UUID or `null` for all). Use `filterByCenter()` for tables with `wellness_center_id`. For finance specifically use `filterFinanceByCenter()`. For customer-joined tables use `filterByCenterViaCustomer()`.

**Searchable dropdowns**: generic system — `sdInit(inputEl, dropEl)`, `sdRender(dropEl, items)`, `sdPick(cb)`, `sdSetItems(dropEl, items)`.

**Performance**: `parsePack()` + `_daysLeftCache` memoize pack expiry calculations. `_aiInFlight` guard prevents duplicate Groq requests.

### API Routes (`/api/`)
Vercel Serverless Functions (Node.js):
- `groq.js` — POST proxy for Groq chat completions; accepts `{ systemPrompt?, userPrompt, model?, maxTokens?, temperature? }`, returns `{ text, model }`
- `groq-models.js` — GET, lists available Groq models

### Supabase Edge Functions (`/supabase/functions/`)
Deno runtime. Currently:
- `bulk-diet` — generates 7-day diet plans for multiple customers via Groq, with 800ms delay between calls to respect rate limits

### Other HTML Apps
- `register.html` — invite-based center registration, auto-links new center via `upline_center_id`
- `coach.html` — coach-facing view
- `client.html` — customer-facing view
- `pulsezen/` — public website for wellness centers (separate Vercel project)

## Database Schema (Supabase/PostgreSQL)

12 tables: `wellness_centers`, `customers`, `attendance`, `body_composition`, `finance`, `coaches`, `inventory_stock_in`, `inventory_stock_out`, `inventory_daily_usage`, `inventory_balance`, `coupons`, `payments`, `pack_history`

Key relationships:
- `customers.wellness_center_id` → `wellness_centers.id`
- `finance.wellness_center_id` → `wellness_centers.id` (requires migration if not present)
- `wellness_centers.upline_center_id` → `wellness_centers.id` (self-referential for org tree)
- `coupons.coach_id` stores both coach IDs and customer IDs (dual-use column)

**Pending migration** (run in Supabase SQL editor if not done):
```sql
ALTER TABLE finance ADD COLUMN IF NOT EXISTS wellness_center_id uuid references wellness_centers(id);
```

## Authentication

- **Email OTP login**: 6-digit code via Resend + Supabase Edge Function. After OTP login, `_authSession` is set and PIN prompt is skipped.
- **PIN auth**: Center-level PINs + supervisor master PIN stored/checked via `checkStartupAuth()`. Center-PIN users get restricted section access.
- **JWT**: Supabase JWT is included in all `req()` calls via `Authorization: Bearer` header.

## SaaS Plans (PLANS.md)

Free (₹0) → Growth (₹499/mo) → Elite (₹999, hidden) → President (₹1999, hidden). Launch order: Free first, then Growth when 5–10 centers are active.
