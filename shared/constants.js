/**
 * PulseIQ Phase 2 — Shared Constants
 * Operational thresholds, KPI target baselines, and status definitions.
 */

(function(window) {
  'use strict';

  const CONSTANTS = {
    RISK_THRESHOLDS: {
      HIGH_SCORE: 60,
      MEDIUM_SCORE: 30,
      ABSENT_HIGH_DAYS: 21,
      ABSENT_MED_DAYS: 14,
      EXPIRY_HIGH_DAYS: 3,
      EXPIRY_MED_DAYS: 7,
      SCAN_OVERDUE_DAYS: 14
    },
    DEFAULT_GOALS: {
      monthlyRevenue: 300000,
      monthlyProfit: 150000,
      newCustomers: 15,
      customerRetentionPct: 90,
      attendancePct: 90,
      bodyScanCompletionPct: 85,
      membershipRenewals: 10,
      productSalesUnits: 50,
      coachRevenue: 50000,
      coachRetentionPct: 90
    },
    STATUS_COLORS: {
      EXCEEDED: '#27AE60',
      ON_TRACK: '#38bdf8',
      AT_RISK: '#f59e0b',
      BEHIND: '#ef4444'
    }
  };

  window.PulseIQ_Constants = CONSTANTS;

})(typeof window !== 'undefined' ? window : global);
