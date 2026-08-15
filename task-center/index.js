/**
 * PulseIQ Phase 1 — Task Centre Main Orchestrator
 * Milestone 4 & Milestone 5 Implementation
 * 
 * Entry point for Task Centre UI view (#sec-taskcenter).
 * Connects data layer (PulseIQ_TaskService) to view renderer (PulseIQ_TaskRenderer).
 * Enforces lazy loading, role-aware feeds, customer profile linking, and coach tasks integration.
 * 
 * @module PulseIQ_TaskCenter
 * @version 1.1.0
 */

(function(window) {
  'use strict';
  console.log('TRACE-40: First executable line of task-center/index.js');

  console.log('[TC-LOG 5] task-center/index.js executing...');

  let initialized = false;
  let activeCustomerIdForTasks = null;

  async function fetchAndRender() {
    console.log('[TC-LOG 7] fetchAndRender() entered');
    if (!window.PulseIQ_TaskService) {
      console.warn('[TC-LOG 7-WARN] Stopped because TaskService missing');
      return;
    }

    if (window.PulseIQ_TaskRenderer) {
      window.PulseIQ_TaskRenderer.setLoading(true);
      window.PulseIQ_TaskRenderer.populateFilters();
    }

    const centerId = window.ACTIVE_CENTER || (window.D && window.D.centerId);
    console.log('[TC-LOG 7.1] Fetching tasks for centerId:', centerId);

    try {
      const res = await window.PulseIQ_TaskService.listTasks({ wellness_center_id: centerId, limit: 200 });
      console.log('[TC-LOG 7.2] listTasks result:', res);
      const tasks = (res && res.success) ? (res.data || []) : [];

      if (window.PulseIQ_TaskRenderer) {
        window.PulseIQ_TaskRenderer.setLoading(false);
        window.PulseIQ_TaskRenderer.renderFeed(tasks);
      } else {
        console.warn('[TC-LOG 7-WARN] Stopped because PulseIQ_TaskRenderer missing');
      }
    } catch (err) {
      console.error('[TC-LOG 7-ERR] Failed to fetch tasks:', err);
      if (window.PulseIQ_TaskRenderer) {
        window.PulseIQ_TaskRenderer.setLoading(false);
        window.PulseIQ_TaskRenderer.renderFeed([]);
      }
    }
  }

  function init() {
    console.log('[TC-LOG 6] PulseIQ_TaskCenter.init() entered. initialized=', initialized);
    if (initialized) {
      onNavigateTo();
      return;
    }
    initialized = true;

    // Populate selects in modal
    populateCreateModalSelects();

    // Fetch and render
    fetchAndRender();
  }

  function onNavigateTo() {
    console.log('[TC-LOG 6.1] PulseIQ_TaskCenter.onNavigateTo() entered');
    populateCreateModalSelects();
    fetchAndRender();
  }

  function onNavigateAway(nextSec) {
    // Memory release hook when leaving section
  }

  function populateCreateModalSelects() {
    const coachSel = document.getElementById('tc-modal-coach');
    if (coachSel) {
      const coaches = (window.D && window.D.coaches) || [];
      coachSel.innerHTML = `
        <option value="">-- Select Coach (Optional) --</option>
        ${coaches.map(c => `<option value="${c.id}">${c.name || c.email}</option>`).join('')}
      `;
    }

    const custSel = document.getElementById('tc-modal-customer');
    if (custSel) {
      const customers = (window.D && window.D.customers) || [];
      custSel.innerHTML = `
        <option value="">-- Select Customer (Optional) --</option>
        ${customers.map(c => `<option value="${c.id}">${c.name || c.mobile}</option>`).join('')}
      `;
    }
  }

  // ── MILESTONE 5: CUSTOMER PROFILE LINKED TASKS LAZY LOADER ──
  async function loadCustomerLinkedTasks(customerId) {
    if (customerId) activeCustomerIdForTasks = customerId;
    const custId = customerId || activeCustomerIdForTasks || window._selectedCustId || window.activeCustomerId || window._currCustId || (window.D && window.D.selectedCustomerId);
    
    const container = document.getElementById('cust-linked-tasks-container');
    if (!container) return;

    if (!custId) {
      container.innerHTML = '<div style="padding:15px;text-align:center;color:var(--muted)">Select a customer above to view linked tasks.</div>';
      return;
    }

    container.innerHTML = '<div style="padding:15px;text-align:center;color:var(--muted)">Loading linked tasks...</div>';

    const centerId = window.ACTIVE_CENTER || (window.D && window.D.centerId);
    try {
      const res = await window.PulseIQ_TaskService.listTasks({
        wellness_center_id: centerId,
        related_customer_id: custId
      });
      const tasks = (res && res.success) ? (res.data || []) : [];

      const badge = document.getElementById('cust-tasks-count-badge');
      if (badge) badge.textContent = tasks.length;

      if (window.PulseIQ_TaskRenderer) {
        window.PulseIQ_TaskRenderer.renderCustomerLinkedTasks('cust-linked-tasks-container', tasks);
      }
    } catch (err) {
      console.error('[PulseIQ TaskCenter] Failed to load customer linked tasks:', err);
      container.innerHTML = '<div style="padding:15px;text-align:center;color:var(--danger)">Failed to load customer tasks.</div>';
    }
  }

  // ── MILESTONE 5: COACH PROFILE ASSIGNED TASKS OVERVIEW ──
  async function renderCoachTasksOverview() {
    const tbody = document.getElementById('coach-tasks-overview-body');
    if (!tbody) return;

    const coaches = (window.D && window.D.coaches) || [];
    if (coaches.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6"><div style="padding:15px;text-align:center;color:var(--muted)">No coaches available.</div></td></tr>';
      return;
    }

    const centerId = window.ACTIVE_CENTER || (window.D && window.D.centerId);
    try {
      const res = await window.PulseIQ_TaskService.listTasks({ wellness_center_id: centerId, limit: 300 });
      const allTasks = (res && res.success) ? (res.data || []) : [];

      tbody.innerHTML = coaches.map(c => {
        const summary = window.PulseIQ_TaskRenderer
          ? window.PulseIQ_TaskRenderer.getCoachTaskSummary(c.id, allTasks)
          : { open: 0, inProgress: 0, completed: 0, overdue: 0 };

        return `
          <tr>
            <td style="font-weight:700">${c.name || c.email}</td>
            <td style="text-align:center;color:#38bdf8;font-weight:700">${summary.open}</td>
            <td style="text-align:center;color:#a78bfa;font-weight:700">${summary.inProgress}</td>
            <td style="text-align:center;color:#27AE60;font-weight:700">${summary.completed}</td>
            <td style="text-align:center;color:#ef4444;font-weight:700">${summary.overdue > 0 ? `⚠️ ${summary.overdue}` : '0'}</td>
            <td>
              <button onclick="PulseIQ_TaskCenter.filterByCoachAndNavigate('${c.id}')" class="btn-p" style="padding:4px 10px;font-size:11px;background:linear-gradient(135deg,#2563EB,#1d4ed8)">
                View Tasks →
              </button>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('[PulseIQ TaskCenter] Failed to render coach tasks overview:', err);
    }
  }

  // ── QUICK NAVIGATE TO TASK CENTRE FILTERED BY COACH ──
  function filterByCoachAndNavigate(coachId) {
    if (window.PulseIQ_TaskRenderer) {
      window.PulseIQ_TaskRenderer.setFilter('coach', coachId || '');
      const coachSel = document.getElementById('tc-filter-coach');
      if (coachSel) coachSel.value = coachId || '';
    }
    if (typeof window.goTo === 'function') {
      window.goTo('taskcenter');
    }
  }

  // ── INTERACTIVE TASK ACTIONS ──
  async function submitCreateTask(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    const perms = window.PulseIQ_TaskRenderer ? window.PulseIQ_TaskRenderer.getPermissions() : {};
    if (!perms.canCreate) {
      if (typeof window.showToast === 'function') window.showToast('🔒 Permission denied: Cannot create tasks.');
      return;
    }

    const titleEl = document.getElementById('tc-create-title');
    const descEl = document.getElementById('tc-create-desc');
    const catEl = document.getElementById('tc-create-category');
    const prioEl = document.getElementById('tc-create-priority');
    const coachEl = document.getElementById('tc-modal-coach');
    const custEl = document.getElementById('tc-modal-customer');
    const dateEl = document.getElementById('tc-create-date');

    const title = titleEl ? titleEl.value.trim() : '';
    if (title.length < 3) {
      if (typeof window.showToast === 'function') window.showToast('⚠️ Task title must be at least 3 characters.');
      return;
    }

    const centerId = window.ACTIVE_CENTER || (window.D && window.D.centerId);
    const user = (window.PulseIQ_AuthService && window.PulseIQ_AuthService.currentUser()) || {};

    const payload = {
      wellness_center_id: centerId,
      title: title,
      description: descEl ? descEl.value.trim() : null,
      category: catEl ? catEl.value : 'General',
      priority: prioEl ? prioEl.value : 'MEDIUM',
      assigned_to_coach_id: coachEl && coachEl.value ? coachEl.value : null,
      related_customer_id: custEl && custEl.value ? custEl.value : null,
      created_by_user_id: user.id || 'system',
      due_date: dateEl && dateEl.value ? dateEl.value : null
    };

    try {
      const res = await window.PulseIQ_TaskService.createTask(payload);
      if (res && res.success) {
        if (typeof window.showToast === 'function') window.showToast('✅ Task created successfully!');
        if (typeof window.closeModal === 'function') window.closeModal('create-task');
        
        // Reset form
        if (titleEl) titleEl.value = '';
        if (descEl) descEl.value = '';
        if (dateEl) dateEl.value = '';

        fetchAndRender();
      } else {
        if (typeof window.showToast === 'function') window.showToast(`❌ Error: ${res ? res.error : 'Failed to create task'}`);
      }
    } catch (err) {
      console.error('[PulseIQ TaskCenter] Create task exception:', err);
    }
  }

  async function updateStatus(taskId, newStatus) {
    const user = (window.PulseIQ_AuthService && window.PulseIQ_AuthService.currentUser()) || {};
    try {
      const res = await window.PulseIQ_TaskService.updateStatus(taskId, newStatus, user.coachId || user.id);
      if (res && res.success) {
        if (typeof window.showToast === 'function') window.showToast(`✅ Status updated to '${newStatus}'`);
        fetchAndRender();
      } else {
        if (typeof window.showToast === 'function') window.showToast(`❌ ${res ? res.error : 'Status update failed'}`);
      }
    } catch (err) {
      console.error('[PulseIQ TaskCenter] Update status exception:', err);
    }
  }

  async function assignCoach(taskId, coachId) {
    const perms = window.PulseIQ_TaskRenderer ? window.PulseIQ_TaskRenderer.getPermissions() : {};
    if (!perms.canAssign) {
      if (typeof window.showToast === 'function') window.showToast('🔒 Permission denied: Cannot assign tasks.');
      return;
    }

    const user = (window.PulseIQ_AuthService && window.PulseIQ_AuthService.currentUser()) || {};
    try {
      const res = await window.PulseIQ_TaskService.assignCoach(taskId, coachId || null, user.id);
      if (res && res.success) {
        if (typeof window.showToast === 'function') window.showToast('✅ Coach assigned successfully');
        fetchAndRender();
      } else {
        if (typeof window.showToast === 'function') window.showToast(`❌ ${res ? res.error : 'Assignment failed'}`);
      }
    } catch (err) {
      console.error('[PulseIQ TaskCenter] Assign coach exception:', err);
    }
  }

  async function cancelTask(taskId) {
    if (!confirm('Are you sure you want to cancel this task?')) return;
    const user = (window.PulseIQ_AuthService && window.PulseIQ_AuthService.currentUser()) || {};
    try {
      const res = await window.PulseIQ_TaskService.cancelTask(taskId, user.id, 'Cancelled via Task Centre UI');
      if (res && res.success) {
        if (typeof window.showToast === 'function') window.showToast('Task cancelled');
        fetchAndRender();
      }
    } catch (err) {
      console.error('[PulseIQ TaskCenter] Cancel task exception:', err);
    }
  }

  async function viewHistory(taskId) {
    try {
      const res = await window.PulseIQ_TaskService.getTaskHistory(taskId);
      const history = (res && res.success) ? (res.data || []) : [];

      const bodyEl = document.getElementById('tc-history-modal-body');
      if (bodyEl) {
        if (history.length === 0) {
          bodyEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted)">No history records found.</div>';
        } else {
          bodyEl.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:10px">
              ${history.map(h => `
                <div style="padding:10px 14px;background:var(--surface2);border-radius:10px;border:1px solid var(--border)">
                  <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;color:var(--primary)">
                    <span>${h.previous_status ? `${h.previous_status} → ` : ''}${h.new_status}</span>
                    <span style="color:var(--muted);font-weight:400">${new Date(h.created_at).toLocaleString()}</span>
                  </div>
                  ${h.notes ? `<div style="font-size:12px;color:var(--text);margin-top:4px">${h.notes}</div>` : ''}
                </div>
              `).join('')}
            </div>
          `;
        }
      }
      if (typeof window.openModal === 'function') window.openModal('task-history');
    } catch (err) {
      console.error('[PulseIQ TaskCenter] History fetch exception:', err);
    }
  }

  // ── FILTER HANDLERS ──
  function onFilterChange(type, val) {
    if (window.PulseIQ_TaskRenderer) {
      window.PulseIQ_TaskRenderer.setFilter(type, val);
      window.PulseIQ_TaskRenderer.renderFeed(window.PulseIQ_TaskRenderer.state ? window.PulseIQ_TaskRenderer.state.tasks : []);
    }
  }

  function resetFilters() {
    if (window.PulseIQ_TaskRenderer) {
      window.PulseIQ_TaskRenderer.resetFilters();
      window.PulseIQ_TaskRenderer.renderFeed(window.PulseIQ_TaskRenderer.state ? window.PulseIQ_TaskRenderer.state.tasks : []);
    }
  }

  // Public API
  window.PulseIQ_TaskCenter = {
    init: init,
    onNavigateTo: onNavigateTo,
    onNavigateAway: onNavigateAway,
    refresh: fetchAndRender,
    loadCustomerLinkedTasks: loadCustomerLinkedTasks,
    renderCoachTasksOverview: renderCoachTasksOverview,
    filterByCoachAndNavigate: filterByCoachAndNavigate,
    submitCreateTask: submitCreateTask,
    updateStatus: updateStatus,
    assignCoach: assignCoach,
    cancelTask: cancelTask,
    viewHistory: viewHistory,
    onFilterChange: onFilterChange,
    resetFilters: resetFilters,
    version: '1.1.0'
  };

})(typeof window !== 'undefined' ? window : global);
