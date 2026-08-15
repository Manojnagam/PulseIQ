/**
 * PulseIQ Phase 2.6 — Goal Tracking & KPI Targets
 * Target Engine
 * 
 * Manages default and user-configured KPI target thresholds.
 * Zero database schema modifications. Read-only for production tables.
 */

(function(window) {
  'use strict';

  const DEFAULT_TARGETS = {
    monthlyRevenue: 300000,       // ₹3,00,000
    monthlyProfit: 150000,        // ₹1,50,000
    newCustomers: 15,             // 15 new members
    customerRetentionPct: 90,     // 90% retention
    attendancePct: 90,            // 90% attendance compliance
    bodyScanCompletionPct: 85,    // 85% scan completion
    membershipRenewals: 10,       // 10 renewals
    productSalesUnits: 50,        // 50 units sold
    coachRevenue: 50000,          // ₹50,000 per coach avg
    coachRetentionPct: 90         // 90% coach team retention
  };

  const STORAGE_KEY = 'pulseiq_goal_targets_v1';

  function getTargets() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) return { ...DEFAULT_TARGETS, ...JSON.parse(saved) };
      } catch (e) {
        // Fallback to defaults
      }
    }
    return { ...DEFAULT_TARGETS };
  }

  function setTarget(key, value) {
    const targets = getTargets();
    targets[key] = parseFloat(value) || 0;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(targets));
      } catch (e) {}
    }
    return targets;
  }

  function resetTargets() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch (e) {}
    }
    return { ...DEFAULT_TARGETS };
  }

  window.PulseIQ_TargetEngine = {
    getTargets: getTargets,
    setTarget: setTarget,
    resetTargets: resetTargets,
    getDefaultTargets: function() { return { ...DEFAULT_TARGETS }; }
  };

})(typeof window !== 'undefined' ? window : global);
