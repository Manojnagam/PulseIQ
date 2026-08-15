/**
 * PulseIQ Phase 2.6 — Goal Tracking & KPI Targets
 * Dashboard Renderer & UI Manager
 * 
 * Renders Business Health Header, Strategic Summary, KPI Target Cards,
 * Progress Bars, Target Comparison Table, and Interactive Target Adjuster.
 */

(function(window) {
  'use strict';

  let currentResults = null;
  let categoryFilter = '';
  let searchQuery = '';

  function renderKPICard(kpi) {
    const cappedPct = Math.min(100, Math.max(0, kpi.achievementPct));

    let html = '';
    html += '<div class="tcard" id="goal-card-' + kpi.id + '" style="margin-bottom:16px;padding:20px 24px;background:rgba(24,24,27,0.75);backdrop-filter:blur(16px);border:1px solid ' + kpi.border + ';border-left:5px solid ' + kpi.color + ';transition:all .22s cubic-bezier(0.4, 0, 0.2, 1)">';

    // Top Header: Title, Category, Status Badge
    html += '  <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">';
    html += '    <div>';
    html += '      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
    html += '        <span style="font-family:\'Space Grotesk\',sans-serif;font-weight:700;font-size:16px;color:var(--text)">' + kpi.title + '</span>';
    html += '        <span style="padding:2px 8px;border-radius:12px;font-size:10px;font-weight:600;background:rgba(255,255,255,0.06);color:var(--muted);border:1px solid rgba(255,255,255,0.1)">' + kpi.category + '</span>';
    html += '      </div>';
    html += '      <div style="font-size:12.5px;color:var(--muted);margin-top:3px">Target: <strong style="color:var(--text)">' + kpi.formattedTarget + '</strong></div>';
    html += '    </div>';
    html += '    <span style="padding:4px 12px;border-radius:14px;font-size:11.5px;font-weight:700;background:' + kpi.bg + ';color:' + kpi.color + ';border:1px solid ' + kpi.border + '">' + kpi.statusBadge + '</span>';
    html += '  </div>';

    // Metrics Row: Actual vs Target & Achievement %
    html += '  <div style="display:flex;align-items:baseline;justify-content:space-between;margin-top:14px;margin-bottom:8px">';
    html += '    <div>';
    html += '      <span style="font-size:26px;font-weight:800;color:var(--text);font-family:\'Space Grotesk\',sans-serif">' + kpi.formattedActual + '</span>';
    html += '      <span style="font-size:13px;color:var(--muted);margin-left:8px">(' + kpi.formattedDiff + ')</span>';
    html += '    </div>';
    html += '    <div style="font-size:18px;font-weight:800;color:' + kpi.color + ';font-family:\'Space Grotesk\',sans-serif">' + kpi.achievementPct + '%</div>';
    html += '  </div>';

    // Animated CSS Progress Bar
    html += '  <div style="width:100%;height:10px;background:rgba(255,255,255,0.06);border-radius:6px;overflow:hidden;border:1px solid rgba(255,255,255,0.08)">';
    html += '    <div style="width:' + cappedPct + '%;height:100%;background:linear-gradient(90deg, ' + kpi.color + ' 0%, rgba(255,255,255,0.8) 100%);border-radius:6px;transition:width .6s ease-out"></div>';
    html += '  </div>';

    html += '</div>';
    return html;
  }

  function renderDashboard(evaluationResult) {
    currentResults = evaluationResult || { businessHealthScore: 85, kpiResults: [] };

    if (typeof document === 'undefined') return;

    const feedEl = document.getElementById('goal-kpi-feed');
    const headerEl = document.getElementById('goal-business-overview');
    const tableEl = document.getElementById('goal-comparison-table');

    const kpis = currentResults.kpiResults || [];
    const healthScore = currentResults.businessHealthScore || 85;

    // Render Business Overview Summary Box
    if (headerEl) {
      const revKpi = kpis.find(k => k.id === 'kpi-revenue');
      const attKpi = kpis.find(k => k.id === 'kpi-attendance');
      const retKpi = kpis.find(k => k.id === 'kpi-retention');
      const renKpi = kpis.find(k => k.id === 'kpi-renewals');
      const invKpi = kpis.find(k => k.id === 'kpi-product-sales');

      headerEl.innerHTML = `
        <div class="tcard" style="padding:24px;margin-bottom:20px;background:linear-gradient(135deg, rgba(39,174,96,0.1) 0%, rgba(24,24,27,0.9) 100%);border:1.5px solid rgba(39,174,96,0.3)">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:16px">
            <div>
              <div style="font-size:12px;font-weight:700;color:#27AE60;text-transform:uppercase;letter-spacing:1px">🧠 Business Overview</div>
              <div style="font-family:'Space Grotesk',sans-serif;font-size:24px;font-weight:800;color:var(--text);margin-top:2px">Business Health: <span style="color:#27AE60">${healthScore} / 100</span> <span style="font-size:14px;color:#27AE60;font-weight:600">(▲ 4 vs last week)</span></div>
            </div>
            <button class="btn-p" onclick="PulseIQ_GoalTracking.promptCustomTarget()" style="padding:8px 16px;font-size:13px">⚙️ Adjust KPI Targets</button>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.08)">
            <div>
              <div style="font-weight:700;color:var(--text);font-size:14px;margin-bottom:6px">💰 Revenue Performance</div>
              <div style="font-size:13px;color:var(--muted)">• ${revKpi ? revKpi.formattedActual : '₹0'} this month</div>
              <div style="font-size:13px;color:#27AE60;font-weight:700">• ${revKpi ? revKpi.achievementPct : 0}% of monthly target achieved</div>
            </div>

            <div>
              <div style="font-weight:700;color:var(--text);font-size:14px;margin-bottom:6px">👥 Customer Retention</div>
              <div style="font-size:13px;color:var(--muted)">• ${retKpi ? retKpi.formattedActual : '0%'} retention rate</div>
              <div style="font-size:13px;color:${retKpi ? retKpi.color : '#fff'};font-weight:700">• Status: ${retKpi ? retKpi.statusBadge : 'ON TRACK'}</div>
            </div>

            <div>
              <div style="font-weight:700;color:var(--text);font-size:14px;margin-bottom:6px">📅 Attendance & Operations</div>
              <div style="font-size:13px;color:var(--muted)">• ${attKpi ? attKpi.formattedActual : '0%'} attendance compliance</div>
              <div style="font-size:13px;color:${attKpi ? attKpi.color : '#fff'};font-weight:700">• Status: ${attKpi ? attKpi.statusBadge : 'ON TRACK'}</div>
            </div>
          </div>

          <div style="margin-top:16px;padding:14px 18px;background:rgba(9,9,11,0.65);border-radius:12px;border:1px solid rgba(255,255,255,0.08);font-size:13px;color:var(--muted);line-height:1.6">
            <strong style="color:var(--text)">📌 Overall Strategic Assessment:</strong> The wellness centre is performing smoothly with strong revenue target alignment. Operational priorities focus on accelerating member body scan completion and timely membership renewals to ensure sustained retention.
          </div>
        </div>
      `;
    }

    // Filter KPIs
    const filtered = kpis.filter(kpi => {
      if (categoryFilter && kpi.category !== categoryFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const titleMatch = (kpi.title || '').toLowerCase().includes(q);
        const catMatch = (kpi.category || '').toLowerCase().includes(q);
        if (!titleMatch && !catMatch) return false;
      }
      return true;
    });

    // Render Cards Feed
    if (feedEl) {
      if (filtered.length === 0) {
        feedEl.innerHTML = `
          <div class="tcard" style="padding:48px 20px;text-align:center;color:var(--muted)">
            <div style="font-size:44px;margin-bottom:12px">🎯</div>
            <div style="font-family:'Space Grotesk',sans-serif;font-size:18px;font-weight:700;color:var(--text);margin-bottom:6px">No KPI Targets Match Selected Filter</div>
          </div>
        `;
      } else {
        feedEl.innerHTML = filtered.map(renderKPICard).join('');
      }
    }

    // Render Comparison Table
    if (tableEl) {
      let tblHtml = `
        <div class="tcard" style="padding:20px;margin-top:20px">
          <div style="font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:16px;color:var(--text);margin-bottom:14px">📋 KPI Target Comparison Table</div>
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;font-size:13px;text-align:left">
              <thead>
                <tr style="border-bottom:1.5px solid rgba(255,255,255,0.12);color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:0.5px">
                  <th style="padding:10px 12px">KPI Name</th>
                  <th style="padding:10px 12px">Category</th>
                  <th style="padding:10px 12px">Target</th>
                  <th style="padding:10px 12px">Actual</th>
                  <th style="padding:10px 12px">Variance</th>
                  <th style="padding:10px 12px">% Achieved</th>
                  <th style="padding:10px 12px">Status</th>
                </tr>
              </thead>
              <tbody>
      `;

      kpis.forEach(kpi => {
        tblHtml += `
          <tr style="border-bottom:1px solid rgba(255,255,255,0.05)">
            <td style="padding:12px;font-weight:700;color:var(--text)">${kpi.title}</td>
            <td style="padding:12px;color:var(--muted)"><span style="padding:2px 6px;border-radius:8px;font-size:10px;background:rgba(255,255,255,0.06)">${kpi.category}</span></td>
            <td style="padding:12px;color:var(--muted)">${kpi.formattedTarget}</td>
            <td style="padding:12px;font-weight:700;color:var(--text)">${kpi.formattedActual}</td>
            <td style="padding:12px;color:${kpi.difference >= 0 ? '#27AE60' : '#ef4444'};font-family:'JetBrains Mono',monospace">${kpi.formattedDiff}</td>
            <td style="padding:12px;font-weight:700;color:${kpi.color};font-family:'JetBrains Mono',monospace">${kpi.achievementPct}%</td>
            <td style="padding:12px"><span style="padding:3px 8px;border-radius:10px;font-size:10.5px;font-weight:700;background:${kpi.bg};color:${kpi.color};border:1px solid ${kpi.border}">${kpi.statusBadge}</span></td>
          </tr>
        `;
      });

      tblHtml += `
              </tbody>
            </table>
          </div>
        </div>
      `;
      tableEl.innerHTML = tblHtml;
    }
  }

  window.PulseIQ_GoalDashboardRenderer = {
    renderDashboard: renderDashboard,
    setCategoryFilter: function(val) { categoryFilter = val; },
    setSearchQuery: function(val) { searchQuery = val; }
  };

})(typeof window !== 'undefined' ? window : global);
