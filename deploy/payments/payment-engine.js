/**
 * PulseIQ Phase 3.8 — Payment Gateway Integration & Financial Operations
 * Payment Engine
 * 
 * Manages payment lifecycle states, failed payment handling, retry strategy,
 * webhook processing abstraction, security permissions, context scoping, and audit logs.
 */

(function(window) {
  'use strict';

  const STORAGE_KEY = 'pulseiq_payment_transactions_v1';
  const RETRY_CONFIG = {
    maxRetries: 3,
    backoffMs: 1000
  };
  let transactions = [];

  function loadTransactions() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) {
          transactions = JSON.parse(saved);
        }
      } catch (e) {
        transactions = [];
      }
    }
  }

  function saveTransactions() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions.slice(-200)));
      } catch (e) {}
    }
  }

  function getContext() {
    if (window.PulseIQ_ContextManager && typeof window.PulseIQ_ContextManager.getActiveContext === 'function') {
      return window.PulseIQ_ContextManager.getActiveContext();
    }
    return {
      organisation: { id: 'org-pulsezen-1', name: 'PulseZen Fitness' },
      centre: { id: 'ctr-hyd-1', name: 'Hyderabad Central' },
      currency: 'INR'
    };
  }

  function checkSecurityPermission(permission) {
    if (window.PulseIQ_Security && window.PulseIQ_Security.Auth && typeof window.PulseIQ_Security.Auth.hasPermission === 'function') {
      return window.PulseIQ_Security.Auth.hasPermission(permission);
    }
    return true; // Default allow if security engine is mocked/not present
  }

  function checkSaaSEntitlement(orgId) {
    if (window.PulseIQ_SaaSLicensingEngine && typeof window.PulseIQ_SaaSLicensingEngine.verifyEntitlement === 'function') {
      const entitlement = window.PulseIQ_SaaSLicensingEngine.verifyEntitlement(orgId, 'financial_ops');
      if (entitlement && entitlement.enabled === false) {
        return false;
      }
    }
    return true;
  }

  function recordMonitoringMetric(metricName, data) {
    if (window.PulseIQ_Monitoring && typeof window.PulseIQ_Monitoring.recordMetric === 'function') {
      try {
        window.PulseIQ_Monitoring.recordMetric(metricName, data);
      } catch (e) {}
    }
  }

  function initiatePayment(payload) {
    // 1. RBAC Security Check
    if (!checkSecurityPermission('finance:write')) {
      console.warn(`[PulseIQ Payments] Access Denied: User lacks finance:write permission`);
      return { success: false, error: 'Permission denied: Requires finance:write permission.' };
    }

    const ctx = getContext();
    const orgId = payload.orgId || ctx.organisation.id;
    const centreId = payload.centreId || ctx.centre.id;

    // 2. SaaS Entitlement Check
    if (!checkSaaSEntitlement(orgId)) {
      return { success: false, error: 'SaaS Entitlement Error: Financial operations feature disabled on current plan tier.' };
    }

    loadTransactions();

    const providerId = payload.provider || (window.PulseIQ_GatewayAdapter ? window.PulseIQ_GatewayAdapter.resolveProvider(null, payload.currency || ctx.currency) : 'razorpay');

    // Process payment through provider adapter
    const gatewayRes = window.PulseIQ_GatewayAdapter
      ? window.PulseIQ_GatewayAdapter.processPayment(providerId, payload)
      : { success: true, gatewayPaymentId: 'pay_' + Date.now(), status: 'SUCCESS' };

    const status = gatewayRes.status === 'SUCCESS' ? 'successful' : 'failed';

    const tx = {
      id: payload.id || ('tx-' + Date.now() + '-' + Math.floor(Math.random() * 1000)),
      gatewayPaymentId: gatewayRes.gatewayPaymentId,
      orderId: gatewayRes.orderId || null,
      customerId: payload.customerId || 'cust-101',
      customerName: payload.customerName || 'Siddharth Rao',
      description: payload.description || 'Subscription Renewal',
      amount: parseFloat(payload.amount) || 5000,
      currency: payload.currency || ctx.currency,
      provider: providerId,
      status: status,
      retryCount: payload.retryCount || 0,
      maxRetries: RETRY_CONFIG.maxRetries,
      failureReason: status === 'failed' ? (gatewayRes.errorDescription || 'Gateway transaction declined') : null,
      errorCode: status === 'failed' ? (gatewayRes.errorCode || 'PAYMENT_DECLINED') : null,
      orgId: orgId,
      centreId: centreId,
      timestamp: new Date().toISOString(),
      rawGatewayResponse: gatewayRes.rawResponse || null
    };

    transactions.unshift(tx);
    saveTransactions();

    // 3. Auto-generate invoice if payment succeeded
    if (tx.status === 'successful' && window.PulseIQ_InvoiceEngine && typeof window.PulseIQ_InvoiceEngine.generateInvoice === 'function') {
      window.PulseIQ_InvoiceEngine.generateInvoice(tx);
    }

    // 4. Monitoring Metric Emitted
    recordMonitoringMetric('payment_initiated', { status: tx.status, amount: tx.amount, provider: tx.provider, orgId: tx.orgId });

    return {
      success: tx.status === 'successful',
      transaction: tx,
      error: tx.failureReason
    };
  }

  function retryPayment(transactionId) {
    if (!checkSecurityPermission('finance:write')) {
      return { success: false, error: 'Permission denied: Requires finance:write permission.' };
    }

    loadTransactions();
    const tx = transactions.find(t => t.id === transactionId);
    if (!tx) {
      return { success: false, error: `Transaction '${transactionId}' not found.` };
    }

    if (tx.status === 'successful') {
      return { success: false, error: 'Cannot retry a transaction that is already successful.' };
    }

    if (tx.retryCount >= tx.maxRetries) {
      return { success: false, error: `Maximum retries (${tx.maxRetries}) reached for transaction '${transactionId}'.` };
    }

    tx.retryCount += 1;
    
    // Attempt retry payment initiation
    const retryPayload = {
      ...tx,
      retryCount: tx.retryCount,
      forceFail: false // Attempt standard retry
    };

    const gatewayRes = window.PulseIQ_GatewayAdapter
      ? window.PulseIQ_GatewayAdapter.processPayment(tx.provider, retryPayload)
      : { success: true, gatewayPaymentId: 'pay_retry_' + Date.now(), status: 'SUCCESS' };

    if (gatewayRes.status === 'SUCCESS') {
      tx.status = 'successful';
      tx.gatewayPaymentId = gatewayRes.gatewayPaymentId;
      tx.failureReason = null;
      tx.errorCode = null;

      // Auto-generate invoice
      if (window.PulseIQ_InvoiceEngine && typeof window.PulseIQ_InvoiceEngine.generateInvoice === 'function') {
        window.PulseIQ_InvoiceEngine.generateInvoice(tx);
      }
    } else {
      tx.failureReason = gatewayRes.errorDescription || 'Retry attempt failed';
      tx.errorCode = gatewayRes.errorCode || 'RETRY_FAILED';
    }

    saveTransactions();
    recordMonitoringMetric('payment_retry', { transactionId, retryCount: tx.retryCount, newStatus: tx.status });

    return {
      success: tx.status === 'successful',
      transaction: tx
    };
  }

  function processWebhook(providerId, payload, signature, secret) {
    if (!window.PulseIQ_GatewayAdapter) {
      return { success: false, error: 'GatewayAdapter not loaded.' };
    }

    // Verify webhook signature
    const isValidSig = window.PulseIQ_GatewayAdapter.verifyWebhookSignature(providerId, payload, signature, secret);
    if (!isValidSig) {
      console.warn(`[PulseIQ Payments] Webhook signature verification failed for provider: ${providerId}`);
      return { success: false, error: 'Invalid webhook signature.' };
    }

    const event = window.PulseIQ_GatewayAdapter.parseWebhookEvent(providerId, payload);
    loadTransactions();

    let tx = transactions.find(t => t.gatewayPaymentId === event.gatewayPaymentId);

    if (!tx) {
      // Create transaction entry from webhook if not existing
      const ctx = getContext();
      tx = {
        id: 'tx-wh-' + Date.now(),
        gatewayPaymentId: event.gatewayPaymentId,
        customerId: payload.customerId || 'cust-wh',
        customerName: payload.customerName || 'Webhook Customer',
        amount: event.amount || 0,
        currency: ctx.currency,
        provider: providerId,
        status: event.status === 'SUCCESS' ? 'successful' : 'failed',
        orgId: ctx.organisation.id,
        centreId: ctx.centre.id,
        timestamp: new Date().toISOString(),
        viaWebhook: true
      };
      transactions.unshift(tx);
    } else {
      tx.status = event.status === 'SUCCESS' ? 'successful' : (event.status === 'REFUNDED' ? 'refunded' : 'failed');
    }

    saveTransactions();

    if (tx.status === 'successful' && window.PulseIQ_InvoiceEngine) {
      window.PulseIQ_InvoiceEngine.generateInvoice(tx);
    }

    recordMonitoringMetric('webhook_processed', { providerId, eventType: event.eventType, status: tx.status });

    return {
      success: true,
      event: event,
      transaction: tx
    };
  }

  function getTransactions(orgId, centreId, filters) {
    loadTransactions();
    return transactions.filter(t => {
      if (orgId && t.orgId !== orgId) return false;
      if (centreId && t.centreId !== centreId) return false;
      if (filters) {
        if (filters.status && t.status !== filters.status) return false;
        if (filters.provider && t.provider !== filters.provider) return false;
        if (filters.customerId && t.customerId !== filters.customerId) return false;
        if (filters.search) {
          const q = filters.search.toLowerCase();
          const match = t.customerName.toLowerCase().includes(q) ||
                        t.id.toLowerCase().includes(q) ||
                        (t.gatewayPaymentId && t.gatewayPaymentId.toLowerCase().includes(q));
          if (!match) return false;
        }
      }
      return true;
    });
  }

  function updateTransactionStatus(transactionId, newStatus, extraData) {
    loadTransactions();
    const tx = transactions.find(t => t.id === transactionId);
    if (tx) {
      tx.status = newStatus;
      if (extraData) {
        Object.assign(tx, extraData);
      }
      saveTransactions();
      return true;
    }
    return false;
  }

  window.PulseIQ_PaymentEngine = {
    initiatePayment: initiatePayment,
    retryPayment: retryPayment,
    processWebhook: processWebhook,
    getTransactions: getTransactions,
    updateTransactionStatus: updateTransactionStatus
  };

})(typeof window !== 'undefined' ? window : global);
