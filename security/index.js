/**
 * PulseIQ Phase 3.1 — Enterprise Security & RBAC
 * Main Orchestrator & Public API Namespace
 * 
 * Exposes PulseIQ_Security public API encapsulating Roles, Permissions,
 * Authentication, Session Management, and Audit Logging.
 */

(function(window) {
  'use strict';

  window.PulseIQ_Security = {
    Auth: window.PulseIQ_AuthService || {},
    Roles: window.PulseIQ_RoleEngine || {},
    Permissions: window.PulseIQ_PermissionEngine || {},
    Session: window.PulseIQ_SessionManager || {},
    Audit: window.PulseIQ_AuditHelper || {},
    version: '3.1.0'
  };

})(typeof window !== 'undefined' ? window : global);
