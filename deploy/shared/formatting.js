/**
 * PulseIQ Phase 2 — Shared Formatting Utilities
 * Standardized currency, integer, and percentage formatting helpers.
 */

(function(window) {
  'use strict';

  function formatCurrency(val) {
    const num = Math.round(parseFloat(val) || 0);
    return '₹' + num.toLocaleString('en-IN');
  }

  function formatNumber(val) {
    const num = Math.round(parseFloat(val) || 0);
    return num.toLocaleString('en-IN');
  }

  function formatPercent(val) {
    const num = Math.round(parseFloat(val) || 0);
    return num + '%';
  }

  window.PulseIQ_Formatting = {
    formatCurrency: formatCurrency,
    formatNumber: formatNumber,
    formatPercent: formatPercent
  };

})(typeof window !== 'undefined' ? window : global);
