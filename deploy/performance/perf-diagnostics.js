/**
 * PulseIQ Performance Diagnostics Module (v2.3.21)
 * 
 * OPT-IN performance telemetry, error capture, navigation audit & on-screen report panel.
 * ZERO behavior/logic/rendering/data changes.
 * 
 * In normal mode:
 * - Silent in-memory error capture (window.__diagErrors) and nav audit (window.__diagNav).
 * - Zero console logs, zero UI elements, zero network requests, zero storage writes.
 * 
 * In diagnostics mode (?perf=1 or window.enablePerfDiagnostics()):
 * - On-screen floating diagnostics pill and bottom-sheet report viewer.
 * - Performance observers (longtask, resource timing, render timing).
 * - Session persistence mirror under sessionStorage['pulseiq_diag_v1'].
 */
(function() {
  'use strict';

  var VERSION = 'v2.3.21';
  var SESSION_KEY = 'pulseiq_diag_v1';

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

  // ════════════════════════════════════════════════════════════
  // 1. IN-MEMORY STORAGE BUFFERS (ALWAYS ACTIVE, ZERO OVERHEAD)
  // ════════════════════════════════════════════════════════════
  window.__diagErrors = window.__diagErrors || [];
  window.__diagNav = window.__diagNav || [];

  var _isOptIn = false;
  var _isDiagnosticsActive = false;
  var _longTaskObserver = null;
  var _resourceObserver = null;

  // Check URL opt-in (?perf=1)
  if (typeof location !== 'undefined' && location.search && location.search.indexOf('perf=1') !== -1) {
    _isOptIn = true;
  }

  // ════════════════════════════════════════════════════════════
  // 2. SESSION PERSISTENCE (ONLY WHEN ?perf=1 IS PRESENT)
  // ════════════════════════════════════════════════════════════
  function restoreDiagSession() {
    if (!_isOptIn) return;
    try {
      if (typeof sessionStorage !== 'undefined') {
        var stored = sessionStorage.getItem(SESSION_KEY);
        if (stored) {
          var parsed = JSON.parse(stored);
          if (parsed && Array.isArray(parsed.errors) && parsed.errors.length) {
            var existingErr = window.__diagErrors || [];
            window.__diagErrors = parsed.errors.concat(existingErr).slice(-100);
          }
          if (parsed && Array.isArray(parsed.nav) && parsed.nav.length) {
            var existingNav = window.__diagNav || [];
            window.__diagNav = parsed.nav.concat(existingNav).slice(-100);
          }
        }
      }
    } catch (e) {
      // Storage unavailable or quota exceeded
    }
  }

  function persistDiagSession() {
    if (!_isOptIn) return;
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({
          errors: (window.__diagErrors || []).slice(-50),
          nav: (window.__diagNav || []).slice(-50)
        }));
      }
    } catch (e) {
      // Storage unavailable or quota exceeded
    }
  }

  // Restore previous session if ?perf=1
  restoreDiagSession();

  // ════════════════════════════════════════════════════════════
  // 3. SILENT ALWAYS-ON ERROR CAPTURE (NO CONSOLE OUTPUT)
  // ════════════════════════════════════════════════════════════
  // A & C. Global Error & Resource Error listener (capture phase)
  window.addEventListener('error', function(e) {
    if (!window.__diagErrors) window.__diagErrors = [];
    var target = e.target;
    
    // Check if resource loading error (script, img, link, audio, video, source, etc.)
    if (target && target !== window && (target.tagName || target.src || target.href) && !e.message) {
      var tag = (target.tagName || '').toLowerCase();
      var rawAttr = target.getAttribute ? (target.getAttribute('src') || target.getAttribute('href')) : null;
      var absUrl = target.src || target.href || target.currentSrc || '';
      
      var realUrl = '';
      if (rawAttr === '' || rawAttr === null) {
        realUrl = '(empty ' + (target.getAttribute && target.getAttribute('src') !== null ? 'src' : (target.getAttribute && target.getAttribute('href') !== null ? 'href' : 'source')) + ')';
      } else if (absUrl && typeof location !== 'undefined' && absUrl === location.href && rawAttr !== location.href) {
        realUrl = '(empty ' + (target.getAttribute && target.getAttribute('src') !== null ? 'src' : 'href') + ')';
      } else if (absUrl) {
        realUrl = absUrl;
      } else if (rawAttr) {
        realUrl = rawAttr;
      } else {
        realUrl = '(unknown source)';
      }

      var snippet = '';
      try {
        if (target.outerHTML) {
          snippet = String(target.outerHTML).slice(0, 150);
        }
      } catch (err) {}

      var rec = {
        type: 'resource',
        tag: String(tag),
        src: String(realUrl).slice(0, 300),
        snippet: snippet,
        ts: Date.now()
      };
      if (window.__diagErrors.length >= 100) window.__diagErrors.shift();
      window.__diagErrors.push(rec);
      persistDiagSession();
      updatePillBadge();
      return;
    }

    // Standard JavaScript runtime error
    if (e.message || (e.error && e.error.message)) {
      var recJs = {
        type: 'js',
        msg: String(e.message || (e.error && e.error.message) || 'Unknown error').slice(0, 300),
        src: e.filename || (e.error && e.error.fileName) || '',
        line: e.lineno || (e.error && e.error.lineNumber) || 0,
        col: e.colno || (e.error && e.error.columnNumber) || 0,
        stack: (e.error && e.error.stack ? String(e.error.stack) : '').slice(0, 500),
        ts: Date.now()
      };
      if (window.__diagErrors.length >= 100) window.__diagErrors.shift();
      window.__diagErrors.push(recJs);
      persistDiagSession();
      updatePillBadge();
    }
  }, true); // Capture phase required for resource errors

  // B. Unhandled Promise Rejection listener
  window.addEventListener('unhandledrejection', function(e) {
    if (!window.__diagErrors) window.__diagErrors = [];
    var reason = e.reason;
    var msg = reason ? (reason.message || (typeof reason === 'string' ? reason : (typeof JSON !== 'undefined' ? JSON.stringify(reason) : String(reason)))) : 'Unhandled promise rejection';
    var stack = (reason && reason.stack) ? String(reason.stack) : '';
    var rec = {
      type: 'promise',
      msg: String(msg).slice(0, 300),
      stack: stack.slice(0, 500),
      ts: Date.now()
    };
    if (window.__diagErrors.length >= 100) window.__diagErrors.shift();
    window.__diagErrors.push(rec);
    persistDiagSession();
    updatePillBadge();
  }, false);

  // ════════════════════════════════════════════════════════════
  // 4. SILENT ALWAYS-ON NAV AUDIT (WRAPS window.goTo)
  // ════════════════════════════════════════════════════════════
  function wrapGoTo() {
    var origGoTo = window.goTo;
    if (typeof origGoTo !== 'function' || origGoTo.__diagWrapped) return;

    var wrappedGoTo = function(name, el) {
      var t0 = performance.now();
      var thrown = false;
      var errMsg = null;
      var result;
      try {
        result = origGoTo.apply(this, arguments);
      } catch (err) {
        thrown = true;
        errMsg = (err && err.message) ? err.message : String(err);
        var t1 = performance.now();
        var ms = Math.round((t1 - t0) * 10) / 10;
        if (!window.__diagNav) window.__diagNav = [];
        if (window.__diagNav.length >= 100) window.__diagNav.shift();
        window.__diagNav.push({
          name: String(name),
          ts: Date.now(),
          ms: ms,
          thrown: true,
          err: String(errMsg).slice(0, 300),
          reachedRender: !!(window._loadedTabs && window._loadedTabs[name])
        });
        persistDiagSession();
        throw err;
      }

      var t1 = performance.now();
      var ms = Math.round((t1 - t0) * 10) / 10;
      if (!window.__diagNav) window.__diagNav = [];
      if (window.__diagNav.length >= 100) window.__diagNav.shift();
      window.__diagNav.push({
        name: String(name),
        ts: Date.now(),
        ms: ms,
        thrown: false,
        reachedRender: !!(window._loadedTabs && window._loadedTabs[name])
      });
      persistDiagSession();
      return result;
    };

    wrappedGoTo.__diagWrapped = true;
    wrappedGoTo.__orig = origGoTo;
    window.goTo = wrappedGoTo;
  }

  // Install goTo wrapper if already defined, or retry shortly
  wrapGoTo();
  if (typeof window.goTo !== 'function') {
    var checkGoToTimer = setInterval(function() {
      if (typeof window.goTo === 'function') {
        wrapGoTo();
        clearInterval(checkGoToTimer);
      }
    }, 100);
    setTimeout(function() { clearInterval(checkGoToTimer); }, 10000);
  }

  // ════════════════════════════════════════════════════════════
  // 5. TIMING INSTRUMENTATION FOR OPT-IN MODE
  // ════════════════════════════════════════════════════════════
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
    wrapGoTo();
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
    } catch (e) {}
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
    } catch (e) {}
  }

  // ════════════════════════════════════════════════════════════
  // 6. ON-SCREEN DIAGNOSTICS UI (PILL & BOTTOM SHEET)
  // ════════════════════════════════════════════════════════════
  function updatePillBadge() {
    var badge = document.getElementById('_diag_pill_badge');
    if (badge) {
      var errCount = (window.__diagErrors || []).length;
      badge.textContent = errCount;
      badge.style.background = errCount > 0 ? '#ef4444' : '#10b981';
    }
  }

  function renderDiagnosticsUI() {
    if (typeof document === 'undefined' || !document.body) {
      if (typeof window !== 'undefined') {
        window.addEventListener('DOMContentLoaded', renderDiagnosticsUI);
      }
      return;
    }

    if (document.getElementById('_diag_pill')) return;

    var pill = document.createElement('button');
    pill.id = '_diag_pill';
    pill.setAttribute('aria-label', 'Open Performance Diagnostics');
    pill.style.cssText = 'position:fixed;bottom:14px;right:14px;z-index:999999;background:rgba(15,23,42,0.92);color:#38bdf8;border:1.5px solid #38bdf8;border-radius:20px;padding:6px 12px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,0.5);display:flex;align-items:center;gap:6px;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);user-select:none;touch-action:manipulation;';
    
    var errCount = (window.__diagErrors || []).length;
    pill.innerHTML = '<span>🐞 Diag</span><span id="_diag_pill_badge" style="background:' + (errCount > 0 ? '#ef4444' : '#10b981') + ';color:#fff;font-size:10px;padding:1px 6px;border-radius:10px;font-weight:800">' + errCount + '</span>';
    
    pill.onclick = function(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      toggleDiagnosticsPanel();
    };

    document.body.appendChild(pill);
  }

  function toggleDiagnosticsPanel() {
    var existing = document.getElementById('_diag_sheet');
    if (existing) {
      existing.remove();
      return;
    }

    var sheet = document.createElement('div');
    sheet.id = '_diag_sheet';
    sheet.style.cssText = 'position:fixed;bottom:0;left:0;right:0;max-height:75vh;z-index:1000000;background:#090d16;color:#e2e8f0;border-top:2px solid #38bdf8;border-radius:16px 16px 0 0;box-shadow:0 -10px 40px rgba(0,0,0,0.85);display:flex;flex-direction:column;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:11.5px;line-height:1.5;';

    // Header (rendered immediately)
    var header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#0f172a;border-bottom:1px solid #1e293b;border-radius:14px 14px 0 0;flex-shrink:0;';
    header.innerHTML = '<div style="display:flex;align-items:center;gap:8px;font-weight:700;color:#38bdf8;font-size:13px">'
      + '<span>⚡ PulseIQ Diagnostics (' + VERSION + ')</span>'
      + '<span id="_diag_viewport_badge" style="font-size:10px;padding:2px 6px;border-radius:6px;background:#1e293b;color:#94a3b8">' + (typeof window !== 'undefined' ? (window.innerWidth + 'x' + window.innerHeight) : '') + '</span>'
      + '</div>'
      + '<div style="display:flex;align-items:center;gap:8px">'
      + '<button id="_diag_btn_copy" style="background:#10b981;color:#fff;border:none;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer">📋 Copy Report</button>'
      + '<button id="_diag_btn_refresh" style="background:#334155;color:#f8fafc;border:none;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer">🔄 Refresh</button>'
      + '<button id="_diag_btn_close" style="background:#ef4444;color:#fff;border:none;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer">✕ Close</button>'
      + '</div>';
    sheet.appendChild(header);

    // Scrollable Content with loading state
    var content = document.createElement('div');
    content.id = '_diag_content';
    content.style.cssText = 'padding:14px 16px;overflow-y:auto;flex:1;-webkit-overflow-scrolling:touch;';
    content.innerHTML = '<div id="_diag_loading" style="padding:24px;text-align:center;color:#38bdf8;font-size:13px;font-weight:700">⏳ Loading diagnostics...</div>';
    sheet.appendChild(content);

    document.body.appendChild(sheet);

    // Event handlers for immediate actions
    var closeBtn = document.getElementById('_diag_btn_close');
    if (closeBtn) {
      closeBtn.onclick = function() {
        sheet.remove();
      };
    }

    // Populate content asynchronously so the sheet appears instantly on slow devices
    setTimeout(function() {
      populateDiagnosticsContent(sheet);
    }, 10);
  }

  function populateDiagnosticsContent(sheet) {
    if (!document.body.contains(sheet)) return;

    requestAnimationFrame(function() {
      var rep = generateDiagnosticReportObject();
      var vpBadge = document.getElementById('_diag_viewport_badge');
      if (vpBadge && rep.dom && rep.dom.viewport) {
        vpBadge.textContent = rep.dom.viewport;
      }

      var cEl = document.getElementById('_diag_content');
      if (!cEl) return;

      cEl.innerHTML = buildDiagnosticsHTML(rep);

      var copyBtn = document.getElementById('_diag_btn_copy');
      if (copyBtn) {
        copyBtn.onclick = function() {
          var textReport = formatDiagnosticReportText(generateDiagnosticReportObject());
          copyTextToClipboard(textReport, function() {
            copyBtn.textContent = '✅ Copied!';
            setTimeout(function() { if (copyBtn) copyBtn.textContent = '📋 Copy Report'; }, 2000);
          });
        };
      }

      var refreshBtn = document.getElementById('_diag_btn_refresh');
      if (refreshBtn) {
        refreshBtn.onclick = function() {
          cEl.innerHTML = '<div style="padding:24px;text-align:center;color:#38bdf8;font-size:13px;font-weight:700">⏳ Refreshing...</div>';
          setTimeout(function() {
            populateDiagnosticsContent(sheet);
          }, 10);
        };
      }
    });
  }

  function copyTextToClipboard(text, onSuccess) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text).then(onSuccess).catch(function() {
        fallbackCopy(text, onSuccess);
      });
    } else {
      fallbackCopy(text, onSuccess);
    }
  }

  function fallbackCopy(text, onSuccess) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.top = '0';
      ta.style.left = '0';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      ta.remove();
      if (typeof onSuccess === 'function') onSuccess();
    } catch (e) {
      alert('Could not copy report automatically. Please select text manually.');
    }
  }

  function buildDiagnosticsHTML(rep) {
    var html = [];

    // System summary
    html.push('<div style="background:#0f172a;padding:10px 12px;border-radius:8px;margin-bottom:12px;border:1px solid #1e293b">');
    html.push('<div style="color:#38bdf8;font-weight:700;margin-bottom:4px">🖥 Device & Environment</div>');
    html.push('<div><b>UA:</b> ' + escapeHtml(rep.device.userAgent) + '</div>');
    html.push('<div><b>CPU:</b> ' + rep.device.hardwareConcurrency + ' cores | <b>RAM:</b> ' + rep.device.deviceMemory + ' | <b>Conn:</b> ' + rep.device.connectionEffectiveType + ' | <b>DPR:</b> ' + rep.device.dpr + '</div>');
    html.push('<div><b>DOM:</b> ' + rep.dom.totalNodes + ' nodes | <b>LocalStorage:</b> ' + rep.dom.localStorageKB + ' KB | <b>Viewport:</b> ' + rep.dom.viewport + '</div>');
    html.push('<div><b>GoTo Wrapper:</b> ' + (rep.status && rep.status.goToWrapper === 'installed' ? '<span style="color:#10b981;font-weight:700">installed</span>' : '<span style="color:#ef4444;font-weight:700">not installed</span>') + ' | <b>Renders since load:</b> <span style="font-weight:700;color:#38bdf8">' + (rep.status ? rep.status.rendersSinceLoad : 0) + '</span></div>');
    html.push('</div>');

    // Failed Resources section (HTTP >= 400)
    var failedRes = rep.failedResources || [];
    html.push('<div style="background:#0f172a;padding:10px 12px;border-radius:8px;margin-bottom:12px;border:1px solid ' + (failedRes.length > 0 ? '#ef4444' : '#1e293b') + '">');
    html.push('<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">');
    html.push('<span style="color:' + (failedRes.length > 0 ? '#ef4444' : '#10b981') + ';font-weight:700">❌ Failed Resources (HTTP >= 400: ' + failedRes.length + ')</span>');
    html.push('</div>');
    if (failedRes.length === 0) {
      html.push('<div style="color:#10b981">✅ Zero resources with HTTP responseStatus >= 400.</div>');
    } else {
      failedRes.forEach(function(r) {
        html.push('<div style="padding:6px 8px;background:rgba(0,0,0,0.3);border-radius:6px;margin-bottom:6px;border-left:3px solid #ef4444">');
        html.push('<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">');
        html.push('<span style="background:#ef4444;color:#fff;font-size:9.5px;padding:1px 5px;border-radius:4px;font-weight:800">HTTP ' + r.status + '</span>');
        html.push('<span style="color:#94a3b8;font-size:10px">' + escapeHtml(r.initiatorType) + ' | ' + r.transferSize + ' B | ' + r.duration + 'ms</span>');
        html.push('</div>');
        html.push('<div style="color:#f8fafc;font-weight:600;word-break:break-all">' + escapeHtml(r.name) + '</div>');
        html.push('</div>');
      });
    }
    html.push('</div>');

    // Errors section
    var errs = rep.errors.items || [];
    html.push('<div style="background:#0f172a;padding:10px 12px;border-radius:8px;margin-bottom:12px;border:1px solid ' + (errs.length > 0 ? '#ef4444' : '#1e293b') + '">');
    html.push('<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">');
    html.push('<span style="color:' + (errs.length > 0 ? '#ef4444' : '#10b981') + ';font-weight:700">🚨 Captured Errors & Rejections (' + errs.length + ')</span>');
    html.push('</div>');
    if (errs.length === 0) {
      html.push('<div style="color:#10b981">✅ Zero errors or promise rejections captured.</div>');
    } else {
      errs.slice(0, 20).forEach(function(err) {
        var typeBg = err.type === 'resource' ? '#f59e0b' : (err.type === 'promise' ? '#a78bfa' : '#ef4444');
        var timeStr = new Date(err.ts).toLocaleTimeString();
        html.push('<div style="padding:6px 8px;background:rgba(0,0,0,0.3);border-radius:6px;margin-bottom:6px;border-left:3px solid ' + typeBg + '">');
        html.push('<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">');
        html.push('<span style="background:' + typeBg + ';color:#000;font-size:9.5px;padding:1px 5px;border-radius:4px;font-weight:800;text-transform:uppercase">' + err.type + (err.tag ? ' &lt;' + err.tag + '&gt;' : '') + '</span>');
        html.push('<span style="color:#94a3b8;font-size:10px">' + timeStr + '</span>');
        if (err.src) html.push('<span style="color:#64748b;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px">' + escapeHtml(err.src) + (err.line ? ':' + err.line : '') + '</span>');
        html.push('</div>');
        html.push('<div style="color:#f8fafc;font-weight:600;word-break:break-word">' + escapeHtml(err.msg || err.src || 'Error') + '</div>');
        if (err.snippet) {
          html.push('<pre style="color:#94a3b8;font-size:10px;margin-top:4px;overflow-x:auto;white-space:pre-wrap;background:#000;padding:4px 6px;border-radius:4px">' + escapeHtml(err.snippet) + '</pre>');
        }
        if (err.stack) {
          html.push('<pre style="color:#94a3b8;font-size:10px;margin-top:4px;overflow-x:auto;white-space:pre-wrap;background:#000;padding:4px 6px;border-radius:4px">' + escapeHtml(err.stack) + '</pre>');
        }
        html.push('</div>');
      });
    }
    html.push('</div>');

    // Navigation Audit
    var navs = rep.navigation.items || [];
    html.push('<div style="background:#0f172a;padding:10px 12px;border-radius:8px;margin-bottom:12px;border:1px solid #1e293b">');
    html.push('<div style="color:#38bdf8;font-weight:700;margin-bottom:6px">🧭 Navigation Audit (last ' + Math.min(navs.length, 20) + ')</div>');
    if (navs.length === 0) {
      html.push('<div style="color:#94a3b8">No navigation events recorded yet.</div>');
    } else {
      html.push('<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:6px">');
      navs.slice(-20).reverse().forEach(function(n) {
        var statColor = n.thrown ? '#ef4444' : (n.reachedRender ? '#10b981' : '#f59e0b');
        html.push('<div style="background:rgba(0,0,0,0.3);padding:6px 8px;border-radius:6px;border-left:3px solid ' + statColor + '">');
        html.push('<div style="font-weight:700;color:#f8fafc">' + escapeHtml(n.name) + ' <span style="font-size:10px;color:#94a3b8">' + n.ms + 'ms</span></div>');
        html.push('<div style="font-size:10px;color:' + statColor + '">' + (n.thrown ? '❌ Thrown: ' + escapeHtml(n.err || '') : (n.reachedRender ? '✅ Loaded' : '⚠️ Interrupted')) + '</div>');
        html.push('</div>');
      });
      html.push('</div>');
    }
    html.push('</div>');

    // Tab Metrics
    if (rep.tabPerfMetrics && Object.keys(rep.tabPerfMetrics).length > 0) {
      html.push('<div style="background:#0f172a;padding:10px 12px;border-radius:8px;margin-bottom:12px;border:1px solid #1e293b">');
      html.push('<div style="color:#a78bfa;font-weight:700;margin-bottom:6px">📊 Tab Performance Metrics (_tabPerfMetrics)</div>');
      for (var tab in rep.tabPerfMetrics) {
        var m = rep.tabPerfMetrics[tab];
        html.push('<div>• <b>' + escapeHtml(tab) + ':</b> firstRender=' + m.firstRenderTimeMs + 'ms, mainThreadBlocking=' + m.mainThreadBlockingMs + 'ms</div>');
      }
      html.push('</div>');
    }

    // Top Renders
    var renders = rep.renders.top15ByTotalTime || [];
    if (renders.length > 0) {
      html.push('<div style="background:#0f172a;padding:10px 12px;border-radius:8px;margin-bottom:12px;border:1px solid #1e293b">');
      html.push('<div style="color:#38bdf8;font-weight:700;margin-bottom:6px">🎨 Top Render Timings (by total execution time)</div>');
      renders.forEach(function(r, idx) {
        html.push('<div>' + (idx + 1) + '. <b>' + escapeHtml(r.fn) + '</b> — count: ' + r.count + ', total: ' + r.totalMs + 'ms, avg: ' + r.avgMs + 'ms, max: ' + r.maxMs + 'ms</div>');
      });
      html.push('</div>');
    }

    // Long Tasks
    var lts = rep.longTasks.top10 || [];
    if (lts.length > 0) {
      html.push('<div style="background:#0f172a;padding:10px 12px;border-radius:8px;margin-bottom:12px;border:1px solid #1e293b">');
      html.push('<div style="color:#f59e0b;font-weight:700;margin-bottom:6px">⏳ Long Tasks (>50ms, top 10)</div>');
      lts.forEach(function(lt, idx) {
        html.push('<div>' + (idx + 1) + '. <b>' + lt.ms + 'ms</b> (start: ' + lt.start + 'ms)' + (lt.attribution ? ' [' + escapeHtml(lt.attribution) + ']' : '') + '</div>');
      });
      html.push('</div>');
    }

    // Slow network
    var sreq = rep.network.slowRequestsTop10 || [];
    if (sreq.length > 0) {
      html.push('<div style="background:#0f172a;padding:10px 12px;border-radius:8px;border:1px solid #1e293b">');
      html.push('<div style="color:#38bdf8;font-weight:700;margin-bottom:6px">🌐 Slow Requests (TTFB>300ms or Total>1000ms)</div>');
      sreq.forEach(function(nr, idx) {
        html.push('<div>' + (idx + 1) + '. ' + escapeHtml(nr.url) + ' — TTFB: ' + nr.ttfb + 'ms, total: ' + nr.total + 'ms, size: ' + nr.KB + ' KB</div>');
      });
      html.push('</div>');
    }

    return html.join('');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ════════════════════════════════════════════════════════════
  // 7. DIAGNOSTICS REPORT DATA GENERATOR
  // ════════════════════════════════════════════════════════════
  function generateDiagnosticReportObject() {
    // Aggregated render timings
    var renderAgg = {};
    if (window.__perf && Array.isArray(window.__perf.renders)) {
      window.__perf.renders.forEach(function(r) {
        if (!renderAgg[r.fn]) {
          renderAgg[r.fn] = { count: 0, totalMs: 0, maxMs: 0, minMs: Infinity };
        }
        var a = renderAgg[r.fn];
        a.count++;
        a.totalMs += r.ms;
        if (r.ms > a.maxMs) a.maxMs = r.ms;
        if (r.ms < a.minMs) a.minMs = r.ms;
      });
    }

    var topRenders = Object.keys(renderAgg).map(function(fn) {
      var a = renderAgg[fn];
      return {
        fn: fn,
        count: a.count,
        totalMs: Math.round(a.totalMs * 10) / 10,
        avgMs: Math.round((a.totalMs / a.count) * 10) / 10,
        maxMs: Math.round(a.maxMs * 10) / 10
      };
    }).sort(function(a, b) { return b.totalMs - a.totalMs; }).slice(0, 15);

    // Long tasks
    var longTasksList = (window.__perf && Array.isArray(window.__perf.longTasks)) ? window.__perf.longTasks : [];
    var topLongTasks = longTasksList.slice().sort(function(a, b) { return b.ms - a.ms; }).slice(0, 10);

    // Network
    var netList = (window.__perf && Array.isArray(window.__perf.net)) ? window.__perf.net : [];
    var slowRequests = netList.filter(function(n) {
      return n.ttfb > 300 || n.total > 1000;
    }).sort(function(a, b) { return b.total - a.total; }).slice(0, 10);

    // Failed HTTP resources (responseStatus >= 400 from Resource Timing API)
    var failedResources = [];
    if (typeof performance !== 'undefined' && typeof performance.getEntriesByType === 'function') {
      try {
        var resEntries = performance.getEntriesByType('resource');
        resEntries.forEach(function(entry) {
          if (entry.responseStatus && entry.responseStatus >= 400) {
            failedResources.push({
              name: (entry.name || '').slice(0, 200),
              status: entry.responseStatus,
              transferSize: entry.transferSize || 0,
              duration: Math.round(entry.duration * 10) / 10,
              initiatorType: entry.initiatorType || 'other'
            });
          }
        });
      } catch (e) {}
    }

    // GoTo wrapper status & total renders
    var isGoToWrapped = (typeof window.goTo === 'function' && !!window.goTo.__diagWrapped);
    var rendersCount = (window.__perf && Array.isArray(window.__perf.renders)) ? window.__perf.renders.length : 0;

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

    // Viewport & screen
    var viewportStr = typeof window !== 'undefined' ? (window.innerWidth + 'x' + window.innerHeight) : 'unknown';
    var screenStr = (typeof window !== 'undefined' && window.screen) ? (window.screen.width + 'x' + window.screen.height) : 'unknown';
    var dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

    // Device / Connection
    var conn = (typeof navigator !== 'undefined') ? (navigator.connection || navigator.mozConnection || navigator.webkitConnection) : null;
    var effectiveType = conn ? conn.effectiveType : 'unknown';

    return {
      version: VERSION,
      url: typeof location !== 'undefined' ? location.href : '',
      timestamp: new Date().toISOString(),
      status: {
        goToWrapper: isGoToWrapped ? 'installed' : 'not installed',
        rendersSinceLoad: rendersCount
      },
      device: {
        userAgent: (typeof navigator !== 'undefined') ? navigator.userAgent : 'unknown',
        hardwareConcurrency: (typeof navigator !== 'undefined') ? (navigator.hardwareConcurrency || 'unknown') : 'unknown',
        deviceMemory: (typeof navigator !== 'undefined' && navigator.deviceMemory !== undefined) ? (navigator.deviceMemory + ' GB') : 'unknown',
        connectionEffectiveType: effectiveType,
        viewport: viewportStr,
        screen: screenStr,
        dpr: dpr
      },
      dom: {
        totalNodes: domNodeCount,
        localStorageKB: lsSizeKB,
        viewport: viewportStr
      },
      failedResources: failedResources,
      errors: {
        totalCount: (window.__diagErrors || []).length,
        items: (window.__diagErrors || []).slice(-20).reverse()
      },
      navigation: {
        totalCount: (window.__diagNav || []).length,
        items: (window.__diagNav || []).slice(-20)
      },
      renders: {
        totalRecorded: rendersCount,
        top15ByTotalTime: topRenders
      },
      longTasks: {
        count: longTasksList.length,
        top10: topLongTasks
      },
      network: {
        totalRequests: netList.length,
        slowRequestsTop10: slowRequests
      },
      tabPerfMetrics: window._tabPerfMetrics || {}
    };
  }

  function formatDiagnosticReportText(rep) {
    var lines = [];
    lines.push('================================================================');
    lines.push('⚡ PULSEIQ PERFORMANCE & ERROR DIAGNOSTICS REPORT (' + rep.version + ')');
    lines.push('URL: ' + rep.url);
    lines.push('Timestamp: ' + rep.timestamp);
    lines.push('----------------------------------------------------------------');
    lines.push('🖥 DEVICE & ENVIRONMENT:');
    lines.push('  User Agent: ' + rep.device.userAgent);
    lines.push('  CPU Cores: ' + rep.device.hardwareConcurrency + ' | RAM: ' + rep.device.deviceMemory + ' | Conn: ' + rep.device.connectionEffectiveType);
    lines.push('  Viewport: ' + rep.device.viewport + ' | Screen: ' + rep.device.screen + ' | DPR: ' + rep.device.dpr);
    lines.push('  DOM Nodes: ' + rep.dom.totalNodes + ' | LocalStorage: ' + rep.dom.localStorageKB + ' KB');
    lines.push('  GoTo Wrapper: ' + (rep.status ? rep.status.goToWrapper : 'unknown') + ' | Renders Since Load: ' + (rep.status ? rep.status.rendersSinceLoad : 0));
    lines.push('----------------------------------------------------------------');
    lines.push('❌ FAILED RESOURCES (HTTP >= 400: ' + (rep.failedResources ? rep.failedResources.length : 0) + '):');
    if (!rep.failedResources || rep.failedResources.length === 0) {
      lines.push('  (Zero failed resources with status >= 400)');
    } else {
      rep.failedResources.forEach(function(r, idx) {
        lines.push('  ' + (idx + 1) + '. [HTTP ' + r.status + '] ' + r.name);
        lines.push('     Type: ' + r.initiatorType + ' | Transfer: ' + r.transferSize + ' bytes | Duration: ' + r.duration + 'ms');
      });
    }
    lines.push('----------------------------------------------------------------');
    lines.push('🚨 CAPTURED ERRORS & REJECTIONS (' + rep.errors.totalCount + ' total, last ' + rep.errors.items.length + ' shown):');
    if (rep.errors.items.length === 0) {
      lines.push('  (Zero errors captured)');
    } else {
      rep.errors.items.forEach(function(err, idx) {
        var t = new Date(err.ts).toLocaleTimeString();
        lines.push('  ' + (idx + 1) + '. [' + err.type.toUpperCase() + (err.tag ? ' <' + err.tag + '>' : '') + '] ' + (err.msg || err.src || 'Unknown error') + ' (' + t + ')');
        if (err.src) lines.push('     Source: ' + err.src + (err.line ? ':' + err.line + ':' + err.col : ''));
        if (err.snippet) lines.push('     Snippet: ' + err.snippet);
        if (err.stack) lines.push('     Stack: ' + err.stack.replace(/\n/g, '\n     '));
      });
    }
    lines.push('----------------------------------------------------------------');
    lines.push('🧭 NAVIGATION AUDIT (' + rep.navigation.totalCount + ' total, last ' + rep.navigation.items.length + ' shown):');
    if (rep.navigation.items.length === 0) {
      lines.push('  (No navigation events recorded)');
    } else {
      rep.navigation.items.forEach(function(n, idx) {
        lines.push('  ' + (idx + 1) + '. ' + n.name + ' — ' + n.ms + 'ms | ' + (n.thrown ? 'THROWN: ' + n.err : (n.reachedRender ? 'SUCCESS' : 'EARLY-RETURN')));
      });
    }
    if (rep.tabPerfMetrics && Object.keys(rep.tabPerfMetrics).length > 0) {
      lines.push('----------------------------------------------------------------');
      lines.push('📊 TAB MODULE METRICS (_tabPerfMetrics):');
      for (var tab in rep.tabPerfMetrics) {
        var m = rep.tabPerfMetrics[tab];
        lines.push('  • ' + tab + ': firstRender=' + m.firstRenderTimeMs + 'ms, blocking=' + m.mainThreadBlockingMs + 'ms');
      }
    }
    if (rep.renders.top15ByTotalTime && rep.renders.top15ByTotalTime.length > 0) {
      lines.push('----------------------------------------------------------------');
      lines.push('🎨 TOP RENDERS (by total execution time):');
      rep.renders.top15ByTotalTime.forEach(function(r, idx) {
        lines.push('  ' + (idx + 1) + '. ' + r.fn + ' — count: ' + r.count + ', total: ' + r.totalMs + 'ms, avg: ' + r.avgMs + 'ms, max: ' + r.maxMs + 'ms');
      });
    }
    if (rep.longTasks.top10 && rep.longTasks.top10.length > 0) {
      lines.push('----------------------------------------------------------------');
      lines.push('⏳ LONG TASKS (>50ms total: ' + rep.longTasks.count + ', top 10):');
      rep.longTasks.top10.forEach(function(lt, idx) {
        lines.push('  ' + (idx + 1) + '. ' + lt.ms + 'ms (start: ' + lt.start + 'ms)' + (lt.attribution ? ' [attr: ' + lt.attribution + ']' : ''));
      });
    }
    if (rep.network.slowRequestsTop10 && rep.network.slowRequestsTop10.length > 0) {
      lines.push('----------------------------------------------------------------');
      lines.push('🌐 SLOW NETWORK REQUESTS (ttfb>300ms or total>1000ms, top 10):');
      rep.network.slowRequestsTop10.forEach(function(nr, idx) {
        lines.push('  ' + (idx + 1) + '. ' + nr.url + ' — TTFB: ' + nr.ttfb + 'ms, total: ' + nr.total + 'ms, size: ' + nr.KB + ' KB');
      });
    }
    lines.push('================================================================');
    return lines.join('\n');
  }

  // ════════════════════════════════════════════════════════════
  // 8. PUBLIC CLI HELPERS
  // ════════════════════════════════════════════════════════════
  window._perfReport = function() {
    var rep = generateDiagnosticReportObject();
    var text = formatDiagnosticReportText(rep);
    console.log(text);
    return rep;
  };

  window.enablePerfDiagnostics = function() {
    _isOptIn = true;
    enableDiagnostics();
    renderDiagnosticsUI();
    return 'PulseIQ Perf Diagnostics enabled.';
  };

  function enableDiagnostics() {
    if (_isDiagnosticsActive) return;
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
    renderDiagnosticsUI();

    console.info('[PulseIQ] Performance diagnostics ACTIVE (?perf=1). Run _perfReport() to view detailed report.');
  }

  // Auto-enable if ?perf=1 is in URL
  if (_isOptIn) {
    enableDiagnostics();
  }
})();
