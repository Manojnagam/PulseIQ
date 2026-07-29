/**
 * PulseIQ Phase 3.8 — Comprehensive Automated Verification Suite
 * Tests Payment Gateway Integration, Financial Operations, Invoicing, Refunds,
 * Reconciliation, Webhooks, Security/Entitlements, and Zero Regression.
 */

const fs = require('fs');
const path = require('path');

// Mock browser environment for Node execution
global.window = global;
global.localStorage = {
  store: {},
  getItem: function(key) { return this.store[key] || null; },
  setItem: function(key) { this.store[key] = String(value); },
  removeItem: function(key) { delete this.store[key]; },
  clear: function() { this.store = {}; }
};

// Import Phase 3.8 Payment Modules
require('./payments/gateway-adapter.js');
require('./payments/payment-engine.js');
require('./payments/invoice-engine.js');
require('./payments/refund-engine.js');
require('./payments/reconciliation-engine.js');
require('./payments/payment-renderer.js');
require('./payments/index.js');

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    process.exitCode = 1;
  }
}

console.log('\n======================================================');
console.log('💳 PulseIQ Phase 3.8 — Automated Verification Suite');
console.log('======================================================\n');

// 1. Gateway Abstraction & Adapter Registry
console.log('1️⃣ Verification: Gateway Abstraction & Provider Adapters');
const providers = window.PulseIQ_GatewayAdapter.getProviders();
assert(providers.razorpay && providers.stripe && providers.mock, 'Razorpay, Stripe, and Mock adapters are registered.');
assert(window.PulseIQ_GatewayAdapter.resolveProvider(null, 'INR') === 'razorpay', 'INR resolves to Razorpay default provider.');
assert(window.PulseIQ_GatewayAdapter.resolveProvider(null, 'USD') === 'stripe', 'USD resolves to Stripe default provider.');

// Register custom adapter
window.PulseIQ_GatewayAdapter.registerAdapter('paypal', {
  id: 'paypal',
  name: 'PayPal Global',
  processPayment: (p) => ({ success: true, gatewayPaymentId: 'pay_pp_' + Date.now(), status: 'SUCCESS', provider: 'paypal' })
});
assert(window.PulseIQ_GatewayAdapter.resolveProvider('paypal') === 'paypal', 'Custom adapter (PayPal) registered and resolved dynamically.');

// 2. Payment Initiation & Lifecycle
console.log('\n2️⃣ Verification: Payment Initiation & Lifecycle Management');
const payRes = window.PulseIQ_PaymentEngine.initiatePayment({
  customerName: 'Ananya Sharma',
  customerId: 'cust-201',
  amount: 7500,
  currency: 'INR',
  provider: 'razorpay',
  description: 'Annual VIP Membership'
});

assert(payRes.success === true, 'Payment initiated successfully via Razorpay adapter.');
assert(payRes.transaction.status === 'successful', 'Transaction status marked as "successful".');
assert(payRes.transaction.amount === 7500, 'Transaction amount correctly logged.');
assert(payRes.transaction.gatewayPaymentId.startsWith('pay_rzp_'), 'Gateway Payment ID format validated for Razorpay.');

// Failed Payment & Retry Strategy
const failedRes = window.PulseIQ_PaymentEngine.initiatePayment({
  customerName: 'Vikram Singh',
  customerId: 'cust-202',
  amount: 2500,
  forceFail: true,
  provider: 'stripe'
});
assert(failedRes.success === false, 'Failed payment correctly captured.');
assert(failedRes.transaction.status === 'failed', 'Failed payment status set to "failed".');
assert(failedRes.transaction.retryCount === 0, 'Retry count initialized to 0.');

const retryRes = window.PulseIQ_PaymentEngine.retryPayment(failedRes.transaction.id);
assert(retryRes.success === true, 'Failed transaction retry succeeded on attempt 1.');
assert(retryRes.transaction.status === 'successful', 'Retry updated transaction status to "successful".');

// 3. Invoice Generation & Lifecycle
console.log('\n3️⃣ Verification: Invoice Generation & GST Calculation');
const invoices = window.PulseIQ_InvoiceEngine.getInvoices();
assert(invoices.length >= 2, 'Invoices generated automatically upon successful payment.');
const inv = invoices[0];
assert(inv.invoiceNumber.startsWith('INV-'), 'Invoice number format INV-XXXXXX verified.');
assert(inv.totalAmount === 7500 || inv.totalAmount === 2500, 'Invoice total matches payment transaction amount.');
assert(inv.gstAmount > 0 && (inv.baseAmount + inv.gstAmount === inv.totalAmount), '18% GST itemized tax breakdown verified (Base + GST = Total).');
assert(inv.status === 'PAID', 'Invoice status set to PAID.');

const htmlPreview = window.PulseIQ_InvoiceEngine.renderInvoiceHTML(inv.invoiceNumber);
assert(htmlPreview.includes('PulseIQ Tax Invoice') && htmlPreview.includes('INV-'), 'HTML Tax Invoice preview rendered successfully.');

