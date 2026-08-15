# 🔒 PULSEIQ — TASK CENTRE PHASE 1: RELEASE CANDIDATE (RC1) SECURITY REPORT

**Document ID**: `Phase1_RC1_Security_Report.md`  
**Status**: `RELEASE CANDIDATE 1 (RC1) — RBAC & SECURITY AUDITED` 🛑  
**Date**: August 9, 2026  
**Security Module**: `security/role-engine.js` & `security/auth-service.js`

---

## 1. SECURITY & RBAC OVERVIEW

Task Centre access control is governed by four permission keys mapped across all six system roles in `security/role-engine.js`:
- `tasks:read`: Capability to view task feeds and audit history.
- `tasks:create`: Capability to instantiate new tasks.
- `tasks:assign`: Capability to assign or re-assign tasks to coaches.
- `tasks:manage`: Capability to transition task statuses, cancel tasks, and manage center-wide feeds.

---

## 2. ROLE PERMISSION MAPPING MATRIX

| System Role | `tasks:read` | `tasks:create` | `tasks:assign` | `tasks:manage` | View Mode Rendered |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **`sys_admin`** | ✅ | ✅ | ✅ | ✅ | Full Manager Control Feed |
| **`org_owner`** | ✅ | ✅ | ✅ | ✅ | Full Manager Control Feed |
| **`centre_manager`** | ✅ | ✅ | ✅ | ✅ | Full Manager Control Feed |
| **`coach`** | ✅ | ❌ | ❌ | ❌ | Restricted "My Tasks" Feed |
| **`receptionist`** | ✅ | ✅ | ❌ | ❌ | Front Desk Task Creation |
| **`viewer`** | ✅ | ❌ | ❌ | ❌ | Read-Only Feed |

---

## 3. SECURITY VERIFICATION SUMMARY

1. **Coach View Security Restriction**:
   - `coach` role lacks `tasks:manage`.
   - UI feed filter strictly restricts tasks to `assigned_to_coach_id === currentUser.id`.
   - Manager metrics cards, coach filter dropdowns, and re-assignment controls are hidden from DOM rendering.
2. **State Transition Validation**:
   - Status updates pass through `PulseIQ_TaskService.updateStatus()`, enforcing the 7-state lifecycle transition matrix (`STATE_TRANSITIONS`). Illegal jumps (e.g. `Pending` $\rightarrow$ `Closed`) are rejected at the service boundary.
3. **Audit History Enforcement**:
   - Every mutation (`updateStatus`, `assignCoach`, `cancelTask`) writes an immutable record to `task_history` capturing `previous_status`, `new_status`, `changed_by_user_id`, and timestamp.
