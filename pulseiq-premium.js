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
    document.querySelectorAll(SELECTORS).forEach(attachSpotlight);

    // Watch for dynamically rendered cards (module sections render async)
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches && node.matches(SELECTORS)) attachSpotlight(node);
          node.querySelectorAll && node.querySelectorAll(SELECTORS).forEach(attachSpotlight);
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
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
})();
