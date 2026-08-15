/**
 * PulseIQ Phase 3.2 — Multi-Location & Organisation Management
 * Context Manager
 * 
 * Manages active Organisation and Wellness Centre context switching.
 * Integrates with Phase 3.1 Security RBAC to enforce location access bounds.
 */

(function(window) {
  'use strict';

  const STORAGE_KEY = 'pulseiq_active_org_context_v1';

  let currentOrgId = 'org-pulsezen-1';
  let currentCentreId = 'ctr-hyd-1';

  function loadContext() {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const saved = window.sessionStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          currentOrgId = parsed.orgId || currentOrgId;
          currentCentreId = parsed.centreId || currentCentreId;
        }
      } catch (e) {}
    }
  }

  function saveContext() {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
          orgId: currentOrgId,
          centreId: currentCentreId
        }));
      } catch (e) {}
    }
  }

  function getActiveContext() {
    loadContext();
    const org = window.PulseIQ_OrganisationEngine
      ? window.PulseIQ_OrganisationEngine.getOrganisationById(currentOrgId)
      : { id: currentOrgId, name: 'PulseZen Wellness Centers', settings: { currency: 'INR', timeZone: 'Asia/Kolkata' } };

    const centre = window.PulseIQ_LocationEngine
      ? window.PulseIQ_LocationEngine.getCentreById(currentCentreId)
      : { id: currentCentreId, name: 'PulseZen Hyderabad Main', city: 'Hyderabad' };

    return {
      organisation: org,
      centre: centre,
      currency: org.settings.currency || 'INR',
      currencySymbol: org.settings.currencySymbol || '₹',
      timeZone: org.settings.timeZone || 'Asia/Kolkata'
    };
  }

  function switchCentre(newCentreId) {
    // Check security permissions if security module is present
    if (window.PulseIQ_Security && window.PulseIQ_Security.Auth) {
      const user = window.PulseIQ_Security.Auth.currentUser();
      const isCrossAdmin = user.roleId === 'sys_admin' || user.roleId === 'org_owner';
      if (!isCrossAdmin && user.assignedCentreId && user.assignedCentreId !== newCentreId) {
        console.warn(`[PulseIQ Context] Branch switch blocked for user role '${user.roleId}'`);
        return { success: false, error: 'Permission denied: User restricted to assigned centre.' };
      }
    }

    currentCentreId = newCentreId;

    // Auto-update orgId if centre belongs to a different organisation
    if (window.PulseIQ_LocationEngine) {
      const targetCentre = window.PulseIQ_LocationEngine.getCentreById(newCentreId);
      if (targetCentre && targetCentre.orgId) {
        currentOrgId = targetCentre.orgId;
      }
    }

    saveContext();

    // Trigger dashboard refresh if Executive Dashboard renderer is active
    if (window.PulseIQ_ExecutiveDashboard && typeof window.PulseIQ_ExecutiveDashboard.refreshDashboard === 'function') {
      window.PulseIQ_ExecutiveDashboard.refreshDashboard(window.D);
    }

    return { success: true, context: getActiveContext() };
  }

  function switchOrganisation(newOrgId) {
    currentOrgId = newOrgId;

    if (window.PulseIQ_LocationEngine) {
      const centres = window.PulseIQ_LocationEngine.getCentresByOrg(newOrgId);
      if (centres.length > 0) {
        currentCentreId = centres[0].id;
      }
    }

    saveContext();
    return { success: true, context: getActiveContext() };
  }

  window.PulseIQ_ContextManager = {
    getActiveContext: getActiveContext,
    switchCentre: switchCentre,
    switchOrganisation: switchOrganisation
  };

})(typeof window !== 'undefined' ? window : global);
