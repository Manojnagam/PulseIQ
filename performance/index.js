/**
 * PulseIQ Phase 3.6 — Performance Optimisation & Scalability
 * Main Orchestrator & Public API Namespace
 * 
 * Exposes PulseIQ_Performance public API encapsulating Shared Cache Management,
 * Lazy Loading, Background Worker Offloading, Benchmarking & Optimisations.
 */

(function(window) {
  'use strict';

  window.PulseIQ_Performance = {
    Cache: window.PulseIQ_CacheManager || {},
    LazyLoader: window.PulseIQ_LazyLoader || {},
    Worker: window.PulseIQ_WorkerManager || {},
    Benchmark: window.PulseIQ_BenchmarkEngine || {},
    Optimisation: window.PulseIQ_OptimisationEngine || {},
    Renderer: window.PulseIQ_PerformanceRenderer || {},
    version: '3.6.0'
  };

})(typeof window !== 'undefined' ? window : global);
