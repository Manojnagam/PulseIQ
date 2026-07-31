// ── AUTH SPLIT LIGHTWEIGHT INITIALIZER ──
console.log("AUTH BUILD 1.5.11 LOADED");
window.authSplitActive = true;

window.visualDebug = function(msg) {
  console.log('[DEBUG]', msg);
  try {
    var overlay = document.getElementById('mobile-debug-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'mobile-debug-overlay';
      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;max-height:50vh;overflow-y:auto;background:rgba(0,0,0,0.85);color:#0f0;font-family:monospace;font-size:11px;z-index:999999;padding:10px;pointer-events:none;text-align:left;line-height:1.4;';
      document.body.appendChild(overlay);
    }
    var div = document.createElement('div');
    div.textContent = '> ' + msg;
    overlay.appendChild(div);
    overlay.scrollTop = overlay.scrollHeight;
  } catch (err) {
    alert("DEBUG FAIL: " + msg);
  }
};

window.verifySystemState = async function() {
  visualDebug("--- SYS CHECK ---");
  visualDebug("UA: " + navigator.userAgent);
  visualDebug("Platform: " + navigator.platform);
  visualDebug("Standalone: " + (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone));
  
  // Storage checks
  try { localStorage.setItem('__test', '1'); localStorage.removeItem('__test'); visualDebug('localStorage: OK'); } catch(e) { visualDebug('localStorage: FAIL ' + e.message); }
  try { sessionStorage.setItem('__test', '1'); sessionStorage.removeItem('__test'); visualDebug('sessionStorage: OK'); } catch(e) { visualDebug('sessionStorage: FAIL ' + e.message); }
  
  // Service Worker check
  if ('serviceWorker' in navigator) {
    try {
      var regs = await navigator.serviceWorker.getRegistrations();
      if (regs && regs.length > 0) {
        visualDebug('SW found! Unregistering...');
        for (var i = 0; i < regs.length; i++) {
          await regs[i].unregister();
          visualDebug('Unregistered SW: ' + regs[i].scope);
        }
      } else {
        visualDebug('No Service Workers active.');
      }
    } catch(e) {
      visualDebug('SW check failed: ' + e.message);
    }
  }

  // Cache API check
  if ('caches' in window) {
    try {
      var keys = await caches.keys();
      for (var i = 0; i < keys.length; i++) {
        await caches.delete(keys[i]);
        visualDebug('Cleared cache: ' + keys[i]);
      }
    } catch(e) {
      visualDebug('Cache clear failed: ' + e.message);
    }
  }
};

window.safeStorage = window.safeStorage || (function() {
  var _mem = {};
  return {
    getItem: function(k) {
      try { return localStorage.getItem(k); } catch(e) { return _mem[k] !== undefined ? _mem[k] : null; }
    },
    setItem: function(k, v) {
      try { localStorage.setItem(k, v); } catch(e) { _mem[k] = String(v); }
    },
    removeItem: function(k) {
      try { localStorage.removeItem(k); } catch(e) { delete _mem[k]; }
    }
  };
})();

function loadScript(src, timeoutMs) {
  return new Promise(function(resolve, reject) {
    var existing = document.querySelector('script[src="' + src + '"]');
    if (existing) {
      if (existing.getAttribute('data-loaded') === 'true') {
        resolve();
        return;
      }
      existing.remove();
    }
    var s = document.createElement('script');
    s.src = src;
    var timer = setTimeout(function() {
      s.onload = null;
      s.onerror = null;
      if (s.parentNode) s.parentNode.removeChild(s);
      reject(new Error('Timeout loading ' + src));
    }, timeoutMs || 30000);
    s.onload = function() {
      clearTimeout(timer);
      s.setAttribute('data-loaded', 'true');
      resolve();
    };
    s.onerror = function() {
      clearTimeout(timer);
      if (s.parentNode) s.parentNode.removeChild(s);
      reject(new Error('Failed to load ' + src));
    };
    document.head.appendChild(s);
  });
}

var SB_URL = window.SB_URL || null;
var SB_KEY = window.SB_KEY || null;
var CENTER_SB_URL = 'https://erteibdxzdvsaujptxsd.supabase.co';
var CENTER_SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVydGVpYmR4emR2c2F1anB0eHNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MTE5MjMsImV4cCI6MjA5MDE4NzkyM30.Uh6aHjIx1Vukbk49K4oBqtRlxqTd9UiPXVGfDD7M9e0';

