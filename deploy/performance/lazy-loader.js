/**
 * PulseIQ Phase 3.6 — Performance Optimisation & Scalability
 * Lazy Loader
 * 
 * On-demand script & module loading architecture for token & memory optimization.
 */

(function(window) {
  'use strict';

  const loadedScripts = new Set();

  function loadScriptOnDemand(src) {
    if (loadedScripts.has(src)) {
      return Promise.resolve(true);
    }

    return new Promise((resolve, reject) => {
      if (typeof document === 'undefined') {
        loadedScripts.add(src);
        resolve(true);
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.defer = true;
      script.onload = () => {
        loadedScripts.add(src);
        resolve(true);
      };
      script.onerror = (err) => reject(err);
      document.head.appendChild(script);
    });
  }

  function isLoaded(src) {
    return loadedScripts.has(src);
  }

  window.PulseIQ_LazyLoader = {
    loadScriptOnDemand: loadScriptOnDemand,
    isLoaded: isLoaded
  };

})(typeof window !== 'undefined' ? window : global);
