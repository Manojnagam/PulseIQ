/**
 * PulseIQ Performance Diagnostics Module (v2.3.16)
 * 
 * OPT-IN performance telemetry and timing instrumentation.
 * ZERO behavior/logic/rendering/data changes.
 * INERT unless URL contains ?perf=1 or window.enablePerfDiagnostics() is called.
 */
(function() {
  'use strict';

  var TARGET_RENDER_FNS = [
    'renderOverview',
    'renderCustomers',
    'renderFoodStats',
    'renderFoods',
    'renderAttendance',
    'renderAnalytics',
    'renderCouponView',
    'renderPayments',
    'renderOrgTree',
    'renderPlanMgmt',
    'initPinTracker',
    'renderProfileCard',
    'renderLeadsStats',
    'renderLeads',
    'renderGuide',
    'renderFinance',
    'renderRecoveryHub',
    'renderReportsView',
    'renderGoals',
    'renderNotifications',
    'initCommission',
    'initCoachWorkTracker',
    'loadExpenses',
    'renderExpenses',
    'loadContests',
    'renderContests',
    'renderRecheckList'
  ];

  var _isDiagnosticsActive = false;
  var _longTaskObserver = null;
  var _resourceObserver = null;

  function wrapRenderFunction(fnName) {
    if (!window.__perf || !window.__perf.renders) return;
    var orig = window[fnName];
    if (typeof orig !== 'function') return;
    if (orig.__perfWrapped) return;

    var wrapped = function() {
      var t0 = performance.now();
      var result;
      try {
        result = orig.apply(this, arguments);
      } catch (err) {
        var t1 = performance.now();
        var ms = Math.round((t1 - t0) * 10) / 10;
        window.__perf.renders.push({ fn: fnName, ms: ms, ts: Date.now(), error: true });
        throw err;
      }

      if (result && typeof result.then === 'function') {
        return result.then(function(val) {
          var t1 = performance.now();
          var ms = Math.round((t1 - t0) * 10) / 10;
          window.__perf.renders.push({ fn: fnName, ms: ms, ts: Date.now() });
          if (ms > 100) {
            console.warn('[PERF] Slow async execution: ' + fnName + ' took ' + ms + 'ms');
          }
          return val;
        }, function(reason) {
          var t1 = performance.now();
          var ms = Math.round((t1 - t0) * 10) / 10;
          window.__perf.renders.push({ fn: fnName, ms: ms, ts: Date.now(), error: true });
          return Promise.reject(reason);
        });
      } else {
        var t1 = performance.now();
        var ms = Math.round((t1 - t0) * 10) / 10;
        window.__perf.renders.push({ fn: fnName, ms: ms, ts: Date.now() });
        if (ms > 100) {
          console.warn('[PERF] Slow render: ' + fnName + ' took ' + ms + 'ms');
        }
        return result;
      }
    };

    wrapped.__perfWrapped = true;
    wrapped.__orig = orig;
    window[fnName] = wrapped;
  }

  function wrapAllTargetFunctions() {
    TARGET_RENDER_FNS.forEach(wrapRenderFunction);
  }

  function hookModuleLoader() {
    if (typeof window.loadModule === 'function' && !window.loadModule.__perfWrapped) {
      var origLoadModule = window.loadModule;
      var wrappedLoad = function(modKey) {
        return origLoadModule.apply(this, arguments).then(function(res) {
          wrapAllTargetFunctions();
          return res;
        });
      };
      wrappedLoad.__perfWrapped = true;
      wrappedLoad.__orig = origLoadModule;
      window.loadModule = wrappedLoad;
    }
  }

  function initLongTaskObserver() {
    if (_longTaskObserver) return;
    try {
      if (typeof PerformanceObserver === 'function' &&
          PerformanceObserver.supportedEntryTypes &&
          PerformanceObserver.supportedEntryTypes.indexOf('longtask') !== -1) {
        _longTaskObserver = new PerformanceObserver(function(list) {
          list.getEntries().forEach(function(entry) {
            var ms = Math.round(entry.duration * 10) / 10;
            var start = Math.round(entry.startTime);
            var attr = '';
            if (entry.attribution && entry.attribution.length) {
              attr = entry.attribution.map(function(a) {
                return a.name || a.containerType || a.containerSrc || a.containerId || 'unknown';
              }).join(';');
            }
            var item = { ms: ms, start: start, attribution: attr };
            window.__perf.longTasks.push(item);
            if (ms > 100) {
              console.warn('[PERF] Long task: ' + ms + 'ms (start: ' + start + 'ms' + (attr ? ', attr: ' + attr : '') + ')');
            }
          });
        });
        _longTaskObserver.observe({ entryTypes: ['longtask'] });
      }
    } catch (e) {
      // Ignore if observer unsupported in current environment
    }
  }

  function initResourceObserver() {
    if (_resourceObserver) return;
    try {
      if (typeof PerformanceObserver === 'function' &&
          PerformanceObserver.supportedEntryTypes &&
          PerformanceObserver.supportedEntryTypes.indexOf('resource') !== -1) {
        _resourceObserver = new PerformanceObserver(function(list) {
          list.getEntries().forEach(function(entry) {
            var it = entry.initiatorType;
            if (it === 'fetch' || it === 'xmlhttprequest') {
              var ttfb = (entry.responseStart > 0 && entry.requestStart > 0)
                ? Math.round(entry.responseStart - entry.requestStart)
                : Math.round(entry.duration);
              var total = Math.round(entry.duration);
              var kb = Math.round(((entry.transferSize || 0) / 1024) * 10) / 10;
              var url = (entry.name || '').slice(0, 120);
              window.__perf.net.push({
                url: url,
                ttfb: ttfb,
                total: total,
                KB: kb
              });
            }
          });
        });
        _resourceObserver.observe({ entryTypes: ['resource'] });
      }
    } catch (e) {
      // Ignore if observer unsupported in current environment
    }
  }

  function enableDiagnostics() {
    if (_isDiagnosticsActive) return 'PulseIQ Perf Diagnostics is already active.';
    _isDiagnosticsActive = true;

    if (!window.__perf) {
      window.__perf = {
        renders: [],
        longTasks: [],
        net: []
      };
    }

    wrapAllTargetFunctions();
    hookModuleLoader();
    initLongTaskObserver();
    initResourceObserver();

    console.info('[PulseIQ] Performance diagnostics ACTIVE (?perf=1). Run _perfReport() to view detailed report.');
    return 'PulseIQ Perf Diagnostics enabled.';
  }

  // 8. Global enable helper (idempotent)
  window.enablePerfDiagnostics = enableDiagnostics;

  // 7. Global report helper
  window._perfReport = function() {
    if (!window.__perf) {
      console.warn('[PulseIQ] Performance diagnostics not active. Enable with ?perf=1 in URL or run window.enablePerfDiagnostics().');
      return null;
    }

    // Aggregate render timings per function
    var renderAgg = {};
    (window.__perf.renders || []).forEach(function(r) {
      if (!renderAgg[r.fn]) {
        renderAgg[r.fn] = { count: 0, totalMs: 0, maxMs: 0, minMs: Infinity };
      }
      var a = renderAgg[r.fn];
      a.count++;
      a.totalMs += r.ms;
      if (r.ms > a.maxMs) a.maxMs = r.ms;
      if (r.ms < a.minMs) a.minMs = r.ms;
    });

    var topRenders = Object.keys(renderAgg).map(function(fn) {
      var a = renderAgg[fn];
      return {
        fn: fn,
        count: a.count,
        totalMs: Math.round(a.totalMs * 10) / 10,
        avgMs: Math.round((a.totalMs / a.count) * 10) / 10,
        maxMs: Math.round(a.maxMs * 10) / 10
      };
    }).sort(function(a, b) {
      return b.totalMs - a.totalMs;
    }).slice(0, 15);

    // Long tasks
    var longTasksCount = (window.__perf.longTasks || []).length;
    var topLongTasks = (window.__perf.longTasks || []).slice().sort(function(a, b) {
      return b.ms - a.ms;
    }).slice(0, 10);

    // Slow network requests (ttfb > 300ms or total > 1000ms)
    var slowRequests = (window.__perf.net || []).filter(function(n) {
      return n.ttfb > 300 || n.total > 1000;
    }).sort(function(a, b) {
      return b.total - a.total;
    }).slice(0, 10);

    // LocalStorage size
    var lsSizeKB = 0;
    try {
      var totalChars = 0;
      for (var k in localStorage) {
        if (Object.prototype.hasOwnProperty.call(localStorage, k)) {
          totalChars += (k.length + (localStorage[k] || '').length);
        }
      }
      lsSizeKB = Math.round((totalChars * 2 / 1024) * 10) / 10;
    } catch (e) {
      lsSizeKB = -1;
    }

    // DOM Node count
    var domNodeCount = 0;
    try {
      domNodeCount = document.querySelectorAll('*').length;
    } catch (e) {
      domNodeCount = -1;
    }

    // Device / Connection info
    var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    var effectiveType = conn ? conn.effectiveType : 'unknown';

    var reportObj = {
      version: 'v2.3.16',
      url: typeof location !== 'undefined' ? location.href : '',
      timestamp: new Date().toISOString(),
      device: {
        userAgent: navigator.userAgent,
        hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
        deviceMemory: navigator.deviceMemory !== undefined ? (navigator.deviceMemory + ' GB') : 'unknown',
        connectionEffectiveType: effectiveType
      },
      dom: {
        totalNodes: domNodeCount,
        localStorageKB: lsSizeKB
      },
      renders: {
        totalRecorded: (window.__perf.renders || []).length,
        top15ByTotalTime: topRenders
      },
      longTasks: {
        count: longTasksCount,
        top10: topLongTasks
      },
      network: {
        totalRequests: (window.__perf.net || []).length,
        slowRequestsTop10: slowRequests
      },
      tabPerfMetrics: window._tabPerfMetrics || {}
    };

    var lines = [];
    lines.push('================================================================');
    lines.push('⚡ PULSEIQ PERFORMANCE DIAGNOSTICS REPORT (' + reportObj.version + ')');
    lines.push('URL: ' + reportObj.url);
    lines.push('Timestamp: ' + reportObj.timestamp);
    lines.push('----------------------------------------------------------------');
    lines.push('🖥 DEVICE & BROWSER:');
    lines.push('  User Agent: ' + reportObj.device.userAgent);
    lines.push('  CPU Cores: ' + reportObj.device.hardwareConcurrency + ' | Memory: ' + reportObj.device.deviceMemory + ' | Conn: ' + reportObj.device.connectionEffectiveType);
    lines.push('  DOM Nodes: ' + reportObj.dom.totalNodes + ' | LocalStorage: ' + reportObj.dom.localStorageKB + ' KB');
    lines.push('----------------------------------------------------------------');
    lines.push('🎨 TOP RENDERS (by total execution time, top 15):');
    if (topRenders.length === 0) {
      lines.push('  (No renders recorded yet)');
    } else {
      topRenders.forEach(function(r, idx) {
        lines.push('  ' + (idx + 1) + '. ' + r.fn + ' — count: ' + r.count + ', total: ' + r.totalMs + 'ms, avg: ' + r.avgMs + 'ms, max: ' + r.maxMs + 'ms');
      });
    }
    lines.push('----------------------------------------------------------------');
    lines.push('⏳ LONG TASKS (>50ms total: ' + longTasksCount + ', top 10):');
    if (topLongTasks.length === 0) {
      lines.push('  (No long tasks recorded)');
    } else {
      topLongTasks.forEach(function(lt, idx) {
        lines.push('  ' + (idx + 1) + '. ' + lt.ms + 'ms (start: ' + lt.start + 'ms)' + (lt.attribution ? ' [attr: ' + lt.attribution + ']' : ''));
      });
    }
    lines.push('----------------------------------------------------------------');
    lines.push('🌐 SLOW NETWORK REQUESTS (ttfb>300ms or total>1000ms, top 10):');
    if (slowRequests.length === 0) {
      lines.push('  (No slow requests recorded)');
    } else {
      slowRequests.forEach(function(nr, idx) {
        lines.push('  ' + (idx + 1) + '. ' + nr.url + ' — TTFB: ' + nr.ttfb + 'ms, total: ' + nr.total + 'ms, size: ' + nr.KB + ' KB');
      });
    }
    if (reportObj.tabPerfMetrics && Object.keys(reportObj.tabPerfMetrics).length > 0) {
      lines.push('----------------------------------------------------------------');
      lines.push('📊 TAB MODULE METRICS (_tabPerfMetrics):');
      for (var tab in reportObj.tabPerfMetrics) {
        var m = reportObj.tabPerfMetrics[tab];
        lines.push('  • ' + tab + ': firstRender=' + m.firstRenderTimeMs + 'ms, blocking=' + m.mainThreadBlockingMs + 'ms');
      }
    }
    lines.push('================================================================');

    console.log(lines.join('\n'));
    return reportObj;
  };

  // 1. Gate: if (location.search.indexOf('perf=1') === -1) return;
  if (typeof location !== 'undefined' && location.search && location.search.indexOf('perf=1') !== -1) {
    enableDiagnostics();
  }
})();
