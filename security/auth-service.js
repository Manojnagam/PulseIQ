/**
 * PulseIQ Phase 3.1 — Enterprise Security & RBAC
 * Authentication & Access Control Service
 * 
 * Public security API providing authentication, role checks, section guards,
 * and navigation protection interceptors.
 */

(function(window) {
  'use strict';

  function login(email, password, roleId, rememberMe) {
    if (!email || !password) {
      if (window.PulseIQ_AuditHelper) {
        window.PulseIQ_AuditHelper.logEvent('FAILED_LOGIN', { reason: 'Missing credentials', email: email });
      }
      return { success: false, error: 'Email and password are required.' };
    }

    const userPayload = {
      id: 'usr-' + Date.now(),
      name: email.split('@')[0] || 'User',
      email: email,
      roleId: roleId || 'centre_manager'
    };

    const session = window.PulseIQ_SessionManager
      ? window.PulseIQ_SessionManager.createSession(userPayload, rememberMe)
      : null;

    return { success: true, session: session };
  }

  function logout() {
    if (window.PulseIQ_SessionManager) {
      window.PulseIQ_SessionManager.destroySession();
    }
    return { success: true };
  }

  function currentUser() {
    const sess = window.PulseIQ_SessionManager ? window.PulseIQ_SessionManager.getCurrentSession() : null;
    return sess ? sess.user : { id: 'usr-guest', name: 'Guest User', roleId: 'viewer' };
  }

  function hasPermission(permissionKey) {
    const user = currentUser();
    if (window.PulseIQ_PermissionEngine) {
      return window.PulseIQ_PermissionEngine.hasPermission(user.roleId, permissionKey);
    }
    return true;
  }

  function canAccessSection(sectionName) {
    const user = currentUser();
    if (sectionName === 'taskcenter') {
      const allowed = hasPermission('tasks:read');
      if (!allowed && window.PulseIQ_AuditHelper) {
        window.PulseIQ_AuditHelper.logEvent('PERMISSION_DENIED', { section: sectionName, requiredRole: user.roleId }, user);
      }
      return allowed;
    }
    if (window.PulseIQ_PermissionEngine) {
      const allowed = window.PulseIQ_PermissionEngine.canAccessSection(user.roleId, sectionName);
      if (!allowed && window.PulseIQ_AuditHelper) {
        window.PulseIQ_AuditHelper.logEvent('PERMISSION_DENIED', { section: sectionName, requiredRole: user.roleId }, user);
      }
      return allowed;
    }
    return true;
  }

  function canCreateTask() {
    return hasPermission('tasks:create');
  }

  function canAssignTask() {
    return hasPermission('tasks:assign');
  }

  function canManageTask() {
    return hasPermission('tasks:manage');
  }

  function canReadTasks() {
    return hasPermission('tasks:read');
  }

  // Intercept section navigation safely for route protection
  if (typeof window !== 'undefined') {
    const origGoTo = window.goTo;
    window.goTo = function(sec, el) {
      console.log('TRACE-14: security/auth-service goTo wrapper start');
      if (!canAccessSection(sec)) {
        console.warn(`[PulseIQ Security] Access Denied to section '${sec}' for role '${currentUser().roleId}'`);
        if (typeof window.showToast === 'function') {
          window.showToast(`🔒 Access Denied: Requires higher permission role to view ${sec}.`);
        } else if (typeof alert !== 'undefined') {
          alert(`🔒 Access Denied: Your role does not have permission to view ${sec}.`);
        }
        return false;
      }
      if (typeof origGoTo === 'function') {
        console.log('TRACE-15: security/auth-service calling origGoTo');
        return origGoTo(sec, el);
      }
    };
  }

  window.PulseIQ_AuthService = {
    login: login,
    logout: logout,
    currentUser: currentUser,
    hasPermission: hasPermission,
    canAccessSection: canAccessSection,
    canCreateTask: canCreateTask,
    canAssignTask: canAssignTask,
    canManageTask: canManageTask,
    canReadTasks: canReadTasks,
    version: '3.1.1'
  };

})(typeof window !== 'undefined' ? window : global);
