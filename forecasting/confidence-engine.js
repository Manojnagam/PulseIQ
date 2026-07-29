/**
 * PulseIQ Phase 2.7 — Forecasting & Predictive Business Trends
 * Confidence Engine
 * 
 * Evaluates statistical confidence based on historical sample size (N)
 * and variance stability (Coefficient of Variation CV = SD / Mean).
 * ZERO MACHINE LEARNING. 100% TRANSPARENT STATISTICAL RULES.
 */

(function(window) {
  'use strict';

  function evaluateConfidence(sampleCount, valuesArray) {
    if (!valuesArray || valuesArray.length === 0) {
      return { level: 'Low', badge: 'Low Confidence 🔴', color: '#ef4444', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.3)', explanation: 'Insufficient data points (N < 7).' };
    }

    const n = valuesArray.length;
    const mean = valuesArray.reduce((sum, v) => sum + v, 0) / n;

    if (mean === 0) {
      return { level: 'Medium', badge: 'Medium Confidence 🟡', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)', explanation: 'Baseline mean is 0.' };
    }

    const variance = valuesArray.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);
    const cv = (stdDev / mean) * 100; // Coefficient of Variation in %

    if (n >= 30 && cv < 25) {
      return {
        level: 'High',
        badge: 'High Confidence 🟢',
        color: '#27AE60',
        bg: 'rgba(39,174,96,0.15)',
        border: 'rgba(39,174,96,0.3)',
        explanation: `Robust sample size (N=${n}) with stable low variance (CV=${cv.toFixed(1)}%).`
      };
    } else if (n >= 14 || cv < 45) {
      return {
        level: 'Medium',
        badge: 'Medium Confidence 🟡',
        color: '#f59e0b',
        bg: 'rgba(245,158,11,0.15)',
        border: 'rgba(245,158,11,0.3)',
        explanation: `Moderate sample size (N=${n}) with reasonable variance (CV=${cv.toFixed(1)}%).`
      };
    } else {
      return {
        level: 'Low',
        badge: 'Low Confidence 🔴',
        color: '#ef4444',
        bg: 'rgba(239,68,68,0.15)',
        border: 'rgba(239,68,68,0.3)',
        explanation: `Limited sample size (N=${n}) or high volatility (CV=${cv.toFixed(1)}%).`
      };
    }
  }

  window.PulseIQ_ConfidenceEngine = {
    evaluateConfidence: evaluateConfidence
  };

})(typeof window !== 'undefined' ? window : global);
