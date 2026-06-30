-- Supabase Migration Script
-- Run this in your Supabase SQL Editor:

-- 1. Add water and mood columns to the attendance table
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS water_logged numeric DEFAULT 0;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS mood text;

-- 2. Add photo history column to the customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS photo_history text;

-- 3. Create client interactions table for cheers/sparks
CREATE TABLE IF NOT EXISTS client_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  sender_type text, -- 'coach' or 'client'
  type text, -- 'nudge', 'wave', 'spark', 'cheer'
  message text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 4. Enable RLS and add public access policies
ALTER TABLE client_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON client_interactions FOR ALL TO anon USING (true) WITH CHECK (true);
