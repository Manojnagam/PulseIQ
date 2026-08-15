/**
 * PulseIQ Phase 2.7 — Forecasting & Predictive Business Trends
 * Main Orchestrator & Public API
 * 
 * Manages short-term business forecasting calculations, trend projections,
 * statistical confidence evaluations, and UI dashboard rendering.
 */

(function(window) {
  'use strict';

  let cachedForecasts = [];

  function refreshDashboard(sourceData) {
    const D = sourceData || window.D || {};

    if (window.PulseIQ_ForecastEngine) {
      cachedForecasts = window.PulseIQ_ForecastEngine.generateAllForecasts(D);
    } else {
      console.warn('[PulseIQ Forecasting] ForecastEngine not loaded');
      cachedForecasts = [];
    }

    if (window.PulseIQ_ForecastDashboardRenderer) {
      window.PulseIQ_ForecastDashboardRenderer.renderDashboard(cachedForecasts);
    }

    return cachedForecasts;
  }

  function setCategoryFilter(val) {
    if (window.PulseIQ_ForecastDashboardRenderer) {
      window.PulseIQ_ForecastDashboardRenderer.setCategoryFilter(val);
      window.PulseIQ_ForecastDashboardRenderer.renderDashboard(cachedForecasts);
    }
  }

  function setSearchQuery(val) {
    if (window.PulseIQ_ForecastDashboardRenderer) {
      window.PulseIQ_ForecastDashboardRenderer.setSearchQuery(val);
      window.PulseIQ_ForecastDashboardRenderer.renderDashboard(cachedForecasts);
    }
  }

  function setHorizon(val) {
    if (window.PulseIQ_ForecastDashboardRenderer) {
      window.PulseIQ_ForecastDashboardRenderer.setHorizon(val);
      window.PulseIQ_ForecastDashboardRenderer.renderDashboard(cachedForecasts);
    }
  }

  // Intercept section rendering safely
  if (typeof window !== 'undefined') {
    const origGoTo = window.goTo;
    window.goTo = function(sec, el) {
      console.log('TRACE-04: forecasting goTo wrapper start');
      if (typeof origGoTo === 'function') {
        console.log('TRACE-05: forecasting calling origGoTo');
        origGoTo(sec, el);
      }
      if (sec === 'forecasting') {
        refreshDashboard(window.D);
      }
    };
  }

  window.PulseIQ_Forecasting = {
    refreshDashboard: refreshDashboard,
    setCategoryFilter: setCategoryFilter,
    setSearchQuery: setSearchQuery,
    setHorizon: setHorizon,
    getForecasts: function() { return cachedForecasts; },
    version: '2.7.0'
  };

})(typeof window !== 'undefined' ? window : global);
