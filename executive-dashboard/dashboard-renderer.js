/**
 * PulseIQ Phase 2.8 — Executive Intelligence Dashboard
 * Dashboard Renderer & UI Manager
 * Milestone 6 Extended Telemetry Implementation
 * 
 * Consolidates all Phase 2 & Phase 1 module outputs into a unified Executive Command Centre.
 * Renders Executive Briefing Hero, Responsive Widget Grid (including Milestone 6 Task Telemetry Widgets), and Drill-down Navigation.
 */

(function(window) {
  'use strict';

  function renderExecutiveDashboard(briefing, widgets) {
    if (typeof document === 'undefined') return;

    const heroEl = document.getElementById('exec-briefing-hero');
    const gridEl = document.getElementById('exec-widget-grid');

    // Render Executive Briefing Hero
    if (heroEl) {
      const b = briefing || {};
      const score = b.businessHealthScore || 87;

      let html = '';
      html += '<div class="tcard" style="padding:26px;margin-bottom:24px;background:linear-gradient(135deg, rgba(56,189,248,0.12) 0%, rgba(24,24,27,0.9) 100%);border:1.5px solid rgba(56,189,248,0.35)">';
      html += '  <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:16px">';
      html += '    <div>';
      html += '      <div style="font-size:12px;font-weight:700;color:#38bdf8;text-transform:uppercase;letter-spacing:1.2px">👑 Executive Command Intelligence</div>';
      html += '      <div style="font-family:\'Space Grotesk\',sans-serif;font-size:26px;font-weight:800;color:var(--text);margin-top:2px">Business Health Score: <span style="color:#27AE60">' + score + ' / 100</span></div>';
      html += '    </div>';
      html += '    <div style="display:flex;gap:8px;flex-wrap:wrap">';
      html += '      <button onclick="goTo(\'taskcenter\')" class="btn-p" style="padding:8px 14px;font-size:12.5px;background:#27AE60">📋 Task Centre</button>';
      html += '      <button onclick="goTo(\'bizanalyst\')" class="btn-p" style="padding:8px 14px;font-size:12.5px">📊 Biz Analyst</button>';
      html += '      <button onclick="goTo(\'customerrisk\')" class="btn-p" style="padding:8px 14px;font-size:12.5px;background:#ef4444">🎯 Customer Risk</button>';
      html += '    </div>';
      html += '  </div>';

      // Factual Executive Summary Bullets
      html += '  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.08)">';
      if (b.briefingStatements) {
        b.briefingStatements.forEach(stmt => {
          html += '    <div style="font-size:13px;color:var(--text);line-height:1.5;display:flex;align-items:flex-start;gap:8px">';
          html += '      <span style="color:#38bdf8">•</span><span>' + stmt + '</span>';
          html += '    </div>';
        });
      }
      html += '  </div>';
      html += '</div>';

      heroEl.innerHTML = html;
    }

    // Render Widget Grid
    if (gridEl) {
      const w = widgets || {};
      const tm = w.taskMetrics || { openTasks: 0, overdueTasks: 0, taskSlaCompliancePct: 100 };
      let html = '';

      // 1. OPEN TASKS TELEMETRY WIDGET (Milestone 6)
      html += '<div class="tcard" style="padding:20px;background:rgba(24,24,27,0.75);backdrop-filter:blur(16px);border:1px solid rgba(56,189,248,0.3);border-left:5px solid #38bdf8">';
      html += '  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">';
      html += '    <span style="font-family:\'Space Grotesk\',sans-serif;font-weight:700;font-size:15.5px;color:var(--text)">📋 Open Operational Tasks</span>';
      html += '    <button onclick="goTo(\'taskcenter\')" style="padding:4px 8px;border-radius:6px;background:rgba(56,189,248,0.15);color:#38bdf8;border:1px solid rgba(56,189,248,0.3);font-size:11px;font-weight:700;cursor:pointer">Task Centre ↗</button>';
      html += '  </div>';
      html += '  <div style="font-size:32px;font-weight:800;color:#38bdf8;margin-bottom:4px">' + (tm.openTasks || 0) + '</div>';
      html += '  <div style="font-size:12px;color:var(--muted)">Active tasks pending completion across all coaches and categories.</div>';
      html += '</div>';

      // 2. OVERDUE TASKS TELEMETRY WIDGET (Milestone 6)
      html += '<div class="tcard" style="padding:20px;background:rgba(24,24,27,0.75);backdrop-filter:blur(16px);border:1px solid rgba(239,68,68,0.3);border-left:5px solid #ef4444">';
      html += '  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">';
      html += '    <span style="font-family:\'Space Grotesk\',sans-serif;font-weight:700;font-size:15.5px;color:var(--text)">⚠️ Overdue Tasks</span>';
      html += '    <button onclick="goTo(\'taskcenter\')" style="padding:4px 8px;border-radius:6px;background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.3);font-size:11px;font-weight:700;cursor:pointer">Resolve ↗</button>';
      html += '  </div>';
      html += '  <div style="font-size:32px;font-weight:800;color:#ef4444;margin-bottom:4px">' + (tm.overdueTasks || 0) + '</div>';
      html += '  <div style="font-size:12px;color:var(--muted)">Tasks past scheduled due date requiring urgent coach follow-up.</div>';
      html += '</div>';

      // 3. TASK SLA COMPLIANCE WIDGET (Milestone 6)
      html += '<div class="tcard" style="padding:20px;background:rgba(24,24,27,0.75);backdrop-filter:blur(16px);border:1px solid rgba(39,174,96,0.3);border-left:5px solid #27AE60">';
      html += '  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">';
      html += '    <span style="font-family:\'Space Grotesk\',sans-serif;font-weight:700;font-size:15.5px;color:var(--text)">🎯 Task SLA Compliance Rate</span>';
      html += '    <button onclick="goTo(\'taskcenter\')" style="padding:4px 8px;border-radius:6px;background:rgba(39,174,96,0.15);color:#27AE60;border:1px solid rgba(39,174,96,0.3);font-size:11px;font-weight:700;cursor:pointer">Details ↗</button>';
      html += '  </div>';
      html += '  <div style="font-size:32px;font-weight:800;color:#27AE60;margin-bottom:4px">' + (tm.taskSlaCompliancePct || 100) + '%</div>';
      html += '  <div style="font-size:12px;color:var(--muted)">Percentage of tasks completed on or before specified due date.</div>';
      html += '</div>';

      // 4. TODAY'S PRIORITIES WIDGET
      html += '<div class="tcard" style="padding:20px;background:rgba(24,24,27,0.75);backdrop-filter:blur(16px);border:1px solid rgba(239,68,68,0.3);border-left:5px solid #ef4444">';
      html += '  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">';
      html += '    <span style="font-family:\'Space Grotesk\',sans-serif;font-weight:700;font-size:15.5px;color:var(--text)">🔴 Today\'s Urgent Priorities</span>';
      html += '    <button onclick="goTo(\'actioncenter\')" style="padding:4px 8px;border-radius:6px;background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.3);font-size:11px;font-weight:700;cursor:pointer">View All ↗</button>';
      html += '  </div>';
      if (w.topPriorities && w.topPriorities.length > 0) {
        w.topPriorities.forEach(p => {
          html += '  <div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:12.5px">';
          html += '    <div style="font-weight:700;color:var(--text)">• ' + p.title + '</div>';
          html += '    <div style="color:var(--muted);font-size:11.5px;margin-top:2px">' + p.reason + '</div>';
          html += '  </div>';
        });
      } else {
        html += '  <div style="font-size:12.5px;color:var(--muted)">No high-priority operational alerts today.</div>';
      }
      html += '</div>';

      // 5. AT-RISK MEMBERS WIDGET
      html += '<div class="tcard" style="padding:20px;background:rgba(24,24,27,0.75);backdrop-filter:blur(16px);border:1px solid rgba(245,158,11,0.3);border-left:5px solid #f59e0b">';
      html += '  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">';
      html += '    <span style="font-family:\'Space Grotesk\',sans-serif;font-weight:700;font-size:15.5px;color:var(--text)">🎯 At-Risk Members</span>';
      html += '    <button onclick="goTo(\'customerrisk\')" style="padding:4px 8px;border-radius:6px;background:rgba(245,158,11,0.15);color:#f59e0b;border:1px solid rgba(245,158,11,0.3);font-size:11px;font-weight:700;cursor:pointer">View All ↗</button>';
      html += '  </div>';
      if (w.highRiskMembers && w.highRiskMembers.length > 0) {
        w.highRiskMembers.forEach(r => {
          html += '  <div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:12.5px;display:flex;align-items:center;justify-content:space-between">';
          html += '    <div>';
          html += '      <div style="font-weight:700;color:var(--text)">' + r.customerName + '</div>';
          html += '      <div style="color:var(--muted);font-size:11.5px">Absent: ' + r.daysAbsent + ' days | Expiry: ' + r.membershipExpiry + '</div>';
          html += '    </div>';
          html += '    <span style="padding:2px 6px;border-radius:8px;font-size:10px;font-weight:700;background:rgba(239,68,68,0.15);color:#ef4444">' + r.riskScore + '/100</span>';
          html += '  </div>';
        });
      } else {
        html += '  <div style="font-size:12.5px;color:var(--muted)">All active members are engaged.</div>';
      }
      html += '</div>';

      // 6. COACH LEADERBOARD WIDGET
      html += '<div class="tcard" style="padding:20px;background:rgba(24,24,27,0.75);backdrop-filter:blur(16px);border:1px solid rgba(39,174,96,0.3);border-left:5px solid #27AE60">';
      html += '  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">';
      html += '    <span style="font-family:\'Space Grotesk\',sans-serif;font-weight:700;font-size:15.5px;color:var(--text)">🏆 Coach Roster Performance</span>';
      html += '    <button onclick="goTo(\'coachanalytics\')" style="padding:4px 8px;border-radius:6px;background:rgba(39,174,96,0.15);color:#27AE60;border:1px solid rgba(39,174,96,0.3);font-size:11px;font-weight:700;cursor:pointer">Leaderboard ↗</button>';
      html += '  </div>';
      if (w.topCoaches && w.topCoaches.length > 0) {
        w.topCoaches.forEach(c => {
          html += '  <div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:12.5px;display:flex;align-items:center;justify-content:space-between">';
          html += '    <div>';
          html += '      <div style="font-weight:700;color:var(--text)">' + c.coachName + ' <span style="font-size:10px;color:#27AE60">(' + c.pin + ')</span></div>';
          html += '      <div style="color:var(--muted);font-size:11.5px">Retention: ' + (c.retentionRatePct || 100) + '% | Rev: ₹' + (c.revenueGenerated || 0).toLocaleString('en-IN') + '</div>';
          html += '    </div>';
          html += '    <span style="font-weight:700;color:#27AE60">' + c.coachScore + ' pts</span>';
          html += '  </div>';
        });
      } else {
        html += '  <div style="font-size:12.5px;color:var(--muted)">No coach metrics available.</div>';
      }
      html += '</div>';

      gridEl.innerHTML = html;
    }
  }

  window.PulseIQ_ExecutiveDashboardRenderer = {
    renderExecutiveDashboard: renderExecutiveDashboard
  };

})(typeof window !== 'undefined' ? window : global);
