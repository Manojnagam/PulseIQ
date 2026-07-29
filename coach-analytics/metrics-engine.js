/**
 * PulseIQ Phase 2.4 — Coach Performance Analytics
 * Metrics Engine
 * 
 * STRICTLY DETERMINISTIC COACH METRICS COMPUTATION.
 * Computes 12 raw metrics for every coach in the organization.
 * Reuses outputs from PulseIQ_MetricsEngine and PulseIQ_RiskEngine.
 * ZERO AI HALLUCINATION. ZERO SUBJECTIVITY.
 */

(function(window) {
  'use strict';

  function daysBetween(d1, d2) {
    return Math.floor((new Date(d1) - new Date(d2)) / (1000 * 60 * 60 * 24));
  }

  function computeCoachMetrics(sourceData) {
    const D = sourceData || window.D || {};
    const coaches = D.coaches || [];
    const customers = D.customers || [];
    const attendance = D.attendance || [];
    const bodyScans = D.body || D.bodyData || [];
    const finance = D.finance || [];
    const packHistory = D.packHistory || [];

    const todayStr = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Get Risk Profiles if available to avoid duplicate risk calculation
    let riskProfiles = [];
    if (window.PulseIQ_RiskEngine && typeof window.PulseIQ_RiskEngine.evaluateAllCustomerRisks === 'function') {
      try {
        riskProfiles = window.PulseIQ_RiskEngine.evaluateAllCustomerRisks(D);
      } catch(e) {
        riskProfiles = [];
      }
    }

    const riskMap = {};
    riskProfiles.forEach(rp => {
      riskMap[rp.customerId] = rp.riskLevel;
    });

    // Group body scans by customer
    const scanMap = {};
    bodyScans.forEach(b => {
      if (!b.customer_id) return;
      if (!scanMap[b.customer_id]) scanMap[b.customer_id] = [];
      scanMap[b.customer_id].push(b);
    });

    // Group attendance by customer
    const attMap = {};
    attendance.forEach(a => {
      if (!a.customer_id) return;
      if (!attMap[a.customer_id]) attMap[a.customer_id] = [];
      attMap[a.customer_id].push(a);
    });

    // Group finance by customer
    const finMap = {};
    finance.forEach(f => {
      if (!f.customer_id) return;
      if (!finMap[f.customer_id]) finMap[f.customer_id] = [];
      finMap[f.customer_id].push(f);
    });

    // Map coaches
    const coachMetricsList = coaches.map(coach => {
      const coachCusts = customers.filter(c => c.coach_id === coach.id || c.assigned_coach_id === coach.id);
      const totalCustCount = coachCusts.length;

      const activeCusts = coachCusts.filter(c => {
        const st = (c.status || '').toLowerCase();
        return st === 'active' || (!c.expiry_date || c.expiry_date >= todayStr);
      });
      const activeCount = activeCusts.length;

      const retentionRatePct = totalCustCount > 0 ? Math.round((activeCount / totalCustCount) * 100) : 100;

      // Revenue Attribution
      let revenueGenerated = 0;
      coachCusts.forEach(cu => {
        const custFin = finMap[cu.id] || [];
        custFin.forEach(f => {
          if ((f.type || '').toLowerCase() === 'income' || parseFloat(f.amount) > 0) {
            revenueGenerated += parseFloat(f.amount) || 0;
          }
        });
      });

      const arpu = activeCount > 0 ? Math.round(revenueGenerated / activeCount) : 0;

      // Attendance Compliance
      let totalPresentAtt = 0;
      let totalExpectedDays = activeCount * 30; // 30 days window
      coachCusts.forEach(cu => {
        const custAtt = attMap[cu.id] || [];
        custAtt.forEach(a => {
          if (a.date >= thirtyDaysAgo && (a.status === 'present' || !a.status)) {
            totalPresentAtt++;
          }
        });
      });

      const attendanceCompliancePct = totalExpectedDays > 0 ? Math.min(100, Math.round((totalPresentAtt / Math.max(activeCount * 20, 1)) * 100)) : 100;

      // Body Scan & Recheck Completion
      let scannedCustCount = 0;
      let recheckUpToDateCount = 0;
      let progressCount = 0;

      coachCusts.forEach(cu => {
        const scans = scanMap[cu.id] || [];
        if (scans.length > 0) {
          scannedCustCount++;
          const sorted = scans.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
          const latest = sorted[0];
          if (daysBetween(todayStr, latest.date) <= 14) {
            recheckUpToDateCount++;
          }

          if (scans.length >= 2) {
            const first = sorted[sorted.length - 1];
            const weightDiff = parseFloat(latest.weight_kg) - parseFloat(first.weight_kg);
            if (weightDiff < 0) progressCount++; // lost weight
          }
        }
      });

      const scanCompletionPct = totalCustCount > 0 ? Math.round((scannedCustCount / totalCustCount) * 100) : 0;
      const recheckCompletionPct = totalCustCount > 0 ? Math.round((recheckUpToDateCount / totalCustCount) * 100) : 0;

      // Risk Distribution
      let highRiskCount = 0;
      let mediumRiskCount = 0;
      let lowRiskCount = 0;

      coachCusts.forEach(cu => {
        const rLevel = riskMap[cu.id] || 'LOW';
        if (rLevel === 'HIGH') highRiskCount++;
        else if (rLevel === 'MEDIUM') mediumRiskCount++;
        else lowRiskCount++;
      });

      // Renewals & New Onboarding
      const newCustomerCount = coachCusts.filter(c => (c.created_at || c.start_date || '') >= thirtyDaysAgo).length;
      
      let renewalCount = 0;
      packHistory.forEach(h => {
        if (h.start_date >= thirtyDaysAgo && coachCusts.some(c => c.id === h.customer_id)) {
          renewalCount++;
        }
      });

      return {
        coachId: coach.id,
        coachName: coach.name || `Coach #${coach.id}`,
        pin: coach.herbalife_pin || 'Associate',
        totalCustomers: totalCustCount,
        activeCustomers: activeCount,
        retentionRatePct: retentionRatePct,
        revenueGenerated: revenueGenerated,
        arpu: arpu,
        attendanceCompliancePct: attendanceCompliancePct,
        scanCompletionPct: scanCompletionPct,
        recheckCompletionPct: recheckCompletionPct,
        progressCount: progressCount,
        highRiskCount: highRiskCount,
        mediumRiskCount: mediumRiskCount,
        lowRiskCount: lowRiskCount,
        renewalCount: renewalCount,
        newCustomerCount: newCustomerCount
      };
    });

    return coachMetricsList;
  }

  window.PulseIQ_CoachMetricsEngine = {
    computeCoachMetrics: computeCoachMetrics
  };

})(typeof window !== 'undefined' ? window : global);
