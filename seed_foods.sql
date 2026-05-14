-- ══════════════════════════════════════════════════════════════
-- PulseIQ — Seed Nandyal Local Food Database
-- Run this ONCE in your Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════
-- Step 0: food_log_entries table (for client daily food logging)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS food_log_entries (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID    REFERENCES customers(id) ON DELETE CASCADE,
  date        DATE    NOT NULL DEFAULT CURRENT_DATE,
  food_id     UUID    REFERENCES foods(id) ON DELETE SET NULL,
  food_name   TEXT    NOT NULL,
  grams       NUMERIC NOT NULL,
  calories    NUMERIC NOT NULL DEFAULT 0,
  protein     NUMERIC NOT NULL DEFAULT 0,
  carbs       NUMERIC DEFAULT 0,
  fat         NUMERIC DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE food_log_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Public read food_log_entries" ON food_log_entries FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Public insert food_log_entries" ON food_log_entries FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Public delete food_log_entries" ON food_log_entries FOR DELETE USING (true);

-- ══════════════════════════════════════════════════════════════
-- Step 1: Create foods table if it doesn't exist yet
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS foods (
  id         UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT    NOT NULL,
  category   TEXT    DEFAULT 'veg',      -- veg | non-veg | both
  goal       TEXT    DEFAULT 'both',     -- weight_loss | weight_gain | both
  calories   NUMERIC DEFAULT 0,          -- kcal per 100g
  protein    NUMERIC DEFAULT 0,          -- g per 100g
  carbs      NUMERIC DEFAULT 0,          -- g per 100g
  fat        NUMERIC DEFAULT 0,          -- g per 100g
  fiber      NUMERIC DEFAULT 0,          -- g per 100g
  meal_time  TEXT    DEFAULT 'any',      -- any | breakfast | lunch | snack | dinner
  added_by   UUID    REFERENCES customers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add goal column if table already exists
ALTER TABLE foods ADD COLUMN IF NOT EXISTS goal TEXT DEFAULT 'both';

-- Step 2: Add unique constraint to avoid duplicates (safe to run even if table exists)
ALTER TABLE foods ADD CONSTRAINT IF NOT EXISTS foods_name_unique UNIQUE (name);

-- Step 3: Enable RLS (if you use row-level security)
ALTER TABLE foods ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Public read foods" ON foods FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Authenticated insert foods" ON foods FOR INSERT WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════
-- Step 4: Seed Nandyal-local foods
-- All values are per 100g (raw/uncooked unless stated)
-- ON CONFLICT DO NOTHING = safe to re-run
-- ══════════════════════════════════════════════════════════════

-- name, category, goal, calories, protein, carbs, fat, fiber, meal_time
INSERT INTO foods (name, category, goal, calories, protein, carbs, fat, fiber, meal_time)
VALUES
  -- ── WEIGHT LOSS — Slow Carbs ──
  ('Ragi (Finger Millet)',          'veg',    'weight_loss', 336,  7.3, 72.0,  1.9,  3.6, 'any'),
  ('Jowar (Sorghum)',               'veg',    'weight_loss', 329, 10.4, 67.0,  3.4,  6.3, 'any'),
  ('Brown Rice',                    'veg',    'weight_loss', 111,  2.6, 23.0,  0.9,  1.8, 'lunch'),
  ('Oats',                          'veg',    'weight_loss', 389, 17.0, 66.0,  7.0, 10.6, 'breakfast'),
  ('Whole Wheat Atta',              'veg',    'weight_loss', 340, 12.0, 71.0,  1.9, 12.2, 'any'),
  ('Barley (Jav)',                  'veg',    'weight_loss', 354, 12.5, 73.0,  2.3, 17.3, 'any'),

  -- ── WEIGHT GAIN — Calorie Dense Carbs ──
  ('White Rice',                    'veg',    'weight_gain', 130,  2.7, 28.0,  0.3,  0.4, 'lunch'),
  ('Sweet Potato',                  'veg',    'weight_gain',  86,  1.6, 20.0,  0.1,  3.0, 'any'),
  ('Banana',                        'veg',    'weight_gain',  89,  1.1, 23.0,  0.3,  2.6, 'breakfast'),
  ('Ragi Malt with Jaggery',        'veg',    'weight_gain', 350,  7.0, 75.0,  2.0,  3.0, 'breakfast'),
  ('Whole Wheat Bread',             'veg',    'weight_gain', 247,  9.0, 48.0,  3.4,  4.0, 'breakfast'),
  ('Mango',                         'veg',    'weight_gain',  60,  0.8, 15.0,  0.4,  1.6, 'snack'),

  -- ── PROTEINS ──
  ('Eggs',                          'both',   'both',        155, 13.0,  1.1, 11.0,  0.0, 'breakfast'),
  ('Chicken Breast',                'non-veg','weight_loss', 165, 31.0,  0.0,  3.6,  0.0, 'lunch'),
  ('Chicken Thighs',                'non-veg','weight_gain', 209, 26.0,  0.0, 11.0,  0.0, 'lunch'),
  ('Rohu / Catla Fish',             'non-veg','both',         97, 18.0,  0.0,  2.4,  0.0, 'lunch'),
  ('Mutton',                        'non-veg','weight_gain', 258, 26.0,  0.0, 17.0,  0.0, 'lunch'),
  ('Toor Dal',                      'veg',    'weight_loss', 343, 22.0, 63.0,  1.9, 15.0, 'lunch'),
  ('Moong Dal',                     'veg',    'both',        347, 24.0, 63.0,  1.2, 16.3, 'any'),
  ('Chana Dal',                     'veg',    'weight_loss', 364, 20.0, 65.0,  5.3, 17.4, 'lunch'),
  ('Rajma (Kidney Beans)',          'veg',    'both',        333, 24.0, 60.0,  1.5, 24.9, 'lunch'),
  ('Paneer',                        'veg',    'both',        265, 18.0,  1.2, 21.0,  0.0, 'any'),
  ('Curd (Homemade)',               'veg',    'weight_loss',  61,  3.5,  4.7,  3.3,  0.0, 'any'),
  ('Full-fat Milk',                 'veg',    'weight_gain',  61,  3.2,  4.8,  3.3,  0.0, 'breakfast'),
  ('Groundnuts / Peanuts',          'veg',    'both',        567, 26.0, 16.0, 49.0,  8.5, 'snack'),
  ('Peanut Butter',                 'veg',    'weight_gain', 588, 25.0, 20.0, 50.0,  6.0, 'breakfast'),
  ('Chikki (Groundnut + Jaggery)', 'veg',    'weight_gain', 450, 12.0, 55.0, 22.0,  4.0, 'snack'),
  ('Mixed Nuts',                    'veg',    'weight_gain', 607, 18.0, 21.0, 54.0,  7.0, 'snack'),

  -- ── VEGETABLES (weight loss) ──
  ('Drumstick (Munagakaya)',        'veg',    'weight_loss',  37,  2.1,  8.5,  0.2,  3.2, 'lunch'),
  ('Bitter Gourd (Kakarakaya)',     'veg',    'weight_loss',  17,  1.0,  3.7,  0.2,  2.8, 'lunch'),
  ('Ridge Gourd (Beerakaya)',       'veg',    'weight_loss',  17,  0.7,  4.0,  0.1,  0.5, 'lunch'),
  ('Snake Gourd (Potlakaya)',       'veg',    'weight_loss',  18,  0.5,  3.3,  0.5,  0.8, 'lunch'),
  ('Brinjal',                       'veg',    'weight_loss',  25,  1.0,  5.9,  0.2,  3.0, 'lunch'),
  ('Tomato',                        'veg',    'weight_loss',  18,  0.9,  3.9,  0.2,  1.2, 'any'),
  ('Spinach (Palakura)',            'veg',    'weight_loss',  23,  2.9,  3.6,  0.4,  2.2, 'any'),
  ('Fenugreek Leaves (Menthi)',     'veg',    'weight_loss',  49,  4.4,  6.0,  0.9,  2.7, 'any'),
  ('Cluster Beans (Goru Chikkudu)','veg',    'weight_loss',  16,  3.2,  0.0,  0.4,  1.4, 'lunch'),
  ('Bottle Gourd (Sorakaya)',       'veg',    'weight_loss',  14,  0.6,  3.4,  0.1,  0.5, 'lunch'),
  ('Onion',                         'veg',    'both',         40,  1.1,  9.3,  0.1,  1.7, 'any'),
  ('Capsicum',                      'veg',    'weight_loss',  31,  1.0,  6.0,  0.3,  2.1, 'any'),
  ('Cabbage',                       'veg',    'weight_loss',  25,  1.3,  5.8,  0.1,  2.5, 'any'),
  ('Carrot',                        'veg',    'weight_loss',  41,  0.9,  9.6,  0.2,  2.8, 'snack'),
  ('Beetroot',                      'veg',    'both',         43,  1.6,  9.6,  0.2,  2.8, 'any'),
  ('Cucumber',                      'veg',    'weight_loss',  16,  0.7,  3.6,  0.1,  0.5, 'snack'),

  -- ── FRUITS ──
  ('Guava',                         'veg',    'weight_loss',  68,  2.6, 14.0,  1.0,  5.4, 'snack'),
  ('Papaya',                        'veg',    'both',         43,  0.5, 11.0,  0.3,  1.7, 'breakfast'),
  ('Watermelon',                    'veg',    'weight_loss',  30,  0.6,  7.6,  0.2,  0.4, 'snack'),
  ('Pomegranate',                   'veg',    'both',         83,  1.7, 19.0,  1.2,  4.0, 'snack'),
  ('Amla (Indian Gooseberry)',      'veg',    'both',         44,  0.9, 10.0,  0.6,  4.3, 'any'),
  ('Lime / Lemon',                  'veg',    'weight_loss',  29,  1.1,  9.3,  0.3,  2.8, 'any'),
  ('Orange',                        'veg',    'weight_loss',  47,  0.9, 12.0,  0.1,  2.4, 'snack'),
  ('Mosambi (Sweet Lime)',          'veg',    'weight_loss',  43,  0.8, 10.0,  0.1,  0.5, 'snack'),

  -- ── FATS ──
  ('Flaxseeds (Avise Ginjalu)',     'veg',    'both',        534, 18.0, 29.0, 42.0, 27.0, 'any'),
  ('Sesame Seeds (Nuvvulu)',        'veg',    'both',        573, 17.0, 23.0, 50.0, 11.8, 'any'),
  ('Coconut',                       'veg',    'both',        354,  3.3, 15.0, 33.0,  9.0, 'any'),

  -- ── BEVERAGES ──
  ('Buttermilk (Majjiga)',           'veg',    'weight_loss',  40,  3.5,  4.9,  1.0,  0.0, 'any'),
  ('Coconut Water',                  'veg',    'both',         19,  0.7,  3.7,  0.2,  1.1, 'any'),
  ('Jeera Water',                    'veg',    'weight_loss',   5,  0.2,  0.9,  0.1,  0.1, 'any'),

  -- ── NANDYAL / ANDHRA SPECIFIC ──
  ('Korra (Foxtail Millet)',         'veg',    'weight_loss', 331, 12.3, 67.0,  3.3,  6.7, 'any'),
  ('Sajja (Pearl Millet / Bajra)',   'veg',    'weight_loss', 361, 11.6, 67.0,  5.0,  1.2, 'any'),
  ('Ulavalu (Horse Gram)',           'veg',    'both',        321, 22.0, 57.0,  0.5,  5.3, 'lunch'),
  ('Minapappu (Urad Dal)',           'veg',    'both',        347, 25.0, 59.0,  1.6, 18.3, 'any'),
  ('Pesarapappu (Moong Beans)',      'veg',    'both',        347, 24.0, 63.0,  1.0, 16.3, 'any'),
  ('Gongura (Sorrel Leaves)',        'veg',    'weight_loss',  46,  3.0,  9.0,  0.2,  2.5, 'lunch'),
  ('Dosakaya (Yellow Cucumber)',     'veg',    'weight_loss',  14,  0.6,  3.0,  0.1,  0.5, 'lunch'),
  ('Bendakaya (Lady Finger / Okra)','veg',    'weight_loss',  33,  2.0,  7.0,  0.2,  3.2, 'lunch'),
  ('Chikkudukaya (Broad Beans)',     'veg',    'weight_loss',  40,  3.6,  7.0,  0.4,  2.0, 'lunch'),
  ('Munaga Aaku (Drumstick Leaves)','veg',    'weight_loss',  64,  9.4,  8.5,  1.4,  2.0, 'any'),
  ('Thotakura (Amaranth Leaves)',    'veg',    'weight_loss',  27,  2.5,  4.0,  0.3,  1.5, 'any'),
  ('Pesarattu (Moong Crepe)',        'veg',    'weight_loss', 130,  6.0, 18.0,  4.0,  2.0, 'breakfast'),
  ('Jonna Roti (Jowar Flatbread)',   'veg',    'weight_loss', 150,  4.0, 30.0,  1.5,  2.5, 'any'),
  ('Pongal (Rice + Dal)',            'veg',    'both',        150,  4.5, 25.0,  4.0,  1.5, 'breakfast'),
  ('Chepa Pulusu (Fish Curry)',      'non-veg','both',        150, 15.0,  8.0,  6.0,  1.0, 'lunch'),
  ('Kodi Kura (Chicken Curry)',      'non-veg','both',        175, 20.0,  5.0,  8.0,  0.5, 'lunch'),
  ('Gongura Pachadi (Chutney)',      'veg',    'weight_loss',  60,  2.0,  8.0,  2.0,  1.5, 'any'),
  ('Nuvvula Unda (Sesame Ladoo)',    'veg',    'weight_gain', 380,  7.0, 50.0, 18.0,  4.0, 'snack'),
  ('Dosa (Plain)',                   'veg',    'weight_loss', 168,  4.0, 30.0,  3.7,  1.0, 'breakfast')

ON CONFLICT (name) DO NOTHING;

-- Verify: check how many foods were inserted
SELECT COUNT(*) AS total_foods FROM foods;

-- ══════════════════════════════════════════════════════════════
-- Coach Personal Health Tables
-- Run this section if you are adding coach personal features
-- ══════════════════════════════════════════════════════════════

-- Coach personal body composition history
CREATE TABLE IF NOT EXISTS coach_body_composition (
  id               UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id         UUID    REFERENCES coaches(id) ON DELETE CASCADE,
  date             DATE    NOT NULL DEFAULT CURRENT_DATE,
  weight           NUMERIC,           -- kg
  height           NUMERIC,           -- cm
  fat_percentage   NUMERIC,           -- %
  muscle_percentage NUMERIC,          -- %
  bmi              NUMERIC,
  visceral_fat     NUMERIC,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE coach_body_composition ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Public read coach_body_composition"  ON coach_body_composition FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Public insert coach_body_composition" ON coach_body_composition FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Public delete coach_body_composition" ON coach_body_composition FOR DELETE USING (true);

-- Add personal diet plan and food restrict columns to coaches table
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS personal_diet_plan    TEXT;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS personal_food_restrict TEXT DEFAULT '[]';

-- Add coach_id column to food_log_entries (so coaches can log their own food)
ALTER TABLE food_log_entries ADD COLUMN IF NOT EXISTS coach_id UUID REFERENCES coaches(id) ON DELETE CASCADE;

-- Allow coach_id-based queries
CREATE POLICY IF NOT EXISTS "Public update food_log_entries" ON food_log_entries FOR UPDATE USING (true);

-- Verify
SELECT COUNT(*) AS coach_body_records FROM coach_body_composition;
