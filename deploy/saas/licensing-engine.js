/**
 * PulseIQ Phase 3.7 — SaaS Enablement
 * Licensing Engine
 * 
 * Validates feature entitlements and license keys based on active subscription tier.
 */

(function(window) {
  'use strict';

  function isFeatureEntitled(featureKey, orgId) {
    const ctx = window.PulseIQ_ContextManager ? window.PulseIQ_ContextManager.getActiveContext() : null;
    const targetOrgId = orgId || (ctx ? ctx.organisation.id : 'org-pulsezen-1');

    const sub = window.PulseIQ_SaaSSubscriptionEngine ? window.PulseIQ_SaaSSubscriptionEngine.getSubscription(targetOrgId) : null;
    if (!sub || !sub.plan) return true;

    if (sub.plan.features.includes('*')) return true;

    return sub.plan.features.includes(featureKey);
  }

  window.PulseIQ_SaaSLicensingEngine = {
    isFeatureEntitled: isFeatureEntitled
  };

})(typeof window !== 'undefined' ? window : global);
