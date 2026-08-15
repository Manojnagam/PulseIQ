# 🔄 PULSEIQ — TASK CENTRE PHASE 1: RELEASE CANDIDATE (RC1) ROLLBACK GUIDE

**Document ID**: `Phase1_RC1_Rollback_Guide.md`  
**Status**: `RELEASE CANDIDATE 1 (RC1) — VERIFIED ROLLBACK PROCEDURES` 🛑  
**Date**: August 9, 2026

---

## 1. PURPOSE & APPLICABILITY

This document outlines the step-by-step procedure to revert Task Centre Phase 1 changes on localhost or staging if any unforeseen issue is identified during project owner verification or independent audit.

---

## 2. REVERSIBILITY INVARIANTS

1. **Additive Storage**: Production tables (`customers`, `attendance`, `finance`, `coaches`) contain **ZERO** schema modifications.
2. **Modular Isolation**: All Task Centre logic is contained inside `task-center/`, `supabase/task_centre_phase1_migration.sql`, and appended sections in `index.html`. Reverting frontend files restores 100% of baseline state.

---

## 3. STEP-BY-STEP ROLLBACK PROCEDURE

### Step 1: Revert Code Files (Git)
Execute the following commands in the repository root:
```bash
# Revert modified core files
git checkout HEAD -- index.html coach-analytics/scoring-engine.js executive-dashboard/widget-engine.js executive-dashboard/dashboard-renderer.js PROJECT_STATUS.md MASTER_BUILD_PLAN.md

# Remove newly created task-center directory
rm -rf task-center/
```

### Step 2: Revert Database Migration (Postgres / Supabase)
If database migration was executed, run the following SQL script:
```sql
-- Rollback Task Centre Phase 1 Tables
DROP TABLE IF EXISTS public.task_history CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
```

### Step 3: Verification
1. Reload browser application on `http://localhost:3000` (or local web server).
2. Confirm console has 0 errors and application operates in pre-Task Centre state.

---

## 4. ESTIMATED RECOVERY TIME

- **Code Rollback**: $< 1 \text{ minute}$
- **Database Rollback**: $< 1 \text{ minute}$
- **Total Recovery Time**: $< 2 \text{ minutes}$
