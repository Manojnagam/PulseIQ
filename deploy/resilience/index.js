/**
 * PulseIQ Phase 3.9 — Backup, Disaster Recovery & Business Continuity
 * Main Orchestrator & Public API Namespace
 * 
 * Exposes PulseIQ_Resilience public API encapsulating Backup Engine, Restore Engine,
 * Snapshot Engine, Recovery Engine, Continuity Engine, & Resilience Renderer UI.
 */

(function(window) {
  'use strict';

  window.PulseIQ_Resilience = {
    Backup: window.PulseIQ_BackupEngine || {},
    Restore: window.PulseIQ_RestoreEngine || {},
    Snapshot: window.PulseIQ_SnapshotEngine || {},
    Recovery: window.PulseIQ_RecoveryEngine || {},
    Continuity: window.PulseIQ_ContinuityEngine || {},
    Renderer: window.PulseIQ_ResilienceRenderer || {},
    version: '3.9.0'
  };

  // Auto-render resilience dashboard if container present on DOM load
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function() {
      if (document.getElementById('sec-resilience') && window.PulseIQ_ResilienceRenderer) {
        window.PulseIQ_ResilienceRenderer.renderResilienceDashboard('sec-resilience');
      }
    });
  }

})(typeof window !== 'undefined' ? window : global);
