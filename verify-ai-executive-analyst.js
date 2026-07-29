/**
 * PulseIQ AI Executive Business Analyst Verification Suite
 * Tests live data analysis, dynamic scoring, explainability WHY callouts,
 * severity risk ranking, predictive forecasting, and zero hardcoded output.
 */

const fs = require('fs');
const path = require('path');

// Mock browser environment for Node execution
global.window = global;

// Import BI Engine Layers
require('./bi/metrics-engine.js');
require('./bi/insight-engine.js');
require('./bi/recommendation-engine.js');
require('./bi/nlg-engine.js');
require('./bi/index.js');

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
console.log('🤖 PulseIQ AI Executive Business Analyst Verification');
console.log('======================================================\n');

// Sample Dataset 1: Healthy Growth Dataset
const datasetHealthy = {
  customers: [
    { id: 'c1', name: 'Rohan Verma', status: 'active', created_at: '2026-07-20' },
    { id: 'c2', name: 'Anita Roy', status: 'active', created_at: '2026-07-22' },
    { id: 'c3', name: 'Karan Patel', status: 'active', created_at: '2026-05-10' }
  ],
  attendance: [
    { customer_id: 'c1', date: '2026-07-29', status: 'present' },
    { customer_id: 'c2', date: '2026-07-28', status: 'present' },
    { customer_id: 'c3', date: '2026-07-29', status: 'present' }
  ],
  finance: [
    { amount: 15000, type: 'income', category: 'Wellness Package', date: '2026-07-28' },
    { amount: 5000, type: 'income', category: 'Formula 1 Shake Retail', date: '2026-07-29' }
  ],
  inventory: [
    { id: 'p1', name: 'Formula 1 Shake (Vanilla)', stock_quantity: 25, low_stock_threshold: 5 },
    { id: 'p2', name: 'Afresh Energy Drink', stock_quantity: 12, low_stock_threshold: 5 }
  ],
  coaches: [
    { id: 'ch1', name: 'Siddharth Rao', herbalife_pin: 'Millionaire Team' }
  ],
  followups: [
    { id: 'f1', coach_id: 'ch1', status: 'completed', due_date: '2026-07-28' }
  ]
};

// Sample Dataset 2: Critical / Distressed Dataset
const datasetCritical = {
  customers: [
    { id: 'c1', name: 'Rohan Verma', status: 'active', created_at: '2026-01-01', start_date: '2026-01-01' },
    { id: 'c2', name: 'Anita Roy', status: 'inactive', created_at: '2026-01-01', start_date: '2026-01-01' }
  ],
  attendance: [
    { customer_id: 'c1', date: '2026-07-10', status: 'present' }
  ],
  finance: [
    { amount: 2000, type: 'income', category: 'Retail', date: '2026-07-01' },
    { amount: 8000, type: 'expense', category: 'Rent', date: '2026-07-05' }
  ],
  inventory: [
    { id: 'p1', name: 'Formula 1 Shake', stock_quantity: 0, low_stock_threshold: 5 },
    { id: 'p2', name: 'Protein Powder', stock_quantity: 1, low_stock_threshold: 5 }
  ],
  coaches: [
    { id: 'ch1', name: 'Priya Sharma', herbalife_pin: 'Associate' }
  ],
  followups: [
    { id: 'f1', coach_id: 'ch1', status: 'pending', due_date: '2026-07-15' },
    { id: 'f2', coach_id: 'ch1', status: 'pending', due_date: '2026-07-16' }
  ]
};

// 1. Run BI Analysis on Dataset 1 (Healthy)
console.log('1️⃣ Verification: Healthy Dataset Analysis & Dynamic Scoring');
const reportHealthy = window.PulseIQ_BI.runAnalysis(datasetHealthy);
assert(reportHealthy.metrics.healthScore >= 75, 'Healthy dataset computed high Health Score (>=75).');
assert(reportHealthy.metrics.healthBadge.includes('🟢') || reportHealthy.metrics.healthBadge.includes('🔵'), 'Health badge formatted color-coded green/blue.');
assert(reportHealthy.html.includes('Executive Business Intelligence Briefing'), 'Report contains Executive Business Intelligence header.');
assert(reportHealthy.html.includes('📈 Overall Business Health'), 'Report contains Overall Business Health section.');
assert(reportHealthy.html.includes('💰 Revenue Insights'), 'Report contains Revenue Insights section.');
assert(reportHealthy.html.includes('👥 Customer Insights'), 'Report contains Customer Insights section.');
assert(reportHealthy.html.includes('🏋 Coach Insights'), 'Report contains Coach Insights section.');
assert(reportHealthy.html.includes('💡 Prioritised AI Recommendations'), 'Report contains Prioritised AI Recommendations section.');
assert(reportHealthy.html.includes('📅 Predictive Forecast'), 'Report contains Forecast section.');

// 2. Run BI Analysis on Dataset 2 (Critical)
console.log('\n2️⃣ Verification: Critical Dataset Analysis & Score Adaptation');
const reportCritical = window.PulseIQ_BI.runAnalysis(datasetCritical);
assert(reportCritical.metrics.healthScore < reportHealthy.metrics.healthScore, 'Health score dynamically adapts to data (Critical < Healthy).');
assert(reportCritical.insights.rankedRisks.some(r => r.severity.includes('CRITICAL') || r.severity.includes('HIGH')), 'Critical dataset correctly identified high-severity risks.');

// 3. Explainability Rationale Checks
console.log('\n3️⃣ Verification: Explainability & "WHY" Rationale Callouts');
assert(reportHealthy.insights.revenueExplainability.includes('because'), 'Revenue insight includes explicit "because" explainability.');
assert(reportHealthy.recommendations.every(r => r.why && r.why.includes('Because')), 'Every AI recommendation includes an explicit "WHY" data rationale callout.');

// 4. Dynamic Generation (No Hardcoded Identical Summaries)
console.log('\n4️⃣ Verification: Dynamic NLG Generation (Zero Hardcoding)');
assert(reportHealthy.html !== reportCritical.html, 'Different datasets generate completely different, dynamic executive reports.');
assert(!reportHealthy.html.includes("busy week it looks like you've had"), 'Generic motivational greeting ("busy week...") completely removed.');

console.log('\n======================================================');
console.log(`📊 Suite Results: ${passedTests}/${totalTests} Tests Passed`);
console.log('======================================================\n');

if (passedTests === totalTests) {
  console.log('🎉 PULSEIQ AI EXECUTIVE BUSINESS ANALYST VERIFIED 100%!');
} else {
  console.error('❌ Verification failures detected.');
  process.exit(1);
}
