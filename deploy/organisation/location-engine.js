/**
 * PulseIQ Phase 3.2 — Multi-Location & Organisation Management
 * Location Engine
 * 
 * Manages wellness centre branch locations, addresses, contact metadata, and org mapping.
 */

(function(window) {
  'use strict';

  const DEFAULT_CENTRES = [
    {
      id: 'ctr-hyd-1',
      orgId: 'org-pulsezen-1',
      name: 'PulseZen Hyderabad Main',
      code: 'HYD_MAIN',
      city: 'Hyderabad',
      address: 'Banjara Hills, Road No. 12, Hyderabad',
      phone: '+91 40 1234 5678',
      status: 'active'
    },
    {
      id: 'ctr-blr-1',
      orgId: 'org-pulsezen-1',
      name: 'PulseZen Bangalore Central',
      code: 'BLR_CTRL',
      city: 'Bangalore',
      address: 'Indiranagar 100ft Road, Bangalore',
      phone: '+91 80 8765 4321',
      status: 'active'
    },
    {
      id: 'ctr-maa-1',
      orgId: 'org-pulsezen-1',
      name: 'PulseZen Chennai Club',
      code: 'MAA_CLUB',
      city: 'Chennai',
      address: 'Nungambakkam High Road, Chennai',
      phone: '+91 44 9876 5432',
      status: 'active'
    },
    {
      id: 'ctr-nyc-1',
      orgId: 'org-pulsezen-intl',
      name: 'PulseZen New York Studio',
      code: 'NYC_STUDIO',
      city: 'New York',
      address: '5th Avenue, Manhattan, NY',
      phone: '+1 212 555 0199',
      status: 'active'
    }
  ];

  function getAllCentres() {
    return DEFAULT_CENTRES.slice();
  }

  function getCentresByOrg(orgId) {
    return DEFAULT_CENTRES.filter(c => c.orgId === orgId);
  }

  function getCentreById(centreId) {
    return DEFAULT_CENTRES.find(c => c.id === centreId) || DEFAULT_CENTRES[0];
  }

  window.PulseIQ_LocationEngine = {
    getAllCentres: getAllCentres,
    getCentresByOrg: getCentresByOrg,
    getCentreById: getCentreById
  };

})(typeof window !== 'undefined' ? window : global);
