/**
 * PulseIQ Phase 4.0 — Production Hardening & Release Candidate
 * Main Orchestrator & Public API Namespace
 * 
 * Exposes PulseIQ_Release public API encapsulating Validation Engine, Regression Engine,
 * Security Review, Compatibility Engine, Release Checklist, Documentation Engine, & Renderer UI.
 */

(function(window) {
  'use strict';

  window.PulseIQ_Release = {
    Validation: window.PulseIQ_ValidationEngine || {},
    Regression: window.PulseIQ_RegressionEngine || {},
    Security: window.PulseIQ_SecurityReview || {},
    Compatibility: window.PulseIQ_CompatibilityEngine || {},
    Checklist: window.PulseIQ_ReleaseChecklist || {},
    Documentation: window.PulseIQ_DocumentationEngine || {},
    Renderer: window.PulseIQ_ReleaseRenderer || {},
    version: '1.0.0-RC1'
  };

  // Auto-render release dashboard if container present on DOM load
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function() {
      if (document.getElementById('sec-release') && window.PulseIQ_ReleaseRenderer) {
        window.PulseIQ_ReleaseRenderer.renderReleaseDashboard('sec-release');
      }
    });
  }

})(typeof window !== 'undefined' ? window : global);
