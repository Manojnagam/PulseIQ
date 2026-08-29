-- PulseZen Centers Schema
-- Run this in the new Supabase project SQL Editor

-- WELLNESS CENTERS
create table if not exists wellness_centers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  contact text,
  type text default 'main',
  owner_id uuid,
  center_pin text,
  unavailable_foods text,
  owner_name text,
  plan_type text default 'trial',
  created_at timestamptz default now()
);
alter table wellness_centers add column if not exists plan_type text default 'trial';

-- CUSTOMERS
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  wellness_center_id uuid references wellness_centers(id),
  pack_days int default 30,
  join_date date,
  dob date,
  age int,
  height numeric,
  weight numeric,
  goal text,
  referred_by text,
  diet_plan text,
  food_override text,
  issues text,
  notes text,
  status text default 'active',
  created_at timestamptz default now()
);

-- ATTENDANCE
create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  date date not null,
  wellness_center_id uuid references wellness_centers(id),
  created_at timestamptz default now()
);

-- BODY COMPOSITION
create table if not exists body_composition (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  date date not null,
  weight numeric,
  bmi numeric,
  body_fat numeric,
  muscle_mass numeric,
  visceral_fat numeric,
  bone_mass numeric,
  water_pct numeric,
  notes text,
  wellness_center_id uuid references wellness_centers(id),
  created_at timestamptz default now()
);

-- FINANCE
create table if not exists finance (
  id uuid primary key default gen_random_uuid(),
  type text,
  amount numeric,
  description text,
  date date,
  wellness_center_id uuid references wellness_centers(id),
  created_at timestamptz default now()
);

-- COACHES
create table if not exists coaches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  wellness_center_id uuid references wellness_centers(id),
  role text,
  commission numeric,
  join_date date,
  dashboard_pin text,
  notes text,
  created_at timestamptz default now()
);

-- COUPONS
create table if not exists coupons (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid,
  points int default 0,
  redeemed int default 0,
  wellness_center_id uuid references wellness_centers(id),
  created_at timestamptz default now()
);

-- PAYMENTS
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  amount numeric,
  date date,
  method text,
  notes text,
  wellness_center_id uuid references wellness_centers(id),
  created_at timestamptz default now()
);

-- PACK HISTORY
create table if not exists pack_history (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  coach_id uuid,
  pack_days int,
  amount numeric,
  date date,
  type text,
  installment_total numeric,
  installment_paid numeric,
  wellness_center_id uuid references wellness_centers(id),
  created_at timestamptz default now()
);

-- LEADS
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  name text,
  phone text,
  mobile text,
  source text,
  status text default 'new',
  notes text,
  coach_id uuid references coaches(id),
  wellness_center_id uuid references wellness_centers(id),
  created_at timestamptz default now()
);

-- WALK-INS
create table if not exists walkins (
  id uuid primary key default gen_random_uuid(),
  date date,
  name text not null,
  phone text,
  pincode text,
  source text,
  referred_by_id uuid,
  referred_by_name text,
  outcome text,
  amount_received numeric default 0,
  product_details text,
  notes text,
  finance_id uuid,
  wellness_center_id uuid references wellness_centers(id),
  center_id uuid references wellness_centers(id),
  created_at timestamptz default now()
);

-- EXPENSES
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  category text,
  amount numeric,
  description text,
  date date,
  wellness_center_id uuid references wellness_centers(id),
  created_at timestamptz default now()
);

-- FOODS
create table if not exists foods (
  id uuid primary key default gen_random_uuid(),
  name text,
  category text,
  calories numeric,
  protein numeric,
  carbs numeric,
  fat numeric,
  wellness_center_id uuid references wellness_centers(id),
  created_at timestamptz default now()
);

-- CONTESTS
create table if not exists contests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text default 'weight_loss',
  start_date date not null,
  end_date date not null,
  duration_days integer default 21,
  prize_amount numeric default 0,
  entry_fee numeric default 0,
  senior_amount numeric default 0,
  amount_sent_to_senior boolean default false,
  senior_sent_date date,
  description text,
  status text default 'active',
  wellness_center_id uuid references wellness_centers(id),
  created_at timestamptz default now()
);

