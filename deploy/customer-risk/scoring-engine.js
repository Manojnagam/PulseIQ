/**
 * PulseIQ Phase 2.3 — Customer Risk Prediction
 * Scoring Engine
 * 
 * STRICTLY DETERMINISTIC RISK SCORING MODEL (0 - 100 Points).
 * Calculates transparent risk points across 5 operational dimensions:
 * 1. Attendance (0-30 pts)
 * 2. Membership Expiry (0-20 pts)
 * 3. Body Scan Recency (0-20 pts)
 * 4. Purchase Inactivity (0-20 pts)
 * 5. Progress Trend (0-10 pts)
 * 
 * ZERO ML BLACK-BOX. 100% EXPLAINABLE FACTS.
 */

(function(window) {
  'use strict';

  function daysBetween(d1, d2) {
    return Math.floor((new Date(d1) - new Date(d2)) / (1000 * 60 * 60 * 24));
  }

  function calculateCustomerRiskScore(customer, customerAtt, customerScans, customerFin, todayStr) {
    const today = todayStr || new Date().toISOString().split('T')[0];
    let totalScore = 0;
    const breakdown = [];

    // ── 1. ATTENDANCE FACTOR (0 - 30 PTS) ──
    let lastAttDate = null;
    let daysAbsent = 999;
    if (customerAtt && customerAtt.length > 0) {
      const sorted = customerAtt.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
      lastAttDate = sorted[0].date;
      daysAbsent = daysBetween(today, lastAttDate);
    } else if (customer.start_date || customer.created_at) {
      lastAttDate = customer.start_date || customer.created_at;
      daysAbsent = daysBetween(today, lastAttDate);
    }

    let attPts = 0;
    if (daysAbsent > 21) {
      attPts = 30;
      breakdown.push({ factor: 'Attendance', pts: 30, reason: `Severely absent for ${daysAbsent} days (>21 days)` });
    } else if (daysAbsent >= 14) {
      attPts = 20;
      breakdown.push({ factor: 'Attendance', pts: 20, reason: `Absent for ${daysAbsent} days (14–21 days)` });
    } else if (daysAbsent >= 7) {
      attPts = 10;
      breakdown.push({ factor: 'Attendance', pts: 10, reason: `Absent for ${daysAbsent} days (7–13 days)` });
    } else {
      breakdown.push({ factor: 'Attendance', pts: 0, reason: `Attended recently (${daysAbsent} days ago)` });
    }
    totalScore += attPts;

    // ── 2. MEMBERSHIP EXPIRY FACTOR (0 - 20 PTS) ──
    let memPts = 0;
    let daysRemaining = 999;
    if (customer.expiry_date) {
      daysRemaining = daysBetween(customer.expiry_date, today);
      if (daysRemaining <= 3) {
        memPts = 20;
        breakdown.push({ factor: 'Membership', pts: 20, reason: daysRemaining <= 0 ? `Membership expired on ${customer.expiry_date}` : `Membership expires in ${daysRemaining} days (≤3 days)` });
      } else if (daysRemaining <= 7) {
        memPts = 15;
        breakdown.push({ factor: 'Membership', pts: 15, reason: `Membership expires in ${daysRemaining} days (4–7 days)` });
      } else if (daysRemaining <= 14) {
        memPts = 10;
        breakdown.push({ factor: 'Membership', pts: 10, reason: `Membership expires in ${daysRemaining} days (8–14 days)` });
      } else {
        breakdown.push({ factor: 'Membership', pts: 0, reason: `Membership active (${daysRemaining} days remaining)` });
      }
    } else {
      memPts = 10;
      breakdown.push({ factor: 'Membership', pts: 10, reason: 'No membership expiry date recorded' });
    }
    totalScore += memPts;

    // ── 3. BODY SCAN RECENCY FACTOR (0 - 20 PTS) ──
    let scanPts = 0;
    let lastScanDate = null;
    let daysSinceScan = 999;
    if (customerScans && customerScans.length > 0) {
      const sortedScans = customerScans.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
      lastScanDate = sortedScans[0].date;
      daysSinceScan = daysBetween(today, lastScanDate);
    }

    if (daysSinceScan > 30 || daysSinceScan === 999) {
      scanPts = 20;
      breakdown.push({ factor: 'Body Scan', pts: 20, reason: daysSinceScan === 999 ? 'No body composition scan on record' : `Body scan overdue (${daysSinceScan} days since scan)` });
    } else if (daysSinceScan >= 15) {
      scanPts = 10;
      breakdown.push({ factor: 'Body Scan', pts: 10, reason: `Body scan due soon (${daysSinceScan} days since scan)` });
    } else {
      breakdown.push({ factor: 'Body Scan', pts: 0, reason: `Recent body scan recorded (${daysSinceScan} days ago)` });
    }
    totalScore += scanPts;

    // ── 4. PURCHASE INACTIVITY FACTOR (0 - 20 PTS) ──
    let purchasePts = 0;
    let lastPurchaseDate = null;
    let daysSincePurchase = 999;
    if (customerFin && customerFin.length > 0) {
      const sortedFin = customerFin.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
      lastPurchaseDate = sortedFin[0].date;
      daysSincePurchase = daysBetween(today, lastPurchaseDate);
    }

    if (daysSincePurchase > 45 || daysSincePurchase === 999) {
      purchasePts = 20;
      breakdown.push({ factor: 'Purchase', pts: 20, reason: daysSincePurchase === 999 ? 'No purchase transactions recorded' : `No purchase for ${daysSincePurchase} days (>45 days)` });
    } else if (daysSincePurchase >= 30) {
      purchasePts = 10;
      breakdown.push({ factor: 'Purchase', pts: 10, reason: `Inactive purchase status (${daysSincePurchase} days since payment)` });
    } else {
      breakdown.push({ factor: 'Purchase', pts: 0, reason: `Recent transaction (${daysSincePurchase} days ago)` });
    }
    totalScore += purchasePts;

    // ── 5. PROGRESS TREND FACTOR (0 - 10 PTS) ──
    let progressPts = 0;
    if (customerScans && customerScans.length >= 2) {
      const sortedScans = customerScans.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
      const first = sortedScans[0];
      const last = sortedScans[sortedScans.length - 1];
      const goal = (customer.goal || '').toLowerCase();

      if (goal.includes('loss') || goal.includes('weight')) {
        const weightDiff = parseFloat(last.weight_kg) - parseFloat(first.weight_kg);
        if (weightDiff >= 0.5) { // gained weight when goal was loss
          progressPts = 10;
          breakdown.push({ factor: 'Progress', pts: 10, reason: `Weight stalled/increased (+${weightDiff.toFixed(1)} kg) despite weight loss goal` });
        } else {
          breakdown.push({ factor: 'Progress', pts: 0, reason: `Progressing on goal (${weightDiff.toFixed(1)} kg loss)` });
        }
      } else {
        breakdown.push({ factor: 'Progress', pts: 0, reason: 'Progress trend normal' });
      }
    } else {
      breakdown.push({ factor: 'Progress', pts: 0, reason: 'Insufficient scan history for trend' });
    }
    totalScore += progressPts;

    // Cap Total Score at 100
    totalScore = Math.max(0, Math.min(100, totalScore));

    // Determine Risk Level
    let riskLevel = 'LOW';
    if (totalScore >= 60) riskLevel = 'HIGH';
    else if (totalScore >= 30) riskLevel = 'MEDIUM';

    return {
      totalScore: totalScore,
      riskLevel: riskLevel,
      breakdown: breakdown,
      lastAttDate: lastAttDate,
      daysAbsent: daysAbsent,
      daysRemaining: daysRemaining,
      lastScanDate: lastScanDate,
      daysSinceScan: daysSinceScan,
      daysSincePurchase: daysSincePurchase
    };
  }

  window.PulseIQ_ScoringEngine = {
    calculateCustomerRiskScore: calculateCustomerRiskScore
  };

})(typeof window !== 'undefined' ? window : global);
