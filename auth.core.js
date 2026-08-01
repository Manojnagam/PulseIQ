// ── AUTH SPLIT LIGHTWEIGHT INITIALIZER ──
console.log("AUTH BUILD 1.6.0 LOADED");
window.authSplitActive = true;

// Debug: console-only in production (no visible overlay that blocks UI)
window.visualDebug = function(msg) {
  console.log('[AUTH]', msg);
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
  // Pick up client if app.min.js already initialized it into window._sbAuth
  if (window._sbAuth) { _sbAuth = window._sbAuth; return; }
  if (!window.supabase) {
    try {
      await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.108.2', 15000);
    } catch (err1) {
      console.warn('supabase CDN 1 failed, trying unpkg...', err1.message);
      try {
        await loadScript('https://unpkg.com/@supabase/supabase-js@2.108.2/dist/umd/supabase.js', 15000);
      } catch (err2) {
        console.warn('supabase CDN 2 failed, trying cdnjs...', err2.message);
        try {
          await loadScript('https://cdnjs.cloudflare.com/ajax/libs/supabase-js/2.48.1/umd/supabase.min.js', 15000);
        } catch (err3) {
          console.error('All supabase CDNs failed:', err3.message);
        }
      }
    }
  }
  if (window.supabase) {
    try {
      _sbAuth = window.supabase.createClient(CENTER_SB_URL, CENTER_SB_KEY, {
        auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
      });
      window._sbAuth = _sbAuth; // publish so app.min.js shares the same client
    } catch (err) {
      console.error('supabase.createClient failed:', err.message);
    }
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
  if (el) { el.innerHTML = msg; el.style.display = 'block'; }
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
  var btn = document.getElementById('login-btn');
  var email = (document.getElementById('login-email').value || '').trim();
  if (!email) { showLoginErr('Please enter your email address.'); return; }
  if (btn) { btn.textContent = 'Connecting…'; btn.disabled = true; }
  await initAuthClient();
  if (!_sbAuth) {
    showLoginErr('Could not connect to authentication service. Please refresh and try again.');
    if (btn) { btn.textContent = 'Send Code →'; btn.disabled = false; }
    return;
  }
  var RL_KEY = 'otp_rl_' + email.toLowerCase();
  var RL_MAX = 5, RL_WINDOW = 10 * 60 * 1000;
  var now = Date.now();
  var attempts = JSON.parse(safeStorage.getItem(RL_KEY) || '[]').filter(function(t){ return now - t < RL_WINDOW; });
  var lastAttempt = attempts.length > 0 ? Math.max.apply(null, attempts) : 0;
  if (now - lastAttempt < 30000) {
    showLoginErr('Please wait 30 seconds before requesting a new code.');
    if (btn) { btn.textContent = 'Send Code →'; btn.disabled = false; }
    return;
  }
  if (attempts.length >= RL_MAX) {
    var waitMs = RL_WINDOW - (now - attempts[0]);
    var waitMin = Math.ceil(waitMs / 60000);
    showLoginErr('Too many requests. Please wait ' + waitMin + ' minute' + (waitMin > 1 ? 's' : '') + ' before trying again.');
    if (btn) { btn.textContent = 'Send Code →'; btn.disabled = false; }
    return;
  }
  if (btn) { btn.textContent = 'Checking…'; }
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
      errMsg = 'Network connection error. Please check your connection and try again.';
    }
  }
  if (!success) {
    if (errMsg === 'Failed to fetch' || String(errMsg).indexOf('fetch') !== -1) {
      errMsg = 'Network connection error. Please check your connection and try again.';
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
  var email = (document.getElementById('login-email').value || '').trim();
  var token = (document.getElementById('login-otp').value || '').trim();
  if (!token || token.length < 6) { showCodeErr('Please enter the login code.'); return; }
  var btn = document.getElementById('verify-btn');
  if (btn.disabled) return;
  btn.textContent = 'Verifying…'; btn.disabled = true;
  var res = null;

  try {
    // Primary: Supabase SDK verify
    try {
      res = await _sbAuth.auth.verifyOtp({ email: email, token: token, type: 'email' });
    } catch(e) {
      res = { error: { message: 'Failed to fetch' } };
    }

    // Fallback: REST API verify (for network-restricted environments)
    if (res && res.error && (res.error.message === 'Failed to fetch' || String(res.error.message).indexOf('fetch') !== -1)) {
      try {
        var restRes = await fetch('/api/sb/auth/v1/verify', {
          method: 'POST',
          headers: { 'apikey': CENTER_SB_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email, token: token, type: 'email' })
        });
        var restData = await restRes.json();
        if (restRes.ok && restData.access_token) {
          await _sbAuth.auth.setSession({ access_token: restData.access_token, refresh_token: restData.refresh_token });
          res = { data: { session: restData, user: restData.user }, error: null };
        } else if (restData.error_description || restData.msg) {
          res = { error: { message: restData.error_description || restData.msg } };
        }
      } catch(e2) {
        console.error('REST verify failed:', e2.message);
      }
    }

    if (!res) throw new Error('No response from verification APIs');

    if (res.error) {
      showCodeErr(res.error.message === 'Token has expired or is invalid' ? 'Incorrect or expired code. Try again.' : res.error.message);
      btn.textContent = 'Verify & Sign In →'; btn.disabled = false;
    } else {
      if (!res.data || !res.data.session) throw new Error('Missing session data');

      _authSession = res.data.session;
      _authUser = res.data.user;
      window._authSession = res.data.session;
      window._authUser = res.data.user;

      var rememberCb = document.getElementById('remember-device');
      if (!rememberCb || rememberCb.checked) {
        try {
          safeStorage.setItem('pz_remembered_email', email);
          safeStorage.setItem('pz_login_ts', String(Date.now()));
        } catch(e) {}
      }

      if (res.data.session && res.data.session.refresh_token) {
        try {
          safeStorage.setItem('pz_session_tokens', JSON.stringify({ access_token: res.data.session.access_token, refresh_token: res.data.session.refresh_token }));
        } catch(e) {}
      }

      await loadAndStartDashboard();
    }
  } catch (err) {
    console.error('verifyOtpCode error:', err);
    showCodeErr('Error: ' + (err.message || String(err)));
    btn.textContent = 'Verify & Sign In →'; btn.disabled = false;
  }
}

