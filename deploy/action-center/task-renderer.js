/**
 * PulseIQ Phase 2.2 — Action Centre / Daily Tasks
 * Task Renderer & UI Manager
 * 
 * Renders task cards, filter bars, search inputs, KPI summary counters,
 * and handles UI state (filters, search, expansion, completion toggles).
 */

(function(window) {
  'use strict';

  let currentTasks = [];
  let priorityFilter = '';
  let categoryFilter = '';
  let searchQuery = '';
  const completedTaskIds = new Set();
  const expandedTaskIds = new Set();

  function renderTaskCard(task) {
    const isCompleted = completedTaskIds.has(task.id);
    const isExpanded = expandedTaskIds.has(task.id);

    const priorityColor = task.priority === 'HIGH' ? '#ef4444' : (task.priority === 'MEDIUM' ? '#f59e0b' : '#27AE60');
    const priorityBg = task.priority === 'HIGH' ? 'rgba(239,68,68,0.12)' : (task.priority === 'MEDIUM' ? 'rgba(245,158,11,0.12)' : 'rgba(39,174,96,0.12)');
    const priorityBorder = task.priority === 'HIGH' ? 'rgba(239,68,68,0.3)' : (task.priority === 'MEDIUM' ? 'rgba(245,158,11,0.3)' : 'rgba(39,174,96,0.3)');

    const entityName = task.affectedEntity ? task.affectedEntity.name : 'N/A';
    const entityMobile = task.affectedEntity ? task.affectedEntity.mobile : null;

    let html = '';
    html += '<div class="tcard" id="card-' + task.id + '" style="margin-bottom:14px;padding:18px 22px;background:rgba(24,24,27,0.75);backdrop-filter:blur(16px);border:1px solid ' + (isCompleted ? 'rgba(255,255,255,0.08)' : priorityBorder) + ';border-left:5px solid ' + priorityColor + ';opacity:' + (isCompleted ? '0.55' : '1') + ';transition:all .2s cubic-bezier(0.4, 0, 0.2, 1)">';

    // Top Row: Priority Badge, Icon, Title, Status & Actions
    html += '  <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">';
    html += '    <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:240px">';
    html += '      <span style="font-size:20px;flex-shrink:0">' + task.icon + '</span>';
    html += '      <div>';
    html += '        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
    html += '          <span style="font-family:\'Space Grotesk\',sans-serif;font-weight:700;font-size:15px;color:var(--text);' + (isCompleted ? 'text-decoration:line-through;color:var(--muted)' : '') + '">' + task.title + '</span>';
    html += '          <span style="padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700;background:' + priorityBg + ';color:' + priorityColor + ';border:1px solid ' + priorityBorder + '">' + task.priority + '</span>';
    html += '          <span style="padding:2px 8px;border-radius:12px;font-size:10px;font-weight:600;background:rgba(255,255,255,0.06);color:var(--muted);border:1px solid rgba(255,255,255,0.1)">' + task.category + '</span>';
    html += '        </div>';
    html += '        <div style="font-size:12px;color:var(--muted);margin-top:3px">Target: <strong style="color:var(--text)">' + entityName + '</strong></div>';
    html += '      </div>';
    html += '    </div>';

    // Action Buttons
    html += '    <div style="display:flex;align-items:center;gap:8px">';
    if (entityMobile && entityMobile !== 'N/A') {
      const cleanPhone = entityMobile.replace(/[^0-9]/g, '');
      html += '      <a href="tel:' + cleanPhone + '" style="padding:6px 12px;border-radius:8px;background:rgba(37,99,235,0.15);color:#2563EB;border:1px solid rgba(37,99,235,0.3);text-decoration:none;font-size:12px;font-weight:600;display:inline-flex;align-items:center;gap:4px">📞 Call</a>';
      html += '      <a href="https://wa.me/' + cleanPhone + '?text=Hi%20' + encodeURIComponent(entityName) + '%2C%20following%20up%20from%20PulseZen%20Wellness%20Center." target="_blank" rel="noopener" style="padding:6px 12px;border-radius:8px;background:rgba(37,211,102,0.15);color:#25D366;border:1px solid rgba(37,211,102,0.3);text-decoration:none;font-size:12px;font-weight:600;display:inline-flex;align-items:center;gap:4px">💬 WhatsApp</a>';
    }
    html += '      <button onclick="PulseIQ_ActionCenter.toggleComplete(\'' + task.id + '\')" style="padding:6px 12px;border-radius:8px;background:' + (isCompleted ? 'rgba(255,255,255,0.1)' : 'rgba(39,174,96,0.15)') + ';color:' + (isCompleted ? 'var(--muted)' : '#27AE60') + ';border:1px solid ' + (isCompleted ? 'rgba(255,255,255,0.15)' : 'rgba(39,174,96,0.3)') + ';font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">' + (isCompleted ? '↩️ Undo' : '✓ Done') + '</button>';
    html += '      <button onclick="PulseIQ_ActionCenter.toggleExpand(\'' + task.id + '\')" style="padding:6px 10px;border-radius:8px;background:rgba(255,255,255,0.06);color:var(--muted);border:1px solid rgba(255,255,255,0.1);font-size:12px;cursor:pointer;font-family:inherit">' + (isExpanded ? '▲' : '▼') + '</button>';
    html += '    </div>';
    html += '  </div>';

    // Reason & Suggested Action Box
    html += '  <div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.06)">';
    html += '    <div style="font-size:13px;color:var(--muted);line-height:1.5"><strong>Reason:</strong> ' + task.reason + '</div>';
    html += '    <div style="margin-top:8px;padding:10px 14px;background:rgba(39,174,96,0.08);border:1px solid rgba(39,174,96,0.2);border-radius:10px;font-size:13px;color:var(--text);line-height:1.5">';
    html += '      <strong style="color:#27AE60">👉 Suggested Action:</strong> ' + task.suggestedAction;
    html += '    </div>';
    html += '  </div>';

    // Expandable Source Data Details
    if (isExpanded) {
      html += '  <div style="margin-top:12px;padding:12px 14px;background:rgba(9,9,11,0.6);border-radius:10px;border:1px solid rgba(255,255,255,0.08);font-size:12px;color:var(--muted);font-family:\'JetBrains Mono\',monospace">';
      html += '    <div style="font-weight:700;color:var(--text);margin-bottom:6px">📋 Source Data Traceability:</div>';
      html += '    <div>Task ID: ' + task.id + '</div>';
      html += '    <div>Category: ' + task.category + ' | Priority: ' + task.priority + '</div>';
      html += '    <div>Entity: ' + entityName + ' (ID: ' + (task.affectedEntity ? task.affectedEntity.id : 'N/A') + ')</div>';
      html += '    <div>Source Details: ' + JSON.stringify(task.sourceData) + '</div>';
      html += '    <div>Created: ' + new Date(task.createdTime).toLocaleString() + '</div>';
      html += '  </div>';
    }

    html += '</div>';
    return html;
  }

  function renderFeed(tasks) {
    currentTasks = tasks || [];

    if (typeof document === 'undefined') return;

    const feedEl = document.getElementById('action-center-feed');
    const statsEl = document.getElementById('action-center-stats');

    // Filter Tasks
    const filtered = currentTasks.filter(task => {
      if (priorityFilter && task.priority !== priorityFilter) return false;
      if (categoryFilter && task.category !== categoryFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const titleMatch = (task.title || '').toLowerCase().includes(q);
        const reasonMatch = (task.reason || '').toLowerCase().includes(q);
        const entityMatch = (task.affectedEntity ? task.affectedEntity.name : '').toLowerCase().includes(q);
        if (!titleMatch && !reasonMatch && !entityMatch) return false;
      }
      return true;
    });

    // Render Stats Bar
    if (statsEl) {
      const highCount = currentTasks.filter(t => t.priority === 'HIGH' && !completedTaskIds.has(t.id)).length;
      const medCount = currentTasks.filter(t => t.priority === 'MEDIUM' && !completedTaskIds.has(t.id)).length;
      const lowCount = currentTasks.filter(t => t.priority === 'LOW' && !completedTaskIds.has(t.id)).length;
      const doneCount = completedTaskIds.size;

      statsEl.innerHTML = `
        <div class="stat" style="border-top:3px solid #ef4444">
          <div class="stat-l">High Priority</div>
          <div class="stat-v" style="color:#ef4444">${highCount}</div>
        </div>
        <div class="stat" style="border-top:3px solid #f59e0b">
          <div class="stat-l">Medium Priority</div>
          <div class="stat-v" style="color:#f59e0b">${medCount}</div>
        </div>
        <div class="stat" style="border-top:3px solid #27AE60">
          <div class="stat-l">Low Priority</div>
          <div class="stat-v" style="color:#27AE60">${lowCount}</div>
        </div>
        <div class="stat" style="border-top:3px solid #38bdf8">
          <div class="stat-l">Completed Today</div>
          <div class="stat-v" style="color:#38bdf8">${doneCount}</div>
        </div>
      `;
    }

    // Render Feed
    if (!feedEl) return;

    if (filtered.length === 0) {
      feedEl.innerHTML = `
        <div class="tcard" style="padding:48px 20px;text-align:center;color:var(--muted)">
          <div style="font-size:44px;margin-bottom:12px">⚡</div>
          <div style="font-family:'Space Grotesk',sans-serif;font-size:18px;font-weight:700;color:var(--text);margin-bottom:6px">No Pending Operational Tasks</div>
          <div style="font-size:13.5px">All tasks matching your selected filters are completed or healthy. Great job!</div>
        </div>
      `;
      return;
    }

    // Sort: High > Medium > Low, then uncompleted before completed
    filtered.sort((a, b) => {
      const aDone = completedTaskIds.has(a.id) ? 1 : 0;
      const bDone = completedTaskIds.has(b.id) ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;

      const pMap = { HIGH: 1, MEDIUM: 2, LOW: 3 };
      return pMap[a.priority] - pMap[b.priority];
    });

    feedEl.innerHTML = filtered.map(renderTaskCard).join('');
  }

  window.PulseIQ_TaskRenderer = {
    renderFeed: renderFeed,
    setPriorityFilter: function(val) { priorityFilter = val; },
    setCategoryFilter: function(val) { categoryFilter = val; },
    setSearchQuery: function(val) { searchQuery = val; },
    toggleComplete: function(id) {
      if (completedTaskIds.has(id)) completedTaskIds.delete(id);
      else completedTaskIds.add(id);
    },
    toggleExpand: function(id) {
      if (expandedTaskIds.has(id)) expandedTaskIds.delete(id);
      else expandedTaskIds.add(id);
    },
    getFilters: function() {
      return { priority: priorityFilter, category: categoryFilter, search: searchQuery };
    }
  };

})(typeof window !== 'undefined' ? window : global);
