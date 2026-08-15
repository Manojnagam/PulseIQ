/**
 * PulseIQ Phase 2.2 — Action Centre / Daily Tasks
 * Priority Engine
 * 
 * STRICTLY DETERMINISTIC PRIORITY EVALUATOR.
 * Maps operational triggers to HIGH 🔴, MEDIUM 🟡, or LOW 🟢 priorities.
 * ZERO RANDOMNESS. ZERO AI HALLUCINATION.
 */

(function(window) {
  'use strict';

  function evaluateAttendancePriority(daysAbsent) {
    if (daysAbsent > 14) return 'HIGH';
    if (daysAbsent >= 7) return 'MEDIUM';
    return null; // Ignore if < 7 days
  }

  function evaluateMembershipPriority(daysRemaining) {
    if (daysRemaining <= 3) return 'HIGH';
    if (daysRemaining <= 7) return 'MEDIUM';
    return null; // Ignore if > 7 days
  }

  function evaluateInventoryPriority(stockQty, minThreshold) {
    if (stockQty === 0) return 'HIGH';
    if (stockQty <= minThreshold) return 'MEDIUM';
    return null; // Ignore if stock healthy
  }

  function evaluateBodyScanPriority(daysSinceScan) {
    if (daysSinceScan > 14 || daysSinceScan === -1) return 'HIGH';
    if (daysSinceScan >= 8) return 'MEDIUM';
    return null;
  }

  function evaluateFinancePriority(isDeficit, marginPct) {
    if (isDeficit) return 'HIGH';
    if (marginPct < 15) return 'MEDIUM';
    return 'LOW';
  }

  window.PulseIQ_PriorityEngine = {
    evaluateAttendancePriority: evaluateAttendancePriority,
    evaluateMembershipPriority: evaluateMembershipPriority,
    evaluateInventoryPriority: evaluateInventoryPriority,
    evaluateBodyScanPriority: evaluateBodyScanPriority,
    evaluateFinancePriority: evaluateFinancePriority
  };

})(typeof window !== 'undefined' ? window : global);
