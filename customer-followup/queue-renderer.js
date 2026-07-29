/**
 * PulseIQ Phase 2.5 — Automated Customer Follow-ups
 * Queue Renderer & UI Manager
 * 
 * Renders Follow-up Queue Cards, Filter Bars, Search Inputs, KPI Counters,
 * Copy-to-Clipboard, Direct WhatsApp links, and Approval/Dismissal toggles.
 */

(function(window) {
  'use strict';

  let currentQueue = [];
  let priorityFilter = '';
  let categoryFilter = '';
  let approvalFilter = 'pending'; // Default: show pending approval items
  let searchQuery = '';

  const approvalStatusMap = {}; // taskId -> 'approved' | 'dismissed'

  function renderQueueCard(item) {
    const status = approvalStatusMap[item.id] || item.approvalStatus || 'pending';

    const pColor = item.priority === 'HIGH' ? '#ef4444' : (item.priority === 'MEDIUM' ? '#f59e0b' : '#27AE60');
    const pBg = item.priority === 'HIGH' ? 'rgba(239,68,68,0.12)' : (item.priority === 'MEDIUM' ? 'rgba(245,158,11,0.12)' : 'rgba(39,174,96,0.12)');
    const pBorder = item.priority === 'HIGH' ? 'rgba(239,68,68,0.3)' : (item.priority === 'MEDIUM' ? 'rgba(245,158,11,0.3)' : 'rgba(39,174,96,0.3)');

    const isApproved = status === 'approved';
    const isDismissed = status === 'dismissed';

    let html = '';
    html += '<div class="tcard" id="fu-card-' + item.id + '" style="margin-bottom:16px;padding:20px 24px;background:rgba(24,24,27,0.75);backdrop-filter:blur(16px);border:1px solid ' + (isApproved ? 'rgba(39,174,96,0.4)' : (isDismissed ? 'rgba(255,255,255,0.08)' : pBorder)) + ';border-left:5px solid ' + (isApproved ? '#27AE60' : (isDismissed ? 'var(--muted)' : pColor)) + ';opacity:' + (isDismissed ? '0.5' : '1') + ';transition:all .22s cubic-bezier(0.4, 0, 0.2, 1)">';

    // Header Row: Customer Name, Category, Priority, Approval Status Badge
    html += '  <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">';
    html += '    <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:240px">';
    html += '      <div style="width:44px;height:44px;border-radius:14px;background:rgba(37,211,102,0.15);border:1px solid rgba(37,211,102,0.3);display:flex;align-items:center;justify-content:center;color:#25D366;font-size:20px">📲</div>';
    html += '      <div>';
    html += '        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">';
    html += '          <span style="font-family:\'Space Grotesk\',sans-serif;font-weight:700;font-size:16px;color:var(--text)">' + item.customer.name + '</span>';
    html += '          <span style="padding:3px 10px;border-radius:14px;font-size:11px;font-weight:700;background:' + pBg + ';color:' + pColor + ';border:1px solid ' + pBorder + '">' + item.priority + '</span>';
    html += '          <span style="padding:3px 10px;border-radius:14px;font-size:11px;font-weight:600;background:rgba(255,255,255,0.06);color:var(--muted);border:1px solid rgba(255,255,255,0.1)">' + item.category + '</span>';
    if (isApproved) {
      html += '          <span style="padding:3px 10px;border-radius:14px;font-size:11px;font-weight:700;background:rgba(39,174,96,0.2);color:#27AE60;border:1px solid rgba(39,174,96,0.4)">✓ Approved</span>';
    } else if (isDismissed) {
      html += '          <span style="padding:3px 10px;border-radius:14px;font-size:11px;font-weight:700;background:rgba(255,255,255,0.1);color:var(--muted);border:1px solid rgba(255,255,255,0.15)">✕ Dismissed</span>';
    } else {
      html += '          <span style="padding:3px 10px;border-radius:14px;font-size:11px;font-weight:700;background:rgba(245,158,11,0.2);color:#f59e0b;border:1px solid rgba(245,158,11,0.4)">⏳ Pending Approval</span>';
    }
    html += '        </div>';
    html += '        <div style="font-size:12.5px;color:var(--muted);margin-top:3px">Coach: <strong style="color:var(--text)">' + item.customer.coachName + '</strong> | Channel: <strong style="color:#25D366">' + item.suggestedChannel + '</strong></div>';
    html += '      </div>';
    html += '    </div>';

    // Action Controls
    html += '    <div style="display:flex;align-items:center;gap:8px">';
    if (item.customer.mobile && item.customer.mobile !== 'N/A') {
      const cleanPhone = item.customer.mobile.replace(/[^0-9]/g, '');
      const encodedMsg = encodeURIComponent(item.suggestedMessage);
      html += '      <a href="https://wa.me/' + cleanPhone + '?text=' + encodedMsg + '" target="_blank" rel="noopener" onclick="PulseIQ_CustomerFollowup.markApproved(\'' + item.id + '\')" style="padding:7px 14px;border-radius:10px;background:rgba(37,211,102,0.15);color:#25D366;border:1px solid rgba(37,211,102,0.3);text-decoration:none;font-size:12.5px;font-weight:600;display:inline-flex;align-items:center;gap:5px">💬 WhatsApp</a>';
      html += '      <a href="tel:' + cleanPhone + '" style="padding:7px 12px;border-radius:10px;background:rgba(37,99,235,0.15);color:#2563EB;border:1px solid rgba(37,99,235,0.3);text-decoration:none;font-size:12.5px;font-weight:600;display:inline-flex;align-items:center;gap:5px">📞 Call</a>';
    }
    html += '      <button onclick="PulseIQ_CustomerFollowup.copyMessage(\'' + item.id + '\')" style="padding:7px 12px;border-radius:10px;background:rgba(255,255,255,0.06);color:var(--text);border:1px solid rgba(255,255,255,0.12);font-size:12px;cursor:pointer;font-family:inherit;font-weight:600">📋 Copy</button>';
    if (!isApproved) {
      html += '      <button onclick="PulseIQ_CustomerFollowup.markApproved(\'' + item.id + '\')" style="padding:7px 12px;border-radius:10px;background:rgba(39,174,96,0.15);color:#27AE60;border:1px solid rgba(39,174,96,0.3);font-size:12px;cursor:pointer;font-family:inherit;font-weight:700">✓ Approve</button>';
    }
    if (!isDismissed) {
      html += '      <button onclick="PulseIQ_CustomerFollowup.markDismissed(\'' + item.id + '\')" style="padding:7px 10px;border-radius:10px;background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.25);font-size:12px;cursor:pointer;font-family:inherit;font-weight:600">✕</button>';
    }
    html += '    </div>';
    html += '  </div>';

    // Reason Text
    html += '  <div style="margin-top:12px;font-size:13px;color:var(--muted)"><strong>Trigger Reason:</strong> ' + item.reason + '</div>';

    // Personalized Message Box
    html += '  <div style="margin-top:10px;padding:14px 18px;background:rgba(9,9,11,0.65);border-radius:12px;border:1px solid rgba(255,255,255,0.1);position:relative">';
    html += '    <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:6px;display:flex;justify-content:space-between">';
    html += '      <span>💬 Personalized Message Template</span>';
    html += '      <span style="color:#25D366">Human Approval Required</span>';
    html += '    </div>';
    html += '    <div style="font-size:13.5px;color:var(--text);line-height:1.6;font-family:\'Inter\',sans-serif" id="msg-text-' + item.id + '">' + item.suggestedMessage + '</div>';
    html += '  </div>';

    html += '</div>';
    return html;
  }

  function renderDashboard(queue) {
    currentQueue = queue || [];

    if (typeof document === 'undefined') return;

    const feedEl = document.getElementById('followup-queue-feed');
    const statsEl = document.getElementById('followup-dashboard-stats');

    // Filter Queue
    let filtered = currentQueue.filter(item => {
      const status = approvalStatusMap[item.id] || item.approvalStatus || 'pending';
      if (approvalFilter === 'pending' && status !== 'pending') return false;
      if (approvalFilter === 'approved' && status !== 'approved') return false;
      if (approvalFilter === 'dismissed' && status !== 'dismissed') return false;

      if (priorityFilter && item.priority !== priorityFilter) return false;
      if (categoryFilter && item.category !== categoryFilter) return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const nameMatch = (item.customer.name || '').toLowerCase().includes(q);
        const mobileMatch = (item.customer.mobile || '').includes(q);
        const msgMatch = (item.suggestedMessage || '').toLowerCase().includes(q);
        if (!nameMatch && !mobileMatch && !msgMatch) return false;
      }
      return true;
    });

    // Render Stats Bar
    if (statsEl) {
      const pendingCount = currentQueue.filter(i => (approvalStatusMap[i.id] || i.approvalStatus) === 'pending').length;
      const highCount = currentQueue.filter(i => i.priority === 'HIGH' && (approvalStatusMap[i.id] || i.approvalStatus) === 'pending').length;
      const approvedCount = Object.values(approvalStatusMap).filter(v => v === 'approved').length;
      const dismissedCount = Object.values(approvalStatusMap).filter(v => v === 'dismissed').length;

      statsEl.innerHTML = `
        <div class="stat" style="border-top:3px solid #f59e0b">
          <div class="stat-l">Pending Approval ⏳</div>
          <div class="stat-v" style="color:#f59e0b">${pendingCount}</div>
        </div>
        <div class="stat" style="border-top:3px solid #ef4444">
          <div class="stat-l">High Priority Alerts 🔴</div>
          <div class="stat-v" style="color:#ef4444">${highCount}</div>
        </div>
        <div class="stat" style="border-top:3px solid #27AE60">
          <div class="stat-l">Approved & Sent ✓</div>
          <div class="stat-v" style="color:#27AE60">${approvedCount}</div>
        </div>
        <div class="stat" style="border-top:3px solid #38bdf8">
          <div class="stat-l">Dismissed ✕</div>
          <div class="stat-v" style="color:#38bdf8">${dismissedCount}</div>
        </div>
      `;
    }

    // Render Feed
    if (!feedEl) return;

    if (filtered.length === 0) {
      feedEl.innerHTML = `
        <div class="tcard" style="padding:48px 20px;text-align:center;color:var(--muted)">
          <div style="font-size:44px;margin-bottom:12px">📲</div>
          <div style="font-family:'Space Grotesk',sans-serif;font-size:18px;font-weight:700;color:var(--text);margin-bottom:6px">No Follow-up Tasks Match Filters</div>
          <div style="font-size:13.5px">All follow-ups matching your selected criteria are approved, dismissed, or healthy.</div>
        </div>
      `;
      return;
    }

    feedEl.innerHTML = filtered.map(renderQueueCard).join('');
  }

  window.PulseIQ_FollowupQueueRenderer = {
    renderDashboard: renderDashboard,
    setPriorityFilter: function(val) { priorityFilter = val; },
    setCategoryFilter: function(val) { categoryFilter = val; },
    setApprovalFilter: function(val) { approvalFilter = val; },
    setSearchQuery: function(val) { searchQuery = val; },
    markApproved: function(id) { approvalStatusMap[id] = 'approved'; },
    markDismissed: function(id) { approvalStatusMap[id] = 'dismissed'; },
    getApprovalStatusMap: function() { return approvalStatusMap; }
  };

})(typeof window !== 'undefined' ? window : global);
