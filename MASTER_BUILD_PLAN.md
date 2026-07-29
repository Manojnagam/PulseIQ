# 🏗 PulseIQ — Master Build Plan

This plan outlines the architecture, completed milestones, verification package, and upcoming phase roadmaps for the PulseIQ platform.

---

## 🏁 Phase 0: UI/UX Foundation Infrastructure (`VERIFIED & COMPLETED`)

- [x] Configure React 18 + TypeScript 5 + Vite 8 build pipeline.
- [x] Integrate Tailwind CSS 4 theme tokens (`#27AE60` Pulse Green, `#2563EB` Pulse Blue, Zinc neutrals).
- [x] Create 30+ reusable UI components (`src/components/ui/`).
- [x] Implement Aceternity UI components (`Spotlight`, `ShimmerButton`, `BentoGrid`).
- [x] Implement Motion Primitives (`PageTransition`, `ExpandablePanel`, `MotionHoverCard`).
- [x] Complete Accessibility Audit & Verification Package in `PROJECT_STATUS.md`.

---

## 🏁 Phase 1: Identity, Authentication, and Multi-Tenant Foundation (`VERIFIED & COMPLETED`)

- [x] Design production PostgreSQL schema (`organisations`, `branches`, `profiles`, `user_memberships`, `roles`, `permissions`).
- [x] Apply Row Level Security (RLS) policies to all tables in `supabase/migrations/20260729_phase1_identity_tenant_schema.sql`.
- [x] Implement Supabase Auth, session persistence, sign-in, sign-up, password reset, and profile management in `AuthContext.tsx`.
- [x] Implement Role-Based Access Control (RBAC) for 6 roles (`platform_admin`, `organisation_owner`, `centre_manager`, `coach`, `receptionist`, `customer`).
- [x] Construct dynamic role-filtered navigation menu (`DynamicSidebar.tsx`).
- [x] Implement Zod form schemas and React Hook Form integration (`src/lib/schemas/auth.ts`).
- [x] Build route guards (`ProtectedRoute` & `RoleGuard`).
- [x] Build authentication views (`SignInView`, `SignUpView`, `ForgotPasswordView`, `ProfileView`, `AccountSettingsView`, `TenantsView`, `UnauthorizedView`).
- [x] Add Vitest testing suite (`src/test/auth-rbac.test.ts`).
- [x] Create `DATABASE_SCHEMA.md` and `API_SPEC.md`.

---

## 🚀 Phase 2: Customer Management & Membership Packs (`UPCOMING AFTER AUDIT`)

- [ ] Connect Supabase PostgreSQL `customers` table to React `DataTable`.
- [ ] Implement customer search, pack filter, and creation form modal.
- [ ] Add pack expiry calculation & alert badge indicators (`parsePack()`).
- [ ] Wire up WhatsApp notification generator.

---

## 📈 Phase 3: Karada Body Composition Analytics

- [ ] Log 11 Karada physiological measurements (Height, Weight, Fat %, Visceral Fat, BMR, BMI, Muscle %, Body Age, Subcu Fat %).
- [ ] Build historical progress chart using `ChartCard` (Recharts).
- [ ] Generate comparative measurement table.

---

## 💰 Phase 4: Financial Revenue & Coach Commission Engine

- [ ] Render monthly revenue cards & transaction logs.
- [ ] Track pending payments vs settled accounts (`finance` table).
- [ ] Manage coach assignments and referral coupon rewards (`coupons` table).

---

## 🤖 Phase 5: Groq AI Diet & Health Plan Generator

- [ ] Connect `/api/groq.js` serverless function to AI Diet tab.
- [ ] Implement 7-day diet generator with LLaMA 3.1 8B instant model.
- [ ] Add client health assessment summary exporter.
