# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Deployment

**Primary working file**: `index.html` — always edit this, not `PulseIQ-v8 (1).html`

Before deploying:
1. Copy `index.html` → `deploy/index.html` (kept in sync as a backup)
2. Run `vercel --prod` from the **repo root** — this deploys the root `pulseiq` project to `app.pulsezen.in`
   - Do NOT run from `deploy/` — that targets a different Vercel project and won't update the live site
3. Optionally run `./deploy-all.sh` to deploy all sub-projects in parallel

Sub-projects each have their own `vercel.json` and are deployed independently:
- Root (`app.pulsezen.in`) — supervisor dashboard (`index.html`)
- `pulsezen/` — public wellness center website
- `coaches/`, `clients/` — role-specific sub-apps
- `dharanis/`, `bksprime/` — per-center sub-apps (each contains a `centers/` subdir)

**Alternative deploy (Cloudflare Workers)**: `wrangler.jsonc` is configured to serve the `deploy/` directory at `app.pulsezen.in/*`. Use `wrangler deploy` as an alternative to Vercel if needed.

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

**Multi-center Supabase keys**: `SB_URL` / `SB_KEY` are the supervisor-level Supabase credentials. `CENTER_SB_KEY` is a per-center override. `getActiveSbKey()` returns the JWT for `Authorization: Bearer` headers — but for `apikey` headers, always use `SB_KEY || CENTER_SB_KEY` (a JWT is not a valid API key).

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
- `customer.html` — customer self-service view
- `pulsezen/` — public website for wellness centers (separate Vercel project)

## Database Schema (Supabase/PostgreSQL)

13 tables: `wellness_centers`, `customers`, `attendance`, `body_composition`, `finance`, `coaches`, `inventory_stock_in`, `inventory_stock_out`, `inventory_daily_usage`, `inventory_balance`, `coupons`, `payments`, `pack_history`

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

## pulseiq-guard Agent

A custom pre-deployment safety agent defined in `.claude/agents/pulseiq-guard.md`. Run it with:

> "run the pulseiq-guard agent"

**Auto-triggers**: the agent is configured to launch automatically after any edit to `index.html` that touches Supabase config, body composition logic, AI integration, or data field ordering — and always before deploying. You do not need to invoke it manually in those cases.

It enforces six invariants on `index.html` and must pass before any deploy to `app.pulsezen.in`:

| Check | Invariant |
|---|---|
| 1 — SB_URL | `var SB_URL = null` top-level is allowed (startup default). Flag if nulled inside any function. |
| 2 — loadBody() | Must exist, fetch `/rest/v1/body_composition`, and populate `D.body[]`. |
| 3 — Supabase fetch only | All data ops use `req()`/`dbGet()`/`dbInsert()`/`dbUpdate()`/`dbDelete()`. SDK (`@supabase/supabase-js`) allowed only for `_sbAuth` auth calls (signInWithOtp, verifyOtp, getSession, signOut, onAuthStateChange). |
| 4 — Karada field order | Form, table, and save payloads must follow: date → height → age → weight → fat% → visceral fat → BMR → BMI → body age → subcu fat% → muscle% |
| 5 — Groq model | Default must be `llama-3.1-8b-instant`. All Groq fetch calls must use this model. |
| 6 — No file:// paths | No runtime `file://` protocol checks or local file paths for external resources. |

**Key architectural rule enforced by Check 3:** `loadBody()` has its own `fetch()` (not via `req()`). It must use `SB_KEY || CENTER_SB_KEY` for the `apikey` header and `getActiveSbKey()` for `Authorization: Bearer`. Using `getActiveSbKey()` for both breaks OTP-authenticated users (JWT is not a valid API key).

## SaaS Plans (PLANS.md)

3 tiers: **Free** (₹0, up to 20 customers) → **Growth** (₹499/mo, up to 200 customers + public website) → **Elite** (₹999/mo, unlimited + AI diet plans + org analytics). Launch order: sign up centers on Free, convert to Growth with website hook, upsell Elite when 5–10 centers are active.
