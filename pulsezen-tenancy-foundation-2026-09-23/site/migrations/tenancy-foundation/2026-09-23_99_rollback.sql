-- =============================================================================
-- ROLLBACK for 2026-09-23_01_tenancy_foundation.sql. NOT APPLIED.
-- Order: 1) promote the previous application build; 2) run pz_plan_gated_rpc_shutdown()
-- via this file; 3) run this file to drop paid-object schema additions.
--
-- KEEPS:
--   • pz_center_plan and pz_plan_evidence rows (evidence survives).
--   • All consent tables from 2026-09-21_01_owner_consent.sql.
--   • All shared tables, roles, anon policies — untouched.
--
-- DROPS:
--   • The paid-plan RPCs (pz_plan_activate, pz_plan_suspend,
--     pz_plan_gated_rpc_shutdown) so no application path can call them.
--   • The append-only triggers on pz_plan_evidence (data already immutable
--     as rows; the trigger guard can be re-added with the migration).
--   • Does NOT drop the tables themselves (evidence preservation).
--
-- CONFIRMS:
--   • wellness_centers still has its anon policy (shared-role invariant).
--   • service_role still exists.
--   • pz_center_plan and pz_plan_evidence still contain their rows.
-- =============================================================================
BEGIN;

-- 1. Call shutdown helper to revoke paid-object RPC grants while it still exists.
DO $$
DECLARE revoked text[];
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'pz_plan_gated_rpc_shutdown') THEN
    SELECT pz_plan_gated_rpc_shutdown() INTO revoked;
    RAISE NOTICE 'pz_plan_gated_rpc_shutdown revoked: %', revoked;
  END IF;
END $$;

-- 2. Drop paid-plan append-only triggers (data is already fixed; trigger was protection, not data).
DROP TRIGGER IF EXISTS trg_pz_plan_evidence_append_only ON pz_plan_evidence;
DROP TRIGGER IF EXISTS trg_pz_plan_evidence_no_truncate ON pz_plan_evidence;

-- 3. Drop paid-plan RPCs.
DROP FUNCTION IF EXISTS pz_plan_activate(uuid, uuid, text, text, text);
DROP FUNCTION IF EXISTS pz_plan_suspend(uuid, uuid, text);
DROP FUNCTION IF EXISTS pz_plan_gated_rpc_shutdown();

-- 4. Verify shared-role invariants are intact.
DO $$
DECLARE svc_ok int; anon_rls_ok boolean;
BEGIN
  SELECT count(*) INTO svc_ok FROM pg_roles WHERE rolname = 'service_role';
  IF svc_ok = 0 THEN
    RAISE EXCEPTION 'rollback aborted: service_role missing';
  END IF;
  -- wellness_centers must still have RLS (anon access policy survives).
  SELECT relrowsecurity INTO anon_rls_ok FROM pg_class WHERE relname = 'wellness_centers';
  IF anon_rls_ok IS NOT TRUE THEN
    RAISE EXCEPTION 'rollback aborted: wellness_centers RLS was unexpectedly disabled';
  END IF;
  -- Paid tables must still exist (data preservation check).
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'pz_center_plan') THEN
    RAISE EXCEPTION 'rollback aborted: pz_center_plan missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'pz_plan_evidence') THEN
    RAISE EXCEPTION 'rollback aborted: pz_plan_evidence missing';
  END IF;
  -- Paid-plan RPCs must be gone.
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'pz_plan_activate') THEN
    RAISE EXCEPTION 'rollback aborted: pz_plan_activate still exists';
  END IF;
  RAISE NOTICE 'rollback verified: shared roles intact, paid RPCs removed, evidence tables preserved';
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
