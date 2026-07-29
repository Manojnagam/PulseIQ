/**
 * PulseIQ Phase 2.6 — Goal Tracking & KPI Targets
 * Progress Engine
 * 
 * Computes actual operational KPIs from production data and calculates
 * target achievement %, difference variance, and status classification.
 */

(function(window) {
  'use strict';

  function evaluateStatus(achievedPct) {
    if (achievedPct >= 105) return { status: 'EXCEEDED', badge: 'EXCEEDED 🏆', color: '#27AE60', bg: 'rgba(39,174,96,0.15)', border: 'rgba(39,174,96,0.3)' };
    if (achievedPct >= 90) return { status: 'ON TRACK', badge: 'ON TRACK 🟢', color: '#38bdf8', bg: 'rgba(56,189,248,0.15)', border: 'rgba(56,189,248,0.3)' };
    if (achievedPct >= 75) return { status: 'AT RISK', badge: 'AT RISK 🟡', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)' };
    return { status: 'BEHIND', badge: 'BEHIND 🔴', color: '#ef4444', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.3)' };
  }

  function evaluateProgress(sourceData, customTargets) {
    const D = sourceData || window.D || {};
    const targets = customTargets || (window.PulseIQ_TargetEngine ? window.PulseIQ_TargetEngine.getTargets() : {});

    const customers = D.customers || [];
    const attendance = D.attendance || [];
    const bodyScans = D.body || D.bodyData || [];
    const finance = D.finance || [];
    const coaches = D.coaches || [];
    const inventory = D.inventory || [];

    const todayStr = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // ── 1. Monthly Revenue ──
    let actualRevenue = 0;
    let actualExpense = 0;
    finance.forEach(f => {
      const amt = parseFloat(f.amount) || 0;
      if ((f.type || '').toLowerCase() === 'income' || amt > 0) {
        actualRevenue += amt;
      } else if ((f.type || '').toLowerCase() === 'expense' || amt < 0) {
        actualExpense += Math.abs(amt);
      }
    });

    // ── 2. Monthly Profit ──
    const actualProfit = Math.max(0, actualRevenue - actualExpense);

    // ── 3. New Customers ──
    const newCustCount = customers.filter(c => (c.created_at || c.start_date || '') >= thirtyDaysAgo).length;

    // ── 4. Customer Retention % ──
    const activeCustCount = customers.filter(c => {
      const st = (c.status || '').toLowerCase();
      return st === 'active' || (!c.expiry_date || c.expiry_date >= todayStr);
    }).length;
    const actualRetentionPct = customers.length > 0 ? Math.round((activeCustCount / customers.length) * 100) : 100;

    // ── 5. Attendance % ──
    const presentAttCount = attendance.filter(a => a.date >= thirtyDaysAgo && (a.status === 'present' || !a.status)).length;
    const expectedAttCount = Math.max(activeCustCount * 20, 1);
    const actualAttendancePct = Math.min(100, Math.round((presentAttCount / expectedAttCount) * 100));

    // ── 6. Body Scan Completion % ──
    const scannedCustIds = new Set(bodyScans.map(b => b.customer_id));
    const actualScanCompletionPct = customers.length > 0 ? Math.round((scannedCustIds.size / customers.length) * 100) : 0;

    // ── 7. Membership Renewals ──
    const packHistory = D.packHistory || [];
    const renewalCount = packHistory.filter(h => h.start_date >= thirtyDaysAgo).length;

    // ── 8. Product Sales Units ──
    let productUnits = 0;
    inventory.forEach(i => {
      productUnits += parseFloat(i.stock_quantity || 0);
    });

    // ── 9. Coach Revenue Avg ──
    const coachCount = Math.max(coaches.length, 1);
    const actualCoachRevAvg = Math.round(actualRevenue / coachCount);

    // ── 10. Coach Retention % ──
    const actualCoachRetentionPct = 100;

    // Build KPI Progress Models
    const kpis = [
      {
        id: 'kpi-revenue',
        title: 'Monthly Revenue',
        category: 'Finance',
        unit: '₹',
        target: targets.monthlyRevenue || 300000,
        actual: actualRevenue,
        format: val => '₹' + Math.round(val).toLocaleString('en-IN')
      },
      {
        id: 'kpi-profit',
        title: 'Monthly Profit',
        category: 'Finance',
        unit: '₹',
        target: targets.monthlyProfit || 150000,
        actual: actualProfit,
        format: val => '₹' + Math.round(val).toLocaleString('en-IN')
      },
      {
        id: 'kpi-new-cust',
        title: 'New Customers Onboarded',
        category: 'Growth',
        unit: 'members',
        target: targets.newCustomers || 15,
        actual: newCustCount,
        format: val => val + ' members'
      },
      {
        id: 'kpi-retention',
        title: 'Customer Retention Rate',
        category: 'Customer',
        unit: '%',
        target: targets.customerRetentionPct || 90,
        actual: actualRetentionPct,
        format: val => val + '%'
      },
      {
        id: 'kpi-attendance',
        title: 'Attendance Compliance',
        category: 'Operations',
        unit: '%',
        target: targets.attendancePct || 90,
        actual: actualAttendancePct,
        format: val => val + '%'
      },
      {
        id: 'kpi-body-scan',
        title: 'Body Scan Completion',
        category: 'Operations',
        unit: '%',
        target: targets.bodyScanCompletionPct || 85,
        actual: actualScanCompletionPct,
        format: val => val + '%'
      },
      {
        id: 'kpi-renewals',
        title: 'Membership Renewals',
        category: 'Customer',
        unit: 'renewals',
        target: targets.membershipRenewals || 10,
        actual: renewalCount,
        format: val => val + ' renewals'
      },
      {
        id: 'kpi-product-sales',
        title: 'Inventory Stock Available',
        category: 'Inventory',
        unit: 'units',
        target: targets.productSalesUnits || 50,
        actual: productUnits,
        format: val => val + ' units'
      },
      {
        id: 'kpi-coach-revenue',
        title: 'Avg Coach Revenue',
        category: 'Team',
        unit: '₹',
        target: targets.coachRevenue || 50000,
        actual: actualCoachRevAvg,
        format: val => '₹' + Math.round(val).toLocaleString('en-IN')
      },
      {
        id: 'kpi-coach-retention',
        title: 'Coach Retention Rate',
        category: 'Team',
        unit: '%',
        target: targets.coachRetentionPct || 90,
        actual: actualCoachRetentionPct,
        format: val => val + '%'
      }
    ];

    const kpiResults = kpis.map(kpi => {
      const achievementPct = kpi.target > 0 ? Math.round((kpi.actual / kpi.target) * 100) : 100;
      const difference = kpi.actual - kpi.target;
      const statusObj = evaluateStatus(achievementPct);

      return {
        ...kpi,
        achievementPct: achievementPct,
        difference: difference,
        formattedActual: kpi.format(kpi.actual),
        formattedTarget: kpi.format(kpi.target),
        formattedDiff: (difference >= 0 ? '+' : '') + kpi.format(difference),
        status: statusObj.status,
        statusBadge: statusObj.badge,
        color: statusObj.color,
        bg: statusObj.bg,
        border: statusObj.border
      };
    });

    // Calculate Business Health Score (0-100)
    const avgAchievement = Math.round(kpiResults.reduce((sum, k) => sum + Math.min(120, k.achievementPct), 0) / kpiResults.length);

    return {
      businessHealthScore: Math.min(100, avgAchievement),
      kpiResults: kpiResults
    };
  }

  window.PulseIQ_ProgressEngine = {
    evaluateProgress: evaluateProgress
  };

})(typeof window !== 'undefined' ? window : global);
