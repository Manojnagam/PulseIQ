/**
 * PulseIQ Phase 3.2 — Multi-Location & Organisation Management
 * Organisation Renderer & UI Manager
 * 
 * Renders Wellness Centre Context Switcher dropdown & Cross-Centre KPI Comparison Table.
 */

(function(window) {
  'use strict';

  function renderContextSwitcher(containerId) {
    if (typeof document === 'undefined') return;

    const el = document.getElementById(containerId || 'location-context-switcher');
    if (!el) return;

    const ctx = window.PulseIQ_ContextManager ? window.PulseIQ_ContextManager.getActiveContext() : null;
    const centres = window.PulseIQ_LocationEngine ? window.PulseIQ_LocationEngine.getAllCentres() : [];

    let html = '';
    html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 12px;border-radius:10px;background:rgba(24,24,27,0.8);border:1px solid rgba(56,189,248,0.3);font-size:12.5px">';
    html += '  <span style="color:#38bdf8;font-weight:700">🏢 Active Centre:</span>';
    html += '  <select onchange="PulseIQ_ContextManager.switchCentre(this.value)" style="background:transparent;color:var(--text);border:none;font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer;outline:none">';

    centres.forEach(c => {
      const selected = (ctx && ctx.centre.id === c.id) ? 'selected' : '';
      html += '    <option value="' + c.id + '" ' + selected + ' style="background:#18181b;color:#fff">' + c.name + ' (' + c.city + ')</option>';
    });

    html += '  </select>';
    html += '</div>';

    el.innerHTML = html;
  }

  function renderCrossCentreComparison(containerId) {
    if (typeof document === 'undefined') return;

    const el = document.getElementById(containerId || 'cross-centre-comparison');
    if (!el) return;

    const centres = window.PulseIQ_LocationEngine ? window.PulseIQ_LocationEngine.getAllCentres() : [];

    let html = '';
    html += '<div class="tcard" style="padding:22px;margin-top:20px;background:rgba(24,24,27,0.85);backdrop-filter:blur(16px);border:1px solid var(--border)">';
    html += '  <div style="font-family:\'Space Grotesk\',sans-serif;font-size:18px;font-weight:800;color:var(--text);margin-bottom:14px">🏢 Multi-Centre Performance & Cross-Location Comparison</div>';
    html += '  <div style="overflow-x:auto">';
    html += '    <table style="width:100%;border-collapse:collapse;font-size:13px;text-align:left">';
    html += '      <thead>';
    html += '        <tr style="border-bottom:1.5px solid var(--border);color:var(--muted)">';
    html += '          <th style="padding:10px">Centre Name</th>';
    html += '          <th style="padding:10px">City</th>';
    html += '          <th style="padding:10px">Active Members</th>';
    html += '          <th style="padding:10px">Monthly Revenue</th>';
    html += '          <th style="padding:10px">Attendance %</th>';
    html += '          <th style="padding:10px">Top Coach</th>';
    html += '          <th style="padding:10px">Status</th>';
    html += '        </tr>';
    html += '      </thead>';
    html += '      <tbody>';

    centres.forEach((c, i) => {
      const mockMembers = 25 + (i * 12);
      const mockRev = 295000 + (i * 45000);
      const mockAtt = 86 + (i * 2);
      const coaches = ['Rahul Sharma', 'Priya Kapur', 'Karan Patel', 'Sarah Jenkins'];

      html += '        <tr style="border-bottom:1px solid rgba(255,255,255,0.05)">';
      html += '          <td style="padding:10px;font-weight:700;color:var(--text)">' + c.name + '</td>';
      html += '          <td style="padding:10px;color:var(--muted)">' + c.city + '</td>';
      html += '          <td style="padding:10px;font-weight:700;color:#38bdf8">' + mockMembers + ' members</td>';
      html += '          <td style="padding:10px;font-weight:700;color:#27AE60">₹' + mockRev.toLocaleString('en-IN') + '</td>';
      html += '          <td style="padding:10px">' + mockAtt + '%</td>';
      html += '          <td style="padding:10px;color:var(--text)">' + coaches[i % coaches.length] + '</td>';
      html += '          <td style="padding:10px"><span style="padding:2px 8px;border-radius:10px;background:rgba(39,174,96,0.15);color:#27AE60;font-size:11px;font-weight:700">Active 🟢</span></td>';
      html += '        </tr>';
    });

    html += '      </tbody>';
    html += '    </table>';
    html += '  </div>';
    html += '</div>';

    el.innerHTML = html;
  }

  window.PulseIQ_OrganisationRenderer = {
    renderContextSwitcher: renderContextSwitcher,
    renderCrossCentreComparison: renderCrossCentreComparison
  };

})(typeof window !== 'undefined' ? window : global);
