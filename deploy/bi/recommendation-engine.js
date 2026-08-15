/**
 * PulseIQ AI Executive Business Analyst (LLM-Powered)
 * Layer 3: Recommendation Engine with Rationale
 * 
 * Generates 3-5 prioritized recommendations. Every recommendation explicitly
 * explains WHY the action is required based on empirical data metrics.
 */

(function(window) {
  'use strict';

  function generateRecommendations(metrics, insights) {
    if (!metrics) metrics = window.PulseIQ_MetricsEngine ? window.PulseIQ_MetricsEngine.computeBusinessMetrics() : {};
    if (!insights) insights = window.PulseIQ_InsightEngine ? window.PulseIQ_InsightEngine.generateInsights(metrics) : {};

    const recs = [];
    const fu = metrics.followups || {};
    const cust = metrics.customers || {};
    const inv = metrics.inventory || {};
    const rev = metrics.revenue || {};
    const coach = metrics.coaches || {};

    // 1. Follow-up SLA Recommendation
    if (fu.overdueCount > 0 || fu.pendingCount > 0) {
      recs.push({
        priority: 'HIGH',
        icon: '⚡',
        action: 'Execute Pending & Overdue Customer Follow-ups',
        why: `Because ${fu.overdueCount || fu.pendingCount} client follow-ups are pending beyond SLA limits, placing member retention and renewal packages at risk.`
      });
    }

    // 2. High Churn Risk Retention
    if (cust.churnRiskCount > 0 || cust.inactiveCount > 0) {
      recs.push({
        priority: 'HIGH',
        icon: '📞',
        action: 'Initiate Direct Phone Outreach to High-Risk Members',
        why: `Because ${cust.churnRiskCount || cust.inactiveCount} active members have missed attendance for 7+ consecutive days, indicating imminent churn vulnerability.`
      });
    }

    // 3. Inventory Restock Recommendation
    if (inv.totalLowOrOut > 0) {
      recs.push({
        priority: 'MEDIUM',
        icon: '📦',
        action: 'Reorder Depleted & Low-Stock Nutrition Products',
        why: `Because ${inv.totalLowOrOut} product(s) (${inv.outOfStockItems.concat(inv.lowStockItems).join(', ')}) are below threshold, restricting retail revenue potential.`
      });
    }

    // 4. Revenue Growth / Package Upgrade Campaign
    if (rev.weeklyRevenueGrowthPct <= 0 || recs.length < 3) {
      recs.push({
        priority: 'MEDIUM',
        icon: '🎯',
        action: 'Schedule Renewal & Nutrition Package Campaigns',
        why: `Because current weekly revenue growth is ${rev.weeklyRevenueGrowthPct || 0}%, and proactive renewals will lock in predictable monthly recurring cash flow.`
      });
    }

    // 5. Coach SLA Alignment
    if (coach.lowestFollowupCoach && coach.lowestFollowupCoach.name && recs.length < 5) {
      recs.push({
        priority: 'LOW',
        icon: '🏋',
        action: `Realign Follow-up Workload for ${coach.lowestFollowupCoach.name}`,
        why: `Because follow-up completion for this coach is at ${coach.lowestFollowupCoach.followupCompletionPct}%, below the team average benchmark.`
      });
    }

    return recs.slice(0, 5);
  }

  window.PulseIQ_RecommendationEngine = {
    generateRecommendations: generateRecommendations
  };

})(window);
