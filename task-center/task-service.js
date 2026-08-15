/**
 * PulseIQ Phase 1 — Task Centre Data Access Service Layer
 * Milestone 2 Implementation
 * 
 * Single source of truth for all Task Centre database interactions.
 * Manages tasks CRUD, state machine transition validation, and mandatory audit history logging.
 * 
 * @module PulseIQ_TaskService
 * @version 1.0.0
 */

(function(window) {
  'use strict';
  console.log('TRACE-28: First executable line of task-service.js');
  console.log('[TC-LOG 3] task-service.js executing...');

  // ── CONSTANTS & ENUMS ──
  const ALLOWED_PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'];
  
  const ALLOWED_STATUSES = [
    'Pending',
    'Assigned',
    'In Progress',
    'Completed',
    'Verified',
    'Closed',
    'Cancelled'
  ];

  const ALLOWED_CATEGORIES = [
    'General',
    'Attendance',
    'Membership',
    'Risk',
    'Payment',
    'Inventory',
    'Onboarding',
    'FollowUp'
  ];

  // State Machine Allowed Transitions Map
  const STATE_TRANSITIONS = {
    'Pending': ['Assigned', 'Cancelled'],
    'Assigned': ['In Progress', 'Pending', 'Cancelled'],
    'In Progress': ['Completed', 'Assigned', 'Cancelled'],
    'Completed': ['Verified', 'In Progress', 'Cancelled'],
    'Verified': ['Closed'],
    'Closed': [],      // Immutable final state
    'Cancelled': []    // Immutable final state
  };

  // ── DB HELPER WRAPPER ──
  async function _dbQuery(method, table, payload, queryString) {
    try {
      if (typeof window.req === 'function') {
        return await window.req(method, table, payload, queryString);
      }

      // Fallback REST fetch via Supabase proxy or standard endpoint
      const targetBase = typeof window.SUPABASE_URL !== 'undefined'
        ? window.SUPABASE_URL.replace(/\/$/, '')
        : 'https://erteibdxzdvsaujptxsd.supabase.co';
      const key = typeof window.SUPABASE_KEY !== 'undefined' ? window.SUPABASE_KEY : '';

      const url = `${targetBase}/rest/v1/${table}${queryString || ''}`;
      const headers = {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      };

      const opts = { method, headers };
      if (['POST', 'PUT', 'PATCH'].includes(method) && payload) {
        opts.body = JSON.stringify(payload);
      }

      const res = await fetch(url, opts);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Database error ${res.status}: ${res.statusText}`);
      }

      const text = await res.text();
      return text ? JSON.parse(text) : [];
    } catch (err) {
      console.error(`[PulseIQ TaskService DB Error] ${method} /${table}:`, err);
      throw err;
    }
  }

  // ── STATE MACHINE VALIDATION ──
  function validateTransition(currentStatus, newStatus) {
    if (!currentStatus || !newStatus) {
      return { valid: false, error: 'Current status and new status are required.' };
    }

    if (!ALLOWED_STATUSES.includes(currentStatus)) {
      return { valid: false, error: `Invalid current status '${currentStatus}'.` };
    }

    if (!ALLOWED_STATUSES.includes(newStatus)) {
      return { valid: false, error: `Invalid target status '${newStatus}'.` };
    }

    if (currentStatus === newStatus) {
      return { valid: true, note: 'Status unchanged.' };
    }

    const validNextList = STATE_TRANSITIONS[currentStatus] || [];
    if (!validNextList.includes(newStatus)) {
      return {
        valid: false,
        error: `Illegal state transition from '${currentStatus}' to '${newStatus}'. Allowed target statuses: [${validNextList.join(', ')}].`
      };
    }

    return { valid: true };
  }

  function getValidNextStatuses(currentStatus) {
    return STATE_TRANSITIONS[currentStatus] ? [...STATE_TRANSITIONS[currentStatus]] : [];
  }

  // ── AUDIT HISTORY LOGGER ──
  async function _writeAuditHistory(taskId, previousStatus, newStatus, changedByCoachId, notes) {
    try {
      const historyPayload = {
        task_id: taskId,
        previous_status: previousStatus || null,
        new_status: newStatus,
        changed_by_coach_id: changedByCoachId || null,
        notes: notes || null
      };

      await _dbQuery('POST', 'task_history', historyPayload);
      return { success: true };
    } catch (err) {
      console.error(`[PulseIQ TaskService] Failed to write task history for task ${taskId}:`, err);
      // Non-blocking history failure warning
      return { success: false, error: err.message };
    }
  }

  // ── PUBLIC SERVICE METHODS ──

  /**
   * Create a new persistent task.
   * Automatically sets initial status to 'Assigned' if coach ID is provided, else 'Pending'.
   */
  async function createTask(taskData) {
    if (!taskData || typeof taskData !== 'object') {
      return { success: false, error: 'Invalid task data payload.' };
    }

    const {
      wellness_center_id,
      title,
      description,
      category = 'General',
      priority = 'MEDIUM',
      assigned_to_coach_id = null,
      related_customer_id = null,
      created_by_user_id = 'system',
      due_date = null
    } = taskData;

    // Validation
    if (!wellness_center_id) {
      return { success: false, error: 'wellness_center_id is required.' };
    }

    if (!title || typeof title !== 'string' || title.trim().length < 3) {
      return { success: false, error: 'Title must be at least 3 characters long.' };
    }

    if (!ALLOWED_PRIORITIES.includes(priority)) {
      return { success: false, error: `Invalid priority '${priority}'. Allowed: ${ALLOWED_PRIORITIES.join(', ')}` };
    }

    if (!ALLOWED_CATEGORIES.includes(category)) {
      return { success: false, error: `Invalid category '${category}'. Allowed: ${ALLOWED_CATEGORIES.join(', ')}` };
    }

    const initialStatus = assigned_to_coach_id ? 'Assigned' : 'Pending';

    const payload = {
      wellness_center_id: wellness_center_id,
      title: title.trim(),
      description: description ? description.trim() : null,
      category: category,
      priority: priority,
      status: initialStatus,
      assigned_to_coach_id: assigned_to_coach_id || null,
      related_customer_id: related_customer_id || null,
      created_by_user_id: created_by_user_id,
      due_date: due_date || null
    };

    try {
      const res = await _dbQuery('POST', 'tasks', payload);
      const createdTask = Array.isArray(res) ? res[0] : res;

      if (createdTask && createdTask.id) {
        // Write initial audit trail
        await _writeAuditHistory(
          createdTask.id,
          null,
          initialStatus,
          assigned_to_coach_id,
          'Task created'
        );

        return { success: true, data: createdTask };
      }

      return { success: false, error: 'Failed to retrieve created task record.' };
    } catch (err) {
      return { success: false, error: err.message || 'Database error creating task.' };
    }
  }

  /**
   * Fetch a single task by ID with its audit history.
   */
  async function getTaskById(taskId) {
    if (!taskId) {
      return { success: false, error: 'taskId is required.' };
    }

    try {
      const tasks = await _dbQuery('GET', 'tasks', null, `?id=eq.${taskId}`);
      if (!tasks || tasks.length === 0) {
        return { success: false, error: `Task not found with ID '${taskId}'.` };
      }

      const task = tasks[0];
      const history = await getTaskHistory(taskId);

      return {
        success: true,
        data: {
          ...task,
          history: history.data || []
        }
      };
    } catch (err) {
      return { success: false, error: err.message || 'Database error fetching task.' };
    }
  }

  /**
   * List tasks for a given center with optional filtering.
   */
  async function listTasks(filters = {}) {
    const {
      wellness_center_id,
      status,
      priority,
      category,
      assigned_to_coach_id,
      related_customer_id,
      search,
      limit = 100,
      offset = 0
    } = filters;

    const centerId = wellness_center_id || (window.D && window.D.centerId);
    if (!centerId) {
      return { success: false, error: 'wellness_center_id is required for task listing.' };
    }

    let qs = `?wellness_center_id=eq.${centerId}&order=created_at.desc&limit=${limit}&offset=${offset}`;

    if (status) {
      qs += `&status=eq.${encodeURIComponent(status)}`;
    }
    if (priority) {
      qs += `&priority=eq.${encodeURIComponent(priority)}`;
    }
    if (category) {
      qs += `&category=eq.${encodeURIComponent(category)}`;
    }
    if (assigned_to_coach_id) {
      qs += `&assigned_to_coach_id=eq.${encodeURIComponent(assigned_to_coach_id)}`;
    }
    if (related_customer_id) {
      qs += `&related_customer_id=eq.${encodeURIComponent(related_customer_id)}`;
    }

    try {
      let tasks = await _dbQuery('GET', 'tasks', null, qs);
      tasks = Array.isArray(tasks) ? tasks : [];

      // Optional client-side title search filtering
      if (search && typeof search === 'string' && search.trim() !== '') {
        const q = search.trim().toLowerCase();
        tasks = tasks.filter(t => (t.title || '').toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q));
      }

      return { success: true, count: tasks.length, data: tasks };
    } catch (err) {
      return { success: false, error: err.message || 'Database error listing tasks.' };
    }
  }

  /**
   * Update editable task fields (title, description, priority, category, due_date).
   */
  async function updateTask(taskId, updates = {}) {
    if (!taskId) {
      return { success: false, error: 'taskId is required.' };
    }

    // Fetch existing task to check immutability
    const existing = await getTaskById(taskId);
    if (!existing.success || !existing.data) {
      return { success: false, error: existing.error || 'Task not found.' };
    }

    const currentTask = existing.data;
    if (['Closed', 'Cancelled'].includes(currentTask.status)) {
      return { success: false, error: `Cannot update task in terminal state '${currentTask.status}'.` };
    }

    const payload = {};
    if (updates.title && updates.title.trim().length >= 3) {
      payload.title = updates.title.trim();
    }
    if (updates.description !== undefined) {
      payload.description = updates.description ? updates.description.trim() : null;
    }
    if (updates.priority && ALLOWED_PRIORITIES.includes(updates.priority)) {
      payload.priority = updates.priority;
    }
    if (updates.category && ALLOWED_CATEGORIES.includes(updates.category)) {
      payload.category = updates.category;
    }
    if (updates.due_date !== undefined) {
      payload.due_date = updates.due_date || null;
    }

    if (Object.keys(payload).length === 0) {
      return { success: false, error: 'No valid fields provided for update.' };
    }

    try {
      const res = await _dbQuery('PATCH', 'tasks', payload, `?id=eq.${taskId}`);
      const updated = Array.isArray(res) ? res[0] : res;
      return { success: true, data: updated };
    } catch (err) {
      return { success: false, error: err.message || 'Database error updating task.' };
    }
  }

  /**
   * Assign or re-assign a coach to a task.
   */
  async function assignCoach(taskId, coachId, assignedByCoachId = null) {
    if (!taskId) {
      return { success: false, error: 'taskId is required.' };
    }

    const existing = await getTaskById(taskId);
    if (!existing.success || !existing.data) {
      return { success: false, error: existing.error || 'Task not found.' };
    }

    const task = existing.data;
    if (['Closed', 'Cancelled'].includes(task.status)) {
      return { success: false, error: `Cannot assign coach to task in terminal state '${task.status}'.` };
    }

    const targetCoachId = coachId || null;
    const newStatus = targetCoachId ? (task.status === 'Pending' ? 'Assigned' : task.status) : 'Pending';

    const payload = {
      assigned_to_coach_id: targetCoachId,
      status: newStatus
    };

    try {
      const res = await _dbQuery('PATCH', 'tasks', payload, `?id=eq.${taskId}`);
      const updated = Array.isArray(res) ? res[0] : res;

      // Log audit trail if status changed or assignee changed
      if (task.status !== newStatus || task.assigned_to_coach_id !== targetCoachId) {
        await _writeAuditHistory(
          taskId,
          task.status,
          newStatus,
          assignedByCoachId,
          targetCoachId ? `Assigned to coach ${targetCoachId}` : 'Coach unassigned'
        );
      }

      return { success: true, data: updated };
    } catch (err) {
      return { success: false, error: err.message || 'Database error assigning coach.' };
    }
  }

  /**
   * Core state machine task status transition handler.
   */
  async function updateStatus(taskId, newStatus, actingCoachId = null, notes = null) {
    if (!taskId || !newStatus) {
      return { success: false, error: 'taskId and newStatus are required.' };
    }

    const existing = await getTaskById(taskId);
    if (!existing.success || !existing.data) {
      return { success: false, error: existing.error || 'Task not found.' };
    }

    const task = existing.data;
    const currentStatus = task.status;

    // Validate state transition
    const transitionCheck = validateTransition(currentStatus, newStatus);
    if (!transitionCheck.valid) {
      return { success: false, error: transitionCheck.error };
    }

    // Prepare payload & timestamps
    const payload = { status: newStatus };
    const nowIso = new Date().toISOString();

    if (newStatus === 'Completed' && !task.completed_at) {
      payload.completed_at = nowIso;
    }
    if (newStatus === 'Closed' && !task.closed_at) {
      payload.closed_at = nowIso;
    }

    try {
      const res = await _dbQuery('PATCH', 'tasks', payload, `?id=eq.${taskId}`);
      const updated = Array.isArray(res) ? res[0] : res;

      // Mandatory audit history insertion
      await _writeAuditHistory(
        taskId,
        currentStatus,
        newStatus,
        actingCoachId,
        notes || `Status changed from ${currentStatus} to ${newStatus}`
      );

      return { success: true, data: updated };
    } catch (err) {
      return { success: false, error: err.message || 'Database error updating task status.' };
    }
  }

  /**
   * Soft delete (Cancel) a task.
   */
  async function cancelTask(taskId, actingCoachId = null, reasonNotes = null) {
    return updateStatus(taskId, 'Cancelled', actingCoachId, reasonNotes || 'Task cancelled');
  }

  /**
   * Fetch complete audit trail for a task.
   */
  async function getTaskHistory(taskId) {
    if (!taskId) {
      return { success: false, error: 'taskId is required.' };
    }

    try {
      const history = await _dbQuery('GET', 'task_history', null, `?task_id=eq.${taskId}&order=created_at.desc`);
      return { success: true, data: Array.isArray(history) ? history : [] };
    } catch (err) {
      return { success: false, error: err.message || 'Database error fetching task history.' };
    }
  }

  // ── PUBLIC EXPORTS ──
  window.PulseIQ_TaskService = {
    createTask: createTask,
    getTaskById: getTaskById,
    listTasks: listTasks,
    updateTask: updateTask,
    assignCoach: assignCoach,
    updateStatus: updateStatus,
    cancelTask: cancelTask,
    getTaskHistory: getTaskHistory,
    validateTransition: validateTransition,
    getValidNextStatuses: getValidNextStatuses,
    version: '1.0.0'
  };

})(typeof window !== 'undefined' ? window : global);
