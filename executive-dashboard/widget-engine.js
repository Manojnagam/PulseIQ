/**
 * PulseIQ Phase 2.8 — Executive Intelligence Dashboard
 * Widget Engine
 * Milestone 6 Implementation
 * 
 * Aggregates widget snapshot payloads across executive dimensions including Task Telemetry.
 * ZERO RE-CALCULATION. REUSES MODULE OUTPUTS DIRECTLY.
 * ZERO POLLING. ZERO BACKGROUND TIMERS.
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
    const customers = D.customers || [];

    const todayStr = new Date().toISOString().split('T')[0];

    // Milestone 6 Task Telemetry Computation (Data Flow: Task Service -> Task Metrics -> Widget Payload)
    const allTasks = (window.PulseIQ_TaskRenderer && window.PulseIQ_TaskRenderer.state && window.PulseIQ_TaskRenderer.state.tasks) || [];
    const activeTasks = allTasks.filter(t => !['Closed', 'Cancelled'].includes(t.status));
    const openTasks = allTasks.filter(t => ['Pending', 'Assigned', 'In Progress'].includes(t.status)).length;
    
    const now = Date.now();
    const overdueTasks = activeTasks.filter(t => t.due_date && new Date(t.due_date).setHours(23, 59, 59, 999) < now).length;

    const completedTasks = allTasks.filter(t => ['Completed', 'Verified', 'Closed'].includes(t.status));
    let taskSlaCompliancePct = 100;
    if (completedTasks.length > 0) {
      const onTimeTasks = completedTasks.filter(t => !t.due_date || (t.completed_at && new Date(t.completed_at) <= new Date(t.due_date)) || (t.updated_at && new Date(t.updated_at) <= new Date(t.due_date)));
      taskSlaCompliancePct = Math.round((onTimeTasks.length / completedTasks.length) * 100);
    }

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
      upcomingRenewals: customers.filter(c => c.expiry_date && c.expiry_date >= todayStr).slice(0, 4),
      // Milestone 6 Task Metrics Payload
      taskMetrics: {
        openTasks: openTasks,
        overdueTasks: overdueTasks,
        taskSlaCompliancePct: taskSlaCompliancePct
      }
    };
  }

  window.PulseIQ_WidgetEngine = {
    buildWidgetPayloads: buildWidgetPayloads
  };

})(typeof window !== 'undefined' ? window : global);
