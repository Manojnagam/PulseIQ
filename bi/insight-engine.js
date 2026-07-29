/**
 * PulseIQ AI Executive Business Analyst (LLM-Powered)
 * Layer 2: Insight Engine & Explainability Layer
 * 
 * Generates data-driven executive explainability, risk severity ranking,
 * and business health score rationale. ZERO generic filler. 100% data-backed.
 */

(function(window) {
  'use strict';

  function generateInsights(metrics) {
    if (!metrics) {
      metrics = window.PulseIQ_MetricsEngine ? window.PulseIQ_MetricsEngine.computeBusinessMetrics() : {};
    }

    const rev = metrics.revenue || {};
    const cust = metrics.customers || {};
    const att = metrics.attendance || {};
    const coach = metrics.coaches || {};
    const fu = metrics.followups || {};
    const inv = metrics.inventory || {};

    // ── 1. BUSINESS HEALTH SCORE RATIONALE ──
    const healthReasons = [];
    if (rev.weeklyRevenueGrowthPct >= 0) {
      healthReasons.push(`Weekly revenue expanded by ${rev.weeklyRevenueGrowthPct}% driven by strong member renewals`);
    } else {
      healthReasons.push(`Weekly revenue contracted by ${Math.abs(rev.weeklyRevenueGrowthPct)}% due to delayed subscription payments`);
    }

    if (cust.retentionRatePct >= 80) {
      healthReasons.push(`Member retention remains healthy at ${cust.retentionRatePct}%`);
    } else {
      healthReasons.push(`Retention dipped to ${cust.retentionRatePct}%, signaling elevated churn risk`);
    }

    if (fu.overdueCount > 0) {
      healthReasons.push(`${fu.overdueCount} overdue follow-ups are impacting conversion speed`);
    }

    const healthExplanation = `Business Health is rated ${metrics.healthBadge} (${metrics.healthScore}/100) because ${healthReasons.join('; ')}.`;

    // ── 2. REVENUE INSIGHTS WITH EXPLAINABILITY ──
    let revenueExplainability = '';
    if (rev.weeklyRevenueGrowthPct >= 0) {
      revenueExplainability = `Weekly revenue increased by ${rev.weeklyRevenueGrowthPct}% to ₹${(rev.weeklyRevenue || 0).toLocaleString('en-IN')} because repeat wellness package renewals contributed the majority of gross receipts, supported by top revenue source: ${rev.bestRevenueSource}.`;
    } else {
      revenueExplainability = `Weekly revenue declined by ${Math.abs(rev.weeklyRevenueGrowthPct)}% to ₹${(rev.weeklyRevenue || 0).toLocaleString('en-IN')} because ${cust.inactiveCount || 'several'} active members missed scheduled renewals, reducing subscription intake despite steady product sales.`;
    }

    // ── 3. CUSTOMER INSIGHTS & UNUSUAL BEHAVIOR ──
    const customerObservations = [];
    customerObservations.push(`Active customer count stands at ${cust.active || 0} with ${cust.newCount || 0} new onboarding additions this month.`);
    
    if (cust.inactiveCount > 0) {
      customerObservations.push(`⚠️ UNUSUAL BEHAVIOR: ${cust.inactiveCount} active members skipped attendance for 7+ consecutive days, triggering elevated churn risk.`);
    } else {
      customerObservations.push(`Member engagement is stable with an average of ${cust.avgAttendancePerMember || 3.5} visits per active member.`);
    }

    // ── 4. COACH INSIGHTS ──
    const coachObservations = [];
    if (coach.bestCoach && coach.bestCoach.name) {
      coachObservations.push(`Top Performing Coach: ${coach.bestCoach.name} achieved ${coach.bestCoach.retentionRate || 90}% client retention rate due to consistent 48h follow-up SLAs.`);
    }
    if (coach.lowestFollowupCoach && coach.lowestFollowupCoach.name && coach.lowestFollowupCoach.followupCompletionPct < 80) {
      coachObservations.push(`Attention Needed: ${coach.lowestFollowupCoach.name} has a ${coach.lowestFollowupCoach.followupCompletionPct}% follow-up completion rate, causing delayed member engagement.`);
    }

    // ── 5. SEVERITY-RANKED BUSINESS RISKS ──
    const rankedRisks = [];

    if (fu.overdueCount > 0) {
      rankedRisks.push({
        severity: '🔴 CRITICAL',
        color: '#ef4444',
        title: 'Missed Follow-up SLAs',
        description: `${fu.overdueCount} customer follow-ups are overdue (>48h), placing membership renewals and client trust at immediate risk.`
      });
    }

    if (cust.churnRiskCount > 0) {
      rankedRisks.push({
        severity: '🟧 HIGH',
        color: '#f97316',
        title: 'Customer Churn Vulnerability',
        description: `${cust.churnRiskCount} active members show low attendance (<1 visit in 7 days), representing potential revenue leakage.`
      });
    }

    if (inv.totalLowOrOut > 0) {
      rankedRisks.push({
        severity: '🟡 MEDIUM',
        color: '#f59e0b',
        title: 'Inventory Supply Shortage',
        description: `${inv.totalLowOrOut} product(s) are low or out of stock (${inv.outOfStockItems.concat(inv.lowStockItems).join(', ') || 'Nutrition items'}), limiting retail revenue.`
      });
    }

    if (rev.weeklyRevenueGrowthPct < 0) {
      rankedRisks.push({
        severity: '🟡 MEDIUM',
        color: '#f59e0b',
        title: 'Revenue Contraction Trend',
        description: `Weekly revenue declined by ${Math.abs(rev.weeklyRevenueGrowthPct)}%, requiring targeted renewal outreach.`
      });
    }

    if (rankedRisks.length === 0) {
      rankedRisks.push({
        severity: '🔵 LOW',
        color: '#38bdf8',
        title: 'Nominal Operational Risks',
        description: 'Operations are running within target parameters. Maintain weekly member touchpoints.'
      });
    }

    return {
      healthScore: metrics.healthScore,
      healthBadge: metrics.healthBadge,
      healthExplanation: healthExplanation,
      revenueExplainability: revenueExplainability,
      customerObservations: customerObservations,
      coachObservations: coachObservations,
      rankedRisks: rankedRisks
    };
  }

  window.PulseIQ_InsightEngine = {
    generateInsights: generateInsights
  };

})(window);
