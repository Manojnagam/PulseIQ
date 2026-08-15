/**
 * PulseIQ Phase 2.4 — Coach Performance Analytics
 * Scoring & Ranking Engine
 * Milestone 6 Extended Telemetry Implementation
 * 
 * TRANSPARENT COACH PERFORMANCE SCORING MODEL (0 - 100 Points).
 * Updated Weighting Formula (Milestone 6):
 * 1. Attendance Compliance (0-25 pts) — 25% weight
 * 2. Body Scan Completion (0-20 pts) — 20% weight
 * 3. Renewals & Growth (0-20 pts) — 20% weight
 * 4. Task Completion Rate (0-20 pts) — 20% weight
 * 5. Task SLA Compliance Rate (0-15 pts) — 15% weight
 * 
 * Total Max Score = 100 Points. ZERO AI HALLUCINATION. ZERO SUBJECTIVITY.
 */

(function(window) {
  'use strict';

  function evaluateCoachScoresAndRankings(coachMetricsList) {
    if (!coachMetricsList || coachMetricsList.length === 0) return [];

    const maxRenewals = Math.max(...coachMetricsList.map(c => c.renewalCount || 0), 1);

    // Get all tasks for task metrics derivation if needed
    const allTasks = (window.PulseIQ_TaskRenderer && window.PulseIQ_TaskRenderer.state && window.PulseIQ_TaskRenderer.state.tasks) || [];

    const scoredCoaches = coachMetricsList.map(c => {
      // 1. Attendance Compliance (0-25 pts) — 25%
      const attendancePts = Math.round((c.attendanceCompliancePct || 0) * 0.25);

      // 2. Body Scan Completion (0-20 pts) — 20%
      const scanPts = Math.round((c.scanCompletionPct || 0) * 0.20);

      // 3. Renewals & Growth (0-20 pts) — 20%
      const renewalRatePct = c.renewalRatePct !== undefined
        ? c.renewalRatePct
        : (maxRenewals > 0 ? Math.round(((c.renewalCount || 0) / maxRenewals) * 100) : 100);
      const renewalPts = Math.round(renewalRatePct * 0.20);

      // 4. Task Completion % (0-20 pts) — 20%
      let taskCompPct = typeof c.taskCompletionPct === 'number' ? c.taskCompletionPct : 100;
      let taskSlaPct = typeof c.taskSlaCompliancePct === 'number' ? c.taskSlaCompliancePct : 100;

      // Derive task metrics if not pre-populated
      if (c.taskCompletionPct === undefined) {
        const coachTasks = allTasks.filter(t => t.assigned_to_coach_id === c.coachId || String(t.assigned_to_coach_id) === String(c.coachId));
        if (coachTasks.length > 0) {
          const completed = coachTasks.filter(t => ['Completed', 'Verified', 'Closed'].includes(t.status));
          taskCompPct = Math.round((completed.length / coachTasks.length) * 100);

          if (completed.length > 0) {
            const onTime = completed.filter(t => !t.due_date || (t.completed_at && new Date(t.completed_at) <= new Date(t.due_date)) || (t.updated_at && new Date(t.updated_at) <= new Date(t.due_date)));
            taskSlaPct = Math.round((onTime.length / completed.length) * 100);
          } else {
            taskSlaPct = 100;
          }
        }
      }

      const taskCompPts = Math.round(taskCompPct * 0.20);

      // 5. Task SLA Compliance % (0-15 pts) — 15%
      const taskSlaPts = Math.round(taskSlaPct * 0.15);

      const totalScore = Math.min(100, attendancePts + scanPts + renewalPts + taskCompPts + taskSlaPts);

      const breakdown = [
        { factor: 'Attendance Compliance', pts: attendancePts, max: 25, detail: `${c.attendanceCompliancePct || 0}% Compliance` },
        { factor: 'Body Scan Completion', pts: scanPts, max: 20, detail: `${c.scanCompletionPct || 0}% Scanned` },
        { factor: 'Renewals & Growth', pts: renewalPts, max: 20, detail: `${c.renewalCount || 0} Pack Renewals` },
        { factor: 'Task Completion Rate', pts: taskCompPts, max: 20, detail: `${taskCompPct}% Tasks Completed` },
        { factor: 'Task SLA Compliance', pts: taskSlaPts, max: 15, detail: `${taskSlaPct}% On-Time` }
      ];

      return {
        ...c,
        taskCompletionPct: taskCompPct,
        taskSlaCompliancePct: taskSlaPct,
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

      const maxRet = Math.max(...scoredCoaches.map(c => c.retentionRatePct || 0));
      const maxRev = Math.max(...scoredCoaches.map(c => c.revenueGenerated || 0));
      const maxAtt = Math.max(...scoredCoaches.map(c => c.attendanceCompliancePct || 0));
      const maxRen = Math.max(...scoredCoaches.map(c => c.renewalCount || 0));
      const maxSla = Math.max(...scoredCoaches.map(c => c.taskSlaCompliancePct || 0));

      scoredCoaches.forEach(c => {
        if (c.retentionRatePct === maxRet && maxRet > 0) c.badges.push('Highest Retention 🥇');
        if (c.revenueGenerated === maxRev && maxRev > 0) c.badges.push('Highest Revenue 💰');
        if (c.attendanceCompliancePct === maxAtt && maxAtt > 0) c.badges.push('Highest Attendance 📅');
        if (c.renewalCount === maxRen && maxRen > 0) c.badges.push('Highest Renewals 🔄');
        if (c.taskSlaCompliancePct === maxSla && maxSla > 0) c.badges.push('Task Master 🎯');
      });
    }

    return scoredCoaches;
  }

  window.PulseIQ_CoachScoringEngine = {
    evaluateCoachScoresAndRankings: evaluateCoachScoresAndRankings
  };

})(typeof window !== 'undefined' ? window : global);