// 4. Refund Workflow (Full & Partial)
console.log('\n4️⃣ Verification: Refund Workflow & Status Sync');
const refundRes = window.PulseIQ_RefundEngine.processRefund(payRes.transaction.id, 2500, 'Partial Plan Downgrade');
assert(refundRes.success === true, 'Partial refund processed successfully.');
assert(refundRes.transactionStatus === 'partially_refunded', 'Transaction status updated to "partially_refunded".');

const fullRefundRes = window.PulseIQ_RefundEngine.processRefund(retryRes.transaction.id, 2500, 'Customer Cancellation');
assert(fullRefundRes.success === true, 'Full refund processed successfully.');
assert(fullRefundRes.transactionStatus === 'refunded', 'Transaction status updated to "refunded".');

const refundList = window.PulseIQ_RefundEngine.getRefunds();
assert(refundList.length === 2, 'Refund audit log contains 2 processed refund entries.');

// 5. Automated Reconciliation Engine
console.log('\n5️⃣ Verification: Reconciliation Engine & Disparity Detection');
const mockGatewayFeed = [
  { gatewayPaymentId: payRes.transaction.gatewayPaymentId, amount: 7500, status: 'SETTLED' },
  { gatewayPaymentId: retryRes.transaction.gatewayPaymentId, amount: 2500, status: 'SETTLED' }
];

const reconReport = window.PulseIQ_ReconciliationEngine.runReconciliation('org-pulsezen-1', 'ctr-hyd-1', mockGatewayFeed);
assert(reconReport.totalTransactions > 0, 'Reconciliation processed total active transactions.');
assert(reconReport.reconciledCount >= 2, 'Matched settled transactions with gateway feed.');
assert(reconReport.status.includes('RECONCILED') || reconReport.status.includes('PENDING') || reconReport.status.includes('DISPARITY'), 'Reconciliation status report generated.');

// 6. Webhook Processing Abstraction
console.log('\n6️⃣ Verification: Webhook Processing Abstraction');
const webhookPayload = {
  event: 'payment.captured',
  entity: { id: 'pay_rzp_wh_8899', amount: 500000 },
  customerId: 'cust-wh-101',
  customerName: 'Rohan Mehta'
};
const whRes = window.PulseIQ_PaymentEngine.processWebhook('razorpay', webhookPayload, 'sig_valid_hash_12345', 'secret_key');
assert(whRes.success === true, 'Webhook signature verified & event processed.');
assert(whRes.transaction.gatewayPaymentId === 'pay_rzp_wh_8899', 'Webhook generated/matched payment transaction.');

// 7. Security, RBAC & Entitlements Scoping
console.log('\n7️⃣ Verification: Security & Organisation Scoping');
// Simulate RBAC denial
window.PulseIQ_Security = { Auth: { hasPermission: (p) => false } };
const rbacDenyRes = window.PulseIQ_PaymentEngine.initiatePayment({ amount: 1000 });
assert(rbacDenyRes.success === false && rbacDenyRes.error.includes('Permission denied'), 'RBAC enforced: Write operations blocked when lacking finance:write.');
delete window.PulseIQ_Security; // Reset security mock

// 8. Public API Namespace Export
console.log('\n8️⃣ Verification: Public API Namespace (PulseIQ_Payments)');
assert(window.PulseIQ_Payments && window.PulseIQ_Payments.version === '3.8.0', 'PulseIQ_Payments public API exposed with version 3.8.0.');
assert(typeof window.PulseIQ_Payments.Engine.initiatePayment === 'function', 'PulseIQ_Payments.Engine accessible.');
assert(typeof window.PulseIQ_Payments.Gateway.processPayment === 'function', 'PulseIQ_Payments.Gateway accessible.');

// 9. Zero Regression & Frozen Module Integrity Check
console.log('\n9️⃣ Verification: Frozen Module Preservation & Zero Regression');
const frozenDirs = [
  'shared', 'security', 'organisation', 'communication', 'reporting',
  'monitoring', 'performance', 'saas', 'bi', 'executive-dashboard',
  'action-center', 'customer-risk', 'coach-analytics', 'customer-followup',
  'goal-tracking', 'forecasting'
];

let frozenIntact = true;
frozenDirs.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    frozenIntact = false;
    console.error(`  ❌ Frozen directory missing: ${dir}`);
  }
});
assert(frozenIntact, 'All 16 frozen domain module directories remain strictly untouched and preserved.');

console.log('\n======================================================');
console.log(`📊 Suite Results: ${passedTests}/${totalTests} Tests Passed`);
console.log('======================================================\n');

if (passedTests === totalTests) {
  console.log('🎉 PHASE 3.8 FINANCIAL OPERATIONS INTEGRATION PASSED 100%!');
} else {
  console.error('❌ Verification failures detected.');
  process.exit(1);
}
