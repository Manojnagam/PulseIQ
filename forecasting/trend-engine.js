/**
 * PulseIQ Phase 2.7 — Forecasting & Predictive Business Trends
 * Trend Engine
 * 
 * Computes deterministic moving averages, linear trends, and growth rates.
 * NO NEURAL NETWORKS. NO LLM PREDICTIONS. 100% PURE MATH.
 */

(function(window) {
  'use strict';

  function calculate30DayMovingAvg(values) {
    if (!values || values.length === 0) return 0;
    const recent = values.slice(-30);
    const sum = recent.reduce((acc, v) => acc + (parseFloat(v) || 0), 0);
    return Math.round(sum / recent.length);
  }

  function calculateLinearTrend(values) {
    if (!values || values.length < 2) return 0;
    const n = values.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

    for (let i = 0; i < n; i++) {
      const x = i + 1;
      const y = parseFloat(values[i]) || 0;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Project value for next period (n + 30)
    const projectedVal = intercept + slope * (n + 30);
    return Math.max(0, Math.round(projectedVal));
  }

  function calculateGrowthRate(current, previous) {
    if (!previous || previous === 0) return 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  window.PulseIQ_TrendEngine = {
    calculate30DayMovingAvg: calculate30DayMovingAvg,
    calculateLinearTrend: calculateLinearTrend,
    calculateGrowthRate: calculateGrowthRate
  };

})(typeof window !== 'undefined' ? window : global);
