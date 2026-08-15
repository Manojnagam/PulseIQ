/**
 * PulseIQ Phase 1 — Task Centre UI Feed & Task Renderer
 * Milestone 4 & Milestone 5 Implementation
 * 
 * Handles DOM rendering for Task Centre (#sec-taskcenter),
 * Customer Profile Linked Tasks, and Coach Profile Assigned Tasks summary.
 * Strictly enforces permission-aware rendering via PulseIQ_AuthService.
 * 
 * @module PulseIQ_TaskRenderer
 * @version 1.1.0
 */

(function(window) {
  'use strict';
  console.log('TRACE-34: First executable line of task-renderer.js');
  console.log('[TC-LOG 4] task-renderer.js loaded');

  // ── INTERNAL STATE ──
  const state = {
    tasks: [],
    filters: {
      priority: '',
      status: '',
      coach: '',
      category: '',
      search: ''
    },
    loading: false
  };

  // ── PERMISSION HELPER (ONLY canReadTasks, canCreateTask, canAssignTask, canManageTask) ──
  function getPermissions() {
    const auth = window.PulseIQ_AuthService || {};
    return {
      canRead: typeof auth.canReadTasks === 'function' ? auth.canReadTasks() : true,
      canCreate: typeof auth.canCreateTask === 'function' ? auth.canCreateTask() : false,
      canAssign: typeof auth.canAssignTask === 'function' ? auth.canAssignTask() : false,
      canManage: typeof auth.canManageTask === 'function' ? auth.canManageTask() : false
    };
  }

  function getCurrentUser() {
    if (window.PulseIQ_AuthService && typeof window.PulseIQ_AuthService.currentUser === 'function') {
      return window.PulseIQ_AuthService.currentUser();
    }
    return window.CURRENT_USER || { id: 'usr-guest', name: 'Guest User', roleId: 'viewer' };
  }

  // ── LOOKUP HELPERS ──
  function getCoachName(coachId) {
    if (!coachId) return 'Unassigned';
    const coaches = (window.D && window.D.coaches) || [];
    const coach = coaches.find(c => c.id === coachId || String(c.id) === String(coachId));
    return coach ? (coach.name || coach.email || 'Coach') : coachId;
  }

  function getCustomerName(customerId) {
    if (!customerId) return null;
    const customers = (window.D && window.D.customers) || [];
    const cust = customers.find(c => c.id === customerId || String(c.id) === String(customerId));
    return cust ? (cust.name || cust.mobile || customerId) : customerId;
  }

  // ── DATE COMPUTATION HELPERS ──
  function isToday(dateStr) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const today = new Date();
    return d.getFullYear() === today.getFullYear() &&
           d.getMonth() === today.getMonth() &&
           d.getDate() === today.getDate();
  }

  function isOverdue(dateStr, status) {
    if (!dateStr || ['Completed', 'Verified', 'Closed', 'Cancelled'].includes(status)) return false;
    const d = new Date(dateStr);
    d.setHours(23, 59, 59, 999);
    return d.getTime() < Date.now();
  }

  function isThisWeek(dateStr) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const now = new Date();
    const firstDayOfWeek = new Date(now);
    firstDayOfWeek.setDate(now.getDate() - now.getDay());
    firstDayOfWeek.setHours(0, 0, 0, 0);
    return d >= firstDayOfWeek;
  }

  // ── BADGE RENDERERS ──
  function renderPriorityBadge(priority) {
    const p = (priority || 'MEDIUM').toUpperCase();
    let badgeClass = 'by';
    let icon = '🟡';
    if (p === 'HIGH') { badgeClass = 'br'; icon = '🔴'; }
    else if (p === 'LOW') { badgeClass = 'bg'; icon = '🟢'; }
    return `<span class="badge ${badgeClass}" style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700">${icon} ${p}</span>`;
  }

  function renderStatusBadge(status) {
    const s = status || 'Pending';
    let style = 'background:rgba(255,255,255,0.1);color:#a1a1aa';
    if (s === 'Pending') style = 'background:rgba(245,158,11,0.15);color:#f59e0b;border:1px solid rgba(245,158,11,0.3)';
    else if (s === 'Assigned') style = 'background:rgba(56,189,248,0.15);color:#38bdf8;border:1px solid rgba(56,189,248,0.3)';
    else if (s === 'In Progress') style = 'background:rgba(167,139,250,0.15);color:#a78bfa;border:1px solid rgba(167,139,250,0.3)';
    else if (s === 'Completed') style = 'background:rgba(39,174,96,0.15);color:#27AE60;border:1px solid rgba(39,174,96,0.3)';
    else if (s === 'Verified') style = 'background:rgba(37,99,235,0.15);color:#2563EB;border:1px solid rgba(37,99,235,0.3)';
    else if (s === 'Closed') style = 'background:rgba(100,116,139,0.15);color:#94a3b8;border:1px solid rgba(100,116,139,0.3)';
    else if (s === 'Cancelled') style = 'background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.3)';

    return `<span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;${style}">${s}</span>`;
  }

  // ── METRIC CARDS RENDERER (MANAGER VIEW) ──
  function renderMetrics(tasks) {
    console.log('[TC-LOG 8] renderMetrics() entered with tasks:', tasks ? tasks.length : 0);
    const activeTasks = tasks.filter(t => !['Closed', 'Cancelled'].includes(t.status));
    const openCount = tasks.filter(t => ['Pending', 'Assigned', 'In Progress'].includes(t.status)).length;
    const dueTodayCount = activeTasks.filter(t => isToday(t.due_date)).length;
    const overdueCount = activeTasks.filter(t => isOverdue(t.due_date, t.status)).length;
    const completedThisWeekCount = tasks.filter(t => ['Completed', 'Verified', 'Closed'].includes(t.status) && (isThisWeek(t.completed_at) || isThisWeek(t.created_at))).length;

    const statsContainer = document.getElementById('tc-manager-stats');
    if (!statsContainer) {
      console.warn('[TC-LOG 8-WARN] Stopped because #tc-manager-stats container missing');
      return;
    }

    console.log('[TC-LOG] Rendering into #tc-manager-stats element:', statsContainer);
    statsContainer.innerHTML = `
      <div class="stat" style="border-top-color:#38bdf8">
        <div class="stat-l">Open Tasks</div>
        <div class="stat-v" style="color:#38bdf8">${openCount}</div>
      </div>
      <div class="stat" style="border-top-color:#f59e0b">
        <div class="stat-l">Due Today</div>
        <div class="stat-v" style="color:#f59e0b">${dueTodayCount}</div>
      </div>
      <div class="stat" style="border-top-color:#ef4444">
        <div class="stat-l">Overdue</div>
        <div class="stat-v" style="color:#ef4444">${overdueCount}</div>
      </div>
      <div class="stat" style="border-top-color:#27AE60">
        <div class="stat-l">Completed This Week</div>
        <div class="stat-v" style="color:#27AE60">${completedThisWeekCount}</div>
      </div>
    `;
    console.log('[TC-LOG] Rendered length #tc-manager-stats:', statsContainer.innerHTML.length);
  }

  // ── MAIN FEED RENDERER ──
  function renderFeed(tasks) {
    console.log('[TC-LOG 9] renderFeed() entered with tasks:', tasks ? tasks.length : 0);
    state.tasks = tasks || [];
    const perms = getPermissions();
    const user = getCurrentUser();

    console.log('[TC-LOG 9.1] User permissions:', perms);

    // Toggle View Controls based on Permission Keys
    const managerStats = document.getElementById('tc-manager-stats');
    const createBtn = document.getElementById('tc-create-btn');
    const filterCoachGroup = document.getElementById('tc-filter-coach-group');

    console.log('[TC-LOG 10] DOM Check: managerStats=', !!managerStats, 'createBtn=', !!createBtn, 'filterCoachGroup=', !!filterCoachGroup);

    if (managerStats) {
      managerStats.style.display = perms.canManage ? 'grid' : 'none';
    }
    if (createBtn) {
      createBtn.style.display = perms.canCreate ? 'inline-flex' : 'none';
    }
    if (filterCoachGroup) {
      filterCoachGroup.style.display = perms.canManage ? 'inline-block' : 'none';
    }

    // Filter tasks based on view mode (Manager vs Coach) and active filters
    let filtered = [...state.tasks];

    // If Coach View (lacks canManageTask), restrict feed strictly to assigned tasks
    if (!perms.canManage) {
      const userCoachId = user.coachId || user.id;
      filtered = filtered.filter(t =>
        t.assigned_to_coach_id === userCoachId || String(t.assigned_to_coach_id) === String(userCoachId)
      );
    } else if (state.filters.coach) {
      if (state.filters.coach === 'unassigned') {
        filtered = filtered.filter(t => !t.assigned_to_coach_id);
      } else {
        filtered = filtered.filter(t =>
          t.assigned_to_coach_id === state.filters.coach || String(t.assigned_to_coach_id) === String(state.filters.coach)
        );
      }
    }

    if (state.filters.priority) {
      filtered = filtered.filter(t => (t.priority || '').toUpperCase() === state.filters.priority.toUpperCase());
    }
    if (state.filters.status) {
      filtered = filtered.filter(t => t.status === state.filters.status);
    }
    if (state.filters.category) {
      filtered = filtered.filter(t => t.category === state.filters.category);
    }
    if (state.filters.search) {
      const q = state.filters.search.toLowerCase().trim();
      filtered = filtered.filter(t =>
        (t.title || '').toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.category || '').toLowerCase().includes(q)
      );
    }

    // Render Metrics for Manager View
    if (perms.canManage) {
      renderMetrics(state.tasks);
    }

    // Render Feed Body
    const feedBody = document.getElementById('tc-feed-body');
    if (!feedBody) {
      console.warn('[TC-LOG 9-WARN] Stopped because #tc-feed-body container missing');
      return;
    }

    console.log('[TC-LOG] Rendering into #tc-feed-body element:', feedBody);

    if (state.loading) {
      feedBody.innerHTML = `
        <tr>
          <td colspan="7">
            <div style="padding:40px 20px;text-align:center;color:var(--muted)">
              <div style="font-size:28px;margin-bottom:10px;animation:pulseSpin 1.5s infinite">⏳</div>
              <div style="font-weight:600;font-size:14px">Loading Task Centre...</div>
            </div>
          </td>
        </tr>
      `;
      console.log('[TC-LOG] Rendered length #tc-feed-body (loading):', feedBody.innerHTML.length);
      return;
    }

    if (filtered.length === 0) {
      feedBody.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="empty" style="padding:40px 20px;text-align:center">
              <div class="ei" style="font-size:32px;margin-bottom:8px">📋</div>
              <div style="font-weight:700;font-size:15px;color:var(--text);margin-bottom:4px">No tasks found</div>
              <div style="font-size:13px;color:var(--muted)">Try adjusting your filters or search terms.</div>
            </div>
          </td>
        </tr>
      `;
      console.log('[TC-LOG] Rendered length #tc-feed-body (empty):', feedBody.innerHTML.length);
      return;
    }

    feedBody.innerHTML = filtered.map(t => {
      const coachName = getCoachName(t.assigned_to_coach_id);
      const custName = getCustomerName(t.related_customer_id);
      const overdue = isOverdue(t.due_date, t.status);
      const dueToday = isToday(t.due_date);

      let dueDateLabel = t.due_date ? t.due_date : '—';
      if (overdue) {
        dueDateLabel = `<span style="color:#ef4444;font-weight:700" title="Overdue">⚠️ ${t.due_date}</span>`;
      } else if (dueToday) {
        dueDateLabel = `<span style="color:#f59e0b;font-weight:700" title="Due Today">⏳ Today</span>`;
      }

      // Action buttons per role permission
      let actionButtons = '';
      if (perms.canManage) {
        // Manager View Controls
        const nextStatuses = (window.PulseIQ_TaskService && window.PulseIQ_TaskService.getValidNextStatuses)
          ? window.PulseIQ_TaskService.getValidNextStatuses(t.status)
          : [];

        actionButtons = `
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            ${nextStatuses.map(ns => `
              <button onclick="PulseIQ_TaskCenter.updateStatus('${t.id}', '${ns}')" class="btn-c" style="padding:4px 8px;font-size:11px;font-weight:600">
                → ${ns}
              </button>
            `).join('')}
            ${!['Closed', 'Cancelled'].includes(t.status) ? `
              <button onclick="PulseIQ_TaskCenter.cancelTask('${t.id}')" class="btn-c" style="padding:4px 8px;font-size:11px;color:#ef4444;border-color:rgba(239,68,68,0.3)" title="Cancel Task">
                ✕
              </button>
            ` : ''}
            <button onclick="PulseIQ_TaskCenter.viewHistory('${t.id}')" class="btn-c" style="padding:4px 8px;font-size:11px" title="View Audit History">
              📜
            </button>
          </div>
        `;
      } else {
        // Coach View Controls ("Start Work" & "Mark Complete")
        if (t.status === 'Assigned') {
          actionButtons = `
            <button onclick="PulseIQ_TaskCenter.updateStatus('${t.id}', 'In Progress')" class="btn-p" style="padding:6px 14px;font-size:12px;background:linear-gradient(135deg,#38bdf8,#0284c7);border-color:#38bdf8;color:#fff;font-weight:700">
              ▶ Start Work
            </button>
          `;
        } else if (t.status === 'In Progress') {
          actionButtons = `
            <button onclick="PulseIQ_TaskCenter.updateStatus('${t.id}', 'Completed')" class="btn-p" style="padding:6px 14px;font-size:12px;background:linear-gradient(135deg,#27AE60,#219653);border-color:#27AE60;color:#fff;font-weight:700">
              ✓ Mark Complete
            </button>
          `;
        } else {
          actionButtons = `<span style="font-size:12px;color:var(--muted)">${t.status}</span>`;
        }
      }

      // Coach Assignment Cell (Editable if canAssignTask)
      let coachCell = coachName;
      if (perms.canAssign && !['Closed', 'Cancelled'].includes(t.status)) {
        const coaches = (window.D && window.D.coaches) || [];
        coachCell = `
          <select onchange="PulseIQ_TaskCenter.assignCoach('${t.id}', this.value)" style="padding:4px 8px;border-radius:8px;font-size:12px;border:1px solid var(--border);background:var(--surface);color:var(--text)">
            <option value="">-- Unassigned --</option>
            ${coaches.map(c => `
              <option value="${c.id}" ${String(t.assigned_to_coach_id) === String(c.id) ? 'selected' : ''}>
                ${c.name || c.email}
              </option>
            `).join('')}
          </select>
        `;
      }

      return `
        <tr>
          <td>
            <div style="font-weight:700;font-size:13.5px;color:var(--text)">${t.title}</div>
            ${t.description ? `<div style="font-size:12px;color:var(--muted);margin-top:2px">${t.description}</div>` : ''}
            ${custName ? `<div style="font-size:11px;color:var(--primary);margin-top:4px">👤 Customer: <strong>${custName}</strong></div>` : ''}
          </td>
          <td>
            <span style="display:inline-block;padding:3px 8px;border-radius:8px;font-size:11px;font-weight:600;background:rgba(255,255,255,0.06);color:var(--muted)">
              ${t.category || 'General'}
            </span>
          </td>
          <td>${renderPriorityBadge(t.priority)}</td>
          <td>${renderStatusBadge(t.status)}</td>
          <td>${coachCell}</td>
          <td>${dueDateLabel}</td>
          <td>${actionButtons}</td>
        </tr>
      `;
    }).join('');
  }

  // ── MILESTONE 5: CUSTOMER PROFILE LINKED TASKS RENDERER ──
  function renderCustomerLinkedTasks(containerId, tasks) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!tasks || tasks.length === 0) {
      container.innerHTML = `
        <div style="padding:20px;text-align:center;color:var(--muted);font-size:13px">
          No tasks currently linked to this customer.
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="twrap">
        <table>
          <thead>
            <tr>
              <th>Task Title</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Due Date</th>
              <th>Assigned Coach</th>
            </tr>
          </thead>
          <tbody>
            ${tasks.map(t => `
              <tr>
                <td style="font-weight:600">${t.title}</td>
                <td>${renderPriorityBadge(t.priority)}</td>
                <td>${renderStatusBadge(t.status)}</td>
                <td>${t.due_date || '—'}</td>
                <td>${getCoachName(t.assigned_to_coach_id)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // ── MILESTONE 5: COACH PROFILE ASSIGNED TASKS SUMMARY ──
  function getCoachTaskSummary(coachId, allTasks) {
    const coachTasks = (allTasks || []).filter(t =>
      t.assigned_to_coach_id === coachId || String(t.assigned_to_coach_id) === String(coachId)
    );
    const active = coachTasks.filter(t => !['Closed', 'Cancelled'].includes(t.status));
    
    return {
      open: coachTasks.filter(t => ['Pending', 'Assigned'].includes(t.status)).length,
      inProgress: coachTasks.filter(t => t.status === 'In Progress').length,
      completed: coachTasks.filter(t => ['Completed', 'Verified', 'Closed'].includes(t.status)).length,
      overdue: active.filter(t => isOverdue(t.due_date, t.status)).length
    };
  }

  // ── FILTER CONTROLS POPULATOR ──
  function populateFilters() {
    const coachSel = document.getElementById('tc-filter-coach');
    if (coachSel) {
      const coaches = (window.D && window.D.coaches) || [];
      coachSel.innerHTML = `
        <option value="">All Coaches</option>
        <option value="unassigned">-- Unassigned --</option>
        ${coaches.map(c => `<option value="${c.id}">${c.name || c.email}</option>`).join('')}
      `;
    }
  }

  // ── PUBLIC EXPORTS ──
  window.PulseIQ_TaskRenderer = {
    renderFeed: renderFeed,
    renderCustomerLinkedTasks: renderCustomerLinkedTasks,
    getCoachTaskSummary: getCoachTaskSummary,
    populateFilters: populateFilters,
    setLoading: function(val) { state.loading = !!val; },
    getFilters: function() { return { ...state.filters }; },
    setFilter: function(k, v) { state.filters[k] = v; },
    resetFilters: function() {
      state.filters = { priority: '', status: '', coach: '', category: '', search: '' };
      const p = document.getElementById('tc-filter-priority'); if (p) p.value = '';
      const s = document.getElementById('tc-filter-status'); if (s) s.value = '';
      const c = document.getElementById('tc-filter-coach'); if (c) c.value = '';
      const cat = document.getElementById('tc-filter-category'); if (cat) cat.value = '';
      const q = document.getElementById('tc-filter-search'); if (q) q.value = '';
    },
    getPermissions: getPermissions,
    state: state,
    version: '1.1.0'
  };

})(typeof window !== 'undefined' ? window : global);
