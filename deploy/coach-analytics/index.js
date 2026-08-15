/**
 * PulseIQ Phase 2.4 — Coach Performance Analytics
 * Main Orchestrator & Public API
 * 
 * Manages deterministic coach metrics calculation, scoring, badging,
 * rankings, and UI dashboard rendering.
 */

(function(window) {
  'use strict';

  let cachedCoaches = [];

  function refreshDashboard(sourceData) {
    const D = sourceData || window.D || {};

    let rawMetrics = [];
    if (window.PulseIQ_CoachMetricsEngine) {
      rawMetrics = window.PulseIQ_CoachMetricsEngine.computeCoachMetrics(D);
    } else {
      console.warn('[PulseIQ Coach Analytics] CoachMetricsEngine not loaded');
      rawMetrics = [];
    }

    if (window.PulseIQ_CoachScoringEngine) {
      cachedCoaches = window.PulseIQ_CoachScoringEngine.evaluateCoachScoresAndRankings(rawMetrics);
    } else {
      cachedCoaches = rawMetrics;
    }

    if (window.PulseIQ_CoachAnalyticsRenderer) {
      window.PulseIQ_CoachAnalyticsRenderer.renderDashboard(cachedCoaches);
    }

    return cachedCoaches;
  }

  function setSearchQuery(val) {
    if (window.PulseIQ_CoachAnalyticsRenderer) {
      window.PulseIQ_CoachAnalyticsRenderer.setSearchQuery(val);
      window.PulseIQ_CoachAnalyticsRenderer.renderDashboard(cachedCoaches);
    }
  }

  function setSortBy(val) {
    if (window.PulseIQ_CoachAnalyticsRenderer) {
      window.PulseIQ_CoachAnalyticsRenderer.setSortBy(val);
      window.PulseIQ_CoachAnalyticsRenderer.renderDashboard(cachedCoaches);
    }
  }

  function toggleExpand(coachId) {
    if (window.PulseIQ_CoachAnalyticsRenderer) {
      window.PulseIQ_CoachAnalyticsRenderer.toggleExpand(coachId);
      window.PulseIQ_CoachAnalyticsRenderer.renderDashboard(cachedCoaches);
    }
  }

  // Intercept section rendering safely
  if (typeof window !== 'undefined') {
    const origGoTo = window.goTo;
    window.goTo = function(sec, el) {
      if (typeof origGoTo === 'function') {
        origGoTo(sec, el);
      }
      if (sec === 'coachanalytics') {
        refreshDashboard(window.D);
      }
    };
  }

  window.PulseIQ_CoachAnalytics = {
    refreshDashboard: refreshDashboard,
    setSearchQuery: setSearchQuery,
    setSortBy: setSortBy,
    toggleExpand: toggleExpand,
    getCoaches: function() { return cachedCoaches; },
    version: '2.4.0'
  };

})(typeof window !== 'undefined' ? window : global);