-- CONTEST PARTICIPANTS
create table if not exists contest_participants (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid references contests(id) on delete cascade,
  customer_id uuid references customers(id) on delete cascade,
  customer_name text,
  start_weight numeric,
  start_fat numeric,
  start_muscle numeric,
  start_bmi numeric,
  current_weight numeric,
  current_fat numeric,
  current_muscle numeric,
  current_bmi numeric,
  progress numeric default 0,
  fee_paid boolean default false,
  video_tracking jsonb default '{}'::jsonb,
  category text,
  created_at timestamptz default now()
);

-- RLS: allow anon full access (app-level filtering handles isolation)
alter table wellness_centers enable row level security;
alter table customers enable row level security;
alter table attendance enable row level security;
alter table body_composition enable row level security;
alter table finance enable row level security;
alter table coaches enable row level security;
alter table coupons enable row level security;
alter table payments enable row level security;
alter table pack_history enable row level security;
alter table leads enable row level security;
alter table expenses enable row level security;
alter table foods enable row level security;
alter table contests enable row level security;
alter table contest_participants enable row level security;
alter table walkins enable row level security;

-- Allow access to all roles (app PIN system controls isolation)
create policy "anon_all" on wellness_centers for all using (true) with check (true);
create policy "anon_all" on customers for all using (true) with check (true);
create policy "anon_all" on attendance for all using (true) with check (true);
create policy "anon_all" on body_composition for all using (true) with check (true);
create policy "anon_all" on finance for all using (true) with check (true);
create policy "anon_all" on coaches for all using (true) with check (true);
create policy "anon_all" on coupons for all using (true) with check (true);
create policy "anon_all" on payments for all using (true) with check (true);
create policy "anon_all" on pack_history for all using (true) with check (true);
create policy "anon_all" on leads for all using (true) with check (true);
create policy "anon_all" on expenses for all using (true) with check (true);
create policy "anon_all" on foods for all using (true) with check (true);
create policy "anon_all" on contests for all using (true) with check (true);
create policy "anon_all" on contest_participants for all using (true) with check (true);
create policy "anon_all" on walkins for all using (true) with check (true);

-- ==========================================
-- LEAD FOLLOWUPS
-- ==========================================
create table if not exists lead_followups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  called_at date not null,
  note text,
  next_followup_date date,
  created_at timestamptz default now()
);
alter table lead_followups enable row level security;
create policy "allow_all" on lead_followups for all using (true) with check (true);

-- ==========================================
-- COACH ATTENDANCE
-- ==========================================
create table if not exists coach_attendance (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references coaches(id) on delete cascade,
  date date not null default current_date,
  status text default 'present',
  wellness_center_id uuid references wellness_centers(id),
  created_at timestamptz default now(),
  unique(coach_id, date)
);
alter table coach_attendance enable row level security;
create policy "allow_all" on coach_attendance for all using (true) with check (true);

-- ==========================================
-- DIET PLAN HISTORY
-- ==========================================
create table if not exists diet_plan_history (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete cascade,
  plan_json text not null,
  generated_at date not null default current_date,
  created_at timestamptz default now()
);
alter table diet_plan_history enable row level security;
create policy "allow_all" on diet_plan_history for all using (true) with check (true);

-- ==========================================
-- CUSTOMER NOTES
-- ==========================================
create table if not exists customer_notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete cascade,
  note text not null,
  follow_up_date date,
  created_at timestamptz default now()
);
alter table customer_notes enable row level security;
create policy "allow_all" on customer_notes for all using (true) with check (true);

-- ==========================================
-- ANNOUNCEMENTS
-- ==========================================
create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  target_center_id uuid references wellness_centers(id),
  expires_at date,
  created_at timestamptz default now()
);
alter table announcements enable row level security;
create policy "allow_all" on announcements for all using (true) with check (true);

-- ==========================================
-- SAAS PLAN TRACKING & NETWORKS MIGRATIONS
-- ==========================================
alter table wellness_centers add column if not exists plan_type text default 'free';
alter table wellness_centers add column if not exists network_id text;
alter table wellness_centers add column if not exists distributor_id text;

