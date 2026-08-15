/**
 * PulseIQ Phase 3.3 — Notification & Communication Hub
 * Notification Engine
 * 
 * Scans published outputs from Phase 2 modules and enqueues scoped notification payloads.
 * ZERO SOURCE MODULE MUTATION. CONSUMES PUBLISHED OUTPUTS ONLY.
 */

(function(window) {
  'use strict';

  function scanAndDispatch(sourceData) {
    const D = sourceData || window.D || {};

    // Get active context safely
    const ctx = window.PulseIQ_ContextManager
      ? window.PulseIQ_ContextManager.getActiveContext()
      : { organisation: { id: 'org-pulsezen-1' }, centre: { id: 'ctr-hyd-1', name: 'PulseZen Hyderabad Main' } };

    const orgId = ctx.organisation.id;
    const centreId = ctx.centre.id;
    const centerName = ctx.centre.name;

    // 1. Consume Action Centre Tasks
    const tasks = window.PulseIQ_ActionCenter ? window.PulseIQ_ActionCenter.getTasks() : [];
    tasks.filter(t => t.priority === 'HIGH').forEach(t => {
      const body = window.PulseIQ_CommTemplateEngine
        ? window.PulseIQ_CommTemplateEngine.renderTemplate('ACTION_TASK', 'in_app', { taskTitle: t.title, taskReason: t.reason })
        : t.reason;

      if (window.PulseIQ_CommDeliveryQueue) {
        window.PulseIQ_CommDeliveryQueue.enqueue({
          category: 'ACTION_TASK',
          channel: 'in_app',
          recipientId: 'manager',
          recipientName: 'Centre Manager',
          title: '🔴 Urgent: ' + t.title,
          body: body,
          orgId: orgId,
          centreId: centreId
        });
      }
    });

    // 2. Consume High-Risk Customer Follow-ups
    const risks = window.PulseIQ_CustomerRisk ? window.PulseIQ_CustomerRisk.getProfiles() : [];
    risks.filter(r => r.riskLevel === 'HIGH').slice(0, 3).forEach(r => {
      const body = window.PulseIQ_CommTemplateEngine
        ? window.PulseIQ_CommTemplateEngine.renderTemplate('RISK_OUTREACH', 'whatsapp', { customerName: r.customerName, centerName: centerName, daysAbsent: r.daysAbsent })
        : 'Outreach needed for ' + r.customerName;

      if (window.PulseIQ_CommDeliveryQueue) {
        window.PulseIQ_CommDeliveryQueue.enqueue({
          category: 'RISK_OUTREACH',
          channel: 'whatsapp',
          recipientId: r.customerId,
          recipientName: r.customerName,
          title: '💬 Customer Retention Check-in: ' + r.customerName,
          body: body,
          orgId: orgId,
          centreId: centreId
        });
      }
    });

    return window.PulseIQ_CommDeliveryQueue ? window.PulseIQ_CommDeliveryQueue.getQueue(orgId, centreId) : [];
  }

  window.PulseIQ_NotificationEngine = {
    scanAndDispatch: scanAndDispatch
  };

})(typeof window !== 'undefined' ? window : global);
