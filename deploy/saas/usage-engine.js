/**
 * PulseIQ Phase 3.7 — SaaS Enablement
 * Usage Engine
 * 
 * Tracks active resource usage against subscription plan allowances.
 */

(function(window) {
  'use strict';

  function getUsage(orgId) {
    const sub = window.PulseIQ_SaaSSubscriptionEngine ? window.PulseIQ_SaaSSubscriptionEngine.getSubscription(orgId) : { plan: { maxCentres: 5, maxCustomers: 1000 } };
    const centres = window.PulseIQ_LocationEngine ? window.PulseIQ_LocationEngine.getCentresByOrg(orgId) : [];
    const customerCount = (window.D && window.D.customers) ? window.D.customers.length : 25;

    return {
      centresUsed: Math.max(1, centres.length),
      centresLimit: sub.plan.maxCentres,
      customersUsed: customerCount,
      customersLimit: sub.plan.maxCustomers,
      centreUsagePct: Math.round((Math.max(1, centres.length) / sub.plan.maxCentres) * 100),
      customerUsagePct: Math.round((customerCount / sub.plan.maxCustomers) * 100)
    };
  }

  function isLimitExceeded(orgId, metric) {
    const usage = getUsage(orgId);
    if (metric === 'centres') return usage.centresUsed >= usage.centresLimit;
    if (metric === 'customers') return usage.customersUsed >= usage.customersLimit;
    return false;
  }

  window.PulseIQ_SaaSUsageEngine = {
    getUsage: getUsage,
    isLimitExceeded: isLimitExceeded
  };

})(typeof window !== 'undefined' ? window : global);
