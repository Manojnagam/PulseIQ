/**
 * PulseIQ Phase 3.8 — Payment Gateway Integration & Financial Operations
 * Invoice Engine
 * 
 * Generates itemized tax invoices (GST compliant), manages invoice lifecycle,
 * and renders invoice documents.
 */

(function(window) {
  'use strict';

  const STORAGE_KEY = 'pulseiq_invoices_v1';
  let invoices = [];

  function loadInvoices() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) invoices = JSON.parse(saved);
      } catch (e) {
        invoices = [];
      }
    }
  }

  function saveInvoices() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices.slice(-200)));
      } catch (e) {}
    }
  }

  function generateInvoice(transaction) {
    if (!transaction) return null;

    loadInvoices();

    // Check if invoice already generated for this transaction
    const existing = invoices.find(i => i.transactionId === transaction.id);
    if (existing) return existing;

    const totalAmount = parseFloat(transaction.amount) || 0;
    const gstRate = 0.18; // 18% GST calculation
    const gstAmount = Math.round((totalAmount - (totalAmount / (1 + gstRate))) * 100) / 100;
    const baseAmount = Math.round((totalAmount - gstAmount) * 100) / 100;

    const lineItems = [
      {
        description: transaction.description || 'PulseIQ Fitness Center Subscription',
        quantity: 1,
        unitPrice: baseAmount,
        total: baseAmount
      }
    ];

    const invoice = {
      invoiceNumber: 'INV-' + Date.now().toString().slice(-6),
      transactionId: transaction.id,
      gatewayPaymentId: transaction.gatewayPaymentId,
      customerId: transaction.customerId,
      customerName: transaction.customerName,
      provider: transaction.provider,
      lineItems: lineItems,
      baseAmount: baseAmount,
      gstAmount: gstAmount,
      gstRatePercent: 18,
      totalAmount: totalAmount,
      currency: transaction.currency || 'INR',
      status: transaction.status === 'successful' ? 'PAID' : (transaction.status === 'refunded' ? 'REFUNDED' : 'ISSUED'),
      orgId: transaction.orgId,
      centreId: transaction.centreId,
      issuedAt: new Date().toISOString(),
      paidAt: transaction.status === 'successful' ? new Date().toISOString() : null
    };

    invoices.unshift(invoice);
    saveInvoices();
    return invoice;
  }

  function updateInvoiceStatus(transactionId, status) {
    loadInvoices();
    const inv = invoices.find(i => i.transactionId === transactionId);
    if (inv) {
      inv.status = status;
      saveInvoices();
      return true;
    }
    return false;
  }

  function getInvoices(orgId, centreId, filters) {
    loadInvoices();
    return invoices.filter(i => {
      if (orgId && i.orgId !== orgId) return false;
      if (centreId && i.centreId !== centreId) return false;
      if (filters) {
        if (filters.status && i.status !== filters.status) return false;
        if (filters.customerId && i.customerId !== filters.customerId) return false;
        if (filters.transactionId && i.transactionId !== filters.transactionId) return false;
      }
      return true;
    });
  }

  function renderInvoiceHTML(invoiceNumber) {
    loadInvoices();
    const inv = invoices.find(i => i.invoiceNumber === invoiceNumber || i.transactionId === invoiceNumber);
    if (!inv) return '<div style="padding:20px;color:red">Invoice not found.</div>';

    return `
      <div style="font-family:'Space Grotesk',sans-serif;background:#18181b;color:#f4f4f5;padding:24px;border-radius:12px;border:1px solid #3f3f46;max-width:600px;margin:0 auto">
        <div style="display:flex;justify-content:space-between;border-bottom:1px solid #3f3f46;padding-bottom:16px;margin-bottom:16px">
          <div>
            <h2 style="margin:0;color:#38bdf8;font-size:20px">PulseIQ Tax Invoice</h2>
            <div style="font-size:12px;color:#a1a1aa">GSTIN: 36AAACP1234F1Z9</div>
          </div>
          <div style="text-align:right">
            <div style="font-weight:700;font-size:16px;color:#38bdf8">${inv.invoiceNumber}</div>
            <div style="font-size:11px;color:#a1a1aa">Date: ${new Date(inv.issuedAt).toLocaleDateString()}</div>
            <span style="display:inline-block;margin-top:4px;padding:2px 8px;border-radius:4px;background:rgba(39,174,96,0.2);color:#27AE60;font-size:11px;font-weight:700">${inv.status}</span>
          </div>
        </div>
        <div style="margin-bottom:16px;font-size:13px">
          <div style="color:#a1a1aa;font-size:11px;text-transform:uppercase">Billed To</div>
          <div style="font-weight:700;font-size:14px;color:#ffffff">${inv.customerName}</div>
          <div style="color:#a1a1aa">Customer ID: ${inv.customerId}</div>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px;text-align:left">
          <thead>
            <tr style="border-bottom:1px solid #3f3f46;color:#a1a1aa">
              <th style="padding:8px 0">Item Description</th>
              <th style="padding:8px 0;text-align:right">Base Amount</th>
            </tr>
          </thead>
          <tbody>
            ${inv.lineItems.map(item => `
              <tr style="border-bottom:1px solid #27272a">
                <td style="padding:8px 0">${item.description}</td>
                <td style="padding:8px 0;text-align:right">${inv.currency} ${item.unitPrice.toLocaleString('en-IN')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div style="border-top:1px solid #3f3f46;padding-top:12px;font-size:13px">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;color:#a1a1aa">
            <span>Subtotal (Excl. Tax):</span>
            <span>${inv.currency} ${inv.baseAmount.toLocaleString('en-IN')}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;color:#a1a1aa">
            <span>GST (${inv.gstRatePercent}%):</span>
            <span>${inv.currency} ${inv.gstAmount.toLocaleString('en-IN')}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-weight:700;font-size:16px;color:#27AE60;margin-top:8px;border-top:1px solid #3f3f46;padding-top:8px">
            <span>Total Paid:</span>
            <span>${inv.currency} ${inv.totalAmount.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>
    `;
  }

  window.PulseIQ_InvoiceEngine = {
    generateInvoice: generateInvoice,
    updateInvoiceStatus: updateInvoiceStatus,
    getInvoices: getInvoices,
    renderInvoiceHTML: renderInvoiceHTML
  };

})(typeof window !== 'undefined' ? window : global);
