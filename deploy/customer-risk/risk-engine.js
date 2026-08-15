/**
 * PulseIQ Phase 2.3 — Customer Risk Prediction
 * Risk Engine
 * 
 * Scans production customer records, attendance history, body scans, and finance logs.
 * Constructs explainable customer risk profile models.
 * READ-ONLY. NO DATA MUTATION. ZERO ML BLACK-BOX.
 */

(function(window) {
  'use strict';

  function evaluateAllCustomerRisks(sourceData) {
    const D = sourceData || window.D || {};
    const customers = D.customers || [];
    const attendance = D.attendance || [];
    const bodyScans = D.body || D.bodyData || [];
    const finance = D.finance || [];
    const coaches = D.coaches || [];

    const todayStr = new Date().toISOString().split('T')[0];

    // Group records by customer_id
    const attMap = {};
    attendance.forEach(a => {
      if (!a.customer_id) return;
      if (!attMap[a.customer_id]) attMap[a.customer_id] = [];
      attMap[a.customer_id].push(a);
    });

    const scanMap = {};
    bodyScans.forEach(b => {
      if (!b.customer_id) return;
      if (!scanMap[b.customer_id]) scanMap[b.customer_id] = [];
      scanMap[b.customer_id].push(b);
    });

    const finMap = {};
    finance.forEach(f => {
      if (!f.customer_id) return;
      if (!finMap[f.customer_id]) finMap[f.customer_id] = [];
      finMap[f.customer_id].push(f);
    });

    const coachMap = {};
    coaches.forEach(c => {
      coachMap[c.id] = c.name || `Coach #${c.id}`;
    });

    const customerRiskProfiles = customers.map(cust => {
      const custAtt = attMap[cust.id] || [];
      const custScans = scanMap[cust.id] || [];
      const custFin = finMap[cust.id] || [];

      const scoreResult = window.PulseIQ_ScoringEngine
        ? window.PulseIQ_ScoringEngine.calculateCustomerRiskScore(cust, custAtt, custScans, custFin, todayStr)
        : { totalScore: 50, riskLevel: 'MEDIUM', breakdown: [] };

      // Generate Action Directive
      let suggestedAction = 'Schedule a check-in call with customer to review their wellness routine.';
      if (scoreResult.riskLevel === 'HIGH') {
        if (scoreResult.daysAbsent > 14) {
          suggestedAction = `Call ${cust.name || 'customer'} immediately at ${cust.mobile || 'their phone'} (absent for ${scoreResult.daysAbsent} days) to offer re-engagement support.`;
        } else if (scoreResult.daysRemaining <= 3) {
          suggestedAction = `Contact ${cust.name || 'customer'} at ${cust.mobile || 'their phone'} to renew membership before expiry on ${cust.expiry_date}.`;
        } else if (scoreResult.daysSinceScan > 30) {
          suggestedAction = `Invite ${cust.name || 'customer'} for a complimentary progress body scan to re-ignite motivation.`;
        }
      } else if (scoreResult.riskLevel === 'MEDIUM') {
        suggestedAction = `Send a friendly WhatsApp reminder to ${cust.name || 'customer'} with progress updates and upcoming club sessions.`;
      } else {
        suggestedAction = `Maintain regular check-in cadence; customer engagement and progress are healthy.`;
      }

      return {
        customerId: cust.id,
        customerName: cust.name || `Customer #${cust.id}`,
        mobile: cust.mobile || 'N/A',
        status: cust.status || 'active',
        packType: cust.pack_type || 'Standard',
        coachName: coachMap[cust.coach_id || cust.assigned_coach_id] || 'Unassigned',
        riskScore: scoreResult.totalScore,
        riskLevel: scoreResult.riskLevel,
        breakdown: scoreResult.breakdown,
        suggestedAction: suggestedAction,
        lastAttendance: scoreResult.lastAttDate || 'None',
        daysAbsent: scoreResult.daysAbsent === 999 ? 'N/A' : scoreResult.daysAbsent,
        membershipExpiry: cust.expiry_date || 'N/A',
        daysRemaining: scoreResult.daysRemaining === 999 ? 'N/A' : scoreResult.daysRemaining,
        lastBodyScan: scoreResult.lastScanDate || 'None',
        daysSinceScan: scoreResult.daysSinceScan === 999 ? 'N/A' : scoreResult.daysSinceScan
      };
    });

    // Sort profiles by Risk Score descending (highest risk first)
    customerRiskProfiles.sort((a, b) => b.riskScore - a.riskScore);

    return customerRiskProfiles;
  }

  window.PulseIQ_RiskEngine = {
    evaluateAllCustomerRisks: evaluateAllCustomerRisks
  };

})(typeof window !== 'undefined' ? window : global);
