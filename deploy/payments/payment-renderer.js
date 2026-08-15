/**
 * PulseIQ Phase 3.8 — Payment Gateway Integration & Financial Operations
 * Payment Renderer & UI Manager
 * 
 * Renders Financial Operations Dashboard, Gateway Selector, Transaction Ledger,
 * Invoice Modal/Viewer, Refund Controls, and Reconciliation Inspector UI.
 */

(function(window) {
  'use strict';

  function renderPaymentDashboard(containerId) {
    if (typeof document === 'undefined') return;

    const el = document.getElementById(containerId || 'sec-payments');
    if (!el) return;

    const ctx = window.PulseIQ_ContextManager ? window.PulseIQ_ContextManager.getActiveContext() : { organisation: { id: 'org-pulsezen-1' }, centre: { id: 'ctr-hyd-1' }, currency: 'INR' };
    const orgId = ctx ? ctx.organisation.id : null;
    const centreId = ctx ? ctx.centre.id : null;

    const txs = window.PulseIQ_PaymentEngine ? window.PulseIQ_PaymentEngine.getTransactions(orgId, centreId) : [];
    const recon = window.PulseIQ_ReconciliationEngine ? window.PulseIQ_ReconciliationEngine.runReconciliation(orgId, centreId) : {};
    const refunds = window.PulseIQ_RefundEngine ? window.PulseIQ_RefundEngine.getRefunds(orgId, centreId) : [];
    const invoices = window.PulseIQ_InvoiceEngine ? window.PulseIQ_InvoiceEngine.getInvoices(orgId, centreId) : [];

    const totalCollected = txs.filter(t => t.status === 'successful').reduce((sum, t) => sum + t.amount, 0);
    const totalRefunded = refunds.reduce((sum, r) => sum + r.amount, 0);
    const pendingCount = txs.filter(t => t.status === 'failed' || t.status === 'pending').length;

    let html = '';

    // Header & Summary Stats Cards
    html += '<div style="margin-bottom:24px">';
    html += '  <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;margin-bottom:20px">';
    html += '    <div>';
    html += '      <div style="font-size:12px;font-weight:700;color:#38bdf8;text-transform:uppercase;letter-spacing:1px">💳 Provider-Agnostic Financial Operations</div>';
    html += '      <div style="font-family:\'Space Grotesk\',sans-serif;font-size:26px;font-weight:800;color:var(--text);margin-top:2px">Payments & Financial Ledger</div>';
    html += '    </div>';
    html += '    <div style="display:flex;gap:10px">';
    html += '      <button onclick="PulseIQ_PaymentRenderer.showInitiatePaymentModal()" class="btn-p" style="padding:10px 18px;font-size:13px;background:linear-gradient(135deg,#38bdf8,#0284c7);border:none;box-shadow:0 4px 14px rgba(56,189,248,0.3)">+ Collect Payment</button>';
    html += '      <button onclick="PulseIQ_PaymentRenderer.triggerReconciliation()" class="btn-p" style="padding:10px 18px;font-size:13px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15)">🔄 Run Reconciliation</button>';
    html += '    </div>';
    html += '  </div>';

    // Metrics Row
    html += '  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-bottom:24px">';
    html += '    <div class="tcard" style="padding:18px;background:rgba(24,24,27,0.8);backdrop-filter:blur(12px);border:1px solid rgba(56,189,248,0.25)">';
    html += '      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase">Total Revenue Collected</div>';
    html += '      <div style="font-family:\'Space Grotesk\',sans-serif;font-size:22px;font-weight:800;color:#27AE60;margin-top:6px">' + (ctx.currency || 'INR') + ' ' + totalCollected.toLocaleString('en-IN') + '</div>';
    html += '      <div style="font-size:11px;color:var(--muted);margin-top:4px">' + txs.filter(t => t.status === 'successful').length + ' Successful Payments</div>';
    html += '    </div>';

    html += '    <div class="tcard" style="padding:18px;background:rgba(24,24,27,0.8);backdrop-filter:blur(12px);border:1px solid rgba(239,68,68,0.25)">';
    html += '      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase">Total Refunds</div>';
    html += '      <div style="font-family:\'Space Grotesk\',sans-serif;font-size:22px;font-weight:800;color:#ef4444;margin-top:6px">' + (ctx.currency || 'INR') + ' ' + totalRefunded.toLocaleString('en-IN') + '</div>';
    html += '      <div style="font-size:11px;color:var(--muted);margin-top:4px">' + refunds.length + ' Refund Requests Logged</div>';
    html += '    </div>';

    html += '    <div class="tcard" style="padding:18px;background:rgba(24,24,27,0.8);backdrop-filter:blur(12px);border:1px solid rgba(245,158,11,0.25)">';
    html += '      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase">Reconciliation Status</div>';
    html += '      <div style="font-family:\'Space Grotesk\',sans-serif;font-size:16px;font-weight:800;color:#f59e0b;margin-top:8px">' + (recon.status || 'FULLY_RECONCILED 🟢') + '</div>';
    html += '      <div style="font-size:11px;color:var(--muted);margin-top:4px">Settled: ' + (ctx.currency || 'INR') + ' ' + (recon.totalSettledAmount || totalCollected).toLocaleString('en-IN') + '</div>';
    html += '    </div>';

    html += '    <div class="tcard" style="padding:18px;background:rgba(24,24,27,0.8);backdrop-filter:blur(12px);border:1px solid rgba(168,85,247,0.25)">';
    html += '      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase">Invoices Issued</div>';
    html += '      <div style="font-family:\'Space Grotesk\',sans-serif;font-size:22px;font-weight:800;color:#a855f7;margin-top:6px">' + invoices.length + ' Invoices</div>';
    html += '      <div style="font-size:11px;color:var(--muted);margin-top:4px">GST Compliant Tax Invoices</div>';
    html += '    </div>';
    html += '  </div>';

    // Transactions Table Section
    html += '<div class="tcard" style="padding:24px;background:rgba(24,24,27,0.85);backdrop-filter:blur(16px);border:1.5px solid rgba(255,255,255,0.08)">';
    html += '  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px">';
    html += '    <div style="font-family:\'Space Grotesk\',sans-serif;font-size:18px;font-weight:700;color:var(--text)">Financial Transaction Ledger</div>';
    html += '    <div style="display:flex;gap:10px">';
    html += '      <input class="search" id="payment-search" placeholder="🔍 Search by customer or payment ID..." style="padding:6px 12px;font-size:12px;width:240px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#fff" oninput="PulseIQ_PaymentRenderer.filterTransactions()"/>';
    html += '    </div>';
    html += '  </div>';

    html += '  <div style="overflow-x:auto">';
    html += '    <table style="width:100%;border-collapse:collapse;font-size:13px;text-align:left" id="payments-ledger-table">';
    html += '      <thead>';
    html += '        <tr style="border-bottom:1.5px solid rgba(255,255,255,0.1);color:var(--muted);font-size:11px;text-transform:uppercase">';
    html += '          <th style="padding:12px 10px">Customer</th>';
    html += '          <th style="padding:12px 10px">Amount</th>';
    html += '          <th style="padding:12px 10px">Gateway</th>';
    html += '          <th style="padding:12px 10px">Transaction / Gateway ID</th>';
    html += '          <th style="padding:12px 10px">Status</th>';
    html += '          <th style="padding:12px 10px">Date</th>';
    html += '          <th style="padding:12px 10px;text-align:right">Actions</th>';
    html += '        </tr>';
    html += '      </thead>';
    html += '      <tbody id="payments-ledger-body">';

    if (txs.length > 0) {
      txs.forEach(t => {
        const isSuccess = t.status === 'successful';
        const isRefunded = t.status === 'refunded' || t.status === 'partially_refunded';
        const isFailed = t.status === 'failed';

        const statusBg = isSuccess ? 'rgba(39,174,96,0.15)' : (isRefunded ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)');
        const statusColor = isSuccess ? '#27AE60' : (isRefunded ? '#ef4444' : '#f59e0b');

        html += '        <tr style="border-bottom:1px solid rgba(255,255,255,0.05)">';
        html += '          <td style="padding:12px 10px;font-weight:700;color:var(--text)">' + t.customerName + '<div style="font-size:11px;color:var(--muted);font-weight:normal">' + t.customerId + '</div></td>';
        html += '          <td style="padding:12px 10px;font-weight:700;color:' + (isRefunded ? '#ef4444' : '#27AE60') + '">' + t.currency + ' ' + t.amount.toLocaleString('en-IN') + '</td>';
        html += '          <td style="padding:12px 10px"><span style="padding:2px 8px;border-radius:4px;background:rgba(56,189,248,0.1);color:#38bdf8;font-size:11px;font-weight:700">' + (t.provider || 'razorpay').toUpperCase() + '</span></td>';
        html += '          <td style="padding:12px 10px;font-family:monospace;font-size:11px;color:#a1a1aa">' + (t.gatewayPaymentId || t.id) + '</td>';
        html += '          <td style="padding:12px 10px"><span style="padding:3px 8px;border-radius:10px;background:' + statusBg + ';color:' + statusColor + ';font-size:11px;font-weight:700">' + t.status.toUpperCase() + '</span></td>';
        html += '          <td style="padding:12px 10px;font-size:11px;color:var(--muted)">' + new Date(t.timestamp).toLocaleDateString() + '</td>';
        html += '          <td style="padding:12px 10px;text-align:right">';
        
        if (isSuccess) {
          html += '            <button onclick="PulseIQ_PaymentRenderer.viewInvoice(\'' + t.id + '\')" style="padding:4px 8px;font-size:11px;background:rgba(56,189,248,0.15);color:#38bdf8;border:1px solid rgba(56,189,248,0.3);border-radius:4px;cursor:pointer;margin-right:4px">📄 Invoice</button>';
          html += '            <button onclick="PulseIQ_PaymentRenderer.showRefundModal(\'' + t.id + '\',' + t.amount + ')" style="padding:4px 8px;font-size:11px;background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.3);border-radius:4px;cursor:pointer">💸 Refund</button>';
        } else if (isFailed) {
          html += '            <button onclick="PulseIQ_PaymentRenderer.retryTransaction(\'' + t.id + '\')" style="padding:4px 8px;font-size:11px;background:rgba(245,158,11,0.15);color:#f59e0b;border:1px solid rgba(245,158,11,0.3);border-radius:4px;cursor:pointer">🔄 Retry</button>';
        } else {
          html += '            <span style="font-size:11px;color:var(--muted)">—</span>';
        }

        html += '          </td>';
        html += '        </tr>';
      });
    } else {
      html += '        <tr><td colspan="7" style="padding:24px;text-align:center;color:var(--muted)">No financial payment transactions logged for this centre. Click <b>+ Collect Payment</b> to initiate.</td></tr>';
    }

    html += '      </tbody>';
    html += '    </table>';
    html += '  </div>';
    html += '</div>';

    // Modal container placeholder
    html += '<div id="payments-modal-container"></div>';

    el.innerHTML = html;
  }

  function showInitiatePaymentModal() {
    const container = document.getElementById('payments-modal-container');
    if (!container) return;

    const ctx = window.PulseIQ_ContextManager ? window.PulseIQ_ContextManager.getActiveContext() : { currency: 'INR' };

    container.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px">
        <div style="background:#18181b;border:1px solid rgba(56,189,248,0.3);border-radius:12px;padding:24px;width:100%;max-width:460px;color:#fff">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <h3 style="margin:0;font-family:'Space Grotesk',sans-serif;color:#38bdf8">💳 Initiate Payment</h3>
            <button onclick="document.getElementById('payments-modal-container').innerHTML=''" style="background:none;border:none;color:#aaa;font-size:20px;cursor:pointer">✕</button>
          </div>

          <div style="margin-bottom:12px">
            <label style="font-size:11px;color:#aaa;display:block;margin-bottom:4px">Customer Name</label>
            <input id="pm-cust-name" value="Siddharth Rao" style="width:100%;padding:8px;background:#27272a;border:1px solid #3f3f46;border-radius:6px;color:#fff;font-size:13px"/>
          </div>

          <div style="margin-bottom:12px">
            <label style="font-size:11px;color:#aaa;display:block;margin-bottom:4px">Amount (${ctx.currency})</label>
            <input id="pm-amount" type="number" value="5000" style="width:100%;padding:8px;background:#27272a;border:1px solid #3f3f46;border-radius:6px;color:#fff;font-size:13px"/>
          </div>

          <div style="margin-bottom:12px">
            <label style="font-size:11px;color:#aaa;display:block;margin-bottom:4px">Payment Provider Gateway</label>
            <select id="pm-provider" style="width:100%;padding:8px;background:#27272a;border:1px solid #3f3f46;border-radius:6px;color:#fff;font-size:13px">
              <option value="razorpay">Razorpay Gateway (INR / Global)</option>
              <option value="stripe">Stripe Payments (USD / EUR)</option>
              <option value="mock">Mock Direct Transfer</option>
            </select>
          </div>

          <div style="margin-bottom:16px">
            <label style="font-size:11px;color:#aaa;display:block;margin-bottom:4px">Payment Description</label>
            <input id="pm-desc" value="Monthly Fitness Subscription" style="width:100%;padding:8px;background:#27272a;border:1px solid #3f3f46;border-radius:6px;color:#fff;font-size:13px"/>
          </div>

          <div style="display:flex;justify-content:flex-end;gap:8px">
            <button onclick="document.getElementById('payments-modal-container').innerHTML=''" style="padding:8px 14px;background:#27272a;border:1px solid #3f3f46;color:#aaa;border-radius:6px;cursor:pointer">Cancel</button>
            <button onclick="PulseIQ_PaymentRenderer.submitPayment()" style="padding:8px 16px;background:#38bdf8;border:none;color:#000;font-weight:700;border-radius:6px;cursor:pointer">Process Payment</button>
          </div>
        </div>
      </div>
    `;
  }

  function submitPayment() {
    const custName = document.getElementById('pm-cust-name').value;
    const amount = parseFloat(document.getElementById('pm-amount').value) || 0;
    const provider = document.getElementById('pm-provider').value;
    const desc = document.getElementById('pm-desc').value;

    const res = window.PulseIQ_PaymentEngine.initiatePayment({
      customerName: custName,
      amount: amount,
      provider: provider,
      description: desc
    });

    document.getElementById('payments-modal-container').innerHTML = '';

    if (res.success) {
      alert(`✅ Payment Processed Successfully!\n\nTransaction ID: ${res.transaction.id}\nGateway Payment ID: ${res.transaction.gatewayPaymentId}`);
    } else {
      alert(`❌ Payment Failed: ${res.error || 'Gateway Declined'}`);
    }

    renderPaymentDashboard();
  }

  function viewInvoice(transactionId) {
    if (!window.PulseIQ_InvoiceEngine) return;
    const html = window.PulseIQ_InvoiceEngine.renderInvoiceHTML(transactionId);

    const container = document.getElementById('payments-modal-container');
    if (!container) return;

    container.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,0.8);backdrop-filter:blur(8px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px">
        <div style="max-width:640px;width:100%;position:relative">
          <button onclick="document.getElementById('payments-modal-container').innerHTML=''" style="position:absolute;top:-12px;right:-12px;background:#ef4444;color:#fff;border:none;border-radius:50%;width:32px;height:32px;font-weight:700;cursor:pointer;z-index:10000">✕</button>
          ${html}
        </div>
      </div>
    `;
  }

  function showRefundModal(transactionId, maxAmount) {
    const container = document.getElementById('payments-modal-container');
    if (!container) return;

    container.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px">
        <div style="background:#18181b;border:1px solid rgba(239,68,68,0.3);border-radius:12px;padding:24px;width:100%;max-width:420px;color:#fff">
          <h3 style="margin:0 0 16px 0;font-family:'Space Grotesk',sans-serif;color:#ef4444">💸 Process Refund</h3>
          <div style="margin-bottom:12px">
            <label style="font-size:11px;color:#aaa;display:block;margin-bottom:4px">Refund Amount (Max: ${maxAmount})</label>
            <input id="rf-amount" type="number" value="${maxAmount}" style="width:100%;padding:8px;background:#27272a;border:1px solid #3f3f46;border-radius:6px;color:#fff;font-size:13px"/>
          </div>
          <div style="margin-bottom:16px">
            <label style="font-size:11px;color:#aaa;display:block;margin-bottom:4px">Reason for Refund</label>
            <input id="rf-reason" value="Customer Requested Cancellation" style="width:100%;padding:8px;background:#27272a;border:1px solid #3f3f46;border-radius:6px;color:#fff;font-size:13px"/>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px">
            <button onclick="document.getElementById('payments-modal-container').innerHTML=''" style="padding:8px 14px;background:#27272a;border:1px solid #3f3f46;color:#aaa;border-radius:6px;cursor:pointer">Cancel</button>
            <button onclick="PulseIQ_PaymentRenderer.submitRefund('${transactionId}')" style="padding:8px 16px;background:#ef4444;border:none;color:#fff;font-weight:700;border-radius:6px;cursor:pointer">Confirm Refund</button>
          </div>
        </div>
      </div>
    `;
  }

  function submitRefund(transactionId) {
    const amount = parseFloat(document.getElementById('rf-amount').value) || 0;
    const reason = document.getElementById('rf-reason').value;

    const res = window.PulseIQ_RefundEngine.processRefund(transactionId, amount, reason);
    document.getElementById('payments-modal-container').innerHTML = '';

    if (res.success) {
      alert(`✅ Refund Processed!\nRefund ID: ${res.refund.refundId}\nStatus: ${res.transactionStatus}`);
    } else {
      alert(`❌ Refund Failed: ${res.error}`);
    }

    renderPaymentDashboard();
  }

  function retryTransaction(transactionId) {
    const res = window.PulseIQ_PaymentEngine.retryPayment(transactionId);
    if (res.success) {
      alert(`✅ Retry Successful!\nTransaction ID: ${transactionId} is now successful.`);
    } else {
      alert(`❌ Retry Failed: ${res.error}`);
    }
    renderPaymentDashboard();
  }

  function triggerReconciliation() {
    if (!window.PulseIQ_ReconciliationEngine) return;
    const report = window.PulseIQ_ReconciliationEngine.runReconciliation();
    alert(`📊 Reconciliation Report:\n\nTotal Transactions: ${report.totalTransactions}\nReconciled: ${report.reconciledCount}\nStatus: ${report.status}`);
    renderPaymentDashboard();
  }

  function filterTransactions() {
    const searchVal = document.getElementById('payment-search').value.toLowerCase();
    const rows = document.querySelectorAll('#payments-ledger-body tr');
    rows.forEach(row => {
      const text = row.innerText.toLowerCase();
      row.style.display = text.includes(searchVal) ? '' : 'none';
    });
  }

  window.PulseIQ_PaymentRenderer = {
    renderPaymentDashboard: renderPaymentDashboard,
    showInitiatePaymentModal: showInitiatePaymentModal,
    submitPayment: submitPayment,
    viewInvoice: viewInvoice,
    showRefundModal: showRefundModal,
    submitRefund: submitRefund,
    retryTransaction: retryTransaction,
    triggerReconciliation: triggerReconciliation,
    filterTransactions: filterTransactions
  };

})(typeof window !== 'undefined' ? window : global);
