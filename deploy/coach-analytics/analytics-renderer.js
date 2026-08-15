/**
 * PulseIQ Phase 2.4 — Coach Performance Analytics
 * Analytics Renderer & UI Manager
 * 
 * Renders Coach Leaderboard, Comparison Table, KPI summary cards,
 * deterministic badges, and transparent score breakdowns.
 */

(function(window) {
  'use strict';

  let currentCoaches = [];
  let searchQuery = '';
  let sortBy = 'score_desc';
  const expandedCoachIds = new Set();

  function renderCoachCard(coach) {
    const isExpanded = expandedCoachIds.has(coach.coachId);

    const scoreColor = coach.coachScore >= 80 ? '#27AE60' : (coach.coachScore >= 60 ? '#f59e0b' : '#ef4444');
    const scoreBg = coach.coachScore >= 80 ? 'rgba(39,174,96,0.12)' : (coach.coachScore >= 60 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)');
    const scoreBorder = coach.coachScore >= 80 ? 'rgba(39,174,96,0.3)' : (coach.coachScore >= 60 ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)');

    let html = '';
    html += '<div class="tcard" id="coach-card-' + coach.coachId + '" style="margin-bottom:16px;padding:20px 24px;background:rgba(24,24,27,0.75);backdrop-filter:blur(16px);border:1px solid ' + scoreBorder + ';border-left:5px solid ' + scoreColor + ';transition:all .22s cubic-bezier(0.4, 0, 0.2, 1)">';

    // Header Row: Coach Name, Pin, Badges, Score, Actions
    html += '  <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">';
    html += '    <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:240px">';
    html += '      <div style="width:46px;height:46px;border-radius:14px;background:linear-gradient(135deg, ' + scoreColor + ' 0%, rgba(24,24,27,0.8) 100%);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:20px;box-shadow:0 4px 12px rgba(0,0,0,0.3)">👨‍🏫</div>';
    html += '      <div>';
    html += '        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">';
    html += '          <span style="font-family:\'Space Grotesk\',sans-serif;font-weight:700;font-size:17px;color:var(--text)">' + coach.coachName + '</span>';
    html += '          <span style="padding:3px 10px;border-radius:14px;font-size:11px;font-weight:700;background:' + scoreBg + ';color:' + scoreColor + ';border:1px solid ' + scoreBorder + '">Score: ' + coach.coachScore + ' / 100</span>';
    coach.badges.forEach(b => {
      html += '          <span style="padding:3px 10px;border-radius:14px;font-size:11px;font-weight:700;background:rgba(56,189,248,0.15);color:#38bdf8;border:1px solid rgba(56,189,248,0.3)">' + b + '</span>';
    });
    html += '        </div>';
    html += '        <div style="font-size:12.5px;color:var(--muted);margin-top:3px">Pin Level: <strong style="color:var(--text)">' + coach.pin + '</strong> | Active Members: <strong style="color:var(--text)">' + coach.activeCustomers + ' / ' + coach.totalCustomers + '</strong></div>';
    html += '      </div>';
    html += '    </div>';

    // Action Button
    html += '    <div style="display:flex;align-items:center;gap:8px">';
    html += '      <button onclick="PulseIQ_CoachAnalytics.toggleExpand(' + coach.coachId + ')" style="padding:8px 14px;border-radius:10px;background:rgba(255,255,255,0.06);color:var(--muted);border:1px solid rgba(255,255,255,0.1);font-size:12.5px;cursor:pointer;font-family:inherit;font-weight:600">' + (isExpanded ? 'Hide Breakdown ▲' : 'View Score Breakdown ▼') + '</button>';
    html += '    </div>';
    html += '  </div>';

    // Operational Metrics Grid
    html += '  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-top:16px;margin-bottom:12px">';
    
    html += '    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:10px 12px">';
    html += '      <div style="font-size:10.5px;font-weight:700;color:var(--muted);text-transform:uppercase">Customer Retention</div>';
    html += '      <div style="font-size:15px;font-weight:700;color:#27AE60;margin-top:2px">' + coach.retentionRatePct + '%</div>';
    html += '    </div>';

    html += '    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:10px 12px">';
    html += '      <div style="font-size:10.5px;font-weight:700;color:var(--muted);text-transform:uppercase">Revenue Generated</div>';
    html += '      <div style="font-size:15px;font-weight:700;color:#38bdf8;margin-top:2px">₹' + coach.revenueGenerated.toLocaleString('en-IN') + '</div>';
    html += '    </div>';

    html += '    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:10px 12px">';
    html += '      <div style="font-size:10.5px;font-weight:700;color:var(--muted);text-transform:uppercase">ARPU</div>';
    html += '      <div style="font-size:15px;font-weight:700;color:var(--text);margin-top:2px">₹' + coach.arpu.toLocaleString('en-IN') + '</div>';
    html += '    </div>';

    html += '    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:10px 12px">';
    html += '      <div style="font-size:10.5px;font-weight:700;color:var(--muted);text-transform:uppercase">Attendance Compliance</div>';
    html += '      <div style="font-size:15px;font-weight:700;color:var(--text);margin-top:2px">' + coach.attendanceCompliancePct + '%</div>';
    html += '    </div>';

    html += '    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:10px 12px">';
    html += '      <div style="font-size:10.5px;font-weight:700;color:var(--muted);text-transform:uppercase">Body Scan Rate</div>';
    html += '      <div style="font-size:15px;font-weight:700;color:var(--text);margin-top:2px">' + coach.scanCompletionPct + '%</div>';
    html += '    </div>';

    html += '    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:10px 12px">';
    html += '      <div style="font-size:10.5px;font-weight:700;color:var(--muted);text-transform:uppercase">Risk Members</div>';
    html += '      <div style="font-size:15px;font-weight:700;color:#ef4444;margin-top:2px">' + coach.highRiskCount + ' High Risk</div>';
    html += '    </div>';

    html += '  </div>';

    // Expandable Transparent Score Breakdown
    if (isExpanded) {
      html += '  <div style="margin-top:14px;padding:16px 20px;background:rgba(9,9,11,0.65);border-radius:12px;border:1px solid rgba(255,255,255,0.12)">';
      html += '    <div style="font-family:\'Space Grotesk\',sans-serif;font-weight:700;font-size:14px;color:var(--text);margin-bottom:10px">🔍 Transparent Coach Score Breakdown (Total: ' + coach.coachScore + ' / 100):</div>';
      html += '    <div style="display:flex;flex-direction:column;gap:8px">';
      coach.scoreBreakdown.forEach(item => {
        const pct = Math.round((item.pts / item.max) * 100);
        html += '      <div style="display:flex;align-items:center;justify-content:space-between;font-size:13px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05)">';
        html += '        <span>• <strong>' + item.factor + '</strong> (' + item.detail + ')</span>';
        html += '        <span style="font-family:\'JetBrains Mono\',monospace;font-weight:700;color:' + scoreColor + '">' + item.pts + ' / ' + item.max + ' pts</span>';
        html += '      </div>';
      });
      html += '    </div>';
      html += '  </div>';
    }

    html += '</div>';
    return html;
  }

  function renderDashboard(coaches) {
    currentCoaches = coaches || [];

    if (typeof document === 'undefined') return;

    const feedEl = document.getElementById('coach-cards-feed');
    const statsEl = document.getElementById('coach-dashboard-stats');

    // Filter Coaches
    let filtered = currentCoaches.filter(c => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const nameMatch = (c.coachName || '').toLowerCase().includes(q);
        const pinMatch = (c.pin || '').toLowerCase().includes(q);
        if (!nameMatch && !pinMatch) return false;
      }
      return true;
    });

    // Sort Coaches
    if (sortBy === 'score_desc') {
      filtered.sort((a, b) => b.coachScore - a.coachScore);
    } else if (sortBy === 'revenue_desc') {
      filtered.sort((a, b) => b.revenueGenerated - a.revenueGenerated);
    } else if (sortBy === 'retention_desc') {
      filtered.sort((a, b) => b.retentionRatePct - a.retentionRatePct);
    } else if (sortBy === 'customers_desc') {
      filtered.sort((a, b) => b.activeCustomers - a.activeCustomers);
    }

    // Render Stats Bar
    if (statsEl) {
      const topCoachName = currentCoaches.length > 0 ? currentCoaches[0].coachName : 'N/A';
      const avgRetention = currentCoaches.length > 0 ? Math.round(currentCoaches.reduce((sum, c) => sum + c.retentionRatePct, 0) / currentCoaches.length) : 0;
      const totalRev = currentCoaches.reduce((sum, c) => sum + c.revenueGenerated, 0);

      statsEl.innerHTML = `
        <div class="stat" style="border-top:3px solid #27AE60">
          <div class="stat-l">Top Coach 🏆</div>
          <div class="stat-v" style="color:#27AE60;font-size:22px">${topCoachName}</div>
        </div>
        <div class="stat" style="border-top:3px solid #38bdf8">
          <div class="stat-l">Avg Customer Retention</div>
          <div class="stat-v" style="color:#38bdf8">${avgRetention}%</div>
        </div>
        <div class="stat" style="border-top:3px solid #f59e0b">
          <div class="stat-l">Total Org Revenue</div>
          <div class="stat-v" style="color:#f59e0b">₹${totalRev.toLocaleString('en-IN')}</div>
        </div>
        <div class="stat" style="border-top:3px solid #a78bfa">
          <div class="stat-l">Active Coaches</div>
          <div class="stat-v" style="color:#a78bfa">${currentCoaches.length}</div>
        </div>
      `;
    }

    // Render Feed
    if (!feedEl) return;

    if (filtered.length === 0) {
      feedEl.innerHTML = `
        <div class="tcard" style="padding:48px 20px;text-align:center;color:var(--muted)">
          <div style="font-size:44px;margin-bottom:12px">👨‍🏫</div>
          <div style="font-family:'Space Grotesk',sans-serif;font-size:18px;font-weight:700;color:var(--text);margin-bottom:6px">No Coach Performance Profiles Found</div>
          <div style="font-size:13.5px">Ensure coach records exist in your active wellness center organization.</div>
        </div>
      `;
      return;
    }

    feedEl.innerHTML = filtered.map(renderCoachCard).join('');
  }

  window.PulseIQ_CoachAnalyticsRenderer = {
    renderDashboard: renderDashboard,
    setSearchQuery: function(val) { searchQuery = val; },
    setSortBy: function(val) { sortBy = val; },
    toggleExpand: function(coachId) {
      if (expandedCoachIds.has(coachId)) expandedCoachIds.delete(coachId);
      else expandedCoachIds.add(coachId);
    }
  };

})(typeof window !== 'undefined' ? window : global);