var _sbAuth = null;
var _authUser = null;
var _authSession = null;
var _centerAuth = null;
var ACTIVE_CENTER = '';
var OWNER_PROFILE = null;

async function initAuthClient() {
  if (_sbAuth) return;
  if (!window.supabase) {
    try {
      visualDebug("Before loading supabase-js from jsDelivr");
      await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.108.2', 15000);
      visualDebug("After loading supabase-js from jsDelivr");
    } catch (err1) {
      visualDebug('FAILED jsDelivr: ' + err1.message + ', trying unpkg...');
      try {
        await loadScript('https://unpkg.com/@supabase/supabase-js@2.108.2/dist/umd/supabase.js', 15000);
        visualDebug("After loading supabase-js from unpkg");
      } catch (err2) {
        visualDebug('FAILED unpkg: ' + err2.message + ', trying cdnjs...');
        try {
          await loadScript('https://cdnjs.cloudflare.com/ajax/libs/supabase-js/2.48.1/umd/supabase.min.js', 15000);
          visualDebug("After loading supabase-js from cdnjs");
        } catch (err3) {
          visualDebug('FAILED all supabase CDNs: ' + err3.message);
        }
      }
    }
  }
  if (window.supabase) {
    try {
      visualDebug("Before window.supabase.createClient");
      _sbAuth = window.supabase.createClient(CENTER_SB_URL, CENTER_SB_KEY, {
        auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
      });
      visualDebug("After window.supabase.createClient");
    } catch (err) {
      visualDebug("FAILED window.supabase.createClient: " + err.message);
    }
  } else {
    visualDebug("window.supabase is undefined after loads");
  }
}

async function checkExistingSession() {
  await initAuthClient();
  if (!_sbAuth) return false;
  var d = await _sbAuth.auth.getSession();
  if (d.data && d.data.session) {
    var sess = d.data.session;
    var exp = sess.expires_at;
    if (exp && exp < Math.floor(Date.now() / 1000) && sess.refresh_token) {
      var r = await _sbAuth.auth.setSession({ access_token: sess.access_token, refresh_token: sess.refresh_token });
      if (r.data && r.data.session) { sess = r.data.session; }
    }
    _authSession = sess;
    _authUser = sess.user;
    window._authSession = sess;
    window._authUser = sess.user;
    return true;
  }
  var storedRaw = safeStorage.getItem('pz_session_tokens');
  if (storedRaw) {
    try {
      var tokens = JSON.parse(storedRaw);
      if (tokens.access_token && tokens.refresh_token) {
        var r2 = await _sbAuth.auth.setSession({ access_token: tokens.access_token, refresh_token: tokens.refresh_token });
        if (r2.data && r2.data.session) {
          _authSession = r2.data.session;
          _authUser = r2.data.session.user;
          window._authSession = r2.data.session;
          window._authUser = r2.data.session.user;
          safeStorage.setItem('pz_session_tokens', JSON.stringify({ access_token: r2.data.session.access_token, refresh_token: r2.data.session.refresh_token }));
          return true;
        }
      }
    } catch(e) {}
    safeStorage.removeItem('pz_session_tokens');
  }
  return false;
}

function showLoginErr(msg) {
  var el = document.getElementById('login-error');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
  var cel = document.getElementById('login-code-error');
  if (cel) cel.style.display = 'none';
}

