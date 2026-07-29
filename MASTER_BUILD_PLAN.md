# 🏗 PulseIQ — Master Build Plan

This plan outlines the architecture, completed milestones, and upcoming phase roadmaps for the PulseIQ platform.

---

## 🏁 Phase 0: UI/UX Foundation Infrastructure (`COMPLETED`)

- [x] Configure React 18 + TypeScript + Vite build pipeline.
- [x] Integrate Tailwind CSS 4 theme tokens (`#27AE60` Pulse Green, `#2563EB` Pulse Blue, Zinc neutrals).
- [x] Create 30+ reusable UI components (`src/components/ui/`).
- [x] Implement Aceternity UI components (`Spotlight`, `ShimmerButton`, `BentoGrid`).
- [x] Implement Motion Primitives (`PageTransition`, `ExpandablePanel`, `MotionHoverCard`).
- [x] Construct master layout (`AppLayout`, `Sidebar`, `Navbar`, `CommandPalette`, `Drawer`, `ToastProvider`).
- [x] Validate build with zero compilation errors (`npx vite build` clean).

---

## 🚀 Phase 1: Customer Management & Membership Packs (`NEXT`)

- [ ] Connect Supabase PostgreSQL `customers` table to React `DataTable`.
- [ ] Implement customer search, pack filter, and creation form modal.
- [ ] Add pack expiry calculation & alert badge indicators (`parsePack()`).
- [ ] Wire up WhatsApp notification generator.

---

## 📈 Phase 2: Karada Body Composition Analytics

- [ ] Log 11 Karada physiological measurements (Height, Weight, Fat %, Visceral Fat, BMR, BMI, Muscle %, Body Age, Subcu Fat %).
- [ ] Build historical progress chart using `ChartCard` (Recharts).
- [ ] Generate comparative measurement table.

---

## 💰 Phase 3: Financial Revenue & Coach Commission Engine

- [ ] Render monthly revenue cards & transaction logs.
- [ ] Track pending payments vs settled accounts (`finance` table).
- [ ] Manage coach assignments and referral coupon rewards (`coupons` table).

---

## 🤖 Phase 4: Groq AI Diet & Health Plan Generator

- [ ] Connect `/api/groq.js` serverless function to AI Diet tab.
- [ ] Implement 7-day diet generator with LLaMA 3.1 8B instant model.
- [ ] Add client health assessment summary exporter.
