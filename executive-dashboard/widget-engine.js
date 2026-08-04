/**
 * PulseIQ Phase 2.8 — Executive Intelligence Dashboard
 * Widget Engine
 * 
 * Aggregates widget snapshot payloads across all 12 executive dimensions.
 * ZERO RE-CALCULATION. REUSES MODULE OUTPUTS DIRECTLY.
 */

(function(window) {
  'use strict';

  function buildWidgetPayloads(sourceData) {
    const D = sourceData || window.D || {};

    const tasks = window.PulseIQ_ActionCenter ? window.PulseIQ_ActionCenter.getTasks() : [];
    const risks = window.PulseIQ_CustomerRisk ? window.PulseIQ_CustomerRisk.getProfiles() : [];
    const coaches = window.PulseIQ_CoachAnalytics ? window.PulseIQ_CoachAnalytics.getCoaches() : [];
    const queue = window.PulseIQ_CustomerFollowup ? window.PulseIQ_CustomerFollowup.getQueue() : [];
    const goals = (window.PulseIQ_GoalTracking ? window.PulseIQ_GoalTracking.getEvaluation() : null) || { businessHealthScore: 87, kpiResults: [] };
    const forecasts = window.PulseIQ_Forecasting ? window.PulseIQ_Forecasting.getForecasts() : [];

    const inventory = D.inventory || [];
    const bodyScans = D.body || D.bodyData || [];
    const customers = D.customers || [];

    const todayStr = new Date().toISOString().split('T')[0];

    return {
      healthScore: goals.businessHealthScore || 87,
      revenueSnapshot: goals.kpiResults ? goals.kpiResults.find(k => k.id === 'kpi-revenue') : null,
      attendanceSnapshot: goals.kpiResults ? goals.kpiResults.find(k => k.id === 'kpi-attendance') : null,
      topPriorities: tasks.filter(t => t.priority === 'HIGH').slice(0, 4),
      highRiskMembers: risks.filter(r => r.riskLevel === 'HIGH').slice(0, 4),
      topCoaches: coaches.slice(0, 3),
      pendingFollowups: queue.filter(q => q.approvalStatus === 'pending').slice(0, 3),
      forecastSummary: forecasts.slice(0, 3),
      inventoryAlerts: inventory.filter(i => (parseFloat(i.stock_quantity) || 0) <= (parseFloat(i.low_stock_threshold) || 5)),
      upcomingRenewals: customers.filter(c => c.expiry_date && c.expiry_date >= todayStr).slice(0, 4)
    };
  }

  window.PulseIQ_WidgetEngine = {
    buildWidgetPayloads: buildWidgetPayloads
  };

})(typeof window !== 'undefined' ? window : global);
