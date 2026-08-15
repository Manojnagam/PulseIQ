/**
 * PulseIQ Phase 3.5 — Audit Logs, Monitoring & Observability
 * Event Log Recorder
 * 
 * Captures operational events, errors, and system telemetry in real-time.
 */

(function(window) {
  'use strict';

  const STORAGE_KEY = 'pulseiq_monitoring_events_v1';
  let events = [];

  function loadEvents() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) events = JSON.parse(saved);
      } catch (e) {
        events = [];
      }
    }
  }

  function saveEvents() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-150))); // Keep last 150 events
      } catch (e) {}
    }
  }

  function recordEvent(source, type, message, severity, metadata) {
    loadEvents();

    const entry = {
      id: 'event-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      timestamp: new Date().toISOString(),
      source: source || 'SYSTEM',
      type: type || 'OPERATIONAL_EVENT',
      message: message || '',
      severity: severity || 'info', // info, warning, error
      metadata: metadata || {}
    };

    events.push(entry);
    saveEvents();
    return entry;
  }

  function getEvents(severityFilter) {
    loadEvents();
    if (severityFilter) {
      return events.filter(e => e.severity === severityFilter);
    }
    return events.slice();
  }

  window.PulseIQ_MonitoringEventLog = {
    recordEvent: recordEvent,
    getEvents: getEvents,
    clearEvents: function() { events = []; saveEvents(); }
  };

})(typeof window !== 'undefined' ? window : global);
