/**
 * PulseIQ Phase 3.8 — Payment Gateway Integration & Financial Operations
 * Reconciliation Engine
 * 
 * Performs automated payment reconciliation against gateway settlement records,
 * identifies settlement disparities, and provides disparity resolution reports.
 */

(function(window) {
  'use strict';

  function runReconciliation(orgId, centreId, externalSettlementFeed) {
    const txs = window.PulseIQ_PaymentEngine
      ? window.PulseIQ_PaymentEngine.getTransactions(orgId, centreId)
      : [];

    const reconciled = [];
    const unreconciled = [];
    const disparities = [];

    // Optional external gateway settlement map for comparative matching
    const settlementMap = {};
    if (Array.isArray(externalSettlementFeed)) {
      externalSettlementFeed.forEach(s => {
        if (s.gatewayPaymentId) {
          settlementMap[s.gatewayPaymentId] = s;
        }
      });
    }

    txs.forEach(t => {
      let isDisparity = false;
      let disparityReason = null;

      const isCompletedTx = t.status === 'successful' || t.status === 'partially_refunded' || t.status === 'refunded';

      if (!isCompletedTx) {
        unreconciled.push(t);
        return;
      }

      if (!t.gatewayPaymentId) {
        isDisparity = true;
        disparityReason = 'Missing Gateway Transaction ID';
      } else if (externalSettlementFeed && externalSettlementFeed.length > 0) {
        const ext = settlementMap[t.gatewayPaymentId];
        if (!ext) {
          isDisparity = true;
          disparityReason = 'Transaction not found in gateway settlement feed';
        } else if (ext.amount !== t.amount) {
          isDisparity = true;
          disparityReason = `Amount Disparity: Internal (${t.amount}) vs Gateway (${ext.amount})`;
        } else if (ext.status !== 'SETTLED' && ext.status !== 'SUCCESS') {
          isDisparity = true;
          disparityReason = `Status Disparity: Gateway settlement status is '${ext.status}'`;
        }
      }

      if (isDisparity) {
        disparities.push({
          transactionId: t.id,
          gatewayPaymentId: t.gatewayPaymentId,
          customerName: t.customerName,
          amount: t.amount,
          reason: disparityReason
        });
        unreconciled.push(t);
      } else {
        reconciled.push(t);
      }
    });

    const totalSettledAmount = reconciled.reduce((sum, t) => sum + t.amount, 0);
    const totalDisparityAmount = disparities.reduce((sum, d) => sum + d.amount, 0);
    const totalUnreconciledAmount = unreconciled.reduce((sum, t) => sum + t.amount, 0);

    const isFullyReconciled = unreconciled.length === 0 && disparities.length === 0;

    return {
      totalTransactions: txs.length,
      reconciledCount: reconciled.length,
      unreconciledCount: unreconciled.length,
      disparityCount: disparities.length,
      totalSettledAmount: totalSettledAmount,
      totalDisparityAmount: totalDisparityAmount,
      totalUnreconciledAmount: totalUnreconciledAmount,
      disparities: disparities,
      status: isFullyReconciled ? 'FULLY_RECONCILED 🟢' : (disparities.length > 0 ? 'DISPARITY_DETECTED 🔴' : 'PENDING_RECONCILIATION 🟡'),
      timestamp: new Date().toISOString()
    };
  }

  function resolveDisparity(transactionId, resolutionNotes) {
    if (!window.PulseIQ_PaymentEngine) return { success: false, error: 'PaymentEngine not available.' };

    const success = window.PulseIQ_PaymentEngine.updateTransactionStatus(transactionId, 'successful', {
      reconciliationResolved: true,
      reconciliationNotes: resolutionNotes || 'Manually reconciled by Finance Admin',
      resolvedAt: new Date().toISOString()
    });

    return {
      success: success,
      message: success ? `Transaction '${transactionId}' marked as reconciled.` : `Transaction '${transactionId}' not found.`
    };
  }

  window.PulseIQ_ReconciliationEngine = {
    runReconciliation: runReconciliation,
    resolveDisparity: resolveDisparity
  };

})(typeof window !== 'undefined' ? window : global);