function showCodeErr(msg) {
  var el = document.getElementById('login-code-error');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

async function signOut() {
  await initAuthClient();
  if (_sbAuth) await _sbAuth.auth.signOut();
  _authUser = null; _authSession = null;
  window._authUser = null; window._authSession = null;
  safeStorage.removeItem('pz_session_tokens');
  safeStorage.removeItem('pz_remembered_email');
  safeStorage.removeItem('pz_login_ts');
  location.reload();
}

async function sendOtpCode() {
  await initAuthClient();
  if (!_sbAuth) return;
  var email = (document.getElementById('login-email').value || '').trim();
  if (!email) { showLoginErr('Please enter your email address.'); return; }
  var RL_KEY = 'otp_rl_' + email.toLowerCase();
  var RL_MAX = 5, RL_WINDOW = 10 * 60 * 1000;
  var now = Date.now();
  var attempts = JSON.parse(safeStorage.getItem(RL_KEY) || '[]').filter(function(t){ return now - t < RL_WINDOW; });
  var lastAttempt = attempts.length > 0 ? Math.max.apply(null, attempts) : 0;
  if (now - lastAttempt < 30000) {
    showLoginErr('Please wait 30 seconds before requesting a new code.');
    return;
  }
  if (attempts.length >= RL_MAX) {
    var waitMs = RL_WINDOW - (now - attempts[0]);
    var waitMin = Math.ceil(waitMs / 60000);
    showLoginErr('Too many requests. Please wait ' + waitMin + ' minute' + (waitMin > 1 ? 's' : '') + ' before trying again.');
    return;
  }
  var btn = document.getElementById('login-btn');
  btn.textContent = 'Checking…'; btn.disabled = true;
  async function sbFetch(urlPath, opts) {
    try {
      return await fetch(CENTER_SB_URL + urlPath, opts);
    } catch (e) {
      return await fetch('/api/sb' + urlPath, opts);
    }
  }
  try {
    var checkRes = await sbFetch('/rest/v1/rpc/is_registered_email', {
      method: 'POST',
      headers: { 'apikey': CENTER_SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_email: email })
    });
    var allowed = await checkRes.json();
    if (!allowed) {
      showLoginErr('This email is not registered. Contact your supervisor to get access.');
      btn.textContent = 'Send Code →'; btn.disabled = false;
      return;
    }
  } catch(e) {}
  btn.textContent = 'Sending…';
  var res = null;
  var success = false;
  var errMsg = '';
  try {
    res = await _sbAuth.auth.signInWithOtp({ email: email, options: { shouldCreateUser: true } });
    if (!res.error) success = true;
    else errMsg = res.error.message;
  } catch(e) {
    errMsg = e.message || 'Failed to fetch';
  }
  if (!success && (errMsg === 'Failed to fetch' || String(errMsg).indexOf('fetch') !== -1 || !errMsg)) {
    try {
      var restRes = await sbFetch('/auth/v1/otp', {
        method: 'POST',
        headers: { 'apikey': CENTER_SB_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, create_user: true })
      });
      if (restRes.ok) success = true;
      else {
        var restData = await restRes.json().catch(function(){ return {}; });
        errMsg = restData.msg || restData.error_description || 'HTTP ' + restRes.status;
      }
    } catch(e2) {
      errMsg = 'Network connection error (Failed to fetch). Please check connection or allow erteibdxzdvsaujptxsd.supabase.co.';
    }
  }
  if (!success) {
    if (errMsg === 'Failed to fetch' || String(errMsg).indexOf('fetch') !== -1) {
      errMsg = 'Network connection error (Failed to fetch). Please check connection or allow erteibdxzdvsaujptxsd.supabase.co.';
    }
    showLoginErr(errMsg);
    btn.textContent = 'Send Code →'; btn.disabled = false;
  } else {
    attempts.push(now);
    safeStorage.setItem(RL_KEY, JSON.stringify(attempts));
    document.getElementById('login-sent-to').textContent = email;
    document.getElementById('login-email-state').style.display = 'none';
    document.getElementById('login-code-state').style.display = 'block';
    setTimeout(function(){ var otpEl = document.getElementById('login-otp'); if(otpEl) otpEl.focus(); }, 100);
  }
}

