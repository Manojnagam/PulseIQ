/**
 * PulseIQ Phase 3.8 — Payment Gateway Integration & Financial Operations
 * Main Orchestrator & Public API Namespace
 * 
 * Exposes PulseIQ_Payments public API encapsulating Payment Engine, Gateway Adapters,
 * Invoice Engine, Reconciliation Engine, Refund Engine, & Financial UI Renderer.
 */

(function(window) {
  'use strict';

  window.PulseIQ_Payments = {
    Engine: window.PulseIQ_PaymentEngine || {},
    Gateway: window.PulseIQ_GatewayAdapter || {},
    Invoice: window.PulseIQ_InvoiceEngine || {},
    Reconciliation: window.PulseIQ_ReconciliationEngine || {},
    Refund: window.PulseIQ_RefundEngine || {},
    Renderer: window.PulseIQ_PaymentRenderer || {},
    version: '3.8.0'
  };

  // Auto-render financial dashboard if container present on page load
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function() {
      if (document.getElementById('sec-payments') && window.PulseIQ_PaymentRenderer) {
        window.PulseIQ_PaymentRenderer.renderPaymentDashboard('sec-payments');
      }
    });
  }

})(typeof window !== 'undefined' ? window : global);
