/**
 * PulseIQ Premium Effects v2.0
 * Implements Aceternity UI-style effects in vanilla JS:
 *  - Card spotlight (mouse-tracking radial glow)
 *  - Animated metric counters (Motion Primitives style)
 *  - Stagger entrance for dynamic DOM cards
 */
(function () {
  'use strict';

  /* ─── 1. CARD SPOTLIGHT (Aceternity's signature effect) ─── */
  function initSpotlight() {
    const SELECTORS = '.stat, .ov-card, .tcard, .report-card, .ws-report-card, .pin-card, .agent-card, .ov-rev-card';

    function attachSpotlight(card) {
      if (card._spotlight) return;
      card._spotlight = true;

      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width * 100).toFixed(1) + '%';
        const y = ((e.clientY - rect.top) / rect.height * 100).toFixed(1) + '%';
        card.style.setProperty('--mouse-x', x);
        card.style.setProperty('--mouse-y', y);
      });
    }

    // Attach to existing cards
    if (document.body) document.querySelectorAll(SELECTORS).forEach(attachSpotlight);

    // Throttled observer for dynamically rendered cards
    let spotlightTimeout = null;
    const observer = new MutationObserver(() => {
      if (spotlightTimeout) return;
      spotlightTimeout = requestAnimationFrame(() => {
        spotlightTimeout = null;
        if (document.body) document.querySelectorAll(SELECTORS).forEach(attachSpotlight);
      });
    });

    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  }

  /* ─── 2. ANIMATED COUNTER ─── DISABLED
   * Removed: was corrupting Indian number formatting (₹7,02,763.75 → ₹702763.8)
   * Real financial data must never be reformatted by presentation layer.
   */

  /* ─── 3. STAGGER ENTRANCE for dynamic card lists ─── */
  function staggerEnter(container, selector = '.att-card, .lead-card, .recheck-card, .retention-card') {
    const cards = container.querySelectorAll(selector);
    cards.forEach((card, i) => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(12px)';
      card.style.transition = `opacity 0.3s ${i * 40}ms cubic-bezier(0.0,0.0,0.2,1), transform 0.3s ${i * 40}ms cubic-bezier(0.175,0.885,0.32,1.275)`;

      // Trigger
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          card.style.opacity = '1';
          card.style.transform = 'translateY(0)';
        });
      });
    });
  }

  const staggerObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        const targets = ['.att-card', '.lead-card', '.recheck-card', '.retention-card'];
        if (targets.some(sel => node.matches && node.matches(sel))) {
          node.style.opacity = '0';
          node.style.transform = 'translateY(10px)';
          node.style.transition = 'opacity 0.25s var(--ease-out), transform 0.25s var(--spring)';
          requestAnimationFrame(() => requestAnimationFrame(() => {
            node.style.opacity = '1';
            node.style.transform = 'translateY(0)';
          }));
        }
        if (node.querySelector) staggerEnter(node);
      }
    }
  });

  // Observe only after body exists (called from init)
  function startStaggerObserver() {
    if (document.body) staggerObserver.observe(document.body, { childList: true, subtree: true });
  }

  /* ─── 4. SIDEBAR ACTIVE INDICATOR GLOW ─── */
  function patchNavItems() {
    document.querySelectorAll('.nav-item').forEach((item) => {
      item.addEventListener('click', () => {
        // Brief flash glow on click
        item.style.boxShadow = '0 0 16px rgba(0, 217, 126, 0.25)';
        setTimeout(() => { item.style.boxShadow = ''; }, 400);
      });
    });
  }

  /* ─── 5. TOAST UPGRADE (Aceternity-style notification) ─── */
  function patchToast() {
    const original = window.showToast;
    if (typeof original !== 'function') return;

    window.showToast = function(msg, type) {
      original(msg, type);
      const toast = document.getElementById('toast');
      if (!toast) return;

      // Add icon prefix
      const icons = { success: '✓', error: '✕', warning: '⚠' };
      const icon = icons[type] || '•';
      if (!toast.textContent.startsWith(icon)) {
        toast.textContent = icon + '  ' + toast.textContent;
      }
    };
  }

  /* ─── 6. SECTION TRANSITION — smooth like Linear ─── */
  function enhanceSectionTransitions() {
    const sections = document.querySelectorAll('.sec');
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.target.classList.contains('active')) {
          entry.target.style.animation = 'none';
          entry.target.offsetHeight; // Reflow
          entry.target.style.animation = '';
        }
      }
    });
    sections.forEach(s => observer.observe(s));
  }

  /* ─── 7. KEYBOARD SHORTCUTS (Linear-style Cmd+K search focus) ─── */
  function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        const searchInput = document.getElementById('ov-global-search');
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
          searchInput.select();
        }
      }
    });
  }

  /* ─── INIT ─── */
  function init() {
    initSpotlight();
    startStaggerObserver();
    patchNavItems();
    patchToast();
    enhanceSectionTransitions();
    initKeyboardShortcuts();
    console.log('[PulseIQ Premium] ✓ Effects initialised');
  }

  // Always defer to DOMContentLoaded — script is in <head> so body may not exist yet
  document.addEventListener('DOMContentLoaded', function () {
    initSpotlight();
    startStaggerObserver();

    // Wait for the app to actually boot (Supabase auth is async)
    const appObserver = new MutationObserver(() => {
      const app = document.getElementById('app');
      if (app && app.style.display !== 'none') {
        init();
        appObserver.disconnect();
      }
    });
    if (document.body) {
      appObserver.observe(document.body, { childList: true, subtree: true, attributes: true });
    }
  });

  /* ─── 8. MONTHLY & DETAILED ATTENDANCE CSV EXPORT ─── */
  window.exportAttendanceCSV = function () {
    var atts = window.D && window.D.attendance ? window.D.attendance : [];
    var custs = window.D && window.D.customers ? window.D.customers : [];
    var centers = window.D && window.D.centers ? window.D.centers : [];

    if (!atts.length) {
      if (typeof window.showToast === 'function') window.showToast('No attendance records to export', 'error');
      else alert('No attendance records to export');
      return;
    }

    var csvRows = [];
    csvRows.push(['Date', 'Month', 'Customer Name', 'Contact', 'Center', 'Status', 'Time', 'Servings'].join(','));

    var sorted = atts.slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });

    sorted.forEach(function (a) {
      var cust = custs.find(function (c) { return c.id === a.customer_id; }) || {};
      var center = centers.find(function (c) { return c.id === (cust.center_id || a.center_id); }) || {};
      var name = (cust.name || a.customer_name || 'Unknown').replace(/,/g, ' ');
      var phone = (cust.contact || a.phone || '').replace(/,/g, '');
      var centerName = (center.name || '').replace(/,/g, ' ');
      var month = a.date ? a.date.substring(0, 7) : '';

      csvRows.push([
        a.date || '',
        month,
        '"' + name + '"',
        '"' + phone + '"',
        '"' + centerName + '"',
        a.status || 'present',
        a.time || '',
        a.servings || 1
      ].join(','));
    });

    var blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'attendance_records_' + new Date().toISOString().split('T')[0] + '.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (typeof window.showToast === 'function') window.showToast('Downloaded Attendance Records CSV ✓', 'success');
  };

  window.exportMonthlyAttendanceSummaryCSV = function () {
    var atts = window.D && window.D.attendance ? window.D.attendance : [];
    var custs = window.D && window.D.customers ? window.D.customers : [];

    if (!atts.length) {
      if (typeof window.showToast === 'function') window.showToast('No attendance records found', 'error');
      else alert('No attendance records found');
      return;
    }

    var monthlyMap = {};

    atts.forEach(function (a) {
      if (!a.date) return;
      var m = a.date.substring(0, 7);
      if (!monthlyMap[m]) {
        monthlyMap[m] = {
          month: m,
          totalVisits: 0,
          uniqueCustomers: new Set(),
          servings: 0
        };
      }
      if (a.status === 'present' || !a.status) {
        monthlyMap[m].totalVisits += 1;
        if (a.customer_id) monthlyMap[m].uniqueCustomers.add(a.customer_id);
        monthlyMap[m].servings += Number(a.servings || 1);
      }
    });

    var csvRows = [];
    csvRows.push(['MONTHLY ATTENDANCE SUMMARY (WELLNESS CENTER)']);
    csvRows.push(['Month (YYYY-MM)', 'Total Unique People Attended (Count)', 'Total Check-ins / Visits', 'Total Servings'].join(','));

    var sortedMonths = Object.keys(monthlyMap).sort().reverse();
    sortedMonths.forEach(function (m) {
      var data = monthlyMap[m];
      csvRows.push([
        m,
        data.uniqueCustomers.size,
        data.totalVisits,
        data.servings
      ].join(','));
    });

    csvRows.push([]);
    csvRows.push(['CUSTOMER WISE MONTHLY ATTENDANCE BREAKDOWN']);

    var header = ['Customer Name', 'Contact'].concat(sortedMonths).concat(['Total Visits']);
    csvRows.push(header.join(','));

    custs.forEach(function (c) {
      var row = ['"' + (c.name || 'Unknown').replace(/,/g, ' ') + '"', '"' + (c.contact || '').replace(/,/g, '') + '"'];
      var totalCustVisits = 0;

      sortedMonths.forEach(function (m) {
        var count = atts.filter(function (a) {
          return a.customer_id === c.id && a.date && a.date.startsWith(m) && (a.status === 'present' || !a.status);
        }).length;
        row.push(count);
        totalCustVisits += count;
      });

      row.push(totalCustVisits);
      if (totalCustVisits > 0) csvRows.push(row.join(','));
    });

    var blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'monthly_attendance_summary_' + new Date().toISOString().split('T')[0] + '.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (typeof window.showToast === 'function') window.showToast('Downloaded Monthly Attendance Summary CSV ✓', 'success');
  };

  /* ─── 9. PRINT-FRIENDLY ATTENDANCE PDF REPORT ─── */
  window.generateAttendancePDFReport = function () {
    var atts = window.D && window.D.attendance ? window.D.attendance : [];
    var centerName = typeof window.getCenterName === 'function' ? window.getCenterName() : 'Wellness Center';

    if (!atts.length) {
      if (typeof window.showToast === 'function') window.showToast('No attendance records found', 'error');
      else alert('No attendance records found');
      return;
    }

    var monthlyMap = {};
    atts.forEach(function (a) {
      if (!a.date) return;
      var m = a.date.substring(0, 7);
      if (!monthlyMap[m]) {
        monthlyMap[m] = { month: m, totalVisits: 0, uniqueCustomers: new Set(), servings: 0 };
      }
      if (a.status === 'present' || !a.status) {
        monthlyMap[m].totalVisits += 1;
        if (a.customer_id) monthlyMap[m].uniqueCustomers.add(a.customer_id);
        monthlyMap[m].servings += Number(a.servings || 1);
      }
    });

    var sortedMonths = Object.keys(monthlyMap).sort().reverse();
    var totalUniqueAllTime = new Set(atts.map(function (a) { return a.customer_id; })).size;
    var totalVisitsAllTime = atts.length;

    var monthlyRowsHtml = sortedMonths.map(function (m) {
      var data = monthlyMap[m];
      var dObj = new Date(m + '-01');
      var mLabel = isNaN(dObj.getTime()) ? m : dObj.toLocaleString('default', { month: 'long', year: 'numeric' });
      var avg = data.uniqueCustomers.size > 0 ? (data.totalVisits / data.uniqueCustomers.size).toFixed(1) : '0';
      return '<tr>' +
        '<td style="font-weight:700;color:#0f172a">' + mLabel + '</td>' +
        '<td style="text-align:center;font-weight:800;color:#059669">' + data.uniqueCustomers.size + ' people</td>' +
        '<td style="text-align:center;font-weight:700">' + data.totalVisits + ' check-ins</td>' +
        '<td style="text-align:center;color:#64748b">' + avg + ' visits/person</td>' +
        '<td style="text-align:center;font-weight:700;color:#2563eb">' + data.servings + ' servings</td>' +
        '</tr>';
    }).join('');

    var html = '<!DOCTYPE html><html><head><title>Monthly Attendance Report — ' + centerName + '</title>' +
      '<style>' +
      'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f8fafc;color:#1e293b;padding:32px;line-height:1.5}' +
      '@media print{.no-print{display:none!important}@page{margin:1.5cm}}' +
      '.card{background:#fff;border-radius:16px;padding:24px;border:1px solid #e2e8f0;box-shadow:0 4px 12px rgba(0,0,0,0.04);margin-bottom:24px}' +
      '.kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px}' +
      '.kpi{background:#f1f5f9;border-radius:12px;padding:16px 20px;border-left:4px solid #10b981}' +
      '.kpi-lbl{font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b;letter-spacing:1px;margin-bottom:6px}' +
      '.kpi-val{font-size:26px;font-weight:800;color:#0f172a}' +
      'table{width:100%;border-collapse:collapse;margin-top:12px}' +
      'th{background:#f8fafc;padding:12px 16px;text-align:left;font-size:11px;font-weight:800;text-transform:uppercase;color:#64748b;border-bottom:2px solid #e2e8f0}' +
      'td{padding:14px 16px;border-bottom:1px solid #f1f5f9;font-size:13px}' +
      'button.print-btn{background:#10b981;color:#fff;border:none;border-radius:10px;padding:12px 24px;font-size:14px;font-weight:700;cursor:pointer}' +
      '</style></head><body>' +
      '<div class="no-print" style="margin-bottom:20px;display:flex;justify-content:space-between;align-items:center">' +
      '  <div><strong style="font-size:16px">PDF Attendance Report Ready</strong></div>' +
      '  <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>' +
      '</div>' +
      '<div class="card">' +
      '  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">' +
      '    <div><h1 style="margin:0;font-size:24px;color:#0f172a">📊 Monthly Attendance Report</h1><div style="color:#64748b;font-size:13px;margin-top:4px">' + centerName + ' · Wellness Intelligence</div></div>' +
      '    <div style="font-size:12px;color:#64748b">Generated: ' + new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) + '</div>' +
      '  </div>' +
      '  <div class="kpi-grid">' +
      '    <div class="kpi" style="border-color:#10b981"><div class="kpi-lbl">Total People Attended</div><div class="kpi-val" style="color:#10b981">' + totalUniqueAllTime + ' Customers</div></div>' +
      '    <div class="kpi" style="border-color:#3b82f6"><div class="kpi-lbl">Total Visits Recorded</div><div class="kpi-val" style="color:#3b82f6">' + totalVisitsAllTime + ' Check-ins</div></div>' +
      '    <div class="kpi" style="border-color:#8b5cf6"><div class="kpi-lbl">Months Tracked</div><div class="kpi-val" style="color:#8b5cf6">' + sortedMonths.length + ' Months</div></div>' +
      '  </div>' +
      '  <h3 style="margin-top:24px;margin-bottom:12px;font-size:16px">📅 Monthly Attendance Summary</h3>' +
      '  <table><thead><tr><th>Month</th><th style="text-align:center">People Attended (Count)</th><th style="text-align:center">Total Visits</th><th style="text-align:center">Avg Visits/Person</th><th style="text-align:center">Total Servings</th></tr></thead>' +
      '  <tbody>' + monthlyRowsHtml + '</tbody></table>' +
      '</div></body></html>';

    var win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    } else {
      alert('Pop-up blocked! Please allow pop-ups for this site to view the PDF report.');
    }
  };
})();
