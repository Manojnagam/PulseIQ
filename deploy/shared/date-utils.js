/**
 * PulseIQ Phase 2 — Shared Date Utilities
 * Standardized date difference and formatting helpers.
 */

(function(window) {
  'use strict';

  function daysBetween(d1, d2) {
    if (!d1 || !d2) return 999;
    const date1 = new Date(d1);
    const date2 = new Date(d2);
    if (isNaN(date1.getTime()) || isNaN(date2.getTime())) return 999;
    return Math.floor((date1 - date2) / (1000 * 60 * 60 * 24));
  }

  function getTodayStr() {
    return new Date().toISOString().split('T')[0];
  }

  function getDaysAgoStr(days) {
    return new Date(new Date().getTime() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  }

  window.PulseIQ_DateUtils = {
    daysBetween: daysBetween,
    getTodayStr: getTodayStr,
    getDaysAgoStr: getDaysAgoStr
  };

})(typeof window !== 'undefined' ? window : global);
