# PulseIQ — Wellness Center Supervisor Dashboard

A full-stack single-page application for managing wellness centers — built with vanilla JavaScript, Supabase (PostgreSQL), Chart.js, and Groq AI.

## Live Demo
app.pulsezen.in <!-- Update this with your actual Netlify URL -->

## Features

- **Multi-Center Management** — Switch between wellness centers with center-specific data filtering
- **Customer Management** — Add, edit, search customers with pack tracking and expiry alerts
- **Attendance Tracking** — Daily check-ins with WhatsApp progress notifications and renewal nudges
- **Body Composition Analytics** — Track measurements over time with AI-powered health insights (Groq LLM)
- **Financial Dashboard** — Revenue tracking, pending payments, and financial analytics with Chart.js
- **Coach Management** — Track coaches, assign customers, manage referrals
- **Inventory System** — Stock in/out tracking, daily usage logs, balance monitoring
- **Coupon & Loyalty System** — Auto-earn coupons on referrals, searchable dropdowns, renewal support
- **PIN-Based Authentication** — Center-level and supervisor PINs with session-based access control
- **Overview Dashboard** — Quick actions, revenue cards, 7-day attendance chart, expiring packs, inactive alerts

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, Vanilla JavaScript (ES6+) |
| Backend | Supabase (PostgreSQL REST API) |
| Charts | Chart.js 4.4.1 |
| AI | Groq API (LLaMA 3.1 8B) |
| Messaging | WhatsApp Web API |
| Hosting | Netlify |

## Database Schema

12 Supabase tables:
`wellness_centers` · `customers` · `attendance` · `body_composition` · `finance` · `coaches` · `inventory_stock_in` · `inventory_stock_out` · `inventory_daily_usage` · `inventory_balance` · `coupons` · `payments` · `pack_history`

## Architecture

- **SPA Pattern** — All sections in a single file, shown/hidden via `goTo()` navigation
- **Global State** — Centralized `D` object holding all data arrays
- **REST Helpers** — `req()`, `dbGet()`, `dbInsert()`, `dbUpdate()`, `dbDelete()` for Supabase
- **Reusable Components** — Generic searchable dropdown system (`sdInit`, `sdRender`, `sdPick`)
- **Performance** — Memoized pack expiry calculations with `parsePack()` and `_daysLeftCache`

## Setup

1. Create a [Supabase](https://supabase.com) project
2. Run the SQL schema (available in the app's SQL Guide section)
3. Open the app and enter your Supabase URL + API key
4. Set your center PIN and start managing

## Author

**Manoj Nagam** — [GitHub](https://github.com/Manojnagam)
