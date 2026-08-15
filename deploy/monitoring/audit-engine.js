/**
 * PulseIQ Phase 3.5 — Audit Logs, Monitoring & Observability
 * Audit Engine
 * 
 * Aggregates security, notification, report, and system events into a central audit timeline.
 * ZERO SOURCE MODULE MUTATION. CONSUMES PUBLISHED OUTPUTS ONLY.
 */

(function(window) {
  'use strict';

  function getUnifiedAuditTimeline(orgId, centreId) {
    const timeline = [];

    // 1. Security Audit Logs
    if (window.PulseIQ_Security && window.PulseIQ_Security.Audit) {
      const secLogs = window.PulseIQ_Security.Audit.getAuditLogs() || [];
      secLogs.forEach(l => {
        timeline.push({
          id: l.id,
          timestamp: l.timestamp,
          source: 'SECURITY',
          type: l.type,
          actor: l.user ? (l.user.email || l.user.name) : 'System',
          role: l.user ? l.user.roleId : 'guest',
          message: `Security Event: ${l.type} by ${l.user ? l.user.email : 'System'}`,
          severity: l.type === 'PERMISSION_DENIED' || l.type === 'FAILED_LOGIN' ? 'warning' : 'info'
        });
      });
    }

    // 2. Notification Delivery Logs
    if (window.PulseIQ_Communication && window.PulseIQ_Communication.Queue) {
      const commLogs = window.PulseIQ_Communication.Queue.getQueue(orgId, centreId) || [];
      commLogs.forEach(c => {
        timeline.push({
          id: c.id,
          timestamp: c.timestamp,
          source: 'COMMUNICATION',
          type: 'NOTIFICATION_DISPATCH',
          actor: 'NotificationHub',
          role: 'system',
          message: `[${c.channel.toUpperCase()}] ${c.title} -> ${c.recipientName}`,
          severity: 'info'
        });
      });
    }

    // 3. Report Generation Logs
    if (window.PulseIQ_Reporting && window.PulseIQ_Reporting.Scheduler) {
      const reportJobs = window.PulseIQ_Reporting.Scheduler.getSchedules(orgId, centreId) || [];
      reportJobs.forEach(j => {
        if (j.lastRunAt) {
          timeline.push({
            id: j.id,
            timestamp: j.lastRunAt,
            source: 'REPORTING',
            type: 'REPORT_GENERATED',
            actor: j.recipientEmail || 'ScheduledJob',
            role: 'system',
            message: `Report Generated: ${j.reportType} (${j.frequency})`,
            severity: 'info'
          });
        }
      });
    }

    // Sort chronologically descending
    timeline.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return timeline;
  }

  window.PulseIQ_MonitoringAuditEngine = {
    getUnifiedAuditTimeline: getUnifiedAuditTimeline
  };

})(typeof window !== 'undefined' ? window : global);