async function verifyOtpCode() {
  visualDebug("verifyOtpCode ENTERED");
  var email = (document.getElementById('login-email').value || '').trim();
  var token = (document.getElementById('login-otp').value || '').trim();
  if (!token || token.length < 6) { showCodeErr('Please enter the login code.'); return; }
  var btn = document.getElementById('verify-btn');
  if (btn.disabled) return;
  btn.textContent = 'Verifying…'; btn.disabled = true;
  var res = null;
  
  try {
    window.verifySystemState().catch(function(e) { console.error('Sys check error', e); });
    visualDebug("Step 1: OTP submitted");

    try {
      visualDebug("Before Supabase verifyOtp");
      res = await _sbAuth.auth.verifyOtp({ email: email, token: token, type: 'email' });
      visualDebug("After Supabase verifyOtp");
    } catch(e) {
      visualDebug("FAILED Supabase verifyOtp: " + e.message);
      res = { error: { message: 'Failed to fetch' } };
    }

    if (res && res.error && (res.error.message === 'Failed to fetch' || String(res.error.message).indexOf('fetch') !== -1)) {
      visualDebug("Falling back to REST API verify");
      try {
        visualDebug("Before fetch API verify");
        var t0 = Date.now();
        var restRes = await fetch('/api/sb/auth/v1/verify', {
          method: 'POST',
          headers: { 'apikey': CENTER_SB_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email, token: token, type: 'email' })
        });
        visualDebug("After fetch API verify (" + (Date.now()-t0) + "ms): " + restRes.status);
        
        visualDebug("Before parsing JSON");
        var restData = await restRes.json();
        visualDebug("After parsing JSON");

        if (restRes.ok && restData.access_token) {
          visualDebug("Before setSession");
          await _sbAuth.auth.setSession({ access_token: restData.access_token, refresh_token: restData.refresh_token });
          visualDebug("After setSession");
          res = { data: { session: restData, user: restData.user }, error: null };
        } else if (restData.error_description || restData.msg) {
          res = { error: { message: restData.error_description || restData.msg } };
        }
      } catch(e2) {
        visualDebug("FAILED REST API verify: " + e2.message);
      }
    }

    if (!res) throw new Error('No response from verification APIs');

    if (res.error) {
      visualDebug("Step 2: Verification failed - " + res.error.message);
      showCodeErr(res.error.message === 'Token has expired or is invalid' ? 'Incorrect or expired code. Try again.' : res.error.message);
      btn.textContent = 'Verify & Sign In →'; btn.disabled = false;
    } else {
      visualDebug("Step 2: OTP verified successfully");
      
      if (!res.data || !res.data.session) throw new Error('Missing session data');
      
      visualDebug("Step 3: Session received");
      visualDebug("Session exists: YES");
      visualDebug("Access Token Length: " + (res.data.session.access_token ? res.data.session.access_token.length : 0));
      visualDebug("Refresh Token Exists: " + (!!res.data.session.refresh_token));
      visualDebug("User ID: " + (res.data.user ? res.data.user.id : 'N/A'));
      visualDebug("Expires At: " + res.data.session.expires_at);

      _authSession = res.data.session;
      _authUser = res.data.user;
      window._authSession = res.data.session;
      window._authUser = res.data.user;
      
      var rememberCb = document.getElementById('remember-device');
      if (!rememberCb || rememberCb.checked) {
        try {
          safeStorage.setItem('pz_remembered_email', email);
          safeStorage.setItem('pz_login_ts', String(Date.now()));
        } catch(e) { visualDebug("FAILED pz_remembered_email: " + e.message); }
      }
      
      if (res.data.session && res.data.session.refresh_token) {
        try {
          safeStorage.setItem('pz_session_tokens', JSON.stringify({ access_token: res.data.session.access_token, refresh_token: res.data.session.refresh_token }));
        } catch(e) { visualDebug("FAILED pz_session_tokens: " + e.message); }
      }
      visualDebug("Step 4: Session stored");

      visualDebug("Step 5: Invoking loadAndStartDashboard()");
      await loadAndStartDashboard();
      visualDebug("loadAndStartDashboard finished");
    }
  } catch (err) {
    visualDebug("FATAL ERROR: " + (err.stack || err.message || String(err)));
    showCodeErr('Error: ' + (err.message || String(err)));
    btn.textContent = 'Verify & Sign In →'; btn.disabled = false;
  }
}

