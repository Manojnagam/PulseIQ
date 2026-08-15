/**
 * PulseIQ Phase 3.6 — Performance Optimisation & Scalability
 * Cache Manager
 * 
 * Shared LRU / TTL caching engine supporting pattern invalidation and multi-tenant scoping.
 * PRESERVES DETERMINISTIC COMPUTATION. ZERO LOGIC ALTERATION.
 */

(function(window) {
  'use strict';

  const cacheStore = new Map();
  const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

  function buildScopedKey(key) {
    const ctx = window.PulseIQ_ContextManager
      ? window.PulseIQ_ContextManager.getActiveContext()
      : { organisation: { id: 'org-pulsezen-1' }, centre: { id: 'ctr-hyd-1' } };
    return `${ctx.organisation.id}:${ctx.centre.id}:${key}`;
  }

  function set(key, val, ttlMs) {
    const fullKey = buildScopedKey(key);
    const expiresAt = Date.now() + (ttlMs || DEFAULT_TTL_MS);
    cacheStore.set(fullKey, { val: val, expiresAt: expiresAt });
    return val;
  }

  function get(key) {
    const fullKey = buildScopedKey(key);
    const entry = cacheStore.get(fullKey);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      cacheStore.delete(fullKey);
      return null;
    }
    return entry.val;
  }

  function invalidate(pattern) {
    const regex = new RegExp(pattern);
    for (const k of cacheStore.keys()) {
      if (regex.test(k)) {
        cacheStore.delete(k);
      }
    }
  }

  function clear() {
    cacheStore.clear();
  }

  window.PulseIQ_CacheManager = {
    set: set,
    get: get,
    invalidate: invalidate,
    clear: clear,
    size: function() { return cacheStore.size; }
  };

})(typeof window !== 'undefined' ? window : global);
