/**
 * PulseIQ Phase 3.7 — SaaS Enablement
 * SaaS Renderer & UI Manager
 * 
 * Renders Active Subscription Plan, Usage Gauges, Billing History & Plan Upgrades UI.
 */

(function(window) {
  'use strict';

  function renderSaaSDashboard(containerId) {
    if (typeof document === 'undefined') return;

    const el = document.getElementById(containerId || 'sec-saas-dashboard');
    if (!el) return;

    const ctx = window.PulseIQ_ContextManager ? window.PulseIQ_ContextManager.getActiveContext() : null;
    const orgId = ctx ? ctx.organisation.id : 'org-pulsezen-1';

    const sub = window.PulseIQ_SaaSSubscriptionEngine ? window.PulseIQ_SaaSSubscriptionEngine.getSubscription(orgId) : { plan: { name: 'Enterprise' } };
    const usage = window.PulseIQ_SaaSUsageEngine ? window.PulseIQ_SaaSUsageEngine.getUsage(orgId) : { customerUsagePct: 15, centreUsagePct: 20 };
    const invoices = window.PulseIQ_SaaSBillingEngine ? window.PulseIQ_SaaSBillingEngine.getInvoices(orgId) : [];

    let html = '';
    html += '<div class="tcard" style="padding:24px;background:rgba(24,24,27,0.85);backdrop-filter:blur(16px);border:1.5px solid rgba(56,189,248,0.3);margin-bottom:24px">';
    html += '  <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;margin-bottom:16px">';
    html += '    <div>';
    html += '      <div style="font-size:12px;font-weight:700;color:#38bdf8;text-transform:uppercase;letter-spacing:1px">💼 SaaS Tenant & Subscription Management</div>';
    html += '      <div style="font-family:\'Space Grotesk\',sans-serif;font-size:24px;font-weight:800;color:var(--text);margin-top:2px">Active Plan: <span style="color:#27AE60">' + sub.plan.name + '</span></div>';
    html += '    </div>';
    html += '    <div style="display:flex;gap:8px">';
    html += '      <button onclick="PulseIQ_SaaSSubscriptionEngine.upgradePlan(\'' + orgId + '\', \'enterprise\'); alert(\'Upgraded to Enterprise Plan!\')" class="btn-p" style="padding:8px 14px;font-size:12px">⚡ Upgrade Plan</button>';
    html += '    </div>';
    html += '  </div>';

    // Usage Progress Bars
    html += '  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-top:16px">';
    html += '    <div style="padding:14px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06)">';
    html += '      <div style="font-size:12.5px;font-weight:700;color:var(--text)">🏢 Wellness Centres Usage</div>';
    html += '      <div style="font-size:16px;font-weight:800;color:#38bdf8;margin:6px 0">' + usage.centresUsed + ' / ' + usage.centresLimit + ' Centres</div>';
    html += '      <div style="height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden"><div style="width:' + usage.centreUsagePct + '%;height:100%;background:#38bdf8"></div></div>';
    html += '    </div>';

    html += '    <div style="padding:14px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06)">';
    html += '      <div style="font-size:12.5px;font-weight:700;color:var(--text)">👤 Active Customers Usage</div>';
    html += '      <div style="font-size:16px;font-weight:800;color:#27AE60;margin:6px 0">' + usage.customersUsed + ' / ' + usage.customersLimit + ' Members</div>';
    html += '      <div style="height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden"><div style="width:' + usage.customerUsagePct + '%;height:100%;background:#27AE60"></div></div>';
    html += '    </div>';
    html += '  </div>';
    html += '</div>';

    el.innerHTML = html;
  }

  window.PulseIQ_SaaSRenderer = {
    renderSaaSDashboard: renderSaaSDashboard
  };

})(typeof window !== 'undefined' ? window : global);
