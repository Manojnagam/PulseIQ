/**
 * PulseIQ Phase 3.3 — Notification & Communication Hub
 * Communication Renderer & UI Manager
 * 
 * Renders Notification Bell, unread counters, and notification feed cards.
 */

(function(window) {
  'use strict';

  function renderNotificationBell(containerId) {
    if (typeof document === 'undefined') return;

    const el = document.getElementById(containerId || 'header-notification-bell');
    if (!el) return;

    const ctx = window.PulseIQ_ContextManager ? window.PulseIQ_ContextManager.getActiveContext() : null;
    const orgId = ctx ? ctx.organisation.id : null;
    const centreId = ctx ? ctx.centre.id : null;

    const queue = window.PulseIQ_CommDeliveryQueue ? window.PulseIQ_CommDeliveryQueue.getQueue(orgId, centreId) : [];
    const unreadCount = queue.filter(q => !q.isRead).length;

    let html = '';
    html += '<div style="position:relative;cursor:pointer;display:inline-flex;align-items:center" onclick="PulseIQ_CommunicationRenderer.toggleNotificationDrawer()">';
    html += '  <span style="font-size:18px">🔔</span>';
    if (unreadCount > 0) {
      html += '  <span style="position:absolute;top:-4px;right:-6px;background:#ef4444;color:#fff;font-size:10px;font-weight:800;padding:1px 5px;border-radius:10px">' + unreadCount + '</span>';
    }
    html += '</div>';

    el.innerHTML = html;
  }

  function toggleNotificationDrawer() {
    if (typeof document === 'undefined') return;

    let drawer = document.getElementById('pulseiq-notification-drawer');
    if (drawer) {
      drawer.style.display = drawer.style.display === 'none' ? 'block' : 'none';
      return;
    }

    // Build Drawer
    drawer = document.createElement('div');
    drawer.id = 'pulseiq-notification-drawer';
    drawer.style.cssText = 'position:fixed;top:60px;right:20px;width:340px;max-height:480px;background:rgba(24,24,27,0.95);backdrop-filter:blur(16px);border:1.5px solid rgba(56,189,248,0.3);border-radius:14px;box-shadow:0 20px 40px rgba(0,0,0,0.5);z-index:9999;padding:16px;overflow-y:auto;color:var(--text)';

    const ctx = window.PulseIQ_ContextManager ? window.PulseIQ_ContextManager.getActiveContext() : null;
    const queue = window.PulseIQ_CommDeliveryQueue ? window.PulseIQ_CommDeliveryQueue.getQueue(ctx ? ctx.organisation.id : null, ctx ? ctx.centre.id : null) : [];

    let html = '';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.1)">';
    html += '  <span style="font-family:\'Space Grotesk\',sans-serif;font-weight:800;font-size:14.5px">🔔 Notification Hub</span>';
    html += '  <button onclick="PulseIQ_CommDeliveryQueue.markAllAsRead(); PulseIQ_CommunicationRenderer.renderNotificationBell(); this.parentElement.parentElement.style.display=\'none\'" style="background:transparent;border:none;color:#38bdf8;font-size:11px;font-weight:700;cursor:pointer">Mark All Read</button>';
    html += '</div>';

    if (queue.length > 0) {
      queue.forEach(item => {
        const icon = item.channel === 'whatsapp' ? '💬' : '🔔';
        html += '<div style="padding:10px;margin-bottom:8px;border-radius:8px;background:' + (item.isRead ? 'rgba(255,255,255,0.03)' : 'rgba(56,189,248,0.1)') + ';border:1px solid ' + (item.isRead ? 'rgba(255,255,255,0.05)' : 'rgba(56,189,248,0.25)') + '">';
        html += '  <div style="font-weight:700;font-size:12.5px;color:var(--text)">' + icon + ' ' + item.title + '</div>';
        html += '  <div style="font-size:11.5px;color:var(--muted);margin-top:3px;line-height:1.4">' + item.body + '</div>';
        html += '</div>';
      });
    } else {
      html += '<div style="font-size:12px;color:var(--muted);text-align:center;padding:20px 0">No active notifications.</div>';
    }

    drawer.innerHTML = html;
    document.body.appendChild(drawer);
  }

  window.PulseIQ_CommunicationRenderer = {
    renderNotificationBell: renderNotificationBell,
    toggleNotificationDrawer: toggleNotificationDrawer
  };

})(typeof window !== 'undefined' ? window : global);
