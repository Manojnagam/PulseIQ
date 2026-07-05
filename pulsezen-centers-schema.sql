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
  created_at timestamptz default now()
);

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

