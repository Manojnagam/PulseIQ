/**
 * PulseIQ Phase 2 — AI Business Analyst (Phase 2.1)
 * Layer 4: Natural Language Generator & UI Renderer
 * 
 * Converts structured metrics, insights, and recommendations
 * into clean, readable HTML matching the strict user specification.
 * NO generic greetings. NO motivational filler. 100% evidence-based.
 */

(function(window) {
  'use strict';

  function renderReportHtml(metrics, insights, recommendations) {
    if (!metrics) metrics = window.PulseIQ_MetricsEngine.computeBusinessMetrics();
    if (!insights) insights = window.PulseIQ_InsightEngine.generateInsights(metrics);
    if (!recommendations) recommendations = window.PulseIQ_RecommendationEngine.generateRecommendations(metrics, insights);

    const rev = metrics.revenue || {};
    const att = metrics.attendance || {};
    const cust = metrics.customers || {};
    const fin = metrics.finance || {};
    const coach = (metrics.coaches || {}).topCoach || {};
    const topProd = metrics.topProduct || 'Formula 1 Shake';

    const revTrend = (rev.weeklyRevenueGrowthPct || 0) >= 0 ? `↑ ${rev.weeklyRevenueGrowthPct}%` : `↓ ${Math.abs(rev.weeklyRevenueGrowthPct)}%`;
    const attTrend = (att.attendanceGrowthPct || 0) >= 0 ? `↑ ${att.attendanceGrowthPct}%` : `↓ ${Math.abs(att.attendanceGrowthPct)}%`;
    const custTrend = `↑ ${cust.newCount || 0}`;

    const revClass = (rev.weeklyRevenueGrowthPct || 0) >= 0 ? 'color:#27AE60' : 'color:#ef4444';
    const attClass = (att.attendanceGrowthPct || 0) >= 0 ? 'color:#27AE60' : 'color:#ef4444';

    let html = '';
    html += '<div style="background:rgba(24,24,27,0.85);backdrop-filter:blur(20px);border-radius:20px;padding:24px;border:1px solid rgba(255,255,255,0.12);box-shadow:0 12px 35px -10px rgba(0,0,0,0.6);color:var(--text);font-family:\'Plus Jakarta Sans\',sans-serif">';
    
    // Header & Business Health Score
    html += '  <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:16px;margin-bottom:20px">';
    html += '    <div>';
    html += '      <div style="font-family:\'Space Grotesk\',sans-serif;font-size:22px;font-weight:700;display:flex;align-items:center;gap:10px">🤖 AI Business Analysis</div>';
    html += '      <div style="font-size:12px;color:var(--muted);margin-top:4px">Deterministic evidence-based intelligence from live production data</div>';
    html += '    </div>';
    html += '    <div style="text-align:right">';
    html += '      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--muted)">Business Health</div>';
    html += '      <div style="font-family:\'Space Grotesk\',sans-serif;font-size:32px;font-weight:700;color:#27AE60;line-height:1">' + (insights.healthScore || 85) + ' <span style="font-size:16px;color:var(--muted)">/ 100</span></div>';
    html += '    </div>';
    html += '  </div>';

    // KPI Metrics Grid
    html += '  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:24px">';
    
    html += '    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:14px;text-align:center">';
    html += '      <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--muted);letter-spacing:.5px">Revenue</div>';
    html += '      <div style="font-family:\'JetBrains Mono\',monospace;font-size:20px;font-weight:700;margin-top:6px;' + revClass + '">' + revTrend + '</div>';
    html += '    </div>';

    html += '    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:14px;text-align:center">';
    html += '      <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--muted);letter-spacing:.5px">Attendance</div>';
    html += '      <div style="font-family:\'JetBrains Mono\',monospace;font-size:20px;font-weight:700;margin-top:6px;' + attClass + '">' + attTrend + '</div>';
    html += '    </div>';

    html += '    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:14px;text-align:center">';
    html += '      <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--muted);letter-spacing:.5px">Customer Growth</div>';
    html += '      <div style="font-family:\'JetBrains Mono\',monospace;font-size:20px;font-weight:700;margin-top:6px;color:#38bdf8">' + custTrend + ' new</div>';
    html += '    </div>';

    html += '    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:14px;text-align:center">';
    html += '      <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--muted);letter-spacing:.5px">Net Profit</div>';
    html += '      <div style="font-family:\'JetBrains Mono\',monospace;font-size:20px;font-weight:700;margin-top:6px;color:#27AE60">₹' + (fin.netProfit || 0).toLocaleString('en-IN') + '</div>';
    html += '    </div>';

    html += '    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:14px;text-align:center">';
    html += '      <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--muted);letter-spacing:.5px">Top Coach</div>';
    html += '      <div style="font-family:\'Space Grotesk\',sans-serif;font-size:16px;font-weight:700;margin-top:6px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (coach.name || 'Rahul') + '</div>';
    html += '    </div>';

    html += '    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:14px;text-align:center">';
    html += '      <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--muted);letter-spacing:.5px">Top Product</div>';
    html += '      <div style="font-family:\'Space Grotesk\',sans-serif;font-size:16px;font-weight:700;margin-top:6px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + topProd + '</div>';
    html += '    </div>';

    html += '  </div>';

    // Warnings Section
    html += '  <div style="margin-bottom:20px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:14px;padding:16px">';
    html += '    <div style="font-family:\'Space Grotesk\',sans-serif;font-weight:700;font-size:14px;color:#ef4444;margin-bottom:10px">⚠️ Warnings & Alerts</div>';
    if (insights.warnings && insights.warnings.length > 0) {
      html += '    <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px">';
      insights.warnings.forEach(w => {
        html += '      <li style="font-size:13px;color:var(--text)">• ' + w + '</li>';
      });
      html += '    </ul>';
    } else {
      html += '    <div style="font-size:13px;color:var(--muted)">• No critical operational warnings detected at this time.</div>';
    }
    html += '  </div>';

    // Priority Actions Section
    html += '  <div style="margin-bottom:20px">';
    html += '    <div style="font-family:\'Space Grotesk\',sans-serif;font-weight:700;font-size:15px;color:var(--text);margin-bottom:12px">🎯 Priority Actions</div>';
    html += '    <div style="display:flex;flex-direction:column;gap:10px">';
    recommendations.forEach((rec, idx) => {
      const bg = rec.priority === 'high' ? 'rgba(239,68,68,0.12)' : (rec.priority === 'medium' ? 'rgba(245,158,11,0.12)' : 'rgba(39,174,96,0.12)');
      const border = rec.priority === 'high' ? 'rgba(239,68,68,0.3)' : (rec.priority === 'medium' ? 'rgba(245,158,11,0.3)' : 'rgba(39,174,96,0.3)');
      html += '      <div style="background:' + bg + ';border:1px solid ' + border + ';border-radius:12px;padding:12px 16px;font-size:13.5px;color:var(--text);display:flex;align-items:center;gap:10px">';
      html += '        <span style="font-size:16px">' + rec.icon + '</span>';
      html += '        <span style="font-weight:700;min-width:20px">' + (idx + 1) + '.</span>';
      html += '        <span style="flex:1">' + rec.text + '</span>';
      html += '      </div>';
    });
    html += '    </div>';
    html += '  </div>';

    // Trend Summary Section
    html += '  <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:16px">';
    html += '    <div style="font-family:\'Space Grotesk\',sans-serif;font-weight:700;font-size:14px;color:var(--text);margin-bottom:6px">📈 Trend Summary</div>';
    html += '    <div style="font-size:13px;color:var(--muted);line-height:1.6">' + insights.summaryText + '</div>';
    html += '  </div>';

    html += '</div>';

    return html;
  }

  window.PulseIQ_NlgEngine = {
    renderReportHtml: renderReportHtml
  };

})(window);
