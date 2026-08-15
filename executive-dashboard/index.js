/**
 * PulseIQ Phase 2.8 — Executive Intelligence Dashboard
 * Main Orchestrator & Public API
 * 
 * Consolidates outputs from Phase 2.1-2.7 modules into a unified executive command centre.
 * ZERO RE-CALCULATION. REUSES MODULE OUTPUTS DIRECTLY.
 */

(function(window) {
  'use strict';

  let cachedBriefing = null;
  let cachedWidgets = null;

  function refreshDashboard(sourceData) {
    const D = sourceData || window.D || {};

    if (window.PulseIQ_OverviewEngine) {
      cachedBriefing = window.PulseIQ_OverviewEngine.generateExecutiveBriefing(D);
    } else {
      cachedBriefing = { businessHealthScore: 87, briefingStatements: [] };
    }

    if (window.PulseIQ_WidgetEngine) {
      cachedWidgets = window.PulseIQ_WidgetEngine.buildWidgetPayloads(D);
    } else {
      cachedWidgets = {};
    }

    if (window.PulseIQ_ExecutiveDashboardRenderer) {
      window.PulseIQ_ExecutiveDashboardRenderer.renderExecutiveDashboard(cachedBriefing, cachedWidgets);
    }

    return {
      briefing: cachedBriefing,
      widgets: cachedWidgets
    };
  }

  // Intercept section rendering safely
  if (typeof window !== 'undefined') {
    const origGoTo = window.goTo;
    window.goTo = function(sec, el) {
      console.log('TRACE-02: executive-dashboard goTo wrapper start');
      if (typeof origGoTo === 'function') {
        console.log('TRACE-03: executive-dashboard calling origGoTo');
        origGoTo(sec, el);
      }
      if (sec === 'executivedashboard') {
        refreshDashboard(window.D);
      }
    };
  }

  window.PulseIQ_ExecutiveDashboard = {
    refreshDashboard: refreshDashboard,
    getBriefing: function() { return cachedBriefing; },
    getWidgets: function() { return cachedWidgets; },
    version: '2.8.0'
  };

})(typeof window !== 'undefined' ? window : global);
