/**
 * PulseIQ Phase 3.4 — Reporting, Export & Document Generation
 * Report Template Engine
 * 
 * Formats report structures into clean, printable HTML layouts.
 */

(function(window) {
  'use strict';

  function renderReportHTML(reportData) {
    if (!reportData) return '';

    let html = '';
    html += '<!DOCTYPE html><html><head><meta charset="utf-8">';
    html += '<title>' + (reportData.title || 'PulseIQ Business Report') + '</title>';
    html += '<style>';
    html += 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fff; color: #1e293b; padding: 30px; margin: 0; }';
    html += '.header { border-bottom: 2px solid #0284c7; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end; }';
    html += '.title { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0; }';
    html += '.meta { font-size: 12px; color: #64748b; margin-top: 5px; }';
    html += '.section-title { font-size: 16px; font-weight: 700; color: #0284c7; margin-top: 25px; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }';
    html += 'table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }';
    html += 'th, td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: left; }';
    html += 'th { background: #f8fafc; color: #475569; font-weight: 700; }';
    html += '.footer { margin-top: 40px; padding-top: 15px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }';
    html += '</style></head><body>';

    html += '<div class="header">';
    html += '  <div>';
    html += '    <h1 class="title">🌿 PulseIQ — ' + (reportData.title || 'Business Report') + '</h1>';
    html += '    <div class="meta">Organisation: ' + (reportData.organisationName || 'PulseZen') + ' | Centre: ' + (reportData.centreName || 'Main Branch') + '</div>';
    html += '  </div>';
    html += '  <div style="text-align:right" class="meta">Generated: ' + new Date(reportData.generatedAt).toLocaleString('en-IN') + '</div>';
    html += '</div>';

    if (reportData.statements && reportData.statements.length > 0) {
      html += '<div class="section-title">📌 Executive Overview Briefing</div><ul>';
      reportData.statements.forEach(s => { html += '<li style="margin-bottom:6px;font-size:13px">' + s + '</li>'; });
      html += '</ul>';
    }

    if (reportData.kpis && reportData.kpis.length > 0) {
      html += '<div class="section-title">🎯 KPI Target Achievements</div><table><thead><tr><th>KPI Name</th><th>Actual</th><th>Target</th><th>Achievement %</th><th>Status</th></tr></thead><tbody>';
      reportData.kpis.forEach(k => {
        html += '<tr><td><strong>' + k.name + '</strong></td><td>' + k.formattedActual + '</td><td>' + k.formattedTarget + '</td><td>' + k.achievementPct + '%</td><td>' + k.status + '</td></tr>';
      });
      html += '</tbody></table>';
    }

    if (reportData.coachesList && reportData.coachesList.length > 0) {
      html += '<div class="section-title">🏆 Coach Roster & Leaderboard</div><table><thead><tr><th>Coach Name</th><th>Title</th><th>Retention %</th><th>Score</th></tr></thead><tbody>';
      reportData.coachesList.forEach(c => {
        html += '<tr><td><strong>' + c.coachName + '</strong></td><td>' + c.pin + '</td><td>' + c.retentionRatePct + '%</td><td>' + c.coachScore + ' pts</td></tr>';
      });
      html += '</tbody></table>';
    }

    html += '<div class="footer">PulseIQ Enterprise Business Intelligence System — Confidentially Generated</div>';
    html += '</body></html>';

    return html;
  }

  window.PulseIQ_ReportTemplateEngine = {
    renderReportHTML: renderReportHTML
  };

})(typeof window !== 'undefined' ? window : global);
