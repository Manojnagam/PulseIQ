/**
 * PulseIQ Phase 2.4 — Coach Performance Analytics
 * Scoring & Ranking Engine
 * 
 * TRANSPARENT COACH PERFORMANCE SCORING MODEL (0 - 100 Points).
 * 1. Retention Rate: 0-30 pts
 * 2. Revenue Performance: 0-20 pts
 * 3. Attendance Compliance: 0-15 pts
 * 4. Body Scan Completion: 0-15 pts
 * 5. Customer Progress: 0-10 pts
 * 6. Renewals & Growth: 0-10 pts
 * 
 * DETERMINISTIC BADGING & RANKINGS. ZERO SUBJECTIVITY.
 */

(function(window) {
  'use strict';

  function evaluateCoachScoresAndRankings(coachMetricsList) {
    if (!coachMetricsList || coachMetricsList.length === 0) return [];

    const maxRevenue = Math.max(...coachMetricsList.map(c => c.revenueGenerated), 1);
    const maxRenewals = Math.max(...coachMetricsList.map(c => c.renewalCount), 1);

    const scoredCoaches = coachMetricsList.map(c => {
      // 1. Retention Rate (0-30 pts)
      const retentionPts = Math.round(c.retentionRatePct * 0.30);

      // 2. Revenue Performance (0-20 pts)
      const revenuePts = Math.round((c.revenueGenerated / maxRevenue) * 20);

      // 3. Attendance Compliance (0-15 pts)
      const attendancePts = Math.round(c.attendanceCompliancePct * 0.15);

      // 4. Body Scan Completion (0-15 pts)
      const scanPts = Math.round(c.scanCompletionPct * 0.15);

      // 5. Customer Progress (0-10 pts)
      const progressRatio = c.totalCustomers > 0 ? c.progressCount / c.totalCustomers : 0;
      const progressPts = Math.round(progressRatio * 10);

      // 6. Renewals & Growth (0-10 pts)
      const renewalPts = Math.round((c.renewalCount / maxRenewals) * 10);

      const totalScore = Math.min(100, retentionPts + revenuePts + attendancePts + scanPts + progressPts + renewalPts);

      const breakdown = [
        { factor: 'Retention Rate', pts: retentionPts, max: 30, detail: `${c.retentionRatePct}% Retention` },
        { factor: 'Revenue Generated', pts: revenuePts, max: 20, detail: `₹${c.revenueGenerated.toLocaleString('en-IN')}` },
        { factor: 'Attendance Compliance', pts: attendancePts, max: 15, detail: `${c.attendanceCompliancePct}% Compliance` },
        { factor: 'Body Scan Completion', pts: scanPts, max: 15, detail: `${c.scanCompletionPct}% Scanned` },
        { factor: 'Customer Progress', pts: progressPts, max: 10, detail: `${c.progressCount} Members Progressed` },
        { factor: 'Renewals & Growth', pts: renewalPts, max: 10, detail: `${c.renewalCount} Pack Renewals` }
      ];

      return {
        ...c,
        coachScore: totalScore,
        scoreBreakdown: breakdown,
        badges: []
      };
    });

    // Sort by Coach Score descending
    scoredCoaches.sort((a, b) => b.coachScore - a.coachScore);

    // Assign Deterministic Rankings & Badges
    if (scoredCoaches.length > 0) {
      scoredCoaches[0].badges.push('Top Coach 🏆');

      const maxRet = Math.max(...scoredCoaches.map(c => c.retentionRatePct));
      const maxRev = Math.max(...scoredCoaches.map(c => c.revenueGenerated));
      const maxAtt = Math.max(...scoredCoaches.map(c => c.attendanceCompliancePct));
      const maxRen = Math.max(...scoredCoaches.map(c => c.renewalCount));

      scoredCoaches.forEach(c => {
        if (c.retentionRatePct === maxRet && maxRet > 0) c.badges.push('Highest Retention 🥇');
        if (c.revenueGenerated === maxRev && maxRev > 0) c.badges.push('Highest Revenue 💰');
        if (c.attendanceCompliancePct === maxAtt && maxAtt > 0) c.badges.push('Highest Attendance 📅');
        if (c.renewalCount === maxRen && maxRen > 0) c.badges.push('Highest Renewals 🔄');
      });
    }

    return scoredCoaches;
  }

  window.PulseIQ_CoachScoringEngine = {
    evaluateCoachScoresAndRankings: evaluateCoachScoresAndRankings
  };

})(typeof window !== 'undefined' ? window : global);
