/**
 * PulseIQ Phase 3.3 — Notification & Communication Hub
 * Delivery Queue
 * 
 * Manages notification queue state machine, org/centre scoping, and read/unread statuses.
 */

(function(window) {
  'use strict';

  const STORAGE_KEY = 'pulseiq_comm_queue_v1';
  let queue = [];

  function loadQueue() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) queue = JSON.parse(saved);
      } catch (e) {
        queue = [];
      }
    }
  }

  function saveQueue() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue.slice(-100))); // Store last 100 items
      } catch (e) {}
    }
  }

  function enqueue(payload) {
    loadQueue();

    const item = {
      id: 'notif-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      category: payload.category || 'ACTION_TASK',
      channel: payload.channel || 'in_app',
      recipientId: payload.recipientId || 'all',
      recipientName: payload.recipientName || 'Member',
      title: payload.title || 'Notification Alert',
      body: payload.body || '',
      orgId: payload.orgId || 'org-pulsezen-1',
      centreId: payload.centreId || 'ctr-hyd-1',
      status: 'delivered', // Simulation delivery state
      isRead: false,
      timestamp: new Date().toISOString()
    };

    // Avoid duplicate notifications in queue
    const exists = queue.some(q => q.title === item.title && q.recipientId === item.recipientId && q.isRead === false);
    if (!exists) {
      queue.unshift(item);
      saveQueue();
    }

    return item;
  }

  function getQueue(orgId, centreId) {
    loadQueue();
    return queue.filter(q => {
      const orgMatch = !orgId || q.orgId === orgId;
      const centreMatch = !centreId || q.centreId === centreId;
      return orgMatch && centreMatch;
    });
  }

  function markAsRead(notificationId) {
    loadQueue();
    const item = queue.find(q => q.id === notificationId);
    if (item) {
      item.isRead = true;
      saveQueue();
    }
    return item;
  }

  function markAllAsRead() {
    loadQueue();
    queue.forEach(q => q.isRead = true);
    saveQueue();
  }

  window.PulseIQ_CommDeliveryQueue = {
    enqueue: enqueue,
    getQueue: getQueue,
    markAsRead: markAsRead,
    markAllAsRead: markAllAsRead
  };

})(typeof window !== 'undefined' ? window : global);