async function loadAndStartDashboard() {
  var temp = document.getElementById('dashboard-template');
  if (temp) {
    try {
      var clone = temp.content.cloneNode(true);
      document.body.appendChild(clone);
      temp.remove();
    } catch (e) {
      throw e;
    }
  }

  try {
    document.getElementById('login-screen').style.setProperty('display', 'none', 'important');
    document.getElementById('app-loading').style.display = 'flex';
  } catch(e) {
    console.error('DOM toggle failed:', e.message);
  }

  var splashTimer = setTimeout(function() {
    var al = document.getElementById('app-loading');
    if (al && getComputedStyle(al).display !== 'none') {
      al.style.display = 'none';
      var ls = document.getElementById('login-screen');
      if (ls && getComputedStyle(ls).display === 'none') {
        var appEl = document.getElementById('app');
        if (!appEl || (appEl.style.display !== 'block' && appEl.style.display !== 'grid')) {
          ls.style.display = 'flex';
          showLoginErr('Startup took too long. Check your connection and <button onclick="loadAndStartDashboard()" style="background:#27AE60;color:#fff;border:none;border-radius:6px;padding:4px 10px;font-weight:700;cursor:pointer;margin-left:6px">Retry 🔄</button>');
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
    await initAuthClient();

    if (typeof window.bootDashboard !== 'function') {
      try {
        await loadScript('app.min.js?v=1.7.2', 30000);
      } catch (scriptErr) {
        console.warn('app.min.js failed, trying app.js fallback:', scriptErr.message);
      }
    }
    if (typeof window.bootDashboard !== 'function') {
      try {
        await loadScript('app.js?v=1.7.1', 30000);
      } catch (fallbackErr) {
        console.warn('app.js fallback also failed:', fallbackErr.message);
      }
    }
    if (typeof window.bootDashboard === 'function') {
      await window.bootDashboard();
      clearTimeout(splashTimer);
    } else {
      throw new Error('bootDashboard function missing');
    }
  } catch (err) {
    clearTimeout(splashTimer);
    console.error('loadAndStartDashboard failed:', err);
    var al = document.getElementById('app-loading'); if (al) al.style.display = 'none';
    var ls = document.getElementById('login-screen'); if (ls) ls.style.display = 'flex';
    var errMsg = err && err.message ? err.message : 'Unknown error';
    showLoginErr('Failed to load application (' + errMsg + '). <button onclick="loadAndStartDashboard()" style="margin-left:8px;background:#27AE60;color:#fff;border:none;border-radius:6px;padding:4px 12px;font-weight:700;cursor:pointer">Retry 🔄</button>');
    throw err;
  }
}

window.onload = async function() {
  try {
    var hasTokens = safeStorage.getItem('pz_session_tokens') || safeStorage.getItem('sb-erteibdxzdvsaujptxsd-auth-token');
    // Always preload supabase so Send Code button is instant
    await initAuthClient();

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
