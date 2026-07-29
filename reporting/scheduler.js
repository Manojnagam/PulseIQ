/**
 * PulseIQ Phase 3.4 — Reporting, Export & Document Generation
 * Report Scheduler
 * 
 * Manages automated report execution schedules (Daily, Weekly, Monthly, On-Demand).
 * ZERO EXTERNAL CRON DEPENDENCY. PURE ARCHITECTURAL DISPATCH.
 */

(function(window) {
  'use strict';

  const STORAGE_KEY = 'pulseiq_report_schedules_v1';
  let schedules = [];

  function loadSchedules() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) schedules = JSON.parse(saved);
      } catch (e) {
        schedules = [];
      }
    }
  }

  function saveSchedules() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules));
      } catch (e) {}
    }
  }

  function scheduleReport(reportType, frequency, recipientEmail) {
    loadSchedules();

    const ctx = window.PulseIQ_ContextManager
      ? window.PulseIQ_ContextManager.getActiveContext()
      : { organisation: { id: 'org-pulsezen-1' }, centre: { id: 'ctr-hyd-1' } };

    const job = {
      id: 'job-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      reportType: reportType || 'EXECUTIVE_SUMMARY',
      frequency: frequency || 'WEEKLY', // DAILY, WEEKLY, MONTHLY, ON_DEMAND
      recipientEmail: recipientEmail || 'manager@pulsezen.in',
      orgId: ctx.organisation.id,
      centreId: ctx.centre.id,
      createdAt: new Date().toISOString(),
      lastRunAt: null,
      status: 'active'
    };

    schedules.push(job);
    saveSchedules();
    return job;
  }

  function getSchedules(orgId, centreId) {
    loadSchedules();
    return schedules.filter(s => (!orgId || s.orgId === orgId) && (!centreId || s.centreId === centreId));
  }

  function runScheduledJobs() {
    loadSchedules();
    const results = [];
    schedules.forEach(job => {
      if (window.PulseIQ_ReportEngine) {
        const report = window.PulseIQ_ReportEngine.generateReport(job.reportType);
        job.lastRunAt = new Date().toISOString();
        results.push({ job: job, report: report });
      }
    });
    saveSchedules();
    return results;
  }

  window.PulseIQ_ReportScheduler = {
    scheduleReport: scheduleReport,
    getSchedules: getSchedules,
    runScheduledJobs: runScheduledJobs
  };

})(typeof window !== 'undefined' ? window : global);
