/**
 * PulseIQ Phase 3.7 — SaaS Enablement
 * Plan Engine
 * 
 * Defines subscription tier plans (Starter, Professional, Enterprise) and feature entitlements.
 */

(function(window) {
  'use strict';

  const PLANS = {
    starter: {
      id: 'starter',
      name: 'Starter Plan',
      priceMonthly: 4999,
      maxCentres: 1,
      maxCustomers: 100,
      features: ['dashboard:read', 'customers:read', 'bi:read', 'action_center:read']
    },
    professional: {
      id: 'professional',
      name: 'Professional Plan',
      priceMonthly: 14999,
      maxCentres: 5,
      maxCustomers: 1000,
      features: [
        'dashboard:read', 'customers:read', 'customers:write',
        'coaches:read', 'finance:read', 'inventory:read', 'reports:read',
        'bi:read', 'action_center:read', 'action_center:execute',
        'customer_risk:read', 'coach_analytics:read', 'followup_queue:read',
        'goal_tracking:read', 'forecasting:read', 'executive_dashboard:read'
      ]
    },
    enterprise: {
      id: 'enterprise',
      name: 'Enterprise Plan',
      priceMonthly: 29999,
      maxCentres: 999,
      maxCustomers: 999999,
      features: ['*'] // Full entitlements
    }
  };

  function getPlans() {
    return { ...PLANS };
  }

  function getPlan(planId) {
    return PLANS[planId] || PLANS.professional;
  }

  window.PulseIQ_SaaSPlanEngine = {
    getPlans: getPlans,
    getPlan: getPlan
  };

})(typeof window !== 'undefined' ? window : global);
