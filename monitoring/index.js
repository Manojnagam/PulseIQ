/**
 * PulseIQ Phase 3.5 — Audit Logs, Monitoring & Observability
 * Main Orchestrator & Public API Namespace
 * 
 * Exposes PulseIQ_Monitoring public API encapsulating Central Audit Logs,
 * Event Logging, Performance Metrics, System Health Monitoring & Diagnostics.
 */

(function(window) {
  'use strict';

  window.PulseIQ_Monitoring = {
    Audit: window.PulseIQ_MonitoringAuditEngine || {},
    EventLog: window.PulseIQ_MonitoringEventLog || {},
    Metrics: window.PulseIQ_MonitoringMetricsEngine || {},
    Health: window.PulseIQ_MonitoringHealthMonitor || {},
    Diagnostics: window.PulseIQ_MonitoringDiagnosticsEngine || {},
    Renderer: window.PulseIQ_MonitoringRenderer || {},
    version: '3.5.0'
  };

})(typeof window !== 'undefined' ? window : global);
