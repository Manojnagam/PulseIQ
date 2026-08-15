/**
 * PulseIQ Phase 3.2 — Multi-Location & Organisation Management
 * Main Orchestrator & Public API Namespace
 * 
 * Exposes PulseIQ_Organisation public API encapsulating Organisations,
 * Locations/Centres, Context Switching, and Cross-Centre Analytics.
 */

(function(window) {
  'use strict';

  window.PulseIQ_Organisation = {
    Organisations: window.PulseIQ_OrganisationEngine || {},
    Locations: window.PulseIQ_LocationEngine || {},
    Context: window.PulseIQ_ContextManager || {},
    Renderer: window.PulseIQ_OrganisationRenderer || {},
    version: '3.2.0'
  };

})(typeof window !== 'undefined' ? window : global);
