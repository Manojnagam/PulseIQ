/**
 * PulseIQ Phase 2 — AI Business Analyst (Phase 2.1)
 * Layer 3: Recommendation Engine
 * 
 * Generates prioritized action items directly referenced to computed metrics.
 * 🔴 High Priority | 🟡 Medium Priority | 🟢 Low Priority
 */

(function(window) {
  'use strict';

  function generateRecommendations(metrics, insights) {
    if (!metrics) {
      metrics = window.PulseIQ_MetricsEngine ? window.PulseIQ_MetricsEngine.computeBusinessMetrics() : {};
    }
    if (!insights) {
      insights = window.PulseIQ_InsightEngine ? window.PulseIQ_InsightEngine.generateInsights(metrics) : { warnings: [] };
    }

    const recommendations = [];

    const cust = metrics.customers || {};
    const inv = metrics.inventory || {};
    const body = metrics.bodyComposition || {};
    const att = metrics.attendance || {};
    const rev = metrics.revenue || {};
    const coach = (metrics.coaches || {}).topCoach;

    // 🔴 HIGH PRIORITY ACTIONS
    if (cust.inactive && cust.inactive.length > 0) {
      recommendations.push({
        priority: 'high',
        icon: '🔴',
        badge: 'High',
        text: `Call ${cust.inactive.length} inactive customer${cust.inactive.length > 1 ? 's' : ''} who have missed check-ins for 7+ days to prevent churn.`
      });
    }

    if (inv.totalLowOrOut > 0) {
      const topLow = (inv.outOfStockItems[0] || inv.lowStockItems[0] || {}).name || 'inventory products';
      recommendations.push({
        priority: 'high',
        icon: '🔴',
        badge: 'High',
        text: `Reorder low/out-of-stock inventory (${topLow} — ${inv.totalLowOrOut} item${inv.totalLowOrOut > 1 ? 's' : ''} affected).`
      });
    }

    if (body.recheckDueCount > 0) {
      recommendations.push({
        priority: 'high',
        icon: '🔴',
        badge: 'High',
        text: `Schedule overdue body scans for ${body.recheckDueCount} customer${body.recheckDueCount > 1 ? 's' : ''} to track progress.`
      });
    }

    // 🟡 MEDIUM PRIORITY ACTIONS
    if (cust.expiringMemberships && cust.expiringMemberships.length > 0) {
      recommendations.push({
        priority: 'medium',
        icon: '🟡',
        badge: 'Medium',
        text: `Contact ${cust.expiringMemberships.length} customer${cust.expiringMemberships.length > 1 ? 's' : ''} whose memberships expire within 7 days for pack renewal.`
      });
    }

    if (att.attendanceGrowthPct < 0) {
      recommendations.push({
        priority: 'medium',
        icon: '🟡',
        badge: 'Medium',
        text: `Review weekly attendance drop (${Math.abs(att.attendanceGrowthPct)}%) and send follow-up WhatsApp reminders.`
      });
    }

    // 🟢 LOW PRIORITY ACTIONS
    if (coach && coach.name && coach.name !== 'N/A') {
      recommendations.push({
        priority: 'low',
        icon: '🟢',
        badge: 'Low',
        text: `Recognize Coach ${coach.name} for top customer retention (${coach.retentionRate}%) and team leadership.`
      });
    }

    if (rev.weeklyRevenueGrowthPct > 0) {
      recommendations.push({
        priority: 'low',
        icon: '🟢',
        badge: 'Low',
        text: `Maintain current momentum after +${rev.weeklyRevenueGrowthPct}% revenue growth this week.`
      });
    }

    // Default fallback if data is pristine with no alerts
    if (recommendations.length === 0) {
      recommendations.push({
        priority: 'low',
        icon: '🟢',
        badge: 'Low',
        text: 'All operational metrics are healthy. Focus on acquiring new walk-ins and referrals.'
      });
    }

    return recommendations;
  }

  window.PulseIQ_RecommendationEngine = {
    generateRecommendations: generateRecommendations
  };

})(window);
