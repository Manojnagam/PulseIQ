/**
 * PulseIQ Phase 3.1 — Enterprise Security & RBAC
 * Permission Engine
 * 
 * Validates deterministic permissions for user roles across 14 domain scopes.
 * Maps application sections to explicit permission requirements.
 */

(function(window) {
  'use strict';

  const SECTION_PERMISSIONS = {
    overview: 'dashboard:read',
    bizanalyst: 'bi:read',
    actioncenter: 'action_center:read',
    customerrisk: 'customer_risk:read',
    coachanalytics: 'coach_analytics:read',
    customerfollowup: 'followup_queue:read',
    goaltracking: 'goal_tracking:read',
    forecasting: 'forecasting:read',
    executivedashboard: 'executive_dashboard:read',
    customers: 'customers:read',
    coaches: 'coaches:read',
    payments: 'finance:read',
    expenses: 'finance:read',
    inventory: 'inventory:read'
  };

  function hasPermission(roleId, permissionKey) {
    if (!roleId || !permissionKey) return false;

    const role = window.PulseIQ_RoleEngine ? window.PulseIQ_RoleEngine.getRole(roleId) : null;
    if (!role) return false;

    if (role.permissions.includes('*')) return true; // System Admin wildcard

    return role.permissions.includes(permissionKey);
  }

  function canAccessSection(roleId, sectionName) {
    const requiredPerm = SECTION_PERMISSIONS[sectionName];
    if (!requiredPerm) return true; // Unrestricted public section
    return hasPermission(roleId, requiredPerm);
  }

  window.PulseIQ_PermissionEngine = {
    hasPermission: hasPermission,
    canAccessSection: canAccessSection,
    getSectionPermissions: function() { return { ...SECTION_PERMISSIONS }; }
  };

})(typeof window !== 'undefined' ? window : global);
