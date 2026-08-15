/**
 * PulseIQ Phase 3.3 — Notification & Communication Hub
 * Main Orchestrator & Public API Namespace
 * 
 * Exposes PulseIQ_Communication public API encapsulating Templates, Channels,
 * Preferences, Delivery Queue, Notification Engine, and UI Renderers.
 */

(function(window) {
  'use strict';

  window.PulseIQ_Communication = {
    Templates: window.PulseIQ_CommTemplateEngine || {},
    Channels: window.PulseIQ_ChannelManager || {},
    Preferences: window.PulseIQ_CommPreferenceManager || {},
    Queue: window.PulseIQ_CommDeliveryQueue || {},
    Engine: window.PulseIQ_NotificationEngine || {},
    Renderer: window.PulseIQ_CommunicationRenderer || {},
    version: '3.3.0'
  };

})(typeof window !== 'undefined' ? window : global);