async function loadAndStartDashboard() {
  visualDebug("Step 6: Dashboard loading (entered loadAndStartDashboard)");
  var temp = document.getElementById('dashboard-template');
  if (temp) {
    try {
      visualDebug("Cloning dashboard template");
      var clone = temp.content.cloneNode(true);
      document.body.appendChild(clone);
      temp.remove();
      visualDebug("Dashboard template appended");
    } catch (e) {
      visualDebug("FAILED template clone/append: " + e.message);
      throw e;
    }
  } else {
    visualDebug("Dashboard template NOT found (already loaded?)");
  }

  try {
    document.getElementById('login-screen').style.setProperty('display', 'none', 'important');
    visualDebug("Login screen hidden (important)");
    document.getElementById('app-loading').style.display = 'flex';
    visualDebug("App loading visible");
  } catch(e) {
    visualDebug("FAILED DOM toggle: " + e.message);
  }
  
  var splashTimer = setTimeout(function() {
    var al = document.getElementById('app-loading');
    if (al && getComputedStyle(al).display !== 'none') {
      visualDebug('App loading timeout safety triggered');
      al.style.display = 'none';
      var ls = document.getElementById('login-screen');
      if (ls && getComputedStyle(ls).display === 'none') {
        var appEl = document.getElementById('app');
        if (!appEl || (appEl.style.display !== 'block' && appEl.style.display !== 'grid')) {
          ls.style.display = 'flex';
          showLoginErr('Startup took too long. Check mobile signal and <button onclick="loadAndStartDashboard()" style="background:#27AE60;color:#fff;border:none;border-radius:6px;padding:4px 10px;font-weight:700;cursor:pointer;margin-left:6px">Retry 🔄</button>');
        }
      }
    }
  }, 30000);

  window._sbAuth = _sbAuth;
  window._authUser = _authUser;
  window._authSession = _authSession;
  window.SB_URL = SB_URL;
  window.SB_KEY = SB_KEY;

  try {
    visualDebug("Before initAuthClient in loadAndStartDashboard");
    await initAuthClient();
    visualDebug("After initAuthClient in loadAndStartDashboard");

    if (typeof window.bootDashboard !== 'function') {
      try {
        visualDebug("Before loading app.min.js");
        await loadScript('app.min.js?v=1.5.8', 30000);
        visualDebug("After loading app.min.js");
      } catch (scriptErr) {
        visualDebug('FAILED app.min.js: ' + scriptErr.message);
      }
    }
    if (typeof window.bootDashboard !== 'function') {
      try {
        visualDebug("Before loading app.js fallback");
        await loadScript('app.js?v=1.5.0', 30000);
        visualDebug("After loading app.js fallback");
      } catch (fallbackErr) {
        visualDebug('FAILED app.js: ' + fallbackErr.message);
      }
    }
    if (typeof window.bootDashboard === 'function') {
      visualDebug("Before bootDashboard");
      await window.bootDashboard();
      visualDebug("Step 7: Dashboard ready (bootDashboard complete)");
      clearTimeout(splashTimer);
    } else {
      visualDebug("bootDashboard function not found after script loads");
      throw new Error('bootDashboard function missing');
    }
  } catch (err) {
    clearTimeout(splashTimer);
    visualDebug('FATAL loadAndStartDashboard: ' + (err.stack || err.message));
    var al = document.getElementById('app-loading'); if (al) al.style.display = 'none';
    var ls = document.getElementById('login-screen'); if (ls) ls.style.display = 'flex';
    var errMsg = err && err.message ? err.message : 'Unknown error';
    showLoginErr('Failed to load application scripts (' + errMsg + '). <button onclick="loadAndStartDashboard()" style="margin-left:8px;background:#27AE60;color:#fff;border:none;border-radius:6px;padding:4px 12px;font-weight:700;cursor:pointer">Retry 🔄</button>');
    throw err;
  }
}

window.onload = async function() {
  try {
    var hasTokens = safeStorage.getItem('pz_session_tokens') || safeStorage.getItem('sb-erteibdxzdvsaujptxsd-auth-token');
    if (hasTokens) {
      await initAuthClient();
    }
    
    if (_sbAuth) {
      _sbAuth.auth.onAuthStateChange(function(event, session) {
        if (event === 'TOKEN_REFRESHED' && session) {
          _authSession = session;
          window._authSession = session;
          safeStorage.setItem('pz_session_tokens', JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token }));
        }
        if (event === 'SIGNED_IN' && session) {
          _authSession = session;
          window._authSession = session;
        }
      });
    }

    var SIXTY_DAYS = 60 * 24 * 60 * 60 * 1000;
    var rememberedEmail = safeStorage.getItem('pz_remembered_email');
    var loginTs = parseInt(safeStorage.getItem('pz_login_ts') || '0');
    var deviceTrusted = rememberedEmail && (Date.now() - loginTs) < SIXTY_DAYS;

    var sessionRestored = false;
    if (hasTokens) {
      sessionRestored = await checkExistingSession();
    }
    if (sessionRestored) {
      if (_authUser && _authUser.email) {
        safeStorage.setItem('pz_remembered_email', _authUser.email);
        safeStorage.setItem('pz_login_ts', Date.now());
      }
      deviceTrusted = true;
    }

    if (!deviceTrusted) {
      var al = document.getElementById('app-loading'); if (al) al.style.display = 'none';
      var ls = document.getElementById('login-screen'); if (ls) ls.style.display = 'flex';
      return;
    }

    if (!_authSession) {
      _authSession = { access_token: null, user: { email: rememberedEmail } };
      window._authSession = _authSession;
    }

    await loadAndStartDashboard();
  } catch (e) {
    console.error('Startup error:', e);
    var al = document.getElementById('app-loading'); if (al) al.style.display = 'none';
    var ls = document.getElementById('login-screen'); if (ls) ls.style.display = 'flex';
  }
};
