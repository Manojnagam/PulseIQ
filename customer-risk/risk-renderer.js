/**
 * PulseIQ Phase 2.3 — Customer Risk Prediction
 * Risk Renderer & UI Manager
 * 
 * Renders Customer Risk Cards, Filter Bars, Search Inputs, Sort Controls,
 * KPI summary counters, and transparent score breakdowns.
 */

(function(window) {
  'use strict';

  let currentProfiles = [];
  let riskLevelFilter = '';
  let searchQuery = '';
  let sortBy = 'score_desc';
  const expandedCustomerIds = new Set();

  function renderRiskCard(profile) {
    const isExpanded = expandedCustomerIds.has(profile.customerId);

    const badgeColor = profile.riskLevel === 'HIGH' ? '#ef4444' : (profile.riskLevel === 'MEDIUM' ? '#f59e0b' : '#27AE60');
    const badgeBg = profile.riskLevel === 'HIGH' ? 'rgba(239,68,68,0.12)' : (profile.riskLevel === 'MEDIUM' ? 'rgba(245,158,11,0.12)' : 'rgba(39,174,96,0.12)');
    const badgeBorder = profile.riskLevel === 'HIGH' ? 'rgba(239,68,68,0.3)' : (profile.riskLevel === 'MEDIUM' ? 'rgba(245,158,11,0.3)' : 'rgba(39,174,96,0.3)');

    let html = '';
    html += '<div class="tcard" id="risk-card-' + profile.customerId + '" style="margin-bottom:16px;padding:20px 24px;background:rgba(24,24,27,0.75);backdrop-filter:blur(16px);border:1px solid ' + badgeBorder + ';border-left:5px solid ' + badgeColor + ';transition:all .22s cubic-bezier(0.4, 0, 0.2, 1)">';

    // Header Row: Customer Name, Risk Badge, Score, Actions
    html += '  <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">';
    html += '    <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:240px">';
    html += '      <div style="width:44px;height:44px;border-radius:14px;background:linear-gradient(135deg, ' + badgeColor + ' 0%, rgba(24,24,27,0.8) 100%);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:18px;box-shadow:0 4px 12px rgba(0,0,0,0.3)">👤</div>';
    html += '      <div>';
    html += '        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">';
    html += '          <span style="font-family:\'Space Grotesk\',sans-serif;font-weight:700;font-size:16px;color:var(--text)">' + profile.customerName + '</span>';
    html += '          <span style="padding:3px 10px;border-radius:14px;font-size:11px;font-weight:700;background:' + badgeBg + ';color:' + badgeColor + ';border:1px solid ' + badgeBorder + '">' + profile.riskLevel + ' (' + profile.riskScore + ' / 100)</span>';
    html += '        </div>';
    html += '        <div style="font-size:12.5px;color:var(--muted);margin-top:3px">Coach: <strong style="color:var(--text)">' + profile.coachName + '</strong> | Pack: <strong style="color:var(--text)">' + profile.packType + '</strong></div>';
    html += '      </div>';
    html += '    </div>';

    // Action Buttons: Call & WhatsApp
    html += '    <div style="display:flex;align-items:center;gap:8px">';
    if (profile.mobile && profile.mobile !== 'N/A') {
      const cleanPhone = profile.mobile.replace(/[^0-9]/g, '');
      html += '      <a href="tel:' + cleanPhone + '" style="padding:7px 14px;border-radius:10px;background:rgba(37,99,235,0.15);color:#2563EB;border:1px solid rgba(37,99,235,0.3);text-decoration:none;font-size:12.5px;font-weight:600;display:inline-flex;align-items:center;gap:5px">📞 Call</a>';
      html += '      <a href="https://wa.me/' + cleanPhone + '?text=Hi%20' + encodeURIComponent(profile.customerName) + '%2C%20we%20miss%20you%20at%20PulseZen%20Wellness%20Center!%20How%20is%20your%20routine%20going%3F" target="_blank" rel="noopener" style="padding:7px 14px;border-radius:10px;background:rgba(37,211,102,0.15);color:#25D366;border:1px solid rgba(37,211,102,0.3);text-decoration:none;font-size:12.5px;font-weight:600;display:inline-flex;align-items:center;gap:5px">💬 WhatsApp</a>';
    }
    html += '      <button onclick="PulseIQ_CustomerRisk.toggleExpand(' + profile.customerId + ')" style="padding:7px 12px;border-radius:10px;background:rgba(255,255,255,0.06);color:var(--muted);border:1px solid rgba(255,255,255,0.1);font-size:12px;cursor:pointer;font-family:inherit;font-weight:600">' + (isExpanded ? 'Hide Breakdown ▲' : 'View Risk Breakdown ▼') + '</button>';
    html += '    </div>';
    html += '  </div>';

    // Operational Metrics Grid
    html += '  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-top:14px;margin-bottom:12px">';
    html += '    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:10px 12px">';
    html += '      <div style="font-size:10.5px;font-weight:700;color:var(--muted);text-transform:uppercase">📅 Attendance</div>';
    html += '      <div style="font-size:13px;font-weight:700;color:var(--text);margin-top:2px">' + (profile.daysAbsent === 'N/A' ? 'No Check-ins' : profile.daysAbsent + ' Days Absent') + '</div>';
    html += '    </div>';

    html += '    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:10px 12px">';
    html += '      <div style="font-size:10.5px;font-weight:700;color:var(--muted);text-transform:uppercase">⏳ Membership Expiry</div>';
    html += '      <div style="font-size:13px;font-weight:700;color:var(--text);margin-top:2px">' + (profile.daysRemaining === 'N/A' ? 'N/A' : (profile.daysRemaining <= 0 ? 'Expired' : profile.daysRemaining + ' Days Left')) + '</div>';
    html += '    </div>';

    html += '    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:10px 12px">';
    html += '      <div style="font-size:10.5px;font-weight:700;color:var(--muted);text-transform:uppercase">⚖️ Last Body Scan</div>';
    html += '      <div style="font-size:13px;font-weight:700;color:var(--text);margin-top:2px">' + (profile.daysSinceScan === 'N/A' ? 'Never Scanned' : profile.daysSinceScan + ' Days Ago') + '</div>';
    html += '    </div>';
    html += '  </div>';

    // Suggested Action Box
    html += '  <div style="padding:12px 16px;background:rgba(39,174,96,0.08);border:1px solid rgba(39,174,96,0.2);border-radius:12px;font-size:13px;color:var(--text);line-height:1.5">';
    html += '    <strong style="color:#27AE60">🎯 Retention Directive:</strong> ' + profile.suggestedAction;
    html += '  </div>';

    // Transparent Score Breakdown (Expanded View)
    if (isExpanded) {
      html += '  <div style="margin-top:14px;padding:14px 18px;background:rgba(9,9,11,0.65);border-radius:12px;border:1px solid rgba(255,255,255,0.12)">';
      html += '    <div style="font-family:\'Space Grotesk\',sans-serif;font-weight:700;font-size:13.5px;color:var(--text);margin-bottom:10px">🔍 Transparent Risk Score Breakdown (Total: ' + profile.riskScore + ' / 100):</div>';
      html += '    <div style="display:flex;flex-direction:column;gap:6px">';
      profile.breakdown.forEach(item => {
        const itemColor = item.pts > 0 ? '#ef4444' : '#27AE60';
        html += '      <div style="display:flex;align-items:center;justify-content:space-between;font-size:12.5px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05)">';
        html += '        <span>• <strong>' + item.factor + ':</strong> ' + item.reason + '</span>';
        html += '        <span style="font-family:\'JetBrains Mono\',monospace;font-weight:700;color:' + itemColor + '">+' + item.pts + ' pts</span>';
        html += '      </div>';
      });
      html += '    </div>';
      html += '  </div>';
    }

    html += '</div>';
    return html;
  }

  function renderDashboard(profiles) {
    currentProfiles = profiles || [];

    if (typeof document === 'undefined') return;

    const feedEl = document.getElementById('risk-profiles-feed');
    const statsEl = document.getElementById('risk-dashboard-stats');

    // Filter Profiles
    let filtered = currentProfiles.filter(profile => {
      if (riskLevelFilter && profile.riskLevel !== riskLevelFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const nameMatch = (profile.customerName || '').toLowerCase().includes(q);
        const mobileMatch = (profile.mobile || '').includes(q);
        const coachMatch = (profile.coachName || '').toLowerCase().includes(q);
        if (!nameMatch && !mobileMatch && !coachMatch) return false;
      }
      return true;
    });

    // Sort Profiles
    if (sortBy === 'score_desc') {
      filtered.sort((a, b) => b.riskScore - a.riskScore);
    } else if (sortBy === 'score_asc') {
      filtered.sort((a, b) => a.riskScore - b.riskScore);
    } else if (sortBy === 'absent_desc') {
      filtered.sort((a, b) => (b.daysAbsent === 'N/A' ? 0 : b.daysAbsent) - (a.daysAbsent === 'N/A' ? 0 : a.daysAbsent));
    } else if (sortBy === 'name') {
      filtered.sort((a, b) => a.customerName.localeCompare(b.customerName));
    }

    // Render Stats Bar
    if (statsEl) {
      const highRiskCount = currentProfiles.filter(p => p.riskLevel === 'HIGH').length;
      const medRiskCount = currentProfiles.filter(p => p.riskLevel === 'MEDIUM').length;
      const lowRiskCount = currentProfiles.filter(p => p.riskLevel === 'LOW').length;

      statsEl.innerHTML = `
        <div class="stat" style="border-top:3px solid #ef4444">
          <div class="stat-l">High Churn Risk 🔴</div>
          <div class="stat-v" style="color:#ef4444">${highRiskCount}</div>
        </div>
        <div class="stat" style="border-top:3px solid #f59e0b">
          <div class="stat-l">Medium Risk 🟡</div>
          <div class="stat-v" style="color:#f59e0b">${medRiskCount}</div>
        </div>
        <div class="stat" style="border-top:3px solid #27AE60">
          <div class="stat-l">Low Risk 🟢</div>
          <div class="stat-v" style="color:#27AE60">${lowRiskCount}</div>
        </div>
        <div class="stat" style="border-top:3px solid #38bdf8">
          <div class="stat-l">Total Evaluated</div>
          <div class="stat-v" style="color:#38bdf8">${currentProfiles.length}</div>
        </div>
      `;
    }

    // Render Feed
    if (!feedEl) return;

    if (filtered.length === 0) {
      feedEl.innerHTML = `
        <div class="tcard" style="padding:48px 20px;text-align:center;color:var(--muted)">
          <div style="font-size:44px;margin-bottom:12px">🎯</div>
          <div style="font-family:'Space Grotesk',sans-serif;font-size:18px;font-weight:700;color:var(--text);margin-bottom:6px">No Customer Risk Profiles Match Filters</div>
          <div style="font-size:13.5px">All evaluated customers are engaged or outside the selected risk criteria.</div>
        </div>
      `;
      return;
    }

    feedEl.innerHTML = filtered.map(renderRiskCard).join('');
  }

  window.PulseIQ_RiskRenderer = {
    renderDashboard: renderDashboard,
    setRiskLevelFilter: function(val) { riskLevelFilter = val; },
    setSearchQuery: function(val) { searchQuery = val; },
    setSortBy: function(val) { sortBy = val; },
    toggleExpand: function(customerId) {
      if (expandedCustomerIds.has(customerId)) expandedCustomerIds.delete(customerId);
      else expandedCustomerIds.add(customerId);
    }
  };

})(typeof window !== 'undefined' ? window : global);
