-- ==============================================================================
-- PulseZen Owner Self-Serve Portal — Phase 1 Database Migration
-- Target tables: owner_users, transformations
-- Storage bucket: transformations (private)
-- RLS policies: transformations (anon can SELECT published only, no anon writes),
--               owner_users (no anon access)
-- NOTE: Do not auto-run. Run manually in the Supabase SQL editor.
-- ==============================================================================

-- 1. Create owner_users table
-- Scoped to centers / wellness_centers
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'wellness_centers') THEN
    CREATE TABLE IF NOT EXISTS owner_users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      center_id uuid NOT NULL REFERENCES wellness_centers(id) ON DELETE CASCADE,
      email text NOT NULL UNIQUE,
      status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
      created_at timestamptz DEFAULT now()
    );
  ELSE
    CREATE TABLE IF NOT EXISTS owner_users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      center_id uuid NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
      email text NOT NULL UNIQUE,
      status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
      created_at timestamptz DEFAULT now()
    );
  END IF;
END $$;

-- 2. Create transformations table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'wellness_centers') THEN
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
      created_at timestamptz DEFAULT now()
    );
  ELSE
    CREATE TABLE IF NOT EXISTS transformations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      center_id uuid NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
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
      created_at timestamptz DEFAULT now()
    );
  END IF;
END $$;

-- 3. Row Level Security (RLS) Configuration
ALTER TABLE owner_users ENABLE ROW LEVEL SECURITY;
-- By default with RLS enabled and no anon policies, anon has NO access at all.
-- Service role key bypasses RLS in /api serverless functions.

ALTER TABLE transformations ENABLE ROW LEVEL SECURITY;
-- Transformations: anon can SELECT only where status='published'
DROP POLICY IF EXISTS "anon_select_published_transformations" ON transformations;
CREATE POLICY "anon_select_published_transformations"
  ON transformations
  FOR SELECT
  TO anon
  USING (status = 'published');

-- All writes (INSERT/UPDATE/DELETE) scoped to service_role in /api only. No anon write policies.

-- 4. Storage Bucket: transformations (private)
-- Object path structure: {center_id}/{uuid}.jpg
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

-- Storage RLS: Ensure bucket is private
DROP POLICY IF EXISTS "service_role_manage_transformations" ON storage.objects;
CREATE POLICY "service_role_manage_transformations"
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'transformations')
  WITH CHECK (bucket_id = 'transformations');

-- 5. Indexes for Query Performance
CREATE INDEX IF NOT EXISTS idx_owner_users_email ON owner_users(email);
CREATE INDEX IF NOT EXISTS idx_transformations_center ON transformations(center_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transformations_status ON transformations(status);
