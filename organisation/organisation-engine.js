/**
 * PulseIQ Phase 3.2 — Multi-Location & Organisation Management
 * Organisation Engine
 * 
 * Manages enterprise organisation definitions, regional settings, and metadata.
 * ZERO DATABASE MUTATIONS. 100% ADDITIVE ARCHITECTURE.
 */

(function(window) {
  'use strict';

  const DEFAULT_ORGANISATIONS = [
    {
      id: 'org-pulsezen-1',
      name: 'PulseZen Wellness Centers Pvt Ltd',
      code: 'PULSEZEN_IND',
      status: 'active',
      settings: {
        currency: 'INR',
        currencySymbol: '₹',
        timeZone: 'Asia/Kolkata',
        language: 'en-IN'
      }
    },
    {
      id: 'org-pulsezen-intl',
      name: 'PulseZen Global Wellness LLC',
      code: 'PULSEZEN_INTL',
      status: 'active',
      settings: {
        currency: 'USD',
        currencySymbol: '$',
        timeZone: 'America/New_York',
        language: 'en-US'
      }
    }
  ];

  function getOrganisations() {
    return DEFAULT_ORGANISATIONS.slice();
  }

  function getOrganisationById(id) {
    return DEFAULT_ORGANISATIONS.find(o => o.id === id) || DEFAULT_ORGANISATIONS[0];
  }

  window.PulseIQ_OrganisationEngine = {
    getOrganisations: getOrganisations,
    getOrganisationById: getOrganisationById
  };

})(typeof window !== 'undefined' ? window : global);
