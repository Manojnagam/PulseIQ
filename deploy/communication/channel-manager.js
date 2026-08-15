/**
 * PulseIQ Phase 3.3 — Notification & Communication Hub
 * Channel Manager
 * 
 * Defines communication channel capabilities, icons, and status flags.
 */

(function(window) {
  'use strict';

  const CHANNELS = {
    in_app: { id: 'in_app', name: 'In-App Notification', icon: '🔔', status: 'active' },
    whatsapp: { id: 'whatsapp', name: 'WhatsApp Web API', icon: '💬', status: 'active' },
    sms: { id: 'sms', name: 'SMS Gateway', icon: '📱', status: 'simulation' },
    email: { id: 'email', name: 'Email Dispatch', icon: '📧', status: 'simulation' }
  };

  function getChannels() {
    return { ...CHANNELS };
  }

  function getChannel(channelId) {
    return CHANNELS[channelId] || CHANNELS.in_app;
  }

  window.PulseIQ_ChannelManager = {
    getChannels: getChannels,
    getChannel: getChannel
  };

})(typeof window !== 'undefined' ? window : global);
