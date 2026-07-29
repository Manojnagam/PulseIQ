/**
 * PulseIQ Phase 3.1 — Enterprise Security & RBAC
 * Audit Helper
 * 
 * Records security & authorization events with timestamp, user context, and details.
 * Extensible for future database audit persistence.
 */

(function(window) {
  'use strict';

  const STORAGE_KEY = 'pulseiq_audit_log_v1';
  let auditLogs = [];

  function loadAuditLogs() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) auditLogs = JSON.parse(saved);
      } catch (e) {
        auditLogs = [];
      }
    }
  }

  function saveAuditLogs() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(auditLogs.slice(-100))); // Keep last 100 entries
      } catch (e) {}
    }
  }

  function logEvent(eventType, details, userContext) {
    loadAuditLogs();

    const entry = {
      id: 'audit-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      timestamp: new Date().toISOString(),
      type: eventType, // LOGIN, LOGOUT, FAILED_LOGIN, PERMISSION_DENIED, etc.
      user: userContext || { id: 'anonymous', role: 'guest' },
      details: details || {}
    };

    auditLogs.push(entry);
    saveAuditLogs();
    return entry;
  }

  function getAuditLogs() {
    loadAuditLogs();
    return auditLogs.slice();
  }

  function clearAuditLogs() {
    auditLogs = [];
    if (typeof window !== 'undefined' && window.localStorage) {
      try { window.localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    }
  }

  window.PulseIQ_AuditHelper = {
    logEvent: logEvent,
    getAuditLogs: getAuditLogs,
    clearAuditLogs: clearAuditLogs
  };

})(typeof window !== 'undefined' ? window : global);
