-- ==========================================
-- TASK CENTRE PHASE 1 — ADDITIVE DB SCHEMA
-- Migration: Milestone 1 Database Foundation
-- Production Safe: 100% Additive, Zero Impact on Existing Tables
-- ==========================================

-- 1. TASKS MASTER TABLE
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wellness_center_id uuid NOT NULL REFERENCES wellness_centers(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(trim(title)) >= 3),
  description text,
  category text NOT NULL DEFAULT 'General',
  priority text NOT NULL DEFAULT 'MEDIUM',
  status text NOT NULL DEFAULT 'Pending',
  assigned_to_coach_id uuid REFERENCES coaches(id) ON DELETE SET NULL,
  related_customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  created_by_user_id text NOT NULL DEFAULT 'system',
  due_date timestamptz,
  completed_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT chk_tasks_priority CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW')),
  CONSTRAINT chk_tasks_status CHECK (status IN ('Pending', 'Assigned', 'In Progress', 'Completed', 'Verified', 'Closed', 'Cancelled')),
  CONSTRAINT chk_tasks_category CHECK (category IN ('General', 'Attendance', 'Membership', 'Risk', 'Payment', 'Inventory', 'Onboarding', 'FollowUp'))
);

-- 2. TASK AUDIT HISTORY TABLE
CREATE TABLE IF NOT EXISTS task_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  changed_by_coach_id uuid REFERENCES coaches(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_center_status ON tasks (wellness_center_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_coach ON tasks (assigned_to_coach_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_customer ON tasks (related_customer_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks (due_date) WHERE status NOT IN ('Closed', 'Cancelled');
CREATE INDEX IF NOT EXISTS idx_task_history_task_id ON task_history (task_id, created_at DESC);

-- Row Level Security (RLS) & Policies
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_tasks" ON tasks FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_task_history" ON task_history FOR ALL TO anon USING (true) WITH CHECK (true);
