# 📝 PulseIQ Changelog

All notable changes to the PulseIQ project are documented in this file.

## [2.3.22] - 2026-09-03

### Fixed — Malformed Double-Ampersand Query Strings & Empty Image Resource Errors
- **Query String Sanitization (`dbGet`)**: Stripped leading `&` characters from `extraFilter` arguments before concatenating query parameters (`app.js:1696`), permanently resolving malformed URLs (`?order=date.desc&&date=eq.YYYY-MM-DD`). Verified date-filtered attendance queries return identical records.
- **Empty Image Source Removal (`index.html`)**: Removed static empty `src=""` attributes from `#prof-photo-preview` (line 3382), `#inst-qr-img` (line 5193), and `#qr-kiosk-img` (line 5646), eliminating all 3 failed resource network errors fired on page build while preserving styles, attributes, and dynamic Javascript image assignment.

---

## [2.3.21] - 2026-09-03

### Changed — QR Poll Render Gating & Tab Visibility Pause
- **Tab Visibility Guard (`pollQrCheckins`)**: Added early exit when `document.hidden` is true, pausing 15-second polling network requests and rendering cycles when the browser tab is backgrounded.
- **Change Signature Render Gating**:
  - Implemented lightweight change signature calculation (`currentSig`) covering today's check-in payloads (`todayAtt` and `todayCoachAtt`) stored in `window._lastQrPollSig`.
  - Conditioned `renderOverview()` and `renderAttendance()` calls on both `hasNew` check-ins and `sigChanged` detection.
  - Preserved first-run behavior after boot while completely eliminating periodic ~200ms main-thread long tasks and redundant re-renders during idle sessions when attendance data is unchanged.

---

## [2.3.20] - 2026-09-03

### Changed — Parallel Boot Loads & Collapsed Render Storm
- **Parallel Boot Fetches (`startApp`)**: Verified zero dependency between `app_settings` and `wellness_centers`; dispatched both network requests concurrently via `Promise.all` instead of sequential `await` chains, cutting network round-trip latency during initial startup.
- **Parallelized Attendance Load (`loadAll`)**: Moved `loadAttendance()` into Phase 1 `Promise.all` (`p1Jobs`) alongside other core datasets (`loadCenters`, `loadCustomers`, `loadCoaches`, `loadFinance`, `loadAnnouncements`), eliminating the sequential wait after Phase 1 resolution while preserving the active center scoping guard (`_custIdsFilter`).
- **Collapsed Boot Render Storm**:
  - Removed redundant per-loader `renderOverview()` invocations from `loadCustomers` (`app.js`), `loadAttendance` (`app.js`), `loadFinance` (`app.js`), and `loadCoaches` (`app.js`).
  - Guarded `loadCustomers()` with `!window._inLoadAll` so Phase 1 settles once with a single unified `renderCustomers()` and `renderOverview()` pass, while retaining full reactive re-rendering for customer mutations (`saveCustomer`, `deleteRow`, etc.).
  - Preserved Phase 0 cache renders, Phase 1 settlement renders, and Phase 3 background settlement renders, collapsing boot render passes from 6–8 redundant passes to exactly 3 passes.

---

## [2.3.19] - 2026-09-01

### Added — In-Flight Network GET Deduplication & Data-Layer Audit
- **In-Flight GET Deduplication (`shared/net-dedup.js`)**: Wrapped `window.fetch` to intercept concurrent identical `GET`/`HEAD` requests, collapsing redundant in-flight network trips while returning independent `.clone()` Response objects to every caller (zero caching, zero TTL, zero staleness; settlements immediately unlock direct network access).
- **Report-Only Data-Layer Audit**:
  - Identified 15s check-in polling interval (`app.js:2029`, `pollQrCheckins` calling `renderOverview`/`renderAttendance`) and multi-phase boot sequences firing 6–8× redundant renders during initial load.
  - Traced malformed double-ampersand query strings (`?order=date.desc&&date=eq.`) to `app.js:18328-18329` passing leading ampersands into `dbGet()` (`app.js:1681`).
  - Isolated the exact 3 elements with empty `src=""` on page load (`index.html:3382`, `index.html:5193`, `index.html:5646`) causing recurring startup 404 resource errors.
  - Documented Supabase query dispatch concurrency (`Promise.all` Phase 1 and Phase 3 vs sequential `await` chains).

---

## [2.3.18] - 2026-09-01

### Changed — Diagnostics Repair & Non-Blocking Panel
- **Real Resource Error Target Capture**: Fixed resource failure listener in `performance/perf-diagnostics.js` to extract element `tagName`, the real failing URL (`src`/`href`), and a 150-character `outerHTML` snippet (never recording `location.href` as the source).
- **Failed Resources Reporting**: Added detection and reporting for resource timing entries with HTTP `responseStatus >= 400` across both on-screen diagnostics panel and `window._perfReport()` CLI summary.
- **GoTo Wrapper & Render Counter**: Integrated `goTo wrapper: installed/not installed` status check and `renders since load: N` execution counter to resolve navigation auditing discrepancies.
- **Non-Blocking Diagnostics Sheet**: Refactored `toggleDiagnosticsPanel` to mount panel frame immediately and populate report sections asynchronously via `requestAnimationFrame` and microtasks, eliminating UI stutter on low-power devices and tablets.

