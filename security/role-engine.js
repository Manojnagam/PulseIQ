/**
 * PulseIQ Phase 3.1 — Enterprise Security & RBAC
 * Role Engine
 * 
 * Defines explicit, deterministic permission sets for all 6 system roles:
 * 1. System Administrator (sys_admin)
 * 2. Organisation Owner (org_owner)
 * 3. Centre Manager (centre_manager)
 * 4. Coach (coach)
 * 5. Reception Staff (receptionist)
 * 6. Viewer (viewer)
 */

(function(window) {
  'use strict';

  const ROLES = {
    sys_admin: {
      id: 'sys_admin',
      name: 'System Administrator',
      level: 100,
      permissions: ['*'] // Wildcard full access
    },
    org_owner: {
      id: 'org_owner',
      name: 'Organisation Owner',
      level: 90,
      permissions: [
        'dashboard:read', 'customers:read', 'customers:write',
        'coaches:read', 'coaches:write', 'finance:read', 'finance:write',
        'inventory:read', 'inventory:write', 'reports:read', 'bi:read',
        'action_center:read', 'action_center:execute', 'customer_risk:read',
        'coach_analytics:read', 'followup_queue:read', 'followup_queue:execute',
        'goal_tracking:read', 'goal_tracking:write', 'forecasting:read',
        'executive_dashboard:read', 'settings:manage', 'users:manage'
      ]
    },
    centre_manager: {
      id: 'centre_manager',
      name: 'Centre Manager',
      level: 70,
      permissions: [
        'dashboard:read', 'customers:read', 'customers:write',
        'coaches:read', 'finance:read', 'inventory:read', 'inventory:write',
        'reports:read', 'bi:read', 'action_center:read', 'action_center:execute',
        'customer_risk:read', 'coach_analytics:read', 'followup_queue:read',
        'followup_queue:execute', 'goal_tracking:read', 'forecasting:read',
        'executive_dashboard:read'
      ]
    },
    coach: {
      id: 'coach',
      name: 'Coach',
      level: 50,
      permissions: [
        'dashboard:read', 'customers:read', 'customers:write',
        'reports:read', 'customer_risk:read', 'followup_queue:read',
        'followup_queue:execute'
      ]
    },
    receptionist: {
      id: 'receptionist',
      name: 'Reception Staff',
      level: 30,
      permissions: [
        'dashboard:read', 'customers:read', 'finance:write',
        'action_center:read'
      ]
    },
    viewer: {
      id: 'viewer',
      name: 'Viewer',
      level: 10,
      permissions: [
        'dashboard:read', 'customers:read', 'reports:read'
      ]
    }
  };

  function getRole(roleId) {
    return ROLES[roleId] || ROLES.viewer;
  }

  function getAllRoles() {
    return { ...ROLES };
  }

  window.PulseIQ_RoleEngine = {
    getRole: getRole,
    getAllRoles: getAllRoles
  };

})(typeof window !== 'undefined' ? window : global);
