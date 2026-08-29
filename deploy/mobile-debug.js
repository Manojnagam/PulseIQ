/**
 * PulseIQ Mobile Debugger v5.0
 * Tap the green DBG button → report is copied to clipboard instantly.
 * No overlay, no panel, nothing to break.
 */
(function () {
  'use strict';
  if (!/[?&]mdbg=1/.test(location.search)) return;

  var logs = [];
  function pushLog(type, msg) {
    logs.push('[' + new Date().toISOString().slice(11,23) + '][' + type.toUpperCase() + '] ' + msg);
    if (logs.length > 300) logs.shift();
  }
  ['log','warn','error','info'].forEach(function(m){
    var orig = console[m].bind(console);
    console[m] = function(){
      orig.apply(console, arguments);
      pushLog(m, Array.from(arguments).map(function(a){
        if (a instanceof Error) return a.stack || a.message;
        try { return typeof a === 'object' ? JSON.stringify(a) : String(a); } catch(e){ return String(a); }
      }).join(' '));
    };
  });
  window.addEventListener('error', function(e){ pushLog('error', e.message+' @ '+e.filename+':'+e.lineno); });
  window.addEventListener('unhandledrejection', function(e){ pushLog('error','Rejection: '+(e.reason&&(e.reason.message||e.reason))); });

  function buildReport() {
    var lines = [];
    lines.push('=== PulseIQ Mobile Debug Report v5.0 ===');
    lines.push('Time: ' + new Date().toISOString());
    lines.push('URL: ' + location.href);
    lines.push('UA: ' + navigator.userAgent);
    lines.push('Viewport: ' + window.innerWidth + 'x' + window.innerHeight + '  DPR:' + window.devicePixelRatio);
    lines.push('ScrollX: ' + Math.round(window.scrollX) + '  ScrollY: ' + Math.round(window.scrollY));
    lines.push('CSS --sw: "' + getComputedStyle(document.documentElement).getPropertyValue('--sw').trim() + '"');

    var mainEl = document.querySelector('.main');
    if (mainEl) {
      var mr = mainEl.getBoundingClientRect(), mc = getComputedStyle(mainEl);
      lines.push('.main rect: left='+Math.round(mr.left)+' top='+Math.round(mr.top)+' w='+Math.round(mr.width)+' h='+Math.round(mr.height));
      lines.push('.main CSS: marginLeft='+mc.marginLeft+' width='+mc.width+' overflowX='+mc.overflowX);
    } else { lines.push('.main: NOT FOUND'); }

    var secOv = document.getElementById('sec-overview');
    if (secOv) {
      var sr = secOv.getBoundingClientRect(), sc = getComputedStyle(secOv);
      lines.push('#sec-overview: left='+Math.round(sr.left)+' top='+Math.round(sr.top)+' w='+Math.round(sr.width));
      lines.push('#sec-overview CSS: display='+sc.display+' marginLeft='+sc.marginLeft+' transform='+sc.transform);
    } else { lines.push('#sec-overview: NOT FOUND'); }

    var checks = [
      '.main','#sec-overview','.sec.active','#overview-stats',
      '.stats .stat','.stat-v','#ov-quick-actions','.ov-quick-btn'
    ];
    lines.push('');
    checks.forEach(function(sel){
      var els = document.querySelectorAll(sel);
      if (!els.length) { lines.push('[MISSING] '+sel); return; }
      var el = els[0];
      var rect = el.getBoundingClientRect();
      var cs = getComputedStyle(el);
      var inVP = rect.width>0&&rect.height>0&&rect.top<window.innerHeight&&rect.bottom>0&&rect.left<window.innerWidth&&rect.right>0;
      var issues = [];
      if (cs.display==='none') issues.push('display:none');
      if (parseFloat(cs.opacity)<0.05) issues.push('opacity:'+cs.opacity);
      if (cs.visibility==='hidden') issues.push('visibility:hidden');
      if (cs.animationName&&cs.animationName!=='none') issues.push('anim:'+cs.animationName+'/'+cs.animationFillMode);
      if (!inVP) issues.push('OFF-SCREEN left='+Math.round(rect.left)+' top='+Math.round(rect.top));
      lines.push((issues.length?'[BAD] ':'[OK]  ')+sel+(issues.length?' → '+issues.join(', '):''));
      lines.push('      rect: '+Math.round(rect.left)+','+Math.round(rect.top)+' '+Math.round(rect.width)+'x'+Math.round(rect.height)+' inVP='+inVP);
      lines.push('      marginLeft='+cs.marginLeft+' opacity='+cs.opacity+' anim='+cs.animationName);
      if (els.length>1) lines.push('      ('+els.length+' total elements)');
    });

    var stat = document.querySelector('.stat');
    if (stat) {
      var bf = getComputedStyle(stat).backdropFilter||getComputedStyle(stat).webkitBackdropFilter||'none';
      lines.push((bf!=='none'?'[BAD] ':'[OK]  ')+'.stat backdropFilter: '+bf);
    }

    lines.push('');
    lines.push('--- Console logs (last 60) ---');
    logs.slice(-60).forEach(function(l){ lines.push(l); });

    return lines.join('\n');
  }

  function showToast(msg) {
    var t = document.createElement('div');
    t.textContent = msg;
    t.setAttribute('style','position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#00d97e;color:#000;font-weight:bold;font-size:14px;font-family:monospace;padding:12px 20px;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.5);pointer-events:none;white-space:nowrap');
    document.body.appendChild(t);
    setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); }, 3000);
  }

  function copyNow() {
    var text = buildReport();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function(){
        showToast('✅ Report copied! Paste to Claude.');
      }).catch(function(){ fallback(text); });
    } else { fallback(text); }
  }

  function fallback(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('style','position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;');
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    try {
      document.execCommand('copy');
      showToast('✅ Report copied! Paste to Claude.');
    } catch(e) {
      showToast('❌ Copy failed — see console');
    }
    document.body.removeChild(ta);
  }

  function init() {
    if (!document.body) { setTimeout(init, 50); return; }
    var btn = document.createElement('button');
    btn.textContent = '🐛 DBG';
    btn.setAttribute('style',[
      'position:fixed','top:50%','right:0','transform:translateY(-50%)',
      'z-index:2147483647','background:#00d97e','color:#000',
      'font-size:13px','font-weight:bold','font-family:monospace',
      'padding:14px 8px','border:3px solid #000','border-right:none',
      'border-radius:10px 0 0 10px','cursor:pointer',
      'writing-mode:vertical-rl','letter-spacing:2px',
      'box-shadow:-4px 0 16px rgba(0,217,126,0.6)','outline:none'
    ].join(';'));
    btn.addEventListener('click', copyNow);
    document.body.appendChild(btn);
    pushLog('info','[mdbg v5.0] ready — tap DBG to copy report');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
