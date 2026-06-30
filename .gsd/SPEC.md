# SPEC.md — Client Dashboard Motivation & Connection Features

> **Status**: `FINALIZED`
>
> ⚠️ **Planning Lock**: SPEC is finalized. We can now proceed to implementation.

## Vision
To build a highly gamified, socially connected, and deeply motivational ecosystem that turns your wellness center from a routine visit into an essential, life-long lifestyle. We will implement five advanced client engagement features across the client dashboard and coach dashboard.

## Goals

### 1. The "Visual Wellness Garden" (Visualizing Habit Growth)
- Display a dynamic, styled SVG plant on [client.html](file:///C:/NandithaManoj/pulseiq-app/client.html).
- The plant dynamically grows through 5 stages of maturity based on client daily compliance:
  1. **Stage 1 (Seed):** Default state of the day.
  2. **Stage 2 (Sprout):** Attendance check-in complete.
  3. **Stage 3 (Budding):** Logged at least 1L of water.
  4. **Stage 4 (Flowering):** Logged meals in the food log.
  5. **Stage 5 (Fully Bloomed):** Hitting daily water target (e.g. 3L) and logged meals.

### 2. Social Proof & Team Goals ("Our Center Wall")
- Create a community section on the client dashboard:
  - **Center Check-in Goal:** Visual progress bar of total check-ins in the center this month (e.g., Target: 500 physical check-ins).
  - **Checked-in Today:** List of first names of club members checked in today.
  - **Streak Leaderboard:** Top 5 active members with the highest check-in streaks.
- All stats are queried dynamically from the `attendance` table using Supabase PostgREST joins.

### 3. "Coach Nudges" & Dopamine Sparks
- A real-time interaction log:
  - **Client View:** Receive popup toast alerts or notifications if the coach sent a "Spark", "Cheer", or "Nudge". Clients can send a "Wave 👋" back with a 1-tap button.
  - **Coach View:** A quick-action checklist next to clients in [coach.html](file:///C:/NandithaManoj/pulseiq-app/coach.html) to trigger "Spark", "Cheer", or "Nudge" actions.
- Stored in a new Postgres table `client_interactions`.

### 4. Interactive Transformation Timeline Slider
- Replace static Before/After photos with a swipable slider interface.
- Clients can upload multiple photos over time. The app displays a select dropdown or swipe slider to view visual progress month-by-month.
- Photo list is stored in a JSON column `photo_history` in `customers`.

### 5. Identity Shift (The "Club Mentor" Program)
- Automatically calculate client membership ranks based on achievements:
  - **🟢 Novice:** Active member (0-24 check-ins).
  - **🔵 Achiever:** Consistency achiever (25+ check-ins OR 5kg+ weight loss).
  - **👑 Club Mentor:** Community mentor (50+ check-ins AND referred 1+ active friends).
- Display a visual badge on the dashboard with a custom description explaining how to unlock the next tier.

---

## Technical Requirements & Schema Migrations

### 1. Database Schema (Supabase / Postgres)
```sql
-- Add water and mood logging support to daily attendance
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS water_logged numeric DEFAULT 0;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS mood text;

-- Add photo history and rank values to customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS photo_history text; -- JSON array of { date, url }

-- Create client interactions table for Sparks/Nudges
CREATE TABLE IF NOT EXISTS client_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  sender_type text, -- 'coach' or 'client'
  type text, -- 'nudge', 'wave', 'spark', 'cheer'
  message text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE client_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON client_interactions FOR ALL TO anon USING (true) WITH CHECK (true);
```

### 2. Client Portal Changes ([client.html](file:///C:/NandithaManoj/pulseiq-app/client.html))
- Add CSS variables and containers for the Visual Garden SVG.
- Add UI section for the "Center Wall" (Group goal progress, active members marquee, leaderboard table).
- Add slide/carousel component for Transformation Timeline.
- Add notifications listener to poll or fetch `/rest/v1/client_interactions` for coach nudges.
- Add logic to calculate active rank based on metrics.

### 3. Coach Portal Changes ([coach.html](file:///C:/NandithaManoj/pulseiq-app/coach.html))
- Render client interaction logs.
- Add buttons to "Send Cheer", "Send Spark", or "Send Nudge" which write to the DB.
- Show mood/water metrics of checked-in clients.

---

## Success Criteria
- [ ] Visual garden dynamically changes stages based on daily water, attendance, and meals.
- [ ] Checked-in list and streaks leaderboard render data correctly from Supabase.
- [ ] Sparks/Nudges sent by coach appear instantly on client dashboard.
- [ ] Timeline slider renders multiple photos in chronological order.
- [ ] Tiers/badges compute and display correctly based on database statistics.

*Last updated: June 30, 2026*