---

## [2.3.17] - 2026-09-01

### Added — Error Capture, Navigation Audit & On-Screen Diagnostics Panel
- **Silent Error Capture**: Implemented always-on global `error`, `unhandledrejection`, and resource-failure event tracking into in-memory buffer `window.__diagErrors` (zero console pollution in normal mode).
- **Navigation Audit**: Non-invasive wrapper on `window.goTo` recording tab navigation events, execution duration, exception states, and render completion into `window.__diagNav`.
- **On-Screen Diagnostics Panel (`?perf=1`)**: Added responsive floating diagnostics pill and slide-up bottom-sheet report viewer allowing tablet and mobile inspection without browser DevTools.
- **Session Persistence**: Mirrored diagnostic errors and navigation traces into `sessionStorage['pulseiq_diag_v1']` across page navigations in `?perf=1` mode.
- **Copy Report Action**: Integrated one-click plain-text diagnostic summary exporter with clipboard fallback.

---

## [2.3.16] - 2026-09-01

### Added — Opt-in Performance Diagnostics Telemetry
- **Diagnostics Module (`performance/perf-diagnostics.js`)**: Added opt-in performance telemetry module activated only when URL includes `?perf=1` or via `window.enablePerfDiagnostics()`.
- **Render Function Profiling**: Non-invasive execution timing instrumentation for 27 key dashboard rendering and calculation functions, logging warnings when execution exceeds 100ms.
- **Long Task & Resource Observers**: PerformanceObserver tracking for main-thread blocking long tasks (>50ms) and network requests (TTFB & transfer size).
- **Diagnostics Report CLI (`window._perfReport()`)**: Formatted diagnostic report summarizing device metadata, DOM complexity, aggregated render timings, slow network requests, and long task attribution.

---

## [3.0.0] - 2026-07-29

### Added — Phase 1: Identity, Authentication, and Multi-Tenant Foundation
- **PostgreSQL & Supabase RLS Schema**: Created `supabase/migrations/20260729_phase1_identity_tenant_schema.sql` defining `organisations`, `branches`, `profiles`, `user_memberships`, `roles`, `permissions`, `role_permissions`, and `audit_logs` with strict RLS isolation policies.
- **Supabase Auth & Session Management**: Built `AuthContext.tsx` providing session persistence, sign in, sign up, sign out, password recovery, profile updating, and tenant organization switching.
- **Role-Based Access Control (RBAC)**: Implemented 6 distinct system roles (`platform_admin`, `organisation_owner`, `centre_manager`, `coach`, `receptionist`, `customer`) with fine-grained permission mapping (`org:manage`, `branch:manage`, `users:invite`, `customers:*`, `finance:*`, `ai_diet:generate`).
- **Dynamic Navigation Menu**: Created `DynamicSidebar.tsx` filtering navigation menu items in real-time based on the active user's granted permissions.
- **Zod Validation Schemas**: Created `src/lib/schemas/auth.ts` validating sign in, sign up, profile, password reset, and tenant creation inputs.
- **Security Route Guards**: Created `ProtectedRoute` and `RoleGuard` in `src/components/auth/ProtectedRoute.tsx` handling session redirects and 403 Forbidden access control.
- **Auth & Tenant Views**: Built `SignInView`, `SignUpView`, `ForgotPasswordView`, `ProfileView`, `AccountSettingsView`, `TenantsView`, and `UnauthorizedView`.
- **Vitest Unit Test Suite**: Built `src/test/auth-rbac.test.ts` verifying Zod schemas and RBAC permission rules.
- **Documentation**: Added `DATABASE_SCHEMA.md` and `API_SPEC.md`.

---

## [2.1.0] - 2026-07-29

### Added — UI Foundation Verification Package & Bundle Optimization
- **Rolldown/Vite Code Splitting**: Configured function-based `manualChunks` in `vite.config.ts`, splitting vendor libraries into `react-vendor`, `radix-vendor`, `motion-vendor`, `recharts-vendor`, and `vendor`.
- **Component Verification Audit**: Documented empirical evidence for all 30+ UI components in `PROJECT_STATUS.md`.

---

## [2.0.0] - 2026-07-29

### Added — Modern UI/UX Foundation Infrastructure
- **Design System Integration**: Integrated approved `DESIGN_SYSTEM.md` specification with unified color palette (`#27AE60` Pulse Green, `#2563EB` Pulse Blue, Tailwind Zinc neutrals).
