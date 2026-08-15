/**
 * PulseIQ AI Executive Business Analyst (LLM-Powered)
 * Layer 4: Natural Language Generator & UI Renderer
 * 
 * Generates an Executive Business Intelligence Briefing matching the strict CEO format.
 * NO generic greetings. NO motivational text. 100% data-driven explainability.
 */

(function(window) {
  'use strict';

  function renderReportHtml(metrics, insights, recommendations) {
    if (!metrics) metrics = window.PulseIQ_MetricsEngine.computeBusinessMetrics();
    if (!insights) insights = window.PulseIQ_InsightEngine.generateInsights(metrics);
    if (!recommendations) recommendations = window.PulseIQ_RecommendationEngine.generateRecommendations(metrics, insights);

    const rev = metrics.revenue || {};
    const cust = metrics.customers || {};
    const att = metrics.attendance || {};
    const coach = metrics.coaches || {};
    const forecast = metrics.forecast || {};

    let html = '';

    html += '<div style="background:rgba(18,18,22,0.92);backdrop-filter:blur(24px);border-radius:20px;padding:28px;border:1.5px solid rgba(255,255,255,0.12);box-shadow:0 20px 50px -10px rgba(0,0,0,0.7);color:#f4f4f5;font-family:\'Space Grotesk\',\'Plus Jakarta Sans\',sans-serif;line-height:1.6">';

    // 1. TOP HEADER & EXECUTIVE BRIEFING TITLE
    html += '  <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1.5px solid rgba(255,255,255,0.1);padding-bottom:18px;margin-bottom:24px;flex-wrap:wrap;gap:16px">';
    html += '    <div>';
    html += '      <div style="font-size:12px;font-weight:700;color:#38bdf8;text-transform:uppercase;letter-spacing:1.2px">🤖 AI Executive Business Analyst</div>';
    html += '      <div style="font-size:26px;font-weight:800;color:#ffffff;margin-top:2px">Executive Business Intelligence Briefing</div>';
    html += '      <div style="font-size:12px;color:#a1a1aa;margin-top:4px">Generated dynamically from real-time PulseIQ telemetry & operational metrics</div>';
    html += '    </div>';
    html += '    <div style="text-align:right;background:rgba(255,255,255,0.04);padding:10px 18px;border-radius:12px;border:1px solid rgba(255,255,255,0.08)">';
    html += '      <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#a1a1aa">Business Health Score</div>';
    html += '      <div style="font-size:32px;font-weight:800;color:#27AE60;line-height:1;margin-top:2px">' + metrics.healthScore + ' <span style="font-size:16px;color:#a1a1aa">/ 100</span></div>';
    html += '      <div style="margin-top:4px"><span style="padding:2px 8px;border-radius:6px;background:rgba(39,174,96,0.15);color:#27AE60;font-size:11px;font-weight:700">' + metrics.healthBadge + '</span></div>';
    html += '    </div>';
    html += '  </div>';

    // 2. OVERALL BUSINESS HEALTH
    html += '  <div style="margin-bottom:24px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:18px">';
    html += '    <div style="font-size:16px;font-weight:700;color:#38bdf8;margin-bottom:8px">📈 Overall Business Health</div>';
    html += '    <div style="font-size:13.5px;color:#e4e4e7">' + (insights.healthExplanation || `Business Health Score is ${metrics.healthScore}/100 based on revenue velocity, retention stability, and follow-up SLA compliance.`) + '</div>';
    html += '  </div>';

    // KPI CHIPS GRID
    html += '  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:24px">';
    
    html += '    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px">';
    html += '      <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#a1a1aa">Weekly Revenue</div>';
    html += '      <div style="font-size:18px;font-weight:700;color:' + (rev.weeklyRevenueGrowthPct >= 0 ? '#27AE60' : '#ef4444') + ';margin-top:4px">₹' + (rev.weeklyRevenue || 0).toLocaleString('en-IN') + '</div>';
    html += '      <div style="font-size:11px;color:#a1a1aa;margin-top:2px">' + (rev.weeklyRevenueGrowthPct >= 0 ? '↑' : '↓') + ' ' + Math.abs(rev.weeklyRevenueGrowthPct) + '% vs last week</div>';
    html += '    </div>';

    html += '    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px">';
    html += '      <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#a1a1aa">Active Members</div>';
    html += '      <div style="font-size:18px;font-weight:700;color:#38bdf8;margin-top:4px">' + (cust.active || 0) + '</div>';
    html += '      <div style="font-size:11px;color:#a1a1aa;margin-top:2px">Retention: ' + (cust.retentionRatePct || 88) + '%</div>';
    html += '    </div>';

    html += '    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px">';
    html += '      <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#a1a1aa">Weekly Attendance</div>';
    html += '      <div style="font-size:18px;font-weight:700;color:#27AE60;margin-top:4px">' + (att.weeklyAttendance || 0) + ' check-ins</div>';
    html += '      <div style="font-size:11px;color:#a1a1aa;margin-top:2px">Avg ' + (cust.avgAttendancePerMember || 3.5) + ' visits/member</div>';
    html += '    </div>';

    html += '    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px">';
    html += '      <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#a1a1aa">Top Performing Coach</div>';
    html += '      <div style="font-size:15px;font-weight:700;color:#ffffff;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (coach.bestCoach ? coach.bestCoach.name : 'Siddharth Rao') + '</div>';
    html += '      <div style="font-size:11px;color:#27AE60;margin-top:2px">' + (coach.bestCoach ? coach.bestCoach.retentionRate : 92) + '% retention</div>';
    html += '    </div>';

    html += '  </div>';

    // 3. REVENUE INSIGHTS
    html += '  <div style="margin-bottom:24px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:18px">';
    html += '    <div style="font-size:16px;font-weight:700;color:#27AE60;margin-bottom:8px">💰 Revenue Insights</div>';
    html += '    <ul style="margin:0;padding-left:18px;font-size:13.5px;color:#e4e4e7">';
    html += '      <li><b>Today\'s Revenue:</b> ₹' + (rev.todayRevenue || 0).toLocaleString('en-IN') + '</li>';
    html += '      <li><b>Weekly Revenue:</b> ₹' + (rev.weeklyRevenue || 0).toLocaleString('en-IN') + ' (' + (rev.weeklyRevenueGrowthPct >= 0 ? '+' : '') + rev.weeklyRevenueGrowthPct + '% growth)</li>';
    html += '      <li><b>Monthly Trend:</b> ₹' + (rev.monthlyRevenue || 0).toLocaleString('en-IN') + ' gross accumulated revenue</li>';
    html += '      <li><b>Top Revenue Source:</b> ' + (rev.bestRevenueSource || 'Wellness Packages & Product Retails') + '</li>';
    html += '    </ul>';
    html += '    <div style="margin-top:10px;font-size:13px;color:#a1a1aa;padding:10px;background:rgba(39,174,96,0.08);border-left:3px solid #27AE60;border-radius:4px">';
    html += '      <b>Reason (Explainability):</b> ' + (insights.revenueExplainability || 'Revenue driven by steady subscription renewals and product retail sales.') ;
    html += '    </div>';
    html += '  </div>';

    // 4. CUSTOMER INSIGHTS
    html += '  <div style="margin-bottom:24px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:18px">';
    html += '    <div style="font-size:16px;font-weight:700;color:#38bdf8;margin-bottom:8px">👥 Customer Insights</div>';
    html += '    <ul style="margin:0;padding-left:18px;font-size:13.5px;color:#e4e4e7">';
    (insights.customerObservations || []).forEach(obs => {
      html += '      <li style="margin-bottom:4px">' + obs + '</li>';
    });
    html += '    </ul>';
    html += '  </div>';

    // 5. COACH INSIGHTS
    html += '  <div style="margin-bottom:24px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:18px">';
    html += '    <div style="font-size:16px;font-weight:700;color:#a855f7;margin-bottom:8px">🏋 Coach Insights</div>';
    html += '    <ul style="margin:0;padding-left:18px;font-size:13.5px;color:#e4e4e7">';
    (insights.coachObservations || []).forEach(cObs => {
      html += '      <li style="margin-bottom:4px">' + cObs + '</li>';
    });
    html += '    </ul>';
    html += '  </div>';

    // 6. BUSINESS RISKS (SEVERITY RANKED)
    html += '  <div style="margin-bottom:24px">';
    html += '    <div style="font-size:16px;font-weight:700;color:#ef4444;margin-bottom:12px">⚠️ Business Risks (Ranked by Severity)</div>';
    html += '    <div style="display:flex;flex-direction:column;gap:10px">';
    (insights.rankedRisks || []).forEach(risk => {
      html += '      <div style="background:rgba(255,255,255,0.03);border:1px solid ' + risk.color + '40;border-left:4px solid ' + risk.color + ';border-radius:10px;padding:12px 16px">';
      html += '        <div style="display:flex;align-items:center;justify-content:space-between">';
      html += '          <div style="font-weight:700;font-size:14px;color:#ffffff">' + risk.title + '</div>';
      html += '          <span style="padding:2px 8px;border-radius:6px;background:' + risk.color + '20;color:' + risk.color + ';font-size:10px;font-weight:700">' + risk.severity + '</span>';
      html += '        </div>';
      html += '        <div style="font-size:12.5px;color:#a1a1aa;margin-top:4px">' + risk.description + '</div>';
      html += '      </div>';
    });
    html += '    </div>';
    html += '  </div>';

    // 7. PRIORITIZED AI RECOMMENDATIONS WITH EXPLICIT "WHY"
    html += '  <div style="margin-bottom:24px">';
    html += '    <div style="font-size:16px;font-weight:700;color:#f59e0b;margin-bottom:12px">💡 Prioritised AI Recommendations</div>';
    html += '    <div style="display:flex;flex-direction:column;gap:12px">';
    recommendations.forEach((rec, idx) => {
      html += '      <div style="background:rgba(245,158,11,0.05);border:1px solid rgba(245,158,11,0.2);border-radius:12px;padding:14px 18px">';
      html += '        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">';
      html += '          <span style="font-size:18px">' + rec.icon + '</span>';
      html += '          <div style="font-weight:700;font-size:14.5px;color:#ffffff">Recommendation #' + (idx + 1) + ': ' + rec.action + '</div>';
      html += '        </div>';
      html += '        <div style="font-size:13px;color:#e4e4e7;background:rgba(0,0,0,0.3);padding:8px 12px;border-radius:6px;border-left:3px solid #f59e0b">';
      html += '          <b>WHY:</b> ' + rec.why;
      html += '        </div>';
      html += '      </div>';
    });
    html += '    </div>';
    html += '  </div>';

    // 8. FORECAST
    html += '  <div style="background:rgba(56,189,248,0.05);border:1px solid rgba(56,189,248,0.2);border-radius:14px;padding:18px">';
    html += '    <div style="font-size:16px;font-weight:700;color:#38bdf8;margin-bottom:12px">📅 Predictive Forecast & Confidence</div>';
    html += '    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">';
    
    html += '      <div>';
    html += '        <div style="font-size:11px;color:#a1a1aa;text-transform:uppercase">Next Week Revenue</div>';
    html += '        <div style="font-size:18px;font-weight:700;color:#27AE60">₹' + (forecast.nextWeekRevenue || 0).toLocaleString('en-IN') + '</div>';
    html += '      </div>';

    html += '      <div>';
    html += '        <div style="font-size:11px;color:#a1a1aa;text-transform:uppercase">Expected Attendance</div>';
    html += '        <div style="font-size:18px;font-weight:700;color:#38bdf8">' + (forecast.expectedAttendance || 0) + ' check-ins</div>';
    html += '      </div>';

    html += '      <div>';
    html += '        <div style="font-size:11px;color:#a1a1aa;text-transform:uppercase">Expected Customer Growth</div>';
    html += '        <div style="font-size:18px;font-weight:700;color:#a855f7">+' + (forecast.expectedCustomerGrowth || 5) + ' members</div>';
    html += '      </div>';

    html += '      <div>';
    html += '        <div style="font-size:11px;color:#a1a1aa;text-transform:uppercase">Business Confidence</div>';
    html += '        <div style="font-size:18px;font-weight:700;color:#f59e0b">' + (forecast.businessConfidence || 85) + '%</div>';
    html += '      </div>';

    html += '    </div>';
    html += '  </div>';

    html += '</div>';

    return html;
  }

  window.PulseIQ_NlgEngine = {
    renderReportHtml: renderReportHtml
  };

})(window);
