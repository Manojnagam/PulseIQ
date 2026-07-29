# 📝 PulseIQ Changelog

All notable changes to the PulseIQ project are documented in this file.

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
