-- ==============================================================================
-- PulseZen Owner Self-Serve Portal — Phase 1 Database Migration (Cleaned v3)
-- Architecture:
--   1. owner_users: Scoped to wellness_centers. Private to service_role.
--   2. transformations: Full records with customer details. Private to service_role (NO anon access).
--   3. owner_login_attempts: Server-side brute-force lockout and rate-limiting store.
--   4. Storage bucket: transformations (Private, service_role access only).
--   5. Zero anon access: No anon policies, no anon views. All public data accessed via
--      scoped server-side endpoints (/api/public/transformations, /api/public/photo).
-- ==============================================================================

-- 1. Create owner_users table
CREATE TABLE IF NOT EXISTS owner_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id uuid NOT NULL REFERENCES wellness_centers(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create transformations table
-- Note: Sensitive fields (customer_words, health_issue, consent_name, consent_phone_last4,
-- before_path, after_path) are stored here and NEVER exposed to anon.
CREATE TABLE IF NOT EXISTS transformations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id uuid NOT NULL REFERENCES wellness_centers(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  before_path text NOT NULL,
  after_path text NOT NULL,
  duration_weeks int,
  start_weight_kg numeric,
  end_weight_kg numeric,
  health_issue text,
  customer_words text NOT NULL,
  ai_summary text,
  consent_given boolean NOT NULL DEFAULT false,
  consent_name text,
  consent_phone_last4 text,
  consent_at timestamptz,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Create owner_login_attempts table (M1 lockout per email + C3 rate limiting)
-- Server-side persistent store across serverless function invocations.
CREATE TABLE IF NOT EXISTS owner_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ip_address text,
  attempt_type text NOT NULL CHECK (attempt_type IN ('request_otp', 'verify_otp')),
  code_hash text,
  success boolean NOT NULL DEFAULT false,
  consumed boolean NOT NULL DEFAULT false,
  invalidated boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Row Level Security (RLS) Configuration — ZERO ANON ACCESS
-- owner_users: RLS enabled. No anon access. service_role only.
ALTER TABLE owner_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON owner_users FROM anon;
REVOKE ALL ON owner_users FROM authenticated;
GRANT ALL ON owner_users TO service_role;

-- transformations: RLS enabled. No anon access. service_role only.
ALTER TABLE transformations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_published_transformations" ON transformations;
REVOKE ALL ON transformations FROM anon;
REVOKE ALL ON transformations FROM authenticated;
GRANT ALL ON transformations TO service_role;

-- owner_login_attempts: RLS enabled. No anon access. service_role only.
ALTER TABLE owner_login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON owner_login_attempts FROM anon;
REVOKE ALL ON owner_login_attempts FROM authenticated;
GRANT ALL ON owner_login_attempts TO service_role;

-- Drop legacy view if exists (M5: No views granted to anon)
DROP VIEW IF EXISTS public_transformations;

-- 5. Storage Bucket: transformations (Private)
-- Photos are streamed ephemerally via server-side /api/public/photo (B5-v2).
-- Long-lived public/signed URLs are NEVER generated.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'transformations',
  'transformations',
  false,
  5242880, -- 5 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- 6. Indexes for Performance & Security Queries
CREATE INDEX IF NOT EXISTS idx_owner_users_email ON owner_users(email);
CREATE INDEX IF NOT EXISTS idx_owner_users_center ON owner_users(center_id);
CREATE INDEX IF NOT EXISTS idx_transformations_center ON transformations(center_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transformations_status_consent ON transformations(status, consent_given);
CREATE INDEX IF NOT EXISTS idx_owner_login_attempts_email ON owner_login_attempts(email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_owner_login_attempts_email_verify ON owner_login_attempts(email, attempt_type, success, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_owner_login_attempts_ip ON owner_login_attempts(ip_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_owner_login_attempts_active_code ON owner_login_attempts(email, attempt_type, expires_at)
  WHERE attempt_type = 'request_otp' AND consumed = false AND invalidated = false;

-- 7. Reload PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';
