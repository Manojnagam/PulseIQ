/**
 * PulseIQ Phase 3.6 — Performance Optimisation & Scalability
 * Optimisation Engine
 * 
 * Provides memoization wrappers and array chunking algorithms for processing large datasets.
 */

(function(window) {
  'use strict';

  function memoize(fn) {
    const memoCache = new Map();
    return function(...args) {
      const key = JSON.stringify(args);
      if (memoCache.has(key)) {
        return memoCache.get(key);
      }
      const result = fn.apply(this, args);
      memoCache.set(key, result);
      return result;
    };
  }

  function chunkArray(arr, chunkSize) {
    if (!Array.isArray(arr)) return [];
    const size = chunkSize || 500;
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }

  window.PulseIQ_OptimisationEngine = {
    memoize: memoize,
    chunkArray: chunkArray
  };

})(typeof window !== 'undefined' ? window : global);
