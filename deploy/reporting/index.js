/**
 * PulseIQ Phase 3.4 — Reporting, Export & Document Generation
 * Main Orchestrator & Public API Namespace
 * 
 * Exposes PulseIQ_Reporting public API encapsulating Report Generation,
 * Document Templating, Export Adapters (CSV, PDF, HTML, Excel), and Scheduling.
 */

(function(window) {
  'use strict';

  function generateAndExport(reportType, format) {
    if (!window.PulseIQ_ReportEngine) return null;

    const reportData = window.PulseIQ_ReportEngine.generateReport(reportType || 'EXECUTIVE_SUMMARY');
    if (reportData.error) {
      if (typeof window.showToast === 'function') window.showToast('🔒 ' + reportData.error);
      return reportData;
    }

    const exportFmt = (format || 'pdf').toLowerCase();
    if (window.PulseIQ_ExportEngine) {
      switch (exportFmt) {
        case 'csv':
          window.PulseIQ_ExportEngine.exportCSV(reportData, reportType.toLowerCase() + '-report');
          break;
        case 'excel':
        case 'xlsx':
          window.PulseIQ_ExportEngine.exportExcel(reportData, reportType.toLowerCase() + '-report');
          break;
        case 'pdf':
        case 'html':
        default:
          window.PulseIQ_ExportEngine.exportPDF(reportData);
          break;
      }
    }

    return reportData;
  }

  window.PulseIQ_Reporting = {
    Engine: window.PulseIQ_ReportEngine || {},
    Template: window.PulseIQ_ReportTemplateEngine || {},
    Export: window.PulseIQ_ExportEngine || {},
    Scheduler: window.PulseIQ_ReportScheduler || {},
    Renderer: window.PulseIQ_ReportRenderer || {},
    generateAndExport: generateAndExport,
    version: '3.4.0'
  };

})(typeof window !== 'undefined' ? window : global);
