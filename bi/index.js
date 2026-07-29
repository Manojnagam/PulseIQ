/**
 * PulseIQ Phase 2 — AI Business Analyst (Phase 2.1)
 * Main Orchestrator & Public API
 * 
 * Combines Layer 1 (Metrics), Layer 2 (Insights), Layer 3 (Recommendations),
 * and Layer 4 (NLG Renderer) into a single production-safe module.
 */

(function(window) {
  'use strict';

  function runAnalysis(sourceData) {
    console.log('[PulseIQ BI Engine] Computing deterministic business intelligence...');
    
    // Layer 1: Compute KPIs
    const metrics = window.PulseIQ_MetricsEngine
      ? window.PulseIQ_MetricsEngine.computeBusinessMetrics(sourceData)
      : {};

    // Layer 2: Generate Observations
    const insights = window.PulseIQ_InsightEngine
      ? window.PulseIQ_InsightEngine.generateInsights(metrics)
      : { observations: [], warnings: [], healthScore: 85 };

    // Layer 3: Prioritize Recommendations
    const recommendations = window.PulseIQ_RecommendationEngine
      ? window.PulseIQ_RecommendationEngine.generateRecommendations(metrics, insights)
      : [];

    // Layer 4: Render HTML Report
    const htmlReport = window.PulseIQ_NlgEngine
      ? window.PulseIQ_NlgEngine.renderReportHtml(metrics, insights, recommendations)
      : '<div class="err">BI Engine NLG Module missing</div>';

    // Update DOM container if available
    if (typeof document !== 'undefined') {
      const resultEl = document.getElementById('biz-ai-result');
      if (resultEl) {
        resultEl.style.display = 'block';
        resultEl.innerHTML = htmlReport;
      }

      const btn = document.querySelector('[onclick="generateBizAIReport()"]');
      if (btn) {
        btn.textContent = '✨ AI Report';
      }
    }

    return {
      metrics: metrics,
      insights: insights,
      recommendations: recommendations,
      html: htmlReport
    };
  }

  // Intercept window.generateBizAIReport safely without breaking existing signatures
  const originalGenerateBizAIReport = window.generateBizAIReport;
  window.generateBizAIReport = function() {
    try {
      runAnalysis(window.D);
    } catch (err) {
      console.error('[PulseIQ BI Engine Error]', err);
      if (typeof originalGenerateBizAIReport === 'function') {
        originalGenerateBizAIReport();
      }
    }
  };

  window.PulseIQ_BI = {
    runAnalysis: runAnalysis,
    version: '2.1.0'
  };

})(typeof window !== 'undefined' ? window : global);
