/**
 * PulseIQ Phase 3.8 — Payment Gateway Integration & Financial Operations
 * Refund Engine
 * 
 * Manages customer refund processing, partial refunds, gateway refund dispatch,
 * transaction/invoice status sync, and refund audit logs.
 */

(function(window) {
  'use strict';

  const STORAGE_KEY = 'pulseiq_refunds_v1';
  let refunds = [];

  function loadRefunds() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) refunds = JSON.parse(saved);
      } catch (e) {
        refunds = [];
      }
    }
  }

  function saveRefunds() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(refunds.slice(-200)));
      } catch (e) {}
    }
  }

  function checkSecurityPermission(permission) {
    if (window.PulseIQ_Security && window.PulseIQ_Security.Auth && typeof window.PulseIQ_Security.Auth.hasPermission === 'function') {
      return window.PulseIQ_Security.Auth.hasPermission(permission);
    }
    return true;
  }

  function processRefund(transactionId, amount, reason) {
    // 1. RBAC Check
    if (!checkSecurityPermission('finance:write')) {
      return { success: false, error: 'Permission denied: Requires finance:write permission.' };
    }

    if (!window.PulseIQ_PaymentEngine) {
      return { success: false, error: 'PaymentEngine not available.' };
    }

    const txs = window.PulseIQ_PaymentEngine.getTransactions();
    const tx = txs.find(t => t.id === transactionId || t.gatewayPaymentId === transactionId);

    if (!tx) {
      return { success: false, error: `Transaction '${transactionId}' not found.` };
    }

    if (tx.status !== 'successful' && tx.status !== 'partially_refunded') {
      return { success: false, error: `Cannot refund transaction in '${tx.status}' state.` };
    }

    loadRefunds();

    const refundAmount = parseFloat(amount) || tx.amount;
    if (refundAmount <= 0 || refundAmount > tx.amount) {
      return { success: false, error: `Invalid refund amount: ${refundAmount}. Maximum eligible is ${tx.amount}.` };
    }

    // 2. Dispatch to Gateway Adapter
    const gatewayRes = window.PulseIQ_GatewayAdapter
      ? window.PulseIQ_GatewayAdapter.processRefund(tx.provider, tx.gatewayPaymentId, refundAmount, reason)
      : { success: true, refundId: 'ref_' + Date.now(), status: 'SUCCESS' };

    if (!gatewayRes.success) {
      return { success: false, error: gatewayRes.error || 'Gateway refund execution failed.' };
    }

    const isFullRefund = refundAmount >= tx.amount;
    const newStatus = isFullRefund ? 'refunded' : 'partially_refunded';

    const refundEntry = {
      refundId: gatewayRes.refundId || ('ref-' + Date.now()),
      transactionId: tx.id,
      gatewayPaymentId: tx.gatewayPaymentId,
      customerId: tx.customerId,
      customerName: tx.customerName,
      amount: refundAmount,
      currency: tx.currency,
      reason: reason || 'Customer Refund Request',
      status: 'REFUNDED',
      provider: tx.provider,
      orgId: tx.orgId,
      centreId: tx.centreId,
      timestamp: new Date().toISOString()
    };

    refunds.unshift(refundEntry);
    saveRefunds();

    // 3. Sync status to PaymentEngine
    window.PulseIQ_PaymentEngine.updateTransactionStatus(tx.id, newStatus, {
      refundedAmount: refundAmount,
      refundId: refundEntry.refundId
    });

    // 4. Sync status to InvoiceEngine
    if (window.PulseIQ_InvoiceEngine) {
      window.PulseIQ_InvoiceEngine.updateInvoiceStatus(tx.id, isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED');
    }

    return {
      success: true,
      refund: refundEntry,
      transactionStatus: newStatus
    };
  }

  function getRefunds(orgId, centreId) {
    loadRefunds();
    return refunds.filter(r => (!orgId || r.orgId === orgId) && (!centreId || r.centreId === centreId));
  }

  window.PulseIQ_RefundEngine = {
    processRefund: processRefund,
    getRefunds: getRefunds
  };

})(typeof window !== 'undefined' ? window : global);
