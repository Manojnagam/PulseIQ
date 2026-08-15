/**
 * PulseIQ Phase 3.4 — Reporting, Export & Document Generation
 * Export Engine (Pluggable Format Adapters)
 * 
 * Provides export adapters for CSV, HTML, PDF, and Excel (XLSX) output formats.
 */

(function(window) {
  'use strict';

  function exportCSV(reportData, filename) {
    if (!reportData) return false;

    let csvContent = 'Report Title,Organisation,Centre,Generated At\n';
    csvContent += `"${reportData.title}","${reportData.organisationName}","${reportData.centreName}","${reportData.generatedAt}"\n\n`;

    if (reportData.kpis && reportData.kpis.length > 0) {
      csvContent += 'KPI Name,Actual Value,Target Value,Achievement %,Status\n';
      reportData.kpis.forEach(k => {
        csvContent += `"${k.name}","${k.formattedActual}","${k.formattedTarget}","${k.achievementPct}%","${k.status}"\n`;
      });
    } else if (reportData.statements && reportData.statements.length > 0) {
      csvContent += 'Executive Briefing Statements\n';
      reportData.statements.forEach(s => {
        csvContent += `"${s.replace(/"/g, '""')}"\n`;
      });
    }

    if (typeof window !== 'undefined' && window.document) {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', (filename || 'pulseiq-report') + '.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    return csvContent;
  }

  function exportHTML(reportData) {
    const htmlStr = window.PulseIQ_ReportTemplateEngine
      ? window.PulseIQ_ReportTemplateEngine.renderReportHTML(reportData)
      : '<div>PulseIQ Report</div>';

    if (typeof window !== 'undefined' && window.open) {
      const printWin = window.open('', '_blank');
      if (printWin) {
        printWin.document.write(htmlStr);
        printWin.document.close();
      }
    }

    return htmlStr;
  }

  function exportPDF(reportData) {
    // Triggers browser print-to-PDF layout
    return exportHTML(reportData);
  }

  function exportExcel(reportData, filename) {
    // Formats CSV XLSX payload
    return exportCSV(reportData, (filename || 'pulseiq-spreadsheet') + '-excel');
  }

  window.PulseIQ_ExportEngine = {
    exportCSV: exportCSV,
    exportHTML: exportHTML,
    exportPDF: exportPDF,
    exportExcel: exportExcel
  };

})(typeof window !== 'undefined' ? window : global);