-- ==========================================
-- TASK CENTRE PHASE 1 — ADDITIVE DB SCHEMA
-- Migration: Milestone 1 Database Foundation
-- Production Safe: 100% Additive, Zero Impact on Existing Tables
-- ==========================================

-- 1. TASKS MASTER TABLE
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  wellness_center_id uuid not null references wellness_centers(id) on delete cascade,
  title text not null check (char_length(trim(title)) >= 3),
  description text,
  category text not null default 'General',
  priority text not null default 'MEDIUM',
  status text not null default 'Pending',
  assigned_to_coach_id uuid references coaches(id) on delete set null,
  related_customer_id uuid references customers(id) on delete set null,
  created_by_user_id text not null default 'system',
  due_date timestamptz,
  completed_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),

  -- Constraints
  constraint chk_tasks_priority check (priority in ('HIGH', 'MEDIUM', 'LOW')),
  constraint chk_tasks_status check (status in ('Pending', 'Assigned', 'In Progress', 'Completed', 'Verified', 'Closed', 'Cancelled')),
  constraint chk_tasks_category check (category in ('General', 'Attendance', 'Membership', 'Risk', 'Payment', 'Inventory', 'Onboarding', 'FollowUp'))
);

-- 2. TASK AUDIT HISTORY TABLE
create table if not exists task_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  previous_status text,
  new_status text not null,
  changed_by_coach_id uuid references coaches(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

-- Performance Indexes
create index if not exists idx_tasks_center_status on tasks (wellness_center_id, status);
create index if not exists idx_tasks_assigned_coach on tasks (assigned_to_coach_id, status);
create index if not exists idx_tasks_customer on tasks (related_customer_id);
create index if not exists idx_tasks_due_date on tasks (due_date) where status not in ('Closed', 'Cancelled');
create index if not exists idx_task_history_task_id on task_history (task_id, created_at desc);

-- Row Level Security (RLS) & Policies
alter table tasks enable row level security;
alter table task_history enable row level security;

create policy "anon_all_tasks" on tasks for all using (true) with check (true);
create policy "anon_all_task_history" on task_history for all using (true) with check (true);

-- ==========================================
-- 🧾 HERBALIFE PURCHASES TABLE & RLS POLICIES
-- ==========================================
CREATE TABLE IF NOT EXISTS herbalife_purchases (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_no text NOT NULL,
  order_date date DEFAULT current_date,
  retail_total numeric DEFAULT 0,
  paid_subtotal numeric DEFAULT 0,
  cgst_amount numeric DEFAULT 0,
  sgst_amount numeric DEFAULT 0,
  igst_amount numeric DEFAULT 0,
  delivery_charges numeric DEFAULT 0,
  grand_total numeric DEFAULT 0,
  volume_points numeric DEFAULT 0,
  wellness_center_id uuid REFERENCES wellness_centers(id),
  created_at timestamptz DEFAULT now()
);

-- Ensure CGST/SGST/IGST columns exist if table was already created
ALTER TABLE herbalife_purchases ADD COLUMN IF NOT EXISTS cgst_amount numeric DEFAULT 0;
ALTER TABLE herbalife_purchases ADD COLUMN IF NOT EXISTS sgst_amount numeric DEFAULT 0;
ALTER TABLE herbalife_purchases ADD COLUMN IF NOT EXISTS igst_amount numeric DEFAULT 0;
ALTER TABLE herbalife_purchases ADD COLUMN IF NOT EXISTS wellness_center_id uuid REFERENCES wellness_centers(id);

-- Add purchase_id reference to inventory_stock_in
ALTER TABLE inventory_stock_in ADD COLUMN IF NOT EXISTS purchase_id uuid REFERENCES herbalife_purchases(id);

-- Enable RLS and create permissive policies
ALTER TABLE herbalife_purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON herbalife_purchases;
DROP POLICY IF EXISTS "anon_all_herbalife_purchases" ON herbalife_purchases;
CREATE POLICY "allow all" ON herbalife_purchases FOR ALL USING (true) WITH CHECK (true);

-- Ensure finance table has permissive RLS for INSERT
ALTER TABLE finance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON finance;
DROP POLICY IF EXISTS "anon_all_finance" ON finance;
CREATE POLICY "allow all" ON finance FOR ALL USING (true) WITH CHECK (true);

-- Ensure inventory_stock_in has permissive RLS for INSERT
ALTER TABLE inventory_stock_in ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON inventory_stock_in;
DROP POLICY IF EXISTS "anon_all_inventory_stock_in" ON inventory_stock_in;
CREATE POLICY "allow all" ON inventory_stock_in FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- 🥛 UMS PACK PROFIT TRACKING SCHEMA (v2.3.7)
-- ==========================================

-- 1. PACK COST CONFIGURATION (per-scoop product costs)
CREATE TABLE IF NOT EXISTS pack_cost_config (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_key text UNIQUE NOT NULL,
  label text,
  cost_per_scoop numeric NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE pack_cost_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON pack_cost_config;
DROP POLICY IF EXISTS "anon_all_pack_cost_config" ON pack_cost_config;
CREATE POLICY "allow all" ON pack_cost_config FOR ALL USING (true) WITH CHECK (true);

-- Seed 4 product scoop costs (f1 19.70, ppp 20.52, shakemate 12.65, afresh 11.05)
INSERT INTO pack_cost_config (product_key, label, cost_per_scoop)
VALUES
  ('f1', 'Formula 1', 19.70),
  ('ppp', 'Personalized Protein Powder', 20.52),
  ('shakemate', 'ShakeMate', 12.65),
  ('afresh', 'Afresh', 11.05)
ON CONFLICT (product_key) DO UPDATE
SET cost_per_scoop = EXCLUDED.cost_per_scoop, label = EXCLUDED.label, updated_at = now();

-- 2. PACK DEFINITIONS (pack catalogue & days)
CREATE TABLE IF NOT EXISTS pack_definitions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pack_name text NOT NULL,
  days int NOT NULL,
  ums_price numeric NOT NULL DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pack_definitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON pack_definitions;
DROP POLICY IF EXISTS "anon_all_pack_definitions" ON pack_definitions;
CREATE POLICY "allow all" ON pack_definitions FOR ALL USING (true) WITH CHECK (true);

-- Seed 4 standard packs
INSERT INTO pack_definitions (pack_name, days, ums_price, active)
SELECT '3-Day Trial', 3, 900, true
WHERE NOT EXISTS (SELECT 1 FROM pack_definitions WHERE pack_name = '3-Day Trial');

INSERT INTO pack_definitions (pack_name, days, ums_price, active)
SELECT '26-Day', 26, 5600, true
WHERE NOT EXISTS (SELECT 1 FROM pack_definitions WHERE pack_name = '26-Day');

INSERT INTO pack_definitions (pack_name, days, ums_price, active)
SELECT '30-Day', 30, 6500, true
WHERE NOT EXISTS (SELECT 1 FROM pack_definitions WHERE pack_name = '30-Day');

INSERT INTO pack_definitions (pack_name, days, ums_price, active)
SELECT '90-Day', 90, 15000, true
WHERE NOT EXISTS (SELECT 1 FROM pack_definitions WHERE pack_name = '90-Day');

-- 3. LINK PACK_ID TO CUSTOMERS, FINANCE & PAYMENTS
ALTER TABLE customers ADD COLUMN IF NOT EXISTS pack_id uuid REFERENCES pack_definitions(id);
ALTER TABLE finance ADD COLUMN IF NOT EXISTS pack_id uuid REFERENCES pack_definitions(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS pack_id uuid REFERENCES pack_definitions(id);

-- ==========================================
-- 🥛 UMS PER-PACK RECIPES & CATALOGUE EXPANSION (v2.3.8)
-- ==========================================

-- 1. ADD RECIPE COLUMN TO PACK_DEFINITIONS
ALTER TABLE pack_definitions ADD COLUMN IF NOT EXISTS recipe jsonb;

-- 2. ADD DINOSHAKE TO PACK_COST_CONFIG (₹607 ÷ 19 servings = ₹31.95/scoop ex-tax)
INSERT INTO pack_cost_config (product_key, label, cost_per_scoop)
VALUES ('dinoshake', 'Dinoshake', 31.95)
ON CONFLICT (product_key) DO UPDATE
SET cost_per_scoop = EXCLUDED.cost_per_scoop, label = EXCLUDED.label, updated_at = now();

-- 3. UPDATE EXISTING 4 PACK DEFINITIONS WITH WEIGHT-LOSS RECIPES
UPDATE pack_definitions
SET recipe = '{"f1":3,"ppp":1,"shakemate":1,"afresh":1}'::jsonb
WHERE pack_name IN ('3-Day Trial', '26-Day', '30-Day', '90-Day');

-- 4. INSERT / UPDATE 3 NEW PACK DEFINITIONS WITH SPECIFIC RECIPES
INSERT INTO pack_definitions (pack_name, days, ums_price, active, recipe)
SELECT 'Premium 30-Day', 30, 5600, true, '{"f1":2,"ppp":1,"shakemate":1,"dinoshake":1,"afresh":1}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM pack_definitions WHERE pack_name = 'Premium 30-Day');

UPDATE pack_definitions
SET days = 30, ums_price = 5600, active = true, recipe = '{"f1":2,"ppp":1,"shakemate":1,"dinoshake":1,"afresh":1}'::jsonb
WHERE pack_name = 'Premium 30-Day';

INSERT INTO pack_definitions (pack_name, days, ums_price, active, recipe)
SELECT 'Premium 30-Day Plus', 30, 7000, true, '{"f1":2,"ppp":1,"shakemate":1,"dinoshake":1,"afresh":1}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM pack_definitions WHERE pack_name = 'Premium 30-Day Plus');

UPDATE pack_definitions
SET days = 30, ums_price = 7000, active = true, recipe = '{"f1":2,"ppp":1,"shakemate":1,"dinoshake":1,"afresh":1}'::jsonb
WHERE pack_name = 'Premium 30-Day Plus';

INSERT INTO pack_definitions (pack_name, days, ums_price, active, recipe)
SELECT 'Hot Drink 30-Day', 30, 1000, true, '{"afresh":1}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM pack_definitions WHERE pack_name = 'Hot Drink 30-Day');

UPDATE pack_definitions
SET days = 30, ums_price = 1000, active = true, recipe = '{"afresh":1}'::jsonb
WHERE pack_name = 'Hot Drink 30-Day';

-- 5. LINK REMAINING CUSTOMERS (TASK 2)
-- Link 'Premium 30 days' @ ₹5600 to 'Premium 30-Day' (M Koushik, Naveena Jyothi, Manoj Nagam)
UPDATE customers
SET pack_id = (SELECT id FROM pack_definitions WHERE pack_name = 'Premium 30-Day' LIMIT 1)
WHERE (pack_type = 'Premium 30 days' AND (pack_price = 5600 OR pack_price IS NULL OR name IN ('M Koushik', 'Naveena Jyothi', 'Manoj Nagam')))
  AND name NOT IN ('Siva paarvati');

-- Link 'Premium 30 days' @ ₹7000 to 'Premium 30-Day Plus' (Siva paarvati)
UPDATE customers
SET pack_id = (SELECT id FROM pack_definitions WHERE pack_name = 'Premium 30-Day Plus' LIMIT 1)
WHERE (pack_type = 'Premium 30 days' AND (pack_price = 7000 OR name = 'Siva paarvati'))
  OR (name = 'Siva paarvati');

-- Link 'Hot Drink 30 days' to 'Hot Drink 30-Day' (Lalitha)
UPDATE customers
SET pack_id = (SELECT id FROM pack_definitions WHERE pack_name = 'Hot Drink 30-Day' LIMIT 1)
WHERE pack_type = 'Hot Drink 30 days' OR name = 'Lalitha';

-- Sync pack_id to payments and finance for these newly linked customers
UPDATE payments p
SET pack_id = c.pack_id
FROM customers c
WHERE p.person_id = c.id
  AND c.pack_id IS NOT NULL
  AND p.pack_id IS NULL;

UPDATE finance f
SET pack_id = c.pack_id
FROM customers c
WHERE f.customer_id = c.id
  AND c.pack_id IS NOT NULL
  AND f.pack_id IS NULL;






