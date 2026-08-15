/**
 * PulseIQ Phase 3.5 — Audit Logs, Monitoring & Observability
 * Monitoring Renderer & UI Manager
 * 
 * Renders System Health Dashboard, Module Status Grid, Performance Telemetry & Audit Log Timeline.
 */

(function(window) {
  'use strict';

  function renderMonitoringDashboard(containerId) {
    if (typeof document === 'undefined') return;

    const el = document.getElementById(containerId || 'sec-monitoring-dashboard');
    if (!el) return;

    const health = window.PulseIQ_MonitoringHealthMonitor ? window.PulseIQ_MonitoringHealthMonitor.checkSystemHealth() : { overallStatus: 'HEALTHY 🟢', modules: [] };
    const metrics = window.PulseIQ_MonitoringMetricsEngine ? window.PulseIQ_MonitoringMetricsEngine.collectPerformanceMetrics() : {};
    const timeline = window.PulseIQ_MonitoringAuditEngine ? window.PulseIQ_MonitoringAuditEngine.getUnifiedAuditTimeline() : [];

    let html = '';
    html += '<div class="tcard" style="padding:24px;background:rgba(24,24,27,0.85);backdrop-filter:blur(16px);border:1.5px solid rgba(56,189,248,0.3);margin-bottom:24px">';
    html += '  <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;margin-bottom:16px">';
    html += '    <div>';
    html += '      <div style="font-size:12px;font-weight:700;color:#38bdf8;text-transform:uppercase;letter-spacing:1px">📊 Enterprise Observability & System Monitoring</div>';
    html += '      <div style="font-family:\'Space Grotesk\',sans-serif;font-size:24px;font-weight:800;color:var(--text);margin-top:2px">System Operational Status: <span style="color:#27AE60">' + health.overallStatus + '</span></div>';
    html += '    </div>';
    html += '    <div style="display:flex;gap:12px">';
    html += '      <span style="font-size:12.5px;color:var(--muted)">Latency: <strong style="color:#38bdf8">' + metrics.executionLatencyMs + 'ms</strong></span>';
    html += '      <span style="font-size:12.5px;color:var(--muted)">Heap: <strong style="color:#a78bfa">' + metrics.memoryUsageMB + ' MB</strong></span>';
    html += '    </div>';
    html += '  </div>';

    // Module Health Grid
    html += '  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:16px">';
    if (health.modules) {
      health.modules.forEach(m => {
        html += '    <div style="padding:10px 14px;border-radius:8px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:space-between">';
        html += '      <div>';
        html += '        <div style="font-weight:700;font-size:12.5px;color:var(--text)">' + m.name + '</div>';
        html += '        <div style="font-size:10.5px;color:var(--muted)">v' + m.version + '</div>';
        html += '      </div>';
        html += '      <span style="font-size:11px;font-weight:800;color:' + (m.isAvailable ? '#27AE60' : '#ef4444') + '">' + (m.isAvailable ? 'ACTIVE 🟢' : 'OFFLINE 🔴') + '</span>';
        html += '    </div>';
      });
    }
    html += '  </div>';
    html += '</div>';

    // Audit Timeline
    html += '<div class="tcard" style="padding:22px;background:rgba(24,24,27,0.85);backdrop-filter:blur(16px);border:1px solid var(--border)">';
    html += '  <div style="font-family:\'Space Grotesk\',sans-serif;font-size:18px;font-weight:800;color:var(--text);margin-bottom:14px">📜 Unified Audit & System Event Timeline</div>';
    if (timeline.length > 0) {
      timeline.slice(0, 10).forEach(t => {
        html += '  <div style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:12.5px;display:flex;align-items:center;justify-content:space-between">';
        html += '    <div>';
        html += '      <div style="font-weight:700;color:var(--text)">[' + t.source + '] ' + t.message + '</div>';
        html += '      <div style="color:var(--muted);font-size:11px">Actor: ' + t.actor + ' (' + t.role + ') | Time: ' + new Date(t.timestamp).toLocaleTimeString() + '</div>';
        html += '    </div>';
        html += '    <span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:6px;background:' + (t.severity === 'warning' ? 'rgba(245,158,11,0.15)' : 'rgba(56,189,248,0.15)') + ';color:' + (t.severity === 'warning' ? '#f59e0b' : '#38bdf8') + '">' + t.type + '</span>';
        html += '  </div>';
      });
    } else {
      html += '  <div style="font-size:12.5px;color:var(--muted)">No system events recorded.</div>';
    }
    html += '</div>';

    el.innerHTML = html;
  }

  window.PulseIQ_MonitoringRenderer = {
    renderMonitoringDashboard: renderMonitoringDashboard
  };

})(typeof window !== 'undefined' ? window : global);
