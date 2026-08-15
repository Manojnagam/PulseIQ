/**
 * PulseIQ Phase 3.3 — Notification & Communication Hub
 * Preference Manager
 * 
 * Manages user notification opt-in/opt-out preferences across channels and categories.
 */

(function(window) {
  'use strict';

  const STORAGE_KEY = 'pulseiq_comm_prefs_v1';

  const DEFAULT_PREFERENCES = {
    in_app: true,
    whatsapp: true,
    sms: true,
    email: false
  };

  function getPreferences(userId) {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY + '_' + (userId || 'default'));
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return { ...DEFAULT_PREFERENCES };
  }

  function updatePreferences(userId, prefs) {
    const updated = { ...getPreferences(userId), ...prefs };
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY + '_' + (userId || 'default'), JSON.stringify(updated));
      } catch (e) {}
    }
    return updated;
  }

  function isChannelAllowed(userId, channel) {
    const prefs = getPreferences(userId);
    return prefs[channel] !== false;
  }

  window.PulseIQ_CommPreferenceManager = {
    getPreferences: getPreferences,
    updatePreferences: updatePreferences,
    isChannelAllowed: isChannelAllowed
  };

})(typeof window !== 'undefined' ? window : global);
