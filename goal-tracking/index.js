/**
 * PulseIQ Phase 2.6 — Goal Tracking & KPI Targets
 * Main Orchestrator & Public API
 * 
 * Manages target thresholds, progress calculations, KPI comparisons,
 * and UI dashboard rendering.
 */

(function(window) {
  'use strict';

  let cachedEvaluation = null;

  function refreshDashboard(sourceData) {
    const D = sourceData || window.D || {};
    const targets = window.PulseIQ_TargetEngine ? window.PulseIQ_TargetEngine.getTargets() : {};

    if (window.PulseIQ_ProgressEngine) {
      cachedEvaluation = window.PulseIQ_ProgressEngine.evaluateProgress(D, targets);
    } else {
      console.warn('[PulseIQ Goal Tracking] ProgressEngine not loaded');
      cachedEvaluation = { businessHealthScore: 85, kpiResults: [] };
    }

    if (window.PulseIQ_GoalDashboardRenderer) {
      window.PulseIQ_GoalDashboardRenderer.renderDashboard(cachedEvaluation);
    }

    return cachedEvaluation;
  }

  function setCategoryFilter(val) {
    if (window.PulseIQ_GoalDashboardRenderer) {
      window.PulseIQ_GoalDashboardRenderer.setCategoryFilter(val);
      window.PulseIQ_GoalDashboardRenderer.renderDashboard(cachedEvaluation);
    }
  }

  function setSearchQuery(val) {
    if (window.PulseIQ_GoalDashboardRenderer) {
      window.PulseIQ_GoalDashboardRenderer.setSearchQuery(val);
      window.PulseIQ_GoalDashboardRenderer.renderDashboard(cachedEvaluation);
    }
  }

  function promptCustomTarget() {
    if (typeof window === 'undefined') return;
    const key = prompt('Enter Target Key to customize (e.g. monthlyRevenue, newCustomers, attendancePct):', 'monthlyRevenue');
    if (!key) return;
    const currentVal = (window.PulseIQ_TargetEngine.getTargets())[key] || 100;
    const newVal = prompt(`Enter new target value for ${key}:`, currentVal);
    if (newVal !== null) {
      window.PulseIQ_TargetEngine.setTarget(key, newVal);
      refreshDashboard(window.D);
      if (typeof window.showToast === 'function') {
        window.showToast(`🎯 Updated target for ${key} to ${newVal}`);
      }
    }
  }

  function resetTargets() {
    if (window.PulseIQ_TargetEngine) {
      window.PulseIQ_TargetEngine.resetTargets();
    }
    refreshDashboard(window.D);
  }

  // Intercept section rendering safely
  if (typeof window !== 'undefined') {
    const origGoTo = window.goTo;
    window.goTo = function(sec, el) {
      console.log('TRACE-06: goal-tracking goTo wrapper start');
      if (typeof origGoTo === 'function') {
        console.log('TRACE-07: goal-tracking calling origGoTo');
        origGoTo(sec, el);
      }
      if (sec === 'goaltracking') {
        refreshDashboard(window.D);
      }
    };
  }

  window.PulseIQ_GoalTracking = {
    refreshDashboard: refreshDashboard,
    setCategoryFilter: setCategoryFilter,
    setSearchQuery: setSearchQuery,
    promptCustomTarget: promptCustomTarget,
    resetTargets: resetTargets,
    getEvaluation: function() { return cachedEvaluation; },
    version: '2.6.0'
  };

})(typeof window !== 'undefined' ? window : global);
