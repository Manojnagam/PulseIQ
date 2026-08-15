/**
 * PulseIQ Phase 3.4 — Reporting, Export & Document Generation
 * Report Renderer & UI Manager
 * 
 * Renders Report Generation Hub UI, Export Action Buttons, and Schedule Overview.
 */

(function(window) {
  'use strict';

  function renderReportHub(containerId) {
    if (typeof document === 'undefined') return;

    const el = document.getElementById(containerId || 'sec-reports-hub');
    if (!el) return;

    const ctx = window.PulseIQ_ContextManager ? window.PulseIQ_ContextManager.getActiveContext() : null;

    let html = '';
    html += '<div class="tcard" style="padding:24px;background:rgba(24,24,27,0.85);backdrop-filter:blur(16px);border:1.5px solid rgba(56,189,248,0.3);margin-bottom:24px">';
    html += '  <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;margin-bottom:16px">';
    html += '    <div>';
    html += '      <div style="font-size:12px;font-weight:700;color:#38bdf8;text-transform:uppercase;letter-spacing:1px">📄 Enterprise Document & Reporting Hub</div>';
    html += '      <div style="font-family:\'Space Grotesk\',sans-serif;font-size:22px;font-weight:800;color:var(--text);margin-top:2px">Generate & Export Business Intelligence Reports</div>';
    html += '    </div>';
    html += '    <div style="display:flex;gap:8px;flex-wrap:wrap">';
    html += '      <button onclick="PulseIQ_Reporting.generateAndExport(\'EXECUTIVE_SUMMARY\', \'csv\')" class="btn-p" style="padding:8px 14px;font-size:12px;background:#27AE60">📥 Export CSV</button>';
    html += '      <button onclick="PulseIQ_Reporting.generateAndExport(\'EXECUTIVE_SUMMARY\', \'pdf\')" class="btn-p" style="padding:8px 14px;font-size:12px;background:#38bdf8;color:#000">📄 Print PDF</button>';
    html += '      <button onclick="PulseIQ_Reporting.generateAndExport(\'EXECUTIVE_SUMMARY\', \'excel\')" class="btn-p" style="padding:8px 14px;font-size:12px;background:#a78bfa">📊 Excel XLSX</button>';
    html += '    </div>';
    html += '  </div>';

    html += '  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.08)">';
    const reportTypes = [
      { id: 'EXECUTIVE_SUMMARY', name: 'Executive Summary', icon: '👑' },
      { id: 'REVENUE', name: 'Revenue & Finance', icon: '💰' },
      { id: 'CUSTOMER', name: 'Customer Directory', icon: '👤' },
      { id: 'COACH_PERFORMANCE', name: 'Coach Performance', icon: '🏆' },
      { id: 'ATTENDANCE', name: 'Member Attendance', icon: '📅' },
      { id: 'RISK', name: 'Retention Risk', icon: '🎯' },
      { id: 'GOAL_PROGRESS', name: 'Goal Targets Progress', icon: '🎯' },
      { id: 'FORECAST', name: 'Predictive Trends', icon: '📈' }
    ];

    reportTypes.forEach(rt => {
      html += '  <div style="padding:12px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:space-between">';
      html += '    <div>';
      html += '      <div style="font-weight:700;font-size:13px;color:var(--text)">' + rt.icon + ' ' + rt.name + '</div>';
      html += '      <div style="font-size:11px;color:var(--muted);margin-top:2px">On-Demand PDF/CSV</div>';
      html += '    </div>';
      html += '    <button onclick="PulseIQ_Reporting.generateAndExport(\'' + rt.id + '\', \'pdf\')" style="padding:4px 8px;border-radius:6px;background:rgba(56,189,248,0.15);color:#38bdf8;border:1px solid rgba(56,189,248,0.3);font-size:11px;font-weight:700;cursor:pointer">Export ↗</button>';
      html += '  </div>';
    });

    html += '  </div>';
    html += '</div>';

    el.innerHTML = html;
  }

  window.PulseIQ_ReportRenderer = {
    renderReportHub: renderReportHub
  };

})(typeof window !== 'undefined' ? window : global);
