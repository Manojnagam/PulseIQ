/**
 * PulseIQ Phase 3.5 — Audit Logs, Monitoring & Observability
 * Health Monitor
 * 
 * Monitors the runtime availability and operational health of all 12 PulseIQ modules.
 */

(function(window) {
  'use strict';

  function checkSystemHealth() {
    const modules = [
      { id: 'shared', name: 'Shared Core Layer', version: window.PulseIQ_Shared ? window.PulseIQ_Shared.version : '2.0.0', isAvailable: !!window.PulseIQ_Shared },
      { id: 'security', name: 'Security & RBAC', version: window.PulseIQ_Security ? window.PulseIQ_Security.version : '3.1.0', isAvailable: !!window.PulseIQ_Security },
      { id: 'organisation', name: 'Multi-Location Org', version: window.PulseIQ_Organisation ? window.PulseIQ_Organisation.version : '3.2.0', isAvailable: !!window.PulseIQ_Organisation },
      { id: 'communication', name: 'Communication Hub', version: window.PulseIQ_Communication ? window.PulseIQ_Communication.version : '3.3.0', isAvailable: !!window.PulseIQ_Communication },
      { id: 'reporting', name: 'Reporting & Export', version: window.PulseIQ_Reporting ? window.PulseIQ_Reporting.version : '3.4.0', isAvailable: !!window.PulseIQ_Reporting },
      { id: 'bi', name: 'AI BI Analyst Engine', version: '2.1.0', isAvailable: !!window.PulseIQ_BI },
      { id: 'action-center', name: 'Action Centre Tasks', version: '2.2.0', isAvailable: !!window.PulseIQ_ActionCenter },
      { id: 'customer-risk', name: 'Customer Risk Scoring', version: '2.3.0', isAvailable: !!window.PulseIQ_CustomerRisk },
      { id: 'coach-analytics', name: 'Coach Analytics', version: '2.4.0', isAvailable: !!window.PulseIQ_CoachAnalytics },
      { id: 'customer-followup', name: 'Follow-up Queue', version: '2.5.0', isAvailable: !!window.PulseIQ_CustomerFollowup },
      { id: 'goal-tracking', name: 'Goal Tracking KPIs', version: '2.6.0', isAvailable: !!window.PulseIQ_GoalTracking },
      { id: 'forecasting', name: 'Business Forecasting', version: '2.7.0', isAvailable: !!window.PulseIQ_Forecasting },
      { id: 'executive-dashboard', name: 'Executive Command', version: '2.8.0', isAvailable: !!window.PulseIQ_ExecutiveDashboard }
    ];

    const healthyCount = modules.filter(m => m.isAvailable).length;
    const overallStatus = healthyCount === modules.length ? 'HEALTHY 🟢' : (healthyCount >= 10 ? 'DEGRADED 🟡' : 'OFFLINE 🔴');

    return {
      overallStatus: overallStatus,
      healthyModuleCount: healthyCount,
      totalModuleCount: modules.length,
      modules: modules
    };
  }

  window.PulseIQ_MonitoringHealthMonitor = {
    checkSystemHealth: checkSystemHealth
  };

})(typeof window !== 'undefined' ? window : global);
