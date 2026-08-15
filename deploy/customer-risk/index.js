/**
 * PulseIQ Phase 2.3 — Customer Risk Prediction
 * Main Orchestrator & Public API
 * 
 * Manages deterministic risk evaluation, scoring, UI dashboard rendering,
 * filtering, and customer profile expansion.
 */

(function(window) {
  'use strict';

  let cachedProfiles = [];

  function refreshDashboard(sourceData) {
    const D = sourceData || window.D || {};

    if (window.PulseIQ_RiskEngine) {
      cachedProfiles = window.PulseIQ_RiskEngine.evaluateAllCustomerRisks(D);
    } else {
      console.warn('[PulseIQ Customer Risk] RiskEngine not loaded');
      cachedProfiles = [];
    }

    if (window.PulseIQ_RiskRenderer) {
      window.PulseIQ_RiskRenderer.renderDashboard(cachedProfiles);
    }

    return cachedProfiles;
  }

  function setFilter(val, el) {
    if (window.PulseIQ_RiskRenderer) {
      window.PulseIQ_RiskRenderer.setRiskLevelFilter(val);
    }
    if (typeof document !== 'undefined') {
      document.querySelectorAll('[data-risk-filter="level"]').forEach(chip => {
        chip.classList.remove('active');
      });
      if (el) el.classList.add('active');
    }
    if (window.PulseIQ_RiskRenderer) {
      window.PulseIQ_RiskRenderer.renderDashboard(cachedProfiles);
    }
  }

  function setSearchQuery(val) {
    if (window.PulseIQ_RiskRenderer) {
      window.PulseIQ_RiskRenderer.setSearchQuery(val);
      window.PulseIQ_RiskRenderer.renderDashboard(cachedProfiles);
    }
  }

  function setSortBy(val) {
    if (window.PulseIQ_RiskRenderer) {
      window.PulseIQ_RiskRenderer.setSortBy(val);
      window.PulseIQ_RiskRenderer.renderDashboard(cachedProfiles);
    }
  }

  function toggleExpand(customerId) {
    if (window.PulseIQ_RiskRenderer) {
      window.PulseIQ_RiskRenderer.toggleExpand(customerId);
      window.PulseIQ_RiskRenderer.renderDashboard(cachedProfiles);
    }
  }

  function resetFilters() {
    if (window.PulseIQ_RiskRenderer) {
      window.PulseIQ_RiskRenderer.setRiskLevelFilter('');
      window.PulseIQ_RiskRenderer.setSearchQuery('');
      window.PulseIQ_RiskRenderer.setSortBy('score_desc');
    }
    if (typeof document !== 'undefined') {
      const srch = document.getElementById('risk-search-input');
      if (srch) srch.value = '';
      const sortSel = document.getElementById('risk-sort-select');
      if (sortSel) sortSel.value = 'score_desc';

      document.querySelectorAll('[data-risk-filter="level"]').forEach((chip, idx) => {
        if (idx === 0) chip.classList.add('active');
        else chip.classList.remove('active');
      });
    }
    if (window.PulseIQ_RiskRenderer) {
      window.PulseIQ_RiskRenderer.renderDashboard(cachedProfiles);
    }
  }

  // Intercept section rendering safely
  if (typeof window !== 'undefined') {
    const origGoTo = window.goTo;
    window.goTo = function(sec, el) {
      if (typeof origGoTo === 'function') {
        origGoTo(sec, el);
      }
      if (sec === 'customerrisk') {
        refreshDashboard(window.D);
      }
    };
  }

  window.PulseIQ_CustomerRisk = {
    refreshDashboard: refreshDashboard,
    setFilter: setFilter,
    setSearchQuery: setSearchQuery,
    setSortBy: setSortBy,
    toggleExpand: toggleExpand,
    resetFilters: resetFilters,
    getProfiles: function() { return cachedProfiles; },
    version: '2.3.0'
  };

})(typeof window !== 'undefined' ? window : global);
