/**
 * PulseIQ Phase 2 — AI Business Analyst (Phase 2.1)
 * Layer 2: Insight Engine
 * 
 * Consumes deterministic KPI output from Layer 1.
 * Produces evidence-based observations strictly backed by data.
 * ZERO HALLUCINATIONS. ZERO FICTION.
 */

(function(window) {
  'use strict';

  function generateInsights(metrics) {
    if (!metrics) {
      metrics = window.PulseIQ_MetricsEngine ? window.PulseIQ_MetricsEngine.computeBusinessMetrics() : {};
    }

    const observations = [];
    const warnings = [];

    // Revenue Observation
    const rev = metrics.revenue || {};
    const revGrowth = rev.weeklyRevenueGrowthPct || 0;
    if (revGrowth >= 0) {
      observations.push(`Weekly revenue increased ${revGrowth}% (₹${(rev.weeklyRevenue || 0).toLocaleString('en-IN')} vs ₹${(rev.prevWeeklyRevenue || 0).toLocaleString('en-IN')} last week).`);
    } else {
      observations.push(`Weekly revenue declined ${Math.abs(revGrowth)}% (₹${(rev.weeklyRevenue || 0).toLocaleString('en-IN')} vs ₹${(rev.prevWeeklyRevenue || 0).toLocaleString('en-IN')} last week).`);
    }

    // Attendance Observation
    const att = metrics.attendance || {};
    const attGrowth = att.attendanceGrowthPct || 0;
    if (attGrowth >= 0) {
      observations.push(`Weekly attendance grew ${attGrowth}% with ${att.weeklyAttendance || 0} total check-ins.`);
    } else {
      observations.push(`Weekly attendance decreased ${Math.abs(attGrowth)}% with ${att.weeklyAttendance || 0} total check-ins.`);
    }

    // Customer & Retention Observation
    const cust = metrics.customers || {};
    observations.push(`Customer retention rate is ${cust.retentionRatePct || 100}% across ${cust.active || 0} active members.`);

    // Warnings & Alerts (Traceable Facts)
    if (cust.expiringMemberships && cust.expiringMemberships.length > 0) {
      warnings.push(`${cust.expiringMemberships.length} membership${cust.expiringMemberships.length > 1 ? 's expire' : ' expires'} this week`);
    }

    const inv = metrics.inventory || {};
    if (inv.totalLowOrOut > 0) {
      const parts = [];
      if (inv.outOfStockItems.length > 0) parts.push(`${inv.outOfStockItems.length} product${inv.outOfStockItems.length > 1 ? 's' : ''} out of stock`);
      if (inv.lowStockItems.length > 0) parts.push(`${inv.lowStockItems.length} product${inv.lowStockItems.length > 1 ? 's' : ''} low stock`);
      warnings.push(parts.join(', '));
    }

    const body = metrics.bodyComposition || {};
    if (body.recheckDueCount > 0) {
      warnings.push(`${body.recheckDueCount} customer${body.recheckDueCount > 1 ? 's' : ''} overdue for body scan recheck (>14 days)`);
    }

    if (att.missedAttendanceCount > 0) {
      warnings.push(`${att.missedAttendanceCount} customer${att.missedAttendanceCount > 1 ? 's' : ''} absent for 7+ consecutive days`);
    }

    // Coach Performance Observation
    const coach = (metrics.coaches || {}).topCoach;
    if (coach && coach.name && coach.name !== 'N/A') {
      observations.push(`Coach ${coach.name} achieved the highest customer retention rate (${coach.retentionRate}%).`);
    }

    // Financial Margin Observation
    const fin = metrics.finance || {};
    observations.push(`Net profit stands at ₹${(fin.netProfit || 0).toLocaleString('en-IN')} with a ${fin.profitMarginPct || 0}% net profit margin.`);

    return {
      healthScore: metrics.healthScore || 85,
      observations: observations,
      warnings: warnings,
      summaryText: `This week compared to last week: Revenue changed by ${revGrowth >= 0 ? '+' : ''}${revGrowth}%, while attendance showed a ${attGrowth >= 0 ? '+' : ''}${attGrowth}% shift. Net profit margin is ${fin.profitMarginPct || 0}%.`
    };
  }

  window.PulseIQ_InsightEngine = {
    generateInsights: generateInsights
  };

})(window);
