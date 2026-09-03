/**
 * PulseIQ In-Flight Network GET Deduplication Module (v2.3.21)
 * 
 * Collapses concurrent identical GET/HEAD requests into a single in-flight fetch.
 * ZERO response caching, ZERO TTL, ZERO staleness:
 * - A request is shared ONLY while an identical one is actively in flight.
 * - Once it settles (resolves or rejects), subsequent requests hit the network directly.
 * - Every concurrent caller receives an independent cloned Response body.
 * - Never touches mutations (POST/PUT/PATCH/DELETE) or auth/token endpoints.
 * - Silent counter (window.__dedupHits), zero console noise.
 */
(function() {
  'use strict';

  window.__dedupHits = window.__dedupHits || 0;

  if (typeof window === 'undefined' || !window.fetch || window.fetch.__dedupWrapped) {
    return;
  }

  var origFetch = window.fetch;
  var inFlightMap = new Map();

  // Clear map on pagehide and background visibility change
  window.addEventListener('pagehide', function() {
    inFlightMap.clear();
  });

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'hidden') {
        inFlightMap.clear();
      }
    });
  }

  function extractAuthHeader(headers) {
    if (!headers) return '';
    try {
      if (typeof headers.get === 'function') {
        return headers.get('Authorization') || headers.get('authorization') || '';
      }
      if (Array.isArray(headers)) {
        for (var i = 0; i < headers.length; i++) {
          var pair = headers[i];
          if (pair && String(pair[0]).toLowerCase() === 'authorization') {
            return String(pair[1]);
          }
        }
        return '';
      }
      if (typeof headers === 'object') {
        return headers['Authorization'] || headers['authorization'] || headers['AUTHORIZATION'] || '';
      }
    } catch (e) {}
    return '';
  }

  var wrappedFetch = function(input, init) {
    var url = '';
    var method = 'GET';
    var hasBody = false;
    var authHeader = '';

    try {
      // Determine URL
      if (typeof input === 'string') {
        url = input;
      } else if (input && typeof input === 'object' && input.url) {
        url = input.url;
      } else if (input && typeof input.toString === 'function') {
        url = input.toString();
      } else {
        url = String(input);
      }

      // Determine Method
      if (init && init.method) {
        method = String(init.method).toUpperCase();
      } else if (input && input.method) {
        method = String(input.method).toUpperCase();
      }

      // Determine Body presence
      if (init && init.body !== undefined && init.body !== null) {
        hasBody = true;
      } else if (input && input.body !== undefined && input.body !== null) {
        hasBody = true;
      }

      // Extract Authorization header if present
      authHeader = extractAuthHeader(init && init.headers) || extractAuthHeader(input && input.headers);
    } catch (err) {
      // If parsing fails for any reason, pass through directly to original fetch
      return origFetch.apply(this, arguments);
    }

    // Safety checks: ONLY dedup GET and HEAD with no body
    if ((method !== 'GET' && method !== 'HEAD') || hasBody) {
      return origFetch.apply(this, arguments);
    }

    // Safety check: Never dedup auth or token endpoints
    if (url.indexOf('/auth/') !== -1 || url.indexOf('/token') !== -1) {
      return origFetch.apply(this, arguments);
    }

    // Compose in-flight key
    var key = method + ' ' + url + (authHeader ? (' ' + authHeader) : '');

    // If identical request is already in flight, collapse and return per-caller cloned response
    if (inFlightMap.has(key)) {
      window.__dedupHits++;
      return inFlightMap.get(key).then(function(res) {
        return res.clone();
      });
    }

    // If map reached capacity limit (100), pass through directly
    if (inFlightMap.size >= 100) {
      return origFetch.apply(this, arguments);
    }

    // Issue network fetch and register master promise
    var masterPromise = origFetch.apply(this, arguments).then(function(res) {
      inFlightMap.delete(key);
      return res;
    }, function(err) {
      inFlightMap.delete(key);
      return Promise.reject(err);
    });

    inFlightMap.set(key, masterPromise);

    return masterPromise.then(function(res) {
      return res.clone();
    });
  };

  wrappedFetch.__dedupWrapped = true;
  wrappedFetch.__orig = origFetch;
  window.fetch = wrappedFetch;
})();
