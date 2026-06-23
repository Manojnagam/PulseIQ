
// ── STATE ──
function loadScript(src) {
  return new Promise(function(resolve, reject) {
    if (document.querySelector('script[src="' + src + '"]')) {
      resolve();
      return;
    }
    var s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}
var SB_URL = window.SB_URL || null; var SB_KEY = window.SB_KEY || null;
// Center owners (₹1999) use a separate Supabase project — keeps their data isolated from supervisor's data
var CENTER_SB_URL = 'https://erteibdxzdvsaujptxsd.supabase.co';
var CENTER_SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVydGVpYmR4emR2c2F1anB0eHNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MTE5MjMsImV4cCI6MjA5MDE4NzkyM30.Uh6aHjIx1Vukbk49K4oBqtRlxqTd9UiPXVGfDD7M9e0';
function isCenterSession() { return _centerAuth && _centerAuth.type === 'center'; }
// Use main Supabase if credentials exist, otherwise fall back to center Supabase (for paying customers)
function getActiveSbUrl() { return SB_URL || CENTER_SB_URL; }
function getActiveSbKey() { return (_authSession && _authSession.access_token) || SB_KEY || CENTER_SB_KEY; }
var COUNTRY_CODE = localStorage.getItem('countryCode') || '91';
var WA_LANG = localStorage.getItem('waLang') || 'English';

// ── AUTH ──
var _sbAuth = window._sbAuth || null;
var _authUser = window._authUser || null;
var _authSession = window._authSession || null;

function initAuthClient() {
  if (_sbAuth) return;
  _sbAuth = window.supabase.createClient(CENTER_SB_URL, CENTER_SB_KEY, {
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
  });
}

async function checkExistingSession() {
  initAuthClient();
  // Try Supabase's built-in session first
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
    return true;
  }
  // Fallback: use manually stored tokens (access_token needed as parseable JWT even if expired)
  var storedRaw = localStorage.getItem('pz_session_tokens');
  if (storedRaw) {
    try {
      var tokens = JSON.parse(storedRaw);
      if (tokens.access_token && tokens.refresh_token) {
        var r2 = await _sbAuth.auth.setSession({ access_token: tokens.access_token, refresh_token: tokens.refresh_token });
        if (r2.data && r2.data.session) {
          _authSession = r2.data.session;
          _authUser = r2.data.session.user;
          localStorage.setItem('pz_session_tokens', JSON.stringify({ access_token: r2.data.session.access_token, refresh_token: r2.data.session.refresh_token }));
          return true;
        }
      }
    } catch(e) {}
    localStorage.removeItem('pz_session_tokens');
  }
  return false;
}

async function sendOtpCode() {
  initAuthClient();
  var email = (document.getElementById('login-email').value || '').trim();
  if (!email) { showLoginErr('Please enter your email address.'); return; }
  // Rate limit: max 3 OTP requests per email per 10 minutes
  var RL_KEY = 'otp_rl_' + email.toLowerCase();
  var RL_MAX = 3, RL_WINDOW = 10 * 60 * 1000;
  var now = Date.now();
  var attempts = JSON.parse(localStorage.getItem(RL_KEY) || '[]').filter(function(t){ return now - t < RL_WINDOW; });
  if (attempts.length >= RL_MAX) {
    var waitMs = RL_WINDOW - (now - attempts[0]);
    var waitMin = Math.ceil(waitMs / 60000);
    showLoginErr('Too many requests. Please wait ' + waitMin + ' minute' + (waitMin > 1 ? 's' : '') + ' before trying again.');
    return;
  }
  attempts.push(now);
  localStorage.setItem(RL_KEY, JSON.stringify(attempts));
  var btn = document.getElementById('login-btn');
  btn.textContent = 'Checking…'; btn.disabled = true;
  // Block unregistered emails before sending OTP
  try {
    var checkRes = await fetch(CENTER_SB_URL + '/rest/v1/rpc/is_registered_email', {
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
  } catch(e) { /* network error — proceed */ }
  btn.textContent = 'Sending…';
  var res = await _sbAuth.auth.signInWithOtp({ email: email, options: { shouldCreateUser: true } });
  if (res.error) {
    showLoginErr(res.error.message);
    btn.textContent = 'Send Code →'; btn.disabled = false;
  } else {
    document.getElementById('login-sent-to').textContent = email;
    document.getElementById('login-email-state').style.display = 'none';
    document.getElementById('login-code-state').style.display = 'block';
    setTimeout(function(){ document.getElementById('login-otp').focus(); }, 100);
  }
}

async function verifyOtpCode() {
  var email = (document.getElementById('login-email').value || '').trim();
  var token = (document.getElementById('login-otp').value || '').trim();
  if (!token || token.length < 6) { showCodeErr('Please enter the login code.'); return; }
  var btn = document.getElementById('verify-btn');
  btn.textContent = 'Verifying…'; btn.disabled = true;
  var res = await _sbAuth.auth.verifyOtp({ email: email, token: token, type: 'email' });
  if (res.error) {
    showCodeErr(res.error.message === 'Token has expired or is invalid' ? 'Incorrect or expired code. Try again.' : res.error.message);
    btn.textContent = 'Verify & Sign In →'; btn.disabled = false;
  } else {
    _authSession = res.data.session;
    _authUser = res.data.user;
    // Remember this device if checkbox is checked
    var rememberCb = document.getElementById('remember-device');
    if (!rememberCb || rememberCb.checked) {
      localStorage.setItem('pz_remembered_email', email);
      localStorage.setItem('pz_login_ts', String(Date.now()));
    }
    if (res.data.session && res.data.session.refresh_token) {
      localStorage.setItem('pz_session_tokens', JSON.stringify({ access_token: res.data.session.access_token, refresh_token: res.data.session.refresh_token }));
    }
    await startApp();
  }
}

function showCodeErr(msg) {
  var el = document.getElementById('login-code-error');
  el.textContent = msg; el.style.display = 'block';
}

function showLoginErr(msg) {
  var el = document.getElementById('login-error');
  el.textContent = msg; el.style.display = 'block';
  document.getElementById('login-code-error').style.display = 'none';
}

async function signOut() {
  if (_sbAuth) await _sbAuth.auth.signOut();
  _authUser = null; _authSession = null;
  localStorage.removeItem('pz_session_tokens');
  localStorage.removeItem('pz_remembered_email');
  localStorage.removeItem('pz_login_ts');
  location.reload();
}

async function startApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-loading').style.display = 'flex';
  if (window.location.hash) history.replaceState(null, '', window.location.pathname);

  // ── Super admin fast-path: check remembered email even without a real auth session ──
  var _currentEmail = (_authUser && _authUser.email) || (_authSession && _authSession.user && _authSession.user.email) || localStorage.getItem('pz_remembered_email') || '';
  var HARDCODED_SUPER_ADMINS = ['manojnagam1551@gmail.com'];
  if (HARDCODED_SUPER_ADMINS.indexOf(_currentEmail) !== -1) {
    ACTIVE_CENTER = '';
    localStorage.setItem('activeCenter', '');
    _centerAuth = { type: 'master' };
    sessionStorage.setItem('centerAuth', JSON.stringify(_centerAuth));
    var _opQ = JSON.parse(localStorage.getItem('ownerProfile') || '{}');
    delete _opQ.center_name;
    localStorage.setItem('ownerProfile', JSON.stringify(_opQ));
    if (typeof OWNER_PROFILE !== 'undefined') OWNER_PROFILE = _opQ;
    try { renderProfileCard(); } catch(e) {}
  }

  // ── Auto-link: match logged-in email to a center if not already linked ──
  if (_authUser) {
    var authEl = document.getElementById('sb-auth-user');
    if (authEl) authEl.textContent = '● ' + _authUser.email;

    // Check if this is super admin
    var superAdminEmail = '';
    try {
      var settingsRes = await fetch(CENTER_SB_URL + '/rest/v1/app_settings?key=eq.super_admin_email&select=value', { headers: { 'apikey': CENTER_SB_KEY, 'Authorization': 'Bearer ' + _authSession.access_token } });
      var settingsData = await settingsRes.json();
      superAdminEmail = (Array.isArray(settingsData) && settingsData[0]) ? settingsData[0].value : '';
    } catch(e) {}
    var HARDCODED_SUPER_ADMINS = ['manojnagam1551@gmail.com'];
    var isSuperAdmin = (_authUser.user_metadata && _authUser.user_metadata.role === 'super_admin') || _authUser.email === superAdminEmail || HARDCODED_SUPER_ADMINS.indexOf(_authUser.email) !== -1;

    if (isSuperAdmin) {
      // Super admin: clear any center lock from previous session
      ACTIVE_CENTER = '';
      localStorage.setItem('activeCenter', '');
      var _opSA = JSON.parse(localStorage.getItem('ownerProfile') || '{}');
      delete _opSA.center_name;
      localStorage.setItem('ownerProfile', JSON.stringify(_opSA));
      if (typeof OWNER_PROFILE !== 'undefined') OWNER_PROFILE = _opSA;
    } else {
      // Try to auto-link by email if auth_user_id not set yet
      var jwt = _authSession.access_token;
      var centersRes = await fetch(CENTER_SB_URL + '/rest/v1/wellness_centers?select=id,name,owner_id,owner_email', { headers: { 'apikey': CENTER_SB_KEY, 'Authorization': 'Bearer ' + jwt } });
      var centers = await centersRes.json();
      var myCenter = (Array.isArray(centers) ? centers : []).find(function(c){ return c.owner_id === _authUser.id; })
                  || (Array.isArray(centers) ? centers : []).find(function(c){ return c.owner_email === _authUser.email; });

      if (!myCenter) {
        // Unknown email — access denied
        document.getElementById('app-loading').style.display = 'none';
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('login-email-state').style.display = 'none';
        document.getElementById('login-code-state').style.display = 'none';
        if (!document.getElementById('access-denied')) {
          document.getElementById('login-screen').querySelector('div').insertAdjacentHTML('beforeend',
            '<div id="access-denied" style="text-align:center;padding:8px 0"><div style="font-size:40px;margin-bottom:12px">🚫</div><div style="font-size:16px;font-weight:700;color:#dc2626;margin-bottom:8px">Access Denied</div><div style="font-size:13px;color:#6b7280;line-height:1.7">Your email is not linked to any center.<br>Contact your supervisor to get access.</div><button onclick="signOut()" style="margin-top:20px;background:#1a3a28;color:#fff;border:none;border-radius:8px;padding:10px 20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Sign Out</button></div>'
          );
        }
        return;
      }

      // Auto-link owner_id if not set
      if (!myCenter.owner_id) {
        await fetch(CENTER_SB_URL + '/rest/v1/wellness_centers?id=eq.' + myCenter.id, {
          method: 'PATCH',
          headers: { 'apikey': CENTER_SB_KEY, 'Authorization': 'Bearer ' + jwt, 'Content-Type': 'application/json' },
          body: JSON.stringify({ owner_id: _authUser.id })
        });
      }
      // Lock center owner to their own center
      ACTIVE_CENTER = myCenter.id;
      localStorage.setItem('activeCenter', myCenter.id);
      _centerAuth = { type: 'center', centerId: myCenter.id };
      sessionStorage.setItem('centerAuth', JSON.stringify(_centerAuth));
      // Store center name so sidebar shows correctly before loadAll completes
      var _op = JSON.parse(localStorage.getItem('ownerProfile') || '{}');
      _op.center_name = myCenter.name;
      localStorage.setItem('ownerProfile', JSON.stringify(_op));
      if (typeof OWNER_PROFILE !== 'undefined') OWNER_PROFILE = _op;
    }
  }

  // ── Load app ──
  var url = localStorage.getItem('sb_url');
  var key = localStorage.getItem('sb_key');
  if (url && key) {
    document.getElementById('sb-url').value = url;
    document.getElementById('sb-key').value = key;
    SB_URL = url.replace(/\/$/, '');
    SB_KEY = key;
    await doConnect();
  } else {
    document.getElementById('setup').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    await loadAll();
  }
}
var ACTIVE_CENTER = localStorage.getItem('activeCenter') || '';

// ── LANGUAGE / TRANSLATIONS ──
var LANG = localStorage.getItem('svLang') || 'en';
var T = {
  en: {
    // sidebar groups
    nav_management:'Management', nav_business:'Business', nav_setup:'Setup',
    // nav items
    nav_overview:'Overview', nav_centers:'Wellness Centers', nav_coaches:'Coaches',
    nav_coach_portal:'Coach Portal \u2197', nav_inventory:'Inventory', nav_customers:'Customers',
    nav_leads:'Leads', nav_attendance:'Attendance', nav_body:'Body Composition',
    nav_finance:'Finance', nav_analytics:'Analytics', nav_coupons:'Coupons',
    nav_payments:'Payments', nav_orgtree:'Org Tree', nav_pintracker:'Pin Tracker',
    nav_bizanalyst:'Biz Analyst', nav_auditlog:'Audit Log', nav_expenses:'Expense Tracker',
    nav_coachperf:'Coach Performance', nav_goals:'Goal Setting', nav_notifications:'Notifications',
    nav_guide:'How to Use', nav_profile:'My Profile', nav_sql:'SQL Setup Guide',
    // sidebar footer
    lbl_active_center:'Active Center', opt_all_centers:'All Centers',
    btn_refresh:'\uD83D\uDD04 Refresh Data', btn_disconnect:'\u26A1 Disconnect',
    btn_lang:'తె', // shown in EN mode to switch to Telugu
    // section titles
    pt_overview:'Overview Dashboard', ps_overview:'Your wellness center at a glance',
    pt_centers:'Wellness Centers', ps_centers:'Manage all centers in your network',
    pt_coaches:'Coaches', ps_coaches:'Manage your coaching staff',
    pt_inventory:'Inventory', ps_inventory:'Track nutrition products, stock movements and daily usage',
    pt_customers:'Customers', ps_customers:'Track all customers and their packs',
    pt_leads:'Leads', ps_leads:'Track potential customers and follow-ups',
    pt_attendance:'Attendance', ps_attendance:'Track customer visit history',
    pt_body:'Body Composition', ps_body:'Select a customer to view their health journey',
    pt_finance:'Finance & P&L', ps_finance:'Income, expenses and profit & loss',
    pt_analytics:'Analytics Dashboard', ps_analytics:'Business insights from your data',
    pt_coupons:'Coupon System', ps_coupons:'Track coupons from referrals for coaches & customers',
    pt_payments:'Payments', ps_payments:'Track partial payments and balances',
    pt_orgtree:'Organisation Tree', ps_orgtree:'Coach downline structure',
    pt_bizanalyst:'\uD83D\uDCCA Business Analyst', ps_bizanalyst:"Auto-analysis of every coach's business",
    pt_pintracker:'\uD83C\uDFC5 Pin Tracker', ps_pintracker:'Track your Volume Points and pin qualification progress',
    pt_profile:'My Profile', ps_profile:'Your business profile, center details and promotion goals',
    pt_guide:'How to Use', ps_guide:'Step-by-step guide for every feature',
    pt_auditlog:'Audit Log', ps_auditlog:'Track all data changes — who did what and when',
    pt_sql:'SQL Setup Guide & AI Config', ps_sql:'Configure APIs and Database Schemas',
    pt_expenses:'Expense Tracker', ps_expenses:'Record and monitor center operating costs',
    pt_coachperf:'Coach Performance', ps_coachperf:'Revenue, customers, and attendance per coach',
    pt_goals:'Goal Setting', ps_goals:'Set and track monthly targets',
    pt_notifications:'Notifications', ps_notifications:'Alerts that need your attention',
    // water card
    wi_title:'\uD83C\uDF0A Morning Water Intention',
    wi_guide1:'\uD83E\uDD5B Hold your glass of water. Close your eyes. Breathe deeply once. Then read this aloud <strong>3 times</strong> with full feeling:',
    wi_guide2:'\u2728 On the 3rd reading \u2014 drink the water <strong>immediately</strong>, right at that moment. No waiting. The water carries your intention. \uD83D\uDCAA',
    wi_done_btn:'\u2705 Done for today! See you tomorrow.',
    wi_pending_btn:'\uD83D\uDCA7 I did it \u2014 I drank my intention!',
    // affirmation template (use {name} and {pin} placeholders)
    affirmation:'I, {name}, am a {icon} {pin} member at Dharani\'s. I attract abundance, health and happiness. I help people transform their lives every single day. Success flows to me naturally.',
    // goals section
    lbl_new_members:'New Members', lbl_revenue:'Revenue (\u20B9)', lbl_daily_att:'Daily Attendance', lbl_leads_conv:'Leads Converted',
    btn_save_goals:'\uD83D\uDCBE Save Goals',
    goals_monthly_targets:'Monthly Targets \u2014',
    goals_empty:'Set your targets above and tap Save Goals to track progress.',
    // notifications
    btn_refresh_notif:'\uD83D\uDD04 Refresh',
  },
  te: {
    // sidebar groups
    nav_management:'మేనేజ్‌మెంట్', nav_business:'వ్యాపారం', nav_setup:'సెటప్',
    // nav items
    nav_overview:'ఓవర్‌వ్యూ', nav_centers:'వెల్నెస్ సెంటర్లు', nav_coaches:'కోచ్‌లు',
    nav_coach_portal:'కోచ్ పోర్టల్ \u2197', nav_inventory:'ఇన్వెంటరీ', nav_customers:'కస్టమర్లు',
    nav_leads:'లీడ్స్', nav_attendance:'హాజరు', nav_body:'శరీర కూర్పు',
    nav_finance:'ఆర్థికం', nav_analytics:'విశ్లేషణలు', nav_coupons:'కూపన్లు',
    nav_payments:'చెల్లింపులు', nav_orgtree:'సంస్థ చెట్టు', nav_pintracker:'పిన్ ట్రాకర్',
    nav_bizanalyst:'బిజ్ విశ్లేషకుడు', nav_auditlog:'ఆడిట్ లాగ్', nav_expenses:'ఖర్చుల ట్రాకర్',
    nav_coachperf:'కోచ్ పనితీరు', nav_goals:'లక్ష్య నిర్దేశం', nav_notifications:'నోటిఫికేషన్లు',
    nav_guide:'ఎలా వాడాలి', nav_profile:'నా ప్రొఫైల్', nav_sql:'SQL సెటప్ గైడ్',
    // sidebar footer
    lbl_active_center:'యాక్టివ్ సెంటర్', opt_all_centers:'అన్ని సెంటర్లు',
    btn_refresh:'\uD83D\uDD04 డేటా రిఫ్రెష్', btn_disconnect:'\u26A1 డిస్‌కనెక్ట్',
    btn_lang:'EN',
    // section titles
    pt_overview:'ఓవర్‌వ్యూ డ్యాష్‌బోర్డ్', ps_overview:'మీ వెల్నెస్ సెంటర్ ఒక్కసారి చూద్దాం',
    pt_centers:'వెల్నెస్ సెంటర్లు', ps_centers:'మీ నెట్‌వర్క్‌లోని అన్ని సెంటర్లను నిర్వహించండి',
    pt_coaches:'కోచ్‌లు', ps_coaches:'మీ కోచింగ్ స్టాఫ్‌ను నిర్వహించండి',
    pt_inventory:'ఇన్వెంటరీ', ps_inventory:'హెర్బాలైఫ్ ఉత్పత్తులు, స్టాక్ మరియు రోజువారీ వాడకం',
    pt_customers:'కస్టమర్లు', ps_customers:'అన్ని కస్టమర్లు మరియు వారి ప్యాక్‌లను ట్రాక్ చేయండి',
    pt_leads:'లీడ్స్', ps_leads:'సంభావ్య కస్టమర్లు మరియు ఫాలో-అప్‌లను ట్రాక్ చేయండి',
    pt_attendance:'హాజరు', ps_attendance:'కస్టమర్ సందర్శన చరిత్రను ట్రాక్ చేయండి',
    pt_body:'శరీర కూర్పు', ps_body:'కస్టమర్ ఆరోగ్య ప్రయాణాన్ని చూడటానికి ఎంచుకోండి',
    pt_finance:'ఆర్థికం & లాభనష్టాలు', ps_finance:'ఆదాయం, ఖర్చులు మరియు లాభనష్టాల వివరాలు',
    pt_analytics:'విశ్లేషణలు డ్యాష్‌బోర్డ్', ps_analytics:'మీ డేటా నుండి వ్యాపార అంతర్దృష్టులు',
    pt_coupons:'కూపన్ సిస్టమ్', ps_coupons:'కోచ్‌లు & కస్టమర్ల రిఫరల్ కూపన్లను ట్రాక్ చేయండి',
    pt_payments:'చెల్లింపులు', ps_payments:'పాక్షిక చెల్లింపులు మరియు బాలెన్స్‌లను ట్రాక్ చేయండి',
    pt_orgtree:'సంస్థ నిర్మాణం', ps_orgtree:'కోచ్ డౌన్‌లైన్ నిర్మాణం',
    pt_bizanalyst:'\uD83D\uDCCA బిజ్ విశ్లేషకుడు', ps_bizanalyst:'ప్రతి కోచ్ వ్యాపారం యొక్క స్వయంచాలక విశ్లేషణ',
    pt_pintracker:'\uD83C\uDFC5 పిన్ ట్రాకర్', ps_pintracker:'మీ వాల్యూమ్ పాయింట్లు మరియు పిన్ అర్హతను ట్రాక్ చేయండి',
    pt_profile:'నా ప్రొఫైల్', ps_profile:'మీ హెర్బాలైఫ్ గుర్తింపు, సెంటర్ వివరాలు మరియు ప్రమోషన్ లక్ష్యాలు',
    pt_guide:'ఎలా వాడాలి', ps_guide:'ప్రతి ఫీచర్ కోసం దశల వారీ గైడ్',
    pt_auditlog:'ఆడిట్ లాగ్', ps_auditlog:'అన్ని డేటా మార్పులు — ఎవరు ఏమి చేసారు',
    pt_sql:'SQL సెటప్ గైడ్ & AI కాన్ఫిగ్', ps_sql:'API లు మరియు డేటాబేస్ స్కీమాలను కాన్ఫిగర్ చేయండి',
    pt_expenses:'ఖర్చుల ట్రాకర్', ps_expenses:'సెంటర్ నిర్వహణ ఖర్చులను నమోదు చేయండి',
    pt_coachperf:'కోచ్ పనితీరు', ps_coachperf:'కోచ్‌కి ఆదాయం, కస్టమర్లు మరియు హాజరు',
    pt_goals:'లక్ష్య నిర్దేశం', ps_goals:'నెలవారీ లక్ష్యాలను నిర్దేశించండి మరియు ట్రాక్ చేయండి',
    pt_notifications:'నోటిఫికేషన్లు', ps_notifications:'మీ దృష్టి అవసరమయ్యే హెచ్చరికలు',
    // water card
    wi_title:'\uD83C\uDF0A ఉదయం నీటి సంకల్పం',
    wi_guide1:'\uD83E\uDD5B మీ నీటి గ్లాసు పట్టుకోండి. కళ్ళు మూసుకోండి. ఒకసారి లోతుగా శ్వాస తీసుకోండి. తర్వాత పూర్తి భావంతో ఈ మాటలు <strong>3 సార్లు</strong> బిగ్గరగా చదవండి:',
    wi_guide2:'\u2728 మూడవ సారి చదివిన వెంటనే \u2014 ఆ క్షణంలోనే నీళ్ళు తాగండి. ఆగవద్దు. నీళ్ళు మీ సంకల్పాన్ని మోస్తాయి. \uD83D\uDCAA',
    wi_done_btn:'\u2705 ఈరోజు చేసారు! రేపు కలుద్దాం.',
    wi_pending_btn:'\uD83D\uDCA7 చేసాను \u2014 సంకల్పంతో నీళ్ళు తాగాను!',
    // affirmation in Telugu ({member} = సభ్యుడిని or సభ్యురాలిని based on gender)
    affirmation:'నేను, {name}, ధరణి\'స్‌లో {icon} {pin} {member}. నేను సమృద్ధి, ఆరోగ్యం మరియు సంతోషాన్ని ఆకర్షిస్తాను. నేను ప్రతిరోజూ ప్రజల జీవితాలను మార్చడంలో సహాయపడతాను. విజయం నాకు సహజంగా వస్తుంది.',
    // goals section
    lbl_new_members:'కొత్త సభ్యులు', lbl_revenue:'ఆదాయం (\u20B9)', lbl_daily_att:'రోజువారీ హాజరు', lbl_leads_conv:'మారిన లీడ్స్',
    btn_save_goals:'\uD83D\uDCBE లక్ష్యాలు సేవ్ చేయి',
    goals_monthly_targets:'నెలవారీ లక్ష్యాలు \u2014',
    goals_empty:'పై లక్ష్యాలను నమోదు చేసి "లక్ష్యాలు సేవ్ చేయి" నొక్కండి.',
    // notifications
    btn_refresh_notif:'\uD83D\uDD04 రిఫ్రెష్',
  }
};
function t(key) { return (T[LANG] && T[LANG][key]) || (T['en'] && T['en'][key]) || key; }
function applyLang() {
  document.querySelectorAll('[data-t]').forEach(function(el) {
    var key = el.getAttribute('data-t');
    var val = t(key);
    if (el.getAttribute('data-t-html')) el.innerHTML = val;
    else el.textContent = val;
  });
  // update lang toggle button label
  var btn = document.getElementById('lang-toggle-btn');
  if (btn) btn.textContent = t('btn_lang');
  // always re-render dynamic content so language change takes effect immediately
  var gv = document.getElementById('sec-goals');
  if (gv && gv.classList.contains('active') && typeof renderGoals === 'function') renderGoals();
  // update All Centers option
  var allOpt = document.querySelector('#center-switcher option[value=""]');
  if (allOpt) allOpt.textContent = t('opt_all_centers');
}
function toggleLang() {
  LANG = LANG === 'en' ? 'te' : 'en';
  localStorage.setItem('svLang', LANG);
  applyLang();
}

// ── Global Search ──
function renderGlobalSearch() {
  var q = (document.getElementById('ov-global-search').value || '').trim().toLowerCase();
  var el = document.getElementById('ov-global-results');
  if (!el) return;
  if (!q) { el.style.display = 'none'; return; }

  var results = [];

  // Customers
  (D.customers||[]).forEach(function(c) {
    if ((c.name||'').toLowerCase().includes(q) || (c.contact||'').includes(q) || (c.email||'').toLowerCase().includes(q)) {
      var st = getDaysLeft(c);
      var badge = st.active ? (st.days <= 3 ? '<span class="badge br" style="font-size:10px">'+st.days+'d left</span>' : '<span class="badge bg" style="font-size:10px">Active</span>') : '<span class="badge" style="font-size:10px;background:#f3f4f6;color:#6b7280">Expired</span>';
      results.push({ type: 'customer', id: c.id, name: c.name, sub: (c.pack_type||'No pack') + ' · ' + (c.contact||''), badge: badge });
    }
  });

  // Coaches
  (D.coaches||[]).forEach(function(c) {
    if ((c.name||'').toLowerCase().includes(q) || (c.contact||'').includes(q)) {
      results.push({ type: 'coach', id: c.id, name: c.name, sub: 'Coach · ' + (c.contact||''), badge: '<span style="font-size:12px">🧑‍🏫</span>' });
    }
  });

  // Centers
  (D.centers||[]).forEach(function(c) {
    if ((c.name||'').toLowerCase().includes(q) || (c.location||'').toLowerCase().includes(q)) {
      results.push({ type: 'center', id: c.id, name: c.name, sub: 'Center · ' + (c.location||''), badge: '<span style="font-size:12px">🏢</span>' });
    }
  });

  if (!results.length) {
    el.style.display = 'block';
    el.innerHTML = '<div style="padding:14px 16px;color:var(--muted);font-size:13px">No results for "' + q + '"</div>';
    return;
  }

  el.style.display = 'block';
  el.innerHTML = results.slice(0, 10).map(function(r) {
    var onclick = r.type === 'customer'
      ? "goTo('customers',document.querySelector('[onclick*=customers]'));setTimeout(function(){var s=document.getElementById('customers-search');if(s){s.value='"+r.name.replace(/'/g,"\\'")+"';renderCustomers();}},300);document.getElementById('ov-global-search').value='';document.getElementById('ov-global-results').style.display='none';"
      : r.type === 'coach'
      ? "goTo('coaches',document.querySelector('[onclick*=coaches]'));document.getElementById('ov-global-search').value='';document.getElementById('ov-global-results').style.display='none';"
      : "goTo('centers',document.querySelector('[onclick*=centers]'));document.getElementById('ov-global-search').value='';document.getElementById('ov-global-results').style.display='none';";
    return '<div onclick="'+onclick+'" style="padding:10px 16px;cursor:pointer;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:8px;transition:background .15s" onmouseover="this.style.background=\'var(--surface2)\'" onmouseout="this.style.background=\'\'">'
      + '<div><div style="font-size:13px;font-weight:600;color:var(--text)">'+r.name+'</div><div style="font-size:11px;color:var(--muted);margin-top:1px">'+r.sub+'</div></div>'
      + r.badge
      + '</div>';
  }).join('');
}
// Close search results on outside click
document.addEventListener('click', function(e) {
  var wrap = document.getElementById('ov-global-search');
  var res = document.getElementById('ov-global-results');
  if (res && wrap && !wrap.contains(e.target) && !res.contains(e.target)) res.style.display = 'none';
});

// ── CSV Export ──
function exportCSV(headers, rows, filename) {
  var csv = [headers.join(',')].concat(rows.map(function(r){
    return r.map(function(v){
      var s = (v === null || v === undefined) ? '' : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g,'""') + '"' : s;
    }).join(',');
  })).join('\n');
  var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = filename + '_' + new Date().toISOString().slice(0,10) + '.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}
function exportCustomersCSV() {
  if (isCenterSession() && !isGrowthPlan()) { showToast('CSV Export is a Growth plan feature (₹499/mo).', 'error'); return; }
  var custs = filterByCenter(D.customers);
  exportCSV(
    ['Name','Contact','Email','Pack','Start Date','Days Left','Status','Goal','Coach','Center','Joined'],
    custs.map(function(c){
      var st = getDaysLeft(c);
      return [c.name, c.contact||'', c.email||'', c.pack_type||'', c.start_date||'', st.active?st.days:'Expired', st.active?'Active':'Expired', c.goal||'', c.coach_name||'', getCenterById(c.wellness_center_id)||'', c.join_date||c.created_at||''];
    }),
    'customers'
  );
}
function exportFinanceCSV() {
  if (isCenterSession() && !isGrowthPlan()) { showToast('CSV Export is a Growth plan feature (₹499/mo).', 'error'); return; }
  var fin = filterFinanceByCenter(D.finance);
  exportCSV(
    ['Type','Description','Amount','Category','Date','Center'],
    fin.map(function(f){
      return [f.type||'', f.description||'', f.amount||0, f.category||'', f.date||'', getCenterById(f.wellness_center_id)||''];
    }),
    'finance'
  );
}
function exportAttendanceCSV() {
  var att = filterByCenterViaCustomer(D.attendance);
  exportCSV(
    ['Customer','Date','Status','Notes'],
    att.map(function(a){
      var c = (D.customers||[]).find(function(x){return x.id===a.customer_id;});
      return [c?c.name:a.customer_id, a.date||'', a.status||'', a.notes||''];
    }),
    'attendance'
  );
}
function exportBodyCSV() {
  var body = _selectedBodyCustId
    ? (D.body||[]).filter(function(b){return b.customer_id===_selectedBodyCustId;})
    : (D.body||[]);
  exportCSV(
    ['Customer','Date','Height','Age','Weight','Fat%','Visceral Fat','BMR','BMI','Body Age','Subcu Fat%','Muscle%'],
    body.map(function(b){
      var c = (D.customers||[]).find(function(x){return x.id===b.customer_id;});
      return [c?c.name:b.customer_id, b.date||'', b.height||'', b.age||'', b.weight||'', b.fat_percentage||'', b.visceral_fat||'', b.bmr||'', b.bmi||'', b.body_age||'', b.subcutaneous_fat_percentage||'', b.muscle_percentage||''];
    }),
    'body_composition'
  );
}
function getCenterById(id) {
  if (!id) return '';
  var c = (D.centers||[]).find(function(x){return x.id===id;}); return c?c.name:'';
}
function isGrowthPlan() {
  if (!isCenterSession() && !ACTIVE_CENTER) return true; // supervisor always has full access
  var targetId = ACTIVE_CENTER || (_centerAuth && _centerAuth.centerId);
  var c = (D.centers||[]).find(function(x){return x.id===targetId;});
  var plan = c ? (c.plan_type||'free') : 'free';
  return plan==='growth'||plan==='elite'||plan==='president';
}
function isElitePlan() {
  if (!isCenterSession() && !ACTIVE_CENTER) return true; // supervisor always has full access
  var targetId = ACTIVE_CENTER || (_centerAuth && _centerAuth.centerId);
  var c = (D.centers||[]).find(function(x){return x.id===targetId;});
  var plan = c ? (c.plan_type||'free') : 'free';
  return plan==='elite'||plan==='president';
}
function planLockHtml(feature, desc) {
  return '<div style="text-align:center;padding:48px 24px">'
    +'<div style="font-size:40px;margin-bottom:12px">🔒</div>'
    +'<div style="font-size:18px;font-weight:700;color:#7c3aed;margin-bottom:8px">'+feature+' — Growth Plan</div>'
    +'<div style="font-size:13px;color:#6b7280;margin-bottom:20px;max-width:340px;margin-left:auto;margin-right:auto">'+desc+'</div>'
    +'<div style="font-size:22px;font-weight:800;color:#7c3aed;margin-bottom:4px">₹499<span style="font-size:13px;font-weight:400">/month</span></div>'
    +'<div style="font-size:11px;color:var(--muted);margin-bottom:16px">Growth Plan</div>'
    +'<a href="https://wa.me/917981614593?text='+encodeURIComponent('Hi! I would like to upgrade to the Growth plan (₹499/month) to unlock '+feature+'. Please help me proceed. 🙏')+'" target="_blank" class="btn-p" style="display:inline-block;text-decoration:none;padding:10px 24px;background:#7c3aed;border-color:#7c3aed">💬 Request Upgrade via WhatsApp</a>'
    +'</div>';
}
function planLockHtmlElite(feature, desc) {
  return '<div style="text-align:center;padding:48px 24px">'
    +'<div style="font-size:40px;margin-bottom:12px">🔒</div>'
    +'<div style="font-size:18px;font-weight:700;color:#b45309;margin-bottom:8px">'+feature+' — Elite Plan</div>'
    +'<div style="font-size:13px;color:#6b7280;margin-bottom:20px;max-width:340px;margin-left:auto;margin-right:auto">'+desc+'</div>'
    +'<div style="font-size:22px;font-weight:800;color:#b45309;margin-bottom:4px">₹999<span style="font-size:13px;font-weight:400">/month</span></div>'
    +'<div style="font-size:11px;color:var(--muted);margin-bottom:16px">Elite Plan</div>'
    +'<a href="https://wa.me/917981614593?text='+encodeURIComponent('Hi! I would like to upgrade to the Elite plan (₹999/month) to unlock '+feature+'. Please help me proceed. 🙏')+'" target="_blank" class="btn-p" style="display:inline-block;text-decoration:none;padding:10px 24px;background:#b45309;border-color:#b45309">💬 Request Upgrade via WhatsApp</a>'
    +'</div>';
}

// ── Data Export Pack ──
function _expDateRange() {
  return {
    from: document.getElementById('exp-from') ? document.getElementById('exp-from').value : '',
    to:   document.getElementById('exp-to')   ? document.getElementById('exp-to').value   : ''
  };
}
function _inExpRange(dateStr) {
  var r = _expDateRange();
  if (!dateStr) return true;
  if (r.from && dateStr < r.from) return false;
  if (r.to   && dateStr > r.to)   return false;
  return true;
}
function exportDataPack(type) {
  if (type === 'customers') {
    var custs = filterByCenter(D.customers).filter(function(c){ return _inExpRange(c.pack_start_date || c.join_date || c.created_at); });
    exportCSV(
      ['Name','Contact','Email','Pack','Pack Start','Days Left','Status','Goal','Coach','Center','Joined'],
      custs.map(function(c){
        var st = getDaysLeft(c);
        return [c.name, c.contact||'', c.email||'', c.pack_type||'', c.pack_start_date||'', st.active?st.days:'Expired', st.active?'Active':'Expired', c.goal||'', c.coach_name||'', getCenterById(c.wellness_center_id)||'', c.join_date||c.created_at||''];
      }),
      'customers'
    );
  } else if (type === 'attendance') {
    var att = filterByCenterViaCustomer(D.attendance).filter(function(a){ return _inExpRange(a.date); });
    exportCSV(
      ['Customer','Date','Status','Servings','Check-in Time','Notes'],
      att.map(function(a){
        var cu = (D.customers||[]).find(function(x){return x.id===a.customer_id;});
        return [cu?cu.name:(a.customer_name||''), a.date||'', a.status||'', a.servings||1, a.check_in_time||'', a.notes||''];
      }),
      'attendance'
    );
  } else if (type === 'finance') {
    var fin = filterFinanceByCenter(D.finance).filter(function(f){ return _inExpRange(f.date); });
    exportCSV(
      ['Type','Description','Amount','Category','Date','Center'],
      fin.map(function(f){
        return [f.type||'', f.description||'', f.amount||0, f.category||'', f.date||'', getCenterById(f.wellness_center_id)||''];
      }),
      'finance'
    );
  } else if (type === 'body') {
    var body = filterByCenterViaCustomer(D.body||[]).filter(function(b){ return _inExpRange(b.date); });
    exportCSV(
      ['Customer','Date','Height','Age','Weight','Fat%','Visceral Fat','BMR','BMI','Body Age','Subcu Fat%','Muscle%'],
      body.map(function(b){
        var cu = (D.customers||[]).find(function(x){return x.id===b.customer_id;});
        return [cu?cu.name:b.customer_id, b.date||'', b.height||'', b.age||'', b.weight||'', b.fat_percentage||'', b.visceral_fat||'', b.bmr||'', b.bmi||'', b.body_age||'', b.subcutaneous_fat_percentage||'', b.muscle_percentage||''];
      }),
      'body_composition'
    );
  }
}
async function exportAllData() {
  var types = ['customers','attendance','finance','body'];
  for (var i = 0; i < types.length; i++) {
    exportDataPack(types[i]);
    if (i < types.length - 1) await new Promise(function(r){ setTimeout(r, 600); });
  }
  showToast('All 4 CSVs downloaded!', 'success');
}

function toggleDarkMode() {
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  var next = isDark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('svTheme', next);
  document.getElementById('dark-mode-btn').textContent = next === 'dark' ? '☀️' : '🌙';
}
(function applyTheme() {
  var t = localStorage.getItem('svTheme') || 'light';
  document.documentElement.setAttribute('data-theme', t);
  var btn = document.getElementById('dark-mode-btn');
  if (btn) btn.textContent = t === 'dark' ? '☀️' : '🌙';
})();

// PINs loaded from Supabase — single source of truth, works across all devices
var _DB_PINS = {};           // { centerId: pin } — built from wellness_centers.pin
var _DB_SUPERVISOR_PIN = ''; // from app_settings key='supervisor_pin'

var _centerAuth = JSON.parse(sessionStorage.getItem('centerAuth') || '{}');
var _pendingSwitchCenter = '';

// Returns array of centerId + all recursive downline center IDs via upline_center_id
function getOrgCenterIds(rootId) {
  var ids = [rootId];
  if (isCenterSession() && !isElitePlan()) {
    return ids;
  }
  var i = 0;
  while (i < ids.length) {
    var parent = ids[i];
    D.centers.forEach(function(c) {
      if (c.upline_center_id === parent && ids.indexOf(c.id) === -1) ids.push(c.id);
    });
    i++;
  }
  return ids;
}

function switchActiveCenter(centerId) {
  var hasPins = _DB_SUPERVISOR_PIN || Object.keys(_DB_PINS).length > 0;

  if(!hasPins) {
    // No PINs set anywhere — free access (first-time setup)
    _applySwitch(centerId);
    return;
  }

  // Already authenticated as master — can go anywhere
  if(_centerAuth.type === 'master') {
    _applySwitch(centerId);
    return;
  }

  // Center-PIN user: allow switching to own center or any downline center without re-entering PIN
  if(centerId && _centerAuth.type === 'center') {
    var orgIds = getOrgCenterIds(_centerAuth.centerId);
    if(orgIds.indexOf(centerId) !== -1) {
      _applySwitch(centerId);
      return;
    }
  }

  // Need PIN verification
  _pendingSwitchCenter = centerId;
  var centerName = centerId ? (D.centers.find(function(c){return c.id===centerId;})||{}).name||'this center' : 'All Centers';
  document.getElementById('pin-prompt-title').textContent = '🔐 Switch to ' + centerName;
  document.getElementById('pin-prompt-msg').textContent = centerId
    ? 'Enter the PIN for '+centerName+' or your supervisor master PIN.'
    : 'Enter your supervisor master PIN to view all centers.';
  document.getElementById('pin-prompt-input').value = '';
  document.getElementById('pin-prompt-error').style.display = 'none';
  openModal('pin-prompt');
  setTimeout(function(){ document.getElementById('pin-prompt-input').focus(); }, 200);
}

function verifyPinPrompt() {
  var entered = (document.getElementById('pin-prompt-input').value||'').trim();
  if(!entered) return;
  var targetCenter = _pendingSwitchCenter;

  // Check supervisor PIN — DB first, localStorage fallback
  var supervisorPin = _DB_SUPERVISOR_PIN || (JSON.parse(localStorage.getItem('ownerProfile') || '{}')).master_pin || '';
  if(supervisorPin && entered === supervisorPin) {
    _centerAuth = { type: 'master' };
    sessionStorage.setItem('centerAuth', JSON.stringify(_centerAuth));
    closeModal('pin-prompt');
    _applySwitch(targetCenter);
    showToast('Supervisor access granted');
    updateCenterSwitcher();
    return;
  }

  // Check center-specific PIN — use DB pins (works on all devices)
  var matchedCenter = null;
  if(targetCenter && _DB_PINS[targetCenter] && entered === _DB_PINS[targetCenter]) {
    matchedCenter = targetCenter;
  } else if(!targetCenter) {
    for(var cid in _DB_PINS) { if(_DB_PINS[cid] && entered === _DB_PINS[cid]) { matchedCenter = cid; break; } }
  }
  if(matchedCenter) {
    _centerAuth = { type: 'center', centerId: matchedCenter };
    sessionStorage.setItem('centerAuth', JSON.stringify(_centerAuth));
    closeModal('pin-prompt');
    _applySwitch(matchedCenter);
    updateCenterSwitcher();
    return;
  }

  // Wrong PIN
  document.getElementById('pin-prompt-error').style.display = 'block';
  document.getElementById('pin-prompt-input').value = '';
  document.getElementById('pin-prompt-input').focus();
}

function _applySwitch(centerId) {
  ACTIVE_CENTER = centerId;
  localStorage.setItem('activeCenter', centerId);
  _daysLeftCache = {};
  updateSidebarLogo();
  var sel = document.getElementById('center-switcher');
  if(sel) sel.value = centerId;
  // Show loading splash during center switch
  var _ld = document.getElementById('app-loading');
  var _ldMsg = document.getElementById('app-loading-msg');
  if(_ld) { _ld.style.display='flex'; }
  if(_ldMsg) _ldMsg.textContent = 'Loading center data…';
  // Reload data scoped to new center (2-phase, same as loadAll)
  Promise.all([loadCustomers(), loadCoaches()])
    .then(function(){
      if(_ldMsg) _ldMsg.textContent = 'Almost ready…';
      return Promise.all([loadAttendance(), loadFinance(),
        loadCoupons(), loadPayments(), loadPackHistory(),
        loadLeads(), loadWalkins(), loadExpenses(), loadInventory()])
        .then(function(){ return loadBody(); });
    })
    .then(function(){
      _daysLeftCache = {};
      try { renderCustomers(); } catch(e){ console.error('renderCustomers:', e); }
      try { renderCenters(); } catch(e){ console.error('renderCenters:', e); }
      try { renderOverview(); } catch(e){
        console.error('renderOverview:', e);
        var og = document.getElementById('ov-main-grid');
        if(og) og.innerHTML = '<div style="padding:32px;text-align:center;color:var(--danger)"><strong>Dashboard error:</strong><br><span style="font-size:12px;font-family:monospace">'+(e&&e.message?e.message:String(e))+'</span><br><br><button onclick="location.reload()" class="btn-p">🔄 Reload</button></div>';
      }
      if(typeof renderCurrentStock==='function') try { renderCurrentStock(); } catch(e){}
      if(typeof renderCoupons==='function') try { renderCoupons(); } catch(e){}
      if(typeof renderPayments==='function') try { renderPayments(); } catch(e){}
      updateCustSelects();
      if(_ld) _ld.style.display='none';
      showToast(centerId ? 'Switched to center' : 'Ready');
    })
    .catch(function(e){
      console.error('_applySwitch failed:', e);
      if(_ld) _ld.style.display='none';
      var og = document.getElementById('ov-main-grid');
      if(og) og.innerHTML = '<div style="padding:32px;text-align:center;color:var(--danger)"><strong>Failed to load center data:</strong><br><span style="font-size:12px;font-family:monospace">'+(e&&e.message?e.message:String(e))+'</span><br><br><button onclick="location.reload()" class="btn-p">🔄 Reload</button></div>';
    });
}

function updateCenterSwitcher() {
  var sel = document.getElementById('center-switcher'); if(!sel) return;
  var prev = sel.value || ACTIVE_CENTER;
  var isMaster = _centerAuth.type === 'master';
  var noPins = !_DB_SUPERVISOR_PIN && Object.keys(_DB_PINS).length === 0;
  // Build options: non-master users only see their authenticated center
  var opts = '';
  var orgIds = (_centerAuth.type === 'center') ? getOrgCenterIds(_centerAuth.centerId) : null;
  if(isMaster || noPins) {
    opts = '<option value="">All Centers</option>';
  }
  D.centers.forEach(function(c){
    if(isMaster || noPins || (orgIds && orgIds.indexOf(c.id) !== -1)) {
      opts += '<option value="'+c.id+'"'+(c.id===prev?' selected':'')+'>'+c.name+'</option>';
    }
  });
  sel.innerHTML = opts;
  if(prev && !D.centers.some(function(c){return c.id===prev;})) { ACTIVE_CENTER=''; localStorage.removeItem('activeCenter'); }
  // Hide supervisor-only nav items for center-PIN users, with plan overrides
  var isSuper = isSupervisor();
  var isElite = isElitePlan();
  var isGrowth = isGrowthPlan();
  document.querySelectorAll('.nav-supervisor-only').forEach(function(el){
    var onclickAttr = el.getAttribute('onclick') || '';
    if (onclickAttr.indexOf('planmgmt') !== -1 || onclickAttr.indexOf('pintracker') !== -1 || onclickAttr.indexOf('centers') !== -1 || onclickAttr.indexOf('sql') !== -1 || onclickAttr.indexOf('profile') !== -1) {
      el.style.display = isSuper ? '' : 'none';
    } else if (onclickAttr.indexOf('orgtree') !== -1 || onclickAttr.indexOf('bizanalyst') !== -1) {
      el.style.display = (isSuper || isElite) ? '' : 'none';
    } else if (onclickAttr.indexOf('export') !== -1) {
      el.style.display = (isSuper || isGrowth) ? '' : 'none';
    } else {
      el.style.display = isSuper ? '' : 'none';
    }
  });
}

// Helper: filter array by wellness_center_id matching ACTIVE_CENTER
function filterByCenter(arr) {
  if(!ACTIVE_CENTER) return arr;
  return arr.filter(function(item){ return item.wellness_center_id === ACTIVE_CENTER; });
}

// Helper: filter attendance/body by customer's center
function filterByCenterViaCustomer(arr) {
  if(!ACTIVE_CENTER) return arr;
  var custIds = {};
  D.customers.forEach(function(c){ if(c.wellness_center_id===ACTIVE_CENTER) custIds[c.id]=true; });
  return arr.filter(function(item){ return custIds[item.customer_id]; });
}

// Helper: filter finance by wellness_center_id (requires finance to have the column)
// Only show records explicitly assigned to the active center; null records visible to supervisor only
function filterFinanceByCenter(arr) {
  if(!ACTIVE_CENTER) return arr;
  return arr.filter(function(f){ return f.wellness_center_id === ACTIVE_CENTER; });
}

// Helper: get the active center's display name
function getCenterName() {
  if (ACTIVE_CENTER && D && D.centers) {
    var ac = D.centers.find(function(x){ return x.id === ACTIVE_CENTER; });
    if (ac && ac.name) return ac.name;
  }
  // Master/supervisor mode — no center lock
  if (_centerAuth && _centerAuth.type === 'master') return 'PulseZen Network';
  var op = (typeof OWNER_PROFILE !== 'undefined') ? OWNER_PROFILE : JSON.parse(localStorage.getItem('ownerProfile') || '{}');
  if (op && op.center_name) return op.center_name;
  if (D && D.centers && D.centers.length) return D.centers[0].name;
  return 'Our Wellness Center';
}
var OWNER_PROFILE = JSON.parse(localStorage.getItem('ownerProfile') || '{}');

function checkStartupAuth() {
  var hasCenterPins = Object.keys(_DB_PINS).length > 0;

  // No PINs configured in DB at all — full supervisor access
  if(!hasCenterPins && !_DB_SUPERVISOR_PIN) {
    _centerAuth = { type: 'master' };
    sessionStorage.setItem('centerAuth', JSON.stringify(_centerAuth));
    updateCenterSwitcher();
    return;
  }

  // Valid session already exists — restore it
  if(_centerAuth.type === 'master') {
    updateCenterSwitcher();
    return;
  }
  if(_centerAuth.type === 'center' && _centerAuth.centerId && _DB_PINS[_centerAuth.centerId]) {
    ACTIVE_CENTER = _centerAuth.centerId;
    localStorage.setItem('activeCenter', _centerAuth.centerId);
    // Don't reload data — just re-render with center filter (data already loaded)
    try { renderOverview(); } catch(e){}
    try { renderCustomers(); } catch(e){}
    updateCenterSwitcher();
    return;
  }

  // Other center PINs exist — prompt for PIN
  _pendingSwitchCenter = '';
  document.getElementById('pin-prompt-title').textContent = '🔐 Welcome — Enter PIN';
  document.getElementById('pin-prompt-msg').textContent = 'Enter your center PIN or supervisor master PIN to get started.';
  document.getElementById('pin-prompt-input').value = '';
  document.getElementById('pin-prompt-error').style.display = 'none';
  openModal('pin-prompt');
  setTimeout(function(){ document.getElementById('pin-prompt-input').focus(); }, 200);
}

function _matchPinToCenter(entered) {
  for(var cid in _DB_PINS) { if(_DB_PINS[cid] === entered) return cid; }
  return null;
}

// Single unified PIN verify — supervisor PIN always checked first
verifyPinPrompt = function() {
  var entered = (document.getElementById('pin-prompt-input').value||'').trim();
  if(!entered) return;
  var targetCenter = _pendingSwitchCenter;

  // 1. Supervisor PIN — grants full access
  if(_DB_SUPERVISOR_PIN && entered === _DB_SUPERVISOR_PIN) {
    _centerAuth = { type: 'master' };
    sessionStorage.setItem('centerAuth', JSON.stringify(_centerAuth));
    closeModal('pin-prompt');
    _applySwitch(targetCenter || '');
    showToast('Supervisor access granted');
    updateCenterSwitcher();
    return;
  }

  // 2. Check center-specific PIN
  if(targetCenter && _DB_PINS[targetCenter] && entered === _DB_PINS[targetCenter]) {
    _centerAuth = { type: 'center', centerId: targetCenter };
    sessionStorage.setItem('centerAuth', JSON.stringify(_centerAuth));
    closeModal('pin-prompt');
    _applySwitch(targetCenter);
    updateCenterSwitcher();
    return;
  }

  // 3. No specific center targeted — try matching PIN to any center
  if(!targetCenter) {
    var matched = _matchPinToCenter(entered);
    if(matched) {
      _centerAuth = { type: 'center', centerId: matched };
      sessionStorage.setItem('centerAuth', JSON.stringify(_centerAuth));
      closeModal('pin-prompt');
      _applySwitch(matched);
      updateCenterSwitcher();
      return;
    }
  }

  // Wrong PIN
  document.getElementById('pin-prompt-error').style.display = 'block';
  document.getElementById('pin-prompt-input').value = '';
  document.getElementById('pin-prompt-input').focus();
};

// ── HERBALIFE PIN LEVELS ──
var HERBALIFE_PINS = ['Preferred Customer','Associate','Qualified Producer (QP)','Success Builder','Supervisor','World Team','Active World Team','GET Team','2500 GET Team','Millionaire Team','7500 Millionaire Team',"President's Team"];
var PIN_NEXT = {'Preferred Customer':'Associate','Associate':'Qualified Producer (QP)','Qualified Producer (QP)':'Success Builder','Success Builder':'Supervisor','Supervisor':'World Team','World Team':'Active World Team','Active World Team':'GET Team','GET Team':'2500 GET Team','2500 GET Team':'Millionaire Team','Millionaire Team':'7500 Millionaire Team','7500 Millionaire Team':"President's Team","President's Team":null};
var PIN_TIPS = {'Preferred Customer':'Become an Associate to start building your business and earning commissions.','Associate':'Reach Qualified Producer by accumulating volume points with your customers.','Qualified Producer (QP)':'Reach Success Builder by maintaining consistent volume and building your customer base.','Success Builder':'Reach Supervisor by accumulating 4000VP over qualifying months with a strong team.','Supervisor':'Build consistent volume and mentor 2+ active downline supervisors for World Team.','World Team':'Maintain qualifying volume across 2+ months to become Active World Team.','Active World Team':'Build 3+ active supervisors in your downline to reach GET Team.','GET Team':'Grow your organisation to 2500VP qualifying volume to reach 2500 GET Team.','2500 GET Team':'Scale up your team volume and supervisors to reach Millionaire Team.','Millionaire Team':'Maintain high-volume organisation and build 7500VP qualifying volume.','7500 Millionaire Team':"Sustain elite organisation volume and team depth to reach President's Team.","President's Team":"Top recognition — continue growing your organisation! 🏆"};

// ── VP & PIN QUALIFICATION ──
var VP_PER_PACK = {
  'Star UMS 90 days': 168,
  'Premium 30 days': 56,
  'Standard 26 days': 48,
  'Hot Drink 30 days': 7.8,
  'Trial 3 days': 5.6
};

var PIN_REQUIREMENTS = {
  'Supervisor':           { personalVP:4000, orgVP:0, firstLine:[], firstLineCount:0, associates:0 },
  'World Team':           { personalVP:2500, orgVP:10000, firstLine:['Supervisor'], firstLineCount:2, associates:0 },
  'Active World Team':    { personalVP:2500, orgVP:10000, firstLine:['Supervisor'], firstLineCount:2, associates:0 },
  'GET Team':             { personalVP:2500, orgVP:25000, firstLine:['Supervisor'], firstLineCount:3, associates:0 },
  '2500 GET Team':        { personalVP:2500, orgVP:47500, firstLine:['GET Team'], firstLineCount:3, associates:0 },
  'Millionaire Team':     { personalVP:2500, orgVP:77500, firstLine:['GET Team'], firstLineCount:3, associates:8 },
  '7500 Millionaire Team':{ personalVP:2500, orgVP:100000, firstLine:['GET Team'], firstLineCount:3, associates:8 },
  "President's Team":     { personalVP:2500, orgVP:150000, firstLine:['Millionaire Team'], firstLineCount:3, associates:10 }
};

function getVPForPack(packType) {
  if(!packType) return 0;
  for(var key in VP_PER_PACK) { if(packType.includes(key) || key.includes(packType)) return VP_PER_PACK[key]; }
  // Fuzzy match
  var t = packType.toLowerCase();
  if(t.includes('star') || t.includes('ums')) return 168;
  if(t.includes('premium') && t.includes('30')) return 56;
  if(t.includes('standard') && t.includes('26')) return 48;
  if(t.includes('hot') || t.includes('drink')) return 7.8;
  if(t.includes('trial') || t.includes('3')) return 5.6;
  return 0;
}

function calcMonthlyVP(month, centerId) {
  // month = 'YYYY-MM', centerId = specific center or null for all
  var vp = 0;
  // From current customers whose pack started this month
  D.customers.forEach(function(c) {
    if(centerId && c.wellness_center_id !== centerId) return;
    if(c.pack_owner_id) return; // linked members don't generate separate VP
    if(c.pack_start_date && c.pack_start_date.substring(0,7) === month) {
      vp += getVPForPack(c.pack_type);
    }
  });
  // From pack_history (renewals)
  (D.packHistory||[]).forEach(function(h) {
    if(centerId) {
      var cust = D.customers.find(function(x){return x.id===h.customer_id;});
      if(!cust || cust.wellness_center_id !== centerId) return;
    }
    if(h.start_date && h.start_date.substring(0,7) === month) {
      vp += getVPForPack(h.pack_type);
    }
  });
  // From coaches with packs
  D.coaches.forEach(function(c) {
    if(centerId && c.wellness_center_id !== centerId) return;
    if(c.pack_start_date && c.pack_start_date.substring(0,7) === month) {
      vp += getVPForPack(c.pack_type);
    }
  });
  return Math.round(vp * 10) / 10;
}

function getOrgVP(month) {
  // Organizational VP = all centers except personal (main center)
  var mainCenter = D.centers.find(function(c){return c.type==='main';});
  var orgVP = 0;
  D.centers.forEach(function(c) {
    if(mainCenter && c.id === mainCenter.id) return; // skip personal center
    orgVP += calcMonthlyVP(month, c.id);
  });
  // Also count customers/coaches not assigned to any center
  return orgVP;
}

function getPersonalVP(month) {
  var mainCenter = D.centers.find(function(c){return c.type==='main';});
  if(!mainCenter) return calcMonthlyVP(month, null); // no centers? count all
  return calcMonthlyVP(month, mainCenter.id);
}

function getFirstLineStatus() {
  // First-line coaches and their pin levels
  var mainCenter = D.centers.find(function(c){return c.type==='main';});
  return D.coaches.filter(function(c) {
    // First-line = coaches with upline matching owner or directly in the system
    return c.status === 'Active' || !c.status;
  }).map(function(c) {
    var centerOwned = D.centers.find(function(ct){return ct.owner_id===c.id;});
    var centerVP = centerOwned ? calcMonthlyVP(new Date().toISOString().substring(0,7), centerOwned.id) : 0;
    return {
      id: c.id,
      name: c.name,
      pin: c.herbalife_pin || 'Associate',
      center: centerOwned ? centerOwned.name : null,
      centerId: centerOwned ? centerOwned.id : null,
      vp: centerVP,
      active: (c.status||'Active') === 'Active'
    };
  });
}

// ── FINANCE CATEGORIES ──
var FIN_CATS = {
  income: ['Pack sale to customer','Product sale to customer','Company cheque / royalty','Coach pack payment','Other income'],
  expense: ['Products Purchase','Rent','Utilities','Equipment','Marketing','Staff','Refund','Other expense']
};
function onFinTypeChange() {
  var type = document.getElementById('fin-type').value;
  var sel = document.getElementById('fin-cat');
  if (!sel) return;
  sel.innerHTML = (FIN_CATS[type]||FIN_CATS.income).map(function(c){return '<option>'+c+'</option>';}).join('');
}
function openFinanceModal() {
  document.getElementById('fin-id').value='';
  document.getElementById('fin-type').value='income';
  onFinTypeChange();
  document.getElementById('fin-desc').value='';
  document.getElementById('fin-amount').value='';
  document.getElementById('fin-date').value=new Date().toISOString().split('T')[0];
  openModal('finance');
}

// ── OWNER PROFILE ──
function saveOwnerProfile() {
  var p = {
    name: document.getElementById('prof-name').value.trim(),
    gender: document.getElementById('prof-gender').value,
    contact: document.getElementById('prof-contact').value.trim(),
    distributor_id: document.getElementById('prof-hlid').value.trim(),
    center_name: document.getElementById('prof-center-name').value.trim(),
    center_location: document.getElementById('prof-center-location').value.trim(),
    current_pin: document.getElementById('prof-current-pin').value,
    next_pin: document.getElementById('prof-next-pin').value,
    coach_id: document.getElementById('prof-coach-id').value || null,
    photo: OWNER_PROFILE.photo || null,
    master_pin: (document.getElementById('prof-master-pin').value||'').trim() || OWNER_PROFILE.master_pin || null
  };
  var mpVal = (document.getElementById('prof-master-pin').value||'').trim();
  if(mpVal && !/^\d{4}$/.test(mpVal)) { showToast('PIN must be exactly 4 digits','error'); return; }
  if (!p.name) { showToast('Name is required', 'error'); return; }
  OWNER_PROFILE = p;
  localStorage.setItem('ownerProfile', JSON.stringify(p));

  // Route PIN to the right place based on who is saving
  var isCenterUser = _centerAuth.type === 'center' && _centerAuth.centerId;
  if (isCenterUser) {
    // Center owner — save PIN to wellness_centers.center_pin for their own center
    if (mpVal) saveCenterPinToDB(_centerAuth.centerId, mpVal);
  } else {
    // Supervisor — save to app_settings as master PIN and grant master access
    if(p.master_pin) {
      _centerAuth = { type: 'master' };
      sessionStorage.setItem('centerAuth', JSON.stringify(_centerAuth));
      updateCenterSwitcher();
    }
    saveSupervisorPinToDB(p.master_pin || '');
  }

  updateCoachSelects();
  renderProfileCard();
  showToast('Profile saved!', 'success');
}

async function saveCenterPinToDB(centerId, pinValue) {
  try {
    getCredentials();
    if (!getActiveSbUrl() || !getActiveSbKey()) return;
    await dbUpdate('wellness_centers', centerId, { center_pin: pinValue });
    _DB_PINS[centerId] = pinValue;
    // Update _centerAuth so new PIN is recognised in this session
    _centerAuth.pin = pinValue;
    sessionStorage.setItem('centerAuth', JSON.stringify(_centerAuth));
  } catch(e) { console.warn('Could not save center PIN to DB:', e); }
}

async function saveSupervisorPinToDB(pinValue) {
  try {
    getCredentials();
    if (!getActiveSbUrl() || !getActiveSbKey()) return;
    // Check if row exists
    var existing = await dbGet('app_settings', 'key', 'key=eq.supervisor_pin');
    if (existing && existing.length) {
      await req('PATCH', 'app_settings', { value: pinValue }, '?key=eq.supervisor_pin');
    } else {
      await req('POST', 'app_settings', { key: 'supervisor_pin', value: pinValue });
    }
    _DB_SUPERVISOR_PIN = pinValue;
  } catch(e) { console.warn('Could not save supervisor PIN to DB:', e); }
}
function loadProfilePhoto(event) {
  var file = event.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    OWNER_PROFILE.photo = e.target.result;
    localStorage.setItem('ownerProfile', JSON.stringify(OWNER_PROFILE));
    var img = document.getElementById('prof-photo-preview');
    img.src = e.target.result; img.style.display = 'block';
    var cardPhoto = document.getElementById('prof-card-photo');
    if (cardPhoto) { cardPhoto.innerHTML = '<img src="'+e.target.result+'" style="width:100%;height:100%;object-fit:cover">'; }
    showToast('Photo saved locally!', 'success');
  };
  reader.readAsDataURL(file);
}
function updateProfilePinGoal() {
  var cur = document.getElementById('prof-current-pin').value;
  var next = PIN_NEXT[cur];
  var nextSel = document.getElementById('prof-next-pin');
  // Only auto-fill if next goal is empty or is at/behind the current pin
  if (next && nextSel) {
    var curIdx  = HERBALIFE_PINS.indexOf(cur);
    var goalIdx = HERBALIFE_PINS.indexOf(nextSel.value);
    if (!nextSel.value || goalIdx <= curIdx) nextSel.value = next;
  }
  var tipDiv = document.getElementById('prof-pin-tip');
  if (tipDiv && cur && PIN_TIPS[cur]) {
    tipDiv.style.display='block';
    tipDiv.innerHTML = '<strong>Current: '+cur+'</strong><br>'+PIN_TIPS[cur]+(next?'<br><br>🎯 <strong>Next milestone:</strong> '+next:'');
  } else if (tipDiv) { tipDiv.style.display='none'; }
}
function renderProfileCard() {
  var p = OWNER_PROFILE;
  if (!p.name) return;
  var card = document.getElementById('prof-card');
  if (card) { card.style.display='flex'; card.style.alignItems='center'; card.style.gap='20px'; }
  var el = function(id){return document.getElementById(id);};
  if(el('prof-display-name')) el('prof-display-name').textContent = p.name;
  if(el('prof-display-hlid')) el('prof-display-hlid').textContent = p.distributor_id ? 'ID: '+p.distributor_id : (p.center_name||'');
  if(el('prof-pin-badge')) el('prof-pin-badge').textContent = p.current_pin || '';
  if(el('prof-next-pin-badge')) el('prof-next-pin-badge').textContent = p.next_pin ? 'Goal: '+p.next_pin : '';
  if(el('prof-card-photo') && p.photo) el('prof-card-photo').innerHTML='<img src="'+p.photo+'" style="width:100%;height:100%;object-fit:cover">';
  // fill form
  if(el('prof-name')) el('prof-name').value = p.name||'';
  if(el('prof-gender')) el('prof-gender').value = p.gender||'male';
  if(el('prof-contact')) el('prof-contact').value = p.contact||'';
  if(el('prof-hlid')) el('prof-hlid').value = p.distributor_id||'';
  if(el('prof-center-name')) el('prof-center-name').value = p.center_name||'';
  if(el('prof-center-location')) el('prof-center-location').value = p.center_location||'';
  if(el('prof-master-pin')) el('prof-master-pin').value = p.master_pin||'';
  if(el('prof-current-pin')) el('prof-current-pin').value = p.current_pin||'';
  if(el('prof-next-pin')) el('prof-next-pin').value = p.next_pin||'';
  if(el('prof-photo-preview') && p.photo) { el('prof-photo-preview').src=p.photo; el('prof-photo-preview').style.display='block'; }
}
function updateProfileCoachSelect() {
  var sel = document.getElementById('prof-coach-id');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Not linked —</option>' + D.coaches.map(function(c){return '<option value="'+c.id+'">'+c.name+'</option>';}).join('');
  if (OWNER_PROFILE.coach_id) sel.value = OWNER_PROFILE.coach_id;
}
function showCoachPinTip() {
  var pin = document.getElementById('coach-pin').value;
  var tipBox = document.getElementById('coach-pin-tip-box');
  var tipText = document.getElementById('coach-pin-tip-text');
  if (!pin || !tipBox || !tipText) { if(tipBox) tipBox.style.display='none'; return; }
  var next = PIN_NEXT[pin];
  var tip = PIN_TIPS[pin]||'';
  tipText.innerHTML = tip + (next ? '<br><strong>Next: '+next+'</strong>' : ' 🏆 Top tier!');
  tipBox.style.display = 'block';
}

// Always get fresh credentials - fallback to localStorage if variables are null
function getCredentials() {
  if (!SB_URL) SB_URL = (localStorage.getItem('sb_url') || '').replace(/\/$/, '');
  if (!SB_KEY) SB_KEY = localStorage.getItem('sb_key') || '';
  return true; // always proceed — CENTER_SB is the fallback when no main credentials
}
var D = { centers:[], customers:[], attendance:[], body:[], finance:[], coaches:[], inventory:[], leads:[], leadFollowups:[], expenses:[], contests:[], contestParticipants:[] };
var _leadTab = 'today';

// ── SUPABASE REST ──
async function req(method, table, body, filter) {
  getCredentials();
  filter = filter || '';
  var activeUrl = getActiveSbUrl();
  var activeKey = getActiveSbKey();
  var anonKey = SB_KEY || CENTER_SB_KEY;
  var url = activeUrl + '/rest/v1/' + table + filter;
  var headers = {
    'apikey': anonKey,
    'Authorization': 'Bearer ' + activeKey,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
  var opts = { method: method, headers: headers };
  if (body) opts.body = JSON.stringify(body);
  var res = await fetch(url, opts);
  if (res.status === 204) return [];
  var data = await res.json();
  if (!res.ok) throw new Error(data.message || 'HTTP ' + res.status);
  return data;
}
async function dbGet(table, order, extraFilter) {
  order = order || 'created_at';
  var qs = '?order=' + order + '.desc' + (extraFilter ? '&' + extraFilter : '');
  try { var r = await req('GET', table, null, qs); return Array.isArray(r) ? r : []; }
  catch(e) { console.error(table, e); return []; }
}
async function dbInsert(table, data) { return req('POST', table, data); }
async function dbUpdate(table, id, data) { return req('PATCH', table, data, '?id=eq.' + id); }
async function dbDelete(table, id) { return req('DELETE', table, null, '?id=eq.' + id); }

// ── Center-scoped query helpers ──
// Builds a PostgREST filter for a center field, including null (legacy) records
function _cFilter(field) {
  if (!ACTIVE_CENTER) return '';
  field = field || 'wellness_center_id';
  return 'or=(' + field + '.is.null,' + field + '.eq.' + ACTIVE_CENTER + ')';
}
// Builds a PostgREST filter for customer_id IN (active center's customers)
function _custIdsFilter() {
  if (!ACTIVE_CENTER) return '';
  var ids = D.customers.map(function(c){ return c.id; });
  var svId = (JSON.parse(localStorage.getItem('ownerProfile')||'{}')).sv_body_id;
  if (svId) ids.push(svId);
  D.coaches.forEach(function(c){ if(c.id) ids.push(c.id); });
  (D.walkins||[]).forEach(function(w){ if(w.id) ids.push(w.id); });
  if (!ids.length) return '';
  return 'customer_id=in.(' + ids.join(',') + ')';
}

// ── CONNECT ──
async function doConnect() {
  var url = document.getElementById('sb-url').value.trim();
  var key = document.getElementById('sb-key').value.trim();
  var errEl = document.getElementById('setup-err');
  errEl.style.display = 'none';
  if (!url || !key) { showErr('Please enter both URL and Key'); return; }
  var btn = document.getElementById('conn-btn');
  btn.textContent = 'Connecting...'; btn.disabled = true;
  SB_URL = url.replace(/\/$/, '');
  SB_KEY = key;
  try {
    var res = await fetch(SB_URL + '/rest/v1/wellness_centers?limit=1', {
      headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY }
    });
    if (res.status === 401) { showErr('Invalid API Key. Check your anon key.'); SB_URL=null; SB_KEY=null; btn.textContent='Connect & Launch Dashboard →'; btn.disabled=false; return; }
    localStorage.setItem('sb_url', url);
    localStorage.setItem('sb_key', key);
    document.getElementById('setup').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    await loadAll();
  } catch(e) {
    showErr('Connection failed: ' + e.message);
    SB_URL=null; SB_KEY=null;
  }
  btn.textContent = 'Connect & Launch Dashboard →'; btn.disabled = false;
}
function showErr(msg) {
  var el = document.getElementById('setup-err');
  el.textContent = msg; el.style.display = 'block';
}
function doDisconnect() {
  localStorage.removeItem('sb_url'); localStorage.removeItem('sb_key');
  SB_URL=null; SB_KEY=null;
  document.getElementById('setup').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}
var GROQ_MODEL = localStorage.getItem('groqModel') || 'llama-3.1-8b-instant';
var DEFAULT_GROQ_KEY = ''; // set in deploy/index.html — not stored in repo
function getGroqKey() { return localStorage.getItem('groqKey') || DEFAULT_GROQ_KEY; }

// ── HERBALIFE SHAKE NUTRITION (hidden from clients) ──
// WL: 3 scoops F1 + 1 scoop Protein + 1 scoop Shakemate
var SHAKE_WL = { kcal: 170, protein: 19.3, carbs: 17.5, fat: 2.5 };
// WG: 1 scoop Dinoshake + 2 scoops F1 + 1 scoop Protein + 1 scoop Shakemate
var SHAKE_WG = { kcal: 178, protein: 19.3, carbs: 20.5, fat: 2.0 };
function getShakeNutrition(goal) { return goal && goal.toLowerCase().includes('gain') ? SHAKE_WG : SHAKE_WL; }
var HIGH_PROTEIN_KEYWORDS = ['chicken','egg','fish','paneer','dal','rajma','chana','soya','tofu','protein','mutton','beef','prawn'];
function countProteinSources(foodArr) {
  return foodArr.filter(function(f){
    if(parseFloat(f.protein) >= 10) return true;
    return HIGH_PROTEIN_KEYWORDS.some(function(kw){ return f.name.toLowerCase().includes(kw); });
  }).length;
}
function saveGroqKey() {
  var key = document.getElementById('cfg-groq-key').value.trim();
  localStorage.setItem('groqKey', key);
  showToast('Groq API Key saved successfully!', 'success');
}
async function testGroqKey() {
  var resultEl = document.getElementById('groq-test-result');
  var btn = document.getElementById('btn-test-groq');
  btn.textContent = 'Testing…';
  btn.disabled = true;
  resultEl.style.display = 'none';
  try {
    var res = await fetch('/api/groq-models');
    var data = await res.json();
    if (!res.ok) {
      resultEl.style.background = '#fde8e8';
      resultEl.style.color = '#a10000';
      resultEl.innerHTML = '❌ <strong>Server key invalid</strong> — ' + (data.error || 'HTTP ' + res.status);
    } else {
      var models = (data.data || []).map(function(m){ return m.id; }).sort();
      resultEl.style.background = '#e6f9f0';
      resultEl.style.color = '#065f46';
      resultEl.innerHTML = '✅ <strong>Server Groq key is valid!</strong> ' + models.length + ' models available:<br>'
        + models.map(function(m){ return '• ' + m; }).join('<br>');
    }
  } catch(e) {
    resultEl.style.background = '#fde8e8';
    resultEl.style.color = '#a10000';
    resultEl.innerHTML = '❌ Network error — ' + e.message;
  }
  resultEl.style.display = 'block';
  btn.textContent = 'Test Key';
  btn.disabled = false;
}
// ── CENTRALIZED GROQ PIPELINE ──
// All AI calls go through callGroq() — routes through /api/groq on Vercel.
// The GROQ_API_KEY lives in Vercel env vars, never in the browser.
var GROQ_URL = '/api/groq';
async function callGroq(systemPrompt, userPrompt, opts) {
  opts = opts || {};
  var res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemPrompt: systemPrompt || null,
      userPrompt: userPrompt,
      model: opts.model || GROQ_MODEL,
      maxTokens: opts.maxTokens || 500,
      temperature: opts.temperature !== undefined ? opts.temperature : 0.85
    })
  });
  var data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Groq API error ' + res.status);
  if (data.error) throw new Error(data.error);
  return data.text;
}
function saveGroqModel() {
  var sel = document.getElementById('cfg-groq-model');
  if (!sel) return;
  GROQ_MODEL = sel.value;
  localStorage.setItem('groqModel', GROQ_MODEL);
  showToast('AI model set to: ' + GROQ_MODEL, 'success');
}
function saveCountryCode() {
  var code = document.getElementById('cfg-country-code').value.trim().replace(/\D/g,'');
  if (!code) { showToast('Enter a valid country code (digits only)', 'error'); return; }
  localStorage.setItem('countryCode', code);
  COUNTRY_CODE = code;
  showToast('Country code saved: +' + code, 'success');
}
function saveWaLang() {
  var lang = document.getElementById('cfg-wa-lang').value;
  localStorage.setItem('waLang', lang);
  WA_LANG = lang;
  showToast('Default WhatsApp language set to: ' + lang, 'success');
}
async function bootDashboard() {
  try {
    // ── STEP 1: Auth check ──
    initAuthClient();

    // Token refresh listener (keeps pz_session_tokens fresh while tab is open)
    _sbAuth.auth.onAuthStateChange(function(event, session) {
      if (event === 'TOKEN_REFRESHED' && session) {
        _authSession = session;
        localStorage.setItem('pz_session_tokens', JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token }));
      }
      if (event === 'SIGNED_IN' && session) {
        _authSession = session;
      }
    });

    // ── "Remember this device" — valid for 60 days ──
    var SIXTY_DAYS = 60 * 24 * 60 * 60 * 1000;
    var rememberedEmail = localStorage.getItem('pz_remembered_email');
    var loginTs = parseInt(localStorage.getItem('pz_login_ts') || '0');
    var deviceTrusted = rememberedEmail && (Date.now() - loginTs) < SIXTY_DAYS;

    if (!deviceTrusted) {
      // Try restoring full Supabase session (works when token hasn't expired)
      var sessionRestored = await checkExistingSession();
      if (sessionRestored) {
        // Upgrade trust on successful session restore
        if (_authUser && _authUser.email) {
          localStorage.setItem('pz_remembered_email', _authUser.email);
          localStorage.setItem('pz_login_ts', Date.now());
        }
        deviceTrusted = true;
      }
    }

    if (!deviceTrusted) {
      document.getElementById('app-loading').style.display = 'none';
      document.getElementById('login-screen').style.display = 'flex';
      return;
    }

    // Device is trusted — set a synthetic session if no real one (uses CENTER_SB_KEY as fallback)
    if (!_authSession) {
      _authSession = { access_token: null, user: { email: rememberedEmail } };
    }

    // ── STEP 2: UI init (runs only when authed) ──
    var gKey = getGroqKey();
    var cc = localStorage.getItem('countryCode');
    if(gKey) document.getElementById('cfg-groq-key').value = gKey;
    if(cc) { document.getElementById('cfg-country-code').value = cc; COUNTRY_CODE = cc; }
    else document.getElementById('cfg-country-code').value = '91';
    var savedWaLang = localStorage.getItem('waLang');
    if (savedWaLang) { WA_LANG = savedWaLang; var wsel = document.getElementById('cfg-wa-lang'); if(wsel) wsel.value = savedWaLang; }
    var savedModel = localStorage.getItem('groqModel');
    if (savedModel) { GROQ_MODEL = savedModel; var msel = document.getElementById('cfg-groq-model'); if(msel) msel.value = savedModel; }
    onFinTypeChange();
    setFinPeriod('all', document.querySelectorAll('.fin-period')[3]);
    renderProfileCard();

    // ── STEP 3: Load app data ──
    await startApp();
    var _d=new Date(); var today=_d.getFullYear()+'-'+String(_d.getMonth()+1).padStart(2,'0')+'-'+String(_d.getDate()).padStart(2,'0');
    ['att-date','body-date','fin-date','inv-in-date','inv-out-date','inv-sum-date','inv-usage-date'].forEach(function(id){
      var el = document.getElementById(id); if(el) el.value = today;
    });
    // Start live check-in polling (every 15s)
    setInterval(pollQrCheckins, 15000);
  } catch(e) {
    console.error('startup crash:', e);
    document.body.innerHTML = '<div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f8faf8;padding:32px;text-align:center">'
      + '<div style="font-size:48px;margin-bottom:16px">⚠️</div>'
      + '<h2 style="color:#1a3a28;margin-bottom:8px">App failed to start</h2>'
      + '<p style="color:#666;margin-bottom:8px;font-size:14px">Please reload. If the problem persists, contact support.</p>'
      + '<p style="color:#999;font-size:12px;margin-bottom:24px;font-family:monospace;background:#f0f0f0;padding:8px 16px;border-radius:8px">' + (e && e.message ? e.message : String(e)) + '</p>'
      + '<button onclick="location.reload()" style="background:#1a3a28;color:#fff;border:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer">🔄 Reload App</button>'
      + '</div>';
  }
}

window.bootDashboard = bootDashboard;
if (!window.authSplitActive) {
  window.onload = bootDashboard;
}

// ── REFRESH BUTTON ──
async function refreshDashboard() {
  var btn = document.getElementById('refresh-btn');
  btn.textContent = '⏳ Refreshing...';
  btn.disabled = true;
  await loadAll();
  btn.textContent = '✅ Done!';
  setTimeout(function(){ btn.textContent = '🔄 Refresh Data'; btn.disabled = false; }, 1500);
}

// ── LOAD ──
async function loadAll() {
  D.stockIn=[]; D.stockOut=[]; D.dailyUsage=[]; D.currentStock={};
  D.coupons=[]; D.payments=[]; D.packHistory=[];
  try {
    try { await loadScript('https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js'); } catch(scErr) { console.error(scErr); }
    // Phase 1: centers + customers + coaches first (attendance/body need customer IDs for center-scoped query)
    var _ldMsg = document.getElementById('app-loading-msg'); if(_ldMsg) _ldMsg.textContent = 'Connecting to database…';
    await Promise.all([loadCenters(), loadCustomers(), loadCoaches()]);
    if(_ldMsg) _ldMsg.textContent = 'Loading attendance & finance…';
    // Phase 2: walkins must load before body (body filter includes walk-in IDs)
    await Promise.all([loadAttendance(), loadFinance(),
      loadCoupons(), loadPayments(), loadPackHistory(),
      loadLeads(), loadWalkins(), loadExpenses(), loadFoods(), loadInventory(), loadContests(), loadAnnouncements(), loadRecurring()]);
    // Phase 3: body runs after walkins so _custIdsFilter() includes walk-in IDs
    await loadBody();
    _daysLeftCache = {};  // all data loaded — recalculate with full attendance
    try { renderCustomers(); } catch(re){ console.error('renderCustomers crash:',re); }
    try { renderOverview(); } catch(re){ console.error('renderOverview crash:',re); }
    try { renderAnnouncementBanner(); } catch(re){ console.error('renderAnnouncementBanner crash:',re); }
    try { autoApplyRecurring(); } catch(re){ console.error('autoApplyRecurring crash:',re); }
    try { loadFollowUps(); } catch(re){ console.error('loadFollowUps crash:',re); }
    applyLang();
    (function(){ var btn=document.getElementById('dark-mode-btn'); if(btn) btn.textContent=localStorage.getItem('svTheme')==='dark'?'☀️':'🌙'; })();
    startAutoPing();
    migrateSvBodyToSupabase();
    // Hide loading splash — data is ready
    var _ld = document.getElementById('app-loading'); if(_ld) _ld.style.display='none';
    // On startup: if PINs exist but no email-auth session, prompt for PIN
    // Skip PIN prompt if user is already authenticated via email OTP
    if (!_authSession) checkStartupAuth();
  } catch(e) {
    console.error('loadAll crash:', e);
    // Hide loading splash and show error
    var _ld = document.getElementById('app-loading'); if(_ld) _ld.style.display='none';
    var app = document.getElementById('app');
    if(app) app.innerHTML = '<div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f8faf8;padding:32px;text-align:center">'
      + '<div style="font-size:48px;margin-bottom:16px">⚠️</div>'
      + '<h2 style="color:#1a3a28;margin-bottom:8px">Something went wrong</h2>'
      + '<p style="color:#666;margin-bottom:8px;font-size:14px">The app failed to load. This is usually a temporary issue.</p>'
      + '<p style="color:#999;font-size:12px;margin-bottom:24px;font-family:monospace;background:#f0f0f0;padding:8px 16px;border-radius:8px">' + (e && e.message ? e.message : String(e)) + '</p>'
      + '<button onclick="location.reload()" style="background:#1a3a28;color:#fff;border:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer">🔄 Reload App</button>'
      + '</div>';
  }
}
async function loadCenters() {
  D.centers = await dbGet('wellness_centers');
  // Build in-memory PIN map from DB (single source of truth — works across all devices)
  _DB_PINS = {};
  D.centers.forEach(function(c){ var p = c.pin || c.center_pin; if(p) _DB_PINS[c.id] = p; });
  // Load supervisor PIN from app_settings
  try {
    var settings = await dbGet('app_settings', 'key', 'key=eq.supervisor_pin');
    _DB_SUPERVISOR_PIN = (settings && settings.length) ? settings[0].value : '';
  } catch(e) { _DB_SUPERVISOR_PIN = ''; }
  renderCenters(); updateCenterSelects(); updateCenterSwitcher(); updateSidebarLogo();
}
function updateSidebarLogo() {
  var cn = getCenterName();
  var el = document.getElementById('sb-logo-h1') || document.querySelector('.sb-logo h1');
  if (el) el.textContent = '🌿 ' + cn;
  document.title = cn + ' — Supervisor Dashboard';
  // Greeting
  var h = new Date().getHours();
  var greet = h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
  var gTime = document.getElementById('sb-greeting-time');
  var gName = document.getElementById('sb-greeting-name');
  if (gTime) gTime.textContent = greet;
  if (gName) gName.textContent = cn;
  var wcBtn = document.getElementById('wc-center-btn');
  if (wcBtn) wcBtn.textContent = '🌿 ' + cn;
}
async function loadCustomers() {
  D.customers = await dbGet('customers', 'created_at', _cFilter());
  renderCustomers();
  updateCustSelects();
  updateCoachSelects();
  updateBodyCustSelect();
  updatePaymentPersonSelect();
}
async function loadAttendance() { D.attendance = await dbGet('attendance','date', _custIdsFilter()); _daysLeftCache = {}; renderAttendance(); }

async function loadBody() {
  getCredentials();
  D.body = [];
  try {
    var custF = _custIdsFilter();
    var bodyUrl = getActiveSbUrl() + '/rest/v1/body_composition?order=date.desc&limit=500' + (custF ? '&' + custF : '');
    const res = await fetch(bodyUrl, {
      headers: { 'apikey': SB_KEY || CENTER_SB_KEY, 'Authorization': 'Bearer ' + getActiveSbKey() }
    });
    D.body = await res.json();
    if (!Array.isArray(D.body)) D.body = [];
  } catch(e) { D.body = []; }
  renderBody();
  renderRecheckBadge();
}

async function loadFinance() { D.finance = await dbGet('finance','date', _cFilter()); renderFinance(); }
async function loadCoaches() {
  var _coachFilter = ACTIVE_CENTER ? 'wellness_center_id=eq.' + ACTIVE_CENTER : '';
  D.coaches = await dbGet('coaches', 'created_at', _coachFilter);
  renderCoaches();
  updateCoachSelects();
  updateCouponCoachSelects();
  updateCoachUplineSelects();
  updateCenterOwnerSelect();
  renderCoachPackAlerts();
}

// ══════════════════════════════════════════════
// GENERIC SEARCHABLE DROPDOWN SYSTEM
// ══════════════════════════════════════════════
var _sdData = {}; // {dropId: {items:[], onPick:fn}}

function sdInit(dropId, inputId, hiddenId, onPick) {
  _sdData[dropId] = {items:[], inputId:inputId, hiddenId:hiddenId, onPick:onPick||null};
  document.addEventListener('DOMContentLoaded', function(){
    var listEl = document.createElement('div');
    listEl.id = 'sd-list-'+dropId;
    listEl.style.cssText = 'display:none;position:fixed;max-height:200px;overflow-y:auto;background:#fff;border:1.5px solid var(--primary);border-radius:0 0 8px 8px;z-index:99999;box-shadow:0 6px 20px rgba(0,0,0,0.2)';
    document.body.appendChild(listEl);
    var inp = document.getElementById(inputId);
    if (!inp) return;
    inp.addEventListener('focus', function(){ sdRender(dropId, this.value); });
    inp.addEventListener('input', function(){
      document.getElementById(hiddenId).value = '';
      sdRender(dropId, this.value);
    });
    inp.addEventListener('blur', function(){
      var did = dropId;
      setTimeout(function(){ var l=document.getElementById('sd-list-'+did); if(l) l.style.display='none'; }, 150);
    });
  });
}

function sdSetItems(dropId, items) {
  if (_sdData[dropId]) _sdData[dropId].items = items;
}

function sdRender(dropId, filter) {
  var d = _sdData[dropId]; if(!d) return;
  var list = document.getElementById('sd-list-'+dropId);
  var inp = document.getElementById(d.inputId);
  if (!list || !inp) return;
  var q = (filter||'').toLowerCase();
  var matches = q ? d.items.filter(function(it){ return it.search.indexOf(q)!==-1 || it.label.toLowerCase().indexOf(q)!==-1; }) : d.items;
  var rect = inp.getBoundingClientRect();
  list.style.top = rect.bottom + 'px';
  list.style.left = rect.left + 'px';
  list.style.width = rect.width + 'px';
  if (!matches.length) { list.innerHTML='<div style="padding:10px 14px;color:var(--muted);font-size:13px;background:#fff">No matches</div>'; list.style.display='block'; return; }
  list.innerHTML = matches.map(function(it){
    return '<div class="ref-item" data-value="'+it.value+'" data-drop="'+dropId+'" style="padding:10px 14px;cursor:pointer;font-size:13px;font-weight:500;color:var(--text);border-bottom:1px solid var(--surface2);background:#fff" onmousedown="sdPick(this)">'+it.label+'</div>';
  }).join('');
  list.style.display='block';
}

function sdPick(el) {
  var dropId = el.getAttribute('data-drop');
  var val = el.getAttribute('data-value');
  var label = el.textContent;
  var d = _sdData[dropId]; if(!d) return;
  document.getElementById(d.hiddenId).value = val;
  document.getElementById(d.inputId).value = label;
  document.getElementById('sd-list-'+dropId).style.display = 'none';
  if (d.onPick) d.onPick(val, label);
}

function sdSetValue(dropId, value) {
  var d = _sdData[dropId]; if(!d) return;
  document.getElementById(d.hiddenId).value = value||'';
  var match = d.items.find(function(it){ return it.value === value; });
  document.getElementById(d.inputId).value = match ? match.label : '';
}

function sdClear(dropId) {
  var d = _sdData[dropId]; if(!d) return;
  document.getElementById(d.hiddenId).value = '';
  document.getElementById(d.inputId).value = '';
}

// ── Build person list (coaches + customers) for dropdowns ──
function getAllPersonItems(opts) {
  opts = opts||{};
  var items = [];
  var coachIds = {};
  if (opts.includeOwner) {
    var p = OWNER_PROFILE;
    if (p.name) items.push({value:'OWNER', label:'⭐ Me — '+p.name, search: p.name.toLowerCase()});
  }
  D.coaches.forEach(function(c){ coachIds[c.id]=true; items.push({value:c.id, label:c.name+' (Coach)', search:c.name.toLowerCase()}); });
  D.customers.forEach(function(c){ if(c.name && !coachIds[c.id]) items.push({value:c.id, label:c.name, search:c.name.toLowerCase()}); });
  if (opts.includeOther) items.push({value:'OTHER', label:'Other / External Person', search:'other external'});
  return items;
}

// ── Init all searchable dropdowns ──
sdInit('ref', 'ref-search-input', 'customer-coach', function(val){
  document.getElementById('other-ref-row').style.display = val==='OTHER' ? 'flex' : 'none';
  checkCompDayEligibility(val);
});
sdInit('coupon-person', 'coupon-person-input', 'coupon-coach-id', null);
sdInit('coupon-ref', 'coupon-ref-input', 'coupon-ref-person-id', null);
sdInit('renew-person', 'renew-person-input', 'cr-coach', function(){ calcCouponRenewal(); });
sdInit('coupon-filter', 'coupon-filter-input', 'coupon-coach-sel', function(){ renderCouponView(); });
sdInit('shake-person', 'shake-person-input', 'sr-person-id', function(){ showShakeBalance(); });

function updateCoachSelects() {
  sdSetItems('ref', getAllPersonItems({includeOwner:true, includeOther:true}));
  sdSetItems('coupon-person', getAllPersonItems({}));
  sdSetItems('coupon-ref', getAllPersonItems({}));
  sdSetItems('renew-person', getAllPersonItems({}));
  sdSetItems('coupon-filter', [{value:'', label:'— All People —', search:'all'}].concat(getAllPersonItems({})));
  sdSetItems('shake-person', getAllPersonItems({}));
  updateProfileCoachSelect();
}

function togglePinVis(inputId, btn) {
  var inp = document.getElementById(inputId);
  if(inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈'; }
  else { inp.type = 'password'; btn.textContent = '👁️'; }
}

// ── SHARED PACK ──
function updatePackOwnerSelect() {
  var sel = document.getElementById('customer-pack-owner'); if(!sel) return;
  var editId = document.getElementById('customer-id').value;
  var _custs = D.customers.filter(function(c){
    return c.id !== editId && c.pack_type && c.pack_start_date && !c.pack_owner_id;
  });
  var _coaches = D.coaches.filter(function(c){
    return c.pack_type && c.pack_start_date && !c.pack_owner_id;
  });
  var _all = _custs.map(function(c){ return {id:c.id, name:c.name, obj:c}; })
    .concat(_coaches.map(function(c){ return {id:c.id, name:c.name+' 👨‍🏫', obj:c}; }));
  sel.innerHTML = '<option value="">— Own Pack (not shared) —</option>' +
    _all.map(function(p){
      var st = getDaysLeft(p.obj);
      return '<option value="'+p.id+'">'+p.name+' ('+p.obj.pack_type+' — '+st.days+' servings left)</option>';
    }).join('');
}

function updateCoachPackOwnerSelect() {
  var sel = document.getElementById('coach-pack-owner'); if(!sel) return;
  var editId = document.getElementById('coach-id').value;
  var _custs = D.customers.filter(function(c){
    return c.pack_type && c.pack_start_date && !c.pack_owner_id;
  });
  var _coaches = D.coaches.filter(function(c){
    return c.id !== editId && c.pack_type && c.pack_start_date && !c.pack_owner_id;
  });
  var _all = _custs.map(function(c){ return {id:c.id, name:c.name, obj:c}; })
    .concat(_coaches.map(function(c){ return {id:c.id, name:c.name+' 👨‍🏫', obj:c}; }));
  sel.innerHTML = '<option value="">— Own Pack (not shared) —</option>' +
    _all.map(function(p){
      var st = getDaysLeft(p.obj);
      return '<option value="'+p.id+'">'+p.name+' ('+p.obj.pack_type+' — '+st.days+' servings left)</option>';
    }).join('');
}
function onCoachPackOwnerChange() {
  var ownerId = document.getElementById('coach-pack-owner').value;
  var packRow = document.querySelector('#coach-pack-section .fr');
  if(ownerId) {
    if(packRow) packRow.style.display = 'none';
  } else {
    if(packRow) packRow.style.display = '';
  }
}
function onPackOwnerChange() {
  var ownerId = document.getElementById('customer-pack-owner').value;
  var ownFields = document.getElementById('own-pack-fields');
  var sharedInfo = document.getElementById('shared-pack-info');
  if(ownerId) {
    ownFields.style.display = 'none';
    var owner = D.customers.find(function(c){return c.id===ownerId;});
    if(owner) {
      var st = getDaysLeft(owner);
      var members = D.customers.filter(function(c){return c.pack_owner_id===ownerId;});
      sharedInfo.style.display = 'block';
      sharedInfo.innerHTML = '👥 Sharing <strong>'+owner.name+'\'s</strong> pack ('+owner.pack_type+')<br>'+
        '📊 '+st.days+' servings remaining' +
        (members.length ? '<br>👤 Other members: '+members.map(function(m){return m.name;}).join(', ') : '');
    }
  } else {
    ownFields.style.display = 'block';
    sharedInfo.style.display = 'none';
  }
}

function getPackOwner(c) {
  if(!c.pack_owner_id) return c;
  return D.customers.find(function(x){return x.id===c.pack_owner_id;}) || c;
}

function getPackMembers(ownerId) {
  return D.customers.filter(function(c){return c.pack_owner_id===ownerId;});
}

// ── COMPLEMENTARY DAY ──
function checkCompDayEligibility(refId) {
  var sec = document.getElementById('comp-day-section');
  if(!sec) return;
  // Only for NEW customers (no id), and only if referrer has active pack
  var isNew = !document.getElementById('customer-id').value;
  if(!isNew || !refId || refId==='OTHER') { sec.style.display='none'; return; }

  // Owner (you) is always considered active — you run the center
  if(refId === 'OWNER') {
    sec.style.display='block';
    document.getElementById('customer-comp-day').checked=true;
    onCompDayToggle();
    return;
  }

  // Check if referrer (coach or customer) has an active pack
  var person = D.customers.find(function(c){return c.id===refId;}) || D.coaches.find(function(c){return c.id===refId;});
  if(!person) { sec.style.display='none'; return; }
  var st = getDaysLeft(person);
  if(st.active) {
    sec.style.display='block';
    document.getElementById('customer-comp-day').checked=true;
    onCompDayToggle();
  } else {
    sec.style.display='none';
  }
}

function onCompDayToggle() {
  var checked = document.getElementById('customer-comp-day').checked;
  document.getElementById('comp-day-options').style.display = checked ? 'flex' : 'none';
  // If complementary, set pack start date to tomorrow
  if(checked) {
    var tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate()+1);
    document.getElementById('customer-start').value = tomorrow.toISOString().split('T')[0];
  } else {
    document.getElementById('customer-start').value = new Date().toISOString().split('T')[0];
  }
}

// ── NAVIGATION ──
function isSupervisor() {
  // If no PINs configured in DB at all, you're always supervisor
  if(!_DB_SUPERVISOR_PIN && Object.keys(_DB_PINS).length === 0) return true;
  return !_centerAuth.type || _centerAuth.type === 'master';
}

function goTo(name, el) {
  var isSuper = isSupervisor();
  if (!isSuper && ['planmgmt', 'pintracker', 'centers', 'sql', 'profile'].indexOf(name) > -1) {
    showToast('This section is for supervisors only', 'error'); return;
  }
  if (!isSuper && ['orgtree', 'bizanalyst'].indexOf(name) > -1 && !isElitePlan()) {
    showToast('This section is an Elite plan feature. Upgrade to unlock.', 'error'); return;
  }
  if (!isSuper && ['export'].indexOf(name) > -1 && !isGrowthPlan()) {
    showToast('Data Export is a Growth plan feature. Upgrade to unlock.', 'error'); return;
  }
  document.querySelectorAll('.sec').forEach(function(s){s.classList.remove('active')});
  document.querySelectorAll('.nav-item').forEach(function(n){n.classList.remove('active')});
  var sec = document.getElementById('sec-'+name);
  if (sec) sec.classList.add('active');
  if (el) el.classList.add('active');
  if (window.innerWidth <= 768) toggleSidebar();
  if (name==='foods')      setTimeout(function(){ renderFoodStats(); renderFoods(); }, 80);
  if (name==='attendance') setTimeout(renderAttendance, 80);
  if (name==='analytics') setTimeout(renderAnalytics, 80);
  if (name==='coupons')   setTimeout(function(){ renderCouponView(); updateCouponCoachSelects(); }, 80);
  if (name==='payments')  setTimeout(function(){ renderPayments(); updatePaymentPersonSelect(); }, 80);
  if (name==='orgtree')   setTimeout(renderOrgTree, 80);
  if (name==='planmgmt')  setTimeout(renderPlanMgmt, 80);
  if (name==='pintracker') setTimeout(initPinTracker, 80);
  if (name==='bizanalyst') setTimeout(initBizAnalyst, 80);
  if (name==='profile')   setTimeout(function(){ renderProfileCard(); updateProfileCoachSelect(); renderSvDietPlan(); }, 80);
  if (name==='leads')     setTimeout(function(){ renderLeadsStats(); renderLeads(); updateLeadCenterSel(); }, 80);
  if (name==='guide')     setTimeout(renderGuide, 80);
  if (name==='finance')        { setTimeout(function(){ setFinPeriod('all', document.querySelector('.fin-period[onclick*="all"]')); }, 80); }
  if (name==='expenses')       { setTimeout(renderExpenses, 80); }
  if (name==='goals')          { setTimeout(renderGoals, 80); }
  if (name==='notifications')  { setTimeout(renderNotifications, 80); }
  if (name==='coaches')        { setTimeout(initCommission, 80); }
}
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sb-overlay').classList.toggle('open');
}
function toggleNavGroup(id) {
  var grp = document.getElementById(id);
  var lbl = grp.previousElementSibling;
  var isCollapsed = grp.style.display === 'none';
  grp.style.display = isCollapsed ? '' : 'none';
  lbl.classList.toggle('collapsed', !isCollapsed);
}

function autofillBodyHeightAge(custId) {
  var el_h = document.getElementById('body-height');
  var el_a = document.getElementById('body-age-field');
  if (!el_h || !el_a) return;

  if (!custId) {
    el_h.value = '';
    el_a.value = '';
    return;
  }

  // 1. Supervisor (Myself)
  if (custId === '__sv__') {
    var op = JSON.parse(localStorage.getItem('ownerProfile')||'{}');
    var svId = op.sv_body_id;
    var lastRec = svId ? (D.body||[]).filter(function(b){return b.customer_id===svId;}).sort(function(a,b){return new Date(b.date)-new Date(a.date);})[0] : null;
    if (lastRec) {
      if (lastRec.height) el_h.value = lastRec.height;
      if (lastRec.age)    el_a.value = lastRec.age;
    } else {
      var p = JSON.parse(localStorage.getItem('sv_profile')||'{}');
      if (p.height) el_h.value = p.height;
      if (p.age)    el_a.value = p.age;
    }
    return;
  }

  // 2. Resolve walkin vs customer/coach
  var isWalkin = custId.startsWith('walkin__');
  var resolvedId = isWalkin ? custId.slice(8) : custId;

  // Find latest record in body composition
  var lastRec = (D.body||[]).filter(function(b){return b.customer_id === resolvedId;}).sort(function(a,b){return new Date(b.date)-new Date(a.date);})[0];
  
  var heightVal = '';
  var ageVal = '';

  if (lastRec) {
    if (lastRec.height) heightVal = lastRec.height;
    if (lastRec.age)    ageVal = lastRec.age;
  }

  // If latest scan record doesn't have height or age, fallback to profile info
  if (!heightVal || !ageVal) {
    var person = null;
    if (isWalkin) {
      person = (D.walkins||[]).find(function(w){return w.id === resolvedId;});
    } else {
      person = D.customers.find(function(c){return c.id === resolvedId;})
            || D.coaches.find(function(c){return c.id === resolvedId;});
    }

    if (person) {
      if (!heightVal && person.height) heightVal = person.height;
      if (!ageVal) {
        if (person.age) {
          ageVal = person.age;
        } else if (person.dob) {
          ageVal = Math.floor((new Date() - new Date(person.dob)) / (365.25 * 24 * 3600 * 1000));
        }
      }
    }
  }

  el_h.value = heightVal;
  el_a.value = ageVal;
}

// ── MODALS ──
function openModal(type) {
  document.getElementById('modal-'+type).classList.add('open');
  // Auto-select center in coach/customer modals for new records
  if(type==='coach' || type==='customer') {
    var sel = document.getElementById(type==='coach' ? 'coach-center' : 'customer-center');
    if(sel && !sel.value) {
      if(ACTIVE_CENTER) sel.value = ACTIVE_CENTER;
      else if(D.centers.length === 1) sel.value = D.centers[0].id;
    }
    if(type==='coach') { updateCoachUplineSelects(document.getElementById('coach-id').value); updateCoachPackOwnerSelect(); }
  }
  if(type==='customer') updatePackOwnerSelect();
  // Auto-select center in finance modal for new records
  if(type==='finance') {
    var fcen = document.getElementById('fin-center');
    if(fcen && !document.getElementById('fin-id').value) {
      if(ACTIVE_CENTER) fcen.value = ACTIVE_CENTER;
      else if(D.centers.length === 1) fcen.value = D.centers[0].id;
    }
  }
  // Auto-fill customer in body modal from the selected customer in body section
  if(type==='body') {
    var bodyCust = document.getElementById('body-customer');
    if(bodyCust && !document.getElementById('body-id').value) {
      if(_selectedBodyCustId) {
        var _isWalkin = (D.walkins||[]).some(function(w){ return w.id === _selectedBodyCustId; });
        bodyCust.value = _isWalkin ? 'walkin__' + _selectedBodyCustId : _selectedBodyCustId;
      }
      autofillBodyHeightAge(bodyCust.value);
    }
  }
}
function closeModal(type) {
  document.getElementById('modal-'+type).classList.remove('open');
  document.getElementById('modal-'+type).querySelectorAll('input:not([type=hidden]),select,textarea').forEach(function(el){
    if(el.type==='date') { var _td=new Date(); el.value=_td.getFullYear()+'-'+String(_td.getMonth()+1).padStart(2,'0')+'-'+String(_td.getDate()).padStart(2,'0'); }
    else el.value = el.tagName==='SELECT' ? (el.options[0]&&el.options[0].value||'') : '';
  });
  document.getElementById('modal-'+type).querySelectorAll('input[type=hidden]').forEach(function(el){el.value='';});
  if(type==='customer') {
    var refRow = document.getElementById('other-ref-row');
    if(refRow) refRow.style.display = 'none';
  }
  if(type==='body') {
    /* kg fields cleared automatically */
  }
}
document.querySelectorAll('.overlay').forEach(function(o){
  o.addEventListener('click',function(e){ if(e.target===o) closeModal(o.id.replace('modal-','')); });
});

// ── TOAST ──
function showToast(msg, type) {
  var t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast '+(type||'success')+' show';
  setTimeout(function(){t.classList.remove('show');}, 3000);
}

// ── HELPERS ──
function updateCenterSelects() {
  ['customer-center','coach-center'].forEach(function(id){
    var sel = document.getElementById(id);
    if(sel) sel.innerHTML = '<option value="">Select center</option>' + D.centers.map(function(c){return '<option value="'+c.id+'">'+c.name+'</option>';}).join('');
  });
  var finCen = document.getElementById('fin-center');
  if(finCen) finCen.innerHTML = '<option value="">All Centers</option>' + D.centers.map(function(c){return '<option value="'+c.id+'">'+c.name+'</option>';}).join('');
}
function updateCustSelects() {
  var _custs = filterByCenter(D.customers);
  var _allCoaches = filterByCenter(D.coaches);
  var coachesWithPacks = _allCoaches.filter(function(c){ return c.pack_type && c.pack_start_date && c.status !== 'owner'; });
  // Attendance — only coaches with active packs
  var attSel = document.getElementById('att-customer');
  if(attSel) {
    var custOpts = _custs.map(function(c){return '<option value="'+c.id+'">'+c.name+'</option>';}).join('');
    var coachOpts = coachesWithPacks.length ? '<optgroup label="── Coaches ──">'+coachesWithPacks.map(function(c){return '<option value="'+c.id+'">'+c.name+' (Coach)</option>';}).join('')+'</optgroup>' : '';
    attSel.innerHTML = '<option value="">Select person</option>' + custOpts + coachOpts;
  }
  // Body composition — ALL coaches regardless of pack status + walk-ins
  var bodySel = document.getElementById('body-customer');
  if(bodySel) {
    var bCustOpts = _custs.map(function(c){return '<option value="'+c.id+'">'+c.name+'</option>';}).join('');
    var bCoachOpts = _allCoaches.length ? '<optgroup label="── Coaches ──">'+_allCoaches.map(function(c){return '<option value="'+c.id+'">'+c.name+' (Coach)</option>';}).join('')+'</optgroup>' : '';
    var _walkinList = (D.walkins||[]).filter(function(w){ return !ACTIVE_CENTER||w.wellness_center_id===ACTIVE_CENTER; });
    var bWalkinOpts = _walkinList.length ? '<optgroup label="── Walk-ins ──">'+_walkinList.map(function(w){return '<option value="walkin__'+w.id+'">'+w.name+' 🚶 ('+(w.date||'')+')</option>';}).join('')+'</optgroup>' : '';
    bodySel.innerHTML = '<option value="">Select person</option><option value="__sv__">👤 Myself (Supervisor)</option>' + bCustOpts + bCoachOpts + bWalkinOpts;
  }
  var cCoach = document.getElementById('customer-coach');
  if(cCoach) cCoach.innerHTML = '<option value="">Select coach</option>' + D.coaches.map(function(c){return '<option value="'+c.id+'">'+c.name+'</option>';}).join('');
  var assignSel = document.getElementById('customer-assigned-coach');
  if(assignSel) assignSel.innerHTML = '<option value="">— Not assigned —</option>' + filterByCenter(D.coaches).map(function(c){return '<option value="'+c.id+'">'+c.name+'</option>';}).join('');
}

// ── NEW LOGIC HELPERS ──
function getPersonIds(id) {
  var ids = [id];
  if (!id) return ids;
  var cust = D.customers.find(function(x){ return x.id === id; });
  var coach = D.coaches.find(function(x){ return x.id === id; });
  if (coach) {
    D.customers.forEach(function(c) {
      if (c.pack_owner_id === id && (
        (c.contact && coach.contact && c.contact.replace(/\D/g,'') === coach.contact.replace(/\D/g,'')) || 
        (c.name && coach.name && c.name.trim().toLowerCase() === coach.name.trim().toLowerCase())
      )) {
        ids.push(c.id);
      }
    });
  } else if (cust) {
    var co = cust.pack_owner_id ? D.coaches.find(function(x){ return x.id === cust.pack_owner_id; }) : null;
    if (co && (
      (cust.contact && co.contact && cust.contact.replace(/\D/g,'') === co.contact.replace(/\D/g,'')) || 
      (cust.name && co.name && cust.name.trim().toLowerCase() === co.name.trim().toLowerCase())
    )) {
      ids.push(co.id);
    }
  }
  return ids;
}
function parsePack(packType) {
  if (!packType) return 30;
  var t = packType.toLowerCase();
  if (t === 'product user') return 9999; // never expires
  if (/\b90\b/.test(t)) return 90;
  if (/\b26\b/.test(t)) return 26;
  if (/\b3\b/.test(t) && !/\b30\b/.test(t)) return 3;
  return 30;
}
var _daysLeftCache = {};
function getDaysLeft(c) {
  // If this person shares someone else's pack, get status from the pack owner
  var owner = c;
  if(c.pack_owner_id) {
    owner = D.customers.find(function(x){return x.id===c.pack_owner_id;})
         || D.coaches.find(function(x){return x.id===c.pack_owner_id;});
    if(!owner) return { days:0, active:false, used:0, total:0 };
  }
  if(!owner.pack_type || !owner.pack_start_date) return { days:0, active:false, used:0, total:0 };
  var key = owner.id + '|' + owner.pack_start_date;
  if (_daysLeftCache[key]) return _daysLeftCache[key];
  var dur = parsePack(owner.pack_type);
  // Collect all member IDs (owner + linked members from both customers and coaches)
  var memberIds = [owner.id];
  D.customers.forEach(function(m){ if(m.pack_owner_id === owner.id) memberIds.push(m.id); });
  D.coaches.forEach(function(m){ if(m.pack_owner_id === owner.id) memberIds.push(m.id); });
  // Sum servings across all members
  var totalServings = 0;
  D.attendance.forEach(function(a) {
    if(memberIds.indexOf(a.customer_id) !== -1 && a.status==='present' && a.date >= owner.pack_start_date) {
      totalServings += (Number(a.servings) || 1);
    }
  });
  var remaining = Math.max(0, dur - totalServings);
  var result = { days: remaining, active: remaining > 0, used: totalServings, total: dur };
  _daysLeftCache[key] = result;
  return result;
}
function getStreak(cid) {
  var attsSet = new Set();
  var pIds = getPersonIds(cid);
  D.attendance.forEach(function(a){ if(pIds.indexOf(a.customer_id) !== -1 && a.status==='present') attsSet.add(a.date); });
  var atts = Array.from(attsSet).sort().reverse();
  var streak=0, d=new Date();
  for(var i=0; i<atts.length; i++){
    var ad = new Date(atts[i]);
    var diff = Math.floor((d - ad)/(1000*60*60*24));
    if(diff<=1) { if(diff===1||streak===0) streak++; d=ad; } else break;
  }
  return streak;
}
function isInactive(c) {
  if (typeof c === 'string') c = D.customers.find(function(x){return x.id===c;})||D.coaches.find(function(x){return x.id===c;})||{};
  var attsSet = new Set();
  var pIds = getPersonIds(c.id);
  D.attendance.forEach(function(a){ if(pIds.indexOf(a.customer_id) !== -1) attsSet.add(a.date); });
  var atts = Array.from(attsSet).sort().reverse();
  var diff = 0;
  if(atts.length) diff = Math.floor((new Date() - new Date(atts[0]))/(1000*60*60*24));
  else diff = Math.floor((new Date() - (c.join_date ? new Date(c.join_date) : new Date()))/(1000*60*60*24));
  return diff >= 7;
}

// ── CHURN RISK SCORING ──
function getChurnRisk(custId) {
  var c = D.customers.find(function(x){ return x.id === custId; });
  if (!c) return { score: 0, level: 'healthy', label: '', reasons: [] };
  var st = getDaysLeft(c);
  if (!st.active) return { score: 0, level: 'healthy', label: '', reasons: [] };

  var today = new Date().toISOString().split('T')[0];
  var score = 0;
  var reasons = [];

  // Factor 1: Days since last attendance (0-40 pts)
  var atts = D.attendance
    .filter(function(a){ return a.customer_id === custId && a.status === 'present'; })
    .sort(function(a,b){ return b.date.localeCompare(a.date); });
  var daysSinceLast = atts.length
    ? Math.floor((new Date(today) - new Date(atts[0].date)) / 86400000)
    : 999;
  if (daysSinceLast >= 14)      { score += 40; reasons.push('No visit in 14+ days'); }
  else if (daysSinceLast >= 7)  { score += 25; reasons.push('No visit in 7+ days'); }
  else if (daysSinceLast >= 4)  { score += 10; }

  // Factor 2: Session utilisation vs expected (0-35 pts)
  var packDays = st.total || 26;
  var daysElapsed = Math.max(0, packDays - st.days);
  var expectedSessions = daysElapsed > 0 ? Math.floor((daysElapsed / packDays) * st.total) : 0;
  if (expectedSessions > 0) {
    var ratio = atts.length / expectedSessions;
    if (ratio < 0.30)      { score += 35; reasons.push('Very low session attendance'); }
    else if (ratio < 0.60) { score += 20; reasons.push('Below average attendance'); }
    else if (ratio < 0.80) { score += 10; }
  }

  // Factor 3: Pack days remaining but not attending (0-25 pts)
  if (st.days >= 10 && daysSinceLast >= 7) { score += 25; reasons.push('Pack active but not attending'); }
  else if (st.days >= 5 && daysSinceLast >= 5) { score += 10; }

  score = Math.min(100, score);
  var level  = score >= 60 ? 'critical' : score >= 30 ? 'at-risk' : 'healthy';
  var label  = score >= 60 ? '🔴 Critical' : score >= 30 ? '🟡 At Risk' : '';
  return { score: score, level: level, label: label, reasons: reasons };
}

// ── AI INSIGHTS ──
async function generateWeeklySummary() {
  var btn = document.getElementById('ai-overview-btn');
  var div = document.getElementById('ai-overview-summary');
  btn.disabled = true; btn.textContent = 'Generating...';
  div.style.display = 'block'; div.innerHTML = '<div style="color:var(--muted)">Analyzing business data with Groq AI...</div>';

  var today = new Date();
  var lastWeek = new Date(today); lastWeek.setDate(today.getDate()-7);
  var lastWeekStr = lastWeek.toISOString().split('T')[0];

  var totalCusts = D.customers.length;
  var weekAtt = D.attendance.filter(function(a){return a.date >= lastWeekStr && a.status === 'present';}).length;
  var weekInc = (ACTIVE_CENTER ? filterFinanceByCenter(D.finance) : D.finance).filter(function(f){return f.date >= lastWeekStr && f.type === 'income';}).reduce(function(s,f){return s+Number(f.amount)},0);
  var newCusts = D.customers.filter(function(c){return (c.join_date||c.pack_start_date) >= lastWeekStr;}).length;
  var inactiveCount = D.customers.filter(function(c){return isInactive(c.id);}).length;

  var statsMsg = "Total Customers: " + totalCusts + "\nThis Week Attendance: " + weekAtt + "\nThis Week Income: ₹" + weekInc + "\nNew Customers This Week: " + newCusts + "\nInactive Customers (7+ days): " + inactiveCount;

  try {
    var aiText = await callGroq(
      'You are a business advisor for a wellness center. Give a friendly 4-5 sentence weekly summary with 2 specific action items for the owner.',
      'Here are the stats:\n' + statsMsg,
      { maxTokens: 500 }
    );
    div.innerHTML = '<div style="font-size:16px; margin-bottom:10px;"><strong>🤖 AI Business Summary:</strong></div><div style="color:var(--text)">' + aiText.replace(/\n/g, '<br/>') + '</div>';
  } catch(e) {
    div.innerHTML = '<div style="color:var(--danger)">Error generating summary: ' + e.message + '</div>';
    showToast('AI summary failed: ' + e.message, 'error');
  }
  btn.disabled = false; btn.textContent = '✨ Generate AI Summary';
}

// ══════════════════════════════════════════
//  🤖 RENEWAL REMINDER AGENT
// ══════════════════════════════════════════
var _renewalResults = [];
var _expiringItems  = [];

async function runRenewalAgent() {
  if (isCenterSession() && !isGrowthPlan()) { showToast('WhatsApp Nudges are a Growth plan feature (₹499/mo). Request upgrade via WhatsApp.', 'error'); return; }
  if (!getGroqKey()) { showToast('Please set your Groq API Key in Config tab first', 'error'); return; }

  // Find customers expiring in 0–5 days (within active center filter)
  var _custs = filterByCenter(D.customers);
  var expiring = [];
  _custs.forEach(function(c) {
    var st = getDaysLeft(c);
    if (st.active && st.days <= 5) {
      var sessions = D.attendance.filter(function(a){ return a.customer_id === c.id && a.status === 'present'; }).length;
      expiring.push({ c: c, days: st.days, sessions: sessions, used: st.used, total: st.total });
    }
  });
  expiring.sort(function(a,b){ return a.days - b.days; });

  if (!expiring.length) { showToast('No customers expiring in the next 5 days!', 'success'); return; }

  openModal('renewal-agent');
  _renewalResults = [];
  _expiringItems  = expiring;
  var container = document.getElementById('renewal-agent-results');
  container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--muted)"><div style="font-size:32px;margin-bottom:10px">🤖</div><div>Agent is scanning <strong>'+expiring.length+'</strong> expiring customer(s)...<br><small>Generating personalized messages one by one</small></div></div>';

  for (var i = 0; i < expiring.length; i++) {
    var item = expiring[i];
    var c = item.c;
    container.querySelector('div div').innerHTML = 'Crafting message for <strong>' + c.name + '</strong> (' + (i+1) + ' of ' + expiring.length + ')...';
    try {
      var lang = c.preferred_language || WA_LANG || 'English';
      var _cn = getCenterName();
      var langInstruction = lang === 'Telugu'
        ? 'Write the entire message in Telugu script (తెలుగు). Do not use English except for the center name "' + _cn + '".'
        : lang === 'Hindi'
          ? 'Write the entire message in Hindi script (हिंदी). Do not use English except for the center name "' + _cn + '".'
          : 'Write in clear, friendly English.';
      var context = 'Customer name: ' + c.name + '\n' +
        'Pack: ' + (c.pack_type || 'unknown') + '\n' +
        'Days remaining: ' + item.days + (item.days === 0 ? ' (expires today)' : '') + '\n' +
        'Sessions attended: ' + item.sessions + ' out of ' + item.total + '\n' +
        'Goal: ' + (c.goal || 'general wellness') + '\n' +
        (c.pack_price ? 'Pack price: ₹' + c.pack_price + '\n' : '');
      var msg = await callGroq(
        "You write WhatsApp renewal reminders for a wellness center called " + _cn + ". Write warm, personal, motivating messages under 80 words. No markdown, no asterisks. Address customer by first name. Mention days left and gently ask them to renew. End with '" + _cn + "'. " + langInstruction,
        context,
        { maxTokens: 280, temperature: 0.85 }
      );
      _renewalResults.push({ c: c, msg: msg, days: item.days, sessions: item.sessions, total: item.total, lang: lang });
    } catch(e) {
      _renewalResults.push({ c: c, msg: null, days: item.days, error: e.message });
      showToast('Message failed for ' + c.name + ': ' + e.message, 'error');
    }
  }

  // Render all results
  renderRenewalAgentResults();
}

function renderRenewalAgentResults() {
  var container = document.getElementById('renewal-agent-results');
  if (!_renewalResults.length) { container.innerHTML = '<div style="color:var(--muted)">No results.</div>'; return; }
  container.innerHTML = _renewalResults.map(function(r, i) {
    var phone = (r.c.contact||'').replace(/\D/g,'');
    var urgencyColor = r.days === 0 ? 'var(--danger)' : r.days <= 2 ? '#b07800' : 'var(--primary)';
    var urgencyLabel = r.days === 0 ? '🔴 Expires TODAY' : r.days === 1 ? '🟠 1 day left' : '🟡 ' + r.days + ' days left';
    return '<div style="border:1.5px solid var(--border);border-radius:12px;padding:16px;margin-bottom:14px;background:var(--surface)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
        '<div><strong style="font-size:15px">' + r.c.name + '</strong>' +
        '<span style="margin-left:8px;font-size:12px;color:var(--muted)">' + (r.c.pack_type||'') + ' &bull; ' + r.sessions + '/' + r.total + ' sessions</span>' +
        (r.lang && r.lang !== 'English' ? '<span style="margin-left:6px;font-size:11px;background:#f3e8ff;color:#7e22ce;padding:2px 7px;border-radius:10px;font-weight:600">' + r.lang + '</span>' : '') + '</div>' +
        '<span style="font-size:12px;font-weight:700;color:'+urgencyColor+'">'+urgencyLabel+'</span>' +
      '</div>' +
      (r.msg ?
        '<textarea id="ra-msg-'+i+'" style="width:100%;min-height:100px;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:13px;padding:10px;resize:vertical;line-height:1.7;box-sizing:border-box">'+r.msg+'</textarea>' +
        '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">' +
          (phone
            ? '<button class="btn-p" style="font-size:12px;padding:7px 14px" onclick="sendAgentWA('+i+')">💬 Send WhatsApp</button>'
            : '<span style="font-size:12px;color:var(--muted);align-self:center">No phone number on file</span>') +
          '<button class="btn-c" style="font-size:12px;padding:7px 14px" onclick="regenRenewalMsg('+i+')">🔄 Regenerate</button>' +
        '</div>'
      : '<div style="color:var(--danger);font-size:13px;padding:8px 0">Failed to generate: ' + (r.error||'Unknown error') + ' <button class="btn-c" style="font-size:12px;padding:4px 10px;margin-left:8px" onclick="regenRenewalMsg('+i+')">Retry</button></div>') +
    '</div>';
  }).join('') +
  '<div style="text-align:center;margin-top:6px"><button class="btn-c" onclick="runRenewalAgent()" style="font-size:12px">🔄 Re-run Agent</button></div>';
}

function sendAgentWA(i) {
  var r = _renewalResults[i];
  var phone = (r.c.contact||'').replace(/\D/g,'');
  if (!phone) { showToast('No phone number for ' + r.c.name, 'error'); return; }
  var ta = document.getElementById('ra-msg-'+i);
  var msg = ta ? ta.value.trim() : (r.msg||'');
  window.open('https://api.whatsapp.com/send?phone=' + COUNTRY_CODE + phone + '&text=' + encodeURIComponent(msg), '_blank');
}

async function regenRenewalMsg(i) {
  var r = _renewalResults[i];
  var item = _expiringItems[i];
  var ta = document.getElementById('ra-msg-'+i);
  if (ta) { ta.value = 'Regenerating...'; ta.style.color = 'var(--muted)'; }
  try {
    var c = r.c;
    var context = 'Customer name: ' + c.name + '\nPack: ' + (c.pack_type||'unknown') + '\nDays remaining: ' + r.days + '\nSessions attended: ' + r.sessions + ' out of ' + r.total + '\nGoal: ' + (c.goal||'general wellness');
    var newMsg = await callGroq(
      "Write a DIFFERENT WhatsApp renewal reminder for " + getCenterName() + ". Under 80 words, warm, personal. No markdown. Use a different tone or opening line than before. " + (r.lang === 'Telugu' ? 'Write entirely in Telugu script (తెలుగు).' : r.lang === 'Hindi' ? 'Write entirely in Hindi script (हिंदी).' : 'Write in English.'),
      context,
      { maxTokens: 220, temperature: 1.0 }
    );
    _renewalResults[i].msg = newMsg;
    if (ta) { ta.value = newMsg; ta.style.color = ''; }
  } catch(e) {
    if (ta) { ta.value = r.msg || ''; ta.style.color = ''; }
    showToast('Regeneration failed: ' + e.message, 'error');
  }
}

// ══════════════════════════════════════════
//  🤖 GENERIC AGENT RUNNER (shared by all 7 agents)
// ══════════════════════════════════════════
var _agentResults = [];
var _agentCfg     = null;

async function runGenericAgent(cfg) {
  if (!getGroqKey()) { showToast('Set your Groq API Key in Config tab first', 'error'); return; }
  if (!cfg.items || !cfg.items.length) { showToast(cfg.emptyMsg || 'Nothing found matching this agent\'s criteria.', 'success'); return; }
  _agentCfg     = cfg;
  _agentResults = [];
  document.getElementById('agent-output-title').textContent = cfg.title;
  document.getElementById('agent-output-desc').textContent  = cfg.desc + ' Review and edit each message before sending.';
  openModal('agent-output');
  var container = document.getElementById('agent-output-results');
  container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--muted)"><div style="font-size:36px;margin-bottom:12px">🤖</div><div id="agent-status">Processing <strong>'+cfg.items.length+'</strong> item(s)...</div></div>';
  for (var i = 0; i < cfg.items.length; i++) {
    var item = cfg.items[i];
    var statusEl = document.getElementById('agent-status');
    if (statusEl) statusEl.innerHTML = 'Generating '+(i+1)+' of '+cfg.items.length+': <strong>'+cfg.labelFn(item)+'</strong>';
    var phone = cfg.phoneFn ? cfg.phoneFn(item) : null;
    var lang  = cfg.langFn  ? cfg.langFn(item)  : (WA_LANG || 'English');
    var _cnAI = getCenterName();
    var langLine = lang === 'Telugu' ? "Write entirely in Telugu script (తెలుగు). Keep only '" + _cnAI + "' in English."
      : lang === 'Hindi'  ? "Write entirely in Hindi script (हिंदी). Keep only '" + _cnAI + "' in English."
      : 'Write in friendly English.';
    try {
      var msg = await callGroq(
        cfg.systemPrompt + ' ' + langLine,
        cfg.contextFn(item),
        { maxTokens: 300, temperature: 0.85 }
      );
      _agentResults.push({ item:item, msg:msg, lang:lang, phone:phone });
    } catch(e) {
      _agentResults.push({ item:item, msg:null, error:e.message, lang:lang, phone:phone });
      showToast('Agent failed for ' + cfg.labelFn(item) + ': ' + e.message, 'error');
    }
  }
  _renderAgentOutput();
}

function _renderAgentOutput() {
  var cfg = _agentCfg;
  var container = document.getElementById('agent-output-results');
  if (!_agentResults.length) { container.innerHTML = '<div style="color:var(--muted)">No results.</div>'; return; }
  container.innerHTML = _agentResults.map(function(r, i) {
    var urgency  = cfg.urgencyFn  ? cfg.urgencyFn(r.item)  : '';
    var sublabel = cfg.subLabelFn ? cfg.subLabelFn(r.item) : '';
    return '<div style="border:1.5px solid var(--border);border-radius:12px;padding:16px;margin-bottom:14px;background:var(--surface)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px">' +
        '<div><strong style="font-size:15px">'+cfg.labelFn(r.item)+'</strong>' +
        (sublabel ? '<span style="margin-left:8px;font-size:12px;color:var(--muted)">'+sublabel+'</span>' : '') +
        (r.lang && r.lang !== 'English' ? '<span style="margin-left:6px;font-size:11px;background:#f3e8ff;color:#7e22ce;padding:2px 7px;border-radius:10px;font-weight:600">'+r.lang+'</span>' : '') +
        '</div>' +
        (urgency ? '<span style="font-size:12px;font-weight:700">'+urgency+'</span>' : '') +
      '</div>' +
      (r.msg
        ? '<textarea id="ag-msg-'+i+'" style="width:100%;min-height:90px;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:13px;padding:10px;resize:vertical;line-height:1.7;box-sizing:border-box">'+r.msg+'</textarea>' +
          '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">' +
          (r.phone
            ? '<button class="btn-p" style="font-size:12px;padding:7px 14px" onclick="sendAgentMsg('+i+')">💬 Send WhatsApp</button>'
            : '<span style="font-size:12px;color:var(--muted);align-self:center">No phone on file</span>') +
          '<button class="btn-c" style="font-size:12px;padding:7px 14px" onclick="regenAgentMsg('+i+')">🔄 Regenerate</button>' +
          '</div>'
        : '<div style="color:var(--danger);font-size:13px">Error: '+(r.error||'Unknown')+' <button class="btn-c" style="font-size:12px;padding:4px 10px;margin-left:8px" onclick="regenAgentMsg('+i+')">Retry</button></div>') +
    '</div>';
  }).join('') +
  '<div style="text-align:center;margin-top:8px"><button class="btn-c" onclick="runGenericAgent(_agentCfg)">🔄 Re-run Agent</button></div>';
}

function sendAgentMsg(i) {
  var r = _agentResults[i];
  if (!r.phone) { showToast('No phone number on file', 'error'); return; }
  var ta  = document.getElementById('ag-msg-'+i);
  var msg = ta ? ta.value.trim() : (r.msg||'');
  window.open('https://api.whatsapp.com/send?phone='+COUNTRY_CODE+r.phone+'&text='+encodeURIComponent(msg), '_blank');
}

async function regenAgentMsg(i) {
  var r  = _agentResults[i];
  var ta = document.getElementById('ag-msg-'+i);
  if (ta) { ta.value = 'Regenerating...'; ta.style.color = 'var(--muted)'; }
  var langLine = r.lang === 'Telugu' ? 'Write entirely in Telugu (తెలుగు).'
    : r.lang === 'Hindi' ? 'Write entirely in Hindi (हिंदी).' : 'Write in English.';
  try {
    _agentResults[i].msg = await callGroq(
      _agentCfg.systemPrompt + ' Write a DIFFERENT message with a different opening line. ' + langLine,
      _agentCfg.contextFn(r.item),
      { maxTokens: 300, temperature: 1.0 }
    );
    if (ta) { ta.value = _agentResults[i].msg; ta.style.color = ''; }
  } catch(e) {
    if (ta) { ta.value = r.msg||''; ta.style.color = ''; }
    showToast('Regeneration failed: '+e.message, 'error');
  }
}

// ══════════════════════════════════════════
//  AGENT 1 — 😴 Inactive Re-engagement
// ══════════════════════════════════════════
function runInactiveAgent() {
  if (isCenterSession() && !isGrowthPlan()) { showToast('WhatsApp Nudges are a Growth plan feature (₹499/mo). Request upgrade via WhatsApp.', 'error'); return; }
  var todayStr = new Date().toISOString().split('T')[0];
  var items = filterByCenter(D.customers).filter(function(c){ return getDaysLeft(c).active && isInactive(c); });
  runGenericAgent({
    title: '😴 Inactive Re-engagement Agent',
    desc:  'Customers who haven\'t attended in 7+ days but still have an active pack.',
    emptyMsg: 'Great news — no inactive customers with active packs!',
    items: items,
    labelFn:    function(c){ return c.name; },
    subLabelFn: function(c){ var st=getDaysLeft(c); return st.days+' pack days left'; },
    urgencyFn:  function(c){
      var atts = D.attendance.filter(function(a){ return a.customer_id===c.id&&a.status==='present'; }).sort(function(a,b){ return b.date.localeCompare(a.date); });
      var days = atts.length ? Math.floor((new Date()-new Date(atts[0].date))/(864e5)) : '?';
      return days >= 14 ? '🔴 '+days+'d absent' : '🟠 '+days+'d absent';
    },
    phoneFn: function(c){ return (c.contact||'').replace(/\D/g,'')||null; },
    langFn:  function(c){ return c.preferred_language||WA_LANG||'English'; },
    systemPrompt: "You write WhatsApp messages for " + getCenterName() + " to re-engage inactive customers. Warm, caring, motivating. Under 80 words. No markdown or asterisks. Address by first name. Acknowledge they haven't visited recently. Encourage return. End with '" + getCenterName() + "'.",
    contextFn: function(c) {
      var st   = getDaysLeft(c);
      var atts = D.attendance.filter(function(a){ return a.customer_id===c.id&&a.status==='present'; }).sort(function(a,b){ return b.date.localeCompare(a.date); });
      var last = atts.length ? atts[0].date : 'unknown';
      var days = atts.length ? Math.floor((new Date()-new Date(atts[0].date))/(864e5)) : '?';
      return 'Customer: '+c.name+'\nDays since last visit: '+days+'\nLast visit: '+last+'\nPack days remaining: '+st.days+'\nGoal: '+(c.goal||'general wellness');
    }
  });
}

// ══════════════════════════════════════════
//  AGENT 2 — 🎂 Birthday Wishes
// ══════════════════════════════════════════
function runBirthdayAgent() {
  var today = new Date();
  var mm = String(today.getMonth()+1).padStart(2,'0');
  var dd = String(today.getDate()).padStart(2,'0');
  var items = filterByCenter(D.customers).filter(function(c){
    if (!c.dob) return false;
    var p = c.dob.split('-'); return p[1]===mm && p[2]===dd;
  });
  runGenericAgent({
    title: '🎂 Birthday Wishes Agent',
    desc:  'Customers celebrating their birthday today.',
    emptyMsg: 'No customer birthdays today!',
    items: items,
    labelFn:    function(c){ return c.name; },
    subLabelFn: function(c){ return c.dob ? 'Turning '+(today.getFullYear()-parseInt(c.dob)) : ''; },
    urgencyFn:  function(){ return '🎂 Today'; },
    phoneFn: function(c){ return (c.contact||'').replace(/\D/g,'')||null; },
    langFn:  function(c){ return c.preferred_language||WA_LANG||'English'; },
    systemPrompt: "Write a warm, joyful birthday WhatsApp for a wellness center customer. Under 60 words. Personal and celebratory. No markdown. Use first name. End with '" + getCenterName() + "'.",
    contextFn: function(c) {
      var age = c.dob ? (new Date().getFullYear()-parseInt(c.dob)) : null;
      return 'Customer: '+c.name+(age?'\nTurning: '+age+' years old':'')+(c.goal?'\nWellness goal: '+c.goal:'');
    }
  });
}

// ══════════════════════════════════════════
//  AGENT 3 — 💰 Payment Follow-up
// ══════════════════════════════════════════
function runPaymentAgent() {
  var today = new Date().toISOString().split('T')[0];
  var items = (D.payments||[]).filter(function(p){
    return Math.max(0,Number(p.total_amount)-Number(p.amount_paid)) > 0;
  }).map(function(p){
    var cust = D.customers.find(function(c){ return c.id===p.person_id; });
    return { p:p, cust:cust, bal:Math.max(0,Number(p.total_amount)-Number(p.amount_paid)) };
  });
  runGenericAgent({
    title: '💰 Payment Follow-up Agent',
    desc:  'Customers with an outstanding balance.',
    emptyMsg: 'No outstanding payments — all cleared!',
    items: items,
    labelFn:    function(x){ return x.p.person_name||'Unknown'; },
    subLabelFn: function(x){ return '₹'+x.bal.toLocaleString('en-IN')+' due'+(x.p.due_date?' by '+x.p.due_date:''); },
    urgencyFn:  function(x){ return x.p.due_date&&x.p.due_date<today ? '🔴 Overdue' : '⚠️ Pending'; },
    phoneFn: function(x){ return x.cust ? (x.cust.contact||'').replace(/\D/g,'')||null : null; },
    langFn:  function(x){ return (x.cust&&x.cust.preferred_language)||WA_LANG||'English'; },
    systemPrompt: "Write a polite, professional payment reminder WhatsApp for a wellness center. Under 80 words. Friendly but clear. No markdown. Use customer name and mention the amount. End with '" + getCenterName() + "'.",
    contextFn: function(x) {
      var daysOver = x.p.due_date ? Math.floor((new Date()-new Date(x.p.due_date))/(864e5)) : 0;
      return 'Customer: '+x.p.person_name+'\nOutstanding: ₹'+x.bal+'\n'+(x.p.due_date?'Due date: '+x.p.due_date+'\n':'')+(daysOver>0?'Days overdue: '+daysOver+'\n':'')+'Pack/Description: '+(x.p.description||'pack');
    }
  });
}

// ══════════════════════════════════════════
//  AGENT 4 — 🏆 Progress Celebration
// ══════════════════════════════════════════
function runProgressAgent() {
  var MILESTONES = [10, 25, 50, 100];
  var items = [];
  filterByCenter(D.customers).forEach(function(c){
    var sessions = D.attendance.filter(function(a){ return a.customer_id===c.id&&a.status==='present'; }).length;
    if (MILESTONES.indexOf(sessions) !== -1) {
      items.push({ c:c, type:'sessions', value:sessions, milestone:sessions+' sessions completed! 🏅' });
    }
    var bodyRecs = D.body.filter(function(b){ return b.customer_id===c.id&&b.weight; }).sort(function(a,b){ return a.date.localeCompare(b.date); });
    if (bodyRecs.length >= 2) {
      var diff = Math.abs(Number(bodyRecs[bodyRecs.length-1].weight) - Number(bodyRecs[0].weight));
      var gained = Number(bodyRecs[bodyRecs.length-1].weight) > Number(bodyRecs[0].weight);
      [3,5,10].forEach(function(kg){
        if (Math.floor(diff) === kg) items.push({ c:c, type:'weight', value:diff.toFixed(1), gained:gained, milestone:kg+'kg '+(gained?'gained':'lost')+'! 🔥' });
      });
    }
  });
  runGenericAgent({
    title: '🏆 Progress Celebration Agent',
    desc:  'Customers who hit a session or weight milestone.',
    emptyMsg: 'No milestone customers found right now. Check back after more sessions are logged.',
    items: items,
    labelFn:    function(x){ return x.c.name; },
    subLabelFn: function(x){ return x.milestone; },
    urgencyFn:  function(x){ return x.type==='sessions' ? '🏅 '+x.value+' sessions' : '⚖️ '+x.value+'kg'; },
    phoneFn: function(x){ return (x.c.contact||'').replace(/\D/g,'')||null; },
    langFn:  function(x){ return x.c.preferred_language||WA_LANG||'English'; },
    systemPrompt: "Write an enthusiastic, heartfelt congratulations WhatsApp for a wellness center customer who hit a milestone. Under 80 words. Very motivating and celebratory. No markdown. Use their name and mention the specific achievement. End with '" + getCenterName() + "'.",
    contextFn: function(x) {
      return 'Customer: '+x.c.name+'\nMilestone: '+x.milestone+(x.c.goal?'\nGoal: '+x.c.goal:'');
    }
  });
}

// ══════════════════════════════════════════
//  AGENT 5 — 📊 Weekly Coach Report
// ══════════════════════════════════════════
function runCoachReportAgent() {
  var weekAgoStr = new Date(Date.now()-7*864e5).toISOString().split('T')[0];
  var todayStr   = new Date().toISOString().split('T')[0];
  var in7Str     = new Date(Date.now()+7*864e5).toISOString().split('T')[0];
  var items = D.coaches.filter(function(co){ return co.contact; }).map(function(co){
    var myCusts  = D.customers.filter(function(c){ return c.referred_by_id===co.id; });
    var weekAtt  = D.attendance.filter(function(a){ return a.date>=weekAgoStr&&a.date<=todayStr&&a.status==='present'&&myCusts.find(function(c){ return c.id===a.customer_id; }); }).length;
    var expiring = myCusts.filter(function(c){ var s=getDaysLeft(c); return s.active&&s.days<=7; }).length;
    var inactive = myCusts.filter(function(c){ return getDaysLeft(c).active&&isInactive(c); }).length;
    return { co:co, total:myCusts.length, weekAtt:weekAtt, expiring:expiring, inactive:inactive };
  });
  runGenericAgent({
    title: '📊 Weekly Coach Report Agent',
    desc:  'A performance summary sent to each coach via WhatsApp.',
    emptyMsg: 'No coaches with contact numbers found.',
    items: items,
    labelFn:    function(x){ return x.co.name; },
    subLabelFn: function(x){ return x.total+' customers'; },
    urgencyFn:  function(x){ return x.inactive>0 ? '⚠️ '+x.inactive+' inactive' : '✅ All active'; },
    phoneFn: function(x){ return (x.co.contact||'').replace(/\D/g,'')||null; },
    langFn:  function(){ return WA_LANG||'English'; },
    systemPrompt: "Write a brief weekly report WhatsApp message from a wellness center supervisor to a coach. Professional but warm. Under 100 words. No markdown. Include their stats clearly. End with '" + getCenterName() + "'.",
    contextFn: function(x) {
      return 'Coach name: '+x.co.name+'\nTotal customers: '+x.total+'\nAttendance this week: '+x.weekAtt+' sessions\nPacks expiring within 7 days: '+x.expiring+'\nInactive customers (7d+): '+x.inactive;
    }
  });
}

// ══════════════════════════════════════════
//  AGENT 6 — 🛒 Inventory Reorder
// ══════════════════════════════════════════
function runInventoryAgent() {
  if (typeof PRODUCTS_DB === 'undefined') { showToast('Inventory data not loaded', 'error'); return; }
  var items = PRODUCTS_DB.filter(function(p){
    var s = D.currentStock && D.currentStock[p.id];
    var qty = s ? Math.max(0,s.qty) : 0;
    return qty <= p.threshold;
  }).map(function(p){
    var s = D.currentStock && D.currentStock[p.id];
    var qty = s ? Math.max(0,s.qty) : 0;
    var usage = (D.stockUsage||[]).filter(function(u){ return u.product_id===p.id; }).reduce(function(sum,u){ return sum+Number(u.quantity||0); },0);
    return { p:p, qty:qty, threshold:p.threshold, usage:usage };
  });
  runGenericAgent({
    title: '🛒 Inventory Reorder Agent',
    desc:  'Products at or below threshold. AI suggests reorder quantities.',
    emptyMsg: 'All inventory levels are healthy — nothing needs reordering!',
    items: items,
    labelFn:    function(x){ return x.p.name; },
    subLabelFn: function(x){ return 'Stock: '+x.qty+' | Threshold: '+x.threshold; },
    urgencyFn:  function(x){ return x.qty===0 ? '🔴 Out of stock' : '🟡 Low stock'; },
    phoneFn: function(){ return null; },
    langFn:  function(){ return 'English'; },
    systemPrompt: "You are an inventory advisor for a wellness center. Write a brief reorder suggestion note for a product. Include recommended reorder quantity (suggest 2-4 weeks supply based on usage). Under 60 words. Professional tone. No markdown.",
    contextFn: function(x) {
      return 'Product: '+x.p.name+'\nCurrent stock: '+x.qty+(x.qty===0?' (OUT OF STOCK)':'')+'\nMinimum threshold: '+x.threshold+'\nTotal usage recorded: '+x.usage+' units';
    }
  });
}

// ══════════════════════════════════════════
//  AGENT 7 — 🆕 New Customer Welcome
// ══════════════════════════════════════════
function runWelcomeAgent() {
  var today     = new Date().toISOString().split('T')[0];
  var yesterday = new Date(Date.now()-864e5).toISOString().split('T')[0];
  var items = filterByCenter(D.customers).filter(function(c){
    var d = (c.join_date||c.pack_start_date||'');
    return d===today||d===yesterday;
  });
  runGenericAgent({
    title: '🆕 New Customer Welcome Agent',
    desc:  'Customers added today or yesterday who deserve a warm welcome.',
    emptyMsg: 'No new customers added today or yesterday.',
    items: items,
    labelFn:    function(c){ return c.name; },
    subLabelFn: function(c){ return (c.pack_type||'')+(c.pack_start_date?' | starts '+c.pack_start_date:''); },
    urgencyFn:  function(c){ return c.join_date===today||c.pack_start_date===today ? '🆕 Today' : '📅 Yesterday'; },
    phoneFn: function(c){ return (c.contact||'').replace(/\D/g,'')||null; },
    langFn:  function(c){ return c.preferred_language||WA_LANG||'English'; },
    systemPrompt: "Write a warm, welcoming WhatsApp message for a new wellness center customer on their first day. Enthusiastic, personal, encouraging. Under 80 words. No markdown. Use first name. Mention their pack and what to expect. End with '" + getCenterName() + "'.",
    contextFn: function(c) {
      var coach = c.referred_by_id ? D.coaches.find(function(x){ return x.id===c.referred_by_id; }) : null;
      return 'Customer: '+c.name+'\nPack: '+(c.pack_type||'wellness pack')+'\nStart date: '+(c.pack_start_date||today)+(c.goal?'\nGoal: '+c.goal:'')+(coach?'\nCoach: '+coach.name:'')+(c.external_referrer_name?'\nReferred by: '+c.external_referrer_name:'');
    }
  });
}

// ══════════════════════════════════════════
//  AGENT 8 — 💹 Finance Analyst
// ══════════════════════════════════════════
async function runFinanceAnalystAgent() {
  if (isCenterSession() && !isElitePlan()) { showToast('Finance AI Analyst is an Elite plan feature (₹999/mo). Request upgrade via WhatsApp.', 'error'); return; }
  if (!getGroqKey()) { showToast('Set Groq API Key in Config tab first', 'error'); return; }

  var today       = new Date();
  var curMon      = today.toISOString().substring(0,7);
  var lastMon     = new Date(today.getFullYear(), today.getMonth()-1, 1).toISOString().substring(0,7);
  var twoMon      = new Date(today.getFullYear(), today.getMonth()-2, 1).toISOString().substring(0,7);
  var _fin        = ACTIVE_CENTER ? filterFinanceByCenter(D.finance) : D.finance;

  // ── Monthly income / expense totals ──
  var curInc=0, curExp=0, lastInc=0, lastExp=0, twoInc=0;
  var expCat={};
  _fin.forEach(function(f){
    var amt = Number(f.amount)||0;
    if (f.date && f.date.startsWith(curMon))  { if(f.type==='income') curInc+=amt; else { curExp+=amt; var c=f.category||'Other'; expCat[c]=(expCat[c]||0)+amt; } }
    if (f.date && f.date.startsWith(lastMon)) { if(f.type==='income') lastInc+=amt; else lastExp+=amt; }
    if (f.date && f.date.startsWith(twoMon))  { if(f.type==='income') twoInc+=amt; }
  });

  // ── Pending collections ──
  var pending = (D.payments||[]).reduce(function(s,p){ return s+Math.max(0,Number(p.total_amount)-Number(p.amount_paid)); },0);

  // ── Customer metrics ──
  var _custs     = filterByCenter(D.customers);
  var activeCnt  = _custs.filter(function(c){ return getDaysLeft(c).active; }).length;
  var newCnt     = _custs.filter(function(c){ return (c.join_date||c.pack_start_date||'').startsWith(curMon); }).length;
  var expiring7  = _custs.filter(function(c){ var s=getDaysLeft(c); return s.active&&s.days<=7; }).length;

  // ── Low stock count ──
  var lowStock=0;
  if(typeof PRODUCTS_DB!=='undefined') PRODUCTS_DB.forEach(function(p){ var s=D.currentStock&&D.currentStock[p.id]; if(!s||Math.max(0,s.qty)<=p.threshold) lowStock++; });

  var netProfit  = curInc - curExp;
  var margin     = curInc>0 ? ((netProfit/curInc)*100).toFixed(1) : 0;
  var growth     = lastInc>0 ? (((curInc-lastInc)/lastInc)*100).toFixed(1) : null;
  var lastNet    = lastInc - lastExp;

  // ── Build Groq context ──
  var context =
    'WELLNESS CENTER FINANCIAL DATA — '+curMon+'\n\n'+
    'THIS MONTH:\nIncome: ₹'+curInc.toLocaleString('en-IN')+'\nExpenses: ₹'+curExp.toLocaleString('en-IN')+'\nNet Profit: ₹'+netProfit.toLocaleString('en-IN')+'\nProfit Margin: '+margin+'%\n\n'+
    'LAST MONTH ('+lastMon+'):\nIncome: ₹'+lastInc.toLocaleString('en-IN')+'\nExpenses: ₹'+lastExp.toLocaleString('en-IN')+'\nNet: ₹'+lastNet.toLocaleString('en-IN')+'\n\n'+
    'TWO MONTHS AGO ('+twoMon+'):\nIncome: ₹'+twoInc.toLocaleString('en-IN')+'\n\n'+
    (growth!==null?'REVENUE GROWTH vs last month: '+growth+'%\n\n':'')+
    'EXPENSE BREAKDOWN THIS MONTH:\n'+Object.keys(expCat).map(function(k){ return '- '+k+': ₹'+expCat[k].toLocaleString('en-IN'); }).join('\n')+'\n\n'+
    'UNCOLLECTED PENDING PAYMENTS: ₹'+pending.toLocaleString('en-IN')+'\n\n'+
    'BUSINESS METRICS:\nActive customers: '+activeCnt+'\nNew this month: '+newCnt+'\nExpiring in 7 days: '+expiring7+'\nLow/out-of-stock products: '+lowStock+'\n\n'+
    'CONTEXT: Small nutrition wellness center, India, sole proprietor owner.';

  // ── Open modal ──
  document.getElementById('agent-output-title').textContent = '💹 Finance Analyst Agent';
  document.getElementById('agent-output-desc').textContent  = 'Deep financial analysis based on your actual '+curMon+' data. AI-generated advice — not certified financial counsel.';
  openModal('agent-output');
  var container = document.getElementById('agent-output-results');
  container.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted)"><div style="font-size:40px;margin-bottom:14px">💹</div><div style="font-size:14px">Analysing your financial data...<br><small>Reading income, expenses, trends and giving recommendations</small></div></div>';

  try {
    var aiText = await callGroq(
      'You are a financial advisor for a small wellness center business in India. Analyze the data and structure your response with EXACTLY these four section headers on their own line:\n\nFINANCIAL HEALTH\nPROFIT ALLOCATION\nACTION ITEMS\nRED FLAG\n\nFor FINANCIAL HEALTH: 2-3 sentence summary with specific rupee numbers and trends.\nFor PROFIT ALLOCATION: Recommend exact % and rupee amount of net profit for each of: Emergency Reserve, SIP/Mutual Fund, Inventory Restock, Marketing, Business Growth. If net profit is negative say so and advise on cost cutting instead.\nFor ACTION ITEMS: 3 specific, numbered, actionable steps for this month.\nFor RED FLAG: One biggest risk or warning. If none, say "No major red flags this month."\nBe specific with numbers. Total under 350 words.',
      context,
      { maxTokens: 650, temperature: 0.7 }
    );
    _renderFinanceReport(aiText, netProfit, curInc, curExp, pending, growth, expCat);
  } catch(e) {
    container.innerHTML = '<div style="color:var(--danger);padding:20px;text-align:center">Error: '+e.message+'<br><br><button class="btn-c" onclick="runFinanceAnalystAgent()">Try Again</button></div>';
  }
}

function _renderFinanceReport(text, netProfit, income, expenses, pending, growth, expCat) {
  var container = document.getElementById('agent-output-results');

  // ── Summary number cards ──
  var growthNum = parseFloat(growth);
  var summaryHtml =
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px">'+
    _finCard('Net Profit','₹'+netProfit.toLocaleString('en-IN'), netProfit>=0?'#166534':'#dc2626', netProfit>=0?'#f0fdf4':'#fef2f2', netProfit>=0?'#86efac':'#fca5a5')+
    _finCard('Revenue Growth', growth===null?'N/A':(growthNum>=0?'+':'')+growth+'%', growthNum>=0?'#166534':'#dc2626','#fffbeb','#fcd34d')+
    _finCard('Uncollected','₹'+pending.toLocaleString('en-IN'),'#1e40af','#eff6ff','#93c5fd')+
    _finCard('Expense Ratio', income>0?((expenses/income)*100).toFixed(0)+'%':'0%','#9d174d','#fdf2f8','#f9a8d4')+
    '</div>';

  // ── Parse AI sections ──
  var KEYS = ['FINANCIAL HEALTH','PROFIT ALLOCATION','ACTION ITEMS','RED FLAG'];
  var sections={}, cur=null;
  text.split('\n').forEach(function(line){
    var matched=false;
    KEYS.forEach(function(k){ if(line.toUpperCase().indexOf(k)!==-1&&line.length<k.length+10){ cur=k; matched=true; } });
    if(!matched&&cur) sections[cur]=(sections[cur]||'')+line+'\n';
  });

  var CFG={
    'FINANCIAL HEALTH':  {icon:'📊',color:'#1e40af',bg:'#eff6ff',border:'#93c5fd'},
    'PROFIT ALLOCATION': {icon:'💰',color:'#166534',bg:'#f0fdf4',border:'#86efac'},
    'ACTION ITEMS':      {icon:'✅',color:'#92400e',bg:'#fffbeb',border:'#fcd34d'},
    'RED FLAG':          {icon:'🚨',color:'#dc2626',bg:'#fef2f2',border:'#fca5a5'}
  };

  var sectionsHtml = KEYS.map(function(k){
    var content=(sections[k]||'').trim(); if(!content) return '';
    var c=CFG[k];
    return '<div style="background:'+c.bg+';border:1px solid '+c.border+';border-left:4px solid '+c.color+';border-radius:0 10px 10px 0;padding:14px 16px;margin-bottom:12px">'+
      '<div style="font-size:11px;font-weight:700;color:'+c.color+';margin-bottom:8px;text-transform:uppercase;letter-spacing:.6px">'+c.icon+' '+k+'</div>'+
      '<div style="font-size:13px;line-height:1.85;color:#374151;white-space:pre-wrap">'+content+'</div>'+
    '</div>';
  }).join('');

  var disclaimer = '<div style="font-size:11px;color:var(--muted);text-align:center;margin-top:14px;padding:10px 14px;background:var(--surface2);border-radius:8px;line-height:1.6">⚠️ AI-generated financial guidance only — not certified financial advice. Mutual fund investments are subject to market risks. Investment decisions are always yours.</div>';

  var btns = '<div style="display:flex;gap:8px;justify-content:center;margin-top:14px;flex-wrap:wrap">'+
    '<button class="btn-p" style="font-size:12px;padding:8px 16px" onclick="_copyFinanceReport()">📋 Copy Report</button>'+
    '<button class="btn-c" style="font-size:12px;padding:8px 16px" onclick="runFinanceAnalystAgent()">🔄 Re-analyse</button>'+
  '</div>';

  window._finReportText = text;
  container.innerHTML = summaryHtml + sectionsHtml + disclaimer + btns;
}

function _finCard(label, value, color, bg, border) {
  return '<div style="background:'+bg+';border:1px solid '+border+';border-radius:10px;padding:14px;text-align:center">'+
    '<div style="font-size:10px;font-weight:700;color:'+color+';text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">'+label+'</div>'+
    '<div style="font-size:20px;font-weight:700;color:'+color+'">'+value+'</div>'+
  '</div>';
}

// 🥗 WELLNESS SCAN ANALYST AGENT
function openWellnessScanModal() {
  // Clear fields
  document.getElementById('ws-customer-select').value = '';
  document.getElementById('ws-gender').value = 'Male';
  document.getElementById('ws-age').value = '';
  document.getElementById('ws-weight').value = '';
  document.getElementById('ws-bmi').value = '';
  document.getElementById('ws-body-fat').value = '';
  document.getElementById('ws-visceral').value = '';
  document.getElementById('ws-muscle-mass').value = 'Average';
  document.getElementById('ws-energy').value = '';
  document.getElementById('ws-diet').value = '';
  document.getElementById('ws-digestion').value = '';
  document.getElementById('ws-goal').value = '';

  // Populating Customer dropdown
  var sel = document.getElementById('ws-customer-select');
  sel.innerHTML = '<option value="">-- Manual Entry / New Client --</option>';
  
  // Sort customers alphabetically
  var custs = (D.customers || []).slice().sort(function(a,b){
    return (a.name || '').localeCompare(b.name || '');
  });
  custs.forEach(function(c) {
    var opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name + (c.phone ? ' (' + c.phone + ')' : '');
    sel.appendChild(opt);
  });

  // Switch to form tab
  switchWsTab('form');
  document.getElementById('ws-tab-report').disabled = true;

  openModal('wellness-scan');
}

function onWsCustomerSelectChange() {
  var cid = document.getElementById('ws-customer-select').value;
  if (!cid) return;

  var c = D.customers.find(function(x){ return x.id === cid; });
  if (c) {
    if (c.gender) {
      document.getElementById('ws-gender').value = c.gender;
    }
    if (c.goal) {
      document.getElementById('ws-goal').value = c.goal;
    }
  }

  // Find latest body record
  var recs = (D.body || []).filter(function(b){ return b.customer_id === cid && b.weight; })
                           .sort(function(a,b){ return new Date(b.date) - new Date(a.date); });
  if (recs.length) {
    var latest = recs[0];
    if (latest.age) document.getElementById('ws-age').value = latest.age;
    if (latest.weight) document.getElementById('ws-weight').value = latest.weight;
    if (latest.bmi) document.getElementById('ws-bmi').value = latest.bmi;
    if (latest.fat_percentage) document.getElementById('ws-body-fat').value = latest.fat_percentage;
    if (latest.visceral_fat) document.getElementById('ws-visceral').value = latest.visceral_fat;
    
    // Attempt to match muscle mass percentage
    if (latest.muscle_percentage) {
      var m = Number(latest.muscle_percentage);
      if (m < 28) document.getElementById('ws-muscle-mass').value = 'Low';
      else if (m > 38) document.getElementById('ws-muscle-mass').value = 'High';
      else document.getElementById('ws-muscle-mass').value = 'Average';
    }
    
    if (latest.notes) {
      document.getElementById('ws-digestion').value = latest.notes;
    }
  }
}

function switchWsTab(tab) {
  var formTab = document.getElementById('ws-tab-form');
  var reportTab = document.getElementById('ws-tab-report');
  var formView = document.getElementById('ws-form-view');
  var reportView = document.getElementById('ws-report-view');

  if (tab === 'form') {
    formTab.classList.add('active');
    reportTab.classList.remove('active');
    formView.style.display = 'block';
    reportView.style.display = 'none';
  } else {
    reportTab.classList.add('active');
    formTab.classList.remove('active');
    formView.style.display = 'none';
    reportView.style.display = 'block';
  }
}

async function generateWellnessScanReport() {
  var age = document.getElementById('ws-age').value;
  var weight = document.getElementById('ws-weight').value;
  var bmi = document.getElementById('ws-bmi').value;
  var bodyFat = document.getElementById('ws-body-fat').value;
  var visceralFat = document.getElementById('ws-visceral').value;
  
  var energy = document.getElementById('ws-energy').value.trim();
  var diet = document.getElementById('ws-diet').value.trim();
  var digestion = document.getElementById('ws-digestion').value.trim();
  var goal = document.getElementById('ws-goal').value.trim();

  if (!age || !weight || !bmi || !bodyFat || !visceralFat || !energy || !diet || !digestion || !goal) {
    showToast('Please fill in all required fields!', 'error');
    return;
  }

  // Switch to report tab and show loading
  switchWsTab('report');
  document.getElementById('ws-tab-report').disabled = false;
  document.getElementById('ws-report-loading').style.display = 'block';
  document.getElementById('ws-report-content').style.display = 'none';

  try {
    var payload = {
      age: Number(age),
      gender: document.getElementById('ws-gender').value,
      weight: Number(weight),
      bmi: Number(bmi),
      bodyFat: Number(bodyFat),
      visceralFat: Number(visceralFat),
      muscleMass: document.getElementById('ws-muscle-mass').value,
      energyLevels: energy,
      dietHydration: diet,
      digestionIssues: digestion,
      primaryGoal: goal
    };

    var res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    var report = await res.json();
    if (!res.ok) throw new Error(report.error || 'Failed to generate report');

    // Populate Report Content
    document.getElementById('ws-status').textContent = report.client_summary?.status || 'Unknown Status';
    document.getElementById('ws-concern').textContent = report.client_summary?.primary_concern || 'None Identified';
    
    document.getElementById('ws-metabolic-risks').textContent = report.health_risk_report?.metabolic_risks || 'No metabolic risks identified.';
    document.getElementById('ws-energy-analysis').textContent = report.health_risk_report?.energy_and_fatigue_analysis || 'No energy analysis details.';
    document.getElementById('ws-digestive-analysis').textContent = report.health_risk_report?.digestive_analysis || 'No digestive analysis details.';
    document.getElementById('ws-tone').textContent = report.empathic_communication_strategy?.recommended_tone || 'Encouraging & informative';

    // Nutrient Gaps Badges
    var gapContainer = document.getElementById('ws-nutrient-gaps');
    gapContainer.innerHTML = '';
    var gaps = report.nutrient_gaps || [];
    if (gaps.length === 0) {
      gapContainer.innerHTML = '<span style="color:var(--muted); font-size:12px;">No specific gaps identified.</span>';
    } else {
      gaps.forEach(function(tag) {
        var badge = document.createElement('span');
        badge.className = 'ws-badge ' + tag;
        badge.textContent = tag.replace(/_/g, ' ');
        gapContainer.appendChild(badge);
      });
    }

    // Icebreaker Phrases
    var iceContainer = document.getElementById('ws-icebreakers');
    iceContainer.innerHTML = '';
    var icebreakers = report.empathic_communication_strategy?.icebreaker_phrases || [];
    if (icebreakers.length === 0) {
      iceContainer.innerHTML = '<div style="color:var(--muted); font-size:12px;">No icebreakers suggested.</div>';
    } else {
      icebreakers.forEach(function(phrase) {
        var btn = document.createElement('button');
        btn.className = 'ws-copy-btn';
        btn.textContent = phrase;
        btn.onclick = function() {
          navigator.clipboard.writeText(phrase).then(function() {
            showToast('Icebreaker copied!', 'success');
          }).catch(function() {
            showToast('Copy failed', 'error');
          });
        };
        iceContainer.appendChild(btn);
      });
    }

    // Show Report
    document.getElementById('ws-report-loading').style.display = 'none';
    document.getElementById('ws-report-content').style.display = 'block';

  } catch(e) {
    document.getElementById('ws-report-loading').style.display = 'none';
    showToast('AI analysis error: ' + e.message, 'error');
    switchWsTab('form');
  }
}

// ── FINANCE AI INSIGHTS ──
async function generateFinanceInsights() {
  if (!getGroqKey()) { showToast('Please setup Groq API Key in SQL/Config section', 'error'); return; }
  var btn = document.getElementById('fin-ai-btn');
  var outEl = document.getElementById('fin-ai-output');
  btn.disabled = true; btn.textContent = 'Analyzing...';
  outEl.style.display = 'block';
  outEl.innerHTML = '<div class="tcard" style="padding:20px;border-left:4px solid #4f46e5"><div style="color:var(--muted);font-size:13px">✨ AI is analyzing your financial data...</div></div>';

  // Build rich data summary for AI (finance has no customer_id, so use D.finance directly)
  var fin = D.finance;
  var from = document.getElementById('fin-from').value;
  var to   = document.getElementById('fin-to').value;
  var filtered = fin.filter(function(f){ return (!from||f.date>=from) && (!to||f.date<=to); });

  var totalInc = filtered.filter(function(f){return f.type==='income';}).reduce(function(s,f){return s+Number(f.amount);},0);
  var totalExp = filtered.filter(function(f){return f.type==='expense';}).reduce(function(s,f){return s+Number(f.amount);},0);
  var net = totalInc - totalExp;
  var margin = totalInc > 0 ? Math.round((net/totalInc)*100) : 0;

  // Category breakdown
  var incCats = {}, expCats = {};
  filtered.forEach(function(f){
    var c = f.category||'Other';
    if(f.type==='income') incCats[c]=(incCats[c]||0)+Number(f.amount);
    else expCats[c]=(expCats[c]||0)+Number(f.amount);
  });

  // Monthly trend (last 6 months)
  var monthMap = {};
  fin.forEach(function(f){
    var ym=(f.date||'').slice(0,7); if(!ym) return;
    if(!monthMap[ym]) monthMap[ym]={inc:0,exp:0};
    if(f.type==='income') monthMap[ym].inc+=Number(f.amount);
    else monthMap[ym].exp+=Number(f.amount);
  });
  var months = Object.keys(monthMap).sort().slice(-6);
  var trendLines = months.map(function(m){ return m+': Income ₹'+monthMap[m].inc+', Expense ₹'+monthMap[m].exp+', Net ₹'+(monthMap[m].inc-monthMap[m].exp); }).join('\n');

  // Customer context
  var totalCusts = D.customers.length;
  var activeCusts = D.customers.filter(function(c){ return getDaysLeft(c).active; }).length;
  var expiring3 = D.customers.filter(function(c){ var s=getDaysLeft(c); return s.active && s.days<=3; }).length;

  var period = (from && to) ? from+' to '+to : 'selected period';
  var dataMsg = [
    '=== WELLNESS CENTER FINANCIAL REPORT ('+period+') ===',
    '',
    'OVERVIEW:',
    '- Total Income: ₹'+totalInc.toLocaleString('en-IN'),
    '- Total Expense: ₹'+totalExp.toLocaleString('en-IN'),
    '- Net Profit: ₹'+net.toLocaleString('en-IN'),
    '- Profit Margin: '+margin+'%',
    '- Total Customers: '+totalCusts+' (Active: '+activeCusts+', Expiring in 3 days: '+expiring3+')',
    '',
    'INCOME BY CATEGORY:',
    Object.entries(incCats).map(function(e){return '- '+e[0]+': ₹'+e[1];}).join('\n'),
    '',
    'EXPENSE BY CATEGORY:',
    Object.entries(expCats).map(function(e){return '- '+e[0]+': ₹'+e[1];}).join('\n'),
    '',
    'MONTHLY TREND (last 6 months):',
    trendLines || 'No monthly data available',
    '',
    'TRANSACTIONS: '+filtered.length+' total in this period'
  ].join('\n');

  var systemPrompt = [
    'You are a sharp financial advisor for a wellness/health center business in India.',
    'Analyze the financial data provided and give practical, specific insights.',
    'Structure your response with these sections:',
    '1. 📊 PERFORMANCE SUMMARY (2-3 sentences on overall health)',
    '2. 🔍 KEY OBSERVATIONS (3-4 bullet points — specific numbers, what is good/bad)',
    '3. ⚠️ RISK AREAS (1-2 concerns based on the data)',
    '4. 💡 ACTION RECOMMENDATIONS (3 specific, actionable steps the owner should take)',
    '5. 🎯 NEXT MONTH FOCUS (one clear priority)',
    'Be direct, use actual numbers from the data, avoid generic advice.',
    'Keep total response under 400 words.'
  ].join('\n');

  try {
    var aiText = await callGroq(systemPrompt, dataMsg, { maxTokens: 800, temperature: 0.4 });
    // Render with nice formatting
    var html = aiText
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/^(#{1,3})\s+(.+)$/gm, '<div style="font-weight:700;margin-top:12px;margin-bottom:4px">$2</div>')
      .replace(/^[-•]\s+(.+)$/gm, '<div style="padding-left:14px;margin-bottom:3px">• $1</div>')
      .replace(/\n\n/g, '<br>')
      .replace(/\n/g, '<br>');
    outEl.innerHTML = '<div class="tcard" style="padding:20px;border-left:4px solid #4f46e5">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'+
        '<div style="font-weight:700;font-size:14px;color:#4f46e5">✨ AI Financial Insights <span style="font-size:11px;font-weight:400;color:var(--muted);margin-left:6px">via '+GROQ_MODEL+'</span></div>'+
        '<button onclick="document.getElementById(\'fin-ai-output\').style.display=\'none\'" style="border:none;background:none;font-size:16px;cursor:pointer;color:var(--muted)">✕</button>'+
      '</div>'+
      '<div style="font-size:13px;line-height:1.8;color:var(--text)">'+html+'</div>'+
    '</div>';
  } catch(e) {
    outEl.innerHTML = '<div class="tcard" style="padding:16px;border-left:4px solid var(--danger)"><strong>Error:</strong> '+e.message+'</div>';
    showToast('Finance AI error: ' + e.message, 'error');
  }
  btn.disabled = false; btn.textContent = '✨ AI Insights';
}

var _aiInFlight = {};
async function askBodyAI(cid, rid) {
  if(!getGroqKey()) { showToast('Please setup Groq API Key in Config tab', 'error'); return; }
  var row = document.getElementById('ai-row-'+rid);
  var content = document.getElementById('ai-content-'+rid);
  if(row.style.display==='table-row') { row.style.display='none'; return; }
  if(_aiInFlight[rid]) return;
  _aiInFlight[rid] = true;

  row.style.display='table-row';
  content.innerHTML = '<div style="color:var(--muted)">Analyzing with Groq AI...</div>';

  var c = D.customers.find(function(x){return x.id === cid});
  var goal = c ? (c.goal||'Weight Loss') : 'Unknown';

  var recs = D.body.filter(function(b){return b.customer_id===cid}).sort(function(a,b){return new Date(b.date)-new Date(a.date)}).slice(0,4);
  var statsMsg = "Goal: " + goal + "\n\nLast 4 Records (newest first):\n";
  recs.forEach(function(r) {
    statsMsg += "Date: " + r.date +
      ", Weight: " + (r.weight||'-') + "kg" +
      ", Fat: " + (r.fat_percentage||'-') + "%" +
      ", Muscle: " + (r.muscle_percentage||'-') + "%" +
      ", Visceral Fat: " + (r.visceral_fat||'-') +
      ", Subcutaneous Fat: " + (r.subcutaneous_fat_percentage||'-') + "%" +
      ", BMR: " + (r.bmr||'-') +
      ", BMI: " + (r.bmi||'-') +
      ", Body Age: " + (r.body_age||'-') + "\n";
  });

  try {
    var aiText = await callGroq(
      "You are an expert wellness coach at a nutrition wellness center in India. Analyze this customer's body composition history from their Karada body scanner readings. Explain in simple, friendly language: 1) What changed and whether it is good or bad based on their goal, 2) Why this change likely happened (diet consistency, shake timing, hydration, attendance), 3) Two specific actionable recommendations for the wellness center owner to tell this customer. Keep response under 150 words. Be encouraging but honest. Use Indian context.",
      statsMsg,
      { maxTokens: 500 }
    );
    content.innerHTML = '<strong>🤖 AI Analysis:</strong><div style="margin-top:8px">'+aiText.replace(/\n/g,'<br/>')+'</div>';
  } catch(e) {
    content.innerHTML = '<div style="color:var(--danger)">AI Error: '+e.message+'</div>';
    showToast('Body AI error: ' + e.message, 'error');
  } finally {
    delete _aiInFlight[rid];
  }
}

async function doGroqReport(cid, systemPrompt, userPrompt, title) {
  var c = D.customers.find(function(x){return x.id === cid});
  var name = c ? (c.name||'Customer') : 'Customer';

  document.getElementById('wai-title').textContent = name + ' - ' + title;
  document.getElementById('wai-content').innerHTML = '<div style="color:var(--muted)">Analyzing progress with Groq AI...</div>';
  document.getElementById('wai-wa-btn').style.display = 'none';
  openModal('weekly-ai');

  try {
    var aiText = await callGroq(systemPrompt, userPrompt, { maxTokens: 500 });
    document.getElementById('wai-content').innerHTML = aiText.replace(/\n/g, '<br/>');
    
    var waBtn = document.getElementById('wai-wa-btn');
    waBtn.style.display = 'inline-block';
    waBtn.onclick = function() {
      var phone = (c && c.contact) ? c.contact.replace(/\D/g,'') : '';
      if(phone.length === 10) phone = COUNTRY_CODE + phone; 
      var url = 'https://api.whatsapp.com/send?' + (phone ? 'phone='+phone+'&' : '') + 'text=' + encodeURIComponent(aiText);
      window.open(url, '_blank');
    };
  } catch(e) {
    document.getElementById('wai-content').innerHTML = '<div style="color:var(--danger)">Error generating report: ' + e.message + '</div>';
    showToast('AI report error: ' + e.message, 'error');
  }
}

async function generateFirstScanReport(cid) {
  var c = D.customers.find(function(x){return x.id === cid});
  var goal = c ? (c.goal||'Weight Loss') : 'Unknown';
  var name = c ? (c.name||'Customer') : 'Customer';
  var recs = D.body.filter(function(b){return b.customer_id===cid}).sort(function(a,b){return new Date(b.date)-new Date(a.date)});
  if (!recs.length) return;
  var r = recs[0];
  var prompt = "Customer: "+name+", Goal: "+goal+", Baseline scan: weight "+(r.weight||'-')+"kg, fat "+(r.fat_percentage||'-')+"%, muscle "+(r.muscle_percentage||'-')+"%, visceral "+(r.visceral_fat||'-')+", BMR "+(r.bmr||'-')+", BMI "+(r.bmi||'-')+".";
  var sys = 'You are an expert wellness coach at a nutrition wellness center. A customer just completed their FIRST EVER body scan. Analyze their baseline numbers considering their stated goal. In simple, friendly language: 1) Give a 2-sentence breakdown of what their starting numbers mean, 2) Provide 3 highly specific starting recommendations (diet, water, protein shakes) to kickstart their journey. Keep under 120 words. Be extremely motivating and welcoming.';
  doGroqReport(cid, sys, prompt, 'First Scan AI Report');
}

async function generateWeeklyReport(cid) {
  var c = D.customers.find(function(x){return x.id === cid});
  var goal = c ? (c.goal||'Weight Loss') : 'Unknown';
  var name = c ? (c.name||'Customer') : 'Customer';
  var recs = D.body.filter(function(b){return b.customer_id===cid}).sort(function(a,b){return new Date(b.date)-new Date(a.date)});
  if (recs.length < 2) { showToast('Need at least 2 records for a weekly comparison!', 'error'); return; }
  var r1 = recs[0]; var r0 = recs[1]; 
  var prompt = "Customer: "+name+", Goal: "+goal+", Last week: weight "+(r0.weight||'-')+"kg, fat "+(r0.fat_percentage||'-')+"%, muscle "+(r0.muscle_percentage||'-')+"%, visceral "+(r0.visceral_fat||'-')+", BMR "+(r0.bmr||'-')+", BMI "+(r0.bmi||'-')+". This week: weight "+(r1.weight||'-')+"kg, fat "+(r1.fat_percentage||'-')+"%, muscle "+(r1.muscle_percentage||'-')+"%, visceral "+(r1.visceral_fat||'-')+", BMR "+(r1.bmr||'-')+", BMI "+(r1.bmi||'-')+".";
  var sys = 'You are an expert wellness coach at a nutrition wellness center in India. A customer has done their weekly body scan. Compare their current week results with last week and explain in simple, friendly language: 1) What changed and whether it is good or bad based on their goal, 2) Why this change likely happened (diet, consistency, timing of shakes), 3) Two specific actionable recommendations for the wellness center owner to tell the customer. Keep the response under 150 words. Be encouraging but honest.';
  doGroqReport(cid, sys, prompt, 'Weekly Progress Report');
}

async function generateFullProgressReport(cid) {
  var c = D.customers.find(function(x){return x.id === cid});
  var goal = c ? (c.goal||'Weight Loss') : 'Unknown';
  var name = c ? (c.name||'Customer') : 'Customer';
  var recs = D.body.filter(function(b){return b.customer_id===cid}).sort(function(a,b){return new Date(b.date)-new Date(a.date)});
  if (recs.length < 3) return;
  var rFirst = recs[recs.length-1];
  var rLast = recs[0];
  var prompt = "Customer: "+name+", Goal: "+goal+", Total Scans: "+recs.length+", First scan ("+rFirst.date+"): weight "+(rFirst.weight||'-')+"kg, fat "+(rFirst.fat_percentage||'-')+"%. Latest scan ("+rLast.date+"): weight "+(rLast.weight||'-')+"kg, fat "+(rLast.fat_percentage||'-')+"%, muscle "+(rLast.muscle_percentage||'-')+"%, visceral "+(rLast.visceral_fat||'-')+".";
  var sys = 'You are an expert wellness coach at a nutrition wellness center. A customer has completed multiple body scans over time. Analyze their full journey from their first scan to their latest scan. 1) Summarize their total overall transformation based on their goal. 2) Praise their consistency and highlight the biggest win. 3) Give 1 strong piece of advice to push them to the next level. Keep under 150 words. Be deeply inspiring and celebratory.';
  doGroqReport(cid, sys, prompt, 'Full Journey Summary');
}



// ── RENDER OVERVIEW ──
// ── BODY COMPOSITION TREND ALERTS ──
function computeBodyAlerts() {
  var alerts = [];
  var todayMs = new Date().setHours(0,0,0,0);
  var _custs = filterByCenter(D.customers);
  _custs.forEach(function(c) {
    var st = getDaysLeft(c);
    var recs = (D.body||[]).filter(function(b){ return b.customer_id === c.id && b.weight; })
                           .sort(function(a,b){ return new Date(b.date) - new Date(a.date); });
    // No body scan in 21+ days for active customers
    if (st.active) {
      if (!recs.length) {
        alerts.push({ cid:c.id, name:c.name, contact:c.contact, type:'no-scan', sev:'warn',
          msg:'No body scan recorded yet' });
      } else {
        var daysSince = Math.floor((todayMs - new Date(recs[0].date)) / 86400000);
        if (daysSince > 21) {
          alerts.push({ cid:c.id, name:c.name, contact:c.contact, type:'overdue', sev:'warn',
            msg:'No scan in ' + daysSince + ' days (last: ' + recs[0].date + ')' });
        }
      }
    }
    // Last 2 scans — weight gain or fat% spike within 14 days
    if (recs.length >= 2) {
      var latest = recs[0], prev = recs[1];
      var span = Math.floor((new Date(latest.date) - new Date(prev.date)) / 86400000);
      if (span > 0 && span <= 14) {
        var wGain = Number(latest.weight) - Number(prev.weight);
        var fGain = Number(latest.fat_percentage || 0) - Number(prev.fat_percentage || 0);
        if (wGain > 2) {
          alerts.push({ cid:c.id, name:c.name, contact:c.contact, type:'weight', sev:'critical',
            msg:'⚖️ Weight +' + wGain.toFixed(1) + 'kg in ' + span + ' days (' + prev.weight + '→' + latest.weight + 'kg)' });
        } else if (fGain >= 2) {
          alerts.push({ cid:c.id, name:c.name, contact:c.contact, type:'fat', sev:'critical',
            msg:'🍔 Fat% +' + fGain.toFixed(1) + 'pp in ' + span + ' days (' + prev.fat_percentage + '→' + latest.fat_percentage + '%)' });
        }
      }
    }
  });
  // Critical alerts first, then warnings
  return alerts.sort(function(a,b){ return (a.sev==='critical'?0:1)-(b.sev==='critical'?0:1); });
}

function getCustomerHealthRankings() {
  var _custs = filterByCenter(D.customers);
  var results = [];

  _custs.forEach(function(c) {
    // Get all body records for this customer, sorted by date asc
    var recs = (D.body || []).filter(function(b){ return b.customer_id === c.id; })
      .sort(function(a, b){ return (a.date||'') < (b.date||'') ? -1 : 1; });
    if (!recs.length) return;

    var latest = recs[recs.length - 1];
    var prev   = recs.length >= 2 ? recs[recs.length - 2] : null;

    var bmi       = parseFloat(latest.bmi)            || 0;
    var fatPct    = parseFloat(latest.fat_percentage)  || 0;
    var vfKg      = parseFloat(latest.visceral_fat)    || 0;
    var musclePct = parseFloat(latest.muscle_percentage)|| 0;
    var weight    = parseFloat(latest.weight)          || 0;
    var gender    = c.gender || '';

    var score = svCalcHealthScore(bmi, fatPct, vfKg, musclePct, gender, weight);
    if (score === null) return;

    // Trend vs previous scan
    var trend = 0;
    if (prev) {
      var prevScore = svCalcHealthScore(
        parseFloat(prev.bmi)||0, parseFloat(prev.fat_percentage)||0,
        parseFloat(prev.visceral_fat)||0, parseFloat(prev.muscle_percentage)||0,
        gender, parseFloat(prev.weight)||0
      );
      if (prevScore !== null) trend = score - prevScore;
    }

    results.push({
      name: c.name, contact: c.contact, id: c.id,
      score: score, trend: trend,
      date: latest.date || '',
      bmi: bmi, fatPct: fatPct, vfKg: vfKg, musclePct: musclePct
    });
  });

  // Sort lowest score first (needs attention at top)
  results.sort(function(a, b){ return a.score - b.score; });
  return results;
}

function renderOverview() {
  var todayStr = new Date().toISOString().split('T')[0];
  var today = new Date(); today.setHours(0,0,0,0);
  var currentMonth = todayStr.substring(0,7);

  // ── Filter by active center ──
  var _custs = filterByCenter(D.customers);
  var _att = filterByCenterViaCustomer(D.attendance);
  var _fin = ACTIVE_CENTER ? filterFinanceByCenter(D.finance) : D.finance;

  // ── Compute customer stats ──
  var activeCusts=0, expCusts=0, inactiveCusts=0, expiringCusts=[], inactiveList=[];
  _custs.forEach(function(c){
    var st = getDaysLeft(c);
    if(st.active) { activeCusts++; if(st.days<=5) expiringCusts.push({c:c,days:st.days,used:st.used,total:st.total}); }
    else expCusts++;
    if(isInactive(c.id)) { inactiveCusts++; inactiveList.push(c); }
  });
  expiringCusts.sort(function(a,b){return a.days-b.days;});

  // ── Today's check-ins ──
  var attTodayList = _att.filter(function(a){return a.date===todayStr&&a.status==='present';});
  var attToday = attTodayList.length;
  var checkedInNames = attTodayList.map(function(a){
    var cu = _custs.find(function(x){return x.id===a.customer_id;});
    return {name: cu?cu.name:(a.customer_name||'Walk-in'), time: a.check_in_time||'', id: a.customer_id};
  });

  // ── Finance ──
  var mInc=0, mExp=0;
  _fin.forEach(function(f){
    if(f.date && f.date.startsWith(currentMonth)){
      if(f.type==='income') mInc+=Number(f.amount); else mExp+=Number(f.amount);
    }
  });
  var mNet = mInc - mExp;

  // ── Walk-ins ──
  var _walkins = (D.walkins||[]).filter(function(w){ return !ACTIVE_CENTER||w.wellness_center_id===ACTIVE_CENTER; });
  var walkinsToday = _walkins.filter(function(w){return w.date===todayStr;});
  var walkinsMonth = _walkins.filter(function(w){return (w.date||'').startsWith(currentMonth);});
  var walkinRevMonth = walkinsMonth.reduce(function(s,w){return s+Number(w.amount_received||0);},0);

  // ── Inventory alerts ──
  var lowCount = 0, outCount = 0;
  if(typeof PRODUCTS_DB!=='undefined') PRODUCTS_DB.forEach(function(p){
    var s = D.currentStock && D.currentStock[p.id];
    var qty = s ? Math.max(0,s.qty) : 0;
    if(qty===0) outCount++; else if(qty<=p.threshold) lowCount++;
  });

  // ── Stock expiry alerts ──
  var in7 = new Date(today); in7.setDate(in7.getDate()+7);
  var expiryAlerts = [];
  (D.stockIn||[]).forEach(function(r){
    if(r.expiry_date){
      var exp = new Date(r.expiry_date); exp.setHours(0,0,0,0);
      if(exp<=in7) expiryAlerts.push({name:r.product_name||r.product_id, date:r.expiry_date, isExpired:exp<today});
    }
  });

  // ── 7-day attendance trend ──
  var weekData = [];
  var dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  for(var i=6;i>=0;i--){
    var d = new Date(today); d.setDate(d.getDate()-i);
    var ds = d.toISOString().split('T')[0];
    var cnt = _att.filter(function(a){return a.date===ds&&a.status==='present';}).length;
    weekData.push({day:dayNames[d.getDay()], date:ds, count:cnt, isToday:ds===todayStr});
  }
  var maxAtt = Math.max.apply(null, weekData.map(function(w){return w.count;}))||1;

  // ── Pending payments ──
  var pendingPay = (D.payments||[]).filter(function(p){
    return Math.max(0, Number(p.total_amount)-Number(p.amount_paid))>0;
  }).map(function(p){
    var cust = (D.customers||[]).find(function(c){ return c.id === p.person_id; });
    var phone = cust ? (cust.contact||'').replace(/\D/g,'') : '';
    if(phone.length===10) phone = COUNTRY_CODE+phone;
    return {name:p.person_name||'Unknown', bal:Math.max(0,Number(p.total_amount)-Number(p.amount_paid)), due:p.due_date||'', overdue:p.due_date&&p.due_date<todayStr, phone:phone, desc:p.description||'pack'};
  });

  // ══════════ RENDER ══════════

  // ── Quick Actions ──
  document.getElementById('ov-quick-actions').innerHTML =
    '<button class="ov-quick-btn" onclick="openModal(\'attendance\')">📋 Mark Attendance</button>'+
    '<button class="ov-quick-btn" onclick="openModal(\'customer\')">👤 Add Customer</button>'+
    '<button class="ov-quick-btn" onclick="openModal(\'finance\')">💰 Add Transaction</button>'+
    '<button class="ov-quick-btn" onclick="goTo(\'analytics\',document.querySelector(\'[onclick*=analytics]\'))">📊 Analytics</button>'+
    '<button class="ov-quick-btn" onclick="goTo(\'agents\',document.querySelector(\'[onclick*=agents]\'))" style="border-color:#7c3aed;color:#7c3aed">🤖 AI Agents</button>';

  // ── Stat Cards ──
  document.getElementById('overview-stats').innerHTML =
    '<div class="stat"><div class="stat-ic">👥</div><div class="stat-l">Total Customers</div><div class="stat-v">'+_custs.length+'</div></div>'+
    '<div class="stat"><div class="stat-ic">✅</div><div class="stat-l">Active Packs</div><div class="stat-v" style="color:var(--success)">'+activeCusts+'</div></div>'+
    '<div class="stat"><div class="stat-ic">⏰</div><div class="stat-l">Expiring (≤5 days)</div><div class="stat-v" style="color:'+(expiringCusts.length?'var(--accent)':'var(--success)')+'">'+expiringCusts.length+'</div></div>'+
    '<div class="stat"><div class="stat-ic">📋</div><div class="stat-l">Today\'s Check-ins</div><div class="stat-v">'+attToday+'</div></div>'+
    '<div class="stat"><div class="stat-ic">😴</div><div class="stat-l">Inactive (7d+)</div><div class="stat-v" style="color:'+(inactiveCusts?'var(--danger)':'var(--success)')+'">'+inactiveCusts+'</div></div>'+
    '<div class="stat"><div class="stat-ic">🚶</div><div class="stat-l">Walk-ins Today</div><div class="stat-v" style="color:'+(walkinsToday.length?'var(--primary)':'var(--muted)')+'">'+walkinsToday.length+'</div></div>'+
    (expiryAlerts.length?'<div class="stat" style="border-left:3px solid var(--danger);grid-column:1/-1"><div class="stat-l" style="color:var(--danger)">🚨 Stock Expiry Alerts</div><div style="margin-top:6px;font-size:13px">'+expiryAlerts.map(function(a){return '<span style="display:inline-block;margin:2px 6px 2px 0;padding:2px 8px;border-radius:12px;background:'+(a.isExpired?'var(--danger-light)':'var(--accent-light)')+';color:'+(a.isExpired?'var(--danger)':'#b07800')+'">'+a.name+' — '+a.date+(a.isExpired?' EXPIRED':'')+'</span>';}).join('')+'</div></div>':'');

  // ── Revenue Row ──
  document.getElementById('ov-revenue-row').innerHTML =
    '<div class="ov-rev-row">'+
      '<div class="ov-rev-card inc"><div class="ov-rev-lbl">Income ('+currentMonth+')</div><div class="ov-rev-val">₹'+mInc.toLocaleString('en-IN')+'</div></div>'+
      '<div class="ov-rev-card exp"><div class="ov-rev-lbl">Expenses ('+currentMonth+')</div><div class="ov-rev-val">₹'+mExp.toLocaleString('en-IN')+'</div></div>'+
      '<div class="ov-rev-card net"><div class="ov-rev-lbl">Net Profit</div><div class="ov-rev-val">'+(mNet>=0?'+':'')+' ₹'+mNet.toLocaleString('en-IN')+'</div></div>'+
    '</div>';

  // ── Customer Health Score Rankings ──
  var hsRanks = getCustomerHealthRankings();
  var chsEl = document.getElementById('ov-center-health');
  if (chsEl) {
    if (!hsRanks.length) {
      chsEl.innerHTML = '';
    } else {
      var avgScore = Math.round(hsRanks.reduce(function(s,r){ return s+r.score; }, 0) / hsRanks.length);
      var avgGradeEmoji = avgScore >= 85 ? '🌟' : avgScore >= 70 ? '💚' : avgScore >= 55 ? '🟡' : avgScore >= 40 ? '🔶' : '🔴';
      var avgGradeColor = avgScore >= 85 ? 'var(--success)' : avgScore >= 70 ? '#16a34a' : avgScore >= 55 ? '#b45309' : avgScore >= 40 ? '#c2410c' : 'var(--danger)';

      function hsGrade(s) {
        return s >= 85 ? { emoji:'🌟', lbl:'Excellent', bg:'#dcfce7', c:'#166534' }
             : s >= 70 ? { emoji:'💚', lbl:'Good',      bg:'#d1fae5', c:'#14532d' }
             : s >= 55 ? { emoji:'🟡', lbl:'Fair',      bg:'#fef9c3', c:'#854d0e' }
             : s >= 40 ? { emoji:'🔶', lbl:'Needs Work',bg:'#ffedd5', c:'#9a3412' }
             :           { emoji:'🔴', lbl:'Critical',  bg:'#fee2e2', c:'#991b1b' };
      }

      var hsHtml = '<div class="ov-card">'
        + '<div class="ov-card-h">'
        +   '<h3>🏥 Health Scores</h3>'
        +   '<div style="display:flex;align-items:center;gap:8px">'
        +     '<span style="font-size:12px;color:var(--muted)">Avg:</span>'
        +     '<span style="font-family:DM Serif Display,serif;font-size:18px;color:'+avgGradeColor+'">'+avgGradeEmoji+' '+avgScore+'</span>'
        +     '<span style="font-size:11px;color:var(--muted)">/100</span>'
        +     '<span class="ov-link" onclick="goTo(\'body\',document.querySelector(\'[onclick*=body]\'))">All scans →</span>'
        +   '</div>'
        + '</div>'
        + '<div class="ov-card-body">';

      // Sub-header row
      hsHtml += '<div style="display:grid;grid-template-columns:1fr auto auto auto;gap:8px;align-items:center;padding:0 4px 6px;border-bottom:1px solid var(--border);font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase">'
        + '<span>Customer</span><span style="text-align:center">Score</span><span style="text-align:center">Trend</span><span></span>'
        + '</div>';

      hsRanks.slice(0, 10).forEach(function(r) {
        var g = hsGrade(r.score);
        var trendHtml = r.trend === 0
          ? '<span style="color:var(--muted);font-size:12px">—</span>'
          : r.trend > 0
            ? '<span style="color:var(--success);font-size:12px;font-weight:700">▲ +'+r.trend+'</span>'
            : '<span style="color:var(--danger);font-size:12px;font-weight:700">▼ '+r.trend+'</span>';

        var metrics = [];
        if (r.bmi)       metrics.push('BMI '+r.bmi.toFixed(1));
        if (r.fatPct)    metrics.push('Fat '+r.fatPct.toFixed(1)+'%');
        if (r.musclePct) metrics.push('Muscle '+r.musclePct.toFixed(1)+'%');
        if (r.vfKg > 0)  metrics.push('VF '+r.vfKg.toFixed(1)+'kg');

        var phone = (r.contact||'').replace(/\D/g,''); if(phone.length===10) phone=COUNTRY_CODE+phone;
        var waMsg = phone ? encodeURIComponent('Hi '+r.name+'! 🏥 Your latest Health Score is *'+r.score+'/100* — '+g.emoji+' '+g.lbl+'.\n\nKey metrics: '+metrics.join(', ')+'.\n\nLet\'s continue working on your health goals! 💪 — '+getCenterName()) : '';

        hsHtml += '<div style="display:grid;grid-template-columns:1fr auto auto auto;gap:8px;align-items:center;padding:7px 4px;border-bottom:1px solid var(--border)">'
          + '<div>'
          +   '<div style="font-weight:600;font-size:13px">'+r.name+'</div>'
          +   '<div style="font-size:10px;color:var(--muted);margin-top:1px">'+(r.date||'No date')+' · '+metrics.slice(0,2).join(' · ')+'</div>'
          + '</div>'
          + '<div style="text-align:center">'
          +   '<span style="background:'+g.bg+';color:'+g.c+';font-weight:700;font-size:13px;padding:3px 10px;border-radius:20px;white-space:nowrap">'+r.score+'</span>'
          + '</div>'
          + '<div style="text-align:center;min-width:44px">'+trendHtml+'</div>'
          + '<div>'
          +   (phone ? '<a href="https://api.whatsapp.com/send?phone='+phone+'&text='+waMsg+'" target="_blank" rel="noopener" class="wa-btn" style="font-size:11px;padding:3px 8px;text-decoration:none" title="Send health score report">💬</a>' : '')
          + '</div>'
          + '</div>';
      });

      if (hsRanks.length > 10) {
        hsHtml += '<div style="text-align:center;padding:8px 0;font-size:12px;color:var(--muted)">+' + (hsRanks.length - 10) + ' more customers</div>';
      }

      hsHtml += '</div></div>';
      chsEl.innerHTML = hsHtml;
    }
  }

  // ── Left Column ──
  var leftHtml = '';

  // Today's Check-ins card
  leftHtml += '<div class="ov-card"><div class="ov-card-h"><h3>📋 Today\'s Check-ins</h3><span class="ov-count">'+attToday+'</span></div><div class="ov-card-body">';
  if(!checkedInNames.length) leftHtml += '<div class="ov-empty">No check-ins yet today</div>';
  else leftHtml += checkedInNames.map(function(c){
    return '<div class="ov-row"><div class="ov-row-info"><div class="ov-row-name">'+c.name+'</div>'+(c.time?'<div class="ov-row-sub">'+c.time+'</div>':'')+'</div><span class="badge bg" style="font-size:10px">Present</span></div>';
  }).join('');
  leftHtml += '</div></div>';

  // 7-day Attendance Trend
  leftHtml += '<div class="ov-card" style="margin-top:16px"><div class="ov-card-h"><h3>📈 7-Day Attendance</h3></div><div class="ov-card-body"><div class="ov-bars">';
  leftHtml += weekData.map(function(w){
    var h = Math.round((w.count/maxAtt)*60);
    return '<div class="ov-bar-col"><div class="ov-bar-val">'+w.count+'</div><div class="ov-bar" style="height:'+h+'px;'+(w.isToday?'background:var(--accent)':'')+'"></div><div class="ov-bar-lbl"'+(w.isToday?' style="color:var(--primary);font-weight:700"':'')+'>'+w.day+'</div></div>';
  }).join('');
  leftHtml += '</div></div></div>';

  // Pending Payments
  if(pendingPay.length){
    leftHtml += '<div class="ov-card" style="margin-top:16px"><div class="ov-card-h"><h3>💳 Pending Payments</h3><span class="ov-count">'+pendingPay.length+'</span></div><div class="ov-card-body">';
    leftHtml += pendingPay.slice(0,8).map(function(p){
      var dueLabel = p.overdue ? '<div class="ov-row-sub" style="color:var(--danger)">⚠️ Overdue — due '+p.due+'</div>' : '<div class="ov-row-sub">Due: '+(p.due||'No date')+'</div>';
      var waBtn = '';
      if(p.phone) {
        var waMsg = encodeURIComponent('Hi '+p.name+'! 👋\n\nThis is a friendly reminder that ₹'+p.bal.toLocaleString('en-IN')+' is pending for your '+p.desc+' at '+getCenterName()+'.'+(p.due?'\n\nDue date: '+p.due:'')+(p.overdue?'\n\n⚠️ Your payment is overdue. Please clear it at your earliest convenience.':'\n\nKindly arrange the payment at your next visit. Thank you! 🙏'));
        waBtn = '<button class="wa-btn" style="font-size:11px;padding:3px 8px;margin-left:8px" onclick="window.open(\'https://api.whatsapp.com/send?phone='+p.phone+'&text='+waMsg+'\',\'_blank\')" title="Send payment reminder">💬 Remind</button>';
      }
      return '<div class="ov-row"><div class="ov-row-info"><div class="ov-row-name">'+p.name+'</div>'+dueLabel+'</div><div class="ov-row-actions" style="display:flex;align-items:center;gap:4px"><span style="font-weight:700;color:var(--danger);font-size:14px">₹'+p.bal.toLocaleString('en-IN')+'</span>'+waBtn+'</div></div>';
    }).join('');
    if(pendingPay.length>8) leftHtml += '<div style="text-align:center;padding-top:8px"><span class="ov-link" onclick="goTo(\'payments\',document.querySelector(\'[onclick*=payments]\'))">View all '+pendingPay.length+' pending →</span></div>';
    leftHtml += '</div></div>';
  }

  document.getElementById('ov-col-left').innerHTML = leftHtml;

  // ── Right Column ──
  var rightHtml = '';

  // ── Upgrade Banner (center-owner on free plan, 30+ days old) ──
  if (isCenterSession() || (_authSession && ACTIVE_CENTER)) {
    var _bannerCenter = D.centers.find(function(c){ return c.id === ACTIVE_CENTER; });
    if (_bannerCenter && (!_bannerCenter.plan_type || _bannerCenter.plan_type === 'free')) {
      var _daysOld = _bannerCenter.created_at ? Math.floor((Date.now() - new Date(_bannerCenter.created_at).getTime()) / 86400000) : 0;
      if (_daysOld >= 30) {
        var _upgradeMsg = encodeURIComponent('Hi! I am the owner of ' + (_bannerCenter.name||'my wellness center') + ' on PulseIQ. I would like to upgrade to the Growth plan (₹499/month). Please help me proceed. 🙏');
        rightHtml += '<div class="ov-card" style="margin-bottom:16px;border:2px solid #7c3aed;background:linear-gradient(135deg,#f5f3ff,#ede9fe)">'
          + '<div class="ov-card-h"><h3 style="color:#7c3aed">🚀 Upgrade to Growth</h3></div>'
          + '<div class="ov-card-body">'
          + '<div style="font-size:13px;color:#4c1d95;margin-bottom:6px;font-weight:600">You\'ve been on the Free plan for ' + _daysOld + ' days!</div>'
          + '<div style="font-size:12px;color:#6b7280;margin-bottom:12px;line-height:1.6">Unlock AI insights, advanced analytics, multi-center reports, and priority support.</div>'
          + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">'
          + '<div><div style="font-size:22px;font-weight:800;color:#7c3aed">₹499<span style="font-size:13px;font-weight:400">/month</span></div><div style="font-size:11px;color:var(--muted)">Growth Plan</div></div>'
          + '<div style="font-size:11px;color:#6b7280;line-height:1.8">✅ AI Agents<br>✅ Advanced Analytics<br>✅ Priority Support</div>'
          + '</div>'
          + '<a href="https://wa.me/917981614593?text=' + _upgradeMsg + '" target="_blank" class="btn-p" style="width:100%;font-size:13px;padding:10px;background:#7c3aed;border-color:#7c3aed;display:block;text-align:center;text-decoration:none;box-sizing:border-box">💬 Request Upgrade via WhatsApp</a>'
          + '</div></div>';
      }
    }
  }

  // ── Invite Link Card (center-owner OTP users only) ──
  if (isCenterSession() || (_authSession && ACTIVE_CENTER)) {
    var _myCenter = D.centers.find(function(c){ return c.id === ACTIVE_CENTER; });
    if (_myCenter && _myCenter.network_id) {
      var _inviteUrl = 'https://app.pulsezen.in/register?ref=' + _myCenter.network_id;
      rightHtml += '<div class="ov-card" style="margin-bottom:16px;border-left:3px solid var(--primary);background:linear-gradient(135deg,#f0fdf4,#fff)">'
        + '<div class="ov-card-h"><h3>🔗 Your Invite Link</h3></div>'
        + '<div class="ov-card-body">'
        + '<div style="font-size:12px;color:var(--muted);margin-bottom:8px">Share this link with anyone who wants to open a center under yours.</div>'
        + '<div style="font-family:monospace;font-size:11px;background:var(--surface2);border-radius:6px;padding:8px 10px;word-break:break-all;color:var(--primary);margin-bottom:10px">' + _inviteUrl + '</div>'
        + '<button class="btn-p" style="width:100%;font-size:13px;padding:9px" onclick="copyInviteLink(\'' + _myCenter.network_id + '\')">📋 Copy Invite Link</button>'
        + '</div></div>';
    }
  }

  // Packs Expiring Soon
  rightHtml += '<div class="ov-card"><div class="ov-card-h"><h3>⏰ Packs Expiring Soon</h3><span class="ov-count">'+expiringCusts.length+'</span></div><div class="ov-card-body">';
  if(!expiringCusts.length) rightHtml += '<div class="ov-empty">All packs healthy — no expiring soon!</div>';
  else rightHtml += expiringCusts.slice(0,10).map(function(e){
    var c = e.c;
    var phone = (c.contact||'').replace(/\D/g,''); if(phone.length===10) phone=COUNTRY_CODE+phone;
    var centerName = getCenterName();
    var packInfo = c.pack_type ? c.pack_type + ' pack' : 'wellness pack';
    var sessionLine = (e.used && e.total) ? ' You have completed '+e.used+' of '+e.total+' sessions.' : '';
    var urgencyLine = e.days === 0 ? 'Your pack expires *today*!' : 'Your pack expires in *'+e.days+' day'+(e.days!==1?'s':'')+'*.';
    var msg = encodeURIComponent('Hi '+c.name+'! 👋\n\n'+urgencyLine+sessionLine+'\n\nRenew your '+packInfo+' at '+centerName+' to continue your health journey without a break! 💚\n\nReply to this message to confirm your renewal.');
    var badgeClass = e.days === 0 ? 'br' : e.days <= 2 ? 'br' : 'by';
    var badgeLabel = e.days === 0 ? 'Expires Today!' : e.days+' day'+(e.days!==1?'s':'')+' left';
    return '<div class="ov-row"><div class="ov-row-info"><div class="ov-row-name">'+c.name+'</div><div class="ov-row-sub"><span class="badge '+badgeClass+'" style="font-size:10px">'+badgeLabel+'</span> &nbsp;'+(c.pack_type||'')+(e.used&&e.total?' · '+e.used+'/'+e.total+' sessions':'')+'</div></div><div class="ov-row-actions"><button class="wa-btn" style="font-size:11px;padding:3px 8px" onclick="window.open(\'https://api.whatsapp.com/send?phone='+phone+'&text='+msg+'\',\'_blank\')" title="Send renewal reminder via WhatsApp">💬 Remind</button></div></div>';
  }).join('');
  rightHtml += '</div></div>';

  // Inactive Customers
  rightHtml += '<div class="ov-card" style="margin-top:16px"><div class="ov-card-h"><h3>😴 Inactive Customers</h3><span class="ov-count">'+inactiveList.length+'</span></div><div class="ov-card-body">';
  if(!inactiveList.length) rightHtml += '<div class="ov-empty">Everyone is active — great job!</div>';
  else rightHtml += inactiveList.slice(0,10).map(function(c){
    var phone = (c.contact||'').replace(/\D/g,''); if(phone.length===10) phone=COUNTRY_CODE+phone;
    var msg = encodeURIComponent('Hi '+c.name+'! We miss you at the wellness center. Come back and let\'s continue your health journey together! 🌿💚');
    // find last attendance date
    var lastAtt = '';
    D.attendance.forEach(function(a){if(a.customer_id===c.id&&a.status==='present'&&a.date>lastAtt) lastAtt=a.date;});
    return '<div class="ov-row"><div class="ov-row-info"><div class="ov-row-name">'+c.name+'</div><div class="ov-row-sub">'+(lastAtt?'Last seen: '+lastAtt:'Never attended')+'</div></div><div class="ov-row-actions"><button class="wa-btn" style="font-size:11px;padding:3px 8px" onclick="window.open(\'https://api.whatsapp.com/send?phone='+phone+'&text='+msg+'\',\'_blank\')" title="Follow up via WhatsApp">💬</button></div></div>';
  }).join('');
  if(inactiveList.length>10) rightHtml += '<div style="text-align:center;padding-top:8px"><span class="ov-link" onclick="goTo(\'customers\',document.querySelector(\'[onclick*=customers]\'))">View all '+inactiveList.length+' inactive →</span></div>';
  rightHtml += '</div></div>';

  // ── Churn Risk ──
  if (isCenterSession() && !isElitePlan()) {
    rightHtml += '<div class="ov-card" style="margin-top:16px;border-left:3px solid var(--border)">'
      +'<div class="ov-card-h"><h3>⚠️ Churn Risk</h3><span class="ov-count" style="background:var(--border);color:var(--muted)">🔒</span></div>'
      +'<div class="ov-card-body" style="text-align:center;padding:20px 10px">'
        +'<div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:6px">AI Churn Risk Alerts</div>'
        +'<div style="font-size:11px;color:var(--muted);margin-bottom:12px;line-height:1.4">Elite plan monitors attendance trends to predict and prevent customer churn.</div>'
        +'<a href="https://wa.me/917981614593?text='+encodeURIComponent('Hi! I would like to upgrade to the Elite plan (₹999/month) to unlock AI Churn Risk Alerts. Please help me proceed. 🙏')+'" target="_blank" class="btn-p" style="font-size:11px;padding:6px 14px;background:#b45309;border-color:#b45309;text-decoration:none;display:inline-block">Upgrade to Elite</a>'
      +'</div></div>';
  } else {
    var riskList = _custs.map(function(c){ return { c:c, r:getChurnRisk(c.id) }; })
      .filter(function(x){ return x.r.level !== 'healthy'; })
      .sort(function(a,b){ return b.r.score - a.r.score; });
    var critCount = riskList.filter(function(x){ return x.r.level==='critical'; }).length;
    var atRiskCount = riskList.filter(function(x){ return x.r.level==='at-risk'; }).length;
    rightHtml += '<div class="ov-card" style="margin-top:16px;border-left:3px solid '+(critCount?'var(--danger)':'var(--accent)')+'"><div class="ov-card-h"><h3>⚠️ Churn Risk</h3><span class="ov-count" style="background:'+(critCount?'#fee2e2':'#fef9c3')+';color:'+(critCount?'#b91c1c':'#854d0e')+'">'+riskList.length+'</span></div><div class="ov-card-body">';
    if(!riskList.length) { rightHtml += '<div class="ov-empty">All active customers are engaged!</div>'; }
    else {
      if(critCount||atRiskCount) rightHtml += '<div style="display:flex;gap:12px;margin-bottom:10px;font-size:12px">'+(critCount?'<span style="background:#fee2e2;color:#b91c1c;padding:3px 10px;border-radius:20px;font-weight:700">🔴 '+critCount+' Critical</span>':'')+(atRiskCount?'<span style="background:#fef9c3;color:#854d0e;padding:3px 10px;border-radius:20px;font-weight:700">🟡 '+atRiskCount+' At Risk</span>':'')+'</div>';
      rightHtml += riskList.slice(0,8).map(function(x){
        var phone = (x.c.contact||'').replace(/\D/g,''); if(phone.length===10) phone=COUNTRY_CODE+phone;
        var msg = encodeURIComponent('Hi '+x.c.name+'! We noticed you haven\'t visited us recently. Your health journey matters — come back and let\'s pick up where we left off! 💪');
        return '<div class="ov-row"><div class="ov-row-info">'
          +'<div class="ov-row-name">'+x.c.name+'</div>'
          +'<div class="ov-row-sub">'+x.r.reasons.join(' · ')+'</div>'
          +'</div><div class="ov-row-actions">'
          +(phone?'<button class="wa-btn" style="font-size:11px;padding:3px 8px" onclick="window.open(\'https://api.whatsapp.com/send?phone='+phone+'&text='+msg+'\',\'_blank\')">💬</button>':'')
          +'</div></div>';
      }).join('');
      if(riskList.length>8) rightHtml += '<div style="text-align:center;padding-top:8px"><span class="ov-link" onclick="goTo(\'customers\',document.querySelector(\'[onclick*=customers]\'))">View all '+riskList.length+' at-risk →</span></div>';
    }
    rightHtml += '</div></div>';
  }

  // Coaches Summary
  var _coaches = filterByCenter(D.coaches);
  var activeCoaches = _coaches.filter(function(c){return (c.status||'Active')==='Active';}).length;
  rightHtml += '<div class="ov-card" style="margin-top:16px"><div class="ov-card-h"><h3>👨‍🏫 Team</h3></div><div class="ov-card-body">';
  rightHtml += '<div style="display:flex;gap:16px;text-align:center">';
  rightHtml += '<div style="flex:1"><div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase">Coaches</div><div style="font-family:DM Serif Display,serif;font-size:24px;color:var(--primary);margin-top:4px">'+_coaches.length+'</div></div>';
  rightHtml += '<div style="flex:1"><div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase">Active</div><div style="font-family:DM Serif Display,serif;font-size:24px;color:var(--success);margin-top:4px">'+activeCoaches+'</div></div>';
  rightHtml += '<div style="flex:1"><div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase">Centers</div><div style="font-family:DM Serif Display,serif;font-size:24px;color:var(--primary);margin-top:4px">'+D.centers.length+'</div></div>';
  rightHtml += '</div></div></div>';

  // ── Walk-ins Card ──
  var OUT_ICON = {checkup:'🔬',trial:'📦',product_sale:'🛒',other:'📝'};
  rightHtml += '<div class="ov-card" style="margin-top:16px"><div class="ov-card-h"><h3>🚶 Walk-ins</h3>'
    +'<span class="ov-link" onclick="goTo(\'walkins\',document.querySelector(\'[onclick*=walkins]\'))">View all →</span></div>'
    +'<div class="ov-card-body">';
  // Month summary row
  rightHtml += '<div style="display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap">'
    +'<div style="flex:1;text-align:center;background:var(--surface2);border-radius:8px;padding:8px 4px"><div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase">This Month</div><div style="font-family:DM Serif Display,serif;font-size:22px;color:var(--primary)">'+walkinsMonth.length+'</div></div>'
    +'<div style="flex:1;text-align:center;background:var(--surface2);border-radius:8px;padding:8px 4px"><div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase">Converted</div><div style="font-family:DM Serif Display,serif;font-size:22px;color:var(--success)">'+walkinsMonth.filter(function(w){return w.converted;}).length+'</div></div>'
    +(walkinRevMonth>0?'<div style="flex:1;text-align:center;background:#f0fdf4;border-radius:8px;padding:8px 4px"><div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase">Revenue</div><div style="font-family:DM Serif Display,serif;font-size:18px;color:var(--success)">₹'+walkinRevMonth.toLocaleString('en-IN')+'</div></div>':'')
    +'</div>';
  // Today's walk-ins list
  if(!walkinsToday.length){
    rightHtml += '<div class="ov-empty">No walk-ins today yet</div>';
  } else {
    rightHtml += '<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:6px">Today</div>';
    rightHtml += walkinsToday.map(function(w){
      var outIcon = OUT_ICON[w.outcome]||'📝';
      var outColor = w.outcome==='product_sale'?'var(--success)':w.outcome==='trial'?'#b07800':'#1d4ed8';
      var amt = w.amount_received>0?'<span style="font-weight:700;color:var(--success);font-size:13px">₹'+Number(w.amount_received).toLocaleString('en-IN')+'</span>':'<span style="font-size:11px;color:var(--success)">Free</span>';
      return '<div class="ov-row"><div class="ov-row-info">'
        +'<div class="ov-row-name">'+w.name+(w.converted?'<span class="badge bg" style="font-size:9px;margin-left:6px">✅</span>':'')+'</div>'
        +'<div class="ov-row-sub"><span style="color:'+outColor+'">'+outIcon+' '+(w.outcome||'—').replace('_',' ')+'</span>'+(w.pincode?' · 📍'+w.pincode:'')+'</div>'
        +'</div>'+amt+'</div>';
    }).join('');
  }
  // Add walk-in quick button
  rightHtml += '<div style="margin-top:10px"><button class="btn-p" style="width:100%;font-size:13px;padding:9px" onclick="openWalkinModal()">+ Add Walk-in</button></div>';
  rightHtml += '</div></div>';

  // ── Monthly Goals Mini Card ──
  var goals = (getGoals()[currentMonth]) || {};
  if(goals.newMembers || goals.revenue || goals.attendance || goals.leads) {
    var newMembers  = _custs.filter(function(c){ return (c.created_at||'').startsWith(currentMonth)||(c.join_date||'').startsWith(currentMonth); }).length;
    var monthAttTotal2 = _att.filter(function(a){ return a.date&&a.date.startsWith(currentMonth)&&a.status==='present'; }).length;
    var avgDailyAtt2 = Math.round(monthAttTotal2 / Math.max(new Date().getDate(), 1));
    var monthRevenue2 = _fin.filter(function(f){ return f.type==='income'&&(f.date||'').startsWith(currentMonth); }).reduce(function(s,f){return s+Number(f.amount||0);},0);
    var leadsConv2 = (D.leads||[]).filter(function(l){ return l.status==='Joined'&&(l.created_at||'').startsWith(currentMonth); }).length;
    function miniGoalRow(label, actual, target, unit) {
      if(!target) return '';
      var pct = Math.min(Math.round((actual/target)*100), 100);
      var barColor = pct>=100?'var(--success)':pct>=60?'var(--accent)':'var(--danger)';
      return '<div style="margin-bottom:10px">'+
        '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">'+
          '<span style="color:var(--muted)">'+label+'</span>'+
          '<span style="font-weight:700;color:'+(pct>=100?'var(--success)':'var(--text)')+'">'+
            (unit||'')+actual.toLocaleString('en-IN')+' / '+(unit||'')+target.toLocaleString('en-IN')+
            (pct>=100?' ✅':' ('+pct+'%)')+
          '</span>'+
        '</div>'+
        '<div style="background:var(--surface2);border-radius:20px;height:6px;overflow:hidden">'+
          '<div style="height:100%;border-radius:20px;width:'+pct+'%;background:'+barColor+';transition:width .6s ease"></div>'+
        '</div>'+
      '</div>';
    }
    rightHtml += '<div class="ov-card" style="margin-top:16px"><div class="ov-card-h"><h3>🎯 Monthly Goals</h3>'+
      '<span class="ov-link" onclick="goTo(\'goals\',document.querySelector(\'[onclick*=goals]\'))">Edit →</span>'+
      '</div><div class="ov-card-body">'+
      miniGoalRow('New Members', newMembers, goals.newMembers||0, '')+
      miniGoalRow('Revenue', monthRevenue2, goals.revenue||0, '₹')+
      miniGoalRow('Avg Daily Att.', avgDailyAtt2, goals.attendance||0, '')+
      miniGoalRow('Leads Converted', leadsConv2, goals.leads||0, '')+
      '</div></div>';
  }

  var bodyAlerts = computeBodyAlerts();
  if (bodyAlerts.length) {
    rightHtml += '<div class="ov-card" style="margin-top:16px;border-left:3px solid var(--danger)">';
    rightHtml += '<div class="ov-card-h"><h3>🔬 Body Trend Alerts</h3><span class="ov-count" style="background:#fee2e2;color:#b91c1c">'+bodyAlerts.length+'</span></div>';
    rightHtml += '<div class="ov-card-body">';
    rightHtml += bodyAlerts.slice(0,8).map(function(a){
      var phone = (a.contact||'').replace(/\D/g,''); if(phone.length===10) phone=COUNTRY_CODE+phone;
      var waMsg = encodeURIComponent('Hi '+a.name+'! We noticed: '+a.msg+'. Let\'s check in. \uD83D\uDC9A \u2014 '+getCenterName());
      return '<div class="ov-row"><div class="ov-row-info"><div class="ov-row-name">'+a.name+'</div><div class="ov-row-sub">'+a.msg+'</div></div>'
        +(phone?'<div class="ov-row-actions"><button class="wa-btn" style="font-size:11px;padding:3px 8px" onclick="window.open(\'https://api.whatsapp.com/send?phone='+phone+'&text='+waMsg+'\',\'_blank\')">💬</button></div>':'')
        +'</div>';
    }).join('');
    rightHtml += '</div></div>';
  }

  // ── Inventory Alert Card ──
  if (outCount > 0 || lowCount > 0 || expiryAlerts.length > 0) {
    var invAlertItems = [];
    if (typeof PRODUCTS_DB !== 'undefined') PRODUCTS_DB.forEach(function(p) {
      var s = D.currentStock && D.currentStock[p.id];
      var qty = s ? Math.max(0, s.qty) : 0;
      if (qty === 0) invAlertItems.push({ name: p.name, qty: qty, status: 'out' });
      else if (qty <= p.threshold) invAlertItems.push({ name: p.name, qty: qty, unit: s.unit||'', threshold: p.threshold, status: 'low' });
    });
    expiryAlerts.forEach(function(e) {
      invAlertItems.push({ name: e.name, date: e.date, status: e.isExpired ? 'expired' : 'expiring' });
    });
    rightHtml += '<div class="ov-card" style="margin-top:16px;border-left:3px solid '+(outCount?'var(--danger)':'var(--accent)') + '">'
      + '<div class="ov-card-h"><h3>📦 Inventory Alerts</h3>'
      + '<span class="ov-count" style="background:'+(outCount?'#fee2e2':'#fef9c3')+';color:'+(outCount?'#b91c1c':'#854d0e')+'">'+(outCount+lowCount+expiryAlerts.length)+'</span></div>'
      + '<div class="ov-card-body">';
    if (outCount || lowCount) {
      rightHtml += '<div style="display:flex;gap:10px;margin-bottom:10px;font-size:12px">'
        + (outCount ? '<span style="background:#fee2e2;color:#b91c1c;padding:3px 10px;border-radius:20px;font-weight:700">🔴 ' + outCount + ' Out of Stock</span>' : '')
        + (lowCount ? '<span style="background:#fef9c3;color:#854d0e;padding:3px 10px;border-radius:20px;font-weight:700">🟡 ' + lowCount + ' Low Stock</span>' : '')
        + '</div>';
    }
    rightHtml += invAlertItems.slice(0, 8).map(function(item) {
      if (item.status === 'out') return '<div class="ov-row"><div class="ov-row-info"><div class="ov-row-name">' + item.name + '</div><div class="ov-row-sub" style="color:var(--danger)">Out of stock — reorder needed</div></div><span class="badge br" style="font-size:10px">0</span></div>';
      if (item.status === 'low') return '<div class="ov-row"><div class="ov-row-info"><div class="ov-row-name">' + item.name + '</div><div class="ov-row-sub" style="color:#854d0e">Low — ' + item.qty + ' ' + item.unit + ' left (min ' + item.threshold + ')</div></div><span class="badge by" style="font-size:10px">' + item.qty + '</span></div>';
      if (item.status === 'expired') return '<div class="ov-row"><div class="ov-row-info"><div class="ov-row-name">' + item.name + '</div><div class="ov-row-sub" style="color:var(--danger)">Expired on ' + item.date + '</div></div><span class="badge br" style="font-size:10px">Expired</span></div>';
      return '<div class="ov-row"><div class="ov-row-info"><div class="ov-row-name">' + item.name + '</div><div class="ov-row-sub" style="color:#854d0e">Expires ' + item.date + '</div></div><span class="badge by" style="font-size:10px">Soon</span></div>';
    }).join('');
    if (invAlertItems.length > 8) rightHtml += '<div style="text-align:center;padding-top:8px"><span class="ov-link" onclick="goTo(\'inventory\',document.querySelector(\'[onclick*=inventory]\'))">View all ' + invAlertItems.length + ' alerts →</span></div>';
    rightHtml += '<div style="margin-top:10px"><button class="btn-p" style="width:100%;font-size:13px;padding:9px;background:var(--accent);border-color:var(--accent);color:#333" onclick="goTo(\'inventory\',document.querySelector(\'[onclick*=inventory]\'))">📦 Go to Inventory</button></div>';
    rightHtml += '</div></div>';
  }

  // ── Churn Prediction Alert Card ──
  var churnCritical = [], churnAtRisk = [];
  (ACTIVE_CENTER ? filterByCenter(D.customers) : D.customers).forEach(function(c) {
    var risk = getChurnRisk(c.id);
    if (risk.level === 'critical') churnCritical.push({ c: c, risk: risk });
    else if (risk.level === 'at-risk') churnAtRisk.push({ c: c, risk: risk });
  });
  var churnAll = churnCritical.concat(churnAtRisk);
  if (churnAll.length) {
    rightHtml += '<div class="ov-card" style="margin-top:16px;border-left:3px solid var(--danger)">'
      + '<div class="ov-card-h"><h3>⚠️ Churn Alerts</h3>'
      + '<div style="display:flex;gap:6px">'
      + (churnCritical.length ? '<span class="ov-count" style="background:#fee2e2;color:#b91c1c">🔴 '+churnCritical.length+' Critical</span>' : '')
      + (churnAtRisk.length  ? '<span class="ov-count" style="background:#fef9c3;color:#854d0e">🟡 '+churnAtRisk.length+' At Risk</span>' : '')
      + '</div></div>'
      + '<div class="ov-card-body">'
      + churnAll.slice(0, 6).map(function(entry) {
          var c = entry.c, risk = entry.risk;
          var phone = (c.contact||'').replace(/\D/g,''); if(phone.length===10) phone=COUNTRY_CODE+phone;
          var st = getDaysLeft(c);
          var waMsg = encodeURIComponent('Hi '+c.name+'! 🙏 We noticed you haven\'t visited us recently. Your health journey matters to us — please come in this week, we miss you! 💚 — '+getCenterName());
          return '<div class="ov-row">'
            + '<div class="ov-row-info">'
            +   '<div class="ov-row-name">'+c.name+' <span style="font-size:9px;font-weight:700;padding:1px 5px;border-radius:8px;'+(risk.level==='critical'?'background:#fee2e2;color:#b91c1c':'background:#fef9c3;color:#854d0e')+'">'+risk.label+'</span></div>'
            +   '<div class="ov-row-sub">'+risk.reasons.slice(0,2).join(' · ')+(st.days>0?' · '+st.days+' days left':'')+'</div>'
            + '</div>'
            + (phone ? '<a href="https://api.whatsapp.com/send?phone='+phone+'&text='+waMsg+'" target="_blank" rel="noopener" class="wa-btn" style="font-size:11px;padding:3px 8px;text-decoration:none">💬</a>' : '')
            + '</div>';
        }).join('')
      + (churnAll.length > 6 ? '<div style="text-align:center;padding-top:8px;font-size:12px;color:var(--muted)">+' + (churnAll.length-6) + ' more at risk</div>' : '')
      + '<div style="margin-top:10px"><button class="btn-p" style="width:100%;font-size:13px;padding:9px;background:var(--danger);border:none" onclick="goTo(\'customers\',document.querySelector(\'[onclick*=customers]\'))">View All Customers →</button></div>'
      + '</div></div>';
  }

  // ── Milestone Dashboard Card ──
  var custs = ACTIVE_CENTER ? filterByCenter(D.customers) : D.customers;
  var msEntries = custs.map(function(c){
    var ms = getMilestones(c.id);
    return ms.length ? { name: c.name, id: c.id, contact: c.contact, badges: ms } : null;
  }).filter(Boolean);
  if (msEntries.length) {
    rightHtml += '<div class="ov-card" style="margin-top:16px;border-left:3px solid #f59e0b">'
      + '<div class="ov-card-h"><h3>🏆 Milestone Badges</h3><span class="ov-count" style="background:#fef3c7;color:#92400e">'+msEntries.length+'</span></div>'
      + '<div class="ov-card-body">'
      + msEntries.slice(0,5).map(function(e){
          var topBadge = e.badges[e.badges.length-1];
          var phone = (e.contact||'').replace(/\D/g,''); if(phone.length===10) phone=COUNTRY_CODE+phone;
          return '<div class="ov-row">'
            + '<div class="ov-row-info">'
            +   '<div class="ov-row-name">'+e.name+'</div>'
            +   '<div class="ov-row-sub">'+e.badges.slice(-3).map(function(b){return b.icon+' '+b.label;}).join(' · ')+'</div>'
            + '</div>'
            + (phone?'<a href="https://api.whatsapp.com/send?phone='+phone+'&text='+encodeURIComponent('🏆 Congratulations '+e.name+'! You\'ve earned: '+e.badges.slice(-3).map(function(b){return b.icon+' '+b.label;}).join(', ')+'. Keep it up! 💪 — '+getCenterName())+'" target="_blank" rel="noopener" class="wa-btn" style="font-size:11px;padding:3px 8px;text-decoration:none">💬</a>':'')
            + '</div>';
        }).join('')
      + (msEntries.length>5?'<div style="text-align:center;padding-top:8px;font-size:12px;color:var(--muted)">+' + (msEntries.length-5) + ' more with badges</div>':'')
      + '</div></div>';
  }

  document.getElementById('ov-col-right').innerHTML = rightHtml;

  // ── Pin Progress Mini Widget ──
  var pinWidget = document.getElementById('ov-pin-widget');
  if(pinWidget) {
    var curPin = (OWNER_PROFILE&&OWNER_PROFILE.current_pin) || 'Associate';
    var tgtPin = (OWNER_PROFILE&&OWNER_PROFILE.next_pin) || PIN_NEXT[curPin] || 'Supervisor';
    var pinReq = PIN_REQUIREMENTS[tgtPin];
    if(pinReq) {
      var pVP = getPersonalVP(currentMonth);
      var oVP = getOrgVP(currentMonth);
      var pPct = pinReq.personalVP>0 ? Math.min(100,Math.round((pVP/pinReq.personalVP)*100)) : 100;
      var oPct = pinReq.orgVP>0 ? Math.min(100,Math.round((oVP/pinReq.orgVP)*100)) : 100;
      var pColor = pPct>=100?'var(--success)':pPct>=60?'var(--accent)':'var(--danger)';
      var oColor = oPct>=100?'var(--success)':oPct>=60?'var(--accent)':'var(--danger)';
      pinWidget.innerHTML = '<div class="tcard" style="padding:18px;border-left:4px solid var(--accent)">'
        +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'
        +'<div><div style="font-size:11px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.4px">Pin Journey</div>'
        +'<div style="font-size:15px;font-weight:700;margin-top:2px">'+curPin+' <span style="color:var(--muted);font-weight:400;font-size:13px">→</span> <span style="color:var(--accent)">'+tgtPin+'</span></div></div>'
        +'<span class="ov-link" onclick="goTo(\'pintracker\',document.querySelector(\'[onclick*=pintracker]\'))">Full report →</span>'
        +'</div>'
        +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
        +'<div><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span style="color:var(--muted)">Personal VP</span><span style="font-weight:700;color:'+pColor+'">'+pVP+' / '+pinReq.personalVP+'</span></div>'
        +'<div class="pin-progress" style="height:10px"><div class="pin-fill" style="width:'+pPct+'%;background:'+pColor+'"></div></div></div>'
        +(pinReq.orgVP>0?'<div><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span style="color:var(--muted)">Org VP</span><span style="font-weight:700;color:'+oColor+'">'+oVP+' / '+pinReq.orgVP+'</span></div>'
        +'<div class="pin-progress" style="height:10px"><div class="pin-fill" style="width:'+oPct+'%;background:'+oColor+'"></div></div></div>':'<div style="display:flex;align-items:center;font-size:12px;color:var(--muted)">No org VP needed for this pin</div>')
        +'</div></div>';
    } else {
      pinWidget.innerHTML = '';
    }
  }

  checkBirthdaysToday();
}

// ── RENDER COACHES ──
function renderCoaches() {
  var q = document.getElementById('coaches-search').value.toLowerCase();
  var _coaches = filterByCenter(D.coaches);
  var rows = _coaches.filter(function(c){ return (c.name||'').toLowerCase().includes(q)||(c.contact||'').toLowerCase().includes(q); });
  var tb = document.getElementById('coaches-body');
  if (!rows.length) { tb.innerHTML='<tr><td colspan="7"><div class="empty"><div class="ei">👨‍🏫</div><p>No coaches found. Add your first one!</p></div></td></tr>'; }
  else tb.innerHTML = rows.map(function(c){
    var refs = D.customers.filter(function(cust){return cust.referred_by_id===c.id;}).length;
    var st = c.status||'Active';
    var pinHtml = c.herbalife_pin ? '<span style="font-size:10px;background:#e8f4fd;color:var(--primary);padding:2px 7px;border-radius:10px;font-weight:600;display:block;margin-top:3px">'+c.herbalife_pin+'</span>' : '';
    // Check if this coach has a pack price but no payment record yet
    var hasPackPrice = c.pack_type && c.pack_price && Number(c.pack_price) > 0;
    var hasPaymentRecord = (D.payments||[]).some(function(p){return p.person_id===c.id;});
    var payBtn = (hasPackPrice && !hasPaymentRecord)
      ? '<button class="btn-p" style="font-size:11px;padding:3px 8px;background:#e8a838;border-color:#e8a838;margin-right:4px" onclick="openCoachPaymentSetup(\''+c.id+'\')">💰 Record Payment</button>'
      : '';
    var renewBtn = c.pack_type ? '<button class="btn-p" style="font-size:11px;padding:3px 8px;margin-right:4px" onclick="openRenewForCoach(\''+c.id+'\')">🔄 Renew</button>' : '';
    var promoteBtn = '<button class="btn-p" style="font-size:11px;padding:3px 8px;background:#7c3aed;border-color:#7c3aed;margin-right:4px" onclick="openPromoteModal(\''+c.id+'\')" title="Promote to Supervisor — Open New Center">🏆 Promote</button>';
    return '<tr><td><strong>'+c.name+'</strong>'+pinHtml+'</td><td>'+(c.contact||'—')+'</td><td><span class="badge '+(st==='Active'?'bg':'br')+'">'+st+'</span></td><td>'+(c.upline||'—')+'</td><td>'+refs+'</td><td>'+(c.join_date||'—')+'</td><td><div class="acts">'+promoteBtn+payBtn+renewBtn+'<button class="btn-e" onclick="editCoach(\''+c.id+'\')">Edit</button><button class="btn-d" onclick="delRecord(\'coaches\',\''+c.id+'\',\'coaches\')">Delete</button></div></td></tr>';
  }).join('');
  document.getElementById('coaches-stats').innerHTML = '<div class="stat"><div class="stat-l">Total Coaches</div><div class="stat-v">'+_coaches.length+'</div></div><div class="stat"><div class="stat-l">Active</div><div class="stat-v">'+_coaches.filter(function(c){return (c.status||'Active')==='Active';}).length+'</div></div>';
}

async function loadInventory() {
  getCredentials(); if (!getActiveSbUrl() || !getActiveSbKey()) return;
  try {
    var [sin, sout, usage, balRes] = await Promise.all([
      dbGet('inventory_stock_in','date'),
      dbGet('inventory_stock_out','date'),
      dbGet('inventory_daily_usage','date'),
      dbGet('inventory_stock_balance','product_id')
    ]);
    D.stockIn    = Array.isArray(sin)    ? sin    : [];
    D.stockOut   = Array.isArray(sout)   ? sout   : [];
    D.dailyUsage = Array.isArray(usage)  ? usage  : [];
    // Use DB balance if available (trigger-maintained), otherwise compute
    D.currentStock = {};
    PRODUCTS_DB.forEach(function(p){ D.currentStock[p.id]={qty:0,unit:p.defaultUnit}; });
    if (Array.isArray(balRes) && balRes.length > 0) {
      balRes.forEach(function(b){ if(D.currentStock[b.product_id]) D.currentStock[b.product_id].qty = Math.max(0, Number(b.quantity)||0); });
    } else {
      // Fallback: compute client-side
      D.stockIn.forEach(function(r){ if(D.currentStock[r.product_id]) D.currentStock[r.product_id].qty += Number(r.quantity)||0; });
      D.stockOut.forEach(function(r){ if(D.currentStock[r.product_id]) D.currentStock[r.product_id].qty = Math.max(0, D.currentStock[r.product_id].qty - (Number(r.quantity)||0)); });
    }
  } catch(e) { D.stockIn=[]; D.stockOut=[]; D.dailyUsage=[]; D.currentStock={}; }
  renderCurrentStock();
  renderStockInHistory();
  renderStockOutHistory();
  renderDailyUsageHistory();
}

// ── INVENTORY SUB-TABS ──
function switchInvTab(name, el) {
  ['stock','in','out','usage'].forEach(function(t){
    document.getElementById('inv-sec-'+t).style.display = t===name ? 'block' : 'none';
    document.getElementById('inv-tab-'+t).classList.toggle('active', t===name);
  });
  // Auto-init one empty batch row when opening Stock In
  if (name==='in') {
    var rows = document.getElementById('inv-batch-rows');
    if (rows && rows.children.length === 0 && !document.getElementById('inv-in-id').value) addBatchRow();
  }
}

// ── PRODUCT DATABASE ──
var PRODUCTS_DB = (function(){
  var cats = {
    "Shake Products":[
      {id:"f1-500-paan",name:"Formula 1 500g - Paan",defaultUnit:"boxes",threshold:2,gramsPerBox:500,gramsPerScoop:26},
      {id:"f1-500-vanilla",name:"Formula 1 500g - Vanilla",defaultUnit:"boxes",threshold:2,gramsPerBox:500,gramsPerScoop:26},
      {id:"f1-500-mango",name:"Formula 1 500g - Mango",defaultUnit:"boxes",threshold:2,gramsPerBox:500,gramsPerScoop:26},
      {id:"f1-500-strawberry",name:"Formula 1 500g - Strawberry",defaultUnit:"boxes",threshold:2,gramsPerBox:500,gramsPerScoop:26},
      {id:"f1-500-chocolate",name:"Formula 1 500g - Chocolate",defaultUnit:"boxes",threshold:2,gramsPerBox:500,gramsPerScoop:26},
      {id:"f1-500-kulfi",name:"Formula 1 500g - Kulfi",defaultUnit:"boxes",threshold:2,gramsPerBox:500,gramsPerScoop:26},
      {id:"f1-500-rose-kheer",name:"Formula 1 500g - Rose Kheer",defaultUnit:"boxes",threshold:2,gramsPerBox:500,gramsPerScoop:26},
      {id:"f1-500-banana-caramel",name:"Formula 1 500g - Banana Caramel",defaultUnit:"boxes",threshold:2,gramsPerBox:500,gramsPerScoop:26},
      {id:"f1-500-orange",name:"Formula 1 500g - Orange",defaultUnit:"boxes",threshold:2,gramsPerBox:500,gramsPerScoop:26},
      {id:"f1-750-kulfi",name:"Formula 1 750g - Kulfi",defaultUnit:"boxes",threshold:2,gramsPerBox:750,gramsPerScoop:26},
      {id:"f1-750-mango",name:"Formula 1 750g - Mango",defaultUnit:"boxes",threshold:2,gramsPerBox:750,gramsPerScoop:26},
      {id:"f1-750-rose-kheer",name:"Formula 1 750g - Rose Kheer",defaultUnit:"boxes",threshold:2,gramsPerBox:750,gramsPerScoop:26},
      {id:"f1-750-vanilla",name:"Formula 1 750g - Vanilla",defaultUnit:"boxes",threshold:2,gramsPerBox:750,gramsPerScoop:26},
      {id:"protein-200",name:"Protein 200g",defaultUnit:"boxes",threshold:2,gramsPerBox:200,gramsPerScoop:25},
      {id:"protein-400",name:"Protein 400g",defaultUnit:"boxes",threshold:2,gramsPerBox:400,gramsPerScoop:25},
      {id:"shakemate",name:"Shakemate",defaultUnit:"boxes",threshold:2,gramsPerBox:200,gramsPerScoop:5},
      {id:"afresh-50-peach",name:"Afresh 50g - Peach",defaultUnit:"boxes",threshold:3,gramsPerBox:50,gramsPerScoop:3},
      {id:"afresh-50-cinnamon",name:"Afresh 50g - Cinnamon",defaultUnit:"boxes",threshold:3,gramsPerBox:50,gramsPerScoop:3},
      {id:"afresh-50-elaichi",name:"Afresh 50g - Elaichi",defaultUnit:"boxes",threshold:3,gramsPerBox:50,gramsPerScoop:3},
      {id:"afresh-50-ginger",name:"Afresh 50g - Ginger",defaultUnit:"boxes",threshold:3,gramsPerBox:50,gramsPerScoop:3},
      {id:"afresh-50-lemon",name:"Afresh 50g - Lemon",defaultUnit:"boxes",threshold:3,gramsPerBox:50,gramsPerScoop:3},
      {id:"afresh-50-tulsi",name:"Afresh 50g - Tulsi",defaultUnit:"boxes",threshold:3,gramsPerBox:50,gramsPerScoop:3},
      {id:"afresh-50-kashmiri-kahwa",name:"Afresh 50g - Kashmiri Kahwa",defaultUnit:"boxes",threshold:3,gramsPerBox:50,gramsPerScoop:3}
    ],
    "Children's Health":[
      {id:"dinoshake-strawberry",name:"Dinoshake Strawberry 200g",defaultUnit:"boxes",threshold:2},
      {id:"dinoshake-chocolate",name:"Dinoshake Chocolate 200g",defaultUnit:"boxes",threshold:2}
    ],
    "Supplements":[
      {id:"softgels-omega3",name:"Softgels - Omega 3",defaultUnit:"boxes",threshold:2},
      {id:"cell-activator",name:"Cell Activator",defaultUnit:"boxes",threshold:2},
      {id:"cell-u-loss",name:"Cell-U-Loss",defaultUnit:"boxes",threshold:2},
      {id:"multivitamin",name:"Multivitamin",defaultUnit:"boxes",threshold:2},
      {id:"brain-health",name:"Brain Health",defaultUnit:"boxes",threshold:2},
      {id:"immune-health",name:"Immune Health",defaultUnit:"boxes",threshold:2},
      {id:"triphala",name:"Triphala",defaultUnit:"boxes",threshold:2},
      {id:"herbal-control",name:"Herbal Control",defaultUnit:"boxes",threshold:2},
      {id:"niteworks",name:"Niteworks",defaultUnit:"boxes",threshold:2},
      {id:"beta-heart-vanilla",name:"Beta Heart Vanilla",defaultUnit:"boxes",threshold:2},
      {id:"aloe-plus",name:"Aloe Plus",defaultUnit:"boxes",threshold:2},
      {id:"active-fiber-complex",name:"Active Fiber Complex",defaultUnit:"boxes",threshold:2},
      {id:"herbal-aloe-concentrate",name:"Herbal Aloe Concentrate",defaultUnit:"boxes",threshold:2},
      {id:"activated-fiber-90",name:"Activated Fiber 90 Tablets",defaultUnit:"boxes",threshold:2},
      {id:"simply-probiotic",name:"Simply Probiotic",defaultUnit:"boxes",threshold:2},
      {id:"joint-support",name:"Joint Support",defaultUnit:"boxes",threshold:2},
      {id:"herbalife-calcium",name:"Calcium Tablets",defaultUnit:"boxes",threshold:2},
      {id:"hn-skin-booster-30",name:"HN-Skin Booster 30 Servings",defaultUnit:"boxes",threshold:2},
      {id:"hn-skin-booster-canister",name:"HN-Skin Booster Canister 300g",defaultUnit:"boxes",threshold:2},
      {id:"womans-choice",name:"Woman's Choice",defaultUnit:"boxes",threshold:2},
      {id:"male-factor",name:"Male Factor+",defaultUnit:"boxes",threshold:2},
      {id:"ocular-defense",name:"Ocular Defense",defaultUnit:"boxes",threshold:2},
      {id:"sleep-enhance",name:"Sleep Enhance Hibiscus 30g",defaultUnit:"boxes",threshold:2},
      {id:"liftoff-watermelon",name:"LiftOff Watermelon 5g x 30",defaultUnit:"boxes",threshold:2},
      {id:"h24-hydrate",name:"H24 Hydrate",defaultUnit:"boxes",threshold:2},
      {id:"h24-rebuild",name:"H24 Rebuild Strength",defaultUnit:"boxes",threshold:2},
      {id:"tablet-box-medium",name:"Tablet Box Medium Size",defaultUnit:"boxes",threshold:5}
    ],
    "Accessories":[
      {id:"paper-cups-350ml",name:"Paper Cups 350ml (Set of 100)",defaultUnit:"sets",threshold:2},
      {id:"hln-shaker-cup",name:"HLN Improved Shaker Cup",defaultUnit:"boxes",threshold:5}
    ],
    "Outer Nutrition":[
      {id:"vritilife-facial-toner",name:"Vritilife Facial Toner",defaultUnit:"boxes",threshold:3},
      {id:"vritilife-facial-serum",name:"Vritilife Facial Serum",defaultUnit:"boxes",threshold:3},
      {id:"vritilife-moisturizer",name:"Vritilife Moisturizer",defaultUnit:"boxes",threshold:3},
      {id:"vritilife-facial-cleanser",name:"Vritilife Facial Cleanser",defaultUnit:"boxes",threshold:3}
    ]
  };
  var flat = [];
  Object.keys(cats).forEach(function(cat){ cats[cat].forEach(function(p){ flat.push(Object.assign({},p,{category:cat})); }); });
  return flat;
})();

function getProductById(pid) { return PRODUCTS_DB.find(function(p){return p.id===pid;}); }

// ── SEARCHABLE PRODUCT DROPDOWN ──
function showInvDrop(type) { filterInvDrop(type); document.getElementById('inv-'+type+'-drop').style.display='block'; }
function filterInvDrop(type) {
  var q = document.getElementById('inv-'+type+'-search').value.toLowerCase();
  var drop = document.getElementById('inv-'+type+'-drop');
  var cats = {};
  PRODUCTS_DB.forEach(function(p){
    if (!q || p.name.toLowerCase().includes(q)) {
      if (!cats[p.category]) cats[p.category] = [];
      cats[p.category].push(p);
    }
  });
  var html = '';
  Object.keys(cats).forEach(function(cat){
    html += '<div class="inv-drop-cat">'+cat+'</div>';
    cats[cat].forEach(function(p){
      html += '<div class="inv-drop-item" onclick="selectInvProduct(\''+type+'\',\''+p.id+'\',\''+p.name.replace(/'/g,"&#39;")+'\',\''+p.defaultUnit+'\')" >'+p.name+'</div>';
    });
  });
  if(!html) html = '<div style="padding:10px 12px;color:var(--muted);font-size:13px">No products found</div>';
  drop.innerHTML = html;
  drop.style.display = 'block';
}
function selectInvProduct(type, pid, pname, unit) {
  document.getElementById('inv-'+type+'-search').value = pname;
  document.getElementById('inv-'+type+'-pid').value = pid;
  document.getElementById('inv-'+type+'-drop').style.display = 'none';
  var unitEl = document.getElementById('inv-'+type+'-unit');
  if (unitEl && !unitEl.value) unitEl.value = unit;
}
document.addEventListener('click', function(e) {
  var wcWrap = document.getElementById('wc-dropdown-wrap');
  var wcMenu = document.getElementById('wc-menu');
  if (wcMenu && wcWrap && !wcWrap.contains(e.target)) wcMenu.style.display = 'none';
});
document.addEventListener('click', function(e) {
  ['in','out','usage'].forEach(function(t){
    var drop = document.getElementById('inv-'+t+'-drop');
    var inp = document.getElementById('inv-'+t+'-search');
    if (drop && inp && !drop.contains(e.target) && e.target !== inp) drop.style.display='none';
  });
});

// ── RENDER CURRENT STOCK ──
function renderCurrentStock() {
  var q = (document.getElementById('inventory-search')||{value:''}).value.toLowerCase();
  var cat = (document.getElementById('inventory-cat-filter')||{value:''}).value;
  var products = PRODUCTS_DB.filter(function(p){
    return (!cat || p.category===cat) && (!q || p.name.toLowerCase().includes(q));
  });
  products.sort(function(a,b){
    var qa = D.currentStock && D.currentStock[a.id] ? Math.max(0, D.currentStock[a.id].qty) : 0;
    var qb = D.currentStock && D.currentStock[b.id] ? Math.max(0, D.currentStock[b.id].qty) : 0;
    return qa - qb;
  });
  var totalLow=0, totalOut=0, reorderList=[];
  var html = products.map(function(p){
    var stock = (D.currentStock && D.currentStock[p.id]) ? D.currentStock[p.id] : {qty:0, unit:p.defaultUnit};
    var qty = Math.max(0, stock.qty);
    var isOut = qty <= 0;
    var isLow = !isOut && qty <= p.threshold;
    if (isOut) { totalOut++; reorderList.push({name:p.name,qty:qty,unit:stock.unit,status:'OUT'}); }
    if (isLow) { totalLow++; reorderList.push({name:p.name,qty:qty.toFixed(0),unit:stock.unit,status:'LOW'}); }
    var cls = isOut ? 'out' : (isLow ? 'low' : '');
    var badge = isOut ? '<span class="badge br">Out of Stock</span>' : (isLow ? '<span class="badge by">Low Stock</span>' : '<span class="badge bg">In Stock</span>');
    // Scoop/shakes hint (qty is now in boxes)
    var shakesHint = '';
    if (p.gramsPerScoop && p.gramsPerBox && qty > 0) {
      var gramsTotal = qty * p.gramsPerBox;
      var gramsPerShake = p.gramsPerScoop * 2; // 2 scoops per shake
      var shakesLeft = Math.floor(gramsTotal / gramsPerShake);
      shakesHint = '<div style="font-size:11px;color:var(--primary);font-weight:600;margin-top:5px">~'+shakesLeft+' shakes</div>';
    }
    return '<div class="inv-stock-card '+cls+'">'
      +'<div style="font-weight:600;font-size:13px;margin-bottom:3px">'+p.name+'</div>'
      +'<div style="font-size:10px;color:var(--muted);margin-bottom:8px">'+p.category+'</div>'
      +'<div style="font-family:\'DM Serif Display\',serif;font-size:22px;color:'+(isOut?'var(--danger)':(isLow?'#b07800':'var(--primary))'))+'">'+qty.toFixed(2)+'<span style="font-family:\'DM Sans\',sans-serif;font-size:12px;margin-left:4px">'+stock.unit+'</span></div>'
      +shakesHint
      +'<div style="margin-top:8px;display:flex;align-items:center;justify-content:space-between">'+badge
      +'<button class="btn-e" style="font-size:11px;padding:3px 8px" onclick="quickStockIn(\''+p.id+'\',\''+p.name.replace(/'/g,'&#39;')+'\',\''+p.defaultUnit+'\')">+ In</button></div>'
      +'</div>';
  }).join('');
  if(!html) html = '<div class="empty" style="grid-column:1/-1"><div class="ei">📦</div><p>No products match your search.</p></div>';
  document.getElementById('inv-stock-grid').innerHTML = html;
  // Store reorder list for WhatsApp
  window._reorderList = reorderList;
  var total = PRODUCTS_DB.length;
  document.getElementById('inventory-stats').innerHTML =
    '<div class="stat"><div class="stat-l">Total Products</div><div class="stat-v">'+total+'</div></div>'+
    '<div class="stat"><div class="stat-l">Low Stock</div><div class="stat-v" style="color:'+(totalLow>0?'var(--accent)':'var(--success)')+'">'+totalLow+'</div></div>'+
    '<div class="stat"><div class="stat-l">Out of Stock</div><div class="stat-v" style="color:'+(totalOut>0?'var(--danger)':'var(--success)')+'">'+totalOut+'</div></div>'+
    '<div class="stat" style="cursor:pointer" onclick="shareReorderWhatsApp()"><div class="stat-l">📲 Reorder List</div><div class="stat-v" style="font-size:16px;margin-top:4px;color:#25D366">'+(reorderList.length > 0 ? reorderList.length+' items' : '✅ All good')+'</div></div>';
}

// ── RENDER STOCK IN HISTORY ──
function renderStockInHistory() {
  var tb = document.getElementById('inv-in-body');
  if (!tb) return;
  if (!D.stockIn || !D.stockIn.length) { tb.innerHTML='<tr><td colspan="9"><div class="empty"><div class="ei">➕</div><p>No stock in records yet.</p></div></td></tr>'; return; }
  var sorted = D.stockIn.slice().sort(function(a,b){return new Date(b.date)-new Date(a.date);});
  tb.innerHTML = sorted.map(function(r){
    var p = getProductById(r.product_id);
    return '<tr><td>'+r.date+'</td><td><strong>'+(r.product_name||r.product_id)+'</strong></td><td style="color:var(--muted);font-size:12px">'+(p?p.category:'—')+'</td><td>'+r.quantity+'</td><td>'+(r.unit||'—')+'</td><td>'+(r.cost_price?'₹'+Number(r.cost_price).toLocaleString('en-IN'):'—')+'</td><td>'+(r.expiry_date||'—')+'</td><td>'+(r.notes||'—')+'</td><td><div class="acts"><button class="btn-e" onclick="editStockIn(\''+r.id+'\')">Edit</button><button class="btn-d" onclick="delStockIn(\''+r.id+'\')">Delete</button></div></td></tr>';
  }).join('');
}

// ── RENDER STOCK OUT HISTORY ──
function renderStockOutHistory() {
  var tb = document.getElementById('inv-out-body');
  if (!tb) return;
  if (!D.stockOut || !D.stockOut.length) { tb.innerHTML='<tr><td colspan="7"><div class="empty"><div class="ei">➖</div><p>No stock out records yet.</p></div></td></tr>'; return; }
  var sorted = D.stockOut.slice().sort(function(a,b){return new Date(b.date)-new Date(a.date);});
  tb.innerHTML = sorted.map(function(r){
    return '<tr><td>'+r.date+'</td><td><strong>'+(r.product_name||r.product_id)+'</strong></td><td>'+r.quantity+'</td><td>'+(r.unit||'—')+'</td><td>'+(r.sale_price?'₹'+Number(r.sale_price).toLocaleString('en-IN'):'—')+'</td><td>'+(r.notes||'—')+'</td><td><div class="acts"><button class="btn-e" onclick="editStockOut(\''+r.id+'\')">Edit</button><button class="btn-d" onclick="delStockOut(\''+r.id+'\')">Delete</button></div></td></tr>';
  }).join('');
}

// ── RENDER DAILY USAGE HISTORY ──
function renderDailyUsageHistory() {
  var container = document.getElementById('inv-usage-body');
  if (!container) return;
  if (!D.dailyUsage || !D.dailyUsage.length) { container.innerHTML='<div class="empty"><div class="ei">📊</div><p>No usage records yet.</p></div>'; return; }
  var sorted = D.dailyUsage.slice().sort(function(a,b){return new Date(b.date)-new Date(a.date);});
  // Group by date
  var byDate = {};
  sorted.forEach(function(r){ if(!byDate[r.date]) byDate[r.date]=[];  byDate[r.date].push(r); });
  container.innerHTML = Object.keys(byDate).sort().reverse().map(function(date){
    var items = byDate[date];
    var summaries = items.filter(function(i){return i.type==='summary';});
    var summary = summaries[0];
    var products = items.filter(function(i){return i.type==='product';});
    var html = '<div class="inv-usage-card"><div style="display:flex;justify-content:space-between;align-items:center"><strong style="font-size:14px">📅 '+date+'</strong><div style="display:flex;gap:6px">';
    if (summary) html += '<button class="btn-e" onclick="editInvSum(\''+summary.id+'\')">Edit Summary</button><button class="btn-d" onclick="delInvSum(\''+summary.id+'\')">Delete</button>';
    html += '</div></div>';
    if (summaries.length > 1) html += '<div style="color:var(--danger);font-size:11px;font-weight:600;margin-bottom:6px">⚠️ '+summaries.length+' duplicate summaries for this date — delete the incorrect one below.</div>';
    if (summary) {
      var wg = summary.weight_gain_shakes||0, wl = summary.weight_loss_shakes||0, tc = summary.total_customers||0;
      html += '<div class="inv-usage-grid"><div class="inv-usage-stat"><div class="inv-usage-stat-lbl">Weight Gain</div><div class="inv-usage-stat-val" style="color:var(--primary)">'+wg+'</div></div><div class="inv-usage-stat"><div class="inv-usage-stat-lbl">Weight Loss</div><div class="inv-usage-stat-val" style="color:var(--danger)">'+wl+'</div></div><div class="inv-usage-stat"><div class="inv-usage-stat-lbl">Total Custs</div><div class="inv-usage-stat-val" style="color:var(--success)">'+tc+'</div></div><div class="inv-usage-stat"><div class="inv-usage-stat-lbl">Total Shakes</div><div class="inv-usage-stat-val">'+(wg+wl)+'</div></div></div>';
      if (summary.notes) html += '<div style="margin-top:8px;font-size:12px;color:var(--muted)">'+summary.notes+'</div>';
    }
    // Show additional duplicate summaries with delete option
    summaries.slice(1).forEach(function(s){
      var wg2=s.weight_gain_shakes||0, wl2=s.weight_loss_shakes||0;
      html += '<div style="margin-top:6px;padding:8px 10px;background:var(--danger-light);border-radius:8px;display:flex;justify-content:space-between;align-items:center"><span style="font-size:12px;color:var(--danger)">Duplicate: WG '+wg2+' WL '+wl2+' = '+(wg2+wl2)+' shakes</span><div style="display:flex;gap:6px"><button class="btn-e" onclick="editInvSum(\''+s.id+'\')" style="font-size:11px;padding:2px 8px">Edit</button><button class="btn-d" onclick="delInvSum(\''+s.id+'\')" style="font-size:11px;padding:2px 8px">Delete</button></div></div>';
    });
    if (products.length) {
      html += '<div style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px"><div style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">Product Usage</div>';
      products.forEach(function(r){
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid var(--surface2)"><span style="font-size:13px">'+(r.product_name||r.product_id)+'</span><div style="display:flex;align-items:center;gap:8px"><span style="font-weight:600;color:var(--primary)">'+r.quantity+' '+(r.unit||'')+'</span><button class="btn-e" onclick="editInvUsage(\''+r.id+'\')" style="padding:2px 8px;font-size:11px">Edit</button><button class="btn-d" onclick="delInvUsage(\''+r.id+'\')" style="padding:2px 8px;font-size:11px">Del</button></div></div>';
      });
      html += '</div>';
    }
    html += '</div>';
    return html;
  }).join('');
}

// ── BATCH STOCK IN ──
var batchRowCount = 0;
function addBatchRow(pid, pname, unit) {
  batchRowCount++;
  var rid = 'brow-'+batchRowCount;
  var row = document.createElement('div');
  row.id = rid;
  row.style.cssText = 'display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr auto;gap:8px;align-items:end;margin-bottom:10px;padding:10px 12px;background:var(--surface2);border-radius:8px;';
  row.innerHTML = '<div style="position:relative">'
    +'<label style="display:block;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);margin-bottom:5px">Product *</label>'
    +'<input type="text" id="'+rid+'-search" value="'+(pname||'')+'" placeholder="Search product..." oninput="filterBatchDrop(\''+rid+'\')" onfocus="filterBatchDrop(\''+rid+'\')" autocomplete="off" style="width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:13px"/>'
    +'<div id="'+rid+'-drop" class="inv-drop"></div>'
    +'<input type="hidden" id="'+rid+'-pid" value="'+(pid||'')+'">'
    +'</div>'
    +'<div><label style="display:block;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);margin-bottom:5px">Qty *</label><input type="number" step="0.01" id="'+rid+'-qty" placeholder="0" style="width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:13px"/></div>'
    +'<div><label style="display:block;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);margin-bottom:5px">Unit</label><select id="'+rid+'-unit" style="width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:13px;background:var(--surface);color:var(--text)"><option value="boxes"'+(unit==='boxes'?' selected':'')+'>boxes</option><option value="pcs"'+(unit==='pcs'?' selected':'')+'>pcs</option><option value="bottles"'+(unit==='bottles'?' selected':'')+'>bottles</option><option value="sachets"'+(unit==='sachets'?' selected':'')+'>sachets</option><option value="strips"'+(unit==='strips'?' selected':'')+'>strips</option><option value="grams"'+(unit==='grams'?' selected':'')+'>grams</option><option value="kg"'+(unit==='kg'?' selected':'')+'>kg</option><option value="liters"'+(unit==='liters'?' selected':'')+'>liters</option><option value="ml"'+(unit==='ml'?' selected':'')+'>ml</option></select></div>'
    +'<div><label style="display:block;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);margin-bottom:5px">Cost (₹)</label><input type="number" step="0.01" id="'+rid+'-cost" placeholder="0" style="width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:13px"/></div>'
    +'<div><label style="display:block;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);margin-bottom:5px">Expiry</label><input type="date" id="'+rid+'-expiry" style="width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:13px"/></div>'
    +'<button onclick="document.getElementById(\''+rid+'\').remove()" style="padding:8px 10px;background:var(--danger-light);color:var(--danger);border:none;border-radius:8px;cursor:pointer;font-size:16px;margin-bottom:1px">✕</button>';
  document.getElementById('inv-batch-rows').appendChild(row);
  // Close dropdowns on outside click for this row
  document.addEventListener('click', function(e){
    var drop = document.getElementById(rid+'-drop');
    var inp = document.getElementById(rid+'-search');
    if(drop && inp && !drop.contains(e.target) && e.target!==inp) drop.style.display='none';
  });
}
function filterBatchDrop(rid) {
  var q = document.getElementById(rid+'-search').value.toLowerCase();
  var drop = document.getElementById(rid+'-drop');
  var cats = {};
  PRODUCTS_DB.forEach(function(p){
    if(!q || p.name.toLowerCase().includes(q)){
      if(!cats[p.category]) cats[p.category]=[];
      cats[p.category].push(p);
    }
  });
  var html='';
  Object.keys(cats).forEach(function(cat){
    html+='<div class="inv-drop-cat">'+cat+'</div>';
    cats[cat].forEach(function(p){
      html+='<div class="inv-drop-item" onclick="selectBatchProduct(\''+rid+'\',\''+p.id+'\',\''+p.name.replace(/'/g,'&#39;')+'\',\''+p.defaultUnit+'\')">'+p.name+'</div>';
    });
  });
  if(!html) html='<div style="padding:10px 12px;color:var(--muted);font-size:13px">No products found</div>';
  drop.innerHTML=html; drop.style.display='block';
}
function selectBatchProduct(rid,pid,pname,unit){
  document.getElementById(rid+'-search').value=pname;
  document.getElementById(rid+'-pid').value=pid;
  document.getElementById(rid+'-drop').style.display='none';
  var u=document.getElementById(rid+'-unit'); if(u&&!u.value) u.value=unit;
  document.getElementById(rid+'-qty').focus();
}

// Quick stock-in from stock card
function quickStockIn(pid, pname, unit) {
  switchInvTab('in', document.getElementById('inv-tab-in'));
  addBatchRow(pid, pname, unit);
  document.getElementById('inv-in-date').value = new Date().toISOString().split('T')[0];
  setTimeout(function(){ var r = document.getElementById('inv-batch-rows').lastChild; if(r){ var q=r.querySelector('[id$="-qty"]'); if(q) q.focus(); }}, 100);
}

async function saveStockIn() {
  getCredentials(); if (!getActiveSbUrl() || !getActiveSbKey()) { showToast('Not connected','error'); return; }
  var editId = document.getElementById('inv-in-id').value;
  var date = document.getElementById('inv-in-date').value;
  var notes = document.getElementById('inv-in-notes').value.trim()||null;
  if (!date) { showToast('Please select a date','error'); return; }
  // Collect all batch rows
  var rows = document.getElementById('inv-batch-rows').children;
  if (!editId && rows.length === 0) { showToast('Add at least one product row','error'); return; }
  var payloads = [];
  var hasError = false;
  Array.from(rows).forEach(function(row){
    var rid = row.id;
    var pid = document.getElementById(rid+'-pid').value;
    var pname = document.getElementById(rid+'-search').value.trim();
    var qty = document.getElementById(rid+'-qty').value;
    if (!pid || !qty) { showToast('Fill product and quantity for all rows','error'); hasError=true; return; }
    payloads.push({ product_id:pid, product_name:pname, quantity:Number(qty), unit:document.getElementById(rid+'-unit').value.trim()||null, date:date, notes:notes, cost_price:document.getElementById(rid+'-cost').value||null, expiry_date:document.getElementById(rid+'-expiry').value||null });
  });
  if (hasError) return;
  try {
    if (editId) {
      // Single edit mode
      var pid2 = payloads[0] ? payloads[0].product_id : null;
      if (pid2) await dbUpdate('inventory_stock_in', editId, payloads[0]);
    } else {
      await Promise.all(payloads.map(function(p){ return dbInsert('inventory_stock_in', p); }));
    }
    showToast(editId ? 'Stock In updated!' : payloads.length+' item(s) added!');
    resetInvIn(); await loadInventory();
  } catch(e) { showToast('Error: '+e.message,'error'); }
}
function resetInvIn() {
  document.getElementById('inv-in-id').value='';
  document.getElementById('inv-in-date').value=new Date().toISOString().split('T')[0];
  document.getElementById('inv-in-notes').value='';
  document.getElementById('inv-batch-rows').innerHTML='';
  batchRowCount=0;
  document.getElementById('inv-in-title').textContent='➕ Add Stock In';
  addBatchRow(); // start with one empty row
}
async function editStockIn(id) {
  var r = D.stockIn.find(function(x){return x.id===id;});
  if (!r) return;
  switchInvTab('in', document.getElementById('inv-tab-in'));
  document.getElementById('inv-in-id').value=r.id;
  document.getElementById('inv-in-date').value=r.date;
  document.getElementById('inv-in-notes').value=r.notes||'';
  document.getElementById('inv-batch-rows').innerHTML=''; batchRowCount=0;
  addBatchRow(r.product_id, r.product_name||r.product_id, r.unit||'');
  var rid='brow-'+batchRowCount;
  document.getElementById(rid+'-qty').value=r.quantity;
  document.getElementById(rid+'-cost').value=r.cost_price||'';
  document.getElementById(rid+'-expiry').value=r.expiry_date||'';
  document.getElementById('inv-in-title').textContent='✏️ Edit Stock In';
  document.getElementById('inv-in-date').scrollIntoView({behavior:'smooth',block:'center'});
}
async function delStockIn(id) {
  if (!confirm('Delete this Stock In record?')) return;
  try { await dbDelete('inventory_stock_in',id); showToast('Deleted!'); await loadInventory(); } catch(e){ showToast('Error: '+e.message,'error'); }
}

// ── P3a: WhatsApp Reorder List ──
// ── BROADCAST ──
var BC_TEMPLATES = {
  expiring3: 'Hi {name}! 👋 Your wellness pack expires in {days} day(s). Renew now to keep your streak going and stay on track with your health goals! 💪 Contact us to renew today.',
  expiring7: 'Hi {name}! 🌟 Your wellness pack expires in {days} day(s). Plan your renewal early to avoid a break — we are here to help! 🏋️',
  expired:   'Hi {name}! 😊 Your wellness pack has expired. We miss you! Come back and renew your pack to continue your health journey with us. 💚',
  inactive:  'Hi {name}! 🙏 We noticed you haven\'t visited us recently. Your health is our priority — come in anytime this week and we\'ll make it worth your while! 🌿',
  all:       'Hi {name}! 👋 Just checking in from the wellness center. Keep up the great work on your health journey! See you soon. 💪'
};
function openBroadcastModal() {
  buildBroadcastList();
  openModal('broadcast');
}
function buildBroadcastList() {
  var group = document.getElementById('bc-group').value;
  var msgTpl = document.getElementById('bc-msg');
  if (!msgTpl.value || Object.values(BC_TEMPLATES).includes(msgTpl.value)) {
    msgTpl.value = BC_TEMPLATES[group] || BC_TEMPLATES.all;
  }
  var today = new Date().toISOString().split('T')[0];
  var custs = ACTIVE_CENTER ? filterByCenter(D.customers) : D.customers;
  var targets = [];
  custs.forEach(function(c){
    var st = getDaysLeft(c);
    var days = st.days;
    if (group === 'expiring3' && st.active && days <= 3) targets.push({c:c, days:days});
    else if (group === 'expiring7' && st.active && days <= 7) targets.push({c:c, days:days});
    else if (group === 'expired' && !st.active && c.pack_start_date) targets.push({c:c, days:0});
    else if (group === 'inactive') {
      var lastAtt = D.attendance.filter(function(a){return a.customer_id===c.id;}).map(function(a){return a.date;}).sort().pop();
      var daysAgo = lastAtt ? Math.floor((new Date(today)-new Date(lastAtt))/(864e5)) : 999;
      if (daysAgo >= 7) targets.push({c:c, days:daysAgo});
    }
    else if (group === 'all' && st.active) targets.push({c:c, days:days});
  });
  window._bcTargets = targets;
  document.getElementById('bc-count').textContent = targets.length;
  var el = document.getElementById('bc-list');
  if (!targets.length) { el.innerHTML='<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px">No customers match this group.</div>'; return; }
  el.innerHTML = targets.map(function(t,i){
    var c = t.c;
    var phone = (COUNTRY_CODE||'91') + (c.contact||'').replace(/\D/g,'');
    var msg = buildBcMsg(c, t.days);
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 6px;border-bottom:1px solid var(--border)">' +
      '<div><div style="font-size:13px;font-weight:600">'+c.name+'</div><div style="font-size:11px;color:var(--muted)">'+(c.contact||'No contact')+(t.days?' — '+t.days+' day(s)':'')+'</div></div>'+
      '<a href="https://api.whatsapp.com/send?phone='+phone+'&text='+encodeURIComponent(msg)+'" target="_blank" rel="noopener" style="background:#25D366;color:#fff;padding:5px 12px;border-radius:6px;font-size:12px;font-weight:600;text-decoration:none">💬 Send</a>'+
    '</div>';
  }).join('');
}
function buildBcMsg(c, days) {
  return (document.getElementById('bc-msg').value || '')
    .replace(/\{name\}/g, c.name||'Friend')
    .replace(/\{days\}/g, days||'');
}
function sendBroadcastAll() {
  var targets = window._bcTargets || [];
  if (!targets.length) { showToast('No recipients','error'); return; }
  if (!confirm('This will open '+targets.length+' WhatsApp tabs one by one. Allow popups in your browser first.\n\nContinue?')) return;
  targets.forEach(function(t, i){
    setTimeout(function(){
      var phone = (COUNTRY_CODE||'91') + (t.c.contact||'').replace(/\D/g,'');
      var msg = buildBcMsg(t.c, t.days);
      window.open('https://api.whatsapp.com/send?phone='+phone+'&text='+encodeURIComponent(msg),'_blank');
    }, i * 800);
  });
  showToast('Opening '+targets.length+' chats...','success');
}

function shareReorderWhatsApp() {
  var list = window._reorderList || [];
  if (!list.length) { showToast('All products are well stocked! 🎉'); return; }
  var msg = '📦 *Product Reorder List — '+new Date().toLocaleDateString('en-IN')+'*\n\n';
  var out = list.filter(function(i){return i.status==='OUT';});
  var low = list.filter(function(i){return i.status==='LOW';});
  if (out.length) { msg += '🔴 *Out of Stock:*\n'; out.forEach(function(i){ msg += '• '+i.name+'\n'; }); msg+='\n'; }
  if (low.length) { msg += '🟡 *Low Stock:*\n'; low.forEach(function(i){ msg += '• '+i.name+' ('+i.qty+' '+i.unit+' left)\n'; }); }
  msg += '\nPlease arrange at the earliest 🙏';
  window.open('https://api.whatsapp.com/send?text='+encodeURIComponent(msg),'_blank');
}

// ── SAVE STOCK OUT ──
async function saveStockOut() {
  getCredentials(); if (!getActiveSbUrl() || !getActiveSbKey()) { showToast('Not connected','error'); return; }
  var id = document.getElementById('inv-out-id').value;
  var pid = document.getElementById('inv-out-pid').value;
  var pname = document.getElementById('inv-out-search').value.trim();
  var qty = document.getElementById('inv-out-qty').value;
  var date = document.getElementById('inv-out-date').value;
  if (!pid || !qty || !date) { showToast('Product, quantity and date are required','error'); return; }
  var payload = { product_id:pid, product_name:pname, quantity:Number(qty), unit:document.getElementById('inv-out-unit').value.trim()||null, date:date, notes:document.getElementById('inv-out-notes').value.trim()||null, sale_price:document.getElementById('inv-out-sale').value||null };
  try {
    if (id) await dbUpdate('inventory_stock_out',id,payload); else await dbInsert('inventory_stock_out',payload);
    showToast(id?'Stock Out updated!':'Stock Out added!'); resetInvOut(); await loadInventory();
  } catch(e) { showToast('Error: '+e.message,'error'); }
}
function resetInvOut() {
  ['inv-out-id','inv-out-pid'].forEach(function(i){document.getElementById(i).value='';});
  ['inv-out-search','inv-out-qty','inv-out-sale','inv-out-notes'].forEach(function(i){document.getElementById(i).value='';});
  document.getElementById('inv-out-unit').selectedIndex=0;
  document.getElementById('inv-out-date').value=new Date().toISOString().split('T')[0];
  document.getElementById('inv-out-title').textContent='➖ Add Stock Out';
}
async function editStockOut(id) {
  var r = D.stockOut.find(function(x){return x.id===id;});
  if (!r) return;
  document.getElementById('inv-out-id').value=r.id;
  document.getElementById('inv-out-search').value=r.product_name||r.product_id;
  document.getElementById('inv-out-pid').value=r.product_id;
  document.getElementById('inv-out-qty').value=r.quantity;
  document.getElementById('inv-out-unit').value=r.unit||'';
  document.getElementById('inv-out-date').value=r.date;
  document.getElementById('inv-out-sale').value=r.sale_price||'';
  document.getElementById('inv-out-notes').value=r.notes||'';
  document.getElementById('inv-out-title').textContent='✏️ Edit Stock Out';
  switchInvTab('out', document.getElementById('inv-tab-out'));
  document.getElementById('inv-out-search').scrollIntoView({behavior:'smooth',block:'center'});
}
async function delStockOut(id) {
  if (!confirm('Delete this Stock Out record?')) return;
  try { await dbDelete('inventory_stock_out',id); showToast('Deleted!'); await loadInventory(); } catch(e){ showToast('Error: '+e.message,'error'); }
}

// ── SAVE DAILY SUMMARY ──
async function saveDailySummary() {
  getCredentials(); if (!getActiveSbUrl() || !getActiveSbKey()) { showToast('Not connected','error'); return; }
  var id = document.getElementById('inv-sum-id').value;
  var date = document.getElementById('inv-sum-date').value;
  if (!date) { showToast('Date is required','error'); return; }
  // Prevent duplicate: if no ID set, check if a summary already exists for this date
  if (!id) {
    var existing = D.dailyUsage.find(function(r){ return r.type==='summary' && r.date===date; });
    if (existing) id = existing.id;
  }
  var wg = (Number(document.getElementById('inv-wg').value)||0) + (Number(document.getElementById('inv-wg-extra').value)||0);
  var wl = (Number(document.getElementById('inv-wl').value)||0) + (Number(document.getElementById('inv-wl-extra').value)||0);
  var custs = Number(document.getElementById('inv-custs').value)||0;
  var totalShakes = wg + wl;
  var payload = { type:'summary', date:date, weight_gain_shakes:wg, weight_loss_shakes:wl, total_customers:custs, notes:document.getElementById('inv-sum-notes').value.trim()||null };
  try {
    if (id) await dbUpdate('inventory_daily_usage',id,payload); else await dbInsert('inventory_daily_usage',payload);
    showToast('Summary saved!'); resetInvSum(); await loadInventory();
  } catch(e) { showToast('Error: '+e.message,'error'); }
}
function updateShakeTotals() {
  var wg = Number(document.getElementById('inv-wg').value)||0;
  var wl = Number(document.getElementById('inv-wl').value)||0;
  var extra = Number(document.getElementById('inv-wg-extra').value)||0;
  var total = wg + wl + extra;
  var preview = document.getElementById('inv-shake-preview');
  if (!preview) return;
  if (total === 0) { preview.innerHTML = ''; return; }
  var attDate = document.getElementById('inv-sum-date').value;
  var attPresent = 0;
  if (attDate && Array.isArray(D.attendance)) {
    attPresent = D.attendance.filter(function(a){ return a.date===attDate && a.status==='present'; })
      .reduce(function(sum,a){ return sum+(a.servings||1); }, 0);
  }
  var diff = total - attPresent;
  var msg, color;
  if (attPresent === 0) {
    msg = '📊 '+total+' shakes total';
    color = 'var(--muted)';
  } else if (diff === 0) {
    msg = '✅ '+total+' shakes — matches attendance perfectly';
    color = '#16a34a';
  } else if (diff > 0) {
    msg = '📊 '+total+' shakes — '+attPresent+' from attendance + '+diff+' extra (outside attendance)';
    color = 'var(--primary)';
  } else {
    msg = '⚠️ '+total+' shakes entered, but '+attPresent+' customers in attendance. '+Math.abs(diff)+' may be missing a shake.';
    color = 'var(--accent)';
  }
  preview.innerHTML = '<span style="color:'+color+'">'+msg+'</span>';
}
function autoFillFromAttendance(date) {
  if (!date || !Array.isArray(D.attendance) || !Array.isArray(D.customers) || !Array.isArray(D.dailyUsage)) return;
  var existingSummary = D.dailyUsage.find(function(r){ return r.type==='summary' && r.date===date; });
  if (existingSummary) {
    document.getElementById('inv-sum-id').value = existingSummary.id;
    document.getElementById('inv-wg').value = existingSummary.weight_gain_shakes||0;
    document.getElementById('inv-wl').value = existingSummary.weight_loss_shakes||0;
    document.getElementById('inv-wg-extra').value = 0;
    document.getElementById('inv-wl-extra').value = 0;
    document.getElementById('inv-custs').value = existingSummary.total_customers||0;
    document.getElementById('inv-sum-notes').value = existingSummary.notes||'';
    updateShakeTotals();
    showToast('Loaded existing summary for '+date);
    return;
  }
  // Auto-calculate from attendance for this date
  var present = D.attendance.filter(function(a){ return a.date===date && a.status==='present'; });
  if (!present.length) return;
  var wl=0, wg=0, uniqueCusts=new Set();
  present.forEach(function(a) {
    var servings = a.servings||1;
    var cust = D.customers.find(function(c){ return c.id===a.customer_id; });
    var goal = cust ? (cust.goal||'') : '';
    if (goal==='Weight Gain') wg += servings;
    else wl += servings;
    if (a.customer_id) uniqueCusts.add(a.customer_id);
  });
  document.getElementById('inv-wg').value = wg;
  document.getElementById('inv-wl').value = wl;
  document.getElementById('inv-wg-extra').value = 0;
  document.getElementById('inv-wl-extra').value = 0;
  document.getElementById('inv-custs').value = uniqueCusts.size;
  updateShakeTotals();
  showToast('Auto-filled: '+wl+' WL + '+wg+' WG = '+(wl+wg)+' shakes from attendance');
}
function resetInvSum() { resetDailyUsage(); }
async function editInvSum(id) {
  var r = D.dailyUsage.find(function(x){return x.id===id;});
  if (!r) return;
  document.getElementById('inv-sum-id').value=r.id;
  document.getElementById('inv-sum-date').value=r.date;
  document.getElementById('inv-wg').value=r.weight_gain_shakes||0;
  document.getElementById('inv-wl').value=r.weight_loss_shakes||0;
  document.getElementById('inv-custs').value=r.total_customers||0;
  document.getElementById('inv-sum-notes').value=r.notes||'';
  switchInvTab('usage', document.getElementById('inv-tab-usage'));
}
async function delInvSum(id) {
  if (!confirm('Delete this daily summary?')) return;
  try { await dbDelete('inventory_daily_usage',id); showToast('Deleted!'); await loadInventory(); } catch(e){ showToast('Error: '+e.message,'error'); }
}

// ── SAVE PRODUCT USAGE ──
async function saveProductUsage() {
  getCredentials(); if (!getActiveSbUrl() || !getActiveSbKey()) { showToast('Not connected','error'); return; }
  var id = document.getElementById('inv-usage-id').value;
  var pid = document.getElementById('inv-usage-pid').value;
  var pname = document.getElementById('inv-usage-search').value.trim();
  var qty = document.getElementById('inv-usage-qty').value;
  var date = document.getElementById('inv-usage-date').value;
  if (!pid || !qty || !date) { showToast('Product, quantity and date are required','error'); return; }
  var payload = { type:'product', product_id:pid, product_name:pname, quantity:Number(qty), unit:document.getElementById('inv-usage-unit').value.trim()||'scoops', date:date };
  try {
    if (id) await dbUpdate('inventory_daily_usage',id,payload); else await dbInsert('inventory_daily_usage',payload);
    showToast('Usage logged!'); resetInvUsage(); await loadInventory();
  } catch(e) { showToast('Error: '+e.message,'error'); }
}
function resetInvUsage() { /* handled by resetDailyUsage */ }
async function editInvUsage(id) {
  var r = D.dailyUsage.find(function(x){return x.id===id;});
  if (!r) return;
  switchInvTab('usage', document.getElementById('inv-tab-usage'));
  document.getElementById('inv-sum-date').value = r.date||'';
  addUsageRow(r.product_id||'', r.product_name||r.product_id||'', r.unit||'scoops', r.id);
  var rows = document.getElementById('inv-usage-rows');
  if (rows && rows.lastChild) {
    var lastRid = rows.lastChild.id;
    var qtyEl = document.getElementById(lastRid+'-qty');
    if (qtyEl) qtyEl.value = r.quantity||'';
  }
  showToast('Loaded for editing — update and click Save Everything');
}
async function delInvUsage(id) {
  if (!confirm('Delete this usage record?')) return;
  try { await dbDelete('inventory_daily_usage',id); showToast('Deleted!'); await loadInventory(); } catch(e){ showToast('Error: '+e.message,'error'); }
}

// ── DAILY USAGE — BATCH PRODUCT ROWS ──
var usageRowCount = 0;
function addUsageRow(pid, pname, unit, editId) {
  usageRowCount++;
  var rid = 'urow-'+usageRowCount;
  var emptyMsg = document.getElementById('inv-usage-rows-empty');
  if (emptyMsg) emptyMsg.style.display = 'none';
  var row = document.createElement('div');
  row.id = rid;
  row.style.cssText = 'display:grid;grid-template-columns:1fr 90px 80px 36px;gap:8px;align-items:end;margin-bottom:8px;padding:10px 12px;background:var(--surface2);border-radius:8px;border:1px solid var(--border)';
  row.innerHTML =
    '<div style="position:relative">'
    +'<label style="display:block;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);margin-bottom:5px">Product / Flavour</label>'
    +'<input type="text" id="'+rid+'-search" value="'+(pname||'')+'" placeholder="Search product..." oninput="filterUsageDrop(\''+rid+'\')" onfocus="filterUsageDrop(\''+rid+'\')" autocomplete="off" style="width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:13px">'
    +'<div id="'+rid+'-drop" class="inv-drop"></div>'
    +'<input type="hidden" id="'+rid+'-pid" value="'+(pid||'')+'">'
    +'<input type="hidden" id="'+rid+'-editid" value="'+(editId||'')+'">'
    +'</div>'
    +'<div><label style="display:block;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);margin-bottom:5px">Qty</label>'
    +'<input type="number" step="0.01" id="'+rid+'-qty" placeholder="0" style="width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:13px"></div>'
    +'<div><label style="display:block;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);margin-bottom:5px">Unit</label>'
    +'<input type="text" id="'+rid+'-unit" value="'+(unit||'scoops')+'" placeholder="scoops" style="width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:13px"></div>'
    +'<button onclick="removeUsageRow(\''+rid+'\')" style="padding:8px 10px;background:var(--danger-light);color:var(--danger);border:none;border-radius:8px;cursor:pointer;font-size:16px;align-self:flex-end">✕</button>';
  document.getElementById('inv-usage-rows').appendChild(row);
  document.addEventListener('click', function(e){
    var drop = document.getElementById(rid+'-drop');
    if (drop && !row.contains(e.target)) drop.style.display='none';
  });
}
function removeUsageRow(rid) {
  var row = document.getElementById(rid);
  if (row) row.remove();
  var rows = document.getElementById('inv-usage-rows');
  if (rows && rows.children.length === 0) {
    var emptyMsg = document.getElementById('inv-usage-rows-empty');
    if (emptyMsg) emptyMsg.style.display = '';
  }
}
function filterUsageDrop(rid) {
  var q = document.getElementById(rid+'-search').value.toLowerCase();
  var drop = document.getElementById(rid+'-drop');
  var cats = {};
  PRODUCTS_DB.filter(function(p){ return !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q); })
    .forEach(function(p){ if(!cats[p.category]) cats[p.category]=[]; cats[p.category].push(p); });
  var html='';
  Object.keys(cats).forEach(function(cat){
    html+='<div class="inv-drop-cat">'+cat+'</div>';
    cats[cat].forEach(function(p){
      html+='<div class="inv-drop-item" onclick="selectUsageProduct(\''+rid+'\',\''+p.id+'\',\''+p.name.replace(/'/g,"&#39;")+'\',\''+p.defaultUnit+'\')">'+p.name+'</div>';
    });
  });
  if (!html) html='<div style="padding:10px 12px;color:var(--muted);font-size:13px">No products found</div>';
  drop.innerHTML=html; drop.style.display='block';
}
function selectUsageProduct(rid, pid, pname, unit) {
  document.getElementById(rid+'-search').value=pname;
  document.getElementById(rid+'-pid').value=pid;
  var unitEl=document.getElementById(rid+'-unit');
  if(unitEl && unit) unitEl.value=unit;
  var drop=document.getElementById(rid+'-drop');
  if(drop) drop.style.display='none';
}
async function saveAllUsage() {
  getCredentials();
  if (!getActiveSbUrl() || !getActiveSbKey()) { showToast('Not connected','error'); return; }
  var date = document.getElementById('inv-sum-date').value;
  if (!date) { showToast('Date is required','error'); return; }
  var sumId = document.getElementById('inv-sum-id').value;
  var wg = Number(document.getElementById('inv-wg').value)||0;
  var wl = Number(document.getElementById('inv-wl').value)||0;
  var extra = Number(document.getElementById('inv-wg-extra').value)||0;
  var custs = Number(document.getElementById('inv-custs').value)||0;
  var notesVal = document.getElementById('inv-sum-notes').value.trim();
  var reasonEl = document.getElementById('inv-extra-reason');
  var reasonVal = reasonEl ? reasonEl.value.trim() : '';
  var fullNotes = notesVal;
  if (reasonVal) fullNotes = (notesVal ? notesVal+' | ' : '')+'Extra: '+reasonVal;
  if (!sumId) {
    var existing = D.dailyUsage.find(function(r){ return r.type==='summary' && r.date===date; });
    if (existing) sumId = existing.id;
  }
  var sumPayload = { type:'summary', date:date, weight_gain_shakes:wg+extra, weight_loss_shakes:wl, total_customers:custs, notes:fullNotes||null };
  var rowEls = document.getElementById('inv-usage-rows').children;
  var usageItems = [];
  for (var i=0; i<rowEls.length; i++) {
    var rid = rowEls[i].id;
    var pid = document.getElementById(rid+'-pid').value;
    var pname = document.getElementById(rid+'-search').value.trim();
    var qty = Number(document.getElementById(rid+'-qty').value)||0;
    var unit = document.getElementById(rid+'-unit').value.trim()||'scoops';
    var editId = document.getElementById(rid+'-editid').value;
    if (!pid) { showToast('Select a product for row '+(i+1),'error'); return; }
    if (!qty) { showToast('Enter quantity for '+pname,'error'); return; }
    usageItems.push({ editId:editId, payload:{ type:'product', product_id:pid, product_name:pname, quantity:qty, unit:unit, date:date } });
  }
  try {
    if (sumId) await dbUpdate('inventory_daily_usage', sumId, sumPayload);
    else await dbInsert('inventory_daily_usage', sumPayload);
    for (var j=0; j<usageItems.length; j++) {
      var item = usageItems[j];
      if (item.editId) await dbUpdate('inventory_daily_usage', item.editId, item.payload);
      else await dbInsert('inventory_daily_usage', item.payload);
    }
    showToast('Saved! '+(usageItems.length > 0 ? usageItems.length+' product(s) logged.' : 'Summary saved.'));
    resetDailyUsage();
    await loadInventory();
  } catch(e) { showToast('Error: '+e.message,'error'); }
}
function resetDailyUsage() {
  document.getElementById('inv-sum-id').value='';
  document.getElementById('inv-usage-id').value='';
  var today = new Date().toISOString().split('T')[0];
  document.getElementById('inv-sum-date').value=today;
  ['inv-wg','inv-wl','inv-wg-extra','inv-custs'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value='0'; });
  document.getElementById('inv-sum-notes').value='';
  var er=document.getElementById('inv-extra-reason'); if(er) er.value='';
  document.getElementById('inv-usage-rows').innerHTML='';
  usageRowCount=0;
  var emptyMsg=document.getElementById('inv-usage-rows-empty');
  if(emptyMsg) emptyMsg.style.display='';
  var preview=document.getElementById('inv-shake-preview');
  if(preview) preview.innerHTML='';
  autoFillFromAttendance(today);
}


// ── RENDER CENTERS ──
function renderCenters() {
  var q = document.getElementById('centers-search').value.toLowerCase();
  var rows = D.centers.filter(function(c){ return (c.name||'').toLowerCase().includes(q)||(c.location||'').toLowerCase().includes(q); });
  var tb = document.getElementById('centers-body');
  var _pins = JSON.parse(localStorage.getItem('centerPins') || '{}');
  if (!rows.length) { tb.innerHTML='<tr><td colspan="8"><div class="empty"><div class="ei">🏢</div><p>No centers found. Add your first one!</p></div></td></tr>'; }
  else tb.innerHTML = rows.map(function(c){
    var ownerName = '—';
    var _pcOwner = JSON.parse(localStorage.getItem('profileCenterOwner') || '{}');
    if(c.owner_id){
      var oc = D.coaches.find(function(x){return x.id===c.owner_id;}); if(oc) ownerName=oc.name;
      else if(OWNER_PROFILE && OWNER_PROFILE.coach_id===c.owner_id && OWNER_PROFILE.name) ownerName=OWNER_PROFILE.name;
    } else if(_pcOwner[c.name] && OWNER_PROFILE && OWNER_PROFILE.name) { ownerName=OWNER_PROFILE.name; }
    var pinVal = _pins[c.id] || '';
    var pinHtml = pinVal
      ? '<span id="pin-show-'+c.id+'" style="font-family:monospace;font-size:14px;letter-spacing:3px;background:var(--surface2);padding:2px 8px;border-radius:6px;cursor:pointer" onclick="this.textContent=this.textContent===\'••••\'?\''+pinVal+'\':\'••••\'" title="Click to show/hide">••••</span>'
      : '<span style="color:var(--muted);font-size:11px">Not set</span>';
    var nidHtml = c.network_id ? '<span style="font-family:monospace;font-size:12px;background:var(--surface2);padding:2px 7px;border-radius:5px;color:var(--primary)">'+c.network_id+'</span>' : '<span style="color:var(--muted);font-size:11px">—</span>';
    var copyBtn = c.network_id
      ? '<button class="btn-e" onclick="copyInviteLink(\''+c.network_id+'\')" title="Copy invite link for downline registration" style="background:#e8f5e9;color:#2d5a3d;border-color:#a5d6a7">🔗 Invite Link</button>'
      : '';
    return '<tr><td><strong>'+c.name+'</strong></td><td>'+nidHtml+'</td><td>'+(ownerName)+'</td><td>'+(c.location||'—')+'</td><td>'+(c.contact||'—')+'</td><td><span class="badge '+(c.type==='main'?'bg':c.type==='downline'?'by':'bb')+'">'+c.type+'</span></td><td>'+pinHtml+'</td><td><div class="acts">'+copyBtn+'<button class="btn-e" onclick="editCenter(\''+c.id+'\')">Edit</button><button class="btn-d" onclick="delRecord(\'wellness_centers\',\''+c.id+'\',\'centers\')">Delete</button></div></td></tr>';
  }).join('');
  document.getElementById('centers-stats').innerHTML = '<div class="stat"><div class="stat-l">Total Centers</div><div class="stat-v">'+D.centers.length+'</div></div><div class="stat"><div class="stat-l">Downline</div><div class="stat-v">'+D.centers.filter(function(c){return c.type==='downline';}).length+'</div></div><div class="stat"><div class="stat-l">Branches</div><div class="stat-v">'+D.centers.filter(function(c){return c.type==='branch';}).length+'</div></div>';
}

// ── RENDER ATTENDANCE ──
var ATT_TAB = 'daily';
var ATT_SHOW_INACTIVE = false;
function toggleInactiveAtt() {
  ATT_SHOW_INACTIVE = !ATT_SHOW_INACTIVE;
  var btn = document.getElementById('att-inactive-toggle');
  if (btn) {
    btn.style.background    = ATT_SHOW_INACTIVE ? '#fff3cd' : 'var(--surface)';
    btn.style.borderColor   = ATT_SHOW_INACTIVE ? '#f59e0b' : 'var(--border)';
    btn.style.color         = ATT_SHOW_INACTIVE ? '#92400e' : 'var(--muted)';
    btn.textContent         = ATT_SHOW_INACTIVE ? '😴 Hide Inactive' : '😴 Show Inactive';
  }
  renderAttendance();
}
function switchAttTab(tab) {
  ATT_TAB = tab;
  document.getElementById('tab-daily').classList.toggle('active', tab==='daily');
  document.getElementById('tab-monthly').classList.toggle('active', tab==='monthly');
  document.getElementById('tab-coach-att').classList.toggle('active', tab==='coach');
  document.getElementById('tab-nudges').classList.toggle('active', tab==='nudges');
  document.getElementById('att-daily-view').style.display = tab==='daily' ? 'block' : 'none';
  document.getElementById('att-monthly-view').style.display = tab==='monthly' ? 'block' : 'none';
  document.getElementById('att-coach-view').style.display = tab==='coach' ? 'block' : 'none';
  document.getElementById('att-nudges-view').style.display = tab==='nudges' ? 'block' : 'none';
  if(tab==='monthly' && !document.getElementById('att-month-picker').value) {
    document.getElementById('att-month-picker').value = new Date().toISOString().substring(0,7);
    renderAttGrid();
  } else if(tab==='coach') {
    var dateEl = document.getElementById('coach-att-date');
    if (!dateEl.value) dateEl.value = new Date().toISOString().split('T')[0];
    var monEl = document.getElementById('coach-att-month');
    if (!monEl.value) monEl.value = new Date().toISOString().substring(0,7);
    renderCoachAttendance();
    renderCoachAttSummary();
  } else if(tab==='nudges') {
    renderAbsenceNudges();
  } else renderAttendance();
}
// ══════════════════════════════════════════
// 👨‍🏫 COACH ATTENDANCE
// ══════════════════════════════════════════
async function renderCoachAttendance() {
  var date = document.getElementById('coach-att-date').value || new Date().toISOString().split('T')[0];
  var el = document.getElementById('coach-att-list'); if (!el) return;
  var coaches = filterByCenter(D.coaches).filter(function(c){ return (c.status||'Active')==='Active'; });
  if (!coaches.length) { el.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:20px;text-align:center">No active coaches found</div>'; return; }
  
  // Load today's coach attendance records using correct PostgREST parameters
  var recs = [];
  try {
    recs = await dbGet('coach_attendance', 'date', 'date=eq.' + date);
  } catch(e) { recs = []; }

  // Load today's customer check-ins to see if any coach checked in as a customer/client
  var custAtts = [];
  try {
    custAtts = await dbGet('attendance', 'date', 'date=eq.' + date);
  } catch(e) { custAtts = []; }

  var centerId = ACTIVE_CENTER || null;
  var autoCheckedInAny = false;

  // Auto check-in coaches if they already checked in as customers
  for (var k = 0; k < coaches.length; k++) {
    var c = coaches[k];
    var rec = recs.find(function(r){ return r.coach_id === c.id; });
    
    if (!rec) {
      var cust = (D.customers || []).find(function(cust) {
        return (c.phone && cust.phone && cust.phone.replace(/\D/g,'') === c.phone.replace(/\D/g,''))
            || (c.email && cust.email && cust.email.toLowerCase().trim() === c.email.toLowerCase().trim())
            || (c.name.toLowerCase().trim() === cust.name.toLowerCase().trim());
      });
      var custCheckedIn = cust ? custAtts.some(function(a) { return a.customer_id === cust.id; }) : false;
      if (custCheckedIn) {
        try {
          var newRecs = await dbInsert('coach_attendance', { coach_id: c.id, date: date, status: 'present', wellness_center_id: centerId });
          if (newRecs && newRecs[0]) {
            recs.push(newRecs[0]);
            autoCheckedInAny = true;
          }
        } catch(err) {
          console.error('Failed to auto check-in coach: ' + c.name, err);
        }
      }
    }
  }

  if (autoCheckedInAny) {
    renderCoachAttSummary();
  }

  el.innerHTML = coaches.map(function(c) {
    var rec = recs.find(function(r){ return r.coach_id === c.id; });
    var status = rec ? rec.status : null;
    var isPresent = status === 'present';
    var isAbsent = status === 'absent';
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:10px;border:1.5px solid var(--border);background:var(--surface);margin-bottom:8px">'
      + '<div><div style="font-weight:600;font-size:14px">'+c.name+'</div><div style="font-size:11px;color:var(--muted)">'+( c.center_name||getCenterName())+'</div></div>'
      + '<div style="display:flex;gap:6px">'
      + '<button onclick="toggleCoachAtt(\''+c.id+'\',\''+c.name+'\',\''+date+'\',\'present\')" style="padding:6px 14px;border-radius:8px;border:1.5px solid '+(isPresent?'var(--success)':'var(--border)')+';background:'+(isPresent?'var(--success)':'var(--surface2)')+';color:'+(isPresent?'#fff':'var(--muted)')+';font-weight:600;font-size:12px;cursor:pointer;font-family:inherit">✅ Present</button>'
      + '<button onclick="toggleCoachAtt(\''+c.id+'\',\''+c.name+'\',\''+date+'\',\'absent\')" style="padding:6px 14px;border-radius:8px;border:1.5px solid '+(isAbsent?'var(--danger)':'var(--border)')+';background:'+(isAbsent?'var(--danger)':'var(--surface2)')+';color:'+(isAbsent?'#fff':'var(--muted)')+';font-weight:600;font-size:12px;cursor:pointer;font-family:inherit">❌ Absent</button>'
      + '</div></div>';
  }).join('');
}

async function toggleCoachAtt(coachId, coachName, date, newStatus) {
  var centerId = ACTIVE_CENTER || null;
  try {
    // Query existing record dynamically to avoid static state mismatch in the DOM
    var recs = await dbGet('coach_attendance', 'date', 'coach_id=eq.' + coachId + '&date=eq.' + date);
    var existingRec = recs && recs.find(function(r) { return r.coach_id === coachId && r.date === date; });

    if (existingRec) {
      if (existingRec.status === newStatus) {
        // Untoggle / delete if clicking the same status again
        await dbDelete('coach_attendance', existingRec.id);
        showToast(coachName + ' attendance cleared', 'success');
      } else {
        await dbUpdate('coach_attendance', existingRec.id, { status: newStatus });
        showToast(coachName + ' marked ' + newStatus, newStatus === 'present' ? 'success' : 'error');
      }
    } else {
      await dbInsert('coach_attendance', { coach_id: coachId, date: date, status: newStatus, wellness_center_id: centerId });
      showToast(coachName + ' marked ' + newStatus, newStatus === 'present' ? 'success' : 'error');
    }
    renderCoachAttendance();
    renderCoachAttSummary();
  } catch(e) {
    showToast('Error saving: ' + e.message, 'error');
  }
}

async function renderCoachAttSummary() {
  var month = document.getElementById('coach-att-month').value;
  var el = document.getElementById('coach-att-summary'); if (!el || !month) return;
  var coaches = filterByCenter(D.coaches).filter(function(c){ return (c.status||'Active')==='Active'; });
  if (!coaches.length) { el.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:20px;text-align:center">No active coaches</div>'; return; }
  
  var recs = [];
  try { 
    recs = await dbGet('coach_attendance', 'date', 'date=gte.' + month + '-01&date=lte.' + month + '-31'); 
  } catch(e) { recs = []; }
  
  // Count working days in month up to today
  var today = new Date().toISOString().split('T')[0];
  var daysInMonth = 0;
  var y = parseInt(month.split('-')[0]), m = parseInt(month.split('-')[1]);
  var d = new Date(y, m-1, 1);
  while(d.getMonth() === m-1 && d.toISOString().split('T')[0] <= today) { daysInMonth++; d.setDate(d.getDate()+1); }
  el.innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:13px">'
    + '<thead><tr style="border-bottom:2px solid var(--border)"><th style="text-align:left;padding:6px 8px;color:var(--muted)">Coach</th><th style="text-align:center;padding:6px 8px;color:var(--muted)">Present</th><th style="text-align:center;padding:6px 8px;color:var(--muted)">Absent</th><th style="text-align:center;padding:6px 8px;color:var(--muted)">Rate</th></tr></thead><tbody>'
    + coaches.map(function(c) {
        var present = recs.filter(function(r){ return r.coach_id===c.id && r.status==='present'; }).length;
        var absent  = recs.filter(function(r){ return r.coach_id===c.id && r.status==='absent'; }).length;
        var rate = daysInMonth ? Math.round(present/daysInMonth*100) : 0;
        var color = rate>=80?'var(--success)':rate>=50?'var(--accent)':'var(--danger)';
        return '<tr style="border-bottom:1px solid var(--border)">'
          + '<td style="padding:7px 8px;font-weight:600">'+c.name+'</td>'
          + '<td style="text-align:center;padding:7px 8px;color:var(--success)">'+present+'</td>'
          + '<td style="text-align:center;padding:7px 8px;color:var(--danger)">'+absent+'</td>'
          + '<td style="text-align:center;padding:7px 8px;font-weight:700;color:'+color+'">'+rate+'%</td>'
          + '</tr>';
      }).join('')
    + '</tbody></table>'
    + '<div style="font-size:11px;color:var(--muted);margin-top:8px">Based on '+daysInMonth+' working day(s) so far in '+month+'</div>';
}

// ══════════════════════════════════════════
// 📢 CENTER ANNOUNCEMENTS
// ══════════════════════════════════════════
async function openAnnouncementModal() {
  // Populate center dropdown
  var sel = document.getElementById('ann-center');
  if (sel) {
    sel.innerHTML = '<option value="">— All Centers —</option>'
      + D.centers.map(function(c){ return '<option value="'+c.id+'">'+c.name+'</option>'; }).join('');
  }
  openModal('announcement');
}

async function saveAnnouncement() {
  var title   = (document.getElementById('ann-title').value || '').trim();
  var message = (document.getElementById('ann-message').value || '').trim();
  var centerId = document.getElementById('ann-center').value || null;
  var expires = document.getElementById('ann-expires').value || null;
  if (!title || !message) { showToast('Title and message are required', 'error'); return; }
  try {
    await dbInsert('announcements', { title: title, message: message, target_center_id: centerId, expires_at: expires });
    showToast('Announcement posted!', 'success');
    closeModal('announcement');
    document.getElementById('ann-title').value = '';
    document.getElementById('ann-message').value = '';
    document.getElementById('ann-expires').value = '';
  } catch(e) { showToast('Failed to post announcement: ' + e.message, 'error'); }
}

async function loadAnnouncements() {
  try {
    var today = new Date().toISOString().split('T')[0];
    D.announcements = await dbGet('announcements');
    // Filter: not yet expired
    D.announcements = (D.announcements || []).filter(function(a){
      return !a.expires_at || a.expires_at >= today;
    });
  } catch(e) { D.announcements = []; }
}

var _annHistoryVisible = false;
function toggleAnnouncementHistory() {
  var panel = document.getElementById('announcement-history-panel');
  if (!panel) return;
  _annHistoryVisible = !_annHistoryVisible;
  panel.style.display = _annHistoryVisible ? 'block' : 'none';
  if (_annHistoryVisible) renderAnnouncementHistory();
}

async function renderAnnouncementHistory() {
  var el = document.getElementById('announcement-history-list'); if (!el) return;
  el.innerHTML = '<div style="color:var(--muted);font-size:12px;text-align:center;padding:10px">Loading…</div>';
  var all = [];
  try { all = await dbGet('announcements'); } catch(e) { all = []; }
  if (!all.length) { el.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:14px">No announcements posted yet.</div>'; return; }
  // Sort newest first
  all.sort(function(a,b){ return new Date(b.created_at) - new Date(a.created_at); });
  var today = new Date().toISOString().split('T')[0];
  el.innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:13px">'
    + '<thead><tr style="border-bottom:2px solid var(--border)">'
    + '<th style="text-align:left;padding:6px 8px;color:var(--muted)">Title</th>'
    + '<th style="text-align:left;padding:6px 8px;color:var(--muted)">Message</th>'
    + '<th style="text-align:left;padding:6px 8px;color:var(--muted)">Target</th>'
    + '<th style="text-align:left;padding:6px 8px;color:var(--muted)">Expires</th>'
    + '<th style="text-align:left;padding:6px 8px;color:var(--muted)">Posted</th>'
    + '<th style="padding:6px 8px"></th>'
    + '</tr></thead><tbody>'
    + all.map(function(a) {
        var expired = a.expires_at && a.expires_at < today;
        var center = a.target_center_id ? (D.centers.find(function(c){ return c.id===a.target_center_id; })||{}).name || 'Unknown' : 'All Centers';
        var posted = a.created_at ? new Date(a.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '—';
        return '<tr style="border-bottom:1px solid var(--border);'+(expired?'opacity:.55':'')+'"">'
          + '<td style="padding:7px 8px;font-weight:700">'+a.title+(expired?' <span style="font-size:10px;color:var(--danger)">(expired)</span>':'')+'</td>'
          + '<td style="padding:7px 8px;color:var(--muted);max-width:200px">'+a.message.slice(0,80)+(a.message.length>80?'…':'')+'</td>'
          + '<td style="padding:7px 8px"><span style="font-size:11px;background:#dbeafe;color:#1d4ed8;padding:2px 8px;border-radius:20px">'+center+'</span></td>'
          + '<td style="padding:7px 8px;font-size:12px;color:var(--muted)">'+(a.expires_at||'—')+'</td>'
          + '<td style="padding:7px 8px;font-size:12px;color:var(--muted)">'+posted+'</td>'
          + '<td style="padding:7px 8px"><button class="btn-d" style="font-size:11px;padding:3px 8px" onclick="deleteAnnouncement(\''+a.id+'\')">Delete</button></td>'
          + '</tr>';
      }).join('')
    + '</tbody></table>';
}

async function deleteAnnouncement(id) {
  if (!confirm('Delete this announcement?')) return;
  try {
    await dbDelete('announcements', id);
    showToast('Announcement deleted');
    // Refresh history and banner
    await loadAnnouncements();
    renderAnnouncementBanner();
    renderAnnouncementHistory();
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

function renderAnnouncementBanner() {
  var el = document.getElementById('announcement-banner');
  if (!el) return;
  // Determine current center context
  var centerId = null;
  if (_authSession && _authSession.center_id) centerId = _authSession.center_id;
  else if (ACTIVE_CENTER) centerId = ACTIVE_CENTER;
  var relevant = (D.announcements || []).filter(function(a){
    return !a.target_center_id || a.target_center_id === centerId;
  });
  if (!relevant.length) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  el.innerHTML = relevant.map(function(a){
    var exp = a.expires_at ? ' <span style="opacity:0.7;font-size:11px">(until '+a.expires_at+')</span>' : '';
    return '<div style="background:linear-gradient(135deg,#e0f2fe,#bae6fd);border:1px solid #7dd3fc;border-radius:var(--radius);padding:12px 16px;margin-bottom:8px">'
      + '<div style="font-weight:700;color:#0369a1;margin-bottom:4px">📢 '+a.title+exp+'</div>'
      + '<div style="color:#0c4a6e;font-size:13px">'+a.message+'</div>'
      + '</div>';
  }).join('');
}

// ══════════════════════════════════════════
// 📝 CUSTOMER NOTES & FOLLOW-UPS
// ══════════════════════════════════════════
var _notesCustomerId = null;

async function openNotesModal(custId, custName) {
  _notesCustomerId = custId;
  document.getElementById('notes-cust-name').textContent = custName;
  document.getElementById('notes-text').value = '';
  document.getElementById('notes-followup').value = '';
  document.getElementById('notes-history').innerHTML = '<div style="color:var(--muted);font-size:12px;text-align:center;padding:12px">Loading…</div>';
  openModal('cust-notes');
  await renderNotesHistory(custId);
}

async function renderNotesHistory(custId) {
  var el = document.getElementById('notes-history'); if (!el) return;
  var notes = [];
  try {
    notes = await dbGet('customer_notes', { customer_id: 'eq.' + custId, order: 'created_at.desc' });
  } catch(e) { notes = []; }
  if (!notes.length) { el.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:16px">No notes yet. Add one below.</div>'; return; }
  el.innerHTML = notes.map(function(n) {
    var date = n.created_at ? new Date(n.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
    var fu = n.follow_up_date
      ? '<div style="margin-top:5px"><span style="font-size:11px;background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:20px;font-weight:600">📅 Follow-up: '+n.follow_up_date+'</span></div>'
      : '';
    return '<div style="padding:10px 12px;background:var(--surface2);border-radius:10px;margin-bottom:8px;position:relative">'
      + '<div style="font-size:13px;line-height:1.5;color:var(--text)">'+n.note+'</div>'
      + fu
      + '<div style="font-size:10px;color:var(--muted);margin-top:5px;display:flex;justify-content:space-between;align-items:center">'
      +   '<span>'+date+'</span>'
      +   '<button style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:11px;padding:0" onclick="deleteNote(\''+n.id+'\',\''+custId+'\')">Delete</button>'
      + '</div>'
      + '</div>';
  }).join('');
}

async function saveNote() {
  var custId = _notesCustomerId; if (!custId) return;
  var note = (document.getElementById('notes-text').value || '').trim();
  var followUp = document.getElementById('notes-followup').value || null;
  if (!note) { showToast('Note cannot be empty', 'error'); return; }
  try {
    await dbInsert('customer_notes', { customer_id: custId, note: note, follow_up_date: followUp });
    document.getElementById('notes-text').value = '';
    document.getElementById('notes-followup').value = '';
    showToast('Note saved!', 'success');
    await renderNotesHistory(custId);
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

async function deleteNote(noteId, custId) {
  if (!confirm('Delete this note?')) return;
  try {
    await dbDelete('customer_notes', noteId);
    showToast('Note deleted');
    await renderNotesHistory(custId);
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

async function loadFollowUps() {
  // Load today's follow-ups into overview banner
  var today = new Date().toISOString().split('T')[0];
  try {
    var due = await dbGet('customer_notes', { follow_up_date: 'eq.' + today });
    if (!due || !due.length) return;
    // Deduplicate by customer
    var seen = {};
    var unique = due.filter(function(n){ if(seen[n.customer_id]) return false; seen[n.customer_id]=true; return true; });
    var names = unique.map(function(n){
      var c = D.customers.find(function(x){return x.id===n.customer_id;});
      return c ? c.name : '?';
    });
    showToast('📅 Follow-ups due today: ' + names.join(', '), 'success');
  } catch(e) { /* silent */ }
}

// ══════════════════════════════════════════
// 🎯 CUSTOMER GOAL TRACKER
// ══════════════════════════════════════════
function openBodyGoalModal(custId) {
  var cust = D.customers.find(function(c){ return c.id === custId; });
  if (!cust) return;
  document.getElementById('body-goal-cust-id').value = custId;
  document.getElementById('body-goal-cust-name').textContent = cust.name;
  document.getElementById('body-goal-weight').value = cust.goal_weight || '';
  document.getElementById('body-goal-fat').value = cust.goal_fat_pct || '';
  openModal('body-goal');
}

async function saveBodyGoal() {
  var custId = document.getElementById('body-goal-cust-id').value;
  var gw = parseFloat(document.getElementById('body-goal-weight').value) || null;
  var gf = parseFloat(document.getElementById('body-goal-fat').value) || null;
  if (!gw && !gf) { showToast('Enter at least one target', 'error'); return; }
  try {
    await dbUpdate('customers', custId, { goal_weight: gw, goal_fat_pct: gf });
    // Update in-memory
    var cust = D.customers.find(function(c){ return c.id === custId; });
    if (cust) { cust.goal_weight = gw; cust.goal_fat_pct = gf; }
    showToast('Goal saved!', 'success');
    closeModal('body-goal');
    renderBody();
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

function renderBodyGoalCard(cust, latest) {
  var el = document.getElementById('body-goal-card'); if (!el) return;
  var hasGoal = cust.goal_weight || cust.goal_fat_pct;
  if (!hasGoal) {
    el.style.display = 'block';
    el.innerHTML = '<div class="tcard" style="padding:14px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px">'
      + '<span style="font-size:13px;color:var(--muted)">No goal set for this customer.</span>'
      + '<button class="btn-p" style="font-size:12px;padding:5px 12px;background:#f59e0b;border-color:#f59e0b" onclick="openBodyGoalModal(\''+cust.id+'\')">🎯 Set Goal</button>'
      + '</div>';
    return;
  }
  el.style.display = 'block';

  function goalRow(label, current, target, goodWhenLower) {
    if (!target) return '';
    var cur = parseFloat(current);
    if (isNaN(cur)) return '';
    var diff = cur - target;
    var pct; // progress toward goal
    if (goodWhenLower) {
      // Weight loss / fat loss: started from baseline, target is lower
      var recs = (D.body||[]).filter(function(b){ return b.customer_id===cust.id; }).sort(function(a,b){ return new Date(a.date)-new Date(b.date); });
      var baseline = recs.length ? parseFloat(recs[0][label==='Weight'?'weight':'fat_percentage']) : cur;
      var totalNeeded = baseline - target;
      var achieved = baseline - cur;
      pct = totalNeeded > 0 ? Math.min(100, Math.max(0, Math.round(achieved / totalNeeded * 100))) : (cur <= target ? 100 : 0);
    } else {
      pct = cur >= target ? 100 : Math.round(cur / target * 100);
    }
    var done = cur <= target && goodWhenLower || cur >= target && !goodWhenLower;
    var barColor = done ? '#16a34a' : pct >= 60 ? '#d97706' : '#e74c3c';
    var diffStr = diff === 0 ? '✅ Goal reached!' : (goodWhenLower ? (diff > 0 ? diff.toFixed(1)+' to lose' : '✅ Goal reached!') : (diff < 0 ? Math.abs(diff).toFixed(1)+' to gain' : '✅ Goal reached!'));
    return '<div style="margin-bottom:10px">'
      + '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">'
      +   '<span style="font-size:12px;font-weight:700">'+label+'</span>'
      +   '<span style="font-size:12px;color:var(--muted)">'+cur+(label==='Weight'?' kg':'%')+' → target: '+target+(label==='Weight'?' kg':'%')+'</span>'
      + '</div>'
      + '<div style="background:var(--border);border-radius:6px;height:10px;margin-bottom:4px">'
      +   '<div style="background:'+barColor+';height:10px;border-radius:6px;width:'+pct+'%;transition:width .4s"></div>'
      + '</div>'
      + '<div style="display:flex;justify-content:space-between">'
      +   '<span style="font-size:11px;color:'+barColor+';font-weight:700">'+pct+'% complete</span>'
      +   '<span style="font-size:11px;color:var(--muted)">'+diffStr+'</span>'
      + '</div>'
      + '</div>';
  }

  var wRow = goalRow('Weight', latest ? latest.weight : null, cust.goal_weight, cust.goal !== 'Weight Gain');
  var fRow = goalRow('Body Fat', latest ? latest.fat_percentage : null, cust.goal_fat_pct, true);

  el.innerHTML = '<div class="tcard" style="padding:16px 18px">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'
    +   '<div style="font-weight:700;font-size:14px">🎯 Goal Progress</div>'
    +   '<button class="btn-e" style="font-size:11px" onclick="openBodyGoalModal(\''+cust.id+'\')">Edit Goal</button>'
    + '</div>'
    + (wRow || fRow || '<div style="color:var(--muted);font-size:13px">No scan data yet to compare against goal.</div>')
    + '</div>';
}

// ══════════════════════════════════════════
// 🔁 RECURRING EXPENSES
// ══════════════════════════════════════════
async function loadRecurring() {
  try { D.recurring = await dbGet('recurring_expenses'); } catch(e) { D.recurring = []; }
}

async function openRecurringModal() {
  await loadRecurring();
  // Populate center dropdown
  var sel = document.getElementById('rec-center');
  if (sel) {
    sel.innerHTML = '<option value="">— All / Default —</option>'
      + D.centers.map(function(c){ return '<option value="'+c.id+'">'+c.name+'</option>'; }).join('');
    if (ACTIVE_CENTER) sel.value = ACTIVE_CENTER;
  }
  renderRecurringList();
  openModal('recurring-expenses');
}

function renderRecurringList() {
  var el = document.getElementById('recurring-list'); if (!el) return;
  var items = D.recurring || [];
  if (!items.length) { el.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:12px">No recurring expenses set up yet.</div>'; return; }
  el.innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:13px">'
    + '<thead><tr style="border-bottom:2px solid var(--border)">'
    + '<th style="text-align:left;padding:5px 8px;color:var(--muted)">Name</th>'
    + '<th style="text-align:right;padding:5px 8px;color:var(--muted)">₹</th>'
    + '<th style="text-align:center;padding:5px 8px;color:var(--muted)">Day</th>'
    + '<th style="text-align:left;padding:5px 8px;color:var(--muted)">Category</th>'
    + '<th style="padding:5px 8px"></th></tr></thead><tbody>'
    + items.map(function(r){
        return '<tr style="border-bottom:1px solid var(--border)">'
          + '<td style="padding:6px 8px;font-weight:600">'+r.name+'</td>'
          + '<td style="padding:6px 8px;text-align:right;color:var(--danger)">₹'+Number(r.amount).toLocaleString('en-IN')+'</td>'
          + '<td style="padding:6px 8px;text-align:center;color:var(--muted)">'+r.day_of_month+'</td>'
          + '<td style="padding:6px 8px;color:var(--muted)">'+r.category+'</td>'
          + '<td style="padding:6px 8px;text-align:right"><button class="btn-c" style="color:var(--danger);font-size:11px;padding:3px 8px" onclick="deleteRecurring(\''+r.id+'\')">Delete</button></td>'
          + '</tr>';
      }).join('')
    + '</tbody></table>';
}

async function saveRecurring() {
  var name = (document.getElementById('rec-name').value || '').trim();
  var amount = parseFloat(document.getElementById('rec-amount').value);
  var day = parseInt(document.getElementById('rec-day').value) || 1;
  var cat = document.getElementById('rec-cat').value || 'Operational';
  var centerId = document.getElementById('rec-center').value || null;
  if (!name || !amount) { showToast('Name and amount are required', 'error'); return; }
  if (day < 1 || day > 28) { showToast('Day must be between 1 and 28', 'error'); return; }
  try {
    await dbInsert('recurring_expenses', { name: name, amount: amount, day_of_month: day, category: cat, wellness_center_id: centerId });
    showToast('Recurring expense added!', 'success');
    document.getElementById('rec-name').value = '';
    document.getElementById('rec-amount').value = '';
    document.getElementById('rec-day').value = '1';
    await loadRecurring();
    renderRecurringList();
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

async function deleteRecurring(id) {
  if (!confirm('Delete this recurring expense?')) return;
  try {
    await dbDelete('recurring_expenses', id);
    showToast('Deleted!');
    await loadRecurring();
    renderRecurringList();
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

// Auto-apply recurring expenses for the current month (runs once per month per device)
async function autoApplyRecurring() {
  var items = D.recurring || [];
  if (!items.length) return;
  var today = new Date();
  var ym = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0');
  var lsKey = 'recurringApplied_' + ym;
  if (localStorage.getItem(lsKey)) return; // already applied this month on this device
  var todayStr = today.toISOString().split('T')[0];
  var applied = 0;
  for (var i = 0; i < items.length; i++) {
    var r = items[i];
    var expDate = ym + '-' + String(r.day_of_month).padStart(2,'0');
    if (expDate > todayStr) continue; // not due yet this month
    try {
      await dbInsert('finance', {
        type: 'expense',
        description: r.name + ' (auto)',
        amount: r.amount,
        category: r.category,
        date: expDate,
        wellness_center_id: r.wellness_center_id || ACTIVE_CENTER || null
      });
      applied++;
    } catch(e) { /* skip duplicates or errors silently */ }
  }
  localStorage.setItem(lsKey, '1');
  if (applied > 0) {
    await loadFinance();
    showToast(applied + ' recurring expense(s) auto-added for ' + ym, 'success');
  }
}

// Manual "Apply This Month Now" button
async function applyRecurringNow() {
  var ym = new Date().toISOString().slice(0,7);
  localStorage.removeItem('recurringApplied_' + ym); // reset guard so it re-applies
  closeModal('recurring-expenses');
  await autoApplyRecurring();
}

var _attResetTimer = null;
async function toggleAtt(cid, cname, date, currentStatus) {
  getCredentials(); if (!getActiveSbUrl() || !getActiveSbKey()) { showToast('Not connected to Supabase', 'error'); return; }
  var pIds = getPersonIds(cid);
  var existing = D.attendance.find(function(a){return pIds.indexOf(a.customer_id) !== -1 && a.date===date;});
  try {
    if(existing && existing.status==='present') {
      var curServ = Number(existing.servings) || 1;
      var newServ = curServ + 1;
      await dbUpdate('attendance', existing.id, {servings:newServ});
      showToast(cname+' — '+newServ+' servings today','success');
    } else if(existing) {
      await dbUpdate('attendance', existing.id, {status:'present', servings:1});
      showToast(cname+' — marked present (1 serving)','success');
    } else {
      await dbInsert('attendance', {customer_id:cid, customer_name:cname, date:date, status:'present', servings:1, check_in_time: new Date().toTimeString().slice(0,5)});
      showToast(cname+' — marked present (1 serving)','success');
    }
    _daysLeftCache = {};
    await loadAttendance(); renderOverview();
    sendAttendanceWhatsApp(cid, cname, date);
  } catch(e) { showToast('Error: '+e.message,'error'); }
}
async function resetAtt(cid, cname, date) {
  getCredentials(); if (!getActiveSbUrl() || !getActiveSbKey()) return;
  var pIds = getPersonIds(cid);
  var existing = D.attendance.find(function(a){return pIds.indexOf(a.customer_id) !== -1 && a.date===date;});
  if(!existing || existing.status!=='present') return;
  try {
    await dbUpdate('attendance', existing.id, {status:'absent', servings:0});
    showToast(cname+' — attendance removed','info');
    _daysLeftCache = {};
    await loadAttendance(); renderOverview();
  } catch(e) { showToast('Error: '+e.message,'error'); }
}
function sendAttendanceWhatsApp(custId, custName, date) {
  var cust = D.customers.find(function(c){return c.id===custId;}) || D.coaches.find(function(c){return c.id===custId;});
  if(!cust || !cust.contact) return;
  var phone = (cust.contact||'').replace(/\D/g,'');
  if(phone.length===10) phone = COUNTRY_CODE + phone;
  var st = getDaysLeft(cust);
  var activeCenter = ACTIVE_CENTER && D.centers.find(function(c){return c.id===ACTIVE_CENTER;});
  var custCenter = cust.wellness_center_id && D.centers.find(function(c){return c.id===cust.wellness_center_id;});
  var cn = (activeCenter && activeCenter.name) || (custCenter && custCenter.name) || (OWNER_PROFILE && OWNER_PROFILE.center_name) || (D.centers.length && D.centers[0].name) || 'our Wellness Center';

  var progressLine = '';
  var packLine = '';
  if(!st.total) {
    // No pack data set — skip progress
  } else if(!st.active || st.days <= 0) {
    progressLine = '📊 Progress: *'+st.total+' of '+st.total+'* servings used! 🏆';
    packLine = '🔄 You\'ve finished your entire pack — what an achievement! Renew now to keep this momentum going. Ask us about our renewal offers!';
  } else if(st.days <= 3) {
    progressLine = '📊 Progress: *'+st.used+' of '+st.total+'* servings used!';
    packLine = '🌟 Almost done — just '+st.days+' serving'+(st.days!==1?'s':'')+' left! Let\'s plan your next pack so this streak stays alive. Ask us about renewal!';
  } else if(st.days <= 7) {
    progressLine = '📊 Progress: *'+st.used+' of '+st.total+'* servings used!';
    packLine = '💪 Great consistency! You\'re building a strong habit. Think about continuing — early renewals get the best results!';
  } else {
    progressLine = '📊 Progress: *'+st.used+' of '+st.total+'* servings used!';
    packLine = '💪 You\'re doing amazing! Keep showing up and the results will follow.';
  }

  var todayServings = 0;
  var pIds = getPersonIds(custId);
  D.attendance.forEach(function(a){ if(pIds.indexOf(a.customer_id) !== -1 && a.date===date && a.status==='present') todayServings = Number(a.servings)||1; });
  var todayLine = todayServings > 1 ? '🥤 Today\'s servings: *'+todayServings+'*\n' : '';

  var displayName = custName.replace(' 👨‍🏫','');
  var msg = 'Hi '+displayName+'! ✅\n\n'
    + 'Your attendance is marked for today ('+date+') at '+cn+'.\n'
    + todayLine+'\n'
    + progressLine+'\n'
    + packLine+'\n\n'
    + 'See you tomorrow! 💚🌿\n— '+cn;
  var url = 'https://api.whatsapp.com/send?phone='+phone+'&text='+encodeURIComponent(msg);
  var bar = document.getElementById('att-wa-bar');
  var barText = document.getElementById('att-wa-bar-text');
  var barLink = document.getElementById('att-wa-bar-link');
  if(bar && barText && barLink) {
    barText.textContent = '💬 Send WhatsApp to ' + displayName + '?';
    barLink.href = url;
    bar.style.display = 'flex';
    bar.scrollIntoView({behavior:'smooth', block:'nearest'});
  }
}

function sendCompDayWhatsApp(custName, contact, packType, packStartDate, compType, centerId) {
  if(!contact) return;
  var phone = (contact||'').replace(/\D/g,'');
  if(phone.length===10) phone = COUNTRY_CODE + phone;
  var activeCenter = ACTIVE_CENTER && D.centers.find(function(c){return c.id===ACTIVE_CENTER;});
  var custCenter = centerId && D.centers.find(function(c){return c.id===centerId;});
  var cn = (activeCenter && activeCenter.name) || (custCenter && custCenter.name) || (OWNER_PROFILE && OWNER_PROFILE.center_name) || (D.centers.length && D.centers[0].name) || 'our Wellness Center';

  var freeItems = compType === 'shake'
    ? 'a *free health checkup, counselling & nutritional shake*'
    : 'a *free health checkup & counselling session*';

  var totalDays = parsePack(packType);

  var msg = 'Hi '+custName+'! 🌿 Welcome to *'+cn+'*!\n\n'
    + '🎁 *Today is your complementary day!*\nEnjoy '+freeItems+' — completely on us!\n\n'
    + '📅 Your *'+totalDays+'-serving pack* starts *'+packStartDate+'* (tomorrow).\n\n'
    + 'We\'re excited to be part of your wellness journey. See you tomorrow for Day 1! 💪💚\n\n'
    + '— '+cn;
  window.open('https://api.whatsapp.com/send?phone='+phone+'&text='+encodeURIComponent(msg), '_blank');
}

function renderAttGrid() {
  var monthStr = document.getElementById('att-month-picker').value;
  if(!monthStr) return;
  var parts = monthStr.split('-');
  var y=parseInt(parts[0]), m=parseInt(parts[1]);
  var daysInMonth = new Date(y, m, 0).getDate();
  var custRows = filterByCenter(D.customers).filter(function(c){
    var pIds = getPersonIds(c.id);
    var isConvertedCoach = pIds.length > 1 && D.coaches.some(function(co){ return co.id === c.pack_owner_id; });
    if (isConvertedCoach) return false;

    var hasAttThisMonth = D.attendance.some(function(a){return a.customer_id===c.id&&a.date&&a.date.startsWith(monthStr);});
    if(hasAttThisMonth) return true; // always show if they actually attended this month
    if(!getDaysLeft(c).active) return false; // expired pack, no attendance — hide
    if(isInactive(c) && !ATT_SHOW_INACTIVE) return false; // inactive, toggle off — hide
    return true;
  }).map(function(c){ return {id:c.id, name:c.name, obj:c, isCoach:false}; });
  var coachRows = filterByCenter(D.coaches).filter(function(c){
    var pIds = getPersonIds(c.id);
    return (c.pack_type && c.pack_start_date) || D.attendance.some(function(a){return pIds.indexOf(a.customer_id) !== -1&&a.date&&a.date.startsWith(monthStr);});
  })
    .map(function(c){ return {id:c.id, name:c.name, obj:c, isCoach:true}; });
  var allRows = custRows.concat(coachRows);

  var html = '<thead><tr><th style="min-width:140px;position:sticky;left:0;background:var(--surface2);z-index:2">Name</th>';
  for(var i=1; i<=daysInMonth; i++) html += '<th>'+i+'</th>';
  html += '<th>Total</th><th>Days Left</th></tr></thead><tbody>';

  if(!allRows.length) html += '<tr><td colspan="'+(daysInMonth+3)+'"><div class="empty"><p>No relevant customers or coaches</p></div></td></tr>';
  else {
    allRows.forEach(function(p) {
      var c = p.obj;
      var inactive = !p.isCoach && isInactive(c);
      if(inactive) html += '<tr class="alert-row">'; else html += '<tr>';
      var coachBadge = p.isCoach ? '<span class="badge" style="margin-left:5px;background:#6366f1;color:#fff">Coach</span>' : '';
      var inactiveBadge = inactive ? '<span class="badge br" style="margin-left:5px">Inactive</span>' : '';
      html += '<td style="position:sticky;left:0;background:'+(inactive?'#fff5f5':'var(--surface)')+';border-right:1px solid var(--border);z-index:1"><strong>'+p.name+'</strong>'+coachBadge+inactiveBadge+'</td>';
      var presentSet = new Set();
      for(var i=1; i<=daysInMonth; i++) {
        var dStr = monthStr+'-'+(i<10?'0':'')+i;
        var pIds = getPersonIds(p.id);
        var att = D.attendance.find(function(a){return pIds.indexOf(a.customer_id) !== -1 && a.date===dStr;});
        var st = att ? att.status : '';
        var servCount = att ? (Number(att.servings) || 1) : 0;
        var cls = st==='present' ? 'p' : (st==='absent' ? 'a' : (st==='complementary' ? 'c' : ''));
        var txt = st==='present' ? (servCount > 1 ? servCount : 'P') : (st==='absent' ? 'A' : (st==='complementary' ? '🎁' : '—'));
        if(st==='present') presentSet.add(dStr);
        html += '<td class="att-cell '+cls+'" onclick="gridCellClick(\''+p.id+'\',\''+p.name+'\',\''+dStr+'\',\''+st+'\','+servCount+')">'+txt+'</td>';
      }
      var presentCount = presentSet.size;
      var stLeft = getDaysLeft(c);
      var daysLeftHtml = '';
      if(!c.pack_start_date) daysLeftHtml = '<span class="badge" style="background:var(--muted);color:#fff">No Pack</span>';
      else if(stLeft.days > 5) daysLeftHtml = '<span class="badge" style="background:var(--success);color:#fff">'+stLeft.days+'</span>';
      else if(stLeft.days >= 3) daysLeftHtml = '<span class="badge" style="background:orange;color:#fff">'+stLeft.days+'</span>';
      else if(stLeft.days > 0) daysLeftHtml = '<span class="badge" style="background:var(--danger);color:#fff">'+stLeft.days+'</span>';
      else daysLeftHtml = '<span class="badge" style="background:var(--danger);color:#fff">RENEW</span>';
      html += '<td style="font-weight:bold;text-align:center">'+presentCount+'</td><td style="text-align:center">'+daysLeftHtml+'</td></tr>';
    });
  }
  html += '</tbody>';
  document.getElementById('att-grid-table').innerHTML = html;
}

function gridCellClick(id, name, date, currentStatus, currentServings) {
  if(currentStatus !== 'present') {
    // Not yet marked — just mark present
    toggleAtt(id, name, date, currentStatus);
    return;
  }
  // Already present — show edit popup instead of adding more servings
  var popup = document.getElementById('grid-cell-popup');
  if(!popup) {
    popup = document.createElement('div');
    popup.id = 'grid-cell-popup';
    popup.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--surface);border:1.5px solid var(--border);border-radius:12px;padding:20px 24px;z-index:9999;box-shadow:0 8px 32px rgba(0,0,0,0.18);min-width:240px;text-align:center';
    document.body.appendChild(popup);
  }
  popup.innerHTML = '<div style="font-weight:700;font-size:15px;margin-bottom:4px">'+name+'</div>'
    + '<div style="color:var(--muted);font-size:12px;margin-bottom:16px">'+date+'</div>'
    + '<div style="margin-bottom:14px"><label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px">Servings</label>'
    + '<div style="display:flex;align-items:center;justify-content:center;gap:10px">'
    + '<button onclick="gridServAdj(-1)" style="width:32px;height:32px;border-radius:50%;border:1.5px solid var(--border);background:var(--surface2);font-size:18px;cursor:pointer;line-height:1">−</button>'
    + '<span id="grid-serv-val" style="font-size:22px;font-weight:700;min-width:32px">'+currentServings+'</span>'
    + '<button onclick="gridServAdj(1)" style="width:32px;height:32px;border-radius:50%;border:1.5px solid var(--border);background:var(--surface2);font-size:18px;cursor:pointer;line-height:1">+</button>'
    + '</div></div>'
    + '<button onclick="gridServSave(\''+id+'\',\''+name+'\',\''+date+'\')" style="width:100%;padding:9px;background:var(--primary);color:#fff;border:none;border-radius:8px;font-weight:700;font-size:14px;cursor:pointer;margin-bottom:8px">✅ Save</button>'
    + '<button onclick="gridServRemove(\''+id+'\',\''+name+'\',\''+date+'\')" style="width:100%;padding:9px;background:#fee2e2;color:#dc2626;border:1.5px solid #fca5a5;border-radius:8px;font-weight:600;font-size:13px;cursor:pointer;margin-bottom:8px">🗑 Remove Attendance</button>'
    + '<button onclick="document.getElementById(\'grid-cell-popup\').style.display=\'none\'" style="width:100%;padding:7px;background:transparent;border:1px solid var(--border);border-radius:8px;font-size:12px;cursor:pointer;color:var(--muted)">Cancel</button>';
  popup._attId = id; popup._attName = name; popup._attDate = date;
  popup.style.display = 'block';
}
function gridServAdj(delta) {
  var el = document.getElementById('grid-serv-val');
  var v = Math.max(1, (parseInt(el.textContent)||1) + delta);
  el.textContent = v;
}
async function gridServSave(id, name, date) {
  var v = parseInt(document.getElementById('grid-serv-val').textContent) || 1;
  document.getElementById('grid-cell-popup').style.display = 'none';
  getCredentials(); if(!getActiveSbUrl()||!getActiveSbKey()) return;
  var pIds = getPersonIds(id);
  var existing = D.attendance.find(function(a){return pIds.indexOf(a.customer_id) !== -1 && a.date===date;});
  try {
    if(existing) { await dbUpdate('attendance', existing.id, {status:'present', servings:v}); }
    else { await dbInsert('attendance', {customer_id:id, customer_name:name, date:date, status:'present', servings:v}); }
    showToast(name+' — '+v+' serving'+(v!==1?'s':'')+' saved','success');
    _daysLeftCache = {};
    await loadAttendance(); renderOverview();
    sendAttendanceWhatsApp(id, name, date);
  } catch(e) { showToast('Error: '+e.message,'error'); }
}
async function gridServRemove(id, name, date) {
  document.getElementById('grid-cell-popup').style.display = 'none';
  await resetAtt(id, name, date);
}

function renderAttendance() {
  if(ATT_TAB==='monthly') return renderAttGrid();
  var q = document.getElementById('att-search').value.toLowerCase();
  var _tn=new Date(); var todayStr=_tn.getFullYear()+'-'+String(_tn.getMonth()+1).padStart(2,'0')+'-'+String(_tn.getDate()).padStart(2,'0');
  
  var activeCusts = filterByCenter(D.customers).filter(function(c){
    var pIds = getPersonIds(c.id);
    var isConvertedCoach = pIds.length > 1 && D.coaches.some(function(co){ return co.id === c.pack_owner_id; });
    if (isConvertedCoach) return false;

    var packActive = getDaysLeft(c).active;
    var presentToday = D.attendance.some(function(a){ return a.customer_id===c.id && a.date===todayStr && a.status==='present'; });
    if (!packActive && !presentToday) return false; // hide expired-pack customers unless present today
    if (isInactive(c) && !ATT_SHOW_INACTIVE) return false; // hide inactive unless toggled
    return (c.name||'').toLowerCase().includes(q);
  });

  // Also include coaches who have an active pack
  var activeCoaches = filterByCenter(D.coaches).filter(function(c){
    return (c.pack_type && c.pack_start_date || c.pack_owner_id) &&
      getDaysLeft(c).active &&
      (c.name||'').toLowerCase().includes(q);
  });

  var present = [];
  var notYet = [];

  var allPersons = activeCusts.map(function(c){ return {id:c.id, name:c.name, obj:c, isCoach:false}; })
    .concat(activeCoaches.map(function(c){ return {id:c.id, name:c.name+' 👨‍🏫', obj:c, isCoach:true}; }));

  allPersons.forEach(function(p){
    var pIds = getPersonIds(p.id);
    var att = D.attendance.find(function(a){return pIds.indexOf(a.customer_id) !== -1 && a.date===todayStr;});
    var stst = att ? att.status : 'None';
    var servings = att ? (Number(att.servings) || 1) : 0;
    var st = getDaysLeft(p.obj);
    var bdg = st.days > 3 ? 'bg' : 'br';
    if(stst === 'complementary') {
      present.push('<div class="att-card" style="border-left:3px solid #f9c74f;cursor:default"><div class="att-card-name">'+p.name+' 🎁</div><div><span class="badge by">Complementary</span></div></div>');
      return;
    }
    if(stst === 'coupon_shake') {
      var csrv = att ? (Number(att.servings)||1) : 1;
      present.push('<div class="att-card" style="border-left:3px solid #25D366;cursor:default"><div class="att-card-name">'+p.name+' 🥤</div><div><span class="badge" style="background:#25D366;color:#fff">Free Shake'+(csrv>1?' ×'+csrv:'')+'</span></div></div>');
      return;
    }
    var servBadge = stst==='present' && servings > 1 ? '<span class="badge" style="background:#6366f1;color:#fff;margin-left:6px">×'+servings+'</span>' : '';
    var resetHtml = stst==='present' ? ' ondblclick="event.stopPropagation();resetAtt(\''+p.id+'\',\''+p.name+'\',\''+todayStr+'\')"' : '';
    var inactiveBadge = (!p.isCoach && isInactive(p.obj)) ? '<span style="font-size:10px;font-weight:700;background:#fff3cd;color:#92400e;border-radius:20px;padding:1px 7px;margin-left:5px">Inactive</span>' : '';
    var cardHtml = '<div class="att-card" onclick="toggleAtt(\''+p.id+'\',\''+p.name+'\',\''+todayStr+'\',\''+stst+'\')"'+resetHtml+'>' +
                     '<div class="att-card-name">'+p.name+servBadge+inactiveBadge+'</div>' +
                     '<div><span class="badge '+bdg+'">'+st.used+'/'+st.total+'</span></div>' +
                   '</div>';
    if (stst === 'present') present.push(cardHtml);
    else notYet.push(cardHtml);
  });
  
  var pList = document.getElementById('att-present-list');
  if(!present.length) pList.innerHTML = '<div style="color:var(--muted);font-size:14px;padding:15px;text-align:center;">No one present yet.</div>';
  else pList.innerHTML = present.join('');
  document.getElementById('att-present-count').textContent = '('+present.length+')';
  
  var nList = document.getElementById('att-absent-list');
  if(!notYet.length) nList.innerHTML = '<div style="color:var(--muted);font-size:14px;padding:15px;text-align:center;">All completed! 🎉</div>';
  else nList.innerHTML = notYet.join('');
  document.getElementById('att-absent-count').textContent = '('+notYet.length+')';

  document.getElementById('att-stats').innerHTML = '<div class="stat"><div class="stat-l">Today\'s Present</div><div class="stat-v" style="color:var(--success)">'+present.length+'</div></div><div class="stat"><div class="stat-l">Not Yet</div><div class="stat-v" style="color:var(--danger)">'+notYet.length+'</div></div><div class="stat"><div class="stat-l">Coaches Active</div><div class="stat-v">'+activeCoaches.length+'</div></div>';
}

// ── ARROW HELPER ──
function getArr(curr, prev, rev) {
  if(curr==null || prev==null) return '';
  var diff = curr - prev;
  if(diff===0) return '<span class="arr" style="color:var(--muted)">—</span>';
  if(diff > 0) return rev ? '<span class="arr" style="color:var(--success)">⬆️</span>' : '<span class="arr" style="color:var(--danger)">⬆️</span>';
  return rev ? '<span class="arr" style="color:var(--danger)">⬇️</span>' : '<span class="arr" style="color:var(--success)">⬇️</span>';
}

// ── RENDER BODY ──
function renderBody() {
  if (isCenterSession() && !isGrowthPlan()) {
    var _bodyLock = document.getElementById('body-body');
    if (_bodyLock) _bodyLock.innerHTML = planLockHtml('Body Composition Tracking', 'Track weight, fat%, muscle%, visceral fat and health scores over time for every customer.');
    return;
  }
  var tb = document.getElementById('body-body');
  var profileCard = document.getElementById('body-profile-card');
  var emptyPrompt = document.getElementById('body-empty-prompt');
  var recordsWrap = document.getElementById('body-records-wrap');

  // Update recheck badge
  renderRecheckBadge();

  var idealCard = document.getElementById('body-ideal-card');

  var goalCard = document.getElementById('body-goal-card');
  if (!_selectedBodyCustId) {
    profileCard.style.display = 'none';
    if (idealCard) idealCard.style.display = 'none';
    if (goalCard) goalCard.style.display = 'none';
    emptyPrompt.style.display = 'block';
    recordsWrap.style.display = 'none';
    if (tb) tb.innerHTML = '';
    var btnShare = document.getElementById('btn-body-share-card');
    if (btnShare) btnShare.style.display = 'none';
    return;
  }

  var cust = D.customers.find(function(x){ return x.id === _selectedBodyCustId; })
    || D.coaches.find(function(x){ return x.id === _selectedBodyCustId; })
    || (function(){ var w=(D.walkins||[]).find(function(x){return x.id===_selectedBodyCustId;}); return w ? {id:w.id,name:w.name+'  🚶',goal:'',pack_type:'Walk-in'} : null; })();
  if (!cust) { profileCard.style.display='none'; if(idealCard) idealCard.style.display='none'; emptyPrompt.style.display='block'; recordsWrap.style.display='none'; return; }

  // Get all records for this customer sorted oldest→newest
  var sorted = D.body
    .filter(function(b){ return b.customer_id === _selectedBodyCustId; })
    .sort(function(a,b){ return new Date(a.date) - new Date(b.date); });

  // ── Profile Card ──
  var first = sorted[0], latest = sorted[sorted.length-1];
  var totalSessions = D.attendance.filter(function(a){ return a.customer_id===_selectedBodyCustId && a.status==='present'; }).length;
  var streak = getStreak(_selectedBodyCustId);
  var lastScanDate = latest ? latest.date : null;
  var daysSinceScan = lastScanDate ? Math.floor((new Date() - new Date(lastScanDate)) / 86400000) : null;
  var recheckDue = daysSinceScan !== null && daysSinceScan >= 7;

  // Journey stats
  var wChange = (first && latest && first.weight && latest.weight) ? (Number(latest.weight) - Number(first.weight)).toFixed(1) : null;
  var fChange = (first && latest && first.fat_percentage && latest.fat_percentage) ? (Number(latest.fat_percentage) - Number(first.fat_percentage)).toFixed(1) : null;
  var mChange = (first && latest && first.muscle_percentage && latest.muscle_percentage) ? (Number(latest.muscle_percentage) - Number(first.muscle_percentage)).toFixed(1) : null;

  function diffColor(val, goodWhenNeg) {
    if (val === null) return 'rgba(255,255,255,.6)';
    var n = Number(val);
    if (n === 0) return 'rgba(255,255,255,.6)';
    return (goodWhenNeg ? n < 0 : n > 0) ? '#a8e6b8' : '#f4a7a0';
  }
  function fmtDiff(val, goodWhenNeg, unit) {
    if (val === null) return '—';
    var n = Number(val);
    return (n > 0 ? '+' : '') + val + (unit||'');
  }

  var recheckBanner = recheckDue
    ? '<div style="background:rgba(192,57,43,.18);border-radius:8px;padding:8px 12px;margin-top:12px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">'
      + '<span style="font-size:12px;font-weight:700">🔔 Recheck overdue! Last scan was '+daysSinceScan+' days ago</span>'
      + (cust.contact ? '<button class="wa-btn" style="font-size:11px;padding:3px 8px" onclick="sendRecheckWA(\''+cust.id+'\')">💬 Remind Customer</button>' : '')
      + '</div>'
    : (daysSinceScan !== null
      ? '<div style="font-size:11px;opacity:.7;margin-top:8px">Last scan: '+lastScanDate+' ('+daysSinceScan+' days ago)</div>'
      : '');

  profileCard.style.display = 'block';
  var latestVfKg = latest ? parseFloat(latest.visceral_fat) || 0 : 0;
  profileCard.innerHTML = svBuildHealthScoreCard(latest ? latest.bmi : null, latest ? latest.fat_percentage : null, latestVfKg, latest ? latest.date : null, {name: cust.name, phone: cust.contact, weight: latest ? latest.weight : null, musclePct: latest ? latest.muscle_percentage : null, gender: cust.gender || ''}) +
    '<div class="body-profile">'
    +'<div class="body-profile-name">'+cust.name+'</div>'
    +'<div class="body-profile-meta">'
      +(cust.goal?'🎯 '+cust.goal+' &nbsp;·&nbsp; ':'')
      +(cust.gender?cust.gender+' &nbsp;·&nbsp; ':'')
      +sorted.length+' scan'+(sorted.length===1?'':'s')+' total'
      +' &nbsp;·&nbsp; '+totalSessions+' sessions &nbsp;·&nbsp; 🔥 '+streak+' streak'
    +'</div>'
    +'<div class="body-profile-stats">'
      +'<div class="body-profile-stat"><div class="body-profile-stat-lbl">Current Weight</div><div class="body-profile-stat-val">'+(latest?latest.weight+' kg':'—')+'</div>'+(wChange?'<div class="body-profile-stat-diff" style="color:'+diffColor(wChange,cust.goal==='Weight Gain')+'">'+fmtDiff(wChange,cust.goal==='Weight Gain',' kg')+'</div>':'')+'</div>'
      +'<div class="body-profile-stat"><div class="body-profile-stat-lbl">Body Fat</div><div class="body-profile-stat-val">'+(latest&&latest.fat_percentage?latest.fat_percentage+'%':'—')+'</div>'+(fChange?'<div class="body-profile-stat-diff" style="color:'+diffColor(fChange,true)+'">'+fmtDiff(fChange,true,' %')+'</div>':'')+'</div>'
      +'<div class="body-profile-stat"><div class="body-profile-stat-lbl">Muscle</div><div class="body-profile-stat-val">'+(latest&&latest.muscle_percentage?latest.muscle_percentage+'%':'—')+'</div>'+(mChange?'<div class="body-profile-stat-diff" style="color:'+diffColor(mChange,false)+'">'+fmtDiff(mChange,false,' %')+'</div>':'')+'</div>'
      +'<div class="body-profile-stat"><div class="body-profile-stat-lbl">BMI</div><div class="body-profile-stat-val">'+(latest?latest.bmi||'—':'—')+'</div></div>'
      +'<div class="body-profile-stat"><div class="body-profile-stat-lbl">BMR</div><div class="body-profile-stat-val">'+(latest?latest.bmr||'—':'—')+'</div></div>'
    +'</div>'
    + recheckBanner
    +'</div>';

  // ── Ideal Values Card ──
  renderIdealCard(cust, latest);

  // ── Goal Progress Card ──
  try { renderBodyGoalCard(cust, latest); } catch(e) { console.error('renderBodyGoalCard:', e); }

  // Show records
  emptyPrompt.style.display = 'none';
  recordsWrap.style.display = 'block';

  var btnShare = document.getElementById('btn-body-share-card');
  if (btnShare) btnShare.style.display = sorted.length >= 2 ? 'inline-block' : 'none';

  if (!sorted.length) {
    tb.innerHTML = '<tr><td colspan="10"><div class="empty"><div class="ei">⚖️</div><p>No scans recorded yet. Click + Add Record!</p></div></td></tr>';
    return;
  }

  // Render rows oldest first (latest at bottom for easy comparison)
  var goal = cust.goal || 'Weight Loss';
  var revWeight = goal === 'Weight Gain';

  tb.innerHTML = sorted.map(function(b, idx) {
    var prev = sorted[idx - 1] || null; // previous scan (chronologically older)

    var cw  = Number(b.weight),              pw  = prev ? Number(prev.weight)               : null;
    var cf  = Number(b.fat_percentage),       pf  = prev ? Number(prev.fat_percentage)       : null;
    var csf = Number(b.subcutaneous_fat_percentage), psf = prev ? Number(prev.subcutaneous_fat_percentage) : null;
    var cm  = Number(b.muscle_percentage),    pm  = prev ? Number(prev.muscle_percentage)    : null;

    var cfKg  = (cw&&cf)  ? parseFloat((cw*cf/100).toFixed(2))  : null;
    var pfKg  = (pw&&pf)  ? parseFloat((pw*pf/100).toFixed(2))  : null;
    var csfKg = (cw&&csf) ? parseFloat((cw*csf/100).toFixed(2)) : null;
    var psfKg = (pw&&psf) ? parseFloat((pw*psf/100).toFixed(2)) : null;
    var cmKg  = (cw&&cm)  ? parseFloat((cw*cm/100).toFixed(2))  : null;
    var pmKg  = (pw&&pm)  ? parseFloat((pw*pm/100).toFixed(2))  : null;
    var cV    = (cfKg!==null&&csfKg!==null) ? parseFloat((cfKg-csfKg).toFixed(2)) : null;
    var pV    = (pfKg!==null&&psfKg!==null) ? parseFloat((pfKg-psfKg).toFixed(2)) : null;

    var isMostRecent = idx === sorted.length - 1; // latest is last row
    var count = sorted.length;
    var aiBtns = '';
    if (count===1) aiBtns += '<button class="btn-p" style="font-size:11px;padding:3px 5px;margin-right:3px;background:#9333ea" onclick="generateFirstScanReport(\''+b.customer_id+'\')">🟣 First AI</button>';
    else if (count>=2 && isMostRecent) {
      aiBtns += '<button class="btn-p" style="font-size:11px;padding:3px 5px;margin-right:3px;background:#8b5cf6" onclick="generateWeeklyReport(\''+b.customer_id+'\')">📅 Weekly AI</button>';
      if (count>=3) aiBtns += '<button class="btn-p" style="font-size:11px;padding:3px 5px;margin-right:3px;background:#10b981" onclick="generateFullProgressReport(\''+b.customer_id+'\')">🟩 Full</button>';
    }

    // Highlight most recent row
    var rowStyle = isMostRecent ? ' style="background:#f0fdf4"' : '';

    var cv  = b.visceral_fat   ? Number(b.visceral_fat)   : null;
    var pv  = prev && prev.visceral_fat ? Number(prev.visceral_fat) : null;
    function kgCell(kg, pct, pKg, goodWhenDown) {
      if (kg === null && !pct) return '<td>—</td>';
      var main = kg !== null ? kg + ' kg' : (pct ? pct + '%' : '—');
      var sub  = (kg !== null && pct) ? '<div style="font-size:11px;color:var(--muted);line-height:1">' + pct + '%</div>' : '';
      var arr  = kg !== null ? getArr(kg, pKg, goodWhenDown) : '';
      return '<td style="line-height:1.4">' + main + arr + sub + '</td>';
    }
    return '<tr'+rowStyle+'>'
      +'<td>'+b.date+(isMostRecent ? ' <span class="badge bg" style="font-size:9px">Latest</span>' : '')+'</td>'
      +'<td>'+(cw||'—')+getArr(cw,pw,revWeight)+'</td>'
      +kgCell(cfKg, cf, pfKg, true)
      +'<td>'+(cv!==null?cv:'—')+getArr(cv,pv,false)+'</td>'
      +'<td>'+(b.bmr||'—')+'</td>'
      +'<td>'+(b.bmi||'—')+'</td>'
      +'<td>'+(b.body_age||'—')+'</td>'
      +kgCell(csfKg, csf, psfKg, true)
      +kgCell(cmKg, cm, pmKg, false)
      +'<td><div class="acts">'+aiBtns
        +'<button class="btn-p" style="font-size:11px;padding:3px 5px;margin-right:3px;background:#f9c74f;color:#333" onclick="sendMilestoneWA(\''+b.customer_id+'\')">🏆</button>'
        +'<button class="btn-p" style="font-size:11px;padding:3px 5px;margin-right:3px" onclick="askBodyAI(\''+b.customer_id+'\',\''+b.id+'\')">✨</button>'
        +'<button class="btn-e" onclick="editBody(\''+b.id+'\')">Edit</button>'
        +'<button class="btn-d" onclick="delRecord(\'body_composition\',\''+b.id+'\',\'body\')">Del</button>'
      +'</div></td>'
      +'</tr>'
      +'<tr id="ai-row-'+b.id+'" style="display:none"><td colspan="10"><div id="ai-content-'+b.id+'" style="padding:15px;background:var(--surface2);border-radius:8px;margin:5px 0;font-size:14px;line-height:1.5;color:var(--text)">Loading...</div></td></tr>';
  }).join('');
}

// ── Ideal Values Card ──
function renderIdealCard(cust, latest, elId) {
  var card = document.getElementById(elId || 'body-ideal-card');
  if (!card) return;

  if (!latest) { card.style.display = 'none'; return; }

  var gender = (cust.gender || '').toLowerCase();
  var isMale = gender === 'male';
  var isFemale = gender === 'female';

  var h = latest.height ? Number(latest.height) / 100 : null;
  var w = latest.weight ? Number(latest.weight) : null;

  // Convert % range to kg using current weight
  function pctToKg(pct) { return (w && pct) ? +((w * pct) / 100).toFixed(2) : null; }

  // Age from DOB
  var age = cust.dob ? (new Date().getFullYear() - parseInt(cust.dob)) : null;

  // Height-weight lookup table (height in cm → [lo, hi] kg)
  var HW_TABLE = [
    { h:152, m:null,    f:[50,54] },
    { h:154, m:null,    f:[51,55] },
    { h:157, m:[56,60], f:[53,56] },
    { h:159, m:[57,61], f:[54,58] },
    { h:162, m:[59,63], f:[56,60] },
    { h:165, m:[61,65], f:[58,61] },
    { h:167, m:[62,67], f:[59,64] },
    { h:170, m:[64,68], f:[61,65] },
    { h:172, m:[66,71], f:[62,67] },
    { h:175, m:[68,73], f:[64,69] },
    { h:177, m:[69,74], f:[66,70] },
    { h:180, m:[71,76], f:[67,72] },
    { h:182, m:[73,78], f:[67,72] },
    { h:185, m:[75,81], f:[67,74] },
    { h:187, m:[77,84], f:null    }
  ];

  // Ideal weight range from chart (nearest height match)
  var wtLo = null, wtHi = null, wtNote = 'Enter height in record to see ideal';
  var hCm = latest.height ? Number(latest.height) : null;
  if (hCm) {
    var best = HW_TABLE.reduce(function(a, b) {
      return Math.abs(b.h - hCm) < Math.abs(a.h - hCm) ? b : a;
    });
    var hwRng = isMale ? best.m : isFemale ? best.f : (best.m || best.f);
    if (hwRng) { wtLo = hwRng[0]; wtHi = hwRng[1]; wtNote = 'Ideal for height ' + hCm + ' cm'; }
    else { wtNote = 'Height ' + hCm + ' cm not in chart range'; }
  }

  // Fat % ideal ranges by age & gender
  var fatLoPct, fatHiPct;
  if (isMale) {
    if (!age || age <= 30)  { fatLoPct=12; fatHiPct=18; }
    else if (age <= 40)     { fatLoPct=13; fatHiPct=19; }
    else if (age <= 50)     { fatLoPct=14; fatHiPct=20; }
    else if (age <= 60)     { fatLoPct=16; fatHiPct=20; }
    else                    { fatLoPct=17; fatHiPct=21; }
  } else if (isFemale) {
    if (!age || age <= 30)  { fatLoPct=20; fatHiPct=26; }
    else if (age <= 40)     { fatLoPct=21; fatHiPct=27; }
    else if (age <= 50)     { fatLoPct=22; fatHiPct=30; }
    else if (age <= 60)     { fatLoPct=22; fatHiPct=30; }
    else                    { fatLoPct=23; fatHiPct=31; }
  } else {
    fatLoPct=12; fatHiPct=26;
  }
  var fatAgeNote = age ? ' (age ' + age + ')' : '';

  // Muscle % — minimum thresholds (higher is better, no upper cap)
  var musLoPct = isMale ? 38 : isFemale ? 35 : 35;
  var musHiPct = 70;
  // Subcutaneous fat % ideal ranges by gender
  var sfLoPct  = isMale ? 8  : isFemale ? 15 : 8;
  var sfHiPct  = isMale ? 16 : isFemale ? 23 : 23;

  var metrics = [
    {
      icon: '⚖️', label: 'Weight',
      val: w, unit: ' kg',
      lo: wtLo, hi: wtHi,
      note: wtNote
    },
    {
      icon: '🔥', label: 'Body Fat',
      val: pctToKg(latest.fat_percentage), unit: ' kg',
      lo: pctToKg(fatLoPct), hi: pctToKg(fatHiPct),
      note: (isMale ? 'Male' : isFemale ? 'Female' : 'General') + ' ideal: ' + fatLoPct + '–' + fatHiPct + '%' + fatAgeNote + (w ? '' : ' (enter weight to see kg)')
    },
    {
      icon: '💪', label: 'Muscle',
      val: pctToKg(latest.muscle_percentage), unit: ' kg',
      lo: pctToKg(musLoPct), hi: pctToKg(musHiPct),
      note: 'Min. ' + musLoPct + '% for ' + (isMale ? 'men' : isFemale ? 'women' : 'general') + (w ? '' : ' (enter weight to see kg)')
    },
    {
      icon: '📊', label: 'BMI',
      val: latest.bmi ? Number(latest.bmi) : null, unit: '',
      lo: 18.5, hi: 24.9,
      note: 'Normal: 18.5 – 24.9'
    },
    {
      icon: '🫀', label: 'Visceral Fat',
      val: pctToKg(latest.visceral_fat), unit: ' kg',
      lo: pctToKg(6), hi: pctToKg(8),
      note: 'Ideal: 6–8% of body weight (avg 7%)' + (w ? '' : ' (enter weight to see kg)')
    },
    {
      icon: '🧬', label: 'Subcutaneous Fat',
      val: pctToKg(latest.subcutaneous_fat_percentage), unit: ' kg',
      lo: pctToKg(sfLoPct), hi: pctToKg(sfHiPct),
      note: (isMale ? 'Male' : isFemale ? 'Female' : 'General') + ' ideal: ' + sfLoPct + '–' + sfHiPct + '% of body weight' + (w ? '' : ' (enter weight to see kg)')
    }
  ];

  function statusInfo(m) {
    if (m.val === null || m.lo === null || m.hi === null) return { label: 'No Data', color: '#94a3b8', bg: '#f8fafc', pct: 0 };
    if (m.val < m.lo) return { label: 'Too Low', color: '#f59e0b', bg: '#fffbeb', pct: Math.round((m.val / m.lo) * 60) };
    if (m.val > m.hi) return { label: 'Too High', color: '#ef4444', bg: '#fef2f2', pct: 100 };
    var pct = Math.round(((m.val - m.lo) / (m.hi - m.lo)) * 100);
    return { label: 'On Target ✓', color: '#16a34a', bg: '#f0fdf4', pct: pct };
  }

  var rows = metrics.map(function(m) {
    var s = statusInfo(m);
    // Target = midpoint of ideal range
    var target = (m.lo !== null && m.hi !== null) ? +((m.lo + m.hi) / 2).toFixed(2) : null;
    var targetStr = target !== null ? target + m.unit : '—';
    var valStr = m.val !== null ? m.val + m.unit : '—';
    // How much to gain/lose to reach target
    var diff = (m.val !== null && target !== null) ? +((target - m.val)).toFixed(2) : null;
    var diffStr = diff !== null && diff !== 0
      ? (diff > 0 ? '▲ Need +' : '▼ Need ') + Math.abs(diff) + m.unit
      : (diff === 0 ? 'At target!' : '');
    var diffColor = diff === null ? '' : diff === 0 ? '#16a34a' : s.color;
    var fillPct = Math.max(0, Math.min(100, s.pct));

    return '<div style="background:'+s.bg+';border:1.5px solid '+(s.color==='#94a3b8'?'#e2e8f0':s.color+'33')+';border-radius:12px;padding:16px 18px">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">'
        + '<div style="display:flex;align-items:center;gap:12px">'
          + '<span style="font-size:26px;line-height:1">'+m.icon+'</span>'
          + '<div>'
            + '<div style="font-weight:700;font-size:15px;color:#1e293b">'+m.label+'</div>'
            + '<div style="font-size:11px;color:#64748b;margin-top:2px">'+m.note+'</div>'
          + '</div>'
        + '</div>'
        + '<div style="text-align:right;min-width:90px">'
          + '<div style="font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:.4px">Current</div>'
          + '<div style="font-size:24px;font-weight:800;color:'+s.color+';font-family:\'DM Serif Display\',serif;line-height:1.1">'+valStr+'</div>'
          + (diff !== null ? '<div style="font-size:11px;font-weight:700;color:'+diffColor+';margin-top:3px">'+diffStr+'</div>' : '')
        + '</div>'
      + '</div>'
      + '<div style="margin-top:14px;display:flex;align-items:center;justify-content:space-between;background:rgba(0,0,0,.04);border-radius:8px;padding:10px 14px">'
        + '<div style="text-align:center">'
          + '<div style="font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:.4px">Your Value</div>'
          + '<div style="font-size:16px;font-weight:800;color:'+s.color+'">'+valStr+'</div>'
        + '</div>'
        + '<div style="font-size:20px;color:#cbd5e1">→</div>'
        + '<div style="text-align:center">'
          + '<div style="font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:.4px">🎯 Target</div>'
          + '<div style="font-size:18px;font-weight:800;color:#2d5a3d">'+targetStr+'</div>'
        + '</div>'
        + '<div style="text-align:center">'
          + '<div style="font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;background:'+(s.color==='#94a3b8'?'#e2e8f0':s.color+'22')+';color:'+s.color+'">'+s.label+'</div>'
        + '</div>'
      + '</div>'
      + '<div style="margin-top:10px">'
        + '<div style="height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden">'
          + '<div style="height:8px;width:'+fillPct+'%;background:'+s.color+';border-radius:4px;transition:width .4s ease"></div>'
        + '</div>'
      + '</div>'
    + '</div>';
  }).join('');

  card.style.display = 'block';
  card.innerHTML = '<div class="tcard" style="padding:20px 22px">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">'
      + '<div>'
        + '<div style="font-size:17px;font-weight:800;color:var(--text)">🎯 Body Target Report</div>'
        + '<div style="font-size:12px;color:var(--muted);margin-top:3px">'+cust.name+' &nbsp;·&nbsp; Latest scan: '+(latest.date||'—')+(cust.gender?' &nbsp;·&nbsp; '+cust.gender:'')+'</div>'
      + '</div>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px">'
      + rows
    + '</div>'
  + '</div>';
}

// ── Recheck Badge ──
function renderRecheckBadge() {
  var overdue = D.customers.filter(function(c){
    var recs = D.body.filter(function(b){return b.customer_id===c.id;});
    if (!recs.length) return false;
    var latest = recs.sort(function(a,b){return new Date(b.date)-new Date(a.date);})[0];
    var days = Math.floor((new Date() - new Date(latest.date)) / 86400000);
    return days >= 7;
  });
  var badge = document.getElementById('recheck-count-badge');
  if (badge) badge.textContent = overdue.length;
}

// ── Recheck Due List ──
function renderRecheckList() {
  var container = document.getElementById('recheck-list');
  if (!container) return;

  // Build list: all active customers with last scan date
  var custData = D.customers.map(function(c) {
    var recs = D.body.filter(function(b){return b.customer_id===c.id;})
                     .sort(function(a,b){return new Date(b.date)-new Date(a.date);});
    var lastScan = recs.length ? recs[0].date : null;
    var days = lastScan ? Math.floor((new Date() - new Date(lastScan)) / 86400000) : 9999;
    var neverScanned = !lastScan;
    return { c:c, lastScan:lastScan, days:days, neverScanned:neverScanned };
  }).filter(function(x){ return x.days >= 7; })
    .sort(function(a,b){ return b.days - a.days; });

  if (!custData.length) {
    container.innerHTML = '<div class="tcard" style="padding:40px;text-align:center;color:var(--muted)"><div style="font-size:36px;margin-bottom:10px">✅</div><p style="font-size:15px;font-weight:600;color:var(--text)">All customers are up to date!</p><p style="font-size:13px;margin-top:4px">Everyone has a body scan within the last 7 days.</p></div>';
    return;
  }

  var html = '<div style="margin-bottom:12px;font-size:13px;color:var(--muted)">'+custData.length+' customer'+(custData.length>1?'s':'')+' need a recheck</div>';
  html += custData.map(function(x){
    var c = x.c;
    var isOverdue = x.days >= 14;
    var cls = isOverdue ? 'overdue' : 'due-soon';
    var dayLabel = x.neverScanned ? 'Never scanned' : x.days + ' days since last scan';
    var phone = (c.contact||'').replace(/\D/g,'');
    if (phone.length===10) phone=COUNTRY_CODE+phone;

    return '<div class="recheck-card '+cls+'">'
      +'<div>'
        +'<div style="font-weight:700;font-size:14px">'+c.name+(isOverdue?' <span class="badge br" style="font-size:10px">Overdue</span>':' <span class="badge by" style="font-size:10px">Due</span>')+'</div>'
        +'<div style="font-size:12px;color:var(--muted);margin-top:3px">'+dayLabel+(x.lastScan?' &nbsp;·&nbsp; Last: '+x.lastScan:'')+'</div>'
        +(c.goal ? '<div style="font-size:11px;color:var(--primary);margin-top:3px">🎯 '+c.goal+'</div>' : '')
      +'</div>'
      +'<div style="display:flex;align-items:center;gap:10px">'
        +'<div style="text-align:center"><div class="recheck-days" style="color:'+(isOverdue?'var(--danger)':'var(--accent)')+'">'+( x.neverScanned ? '∞' : x.days)+'</div><div style="font-size:10px;color:var(--muted)">days</div></div>'
        +'<div style="display:flex;flex-direction:column;gap:5px">'
          +(phone ? '<button class="wa-btn" style="font-size:11px;padding:4px 10px" onclick="sendRecheckWA(\''+c.id+'\')">💬 Remind</button>' : '')
          +'<button class="btn-p" style="font-size:11px;padding:4px 10px" onclick="selectBodyCustomer(\''+c.id+'\')">📋 View Records</button>'
        +'</div>'
      +'</div>'
      +'</div>';
  }).join('');

  container.innerHTML = html;
}

// Select customer and switch to records tab
function selectBodyCustomer(cid) {
  _selectedBodyCustId = cid;
  var sel = document.getElementById('body-cust-select');
  if (sel) sel.value = cid;
  switchBodyTab('records', document.getElementById('body-tab-records'));
  renderBody();
}

// ── Daily Check-in Summary WhatsApp ──
function sendDailySummaryWA() {
  var today = new Date().toISOString().split('T')[0];
  var tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  var centerName = getCenterName();
  var custs = ACTIVE_CENTER ? filterByCenter(D.customers) : D.customers;

  // Who attended today
  var presentIds = new Set(
    D.attendance.filter(function(a){ return a.date === today && a.status === 'present'; })
               .map(function(a){ return a.customer_id; })
  );

  // Active customers who didn't come
  var activeCusts = custs.filter(function(c){ return getDaysLeft(c).active; });
  var present = activeCusts.filter(function(c){ return presentIds.has(c.id); });
  var absent  = activeCusts.filter(function(c){ return !presentIds.has(c.id); });

  // Expiring tomorrow
  var expiringTomorrow = custs.filter(function(c){ return c.pack_end_date === tomorrow; });

  // Expiring today
  var expiringToday = custs.filter(function(c){ return c.pack_end_date === today; });

  var dateStr = new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' });

  var lines = [];
  lines.push('📊 *Daily Summary — ' + centerName + '*');
  lines.push('📅 ' + dateStr);
  lines.push('');
  lines.push('✅ *Present (' + present.length + ')*');
  if (present.length) lines.push(present.map(function(c){ return '  • ' + c.name; }).join('\n'));
  else lines.push('  — None yet');
  lines.push('');
  lines.push('❌ *Absent (' + absent.length + ')*');
  if (absent.length) lines.push(absent.map(function(c){ return '  • ' + c.name; }).join('\n'));
  else lines.push('  — All active customers attended! 🎉');

  if (expiringToday.length) {
    lines.push('');
    lines.push('⚠️ *Packs Expiring Today (' + expiringToday.length + ')*');
    lines.push(expiringToday.map(function(c){ return '  • ' + c.name; }).join('\n'));
  }
  if (expiringTomorrow.length) {
    lines.push('');
    lines.push('🔔 *Packs Expiring Tomorrow (' + expiringTomorrow.length + ')*');
    lines.push(expiringTomorrow.map(function(c){ return '  • ' + c.name; }).join('\n'));
  }

  lines.push('');
  lines.push('_Sent via PulseIQ_ 💚');

  var msg = lines.join('\n');

  // Get supervisor's own phone from first center owner contact or prompt
  var myPhone = localStorage.getItem('supervisorPhone') || '';
  if (!myPhone) {
    myPhone = prompt('Enter your WhatsApp number (with country code, e.g. 917981614593) to receive summaries:') || '';
    if (myPhone) localStorage.setItem('supervisorPhone', myPhone.replace(/\D/g,''));
  }
  myPhone = myPhone.replace(/\D/g,'');

  if (myPhone) {
    window.open('https://api.whatsapp.com/send?phone=' + myPhone + '&text=' + encodeURIComponent(msg), '_blank');
  } else {
    // Fallback: copy to clipboard
    navigator.clipboard.writeText(msg).then(function(){
      showToast('Summary copied to clipboard! Paste in WhatsApp.', 'success');
    }).catch(function(){
      showToast('No phone set. Open WhatsApp and paste manually.', 'error');
      console.log(msg);
    });
  }
}

// ── Recheck WhatsApp reminder ──
function sendRecheckWA(cid) {
  var c = D.customers.find(function(x){return x.id===cid;});
  if (!c || !c.contact) return;
  var recs = D.body.filter(function(b){return b.customer_id===cid;}).sort(function(a,b){return new Date(b.date)-new Date(a.date);});
  var lastScan = recs.length ? recs[0].date : null;
  var days = lastScan ? Math.floor((new Date()-new Date(lastScan))/86400000) : null;
  var msg = '🌿 *Body Scan Reminder — '+getCenterName()+'*\n\n'
    +'Hi *'+c.name+'*! 😊\n\n'
    +(days ? 'It\'s been *'+days+' days* since your last body scan.' : 'You haven\'t done a body scan yet!')
    +' Time for your weekly recheck! 📊\n\n'
    +'Regular scans help us track your progress accurately and adjust your plan for the best results.\n\n'
    +'📅 *Please visit the center this week for your scan.*\n\n'
    +'_Your '+getCenterName()+' Team_ 💚';
  var phone = c.contact.replace(/\D/g,'');
  if (phone.length===10) phone=COUNTRY_CODE+phone;
  window.open('https://api.whatsapp.com/send?phone='+phone+'&text='+encodeURIComponent(msg),'_blank');
}


// ── RENDER FINANCE ──

// ── FINANCE PERIOD FILTER ──
var _finPeriod = 'month';
function setFinPeriod(period, btn) {
  _finPeriod = period;
  document.querySelectorAll('.fin-period').forEach(function(b){b.classList.remove('active');b.style.background='';b.style.color='';b.style.borderColor='';});
  if (btn) { btn.classList.add('active'); btn.style.background='var(--primary)'; btn.style.color='#fff'; btn.style.borderColor='var(--primary)'; }
  if (period !== 'custom') {
    var now = new Date(), y = now.getFullYear(), m = now.getMonth();
    var from, to;
    if (period === 'month') { from = new Date(y,m,1); to = new Date(y,m+1,0); }
    else if (period === 'lastmonth') { from = new Date(y,m-1,1); to = new Date(y,m,0); }
    else if (period === 'year') { from = new Date(y,0,1); to = new Date(y,11,31); }
    else { from = null; to = null; }
    document.getElementById('fin-from').value = from ? from.toISOString().split('T')[0] : '';
    document.getElementById('fin-to').value = to ? to.toISOString().split('T')[0] : '';
  }
  renderFinance();
}
function _getFinFiltered() {
  var from = document.getElementById('fin-from').value;
  var to   = document.getElementById('fin-to').value;
  var q    = document.getElementById('fin-search').value.toLowerCase();
  var base = ACTIVE_CENTER ? filterFinanceByCenter(D.finance) : D.finance;
  return base.filter(function(f){
    if (!f.date) return false;                    // exclude null-dated entries
    if (from && f.date < from) return false;
    if (to   && f.date > to)   return false;
    if (q && !(f.description||'').toLowerCase().includes(q) && !(f.category||'').toLowerCase().includes(q)) return false;
    return true;
  });
}
function renderFinance() {
  if (isCenterSession() && !isGrowthPlan()) {
    var _finLock = document.getElementById('fin-body');
    if (_finLock) _finLock.innerHTML = '<tr><td colspan="6">'+planLockHtml('Finance Dashboard', 'Track income, expenses, net profit and pending payments for your center.')+'</td></tr>';
    return;
  }
  var rows = _getFinFiltered();
  var tb = document.getElementById('fin-body');
  if (!rows.length) { tb.innerHTML='<tr><td colspan="6"><div class="empty"><div class="ei">💰</div><p>No transactions yet.</p></div></td></tr>'; }
  else tb.innerHTML = rows.map(function(f){ return '<tr class="'+f.type+'-row"><td><span class="badge '+(f.type==='income'?'bg':'br')+'">'+f.type+'</span></td><td>'+(f.description||'—')+'</td><td><strong>₹'+Number(f.amount).toLocaleString('en-IN')+'</strong></td><td>'+(f.category||'—')+'</td><td>'+f.date+'</td><td><div class="acts"><button class="btn-e" onclick="editFinance(\''+f.id+'\')">Edit</button><button class="btn-d" onclick="delRecord(\'finance\',\''+f.id+'\',\'finance\')">Delete</button></div></td></tr>'; }).join('');
  var inc = rows.filter(function(f){return f.type==='income';}).reduce(function(s,f){return s+Number(f.amount);},0);
  var exp = rows.filter(function(f){return f.type==='expense';}).reduce(function(s,f){return s+Number(f.amount);},0);
  var net = inc - exp;
  var margin = inc > 0 ? Math.round((net/inc)*100) : 0;
  var from = document.getElementById('fin-from').value;
  var to   = document.getElementById('fin-to').value;
  var periodLabel = (from && to) ? from + ' → ' + to : (from ? 'From ' + from : (to ? 'Until ' + to : 'All dates'));
  document.getElementById('fin-stats').innerHTML =
    '<div class="stat"><div class="stat-l">Total Income<div style="font-size:10px;color:var(--muted);font-weight:400;margin-top:2px">📅 '+periodLabel+'</div></div><div class="stat-v" style="color:var(--success)">₹'+inc.toLocaleString('en-IN')+'</div></div>'+
    '<div class="stat"><div class="stat-l">Total Expense</div><div class="stat-v" style="color:var(--danger)">₹'+exp.toLocaleString('en-IN')+'</div></div>'+
    '<div class="stat"><div class="stat-l">Net Profit</div><div class="stat-v" style="color:'+(net>=0?'var(--primary)':'var(--danger)')+'">₹'+net.toLocaleString('en-IN')+'</div></div>'+
    '<div class="stat"><div class="stat-l">Profit Margin</div><div class="stat-v" id="fin-margin" style="color:'+(margin>=0?'var(--primary)':'var(--danger)')+'">'+margin+'%</div></div>';
  // ── Category breakdown ──
  function catBreakdown(type) {
    var cats = {};
    rows.filter(function(f){return f.type===type;}).forEach(function(f){
      var c = f.category || 'Other'; cats[c] = (cats[c]||0) + Number(f.amount);
    });
    return cats;
  }
  function renderCats(cats, total, elId, color) {
    var el = document.getElementById(elId); if(!el) return;
    var entries = Object.entries(cats).sort(function(a,b){return b[1]-a[1];});
    if (!entries.length) { el.innerHTML='<div style="color:var(--muted);font-size:12px">No records in this period</div>'; return; }
    el.innerHTML = entries.map(function(e){
      var pct = total > 0 ? Math.round((e[1]/total)*100) : 0;
      return '<div style="margin-bottom:8px">'+
        '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">'+
          '<span>'+e[0]+'</span><span style="font-weight:600">₹'+e[1].toLocaleString('en-IN')+' <span style="color:var(--muted)">('+pct+'%)</span></span>'+
        '</div>'+
        '<div style="height:5px;border-radius:3px;background:var(--border)"><div style="height:5px;border-radius:3px;background:'+color+';width:'+pct+'%"></div></div>'+
      '</div>';
    }).join('');
  }
  var incCats = catBreakdown('income'), expCats = catBreakdown('expense');
  renderCats(incCats, inc, 'fin-income-cats', 'var(--success)');
  renderCats(expCats, exp, 'fin-expense-cats', 'var(--danger)');
  // ── Monthly P&L chart ──
  var all = ACTIVE_CENTER ? filterFinanceByCenter(D.finance) : D.finance;
  var monthMap = {};
  all.forEach(function(f){
    var ym = (f.date||'').slice(0,7); if(!ym) return;
    if(!monthMap[ym]) monthMap[ym]={inc:0,exp:0};
    if(f.type==='income') monthMap[ym].inc += Number(f.amount);
    else monthMap[ym].exp += Number(f.amount);
  });
  var months = Object.keys(monthMap).sort().slice(-12);
  var lbls = months.map(function(m){ var d=new Date(m+'-01'); return d.toLocaleString('default',{month:'short',year:'2-digit'}); });
  destroyChart('pl');
  if (months.length && document.getElementById('chart-pl')) {
    _charts['pl'] = new Chart(document.getElementById('chart-pl'),{
      type:'bar',
      data:{ labels:lbls, datasets:[
        {label:'Income',data:months.map(function(m){return monthMap[m].inc;}),backgroundColor:'rgba(34,197,94,.7)',borderRadius:4},
        {label:'Expense',data:months.map(function(m){return monthMap[m].exp;}),backgroundColor:'rgba(239,68,68,.7)',borderRadius:4},
        {label:'Net',data:months.map(function(m){return monthMap[m].inc-monthMap[m].exp;}),type:'line',borderColor:'var(--primary)',backgroundColor:'transparent',tension:0.4,pointRadius:4,borderWidth:2}
      ]},
      options:{responsive:true,plugins:{legend:{labels:{font:{size:11}}}},scales:{x:{ticks:{font:{size:11}}},y:{ticks:{font:{size:11},callback:function(v){return '₹'+Number(v).toLocaleString('en-IN');}}}}}
    });
  }

  // ── Monthly P&L by Center (supervisor only, 2+ centers) ──
  var plCard = document.getElementById('fin-center-pl');
  var plBody = document.getElementById('fin-center-pl-body');
  if (plCard && plBody && !ACTIVE_CENTER && D.centers.length >= 2) {
    plCard.style.display = 'block';
    // Last 6 months
    var plMonths = [];
    for (var mi = 5; mi >= 0; mi--) {
      var d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - mi);
      plMonths.push(d.toISOString().slice(0,7));
    }
    // Build center → month → {inc, exp} map
    var cmap = {};
    D.finance.forEach(function(f) {
      var ym = (f.date||'').slice(0,7); if (!plMonths.includes(ym)) return;
      var cid = f.wellness_center_id || 'unassigned';
      if (!cmap[cid]) cmap[cid] = {};
      if (!cmap[cid][ym]) cmap[cid][ym] = {inc:0, exp:0};
      if (f.type==='income') cmap[cid][ym].inc += Number(f.amount);
      else cmap[cid][ym].exp += Number(f.amount);
    });
    var activeCids = Object.keys(cmap);
    if (!activeCids.length) { plCard.style.display='none'; }
    else {
      var getCname = function(cid) {
        if (cid==='unassigned') return 'Unassigned';
        var c = D.centers.find(function(x){return x.id===cid;}); return c ? c.name : cid.slice(0,8);
      };
      var fmt = function(n){ return '₹'+Math.round(n).toLocaleString('en-IN'); };
      var mLabels = plMonths.map(function(m){ var d=new Date(m+'-01'); return d.toLocaleString('en-IN',{month:'short',year:'2-digit'}); });
      var html = '<table style="width:100%;border-collapse:collapse;font-size:12px;min-width:500px">'
        + '<thead><tr style="border-bottom:2px solid var(--border)">'
        + '<th style="text-align:left;padding:6px 8px;color:var(--muted)">Center</th>'
        + mLabels.map(function(l){ return '<th style="text-align:right;padding:6px 8px;color:var(--muted)" colspan="3">'+l+'</th>'; }).join('')
        + '</tr>'
        + '<tr style="border-bottom:1px solid var(--border);font-size:10px;color:var(--muted)">'
        + '<th></th>'
        + plMonths.map(function(){ return '<th style="text-align:right;padding:2px 8px">In</th><th style="text-align:right;padding:2px 8px">Ex</th><th style="text-align:right;padding:2px 8px">Net</th>'; }).join('')
        + '</tr></thead><tbody>'
        + activeCids.map(function(cid){
            return '<tr style="border-bottom:1px solid var(--border)">'
              + '<td style="padding:7px 8px;font-weight:600">'+getCname(cid)+'</td>'
              + plMonths.map(function(ym){
                  var d = (cmap[cid]||{})[ym] || {inc:0,exp:0};
                  var net = d.inc - d.exp;
                  return '<td style="text-align:right;padding:7px 8px;color:var(--success)">'+fmt(d.inc)+'</td>'
                    + '<td style="text-align:right;padding:7px 8px;color:var(--danger)">'+fmt(d.exp)+'</td>'
                    + '<td style="text-align:right;padding:7px 8px;font-weight:700;color:'+(net>=0?'var(--success)':'var(--danger)')+'">'+fmt(net)+'</td>';
                }).join('')
              + '</tr>';
          }).join('')
        + '</tbody></table>';
      plBody.innerHTML = html;
    }
  } else if (plCard) { plCard.style.display = 'none'; }
}

// ── SAVE CENTERS ──
async function saveOnboardCustomer() {
  var name = (document.getElementById('oc-name').value||'').trim();
  var pin  = (document.getElementById('oc-pin').value||'').trim();
  if(!name) { showToast('Center name is required','error'); return; }
  if(!/^\d{4}$/.test(pin)) { showToast('PIN must be exactly 4 digits','error'); return; }
  var msgEl = document.getElementById('oc-msg');
  msgEl.style.display='block'; msgEl.style.background='#f0fdf4'; msgEl.style.color='#166534';
  msgEl.textContent = 'Saving...';
  try {
    var payload = {
      name: name,
      owner_name: (document.getElementById('oc-owner').value||'').trim() || null,
      contact: (document.getElementById('oc-phone').value||'').trim() || null,
      location: (document.getElementById('oc-location').value||'').trim() || null,
      center_pin: pin,
      type: 'main'
    };
    var res = await fetch(CENTER_SB_URL + '/rest/v1/wellness_centers', {
      method: 'POST',
      headers: {
        'apikey': CENTER_SB_KEY,
        'Authorization': 'Bearer ' + CENTER_SB_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    });
    if(!res.ok) throw new Error('Save failed: ' + res.status);
    msgEl.textContent = '✅ Onboarded! Send them: app.pulsezen.in + PIN ' + pin;
    msgEl.style.background='#f0fdf4'; msgEl.style.color='#166534';
    document.getElementById('oc-name').value='';
    document.getElementById('oc-owner').value='';
    document.getElementById('oc-phone').value='';
    document.getElementById('oc-location').value='';
    document.getElementById('oc-pin').value='';
    showToast(name + ' onboarded successfully!', 'success');
  } catch(e) {
    msgEl.style.background='#fef2f2'; msgEl.style.color='#dc2626';
    msgEl.textContent = '❌ Error: ' + e.message;
  }
}

async function convertToCoach(custId) {
  var c = D.customers.find(function(x){ return x.id === custId; });
  if (!c) return;
  if (c.pack_owner_id) { showToast(c.name + ' is already linked to a coach pack.', 'error'); return; }
  var packInfo = c.pack_type ? ' Their ' + c.pack_type + ' pack & attendance history will carry over.' : '';
  if (!confirm('Convert "' + c.name + '" to a Coach?\n' + packInfo + '\n\nTheir customer record stays (history preserved). They will be hidden from the customer attendance list.')) return;
  try {
    // 1. Create coach with same details + pack
    var coachPayload = {
      name: c.name,
      contact: c.contact || null,
      dob: c.dob || null,
      gender: c.gender || null,
      goal: c.goal || null,
      notes: c.notes || null,
      wellness_center_id: c.wellness_center_id || ACTIVE_CENTER || null,
      join_date: new Date().toISOString().split('T')[0],
      status: 'Active',
      pack_type: c.pack_type || null,
      pack_start_date: c.pack_start_date || null
    };
    var result = await dbInsert('coaches', coachPayload);
    var newCoachId = Array.isArray(result) && result[0] ? result[0].id : null;
    // 2. Link old customer record to new coach (preserves attendance history)
    if (newCoachId) {
      await dbUpdate('customers', custId, { pack_owner_id: newCoachId });
    }
    auditLog('Converted', 'Customer→Coach', c.name);
    showToast(c.name + ' is now a Coach! Attendance history carried over. Mark attendance under Coach tab.', 'success');
    _daysLeftCache = {};
    await Promise.all([loadCustomers(), loadCoaches()]);
    await loadAttendance();
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}
function updateCoachPortalNavLink() {
  var el = document.getElementById('nav-coach-portal-link');
  if (!el) return;
  var center = ACTIVE_CENTER ? D.centers.find(function(c){ return c.id === ACTIVE_CENTER; }) : null;
  var nid = center && center.network_id ? center.network_id : null;
  el.href = nid ? 'coach.html?center=' + nid : 'coach.html';
}
function updateClientPortalNavLink() {
  var el = document.getElementById('nav-client-portal-link');
  if (!el) return;
  var center = ACTIVE_CENTER ? D.centers.find(function(c){ return c.id === ACTIVE_CENTER; }) : null;
  var nid = center && center.network_id ? center.network_id : null;
  el.href = nid ? 'https://client.pulsezen.in/?center=' + nid : 'https://client.pulsezen.in/';
}
function copyCoachLink(networkId) {
  var link = 'https://app.pulsezen.in/coach.html?center=' + networkId;
  navigator.clipboard.writeText(link).then(function() {
    showToast('Coach portal link copied! Share it with your coaches.', 'success');
  }).catch(function() {
    prompt('Copy this link and share with your coaches:', link);
  });
}
function copySidebarInviteLink() {
  // Find the current logged-in center's network_id
  var center = null;
  if (ACTIVE_CENTER) {
    center = D.centers.find(function(c){ return c.id === ACTIVE_CENTER; });
  } else if (D.centers.length === 1) {
    center = D.centers[0];
  }
  if (!center || !center.network_id) {
    showToast('No invite link yet — contact PulseZen support to get your Network ID.', 'error');
    return;
  }
  copyInviteLink(center.network_id);
}
function copyInviteLink(networkId) {
  var link = 'https://app.pulsezen.in/register?ref=' + networkId;
  navigator.clipboard.writeText(link).then(function() {
    showToast('Invite link copied! Share it with your first-line to register their center.', 'success');
  }).catch(function() {
    prompt('Copy this invite link and share with your first-line:', link);
  });
}
function generateNetworkId(centerName) {
  var prefix = (centerName || '').replace(/[^a-zA-Z]/g, '').substring(0, 2).toUpperCase() || 'PZ';
  var num = String(D.centers.length + 1).padStart(4, '0');
  return 'PZ-' + prefix + '-' + num;
}
async function saveCenter() {
  getCredentials(); if (!getActiveSbUrl() || !getActiveSbKey()) { showToast('Not connected to Supabase', 'error'); return; }
  var id = document.getElementById('center-id').value;
  var ownerRaw = document.getElementById('center-owner').value || '';
  var ownerId = (ownerRaw && ownerRaw !== 'owner-profile') ? ownerRaw : null;
  var pinVal = (document.getElementById('center-pin').value||'').trim();
  if(pinVal && !/^\d{4}$/.test(pinVal)) { showToast('PIN must be exactly 4 digits','error'); return; }
  var centerName = document.getElementById('center-name').value.trim();
  var networkId = id ? (document.getElementById('center-network-id').value || null) : generateNetworkId(centerName);
  var payload = { name:centerName, location:document.getElementById('center-location').value.trim(), contact:document.getElementById('center-contact').value.trim(), type:document.getElementById('center-type').value, owner_id:ownerId, center_pin: pinVal || null, unavailable_foods: document.getElementById('center-unavailable-foods').value.trim()||null, network_id: networkId, distributor_id: document.getElementById('center-herbalife-id').value.trim()||null };
  // Track profile-owner mapping locally (owner_id is uuid-only in DB)
  var profileCenters = JSON.parse(localStorage.getItem('profileCenterOwner') || '{}');
  if(ownerRaw === 'owner-profile') profileCenters[payload.name] = true;
  else delete profileCenters[payload.name];
  localStorage.setItem('profileCenterOwner', JSON.stringify(profileCenters));
  if (!payload.name) { showToast('Center name is required','error'); return; }
  try {
    if(id) await dbUpdate('wellness_centers',id,payload); else await dbInsert('wellness_centers',payload);
    // Auto-sync main center name to profile
    if(payload.type === 'main' && payload.name) {
      OWNER_PROFILE.center_name = payload.name;
      if(payload.location) OWNER_PROFILE.center_location = payload.location;
      localStorage.setItem('ownerProfile', JSON.stringify(OWNER_PROFILE));
    }
    auditLog(id?'Updated':'Added','Center',payload.name+(payload.location?' — '+payload.location:''));
    showToast(id?'Center updated!':'Center added!'); closeModal('center'); await loadCenters(); renderOverview();
  } catch(e) {
    if(e.message && e.message.includes('owner_id')) {
      // owner_id column not yet created — save without it
      delete payload.owner_id;
      try {
        if(id) await dbUpdate('wellness_centers',id,payload); else await dbInsert('wellness_centers',payload);
        showToast('Center saved! ⚠️ Run SQL to enable Owner field: ALTER TABLE wellness_centers ADD COLUMN IF NOT EXISTS owner_id uuid;', 'success');
        closeModal('center'); await loadCenters(); renderOverview();
      } catch(e2) { showToast('Error: '+e2.message,'error'); }
    } else { showToast('Error: '+e.message,'error'); }
  }
}
function editCenter(id) {
  var c = D.centers.find(function(x){return x.id===id;});
  updateCenterOwnerSelect();
  document.getElementById('center-id').value=c.id;
  document.getElementById('center-name').value=c.name;
  document.getElementById('center-location').value=c.location||'';
  document.getElementById('center-contact').value=c.contact||'';
  document.getElementById('center-type').value=c.type||'branch';
  document.getElementById('center-owner').value=c.owner_id||'';
  document.getElementById('center-pin').value=c.center_pin||'';
  document.getElementById('center-unavailable-foods').value=c.unavailable_foods||'';
  document.getElementById('center-herbalife-id').value=c.distributor_id||'';
  var nid = c.network_id||'';
  document.getElementById('center-network-id').value=nid;
  document.getElementById('center-network-id-row').style.display = nid ? 'block' : 'none';
  document.getElementById('center-modal-title').textContent='Edit Wellness Center';
  onCenterTypeChange();
  openModal('center');
}
function openAddCenter() {
  updateCenterOwnerSelect();
  document.getElementById('center-id').value='';
  document.getElementById('center-name').value='';
  document.getElementById('center-location').value='';
  document.getElementById('center-contact').value='';
  document.getElementById('center-type').value='branch';
  document.getElementById('center-owner').value='';
  document.getElementById('center-pin').value='';
  document.getElementById('center-unavailable-foods').value='';
  document.getElementById('center-herbalife-id').value='';
  document.getElementById('center-network-id').value='';
  document.getElementById('center-network-id-row').style.display='none';
  document.getElementById('center-modal-title').textContent='Add Wellness Center';
  onCenterTypeChange();
  openModal('center');
}
function onCenterTypeChange() {
  var type = document.getElementById('center-type').value;
  document.getElementById('center-pin-row').style.display = 'block';
}
function updateCenterOwnerSelect() {
  var sel = document.getElementById('center-owner'); if(!sel) return;
  var profileOpt = '';
  if(OWNER_PROFILE && OWNER_PROFILE.name) {
    var profVal = OWNER_PROFILE.coach_id || 'owner-profile';
    var alreadyCoach = OWNER_PROFILE.coach_id && D.coaches.some(function(c){return c.id===OWNER_PROFILE.coach_id;});
    if(!alreadyCoach) profileOpt = '<option value="'+profVal+'">'+OWNER_PROFILE.name+' (You)</option>';
  }
  sel.innerHTML = '<option value="">— No owner assigned —</option>' + profileOpt + D.coaches.map(function(c){return '<option value="'+c.id+'">'+c.name+'</option>';}).join('');
}
function onCoachRoleChange() {
  var role = document.getElementById('coach-role').value;
  var packSection = document.getElementById('coach-pack-section');
  if (role === 'owner') {
    packSection.style.opacity = '0.4';
    packSection.style.pointerEvents = 'none';
    document.getElementById('coach-pack-type').value = '';
    document.getElementById('coach-pack-start').value = '';
    document.getElementById('coach-pack-price').value = '';
    document.getElementById('coach-pay-section').style.display = 'none';
  } else {
    packSection.style.opacity = '1';
    packSection.style.pointerEvents = 'auto';
  }
}
function onCoachCenterChange() {
  var centerId = document.getElementById('coach-center').value;
  if (!centerId) return;
  var center = D.centers.find(function(x){return x.id===centerId;});
  if (!center || !center.owner_id) return;
  var uplineSel = document.getElementById('coach-upline-sel');
  if (uplineSel) { uplineSel.value = center.owner_id; }
  var uplineTxt = D.coaches.find(function(c){return c.id===center.owner_id;});
  if (uplineTxt) { showToast('Upline auto-filled: ' + uplineTxt.name, 'success'); }
}

// ── SAVE CUSTOMERS ──
async function uploadPhoto(file, customerId, type) {
  getCredentials();
  var ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  var path = customerId + '/' + type + '_' + Date.now() + '.' + ext;
  var res = await fetch(SB_URL + '/storage/v1/object/customer-photos/' + path, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + SB_KEY, 'Content-Type': file.type || 'image/jpeg', 'x-upsert': 'true' },
    body: file
  });
  if (!res.ok) { var t = await res.text(); throw new Error('Photo upload failed: ' + t); }
  return SB_URL + '/storage/v1/object/public/customer-photos/' + path;
}
function previewCustPhoto(type) {
  var inputId   = type === 'before' ? 'customer-photo-before' : 'customer-photo-after';
  var previewId = type === 'before' ? 'cust-before-preview'   : 'cust-after-preview';
  var file = document.getElementById(inputId).files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById(previewId).innerHTML = '<img src="'+e.target.result+'" style="width:80px;height:80px;object-fit:cover;border-radius:8px;border:1.5px solid var(--border);margin-top:4px">';
  };
  reader.readAsDataURL(file);
}

async function saveCustomer() {
  getCredentials(); if (!getActiveSbUrl() || !getActiveSbKey()) { showToast('Not connected to Supabase', 'error'); return; }
  var id = document.getElementById('customer-id').value;
  var refId = document.getElementById('customer-coach').value||null;
  var refName = null, refPhone = null;
  if(refId === 'OWNER') {
    var op = OWNER_PROFILE;
    if (op.coach_id) {
      refId = op.coach_id;
    } else {
      // Try to find owner as a customer by contact number
      var ownerAsCust = op.contact ? D.customers.find(function(c){ return c.contact === op.contact; }) : null;
      if (ownerAsCust) { refId = ownerAsCust.id; }
      else { refId = null; refName = op.name||null; refPhone = op.contact||null; }
    }
  } else if(refId === 'OTHER') {
    refId = null;
    refName = document.getElementById('customer-ref-name').value.trim()||null;
    refPhone = document.getElementById('customer-ref-phone').value.trim()||null;
  }
  
  var payload = { name:document.getElementById('customer-name').value.trim() };
  var _v = function(id){ var v=document.getElementById(id); return v?v.value.trim()||null:null; };
  if(_v('customer-contact'))   payload.contact              = _v('customer-contact');
  if(_v('customer-age'))       payload.age                  = _v('customer-age');
  if(_v('customer-gender'))    payload.gender               = _v('customer-gender');
  if(_v('customer-height'))    payload.height               = _v('customer-height');
  if(_v('customer-address'))   payload.address              = _v('customer-address');
  if(_v('customer-goal'))           payload.goal           = _v('customer-goal');
  if(_v('customer-diet-type'))      payload.diet_type      = _v('customer-diet-type');
  if(_v('customer-activity-level')) payload.activity_level  = _v('customer-activity-level');
  if(_v('customer-training-type'))  payload.training_type   = _v('customer-training-type');
  if(_v('customer-protein-ratio'))  payload.protein_ratio   = _v('customer-protein-ratio');
  if(_v('customer-shake-freq'))     payload.shake_frequency  = _v('customer-shake-freq');
  if(_v('customer-food-override'))  payload.food_override    = _v('customer-food-override');
  if(_v('customer-food-restrict'))  payload.food_restrict    = _v('customer-food-restrict');
  if(_v('customer-center'))    payload.wellness_center_id   = _v('customer-center');
  if(_v('customer-dob'))       payload.dob                  = _v('customer-dob');
  if(_v('customer-lang'))      payload.preferred_language   = _v('customer-lang');
  // Shared pack or own pack
  var packOwnerId = document.getElementById('customer-pack-owner').value || null;
  if(packOwnerId) {
    payload.pack_owner_id = packOwnerId;
    // Copy pack info from owner for reference
    var packOwner = D.customers.find(function(c){return c.id===packOwnerId;});
    if(packOwner) {
      payload.pack_type = packOwner.pack_type;
      payload.pack_start_date = packOwner.pack_start_date;
    }
  } else {
    payload.pack_owner_id = null;
    if(_v('customer-pack'))      payload.pack_type            = _v('customer-pack');
    if(_v('customer-join'))      payload.join_date            = _v('customer-join');
    if(_v('customer-start'))     payload.pack_start_date      = _v('customer-start');
    if(_v('customer-pack-price'))payload.pack_price           = _v('customer-pack-price');
  }
  payload.referred_by_id            = refId   || null;
  payload.external_referrer_name   = refName  || null;
  payload.external_referrer_phone  = refPhone || null;
  payload.coach_id                 = document.getElementById('customer-assigned-coach').value || null;
  if (!payload.name) { showToast('Customer name is required','error'); return; }
  if (!_v('customer-dob')) { showToast('Date of birth is required for secure client portal access','error'); return; }
  if (!id) {
    var _custCount = filterByCenter(D.customers).length;
    var _custLimit = isElitePlan() ? Infinity : isGrowthPlan() ? 200 : 20;
    if (_custCount >= _custLimit) {
      showToast(isGrowthPlan() ? 'Customer limit of 200 reached. Upgrade to Elite (₹999/mo) for unlimited customers.' : 'Free plan limit of 20 customers reached. Upgrade to Growth (₹499/mo) to add up to 200 customers.', 'error');
      return;
    }
  }
  try {
    var savedRecords;
    if(id) { await dbUpdate('customers',id,payload); auditLog('Updated','Customer',payload.name+(payload.pack_type?' — '+payload.pack_type:'')); }
    else { savedRecords = await dbInsert('customers',payload); auditLog('Added','Customer',payload.name+(payload.pack_type?' — '+payload.pack_type:'')); }
    // ── Auto-create finance/payment records for new customers only ──
    if (!id && payload.pack_price) {
      var payMode = (document.getElementById('customer-pay-mode')||{value:'full'}).value;
      var packPrice = Number(payload.pack_price);
      var payDateEl = document.getElementById('customer-pay-date');
      var today = (payDateEl && payDateEl.value) ? payDateEl.value : new Date().toISOString().split('T')[0];
      var custName = payload.name;
      var custId = (Array.isArray(savedRecords) && savedRecords[0]) ? savedRecords[0].id : null;
      var _custCenter = payload.wellness_center_id || null;
      if (payMode === 'full') {
        await dbInsert('finance', { type:'income', description:custName+' — Pack sale', amount:packPrice, category:'Pack sale to customer', date:today, wellness_center_id:_custCenter });
        showToast('Customer added + ₹'+packPrice.toLocaleString('en-IN')+' income recorded!', 'success');
      } else if (payMode === 'partial') {
        var paidNow = Number(document.getElementById('customer-paid-now').value)||0;
        var dueDate = document.getElementById('customer-due-date').value||null;
        await dbInsert('payments', { person_id:custId, person_name:custName, total_amount:packPrice, amount_paid:paidNow, payment_date:today, due_date:dueDate, description:payload.pack_type||'Pack', notes:'Auto-created on customer add' });
        if (paidNow > 0) await dbInsert('finance', { type:'income', description:custName+' — Partial pack payment', amount:paidNow, category:'Pack sale to customer', date:today, wellness_center_id:_custCenter });
        showToast('Customer added + payment plan created! Balance: ₹'+(packPrice-paidNow).toLocaleString('en-IN'), 'success');
      } else {
        var dueDateNone = document.getElementById('customer-due-date') ? document.getElementById('customer-due-date').value||null : null;
        await dbInsert('payments', { person_id:custId, person_name:custName, total_amount:packPrice, amount_paid:0, payment_date:today, due_date:dueDateNone, description:payload.pack_type||'Pack', notes:'Auto-created on customer add' });
        showToast('Customer added + payment reminder created!', 'success');
      }
      await loadPayments(); await loadFinance();
    } else {
      showToast(id?'Customer updated!':'Customer added!');
    }
    // ── Auto-earn coupons for referrer on NEW customer ──
    if (!id && refId) {
      var couponDate = new Date().toISOString().split('T')[0];
      var newCustName = payload.name;
      // +1 coupon for inviting a new person
      await dbInsert('coupons',{coach_id:refId, quantity:1, type:'earn', reason:'invite', referred_person:newCustName, date:couponDate});
      var couponMsg = '🎟️ +1 coupon to referrer for invite';
      // +3 more if the new customer took a 26 or 30 day pack
      var pt = payload.pack_type||'';
      if (pt.includes('26') || pt.includes('30')) {
        await dbInsert('coupons',{coach_id:refId, quantity:3, type:'earn', reason:'pack_taken', referred_person:newCustName, date:couponDate});
        couponMsg = '🎟️ +4 coupons to referrer (invite + pack)';
      }
      showToast(couponMsg, 'success');
      await loadCoupons();
    }
    // ── Complementary day: auto-mark attendance + send WhatsApp ──
    if(!id && document.getElementById('comp-day-section').style.display !== 'none' && document.getElementById('customer-comp-day').checked) {
      var compType = (document.querySelector('input[name="comp-type"]:checked')||{}).value || 'shake';
      var compDate = new Date().toISOString().split('T')[0];
      var compCustId = (Array.isArray(savedRecords) && savedRecords[0]) ? savedRecords[0].id : null;
      // Mark complementary attendance (does NOT count against pack)
      if(compCustId) {
        await dbInsert('attendance', { customer_id:compCustId, customer_name:payload.name, date:compDate, status:'complementary', notes: compType==='shake' ? 'Complementary: Free shake + counselling' : 'Complementary: Counselling only' });
        await loadAttendance();
      }
      // Send WhatsApp welcome
      sendCompDayWhatsApp(payload.name, payload.contact, payload.pack_type, payload.pack_start_date, compType, payload.wellness_center_id);
    }
    // ── Upload photos if selected ──
    var beforeFile = document.getElementById('customer-photo-before').files[0];
    var afterFile  = document.getElementById('customer-photo-after').files[0];
    var savedCustId = id || (Array.isArray(savedRecords) && savedRecords[0] ? savedRecords[0].id : null);
    if (savedCustId && (beforeFile || afterFile)) {
      try {
        var photoPayload = {};
        if (beforeFile) photoPayload.photo_before = await uploadPhoto(beforeFile, savedCustId, 'before');
        if (afterFile)  photoPayload.photo_after  = await uploadPhoto(afterFile,  savedCustId, 'after');
        await dbUpdate('customers', savedCustId, photoPayload);
        showToast('Photos uploaded!', 'success');
      } catch(pe) { showToast('Photo upload failed: ' + pe.message, 'error'); }
    }
    closeModal('customer'); await loadCustomers(); renderOverview();
    // ── Mark walk-in as converted if this customer came from a walk-in ──
    var _savedCustIdForWalkin = id || (Array.isArray(savedRecords) && savedRecords[0] ? savedRecords[0].id : null);
    if(window._convertingWalkinId && _savedCustIdForWalkin) _markWalkinConverted(_savedCustIdForWalkin);
    // ── Auto-generate diet plan in background ──
    var planCustId = id || (Array.isArray(savedRecords) && savedRecords[0] ? savedRecords[0].id : null);
    if(planCustId){
      var planCust = D.customers.find(function(x){return x.id===planCustId;});
      // Only generate if no plan exists yet and basic fields are present
      if(planCust && !planCust.diet_plan && planCust.height && (planCust.age || planCust.dob) && D_FOODS.length && getGroqKey()){
        generateDietPlan(planCustId, true).catch(function(){});
      }
    }
  }
  catch(e) { showToast('Error: '+e.message,'error'); }
}
function editCustomer(id) {
  var c = D.customers.find(function(x){return x.id===id;});
  document.getElementById('customer-id').value=c.id; 
  document.getElementById('customer-name').value=c.name; 
  document.getElementById('customer-contact').value=c.contact||''; 
  document.getElementById('customer-age').value=c.age||''; 
  document.getElementById('customer-gender').value=c.gender||''; 
  document.getElementById('customer-height').value=c.height||''; 
  document.getElementById('customer-address').value=c.address||''; 
  document.getElementById('customer-pack').value=c.pack_type||''; 
  document.getElementById('customer-goal').value=c.goal||'';
  document.getElementById('customer-diet-type').value=c.diet_type||'veg';
  document.getElementById('customer-activity-level').value=c.activity_level||'light';
  var ttEl=document.getElementById('customer-training-type'); if(ttEl) ttEl.value=c.training_type||'dumbbell';
  var prEl=document.getElementById('customer-protein-ratio'); if(prEl) prEl.value=c.protein_ratio||'2.0';
  var sfEl=document.getElementById('customer-shake-freq'); if(sfEl) sfEl.value=c.shake_frequency||'once';
  var foEl=document.getElementById('customer-food-override'); if(foEl) foEl.value=c.food_override||'';
  var frEl=document.getElementById('customer-food-restrict'); if(frEl) frEl.value=c.food_restrict||'';
  document.getElementById('customer-start').value=c.pack_start_date||'';
  document.getElementById('customer-join').value=c.join_date||'';
  document.getElementById('customer-dob').value=c.dob||'';
  document.getElementById('customer-lang').value=c.preferred_language||'';
  document.getElementById('customer-pack-price').value=c.pack_price||'';
  document.getElementById('customer-center').value=c.wellness_center_id||''; 
  
  if (c.external_referrer_name || c.external_referrer_phone) {
    sdSetValue('ref', 'OTHER');
    if (c.external_referrer_name) document.getElementById('ref-search-input').value = c.external_referrer_name;
    document.getElementById('other-ref-row').style.display = 'flex';
    document.getElementById('customer-ref-name').value = c.external_referrer_name||'';
    document.getElementById('customer-ref-phone').value = c.external_referrer_phone||'';
  } else {
    sdSetValue('ref', c.referred_by_id||'');
    document.getElementById('other-ref-row').style.display = 'none';
    document.getElementById('customer-ref-name').value = '';
    document.getElementById('customer-ref-phone').value = '';
  }
  
  // Show existing photos as thumbnails
  document.getElementById('customer-photo-before').value = '';
  document.getElementById('customer-photo-after').value  = '';
  document.getElementById('cust-before-preview').innerHTML = c.photo_before
    ? '<img src="'+c.photo_before+'" style="width:80px;height:80px;object-fit:cover;border-radius:8px;border:1.5px solid var(--border);margin-top:4px"><div style="font-size:11px;color:var(--muted);margin-top:2px">Current — upload new to replace</div>' : '';
  document.getElementById('cust-after-preview').innerHTML  = c.photo_after
    ? '<img src="'+c.photo_after+'"  style="width:80px;height:80px;object-fit:cover;border-radius:8px;border:1.5px solid var(--border);margin-top:4px"><div style="font-size:11px;color:var(--muted);margin-top:2px">Current — upload new to replace</div>' : '';
  document.getElementById('customer-modal-title').textContent='Edit Customer';
  document.getElementById('cust-pay-section').style.display='none'; // hide payment section on edit
  document.getElementById('comp-day-section').style.display='none'; // hide complementary on edit
  // Load pack owner
  updatePackOwnerSelect();
  document.getElementById('customer-pack-owner').value = c.pack_owner_id||'';
  onPackOwnerChange();
  // Assign to coach
  var assignSel = document.getElementById('customer-assigned-coach');
  if(assignSel) assignSel.value = c.coach_id||'';
  openModal('customer');
}

// ── SAVE ATTENDANCE ──
// ── BACKFILL ATTENDANCE ──
function openBackfillModal() {
  var sel = document.getElementById('bf-customer');
  sel.innerHTML = '<option value="">Select customer</option>' +
    D.customers.map(function(c){return '<option value="'+c.id+'">'+c.name+'</option>';}).join('');
  document.getElementById('bf-from').value = '';
  document.getElementById('bf-to').value = new Date().toISOString().split('T')[0];
  document.getElementById('bf-status').value = 'present';
  document.getElementById('bf-skip-sundays').checked = false;
  document.getElementById('bf-preview').style.display = 'none';
  document.getElementById('bf-confirm-btn').style.display = 'none';
  openModal('backfill');
}
function onBackfillCustomerChange() {
  var cid = document.getElementById('bf-customer').value;
  var c = D.customers.find(function(x){return x.id===cid;});
  if (c && c.pack_start_date) {
    document.getElementById('bf-from').value = c.pack_start_date;
    showToast('From date auto-filled from pack start: '+c.pack_start_date, 'success');
  }
  document.getElementById('bf-preview').style.display = 'none';
  document.getElementById('bf-confirm-btn').style.display = 'none';
}
function previewBackfill() {
  var cid = document.getElementById('bf-customer').value;
  var from = document.getElementById('bf-from').value;
  var to = document.getElementById('bf-to').value;
  var skipSun = document.getElementById('bf-skip-sundays').checked;
  if (!cid) { showToast('Select a customer', 'error'); return; }
  if (!from || !to) { showToast('Both dates are required', 'error'); return; }
  if (from > to) { showToast('"From" date must be before "To" date', 'error'); return; }
  var existing = new Set(D.attendance.filter(function(a){return a.customer_id===cid;}).map(function(a){return a.date;}));
  var days = [], cur = new Date(from);
  var end = new Date(to);
  while (cur <= end) {
    var ds = cur.toISOString().split('T')[0];
    var isSun = cur.getDay() === 0;
    if (!existing.has(ds) && !(skipSun && isSun)) days.push(ds);
    cur.setDate(cur.getDate() + 1);
  }
  var prevDiv = document.getElementById('bf-preview');
  var confirmBtn = document.getElementById('bf-confirm-btn');
  if (!days.length) {
    prevDiv.style.display = 'block';
    prevDiv.innerHTML = '✅ All dates in this range already have records — nothing to add.';
    confirmBtn.style.display = 'none';
    return;
  }
  var skipped = [];
  var checked = new Date(from);
  while (checked <= end) {
    var ds2 = checked.toISOString().split('T')[0];
    if (existing.has(ds2)) skipped.push(ds2);
    checked.setDate(checked.getDate() + 1);
  }
  prevDiv.style.display = 'block';
  prevDiv.innerHTML = '<strong>'+days.length+' days</strong> will be marked ' +
    '<strong>'+document.getElementById('bf-status').value+'</strong>' +
    (skipped.length ? ' &nbsp;|&nbsp; <span style="color:var(--muted)">'+skipped.length+' already recorded (skipped)</span>' : '') +
    (skipSun ? ' &nbsp;|&nbsp; <span style="color:var(--muted)">Sundays skipped</span>' : '') +
    '<div style="margin-top:6px;font-size:12px;color:var(--muted)">'+days.slice(0,7).join(' &nbsp;·&nbsp; ')+(days.length>7?' &nbsp;·&nbsp; ... +more':'')+'</div>';
  confirmBtn.style.display = 'inline-flex';
  confirmBtn._days = days;
}
async function confirmBackfill() {
  var confirmBtn = document.getElementById('bf-confirm-btn');
  var days = confirmBtn._days;
  if (!days || !days.length) return;
  var cid = document.getElementById('bf-customer').value;
  var status = document.getElementById('bf-status').value;
  var custName = (D.customers.find(function(c){return c.id===cid;})||{}).name||'';
  getCredentials(); if (!getActiveSbUrl() || !getActiveSbKey()) { showToast('Not connected to Supabase', 'error'); return; }
  confirmBtn.disabled = true; confirmBtn.textContent = 'Saving...';
  try {
    // Insert in batches of 20 to avoid large payloads
    for (var i = 0; i < days.length; i += 20) {
      var batch = days.slice(i, i+20).map(function(d){
        return { customer_id:cid, customer_name:custName, date:d, status:status, notes:'Backfilled' };
      });
      await dbInsert('attendance', batch);
    }
    showToast('✅ '+days.length+' attendance records added!', 'success');
    closeModal('backfill');
    await loadAttendance();
    renderOverview();
  } catch(e) {
    showToast('Error: '+e.message, 'error');
  } finally {
    confirmBtn.disabled = false; confirmBtn.textContent = '✅ Mark All';
  }
}

async function saveAttendance() {
  getCredentials(); if (!getActiveSbUrl() || !getActiveSbKey()) { showToast('Not connected to Supabase', 'error'); return; }
  var id = document.getElementById('att-id').value;
  var custId = document.getElementById('att-customer').value;
  var cust = D.customers.find(function(c){return c.id===custId;}) || D.coaches.find(function(c){return c.id===custId;}) || {};
  var custName = cust.name || '';
  var servings = parseInt(document.getElementById('att-servings').value)||1;
  var morningShake    = document.getElementById('att-morning-shake').value;
  var postworkoutShake = document.getElementById('att-postworkout-shake').value;
  var payload = {
    customer_id:custId||null, customer_name:custName,
    date:document.getElementById('att-date').value,
    status:document.getElementById('att-status').value,
    servings:servings,
    notes:document.getElementById('att-notes').value.trim(),
    morning_shake: morningShake,
    postworkout_shake: (cust.shake_frequency==='twice') ? postworkoutShake : 'na',
    check_in_time: (!document.getElementById('att-id').value && document.getElementById('att-status').value==='present') ? new Date().toTimeString().slice(0,5) : undefined
  };
  if (!payload.date) { showToast('Date is required','error'); return; }
  if (!custId) { showToast('Please select a customer','error'); return; }

  // Alert coach if 2x customer missed a shake
  if(cust.shake_frequency==='twice' && payload.status==='present'){
    if(morningShake==='missed' && postworkoutShake!=='missed') showToast('⚠️ '+custName+' missed morning shake!','error');
    else if(postworkoutShake==='missed' && morningShake!=='missed') showToast('⚠️ '+custName+' missed post-workout shake!','error');
    else if(morningShake==='missed' && postworkoutShake==='missed') showToast('⚠️ '+custName+' missed BOTH shakes today!','error');
  }

  try {
    if(id) await dbUpdate('attendance',id,payload); else await dbInsert('attendance',payload);
    showToast('Attendance saved!'); closeModal('attendance'); await loadAttendance(); renderOverview();
    if(payload.status==='present') sendAttendanceWhatsApp(custId, custName, payload.date);
  } catch(e) { showToast('Error: '+e.message,'error'); }
}
function onAttCustomerChange() {
  var custId = document.getElementById('att-customer').value;
  var cust = D.customers.find(function(c){return c.id===custId;}) || D.coaches.find(function(c){return c.id===custId;}) || {};
  var isTwice = cust.shake_frequency === 'twice';
  var row = document.getElementById('att-postworkout-row');
  if(row) row.style.display = isTwice ? 'block' : 'none';
  var pw = document.getElementById('att-postworkout-shake');
  if(pw) pw.value = isTwice ? 'center' : 'na';
}
function editAttendance(id) {
  var a = D.attendance.find(function(x){return x.id===id;});
  document.getElementById('att-id').value=a.id;
  document.getElementById('att-customer').value=a.customer_id||'';
  document.getElementById('att-date').value=a.date;
  document.getElementById('att-status').value=a.status;
  document.getElementById('att-servings').value=a.servings||1;
  document.getElementById('att-notes').value=a.notes||'';
  var ms=document.getElementById('att-morning-shake'); if(ms) ms.value=a.morning_shake||'center';
  var pw=document.getElementById('att-postworkout-shake'); if(pw) pw.value=a.postworkout_shake||'na';
  onAttCustomerChange();
  openModal('attendance');
}

// ── SAVE BODY ──
document.getElementById('body-customer').addEventListener('change', function() {
  autofillBodyHeightAge(this.value);
});

function calcBody() {
  var weight    = parseFloat(document.getElementById('body-weight').value);
  var height    = parseFloat(document.getElementById('body-height').value);
  var fatPct    = parseFloat(document.getElementById('body-fat').value);
  var subfatPct = parseFloat(document.getElementById('body-subfat').value);

  // Show Fat kg preview
  var fatKgDiv = document.getElementById('body-fat-kg-display');
  if (!isNaN(weight) && !isNaN(fatPct) && weight > 0 && fatPct > 0) {
    var fatKg = (weight * fatPct / 100).toFixed(2);
    fatKgDiv.textContent = '= ' + fatKg + ' kg fat';
  } else {
    fatKgDiv.textContent = '';
  }

  // Show Subcutaneous Fat kg preview
  var subfatKgDiv = document.getElementById('body-subfat-kg-display');
  if (!isNaN(weight) && !isNaN(subfatPct) && weight > 0 && subfatPct > 0) {
    var subfatKg = (weight * subfatPct / 100).toFixed(2);
    subfatKgDiv.textContent = '= ' + subfatKg + ' kg subcutaneous fat';
  } else {
    subfatKgDiv.textContent = '';
  }

  // Auto-calculate BMI
  var bmiEl = document.getElementById('body-bmi');
  var bmi = 0;
  if (!isNaN(weight) && !isNaN(height) && weight > 0 && height > 0 && !bmiEl.dataset.manual) {
    var hm = height / 100;
    bmi = parseFloat((weight / (hm * hm)).toFixed(1));
    bmiEl.value = bmi;
  } else {
    bmi = parseFloat(bmiEl.value) || 0;
  }

  calcVF();

  // Field hint badges
  var vfEl = document.getElementById('body-visceral');
  var vfKg = parseFloat(vfEl ? vfEl.value : 0) || 0;
  svSetBodyHint('body-bmi-hint',      svBmiHint(bmi));
  svSetBodyHint('body-fat-hint',      svFatHint(isNaN(fatPct) ? 0 : fatPct));
  svSetBodyHint('body-visceral-hint', svVfHint(vfKg));

  // Live Health Score in modal
  var musclePctLive = parseFloat(document.getElementById('body-muscle').value) || 0;
  var _modalCust = _selectedBodyCustId
    ? ((D.customers||[]).find(function(x){return x.id===_selectedBodyCustId;}) || (D.coaches||[]).find(function(x){return x.id===_selectedBodyCustId;}))
    : null;
  var _modalGender = _modalCust ? (_modalCust.gender||'') : '';
  var _modalWeight = parseFloat(document.getElementById('body-weight') ? document.getElementById('body-weight').value : 0) || 0;
  var score = svCalcHealthScore(bmi || 0, isNaN(fatPct) ? 0 : fatPct, vfKg, musclePctLive || null, _modalGender, _modalWeight);
  svUpdateModalHealthScore(score);
}

function svSetBodyHint(id, hint) {
  var el = document.getElementById(id);
  if (!el) return;
  if (!hint) { el.innerHTML = ''; return; }
  el.innerHTML = '<span class="fhint fhint-' + hint.cls + '">' + hint.icon + ' ' + hint.label + '</span>';
}
function svBmiHint(v) {
  if (!v) return null;
  if (v < 18.5) return {cls:'low',  icon:'⬇️', label:'Underweight'};
  if (v < 25)   return {cls:'good', icon:'✅', label:'Normal'};
  if (v < 30)   return {cls:'warn', icon:'⚠️', label:'Overweight'};
  return              {cls:'bad',  icon:'🔴', label:'Obese'};
}
function svFatHint(v) {
  if (!v) return null;
  if (v < 8)   return {cls:'low',  icon:'⬇️', label:'Very Low Fat'};
  if (v <= 25) return {cls:'good', icon:'✅', label:'Healthy Range'};
  if (v <= 32) return {cls:'warn', icon:'⚠️', label:'Above Ideal'};
  return             {cls:'bad',  icon:'🔴', label:'High Body Fat'};
}
function svVfHint(kg) {
  if (!kg) return null;
  if (kg <= 2) return {cls:'good', icon:'✅', label:'Low Risk'};
  if (kg <= 4) return {cls:'warn', icon:'⚠️', label:'Moderate'};
  return             {cls:'bad',  icon:'🔴', label:'High Risk'};
}
function svCalcHealthScore(bmi, fatPct, vfKg, musclePct, gender, weight) {
  var g = (gender || '').toLowerCase();
  var isMale = g === 'male', isFemale = g === 'female';
  var fatLo = isMale ? 10 : isFemale ? 20 : 10;
  var fatHi = isMale ? 20 : isFemale ? 26 : 25;
  // Muscle scored on absolute kg: men ideal ≥30 kg, women ≥22 kg
  var musIdealKg = isMale ? 30 : 22;
  var musMinKg   = isMale ? 10 : 8;
  var score = 0, total = 0;
  if (bmi) {
    total += 25;
    if (bmi >= 18.5 && bmi <= 24.9) score += 25;
    else if (bmi < 18.5) score += Math.max(0, 25 - (18.5 - bmi) * 4);
    else score += Math.max(0, 25 - (bmi - 24.9) * 3);
  }
  if (fatPct) {
    total += 30;
    if (fatPct >= fatLo && fatPct <= fatHi) score += 30;
    else if (fatPct < fatLo) score += Math.max(0, 30 - (fatLo - fatPct) * 3);
    else score += Math.max(0, 30 - (fatPct - fatHi) * 1.8);
  }
  if (vfKg > 0) {
    total += 20;
    if (vfKg <= 2) score += 20;
    else if (vfKg <= 4) score += 12;
    else if (vfKg <= 6) score += 5;
  }
  if (musclePct) {
    total += 25;
    var muscleKg = weight > 0 ? weight * musclePct / 100 : 0;
    if (muscleKg > 0) {
      // Score on absolute muscle kg — gaining muscle always improves score
      score += Math.min(25, Math.max(0, (muscleKg - musMinKg) / (musIdealKg - musMinKg) * 25));
    } else {
      // No weight available — fall back to % (threshold 35% unisex)
      score += Math.min(25, Math.max(0, (musclePct - 15) / 20 * 25));
    }
  }
  if (total === 0) return null;
  return Math.round((score / total) * 100);
}
function svUpdateModalHealthScore(score) {
  var bar     = document.getElementById('modal-hs-bar');
  var numEl   = document.getElementById('modal-hs-num');
  var arcEl   = document.getElementById('modal-hs-arc');
  var gradeEl = document.getElementById('modal-hs-grade');
  if (!bar) return;
  if (score === null) { bar.style.display = 'none'; return; }
  bar.style.display = 'flex';
  numEl.textContent = score;
  var maxDash = 106.81;
  var offset  = maxDash * (1 - score / 100);
  var color   = score >= 80 ? '#27ae60' : score >= 55 ? '#e8a838' : '#c0392b';
  arcEl.style.stroke = color;
  arcEl.style.strokeDashoffset = offset;
  var grade = score >= 85 ? {t:'Excellent',bg:'#d1fae5',c:'#065f46'}
            : score >= 70 ? {t:'Good',bg:'#d1fae5',c:'#065f46'}
            : score >= 55 ? {t:'Fair',bg:'#fef3c7',c:'#92400e'}
            : score >= 40 ? {t:'Poor',bg:'#fee2e2',c:'#991b1b'}
            :               {t:'Critical',bg:'#fee2e2',c:'#991b1b'};
  gradeEl.textContent = grade.t;
  gradeEl.style.background = grade.bg;
  gradeEl.style.color = grade.c;
}
function svBuildHealthScoreCard(bmi, fatPct, vfKg, date, opts) {
  opts = opts || {};
  var musV = parseFloat(opts.musclePct)||0;
  var gender = (opts.gender || '').toLowerCase();
  var isMale = gender === 'male', isFemale = gender === 'female';
  var fatIdealLo = isMale ? 10 : isFemale ? 20 : 10;
  var fatIdealHi = isMale ? 20 : isFemale ? 26 : 25;
  var musIdealKg = isMale ? 30 : 22;
  var weightV = parseFloat(opts.weight) || 0;
  var muscleKg = (weightV > 0 && musV > 0) ? parseFloat((weightV * musV / 100).toFixed(1)) : 0;
  var score = svCalcHealthScore(parseFloat(bmi)||0, parseFloat(fatPct)||0, parseFloat(vfKg)||0, musV||null, gender, weightV);
  if (score === null) return '';
  var color = score >= 80 ? '#27ae60' : score >= 55 ? '#e8a838' : '#c0392b';
  var maxDash = 157.08;
  var offset  = maxDash * (1 - score / 100);
  var grade = score >= 85 ? {t:'Excellent',bg:'rgba(209,250,229,.3)',c:'#a7f3d0'}
            : score >= 70 ? {t:'Good',bg:'rgba(209,250,229,.3)',c:'#a7f3d0'}
            : score >= 55 ? {t:'Fair',bg:'rgba(254,243,199,.3)',c:'#fde68a'}
            : score >= 40 ? {t:'Poor',bg:'rgba(254,226,226,.3)',c:'#fca5a5'}
            :               {t:'Critical',bg:'rgba(254,226,226,.3)',c:'#fca5a5'};
  var bmiV = parseFloat(bmi)||0;
  var fatV = parseFloat(fatPct)||0;
  var bmiLbl = bmiV ? (bmiV < 18.5 ? '⬇️ Underweight' : bmiV <= 24.9 ? '✅ Normal' : bmiV <= 29.9 ? '⚠️ Overweight' : '🔴 Obese') : '—';
  var fatLbl = fatV ? (fatV >= fatIdealLo && fatV <= fatIdealHi ? '✅ Ideal' : fatV <= fatIdealHi + 6 ? '⚠️ High' : '🔴 Very High') : '—';
  var vfLbl  = vfKg > 0 ? (vfKg <= 2 ? '✅ Low' : vfKg <= 4 ? '⚠️ Moderate' : '🔴 High') : '—';
  var musLbl = muscleKg > 0
    ? (muscleKg >= musIdealKg ? '✅ Excellent' : muscleKg >= musIdealKg * 0.85 ? '✅ Good' : muscleKg >= musIdealKg * 0.65 ? '⚠️ Average' : '🔴 Low')
    : musV ? '⚠️ Average' : '—';
  var uid = 'hs-' + Date.now();
  // Store WA data in a global so onclick doesn't need inline string escaping
  window._hsWaData = window._hsWaData || {};
  window._hsWaData[uid] = {name:opts.name||'', phone:opts.phone||'', score:score, grade:grade.t, bmi:bmiV, fatPct:fatV, vfKg:vfKg, weight:opts.weight||0, musclePct:opts.musclePct||0, date:date||'', center:getCenterName()};
  var waBtn = opts.phone
    ? '<button onclick="var d=window._hsWaData[\''+uid+'\'];sendHealthScoreWA(d.name,d.phone,d.score,d.grade,d.bmi,d.fatPct,d.vfKg,d.weight,d.musclePct,d.date,d.center)" style="background:#25D366;color:#fff;border:none;border-radius:7px;padding:5px 12px;font-size:12px;font-weight:700;cursor:pointer">💬 Share Score</button>'
    : '';
  return '<div class="hs-card">' +
    '<div class="hs-gauge">' +
      '<svg viewBox="0 0 120 72" width="120" height="72">' +
        '<path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="9" stroke-linecap="round"/>' +
        '<path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke="' + color + '" stroke-width="9" stroke-linecap="round" stroke-dasharray="' + maxDash + '" stroke-dashoffset="' + offset + '"/>' +
        '<text x="60" y="62" text-anchor="middle" font-size="20" font-weight="700" fill="#fff" font-family="DM Sans,sans-serif">' + score + '</text>' +
      '</svg>' +
    '</div>' +
    '<div class="hs-info" style="flex:1">' +
      '<div class="hs-title">Health Score</div>' +
      '<div class="hs-score-big">' + score + '<span style="font-size:16px;font-weight:400;color:rgba(255,255,255,.5)">/100</span></div>' +
      '<div class="hs-grade-badge" style="background:' + grade.bg + ';color:' + grade.c + '">' + grade.t + '</div>' +
      (date ? '<div style="font-size:11px;color:rgba(255,255,255,.4);margin-top:6px">Last scan: ' + date + '</div>' : '') +
      '<div class="hs-actions">' +
        waBtn +
        '<button onclick="var p=document.getElementById(\''+uid+'\');p.style.display=p.style.display===\'block\'?\'none\':\'block\'" style="background:rgba(255,255,255,.12);color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:7px;padding:5px 12px;font-size:12px;cursor:pointer">ℹ️ How is this scored?</button>' +
      '</div>' +
      '<div class="hs-info-panel" id="'+uid+'">' +
        '<div style="font-weight:700;color:#fff;margin-bottom:10px">How Health Score is calculated</div>' +
        '<div style="display:flex;flex-direction:column;gap:6px">' +
          '<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap"><span style="color:#fff;font-weight:700;min-width:155px;font-size:12px">BMI (25 pts)</span><span style="color:#fff;font-size:12px">'+bmiV+' — '+bmiLbl+'</span><span style="color:rgba(255,255,255,.5);font-size:11px">Ideal: 18.5–24.9</span></div>' +
          '<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap"><span style="color:#fff;font-weight:700;min-width:155px;font-size:12px">Body Fat % (30 pts)</span><span style="color:#fff;font-size:12px">'+fatV+'% — '+fatLbl+'</span><span style="color:rgba(255,255,255,.5);font-size:11px">Ideal: '+fatIdealLo+'–'+fatIdealHi+'%</span></div>' +
          '<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap"><span style="color:#fff;font-weight:700;min-width:155px;font-size:12px">Visceral Fat (20 pts)</span><span style="color:#fff;font-size:12px">'+(vfKg||'—')+' kg — '+vfLbl+'</span><span style="color:rgba(255,255,255,.5);font-size:11px">Ideal: ≤ 2 kg</span></div>' +
          '<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap"><span style="color:#fff;font-weight:700;min-width:155px;font-size:12px">Muscle Mass (25 pts)</span><span style="color:#fff;font-size:12px">'+(muscleKg > 0 ? muscleKg+' kg' : (musV||'—')+'%')+' — '+musLbl+'</span><span style="color:rgba(255,255,255,.5);font-size:11px">Ideal: ≥ '+musIdealKg+' kg</span></div>' +
        '</div>' +
        '<div class="hs-grade-row" style="margin-top:10px">' +
          '<div class="hs-grade-pip" style="background:#d1fae5;color:#065f46">85–100 Excellent</div>' +
          '<div class="hs-grade-pip" style="background:#d1fae5;color:#065f46">70–84 Good</div>' +
          '<div class="hs-grade-pip" style="background:#fef3c7;color:#92400e">55–69 Fair</div>' +
          '<div class="hs-grade-pip" style="background:#fee2e2;color:#991b1b">40–54 Poor</div>' +
          '<div class="hs-grade-pip" style="background:#fee2e2;color:#991b1b">&lt;40 Critical</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function sendHealthScoreWA(name, phone, score, grade, bmi, fatPct, vfKg, weight, musclePct, date, centerName) {
  var emoji = score >= 85 ? '🌟' : score >= 70 ? '💚' : score >= 55 ? '🟡' : '🔴';
  var msg = '🏥 *Health Score Report*\n'
    + 'Hi ' + name + '! Here\'s your latest body analysis from ' + centerName + '.\n\n'
    + emoji + ' *Health Score: ' + score + '/100 — ' + grade + '*\n\n'
    + '📊 *Your Numbers:*\n'
    + (weight  ? '⚖️ Weight: ' + weight + ' kg\n' : '')
    + (bmi     ? '📏 BMI: ' + bmi + (bmi < 18.5 ? ' (Underweight)' : bmi <= 24.9 ? ' (Normal ✅)' : bmi <= 29.9 ? ' (Overweight ⚠️)' : ' (Obese 🔴)') + '\n' : '')
    + (fatPct  ? '🔥 Body Fat: ' + fatPct + '%' + (fatPct <= 26 ? ' ✅' : ' ⚠️') + '\n' : '')
    + (musclePct ? '💪 Muscle: ' + musclePct + '%\n' : '')
    + (vfKg > 0 ? '🫀 Visceral Fat: ' + vfKg + ' kg' + (vfKg <= 2 ? ' ✅' : ' ⚠️') + '\n' : '')
    + (date    ? '📅 Scan Date: ' + date + '\n' : '')
    + '\n📖 *What does Health Score mean?*\n'
    + 'Your score is based on 4 key markers:\n'
    + '• BMI (25 pts) — ideal range: 18.5–24.9\n'
    + '• Body Fat % (30 pts) — ideal: 10–20% (Men) / 20–26% (Women)\n'
    + '• Visceral Fat (20 pts) — ideal: ≤ 2 kg\n'
    + '• Muscle Mass (25 pts) — ideal: ≥ 30 kg (Men) / ≥ 22 kg (Women)\n\n'
    + (score >= 70
      ? '✨ Great work! Keep up your healthy habits. 💪'
      : '💡 Don\'t worry — with the right nutrition & consistency, your score will improve. We\'re here to support you! 🌱')
    + '\n\n— ' + centerName;
  var ph = (phone || '').replace(/\D/g, '');
  window.open('https://api.whatsapp.com/send?' + (ph ? 'phone=' + COUNTRY_CODE + ph + '&' : '') + 'text=' + encodeURIComponent(msg), '_blank');
}

function calcVF() {
  var weight    = parseFloat(document.getElementById('body-weight').value);
  var fatPct    = parseFloat(document.getElementById('body-fat').value);
  var subfatPct = parseFloat(document.getElementById('body-subfat').value);
  var vf        = document.getElementById('body-visceral');

  if (!isNaN(weight) && !isNaN(fatPct) && !isNaN(subfatPct) &&
      weight > 0 && fatPct > 0 && subfatPct > 0 && fatPct > subfatPct) {
    var fatKg    = weight * fatPct / 100;
    var subfatKg = weight * subfatPct / 100;
    vf.value = (fatKg - subfatKg).toFixed(2);
    vf.style.color = 'var(--primary)';
  } else {
    vf.value = '';
    vf.style.color = '';
  }
}
async function saveBody() {
  var id = document.getElementById('body-id').value;
  var custId = document.getElementById('body-customer').value;
  var dateVal = document.getElementById('body-date').value;
  if (!custId) { showToast('Please select a person','error'); return; }
  if (!dateVal) { showToast('Date is required','error'); return; }

  if (custId === '__sv__') {
    getCredentials(); if (!getActiveSbUrl() || !getActiveSbKey()) { showToast('Not connected to Supabase', 'error'); return; }
    var op = JSON.parse(localStorage.getItem('ownerProfile')||'{}');
    if (!op.sv_body_id) {
      op.sv_body_id = (crypto.randomUUID ? crypto.randomUUID() : 'sv-' + Date.now() + '-' + Math.random().toString(36).slice(2));
      localStorage.setItem('ownerProfile', JSON.stringify(op));
    }
    var svPayload = {
      customer_id: op.sv_body_id, customer_name: op.name || 'Supervisor',
      date: dateVal,
      height: document.getElementById('body-height').value||null,
      age: document.getElementById('body-age-field').value||null,
      weight: document.getElementById('body-weight').value||null,
      fat_percentage: document.getElementById('body-fat').value||null,
      visceral_fat: document.getElementById('body-visceral').value||null,
      bmr: document.getElementById('body-bmr').value||null,
      bmi: document.getElementById('body-bmi').value||null,
      body_age: document.getElementById('body-age').value||null,
      subcutaneous_fat_percentage: document.getElementById('body-subfat').value||null,
      muscle_percentage: document.getElementById('body-muscle').value||null,
      notes: document.getElementById('body-notes').value.trim()
    };
    // If id starts with 'sv-' it's a legacy localStorage id — insert as new record
    var isLegacyId = id && id.toString().startsWith('sv-');
    try {
      if (id && !isLegacyId) await dbUpdate('body_composition', id, svPayload);
      else await dbInsert('body_composition', svPayload);
      showToast('Record saved!'); closeModal('body'); await loadBody(); renderSvBody();
    } catch(e) { showToast('Error: '+e.message, 'error'); }
    return;
  }

  getCredentials(); if (!getActiveSbUrl() || !getActiveSbKey()) { showToast('Not connected to Supabase', 'error'); return; }
  var resolvedCustId = custId;
  var custName = '';
  if (custId && custId.startsWith('walkin__')) {
    resolvedCustId = custId.slice(8);
    custName = ((D.walkins||[]).find(function(w){return w.id===resolvedCustId;})||{}).name||'Walk-in';
  } else {
    custName = (D.customers.find(function(c){return c.id===custId;})
             || D.coaches.find(function(c){return c.id===custId;})||{}).name||'';
  }
  var payload = {
    customer_id:resolvedCustId||null, customer_name:custName, date:dateVal,
    height:document.getElementById('body-height').value||null,
    age:document.getElementById('body-age-field').value||null,
    weight:document.getElementById('body-weight').value||null,
    fat_percentage:document.getElementById('body-fat').value||null,
    visceral_fat:document.getElementById('body-visceral').value||null,
    bmr:document.getElementById('body-bmr').value||null,
    bmi:document.getElementById('body-bmi').value||null,
    body_age:document.getElementById('body-age').value||null,
    subcutaneous_fat_percentage:document.getElementById('body-subfat').value||null,
    muscle_percentage:document.getElementById('body-muscle').value||null,
    notes:document.getElementById('body-notes').value.trim()
  };
  try { if(id) await dbUpdate('body_composition',id,payload); else await dbInsert('body_composition',payload); showToast('Record saved!'); closeModal('body'); await loadBody(); }
  catch(e) { showToast('Error: '+e.message,'error'); }
}
function editBody(id) {
  var b = D.body.find(function(x){return x.id===id;});
  if(b&&b.customer_id){_selectedBodyCustId=b.customer_id;var sel=document.getElementById('body-cust-select');if(sel)sel.value=b.customer_id;}
  document.getElementById('body-id').value=b.id; document.getElementById('body-customer').value=b.customer_id||''; document.getElementById('body-date').value=b.date; 
  document.getElementById('body-height').value=b.height||''; 
  document.getElementById('body-age-field').value=b.age||''; 
  document.getElementById('body-weight').value=b.weight||''; 
  document.getElementById('body-fat').value=b.fat_percentage||''; 
  document.getElementById('body-visceral').value=b.visceral_fat||''; 
  document.getElementById('body-bmr').value=b.bmr||''; 
  var bmiEl=document.getElementById('body-bmi'); bmiEl.value=b.bmi||''; bmiEl.dataset.manual=b.bmi?'1':'';
  document.getElementById('body-age').value=b.body_age||'';
  document.getElementById('body-subfat').value=b.subcutaneous_fat_percentage||''; calcVF();
  document.getElementById('body-muscle').value=b.muscle_percentage||'';
  document.getElementById('body-notes').value=b.notes||'';
  calcBody();
  openModal('body');
}

// ── SAVE COACHES ──
async function saveCoach() {
  getCredentials(); if (!getActiveSbUrl() || !getActiveSbKey()) { showToast('Not connected to Supabase', 'error'); return; }
  var id = document.getElementById('coach-id').value;
  var uplineSel = document.getElementById('coach-upline-sel');
  var role = document.getElementById('coach-role') ? document.getElementById('coach-role').value : 'coach';
  var isOwner = role === 'owner';
  var payload = {
    name:document.getElementById('coach-name').value.trim(),
    contact:document.getElementById('coach-contact').value.trim(),
    wellness_center_id:document.getElementById('coach-center').value||ACTIVE_CENTER||null,
    join_date:document.getElementById('coach-date').value||null,
    status:document.getElementById('coach-status').value||'Active',
    upline_id:uplineSel?uplineSel.value||null:null,
    upline:(function(){ if(!uplineSel||!uplineSel.value) return ''; var uc=D.coaches.find(function(c){return c.id===uplineSel.value;}); return uc?uc.name:''; })(),
    notes:document.getElementById('coach-notes').value.trim(),
    dob:document.getElementById('coach-dob').value||null,
    gender:document.getElementById('coach-gender').value||null,
    goal:document.getElementById('coach-goal').value||null
  };
  var pinEl = document.getElementById('coach-pin');
  if (pinEl && pinEl.value) payload.herbalife_pin = pinEl.value;
  var dashPin = (document.getElementById('coach-dashboard-pin')||{}).value || '';
  if (dashPin) payload.coach_pin = dashPin;
  // Only include pack fields if not a center owner and columns exist
  if (!isOwner) {
    var coachPackOwner = (document.getElementById('coach-pack-owner')||{}).value || null;
    payload.pack_owner_id = coachPackOwner || null;
    var pt = document.getElementById('coach-pack-type') ? document.getElementById('coach-pack-type').value||null : null;
    var ps = document.getElementById('coach-pack-start') ? document.getElementById('coach-pack-start').value||null : null;
    var pp = document.getElementById('coach-pack-price') ? Number(document.getElementById('coach-pack-price').value)||null : null;
    if (pt) payload.pack_type = pt;
    if (ps) payload.pack_start_date = ps;
    if (pp) payload.pack_price = pp;
  }
  if (!payload.name) { showToast('Coach name is required','error'); return; }
  try {
    var savedCoach;
    if(id) { await dbUpdate('coaches',id,payload); auditLog('Updated','Coach',payload.name); }
    else { savedCoach = await dbInsert('coaches',payload); auditLog('Added','Coach',payload.name+(payload.pack_type?' — '+payload.pack_type:'')); }
    // Auto-create finance/payment for new coaches with a pack price
    if (!id && payload.pack_price && !isOwner) {
      var packPrice = Number(payload.pack_price);
      var today = new Date().toISOString().split('T')[0];
      var coachName = payload.name;
      var coachId = (Array.isArray(savedCoach) && savedCoach[0]) ? savedCoach[0].id : null;
      var payMode = (document.getElementById('coach-pay-mode')||{value:'full'}).value;
      var _coachCenter = payload.wellness_center_id || null;
      if (payMode === 'full') {
        await dbInsert('finance', { type:'income', description:coachName+' — Coach pack sale', amount:packPrice, category:'Coach pack payment', date:today, wellness_center_id:_coachCenter });
        showToast('Coach added + ₹'+packPrice.toLocaleString('en-IN')+' income recorded!', 'success');
      } else if (payMode === 'partial') {
        var paidNow = Number((document.getElementById('coach-paid-now')||{value:0}).value)||0;
        var dueDate = (document.getElementById('coach-due-date')||{value:''}).value||null;
        await dbInsert('payments', { person_id:coachId, person_name:coachName, total_amount:packPrice, amount_paid:paidNow, payment_date:today, due_date:dueDate, description:(payload.pack_type||'Coach Pack'), notes:'Coach pack payment' });
        if (paidNow > 0) await dbInsert('finance', { type:'income', description:coachName+' — Partial coach pack payment', amount:paidNow, category:'Coach pack payment', date:today, wellness_center_id:_coachCenter });
        showToast('Coach added + payment plan created! Balance: ₹'+(packPrice-paidNow).toLocaleString('en-IN'), 'success');
      } else {
        var dueDateNone = (document.getElementById('coach-due-date')||{value:''}).value||null;
        await dbInsert('payments', { person_id:coachId, person_name:coachName, total_amount:packPrice, amount_paid:0, payment_date:today, due_date:dueDateNone, description:(payload.pack_type||'Coach Pack'), notes:'Coach pack payment' });
        showToast('Coach added + payment reminder created!', 'success');
      }
      await loadPayments(); await loadFinance();
    } else {
      showToast(id?'Coach updated!':'Coach added!');
    }
    closeModal('coach'); await loadCoaches(); renderOverview();
  }
  catch(e) { showToast('Error: '+e.message,'error'); }
}
function editCoach(id) {
  var c = D.coaches.find(function(x){return x.id===id;});
  document.getElementById('coach-id').value=c.id;
  updateCoachUplineSelects(c.id); // refresh list — exclude self when editing
  document.getElementById('coach-name').value=c.name;
  document.getElementById('coach-contact').value=c.contact||'';
  document.getElementById('coach-status').value=c.status||'Active';
  document.getElementById('coach-notes').value=c.notes||'';
  document.getElementById('coach-center').value=c.wellness_center_id||'';
  document.getElementById('coach-date').value=c.join_date||'';
  if(document.getElementById('coach-pack-type')) document.getElementById('coach-pack-type').value=c.pack_type||'';
  if(document.getElementById('coach-pack-start')) document.getElementById('coach-pack-start').value=c.pack_start_date||'';
  if(document.getElementById('coach-pack-price')) document.getElementById('coach-pack-price').value=c.pack_price||'';
  if(document.getElementById('coach-pack-owner')) { updateCoachPackOwnerSelect(); document.getElementById('coach-pack-owner').value=c.pack_owner_id||''; onCoachPackOwnerChange(); }
  if(document.getElementById('coach-upline-sel')) document.getElementById('coach-upline-sel').value=c.upline_id||'';
  if(document.getElementById('coach-pin')) { document.getElementById('coach-pin').value=c.herbalife_pin||''; showCoachPinTip(); }
  if(document.getElementById('coach-dashboard-pin')) document.getElementById('coach-dashboard-pin').value=c.coach_pin||'';
  if(document.getElementById('coach-dob')) document.getElementById('coach-dob').value=c.dob||'';
  if(document.getElementById('coach-gender')) document.getElementById('coach-gender').value=c.gender||'';
  if(document.getElementById('coach-goal')) document.getElementById('coach-goal').value=c.goal||'Weight Loss';
  var roleEl = document.getElementById('coach-role');
  if(roleEl) { roleEl.value = (!c.pack_type && !c.pack_start_date) ? 'owner' : 'coach'; onCoachRoleChange(); }
  document.getElementById('coach-pay-section').style.display='none'; // hide payment section on edit
  document.getElementById('coach-modal-title').textContent='Edit Coach'; openModal('coach');
}

// ── (inventory save/edit handled by new system above) ──

// ── SAVE FINANCE ──
async function saveFinance() {
  getCredentials(); if (!getActiveSbUrl() || !getActiveSbKey()) { showToast('Not connected to Supabase', 'error'); return; }
  var id = document.getElementById('fin-id').value;
  var finCenEl = document.getElementById('fin-center');
  var payload = { type:document.getElementById('fin-type').value, description:document.getElementById('fin-desc').value.trim(), amount:document.getElementById('fin-amount').value, category:document.getElementById('fin-cat').value, date:document.getElementById('fin-date').value, wellness_center_id: (finCenEl && finCenEl.value) || null };
  if (!payload.amount||!payload.date) { showToast('Amount and date required','error'); return; }
  try {
    if(id) await dbUpdate('finance',id,payload); else await dbInsert('finance',payload);
    auditLog(id?'Updated':'Added','Finance', (payload.type==='income'?'Income':'Expense')+' ₹'+Number(payload.amount).toLocaleString('en-IN')+(payload.description?' — '+payload.description:''));
    showToast(id?'Transaction updated!':'Transaction added!'); closeModal('finance'); await loadFinance(); renderOverview();
  }
  catch(e) { showToast('Error: '+e.message,'error'); }
}
function editFinance(id) {
  var f = D.finance.find(function(x){return x.id===id;});
  document.getElementById('fin-id').value=f.id;
  document.getElementById('fin-type').value=f.type;
  onFinTypeChange();
  document.getElementById('fin-desc').value=f.description||'';
  document.getElementById('fin-amount').value=f.amount;
  // restore saved category if it exists in the rebuilt list
  var catSel = document.getElementById('fin-cat');
  var savedCat = f.category||'';
  var found = Array.from(catSel.options).some(function(o){return o.value===savedCat||o.text===savedCat;});
  if (!found && savedCat) { var o = document.createElement('option'); o.text=savedCat; o.value=savedCat; catSel.add(o); }
  catSel.value=savedCat;
  document.getElementById('fin-date').value=f.date||new Date().toISOString().split('T')[0];
  var finCenEl2 = document.getElementById('fin-center');
  if(finCenEl2) finCenEl2.value = f.wellness_center_id || '';
  openModal('finance');
}

// ── DELETE ──
async function delRecord(table, id, section) {
  getCredentials(); if (!getActiveSbUrl() || !getActiveSbKey()) { showToast('Not connected to Supabase', 'error'); return; }
  if (!confirm('Delete this record?')) return;
  // Grab name for audit before deleting
  var entityName = section.charAt(0).toUpperCase()+section.slice(1);
  var nameMap = {centers:D.centers,customers:D.customers,finance:D.finance,coaches:D.coaches};
  var rec = nameMap[section] && nameMap[section].find(function(r){return r.id===id;});
  var detail = rec ? (rec.name||rec.description||id) : id;
  try {
    await dbDelete(table, id);
    auditLog('Deleted', entityName, detail);
    showToast('Deleted!');
    if(section==='centers') await loadCenters();
    if(section==='customers') await loadCustomers();
    if(section==='attendance') await loadAttendance();
    if(section==='body') await loadBody();
    if(section==='finance') await loadFinance();
    if(section==='coaches') await loadCoaches();
    renderOverview();
  } catch(e) { showToast('Error: '+e.message,'error'); }
}

// ── AUDIT LOG ──
function auditLog(action, entity, detail) {
  var actor = (OWNER_PROFILE && OWNER_PROFILE.name) ? OWNER_PROFILE.name : 'Supervisor';
  if (window._centerAuth && window._centerAuth.centerId) {
    var ctr = D.centers.find(function(c){return c.id===window._centerAuth.centerId;});
    if (ctr) actor = ctr.name + ' (coach login)';
  }
  var entry = { ts: new Date().toISOString(), actor: actor, action: action, entity: entity, detail: detail, centerId: ACTIVE_CENTER || null };
  var log = JSON.parse(localStorage.getItem('auditLog') || '[]');
  log.unshift(entry);
  if (log.length > 500) log = log.slice(0, 500);
  localStorage.setItem('auditLog', JSON.stringify(log));
}
function renderAuditLog() {
  var log = JSON.parse(localStorage.getItem('auditLog') || '[]');
  var q = (document.getElementById('audit-search')||{}).value || '';
  var ef = (document.getElementById('audit-filter')||{}).value || '';
  q = q.toLowerCase();
  var filtered = log.filter(function(e){
    if (ACTIVE_CENTER && e.centerId && e.centerId !== ACTIVE_CENTER) return false;
    if (ef && e.entity !== ef) return false;
    if (q && !(e.actor||'').toLowerCase().includes(q) && !(e.action||'').toLowerCase().includes(q) && !(e.entity||'').toLowerCase().includes(q) && !(e.detail||'').toLowerCase().includes(q)) return false;
    return true;
  });
  var el = document.getElementById('audit-list'); if(!el) return;
  if (!filtered.length) { el.innerHTML='<div style="text-align:center;padding:32px;color:var(--muted)"><div style="font-size:32px;margin-bottom:8px">🕵️</div><p>No audit entries yet. Changes will appear here.</p></div>'; return; }
  var actionColors = { Added:'var(--success)', Updated:'var(--primary)', Deleted:'var(--danger)', Marked:'#f59e0b', Broadcast:'#25D366' };
  el.innerHTML = filtered.map(function(e){
    var dt = new Date(e.ts);
    var dateStr = dt.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
    var timeStr = dt.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
    var color = actionColors[e.action] || 'var(--muted)';
    return '<div style="display:flex;gap:12px;padding:10px 16px;border-bottom:1px solid var(--border);align-items:flex-start">'+
      '<div style="min-width:44px;text-align:center"><span style="background:'+color+';color:#fff;border-radius:4px;font-size:10px;font-weight:700;padding:2px 6px">'+e.action+'</span></div>'+
      '<div style="flex:1"><div style="font-size:13px;font-weight:600;color:var(--text)">'+e.entity+' — '+e.detail+'</div>'+
        '<div style="font-size:11px;color:var(--muted);margin-top:2px">👤 '+e.actor+' &nbsp;·&nbsp; '+dateStr+' at '+timeStr+'</div>'+
      '</div>'+
    '</div>';
  }).join('');
}

// ════════════════════════════════════════════════
// 🎯 RETENTION FEATURES
// ════════════════════════════════════════════════

// ── P1: Pack Renewal WhatsApp ──
function sendRenewalWA(cid) {
  var c = D.customers.find(function(x){return x.id===cid;});
  if (!c) return;
  var st = getDaysLeft(c);
  var bodyRecs = D.body.filter(function(b){return b.customer_id===cid;}).sort(function(a,b){return new Date(b.date)-new Date(a.date);});
  var progressLine = '';
  if (bodyRecs.length >= 2) {
    var latest = bodyRecs[0], first = bodyRecs[bodyRecs.length-1];
    var wDiff = (Number(latest.weight) - Number(first.weight)).toFixed(1);
    var sign = wDiff < 0 ? '' : '+';
    progressLine = '\n\nYour progress so far: *'+sign+wDiff+'kg* from '+first.weight+'kg to '+latest.weight+'kg 💪';
  }
  var msg = '🌿 *'+getCenterName()+' Update*\n\nHi *'+c.name+'*! 😊\n\nYour *'+( c.pack_type||'wellness pack')+' ends in just '+st.days+' day'+(st.days===1?'':'s')+'*.'+progressLine+'\n\nDon\'t break your momentum — let\'s renew and keep going! 🙏\n\nReply here or visit the center to renew. 💚';
  var phone = (c.contact||'').replace(/\D/g,'');
  if (phone.length===10) phone=COUNTRY_CODE+phone;
  window.open('https://api.whatsapp.com/send?'+(phone?'phone='+phone+'&':'')+'text='+encodeURIComponent(msg),'_blank');
}

// ── P2: Inactive Re-engage WhatsApp ──
function sendInactiveWA(cid) {
  var c = D.customers.find(function(x){return x.id===cid;});
  if (!c) return;
  var atts = D.attendance.filter(function(a){return a.customer_id===cid&&a.status==='present';});
  var lastDate = atts.length ? atts.sort(function(a,b){return new Date(b.date)-new Date(a.date);})[0].date : null;
  var since = lastDate ? 'since *'+lastDate+'*' : 'in a while';
  var goal = c.goal || 'your wellness goal';
  var msg = '🌿 *We Miss You at '+getCenterName()+'!*\n\nHi *'+c.name+'*! 😊\n\nWe haven\'t seen you '+since+'. Life gets busy — we totally understand! 🤗\n\nBut remember your goal: *'+goal+'* — every visit counts, even just 15 minutes!\n\nCome back tomorrow? Your body will thank you 💪\n\n_See you soon!_ 🌱';
  var phone = (c.contact||'').replace(/\D/g,'');
  if (phone.length===10) phone=COUNTRY_CODE+phone;
  window.open('https://api.whatsapp.com/send?'+(phone?'phone='+phone+'&':'')+'text='+encodeURIComponent(msg),'_blank');
}

// ── P3: Milestone Badge Detection ──
function getMilestones(cid) {
  var recs = D.body.filter(function(b){return b.customer_id===cid;}).sort(function(a,b){return new Date(a.date)-new Date(b.date);});
  var milestones = [];
  var attCount = D.attendance.filter(function(a){return a.customer_id===cid&&a.status==='present';}).length;
  var streak = getStreak(cid);
  var renewals = (D.packHistory||[]).filter(function(h){return h.customer_id===cid;}).length;

  // Body composition milestones (need 2+ scans)
  if (recs.length >= 2) {
    var first = recs[0], latest = recs[recs.length-1];
    var wDiff = Number(first.weight) - Number(latest.weight);
    var fDiff = Number(first.fat_percentage) - Number(latest.fat_percentage);
    var c = D.customers.find(function(x){return x.id===cid;});
    var isGain = c && (c.goal||'').toLowerCase().includes('gain');
    if (!isGain) {
      if (wDiff >= 1)  milestones.push({label:'−'+wDiff.toFixed(1)+'kg Lost', cls:'ms-green', icon:'⚖️'});
      if (wDiff >= 3)  milestones.push({label:'−3kg Club', cls:'ms-gold', icon:'🏆'});
      if (wDiff >= 5)  milestones.push({label:'−5kg Star', cls:'ms-gold', icon:'⭐'});
      if (wDiff >= 10) milestones.push({label:'−10kg Legend', cls:'ms-gold', icon:'👑'});
    } else {
      if (wDiff <= -1) milestones.push({label:'+'+Math.abs(wDiff).toFixed(1)+'kg Gained', cls:'ms-green', icon:'💪'});
      if (wDiff <= -3) milestones.push({label:'+3kg Gained', cls:'ms-gold', icon:'🏆'});
    }
    if (fDiff >= 3)  milestones.push({label:'−3% Fat', cls:'ms-green', icon:'🔥'});
    if (fDiff >= 5)  milestones.push({label:'−5% Fat', cls:'ms-gold', icon:'🔥'});
  }

  // Attendance milestones
  if (attCount >= 7)   milestones.push({label:'First Week', cls:'ms-blue', icon:'🎯'});
  if (attCount >= 10)  milestones.push({label:'10 Sessions', cls:'ms-blue', icon:'💪'});
  if (attCount >= 25)  milestones.push({label:'25 Sessions', cls:'ms-gold', icon:'🏅'});
  if (attCount >= 50)  milestones.push({label:'50 Sessions', cls:'ms-gold', icon:'🏆'});
  if (attCount >= 100) milestones.push({label:'100 Sessions', cls:'ms-gold', icon:'👑'});

  // Streak milestones
  if (streak >= 7)  milestones.push({label:'7-Day Streak', cls:'ms-green', icon:'🔥'});
  if (streak >= 30) milestones.push({label:'30-Day Streak', cls:'ms-gold', icon:'🔥'});

  // Renewal milestones
  if (renewals >= 1) milestones.push({label:'1st Renewal', cls:'ms-blue', icon:'🔄'});
  if (renewals >= 3) milestones.push({label:'3 Renewals', cls:'ms-gold', icon:'🏆'});
  if (renewals >= 5) milestones.push({label:'5 Renewals', cls:'ms-gold', icon:'👑'});

  return milestones;
}
function sendMilestoneWA(cid) {
  var c = D.customers.find(function(x){return x.id===cid;});
  if (!c) return;
  var ms = getMilestones(cid);
  if (!ms.length) { showToast('No milestones yet for this customer','error'); return; }
  var msText = ms.map(function(m){return '🏆 '+m.label;}).join('\n');
  var msg = '🌿 *Milestone Alert — '+getCenterName()+'*\n\nHi *'+c.name+'*! 🎉\n\nYou\'ve achieved something amazing:\n\n'+msText+'\n\nYou are proof that consistency works! Keep going — your best results are still ahead 🚀\n\n_Your '+getCenterName()+' Family_ 💚';
  var phone = (c.contact||'').replace(/\D/g,'');
  if (phone.length===10) phone=COUNTRY_CODE+phone;
  window.open('https://api.whatsapp.com/send?'+(phone?'phone='+phone+'&':'')+'text='+encodeURIComponent(msg),'_blank');
}

// ── P4: Birthday on Overview ──
function checkBirthdaysToday() {
  var todayMMDD = new Date().toISOString().slice(5,10);
  var bdays = D.customers.filter(function(c){return c.dob && c.dob.slice(5,10)===todayMMDD;});
  var el = document.getElementById('birthday-banner');
  if (!el) return;
  if (!bdays.length) { el.style.display='none'; return; }
  el.style.display='block';
  el.innerHTML = bdays.map(function(c){
    var phone=(c.contact||'').replace(/\D/g,''); if(phone.length===10) phone=COUNTRY_CODE+phone;
    return '<span>🎂 <strong>'+c.name+'</strong> — Birthday Today! <button class="wa-btn" style="font-size:11px;padding:2px 7px" onclick="sendBirthdayWA(\''+c.id+'\')">💬 Wish</button></span>';
  }).join(' &nbsp;|&nbsp; ');
}
function sendBirthdayWA(cid) {
  var c = D.customers.find(function(x){return x.id===cid;}); if(!c||!c.contact) return;
  var phone=(c.contact||'').replace(/\D/g,''); if(phone.length===10) phone=COUNTRY_CODE+phone;
  var msg='🎂 *Happy Birthday '+c.name+'!*\n\nWishing you a wonderful birthday filled with joy and great health! 🌿💚\n\n_Your '+getCenterName()+' Family_';
  window.open('https://api.whatsapp.com/send?phone='+phone+'&text='+encodeURIComponent(msg),'_blank');
}

// ════════════════════════════════════════════════
// 📈 ANALYTICS DASHBOARD
// ════════════════════════════════════════════════
var _charts = {};
function destroyChart(id) { if(_charts[id]){_charts[id].destroy();delete _charts[id];} }

function renderAnalytics() {
  if (!D.customers) return;
  if (isCenterSession() && !isGrowthPlan()) {
    var kpiEl = document.getElementById('analytics-kpis');
    if (kpiEl) kpiEl.innerHTML = planLockHtml('Analytics Dashboard', 'Unlock retention charts, revenue trends, customer activity, and business insights.');
    return;
  }

  // ── Read all slicers ──
  var periodMonths = parseInt(document.getElementById('slicer-from')?.dataset?.customActive === '1' ? '-1' : (document.querySelector('.slicer-chip.active[data-slicer="period"]')?.dataset?.val || '3'));
  var fromDate = document.getElementById('slicer-from')?.value || '';
  var toDate   = document.getElementById('slicer-to')?.value   || '';
  var packFilter   = document.getElementById('slicer-pack')?.value   || '';
  var goalFilter   = document.getElementById('slicer-goal')?.value   || '';
  var genderFilter = document.getElementById('slicer-gender')?.value || '';
  var statusFilter = document.querySelector('.slicer-chip.active[data-slicer="status"]')?.dataset?.val || '';
  var centerFilter = document.getElementById('slicer-center')?.value || '';
  var revTypeFilter = document.getElementById('slicer-revenue-type')?.value || '';
  var metricFilter = document.getElementById('slicer-metric')?.value || 'weight';

  // ── Populate center dropdown once ──
  var cSel = document.getElementById('slicer-center');
  if (cSel && cSel.options.length <= 1) {
    D.centers.forEach(function(ct){ var o=document.createElement('option'); o.value=ct.id; o.textContent=ct.name; cSel.appendChild(o); });
  }

  // ── Build date range ──
  var now = new Date(); now.setHours(23,59,59);
  var rangeEnd   = toDate   ? new Date(toDate+'T23:59:59')   : now;
  var rangeStart = fromDate ? new Date(fromDate+'T00:00:00') : (periodMonths > 0 ? new Date(new Date().setMonth(new Date().getMonth() - periodMonths)) : new Date('2000-01-01'));

  function inRange(dateStr) {
    if (!dateStr) return false;
    var d = new Date(dateStr); return d >= rangeStart && d <= rangeEnd;
  }

  // ── Filter customers ──
  var filtCusts = D.customers.filter(function(c) {
    if (packFilter   && c.pack_type !== packFilter)   return false;
    if (goalFilter   && c.goal      !== goalFilter)   return false;
    if (genderFilter && c.gender    !== genderFilter) return false;
    if (centerFilter && c.wellness_center_id !== centerFilter) return false;
    if (statusFilter === 'active')   return getDaysLeft(c).active;
    if (statusFilter === 'expired')  return !getDaysLeft(c).active;
    if (statusFilter === 'inactive') return isInactive(c.id);
    return true;
  });

  var filtIds = filtCusts.map(function(c){return c.id;});

  // ── Filter finance ──
  var filtFin = (ACTIVE_CENTER ? filterFinanceByCenter(D.finance) : D.finance).filter(function(f){ return inRange(f.date); });

  // ── Filter attendance ──
  var filtAtt = D.attendance.filter(function(a){ return filtIds.indexOf(a.customer_id) > -1 && inRange(a.date); });

  // ── Filter body ──
  var filtBody = D.body.filter(function(b){ return filtIds.indexOf(b.customer_id) > -1; });

  // ── Active slicer summary label ──
  var tags = [];
  if (fromDate || toDate) tags.push('📅 Custom range');
  else if (periodMonths > 0) tags.push('📅 Last '+periodMonths+' month'+(periodMonths>1?'s':''));
  else tags.push('📅 All time');
  if (packFilter)   tags.push('📦 '+packFilter);
  if (goalFilter)   tags.push('🎯 '+goalFilter);
  if (genderFilter) tags.push('👤 '+genderFilter);
  if (statusFilter) tags.push('🟢 '+statusFilter);
  if (centerFilter) { var ct=D.centers.find(function(x){return x.id===centerFilter;}); tags.push('🏢 '+(ct?ct.name:centerFilter)); }
  document.getElementById('slicer-summary').innerHTML =
    '<strong>Showing:</strong> ' + filtCusts.length + ' customers &nbsp;|&nbsp; ' + tags.join(' &nbsp;·&nbsp; ');

  // ── KPIs ──
  var totalCusts   = filtCusts.length;
  var active       = filtCusts.filter(function(c){return getDaysLeft(c).active;}).length;
  var retentionRate= totalCusts>0 ? Math.round((active/totalCusts)*100) : 0;
  var totalIncome  = filtFin.filter(function(f){return f.type==='income';}).reduce(function(s,f){return s+Number(f.amount);},0);
  var totalExpense = filtFin.filter(function(f){return f.type==='expense';}).reduce(function(s,f){return s+Number(f.amount);},0);
  var stars = filtCusts.filter(function(c){return D.customers.filter(function(x){return x.referred_by_id===c.id;}).length>=2;}).length;

  document.getElementById('analytics-kpis').innerHTML =
    '<div class="stat"><div class="stat-l">Customers<span class="analytics-badge">'+totalCusts+'</span></div><div class="stat-v" style="color:'+(retentionRate>=70?'var(--success)':'var(--danger)')+'">'+retentionRate+'% retention</div></div>'+
    '<div class="stat"><div class="stat-l">Revenue (period)</div><div class="stat-v" style="font-size:18px;color:var(--success)">₹'+totalIncome.toLocaleString('en-IN')+'</div></div>'+
    '<div class="stat"><div class="stat-l">Expense (period)</div><div class="stat-v" style="font-size:18px;color:var(--danger)">₹'+totalExpense.toLocaleString('en-IN')+'</div></div>'+
    '<div class="stat"><div class="stat-l">Net Profit</div><div class="stat-v" style="font-size:18px;color:'+(totalIncome-totalExpense>=0?'var(--primary)':'var(--danger)')+'">₹'+(totalIncome-totalExpense).toLocaleString('en-IN')+'</div></div>'+
    '<div class="stat"><div class="stat-l">⭐ Star Customers</div><div class="stat-v" style="color:#b07800">'+stars+'</div></div>';

  // ── Retention bars ──
  var inactive = filtCusts.filter(function(c){return isInactive(c.id);}).length;
  var expired  = filtCusts.length - active;
  document.getElementById('analytics-retention').innerHTML =
    '<div style="margin-bottom:8px;font-size:13px;color:var(--muted)">Based on '+totalCusts+' filtered customers</div>'+
    mkRetRow('Active', active, totalCusts, 'var(--success)')+
    mkRetRow('Inactive 7d+', inactive, totalCusts, 'var(--accent)')+
    mkRetRow('Expired Pack', expired, totalCusts, 'var(--danger)');

  // ── Revenue trend ──
  var numMonths = periodMonths > 0 ? Math.min(periodMonths, 12) : 12;
  var months=[]; var incData=[]; var expData=[];
  for(var i=numMonths-1;i>=0;i--){
    var d=new Date(); d.setDate(1); d.setMonth(d.getMonth()-i);
    var ym=d.toISOString().substring(0,7);
    months.push(d.toLocaleString('en-IN',{month:'short',year:'2-digit'}));
    var mFin = (ACTIVE_CENTER ? filterFinanceByCenter(D.finance) : D.finance).filter(function(f){return f.date && f.date.startsWith(ym);});
    incData.push(mFin.filter(function(f){return f.type==='income';}).reduce(function(s,f){return s+Number(f.amount);},0));
    expData.push(mFin.filter(function(f){return f.type==='expense';}).reduce(function(s,f){return s+Number(f.amount);},0));
  }
  // ── 3-Month Moving Average ──
  function movingAvg(arr, n) {
    return arr.map(function(_, i) {
      if (i < n - 1) return null;
      var sum = 0;
      for (var k = 0; k < n; k++) sum += arr[i - k];
      return Math.round(sum / n);
    });
  }
  var incMA = movingAvg(incData, 3);
  var expMA = movingAvg(expData, 3);
  var revDatasets = [];
  if (!revTypeFilter || revTypeFilter==='income')  revDatasets.push({label:'Income', data:incData, backgroundColor:'rgba(39,174,96,0.75)', borderRadius:4, order:2});
  if (!revTypeFilter || revTypeFilter==='expense') revDatasets.push({label:'Expense',data:expData, backgroundColor:'rgba(192,57,43,0.6)',  borderRadius:4, order:2});
  if (!revTypeFilter || revTypeFilter==='income')  revDatasets.push({label:'Income 3M Avg', data:incMA, type:'line', borderColor:'#16a34a', backgroundColor:'transparent', borderWidth:2, borderDash:[5,4], pointRadius:3, pointBackgroundColor:'#16a34a', tension:0.3, order:1});
  if (!revTypeFilter || revTypeFilter==='expense') revDatasets.push({label:'Expense 3M Avg',data:expMA, type:'line', borderColor:'#e74c3c', backgroundColor:'transparent', borderWidth:2, borderDash:[5,4], pointRadius:3, pointBackgroundColor:'#e74c3c', tension:0.3, order:1});
  destroyChart('revenue');
  if (document.getElementById('chart-revenue')) {
    _charts['revenue'] = new Chart(document.getElementById('chart-revenue'),{
      type:'bar',
      data:{labels:months, datasets:revDatasets},
      options:{
        responsive:true,
        plugins:{
          legend:{position:'bottom'},
          tooltip:{callbacks:{label:function(ctx){return ctx.dataset.label+': ₹'+Number(ctx.raw||0).toLocaleString('en-IN');}}}
        },
        scales:{y:{beginAtZero:true, ticks:{callback:function(v){return '₹'+v.toLocaleString('en-IN');}}}}
      }
    });
  }

  // ── Revenue Forecast (Linear Regression) ──
  (function() {
    var el = document.getElementById('analytics-forecast'); if (!el) return;
    function linReg(arr) {
      var n = arr.length, sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
      arr.forEach(function(y, x) { sumX += x; sumY += y; sumXY += x * y; sumX2 += x * x; });
      var slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) || 0;
      var intercept = (sumY - slope * sumX) / n;
      return { slope: slope, intercept: intercept, next: Math.max(0, Math.round(intercept + slope * n)) };
    }
    var nextMonthDate = new Date(); nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
    var nextLabel = nextMonthDate.toLocaleString('en-IN', {month:'long', year:'numeric'});
    var incF = incData.length >= 2 ? linReg(incData) : null;
    var expF = expData.length >= 2 ? linReg(expData) : null;
    if (!incF && !expF) { el.innerHTML = ''; return; }
    function trendArrow(slope) { return slope > 0 ? '<span style="color:#16a34a">▲</span>' : slope < 0 ? '<span style="color:#e74c3c">▼</span>' : '→'; }
    function trendColor(slope, isExpense) {
      if (slope === 0) return 'var(--muted)';
      var good = isExpense ? slope < 0 : slope > 0;
      return good ? '#16a34a' : '#e74c3c';
    }
    var netF = (incF ? incF.next : 0) - (expF ? expF.next : 0);
    el.innerHTML =
      '<div style="border-top:1px solid var(--border);margin-top:14px;padding-top:12px">' +
      '<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">📈 Forecast — ' + nextLabel + '</div>' +
      '<div style="display:flex;gap:12px;flex-wrap:wrap">' +
      (incF ? '<div style="flex:1;min-width:120px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px 14px">' +
        '<div style="font-size:11px;color:#166534;font-weight:600">Projected Income</div>' +
        '<div style="font-size:20px;font-weight:700;color:#16a34a;margin:2px 0">₹' + incF.next.toLocaleString('en-IN') + '</div>' +
        '<div style="font-size:11px;color:var(--muted)">' + trendArrow(incF.slope) + ' ' + (incF.slope >= 0 ? '+' : '') + '₹' + Math.abs(Math.round(incF.slope)).toLocaleString('en-IN') + '/mo trend</div>' +
        '</div>' : '') +
      (expF ? '<div style="flex:1;min-width:120px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:10px 14px">' +
        '<div style="font-size:11px;color:#991b1b;font-weight:600">Projected Expense</div>' +
        '<div style="font-size:20px;font-weight:700;color:#e74c3c;margin:2px 0">₹' + expF.next.toLocaleString('en-IN') + '</div>' +
        '<div style="font-size:11px;color:var(--muted)">' + trendArrow(expF.slope) + ' ' + (expF.slope >= 0 ? '+' : '') + '₹' + Math.abs(Math.round(expF.slope)).toLocaleString('en-IN') + '/mo trend</div>' +
        '</div>' : '') +
      (incF && expF ? '<div style="flex:1;min-width:120px;background:' + (netF >= 0 ? '#f0fdf4' : '#fef2f2') + ';border:1px solid ' + (netF >= 0 ? '#bbf7d0' : '#fecaca') + ';border-radius:10px;padding:10px 14px">' +
        '<div style="font-size:11px;color:' + (netF >= 0 ? '#166534' : '#991b1b') + ';font-weight:600">Projected Net Profit</div>' +
        '<div style="font-size:20px;font-weight:700;color:' + (netF >= 0 ? '#16a34a' : '#e74c3c') + ';margin:2px 0">₹' + netF.toLocaleString('en-IN') + '</div>' +
        '<div style="font-size:11px;color:var(--muted)">Based on linear trend</div>' +
        '</div>' : '') +
      '</div>' +
      '<div style="font-size:10px;color:var(--muted);margin-top:8px">* Forecast uses linear regression on the selected period. Actual results may vary.</div>' +
      '</div>';
  })();

  // ── Pack Renewal Forecast ──
  (function() {
    var el = document.getElementById('analytics-renewal-forecast'); if (!el) return;
    var today = new Date(); today.setHours(0,0,0,0);
    var todayStr = today.toISOString().split('T')[0];
    // Next month window
    var nm = new Date(today.getFullYear(), today.getMonth()+1, 1);
    var nmEnd = new Date(today.getFullYear(), today.getMonth()+2, 0);
    var nmStartStr = nm.toISOString().split('T')[0];
    var nmEndStr = nmEnd.toISOString().split('T')[0];
    // This month window
    var tmStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    var tmEnd = new Date(today.getFullYear(), today.getMonth()+1, 0).toISOString().split('T')[0];
    var custs = ACTIVE_CENTER ? filterByCenter(D.customers) : D.customers;
    // Packs expiring this month (remaining)
    var expiringThisMonth = custs.filter(function(c){ return c.pack_end_date && c.pack_end_date >= todayStr && c.pack_end_date <= tmEnd; });
    // Packs expiring next month
    var expiringNextMonth = custs.filter(function(c){ return c.pack_end_date && c.pack_end_date >= nmStartStr && c.pack_end_date <= nmEndStr; });
    // Historical renewal rate: customers who have pack_history count > 0 (renewed at least once)
    var renewedIds = new Set((D.packHistory||[]).map(function(p){ return p.customer_id; }));
    var everExpired = custs.filter(function(c){ return c.pack_end_date && c.pack_end_date < todayStr; });
    var renewalRate = everExpired.length > 0 ? Math.round((everExpired.filter(function(c){ return renewedIds.has(c.id); }).length / everExpired.length) * 100) : 70;
    // Avg pack price from finance income records
    var incomes = (ACTIVE_CENTER ? filterFinanceByCenter(D.finance) : D.finance).filter(function(f){ return f.type==='income' && Number(f.amount) > 500; });
    var avgPackPrice = incomes.length ? Math.round(incomes.reduce(function(s,f){ return s+Number(f.amount); },0) / incomes.length) : 1500;
    // Forecast
    var forecastThis = Math.round(expiringThisMonth.length * (renewalRate/100) * avgPackPrice);
    var forecastNext = Math.round(expiringNextMonth.length * (renewalRate/100) * avgPackPrice);
    var nmLabel = nm.toLocaleString('en-IN',{month:'long',year:'numeric'});
    var tmLabel = new Date(today.getFullYear(),today.getMonth(),1).toLocaleString('en-IN',{month:'long',year:'numeric'});
    el.innerHTML =
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:16px">'
      + '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px">'
      +   '<div style="font-size:11px;color:#166534;font-weight:700;margin-bottom:4px">This Month Expiring</div>'
      +   '<div style="font-size:22px;font-weight:800;color:#16a34a">'+expiringThisMonth.length+'</div>'
      +   '<div style="font-size:11px;color:var(--muted)">packs end by '+tmEnd+'</div>'
      + '</div>'
      + '<div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:14px">'
      +   '<div style="font-size:11px;color:#92400e;font-weight:700;margin-bottom:4px">Next Month Expiring</div>'
      +   '<div style="font-size:22px;font-weight:800;color:#d97706">'+expiringNextMonth.length+'</div>'
      +   '<div style="font-size:11px;color:var(--muted)">packs end in '+nmLabel+'</div>'
      + '</div>'
      + '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px">'
      +   '<div style="font-size:11px;color:#1d4ed8;font-weight:700;margin-bottom:4px">Renewal Rate</div>'
      +   '<div style="font-size:22px;font-weight:800;color:#2563eb">'+renewalRate+'%</div>'
      +   '<div style="font-size:11px;color:var(--muted)">historical avg</div>'
      + '</div>'
      + '<div style="background:#fdf4ff;border:1px solid #e9d5ff;border-radius:10px;padding:14px">'
      +   '<div style="font-size:11px;color:#7e22ce;font-weight:700;margin-bottom:4px">Avg Pack Price</div>'
      +   '<div style="font-size:22px;font-weight:800;color:#9333ea">₹'+avgPackPrice.toLocaleString('en-IN')+'</div>'
      +   '<div style="font-size:11px;color:var(--muted)">from income records</div>'
      + '</div>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
      + '<div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:1.5px solid #86efac;border-radius:12px;padding:16px">'
      +   '<div style="font-size:12px;font-weight:700;color:#166534;margin-bottom:6px">📅 '+tmLabel+' Forecast</div>'
      +   '<div style="font-size:28px;font-weight:800;color:#16a34a">₹'+forecastThis.toLocaleString('en-IN')+'</div>'
      +   '<div style="font-size:11px;color:#166534;margin-top:4px">'+expiringThisMonth.length+' packs × '+renewalRate+'% × ₹'+avgPackPrice.toLocaleString('en-IN')+'</div>'
      + '</div>'
      + '<div style="background:linear-gradient(135deg,#eff6ff,#dbeafe);border:1.5px solid #93c5fd;border-radius:12px;padding:16px">'
      +   '<div style="font-size:12px;font-weight:700;color:#1d4ed8;margin-bottom:6px">📅 '+nmLabel+' Forecast</div>'
      +   '<div style="font-size:28px;font-weight:800;color:#2563eb">₹'+forecastNext.toLocaleString('en-IN')+'</div>'
      +   '<div style="font-size:11px;color:#1d4ed8;margin-top:4px">'+expiringNextMonth.length+' packs × '+renewalRate+'% × ₹'+avgPackPrice.toLocaleString('en-IN')+'</div>'
      + '</div>'
      + '</div>'
      + '<div style="font-size:10px;color:var(--muted);margin-top:10px">* Based on historical renewal rate and average pack price from income records. Actual results may vary.</div>';
  })();

  // ── Attendance by day (filtered) ──
  var days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var dayCounts=[0,0,0,0,0,0,0];
  filtAtt.filter(function(a){return a.status==='present';}).forEach(function(a){
    var d=new Date(a.date); dayCounts[d.getDay()]++;
  });
  destroyChart('attendance');
  if (document.getElementById('chart-attendance')) {
    _charts['attendance'] = new Chart(document.getElementById('chart-attendance'),{
      type:'bar', data:{labels:days,datasets:[{label:'Check-ins',data:dayCounts,backgroundColor:'rgba(45,90,61,0.75)',borderRadius:4}]},
      options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}
    });
  }

  // ── Streak distribution (filtered customers) ──
  var streakBuckets={'0 days':0,'1–3':0,'4–7':0,'8–14':0,'15+':0};
  filtCusts.forEach(function(c){
    var s=getStreak(c.id);
    if(s===0)      streakBuckets['0 days']++;
    else if(s<=3)  streakBuckets['1–3']++;
    else if(s<=7)  streakBuckets['4–7']++;
    else if(s<=14) streakBuckets['8–14']++;
    else           streakBuckets['15+']++;
  });
  destroyChart('streaks');
  if (document.getElementById('chart-streaks')) {
    _charts['streaks'] = new Chart(document.getElementById('chart-streaks'),{
      type:'doughnut',
      data:{labels:Object.keys(streakBuckets),datasets:[{data:Object.values(streakBuckets),backgroundColor:['#c0392b','#e8a838','#3d7a52','#2b5ce6','#9333ea'],borderWidth:2}]},
      options:{responsive:true,plugins:{legend:{position:'bottom'}}}
    });
  }

  // ── Top Referrers (filtered) ──
  var refMap={};
  filtCusts.forEach(function(c){ if(c.referred_by_id) refMap[c.referred_by_id]=(refMap[c.referred_by_id]||0)+1; });
  var topRefs=Object.keys(refMap).map(function(id){
    var c=D.customers.find(function(x){return x.id===id;});
    if(!c){ var co=D.coaches.find(function(x){return x.id===id;}); if(co) c=co; }
    return {name:c?c.name:id,count:refMap[id]};
  }).sort(function(a,b){return b.count-a.count;}).slice(0,8);
  var refEl=document.getElementById('analytics-referrers');
  if(!topRefs.length){ refEl.innerHTML='<div style="color:var(--muted);font-size:13px">No referrals in this filter.</div>'; }
  else refEl.innerHTML=topRefs.map(function(r,i){
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--surface2)">'
      +'<span>'+(i===0?'🥇':i===1?'🥈':i===2?'🥉':'  ')+'  <strong>'+r.name+'</strong></span>'
      +'<span class="badge '+(r.count>=2?'ms-gold':'ms-green')+'" style="border-radius:12px">'+r.count+' referral'+(r.count>1?'s':'')+'</span>'
      +'</div>';
  }).join('');

  // ── Pack distribution (filtered) ──
  var packMap={};
  filtCusts.forEach(function(c){var p=c.pack_type||'Unknown';packMap[p]=(packMap[p]||0)+1;});
  destroyChart('packs');
  if (document.getElementById('chart-packs')) {
    _charts['packs'] = new Chart(document.getElementById('chart-packs'),{
      type:'pie',
      data:{labels:Object.keys(packMap),datasets:[{data:Object.values(packMap),backgroundColor:['#2d5a3d','#e8a838','#2b5ce6','#9333ea','#c0392b','#27ae60'],borderWidth:2}]},
      options:{responsive:true,plugins:{legend:{position:'bottom'}}}
    });
  }

  // ── Body metric trend (filtered, metric switcher) ──
  var metricLabel = {weight:'Weight (kg)', fat:'Body Fat %', muscle:'Muscle %', bmi:'BMI'}[metricFilter] || 'Weight (kg)';
  var metricKey   = {weight:'weight', fat:'fat_percentage', muscle:'muscle_percentage', bmi:'bmi'}[metricFilter] || 'weight';
  var metricColor = {weight:'#2d5a3d', fat:'#c0392b', muscle:'#2b5ce6', bmi:'#9333ea'}[metricFilter] || '#2d5a3d';
  var monthsW=[]; var avgMet=[];
  for(var j=numMonths-1;j>=0;j--){
    var dW=new Date(); dW.setDate(1); dW.setMonth(dW.getMonth()-j);
    var ymW=dW.toISOString().substring(0,7);
    monthsW.push(dW.toLocaleString('en-IN',{month:'short'}));
    var recs=filtBody.filter(function(b){return b.date&&b.date.startsWith(ymW)&&b[metricKey];});
    avgMet.push(recs.length ? parseFloat((recs.reduce(function(s,b){return s+Number(b[metricKey]);},0)/recs.length).toFixed(2)) : null);
  }
  destroyChart('weightloss');
  if (document.getElementById('chart-weightloss')) {
    _charts['weightloss'] = new Chart(document.getElementById('chart-weightloss'),{
      type:'line',
      data:{labels:monthsW,datasets:[{label:metricLabel,data:avgMet,borderColor:metricColor,backgroundColor:metricColor+'15',tension:0.35,fill:true,pointBackgroundColor:metricColor,pointRadius:5}]},
      options:{responsive:true,plugins:{legend:{position:'bottom'}},scales:{y:{beginAtZero:false}},spanGaps:true}
    });
  }

  // ── Center Comparison (supervisor, no center filter, 2+ centers) ──
  (function() {
    var compWrap = document.getElementById('analytics-center-comparison');
    if (!compWrap) return;
    // Only show when supervisor is viewing all centers
    if (ACTIVE_CENTER || D.centers.length < 2) { compWrap.style.display = 'none'; return; }
    compWrap.style.display = 'block';
    var thisMonth = new Date().toISOString().substring(0, 7);
    var colors = ['#2d5a3d','#e8a838','#2b5ce6','#9333ea','#c0392b','#27ae60','#e67e22','#16a34a'];
    var centerLabels = [], revData = [], attData = [], tableRows = [];
    D.centers.forEach(function(center, i) {
      var rev = (D.finance||[]).filter(function(f){
        return f.wellness_center_id === center.id && f.type === 'income' && (f.date||'').startsWith(thisMonth);
      }).reduce(function(s, f){ return s + Number(f.amount||0); }, 0);
      var att = (D.attendance||[]).filter(function(a){
        var c = (D.customers||[]).find(function(x){ return x.id === a.customer_id; });
        return c && c.wellness_center_id === center.id && a.status === 'present' && (a.date||'').startsWith(thisMonth);
      }).length;
      var custs = (D.customers||[]).filter(function(c){ return c.wellness_center_id === center.id; }).length;
      centerLabels.push(center.name || 'Center '+(i+1));
      revData.push(rev);
      attData.push(att);
      tableRows.push({ name: center.name||'Center '+(i+1), rev: rev, att: att, custs: custs, color: colors[i % colors.length] });
    });
    destroyChart('center-revenue'); destroyChart('center-attendance');
    var crEl = document.getElementById('chart-center-revenue');
    var caEl = document.getElementById('chart-center-attendance');
    if (crEl) _charts['center-revenue'] = new Chart(crEl, {
      type: 'bar',
      data: { labels: centerLabels, datasets: [{ label: 'Revenue (₹)', data: revData, backgroundColor: colors.slice(0, centerLabels.length), borderRadius: 6 }] },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { callback: function(v){ return '₹'+v.toLocaleString('en-IN'); } } } } }
    });
    if (caEl) _charts['center-attendance'] = new Chart(caEl, {
      type: 'bar',
      data: { labels: centerLabels, datasets: [{ label: 'Check-ins', data: attData, backgroundColor: colors.slice(0, centerLabels.length), borderRadius: 6 }] },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
    var tbl = document.getElementById('analytics-center-table');
    if (tbl) tbl.innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:12px">'
      + '<thead><tr style="border-bottom:2px solid var(--border)">'
      + '<th style="text-align:left;padding:6px 8px;color:var(--muted)">Center</th>'
      + '<th style="text-align:right;padding:6px 8px;color:var(--muted)">Customers</th>'
      + '<th style="text-align:right;padding:6px 8px;color:var(--muted)">Attendance</th>'
      + '<th style="text-align:right;padding:6px 8px;color:var(--muted)">Revenue</th>'
      + '</tr></thead><tbody>'
      + tableRows.sort(function(a,b){ return b.rev - a.rev; }).map(function(r){
        return '<tr style="border-bottom:1px solid var(--border)">'
          + '<td style="padding:7px 8px;display:flex;align-items:center;gap:6px"><span style="width:10px;height:10px;border-radius:50%;background:'+r.color+';display:inline-block"></span>'+r.name+'</td>'
          + '<td style="text-align:right;padding:7px 8px">'+r.custs+'</td>'
          + '<td style="text-align:right;padding:7px 8px">'+r.att+'</td>'
          + '<td style="text-align:right;padding:7px 8px;font-weight:700;color:var(--success)">₹'+r.rev.toLocaleString('en-IN')+'</td>'
          + '</tr>';
      }).join('')
      + '</tbody></table>';
  })();

  // ── Conversion Funnel ──
  (function() {
    var el = document.getElementById('analytics-funnel'); if (!el) return;

    var allLeads   = ACTIVE_CENTER ? (D.leads||[]).filter(function(l){ return l.center_id === ACTIVE_CENTER; }) : (D.leads||[]);
    var allCusts   = ACTIVE_CENTER ? D.customers.filter(function(c){ return c.wellness_center_id === ACTIVE_CENTER; }) : D.customers;
    var allHistory = D.packHistory || [];

    // Stage counts
    var s1_leads       = allLeads.length;
    var s2_contacted   = allLeads.filter(function(l){ return l.status !== 'New'; }).length;
    var s3_interested  = allLeads.filter(function(l){ return l.status === 'Interested' || l.status === 'Joined'; }).length;
    var s4_joined      = allLeads.filter(function(l){ return l.status === 'Joined'; }).length
                       + allCusts.filter(function(c){ return !allLeads.some(function(l){ return l.status==='Joined' && l.name===c.name; }); }).length;
    var s5_trial       = allCusts.filter(function(c){ return (c.pack_type||'').toLowerCase().includes('trial'); }).length;
    var s6_fullpack    = allCusts.filter(function(c){ return !(c.pack_type||'').toLowerCase().includes('trial'); }).length;
    var s7_renewed     = allCusts.filter(function(c){ return allHistory.some(function(h){ return h.customer_name === c.name; }); }).length;

    var stages = [
      { label: 'Total Leads',    icon: '📋', count: s1_leads,    desc: 'All leads captured' },
      { label: 'Contacted',      icon: '📞', count: s2_contacted, desc: 'Leads followed up' },
      { label: 'Interested',     icon: '💡', count: s3_interested,desc: 'Expressed interest' },
      { label: 'Joined',         icon: '🚪', count: s4_joined,   desc: 'Became customers' },
      { label: 'Trial Pack',     icon: '🧪', count: s5_trial,    desc: 'Started on trial' },
      { label: 'Full Pack',      icon: '💪', count: s6_fullpack, desc: 'Upgraded / direct join' },
      { label: 'Renewed',        icon: '🔄', count: s7_renewed,  desc: 'Renewed at least once' }
    ].filter(function(s){ return s.count > 0; });

    if (stages.length < 2) {
      el.innerHTML = '<div style="color:var(--muted);font-size:13px">Not enough data. Add leads and customers to see the conversion funnel.</div>';
      return;
    }

    var top = stages[0].count;

    // Overall conversion rate (first to last stage)
    var overallRate = top > 0 ? Math.round((stages[stages.length-1].count / top) * 100) : 0;

    // Summary
    var html = '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:18px">'
      + '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px 16px;flex:1;min-width:130px">'
        + '<div style="font-size:11px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:.4px">Overall Conversion</div>'
        + '<div style="font-size:26px;font-weight:700;color:#16a34a;margin:4px 0">' + overallRate + '%</div>'
        + '<div style="font-size:11px;color:var(--muted)">' + stages[stages.length-1].label + ' / ' + stages[0].label + '</div>'
      + '</div>'
      + '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:12px 16px;flex:1;min-width:130px">'
        + '<div style="font-size:11px;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:.4px">Lead → Customer</div>'
        + '<div style="font-size:26px;font-weight:700;color:#2563eb;margin:4px 0">'
          + (s1_leads > 0 ? Math.round((s4_joined / s1_leads) * 100) : 0) + '%</div>'
        + '<div style="font-size:11px;color:var(--muted)">' + s4_joined + ' of ' + s1_leads + ' leads converted</div>'
      + '</div>'
      + '<div style="background:#fdf4ff;border:1px solid #e9d5ff;border-radius:10px;padding:12px 16px;flex:1;min-width:130px">'
        + '<div style="font-size:11px;font-weight:700;color:#6b21a8;text-transform:uppercase;letter-spacing:.4px">Renewal Rate</div>'
        + '<div style="font-size:26px;font-weight:700;color:#7c3aed;margin:4px 0">'
          + (s6_fullpack > 0 ? Math.round((s7_renewed / s6_fullpack) * 100) : 0) + '%</div>'
        + '<div style="font-size:11px;color:var(--muted)">' + s7_renewed + ' of ' + s6_fullpack + ' full-pack customers</div>'
      + '</div>'
    + '</div>';

    // Funnel bars
    html += '<div style="display:flex;flex-direction:column;gap:8px">';
    stages.forEach(function(s, i) {
      var pctOfTop   = top > 0 ? Math.round((s.count / top) * 100) : 0;
      var dropOff    = i > 0 ? stages[i-1].count - s.count : 0;
      var dropPct    = i > 0 && stages[i-1].count > 0 ? Math.round((dropOff / stages[i-1].count) * 100) : 0;
      var barColor   = pctOfTop >= 70 ? '#16a34a' : pctOfTop >= 40 ? '#f59e0b' : '#e74c3c';
      var barWidth   = Math.max(pctOfTop, 8);

      html += '<div>'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">'
          + '<span style="font-size:13px;font-weight:600">' + s.icon + ' ' + s.label + '</span>'
          + '<div style="display:flex;align-items:center;gap:10px">'
            + (i > 0 && dropOff > 0 ? '<span style="font-size:11px;color:#e74c3c">−' + dropOff + ' (' + dropPct + '% drop)</span>' : '')
            + '<span style="font-size:13px;font-weight:700">' + s.count + '</span>'
          + '</div>'
        + '</div>'
        + '<div style="background:#e2e8f0;border-radius:6px;height:28px;overflow:hidden;position:relative">'
          + '<div style="background:' + barColor + ';height:100%;width:' + barWidth + '%;border-radius:6px;display:flex;align-items:center;padding-left:10px;transition:width .4s">'
            + '<span style="color:#fff;font-size:11px;font-weight:700;white-space:nowrap">' + pctOfTop + '% of leads</span>'
          + '</div>'
        + '</div>'
        + '<div style="font-size:11px;color:var(--muted);margin-top:2px">' + s.desc + '</div>'
      + '</div>';
    });
    html += '</div>';

    // Drop-off table
    html += '<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin:16px 0 8px">Stage-by-Stage Drop-off</div>'
      + '<div class="twrap"><table><thead><tr><th>Stage</th><th>Count</th><th>% of Top</th><th>Drop from Previous</th><th>Stage Conv. Rate</th></tr></thead><tbody>';
    stages.forEach(function(s, i) {
      var pctOfTop  = top > 0 ? Math.round((s.count / top) * 100) : 0;
      var dropOff   = i > 0 ? stages[i-1].count - s.count : 0;
      var stageConv = i > 0 && stages[i-1].count > 0 ? Math.round((s.count / stages[i-1].count) * 100) : 100;
      html += '<tr>'
        + '<td>' + s.icon + ' <strong>' + s.label + '</strong></td>'
        + '<td style="text-align:center">' + s.count + '</td>'
        + '<td style="text-align:center;font-weight:700;color:' + (pctOfTop>=70?'#16a34a':pctOfTop>=40?'#f59e0b':'#e74c3c') + '">' + pctOfTop + '%</td>'
        + '<td style="text-align:center;color:' + (dropOff>0?'#e74c3c':'var(--muted)') + '">' + (i>0 ? '−'+dropOff : '—') + '</td>'
        + '<td style="text-align:center;font-weight:700;color:' + (stageConv>=70?'#16a34a':stageConv>=40?'#f59e0b':'#e74c3c') + '">' + (i>0 ? stageConv+'%' : '—') + '</td>'
        + '</tr>';
    });
    html += '</tbody></table></div>'
      + '<div style="font-size:10px;color:var(--muted);margin-top:8px">Stage conversion rate = count at this stage / count at previous stage. Respects active center filter.</div>';

    el.innerHTML = html;
  })();

  // ── Monthly Renewal Rate ──
  (function() {
    var el = document.getElementById('analytics-renewal-rate'); if (!el) return;
    // Last 9 months
    var rrMonths = [];
    for (var i = 8; i >= 0; i--) {
      var d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
      rrMonths.push(d.toISOString().slice(0,7));
    }
    var custs = ACTIVE_CENTER ? filterByCenter(D.customers) : D.customers;
    var renewedIds = new Set((D.packHistory||[]).map(function(p){ return p.customer_id; }));
    var rows = rrMonths.map(function(ym) {
      // Customers whose pack expired in this month
      var expired = custs.filter(function(c){ return (c.pack_end_date||'').slice(0,7) === ym; });
      var renewed = expired.filter(function(c){ return renewedIds.has(c.id); }).length;
      var rate = expired.length > 0 ? Math.round(renewed / expired.length * 100) : null;
      return { ym: ym, expired: expired.length, renewed: renewed, rate: rate };
    }).filter(function(r){ return r.expired > 0; });

    if (!rows.length) {
      el.innerHTML = '<div class="empty"><div class="ei">🔄</div><p>No pack expiry data yet.</p></div>';
      return;
    }

    var labels = rows.map(function(r){ var d=new Date(r.ym+'-01'); return d.toLocaleString('en-IN',{month:'short',year:'2-digit'}); });
    var rates  = rows.map(function(r){ return r.rate; });

    // Chart
    var cid = 'renewal-rate-chart';
    el.innerHTML = '<canvas id="'+cid+'" height="120" style="margin-bottom:14px"></canvas><div id="renewal-rate-table"></div>';
    destroyChart(cid);
    var canvas = document.getElementById(cid);
    if (canvas) {
      _charts[cid] = new Chart(canvas, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Renewal Rate %',
            data: rates,
            borderColor: '#16a34a',
            backgroundColor: 'rgba(22,163,74,0.12)',
            fill: true,
            tension: 0.4,
            pointRadius: 5,
            pointBackgroundColor: rates.map(function(r){ return r>=70?'#16a34a':r>=40?'#d97706':'#e74c3c'; }),
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            y: { min: 0, max: 100, ticks: { callback: function(v){ return v+'%'; }, font: { size: 11 } } },
            x: { ticks: { font: { size: 11 } } }
          }
        }
      });
    }

    // Table
    var tbl = document.getElementById('renewal-rate-table');
    if (tbl) {
      tbl.innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:12px">'
        + '<thead><tr style="border-bottom:2px solid var(--border)">'
        + '<th style="text-align:left;padding:5px 8px;color:var(--muted)">Month</th>'
        + '<th style="text-align:center;padding:5px 8px;color:var(--muted)">Expired</th>'
        + '<th style="text-align:center;padding:5px 8px;color:var(--muted)">Renewed</th>'
        + '<th style="text-align:center;padding:5px 8px;color:var(--muted)">Churned</th>'
        + '<th style="text-align:center;padding:5px 8px;color:var(--muted)">Rate</th>'
        + '</tr></thead><tbody>'
        + rows.map(function(r) {
            var rateColor = r.rate >= 70 ? '#16a34a' : r.rate >= 40 ? '#d97706' : '#e74c3c';
            var barW = r.rate || 0;
            return '<tr style="border-bottom:1px solid var(--border)">'
              + '<td style="padding:6px 8px;font-weight:600">'+new Date(r.ym+'-01').toLocaleString('en-IN',{month:'long',year:'numeric'})+'</td>'
              + '<td style="text-align:center;padding:6px 8px">'+r.expired+'</td>'
              + '<td style="text-align:center;padding:6px 8px;color:#16a34a;font-weight:600">'+r.renewed+'</td>'
              + '<td style="text-align:center;padding:6px 8px;color:#e74c3c">'+( r.expired - r.renewed )+'</td>'
              + '<td style="text-align:center;padding:6px 8px">'
              +   '<div style="display:flex;align-items:center;gap:6px;justify-content:center">'
              +     '<div style="background:var(--border);border-radius:4px;height:6px;width:60px"><div style="background:'+rateColor+';height:6px;border-radius:4px;width:'+barW+'%"></div></div>'
              +     '<span style="font-weight:700;color:'+rateColor+'">'+( r.rate !== null ? r.rate+'%' : '—' )+'</span>'
              +   '</div>'
              + '</td>'
              + '</tr>';
          }).join('')
        + '</tbody></table>'
        + '<div style="font-size:10px;color:var(--muted);margin-top:8px">🟢 ≥70% good &nbsp; 🟡 40–69% watch &nbsp; 🔴 &lt;40% churn risk. Renewal detected via pack_history records.</div>';
    }
  })();

  // ── Correlation: Attendance vs Weight/Fat Change ──
  (function() {
    var el = document.getElementById('analytics-correlation'); if (!el) return;

    // Build dataset: customers with both attendance + at least 2 body records
    var points = [];
    filtCusts.forEach(function(c) {
      var bodyRecs = (D.body || [])
        .filter(function(b) { return b.customer_id === c.id && b.weight; })
        .sort(function(a, b) { return new Date(a.date) - new Date(b.date); });
      if (bodyRecs.length < 2) return;

      var first = bodyRecs[0], last = bodyRecs[bodyRecs.length - 1];
      var weightChange = parseFloat(last.weight) - parseFloat(first.weight);
      var fatChange = (first.fat_percentage && last.fat_percentage)
        ? parseFloat(last.fat_percentage) - parseFloat(first.fat_percentage) : null;

      // Visits per week over pack duration
      var custAtt = D.attendance.filter(function(a) { return a.customer_id === c.id && a.status === 'present'; });
      var packDays = parsePack(c.pack_type) || 30;
      var visitsPerWeek = parseFloat((custAtt.length / packDays * 7).toFixed(2));

      points.push({ name: c.name, visitsPerWeek: visitsPerWeek, weightChange: weightChange, fatChange: fatChange, goal: c.goal || '' });
    });

    if (points.length < 3) {
      el.innerHTML = '<div style="color:var(--muted);font-size:13px">Need at least 3 customers with 2+ body scans each to show correlation. Keep logging body records!</div>';
      return;
    }

    // Pearson correlation coefficient
    function pearson(xs, ys) {
      var n = xs.length;
      if (n < 2) return 0;
      var mx = xs.reduce(function(s,v){return s+v;},0)/n;
      var my = ys.reduce(function(s,v){return s+v;},0)/n;
      var num = 0, dx2 = 0, dy2 = 0;
      for (var i = 0; i < n; i++) {
        var dx = xs[i]-mx, dy = ys[i]-my;
        num += dx*dy; dx2 += dx*dx; dy2 += dy*dy;
      }
      var denom = Math.sqrt(dx2*dy2);
      return denom === 0 ? 0 : parseFloat((num/denom).toFixed(3));
    }

    var wXs = points.map(function(p){return p.visitsPerWeek;});
    var wYs = points.map(function(p){return p.weightChange;});
    var rWeight = pearson(wXs, wYs);

    var fatPoints = points.filter(function(p){return p.fatChange !== null;});
    var rFat = fatPoints.length >= 3
      ? pearson(fatPoints.map(function(p){return p.visitsPerWeek;}), fatPoints.map(function(p){return p.fatChange;}))
      : null;

    function rLabel(r) {
      var abs = Math.abs(r);
      var dir = r < 0 ? 'negative' : 'positive';
      var strength = abs >= 0.7 ? 'Strong' : abs >= 0.4 ? 'Moderate' : abs >= 0.2 ? 'Weak' : 'Very weak';
      return strength + ' ' + dir;
    }
    function rColor(r) {
      var abs = Math.abs(r);
      // For weight: negative r is good (more visits → less weight for weight-loss)
      // For fat: negative r is good too
      var good = r < 0;
      return abs < 0.2 ? '#94a3b8' : good ? '#16a34a' : '#e74c3c';
    }
    function rInterp(r, metric) {
      var abs = Math.abs(r);
      if (abs < 0.2) return 'No meaningful relationship found between attendance and ' + metric + '.';
      var dir = r < 0 ? 'more visits correlate with ' + (metric==='weight change'?'weight loss':'fat reduction')
                      : 'more visits correlate with ' + (metric==='weight change'?'weight gain':'fat increase');
      var strength = abs >= 0.7 ? 'strongly' : abs >= 0.4 ? 'moderately' : 'weakly';
      return 'Customers who attend more often ' + strength + ' tend to see better results — ' + dir + '.';
    }

    // Attendance buckets
    var buckets = [
      { label: '< 2/wk',  min: 0,   max: 2   },
      { label: '2–3/wk',  min: 2,   max: 3   },
      { label: '3–4/wk',  min: 3,   max: 4   },
      { label: '4+/wk',   min: 4,   max: 999 }
    ];
    var bucketData = buckets.map(function(b) {
      var members = points.filter(function(p) { return p.visitsPerWeek >= b.min && p.visitsPerWeek < b.max; });
      var avgW = members.length ? (members.reduce(function(s,p){return s+p.weightChange;},0)/members.length).toFixed(1) : null;
      var fatM = members.filter(function(p){return p.fatChange!==null;});
      var avgF = fatM.length ? (fatM.reduce(function(s,p){return s+p.fatChange;},0)/fatM.length).toFixed(1) : null;
      return { label: b.label, count: members.length, avgWeight: avgW, avgFat: avgF };
    }).filter(function(b) { return b.count > 0; });

    // Render
    var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px">';
    // Weight correlation card
    html += '<div style="background:var(--surface2);border-radius:10px;padding:14px 16px">'
      + '<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">Visits/Week vs Weight Change</div>'
      + '<div style="font-size:28px;font-weight:700;color:' + rColor(rWeight) + '">r = ' + rWeight + '</div>'
      + '<div style="font-size:12px;font-weight:600;color:' + rColor(rWeight) + ';margin:2px 0">' + rLabel(rWeight) + ' correlation</div>'
      + '<div style="font-size:12px;color:var(--muted);margin-top:6px;line-height:1.5">' + rInterp(rWeight, 'weight change') + '</div>'
      + '<div style="font-size:10px;color:var(--muted);margin-top:6px">Based on ' + points.length + ' customers with 2+ body scans</div>'
    + '</div>';
    // Fat correlation card
    if (rFat !== null) {
      html += '<div style="background:var(--surface2);border-radius:10px;padding:14px 16px">'
        + '<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">Visits/Week vs Body Fat % Change</div>'
        + '<div style="font-size:28px;font-weight:700;color:' + rColor(rFat) + '">r = ' + rFat + '</div>'
        + '<div style="font-size:12px;font-weight:600;color:' + rColor(rFat) + ';margin:2px 0">' + rLabel(rFat) + ' correlation</div>'
        + '<div style="font-size:12px;color:var(--muted);margin-top:6px;line-height:1.5">' + rInterp(rFat, 'fat % change') + '</div>'
        + '<div style="font-size:10px;color:var(--muted);margin-top:6px">Based on ' + fatPoints.length + ' customers</div>'
      + '</div>';
    }
    html += '</div>';

    // Bucket comparison table
    html += '<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">Results by Attendance Frequency</div>'
      + '<div class="twrap"><table><thead><tr><th>Frequency</th><th>Customers</th><th>Avg Weight Change</th><th>Avg Fat % Change</th><th>Verdict</th></tr></thead><tbody>';
    bucketData.forEach(function(b) {
      var wVal = b.avgWeight !== null ? parseFloat(b.avgWeight) : null;
      var fVal = b.avgFat !== null ? parseFloat(b.avgFat) : null;
      var wColor = wVal === null ? 'var(--muted)' : wVal < 0 ? '#16a34a' : wVal > 0 ? '#e74c3c' : 'var(--muted)';
      var fColor = fVal === null ? 'var(--muted)' : fVal < 0 ? '#16a34a' : fVal > 0 ? '#e74c3c' : 'var(--muted)';
      var verdict = wVal === null ? '—'
        : wVal < -1 ? '✅ Excellent loss' : wVal < 0 ? '✅ Losing weight' : wVal < 0.5 ? '➡️ Maintaining' : '⚠️ Gaining';
      html += '<tr>'
        + '<td><strong>' + b.label + '</strong></td>'
        + '<td style="text-align:center">' + b.count + '</td>'
        + '<td style="font-weight:700;color:' + wColor + '">' + (wVal !== null ? (wVal > 0 ? '+' : '') + wVal + ' kg' : '—') + '</td>'
        + '<td style="font-weight:700;color:' + fColor + '">' + (fVal !== null ? (fVal > 0 ? '+' : '') + fVal + '%' : '—') + '</td>'
        + '<td>' + verdict + '</td>'
        + '</tr>';
    });
    html += '</tbody></table></div>'
      + '<div style="font-size:10px;color:var(--muted);margin-top:8px">'
      + 'r = Pearson correlation coefficient. Range: −1 (perfect negative) to +1 (perfect positive). '
      + 'For weight loss goals, r &lt; 0 means more attendance = more weight lost (good). '
      + 'Results are only meaningful with sufficient data points.</div>';

    el.innerHTML = html;
  })();

  // ── Pareto Analysis (80/20 Rule) ──
  (function() {
    var el = document.getElementById('analytics-pareto'); if (!el) return;

    // Revenue per customer = pack_price + all renewals (same as CLV)
    var custRevenue = filtCusts.map(function(c) {
      var renewalTotal = (D.packHistory || [])
        .filter(function(p) { return p.customer_name === c.name; })
        .reduce(function(s, p) { return s + (Number(p.price) || 0); }, 0);
      var rev = (Number(c.pack_price) || 0) + renewalTotal;
      return { name: c.name, revenue: rev, packType: c.pack_type || '—' };
    }).filter(function(d) { return d.revenue > 0; })
      .sort(function(a, b) { return b.revenue - a.revenue; });

    if (!custRevenue.length) {
      el.innerHTML = '<div style="color:var(--muted);font-size:13px">No revenue data. Add pack prices to customers to enable Pareto analysis.</div>';
      return;
    }

    var grandTotal = custRevenue.reduce(function(s, d) { return s + d.revenue; }, 0);

    // Build cumulative %
    var cumulative = 0;
    var paretoData = custRevenue.map(function(d, i) {
      cumulative += d.revenue;
      var cumPct = Math.round((cumulative / grandTotal) * 100);
      var custPct = Math.round(((i + 1) / custRevenue.length) * 100);
      return Object.assign({}, d, { cumRevPct: cumPct, custPct: custPct, rank: i + 1 });
    });

    // Find 80% threshold
    var eightyIdx = paretoData.findIndex(function(d) { return d.cumRevPct >= 80; });
    var eightyCount = eightyIdx + 1;
    var eightyPct = Math.round((eightyCount / custRevenue.length) * 100);

    // Summary insight
    var html = '<div style="background:linear-gradient(135deg,#052e16,#166534);color:#fff;border-radius:12px;padding:16px 20px;margin-bottom:16px">'
      + '<div style="font-size:13px;opacity:.7;margin-bottom:4px">Key Insight</div>'
      + '<div style="font-size:18px;font-weight:700">'
        + 'Top <span style="color:#4ade80">' + eightyCount + ' customers</span> '
        + '(<span style="color:#4ade80">' + eightyPct + '%</span> of total) '
        + 'generate <span style="color:#4ade80">80%</span> of revenue'
      + '</div>'
      + '<div style="font-size:12px;opacity:.65;margin-top:6px">'
        + 'Total: ₹' + grandTotal.toLocaleString('en-IN') + ' across ' + custRevenue.length + ' customers'
      + '</div>'
    + '</div>';

    // Visual cumulative bar
    html += '<div style="margin-bottom:16px">'
      + '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:4px"><span>Cumulative Revenue %</span><span>80% threshold</span></div>'
      + '<div style="position:relative;background:#e2e8f0;border-radius:6px;height:12px;overflow:visible">';
    paretoData.forEach(function(d) {
      var widthPct = (1 / custRevenue.length) * 100;
      var color = d.rank <= eightyCount ? '#16a34a' : '#94a3b8';
      html += '<div style="position:absolute;left:' + ((d.rank-1)/custRevenue.length*100) + '%;width:' + widthPct + '%;height:100%;background:' + color + ';border-right:1px solid #fff" title="' + d.name + ': ₹' + d.revenue.toLocaleString('en-IN') + '"></div>';
    });
    // 80% line
    html += '<div style="position:absolute;left:' + eightyPct + '%;top:-4px;bottom:-4px;width:2px;background:#e74c3c;z-index:2"></div>';
    html += '</div>'
      + '<div style="display:flex;gap:12px;margin-top:6px;font-size:11px">'
        + '<span style="display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:12px;height:8px;background:#16a34a;border-radius:2px"></span> Top ' + eightyCount + ' (80% revenue)</span>'
        + '<span style="display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:12px;height:8px;background:#94a3b8;border-radius:2px"></span> Remaining ' + (custRevenue.length - eightyCount) + '</span>'
        + '<span style="display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:2px;height:12px;background:#e74c3c"></span> 80% threshold</span>'
      + '</div>'
    + '</div>';

    // Table — top customers with cumulative %
    html += '<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">Revenue Ranking</div>'
      + '<div class="twrap"><table><thead><tr><th>#</th><th>Customer</th><th>Pack</th><th>Revenue</th><th>% of Total</th><th>Cumulative %</th></tr></thead><tbody>';

    paretoData.forEach(function(d) {
      var revPct = ((d.revenue / grandTotal) * 100).toFixed(1);
      var isThreshold = d.rank === eightyCount;
      var isTop = d.rank <= eightyCount;
      html += '<tr style="' + (isThreshold ? 'border-bottom:2px solid #e74c3c;' : '') + '">'
        + '<td style="font-weight:700;color:' + (isTop ? '#16a34a' : 'var(--muted)') + '">' + d.rank + '</td>'
        + '<td><strong>' + d.name + '</strong>' + (isTop ? ' <span style="background:#d1fae5;color:#065f46;border-radius:8px;padding:1px 6px;font-size:10px">Top 80%</span>' : '') + '</td>'
        + '<td style="font-size:12px;color:var(--muted)">' + d.packType + '</td>'
        + '<td style="font-weight:700">₹' + d.revenue.toLocaleString('en-IN') + '</td>'
        + '<td style="text-align:center">' + revPct + '%</td>'
        + '<td><div style="display:flex;align-items:center;gap:6px">'
          + '<div style="flex:1;background:#e2e8f0;border-radius:4px;height:6px"><div style="background:' + (isTop ? '#16a34a' : '#94a3b8') + ';height:100%;width:' + d.cumRevPct + '%"></div></div>'
          + '<span style="font-size:12px;font-weight:700;min-width:32px">' + d.cumRevPct + '%</span>'
        + '</div></td>'
        + '</tr>';
    });

    html += '</tbody></table></div>'
      + '<div style="font-size:10px;color:var(--muted);margin-top:8px">Revenue = pack price + all renewals. Red line marks the 80% revenue threshold.</div>';

    el.innerHTML = html;
  })();

  // ── ARPU (Average Revenue Per User) ──
  (function() {
    var el = document.getElementById('analytics-arpu'); if (!el) return;

    // Monthly ARPU: income that month / unique customers who attended that month
    var arpuRows = [];
    for (var i = numMonths - 1; i >= 0; i--) {
      var d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
      var ym = d.toISOString().substring(0, 7);
      var label = d.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
      var mIncome = (ACTIVE_CENTER ? filterFinanceByCenter(D.finance) : D.finance)
        .filter(function(f) { return f.type === 'income' && f.date && f.date.startsWith(ym); })
        .reduce(function(s, f) { return s + Number(f.amount); }, 0);
      // Active users that month = unique customers with at least 1 present attendance
      var activeIds = {};
      D.attendance.filter(function(a) {
        return a.status === 'present' && a.date && a.date.startsWith(ym) && filtIds.indexOf(a.customer_id) > -1;
      }).forEach(function(a) { activeIds[a.customer_id] = true; });
      var activeCount = Object.keys(activeIds).length;
      var arpu = activeCount > 0 ? Math.round(mIncome / activeCount) : null;
      arpuRows.push({ label: label, ym: ym, income: mIncome, activeCount: activeCount, arpu: arpu });
    }

    var validRows = arpuRows.filter(function(r) { return r.arpu !== null; });
    if (!validRows.length) {
      el.innerHTML = '<div style="color:var(--muted);font-size:13px">No data available for ARPU calculation.</div>';
      return;
    }

    var overallIncome = validRows.reduce(function(s, r) { return s + r.income; }, 0);
    var totalActiveSlots = validRows.reduce(function(s, r) { return s + r.activeCount; }, 0);
    var overallARPU = totalActiveSlots > 0 ? Math.round(overallIncome / (totalActiveSlots / validRows.length)) : 0;
    var maxARPU = validRows.reduce(function(mx, r) { return r.arpu > mx.arpu ? r : mx; }, validRows[0]);
    var minARPU = validRows.reduce(function(mn, r) { return r.arpu < mn.arpu ? r : mn; }, validRows[0]);
    var trend = validRows.length >= 2
      ? validRows[validRows.length - 1].arpu - validRows[0].arpu
      : 0;

    // ARPU by pack type
    var byPack = {};
    filtCusts.forEach(function(c) {
      var pt = c.pack_type || 'Unknown';
      var custIncome = (ACTIVE_CENTER ? filterFinanceByCenter(D.finance) : D.finance)
        .filter(function(f) { return f.type === 'income' && (f.description || '').toLowerCase().includes(c.name.toLowerCase()); })
        .reduce(function(s, f) { return s + Number(f.amount); }, 0);
      if (!byPack[pt]) byPack[pt] = { income: 0, count: 0 };
      byPack[pt].income += custIncome;
      byPack[pt].count++;
    });

    // Summary row
    var html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:18px">'
      + '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px 16px">'
        + '<div style="font-size:11px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:.4px">Overall ARPU</div>'
        + '<div style="font-size:24px;font-weight:700;color:#16a34a;margin:4px 0">₹' + overallARPU.toLocaleString('en-IN') + '</div>'
        + '<div style="font-size:11px;color:var(--muted)">avg per active user/month</div>'
      + '</div>'
      + '<div style="background:' + (trend >= 0 ? '#f0fdf4' : '#fef2f2') + ';border:1px solid ' + (trend >= 0 ? '#bbf7d0' : '#fecaca') + ';border-radius:10px;padding:12px 16px">'
        + '<div style="font-size:11px;font-weight:700;color:' + (trend >= 0 ? '#166534' : '#991b1b') + ';text-transform:uppercase;letter-spacing:.4px">Period Trend</div>'
        + '<div style="font-size:24px;font-weight:700;color:' + (trend >= 0 ? '#16a34a' : '#e74c3c') + ';margin:4px 0">' + (trend >= 0 ? '▲' : '▼') + ' ₹' + Math.abs(trend).toLocaleString('en-IN') + '</div>'
        + '<div style="font-size:11px;color:var(--muted)">first vs last month in period</div>'
      + '</div>'
      + '<div style="background:#fdf4ff;border:1px solid #e9d5ff;border-radius:10px;padding:12px 16px">'
        + '<div style="font-size:11px;font-weight:700;color:#6b21a8;text-transform:uppercase;letter-spacing:.4px">Best Month</div>'
        + '<div style="font-size:18px;font-weight:700;color:#7c3aed;margin:4px 0">₹' + maxARPU.arpu.toLocaleString('en-IN') + '</div>'
        + '<div style="font-size:11px;color:var(--muted)">' + maxARPU.label + '</div>'
      + '</div>'
      + '<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:12px 16px">'
        + '<div style="font-size:11px;font-weight:700;color:#c2410c;text-transform:uppercase;letter-spacing:.4px">Lowest Month</div>'
        + '<div style="font-size:18px;font-weight:700;color:#ea580c;margin:4px 0">₹' + minARPU.arpu.toLocaleString('en-IN') + '</div>'
        + '<div style="font-size:11px;color:var(--muted)">' + minARPU.label + '</div>'
      + '</div>'
    + '</div>';

    // Monthly ARPU table with mini bar
    var maxArpuVal = Math.max.apply(null, validRows.map(function(r) { return r.arpu; }));
    html += '<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">Monthly Breakdown</div>'
      + '<div class="twrap"><table><thead><tr><th>Month</th><th>Income</th><th>Active Users</th><th>ARPU</th><th style="min-width:120px">Trend</th></tr></thead><tbody>';
    arpuRows.forEach(function(r) {
      var pct = maxArpuVal > 0 && r.arpu ? Math.round((r.arpu / maxArpuVal) * 100) : 0;
      var now = new Date().toISOString().substring(0, 7);
      var isCurrent = r.ym === now;
      html += '<tr' + (isCurrent ? ' style="font-weight:700"' : '') + '>'
        + '<td>' + r.label + (isCurrent ? ' <span style="background:#dbeafe;color:#1e40af;border-radius:8px;padding:1px 6px;font-size:10px">current</span>' : '') + '</td>'
        + '<td>₹' + r.income.toLocaleString('en-IN') + '</td>'
        + '<td style="text-align:center">' + r.activeCount + '</td>'
        + '<td style="font-weight:700;color:' + (r.arpu ? '#16a34a' : 'var(--muted)') + '">' + (r.arpu ? '₹' + r.arpu.toLocaleString('en-IN') : '—') + '</td>'
        + '<td><div style="background:#e2e8f0;border-radius:4px;height:8px;overflow:hidden"><div style="background:#16a34a;height:100%;width:' + pct + '%"></div></div></td>'
        + '</tr>';
    });
    html += '</tbody></table></div>';

    // ARPU by pack type
    var packKeys = Object.keys(byPack).filter(function(k) { return byPack[k].count > 0; });
    if (packKeys.length > 1) {
      html += '<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin:14px 0 8px">ARPU by Pack Type</div>'
        + '<div style="display:flex;gap:10px;flex-wrap:wrap">';
      packKeys.forEach(function(pt) {
        var avgA = byPack[pt].count > 0 ? Math.round(byPack[pt].income / byPack[pt].count) : 0;
        html += '<div style="background:var(--surface2);border-radius:8px;padding:8px 14px;font-size:12px">'
          + '<span style="font-weight:700">' + pt + '</span>'
          + ' &nbsp;·&nbsp; ₹' + avgA.toLocaleString('en-IN') + ' avg'
          + ' <span style="color:var(--muted)">(' + byPack[pt].count + ')</span></div>';
      });
      html += '</div>';
    }

    html += '<div style="font-size:10px;color:var(--muted);margin-top:10px">Active Users = customers with ≥1 attendance that month. Income from finance records in the selected period.</div>';
    el.innerHTML = html;
  })();

  // ── Customer Lifetime Value (CLV) ──
  (function() {
    var el = document.getElementById('analytics-clv'); if (!el) return;

    // CLV per customer = current pack_price + all historical renewal prices
    var clvData = filtCusts.map(function(c) {
      var renewalTotal = (D.packHistory || [])
        .filter(function(p) { return p.customer_name === c.name; })
        .reduce(function(s, p) { return s + (Number(p.price) || 0); }, 0);
      var clv = (Number(c.pack_price) || 0) + renewalTotal;
      var renewalCount = (D.packHistory || []).filter(function(p) { return p.customer_name === c.name; }).length;
      // Tenure in months since pack_start_date
      var startDate = c.pack_start_date ? new Date(c.pack_start_date) : null;
      var tenureMonths = startDate ? Math.max(1, Math.round((new Date() - startDate) / (30 * 86400000))) : 1;
      return { name: c.name, clv: clv, renewals: renewalCount, tenureMonths: tenureMonths, packType: c.pack_type || '—', goal: c.goal || '—' };
    }).filter(function(d) { return d.clv > 0; })
      .sort(function(a, b) { return b.clv - a.clv; });

    if (!clvData.length) {
      el.innerHTML = '<div style="color:var(--muted);font-size:13px">No pack price data found. Add pack prices when creating customers to enable CLV.</div>';
      return;
    }

    var totalCLV    = clvData.reduce(function(s, d) { return s + d.clv; }, 0);
    var avgCLV      = Math.round(totalCLV / clvData.length);
    var maxCLV      = clvData[0];
    var avgTenure   = Math.round(clvData.reduce(function(s, d) { return s + d.tenureMonths; }, 0) / clvData.length);
    var avgMonthly  = avgTenure > 0 ? Math.round(avgCLV / avgTenure) : 0;

    // CLV by pack type
    var byPack = {};
    clvData.forEach(function(d) {
      if (!byPack[d.packType]) byPack[d.packType] = { total: 0, count: 0 };
      byPack[d.packType].total += d.clv;
      byPack[d.packType].count++;
    });

    // Summary cards
    var html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:18px">'
      + '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px 16px">'
        + '<div style="font-size:11px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:.4px">Avg CLV</div>'
        + '<div style="font-size:22px;font-weight:700;color:#16a34a;margin:4px 0">₹' + avgCLV.toLocaleString('en-IN') + '</div>'
        + '<div style="font-size:11px;color:var(--muted)">per customer</div>'
      + '</div>'
      + '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:12px 16px">'
        + '<div style="font-size:11px;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:.4px">Avg Monthly Spend</div>'
        + '<div style="font-size:22px;font-weight:700;color:#2563eb;margin:4px 0">₹' + avgMonthly.toLocaleString('en-IN') + '</div>'
        + '<div style="font-size:11px;color:var(--muted)">avg ' + avgTenure + ' months tenure</div>'
      + '</div>'
      + '<div style="background:#fdf4ff;border:1px solid #e9d5ff;border-radius:10px;padding:12px 16px">'
        + '<div style="font-size:11px;font-weight:700;color:#6b21a8;text-transform:uppercase;letter-spacing:.4px">Top Customer</div>'
        + '<div style="font-size:16px;font-weight:700;color:#7c3aed;margin:4px 0">' + maxCLV.name + '</div>'
        + '<div style="font-size:11px;color:var(--muted)">₹' + maxCLV.clv.toLocaleString('en-IN') + ' · ' + maxCLV.renewals + ' renewal' + (maxCLV.renewals !== 1 ? 's' : '') + '</div>'
      + '</div>'
      + '<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:12px 16px">'
        + '<div style="font-size:11px;font-weight:700;color:#c2410c;text-transform:uppercase;letter-spacing:.4px">Total Revenue (CLV)</div>'
        + '<div style="font-size:22px;font-weight:700;color:#ea580c;margin:4px 0">₹' + totalCLV.toLocaleString('en-IN') + '</div>'
        + '<div style="font-size:11px;color:var(--muted)">' + clvData.length + ' customers</div>'
      + '</div>'
    + '</div>';

    // CLV by pack type
    html += '<div style="margin-bottom:16px"><div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">Avg CLV by Pack Type</div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap">';
    Object.keys(byPack).forEach(function(pt) {
      var avg = Math.round(byPack[pt].total / byPack[pt].count);
      html += '<div style="background:var(--surface2);border-radius:8px;padding:8px 14px;font-size:12px">'
        + '<span style="font-weight:700">'+pt+'</span>'
        + ' &nbsp;·&nbsp; Avg ₹' + avg.toLocaleString('en-IN')
        + ' <span style="color:var(--muted)">('+byPack[pt].count+' customers)</span></div>';
    });
    html += '</div></div>';

    // Top 10 table
    html += '<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">Top Customers by CLV</div>'
      + '<div class="twrap"><table><thead><tr><th>#</th><th>Customer</th><th>Pack Type</th><th>Renewals</th><th>Tenure</th><th>CLV</th><th>Avg/Month</th></tr></thead><tbody>';
    clvData.slice(0, 10).forEach(function(d, i) {
      var avgMo = Math.round(d.clv / d.tenureMonths);
      html += '<tr>'
        + '<td style="font-weight:700;color:var(--muted)">' + (i + 1) + '</td>'
        + '<td><strong>' + d.name + '</strong></td>'
        + '<td>' + d.packType + '</td>'
        + '<td style="text-align:center">' + d.renewals + '</td>'
        + '<td style="text-align:center">' + d.tenureMonths + ' mo</td>'
        + '<td style="font-weight:700;color:#16a34a">₹' + d.clv.toLocaleString('en-IN') + '</td>'
        + '<td style="color:var(--muted)">₹' + avgMo.toLocaleString('en-IN') + '</td>'
        + '</tr>';
    });
    html += '</tbody></table></div>'
      + '<div style="font-size:10px;color:var(--muted);margin-top:8px">CLV = Current pack price + all renewal prices. Only customers with a recorded pack price are included.</div>';

    el.innerHTML = html;
  })();

  // ── Cohort Retention Analysis ──
  (function() {
    var el = document.getElementById('analytics-cohort'); if (!el) return;

    // Group filtered customers by join month (pack_start_date)
    var cohortMap = {};
    filtCusts.forEach(function(c) {
      var start = c.pack_start_date || c.created_at;
      if (!start) return;
      var ym = start.substring(0, 7); // "2024-11"
      if (!cohortMap[ym]) cohortMap[ym] = [];
      cohortMap[ym].push(c);
    });

    var cohortMonths = Object.keys(cohortMap).sort();
    if (cohortMonths.length < 2) {
      el.innerHTML = '<div style="color:var(--muted);font-size:13px">Need at least 2 cohort months of data to show retention grid.</div>';
      return;
    }

    // Max months to track forward (cap at 6)
    var maxForward = Math.min(6, cohortMonths.length);

    // For a customer in cohort, did they have any attendance in a given month?
    function hadAttendanceInMonth(custId, ym) {
      return D.attendance.some(function(a) {
        return a.customer_id === custId && a.status === 'present' && a.date.substring(0, 7) === ym;
      });
    }

    // Add months helper
    function addMonths(ym, n) {
      var d = new Date(ym + '-01');
      d.setMonth(d.getMonth() + n);
      return d.toISOString().substring(0, 7);
    }

    // Build retention grid
    // cell[cohortIdx][monthOffset] = { retained, total }
    var grid = cohortMonths.map(function(ym) {
      var members = cohortMap[ym];
      var row = [];
      for (var offset = 0; offset < maxForward; offset++) {
        var checkYm = addMonths(ym, offset);
        var now = new Date().toISOString().substring(0, 7);
        if (checkYm > now) { row.push(null); continue; } // future month
        var retained = members.filter(function(c) {
          return hadAttendanceInMonth(c.id, checkYm);
        }).length;
        row.push({ retained: retained, total: members.length });
      }
      return { ym: ym, members: members.length, cells: row };
    });

    // Color based on retention %
    function retColor(pct) {
      if (pct === null) return { bg: '#f8fafc', text: 'var(--muted)' };
      if (pct >= 80) return { bg: '#d1fae5', text: '#065f46' };
      if (pct >= 60) return { bg: '#dcfce7', text: '#166534' };
      if (pct >= 40) return { bg: '#fef3c7', text: '#92400e' };
      if (pct >= 20) return { bg: '#fee2e2', text: '#991b1b' };
      return { bg: '#fecaca', text: '#7f1d1d' };
    }

    var html = '<div class="twrap"><table style="min-width:500px"><thead><tr>'
      + '<th>Cohort</th><th>Size</th>';
    for (var i = 0; i < maxForward; i++) {
      html += '<th style="text-align:center">Month ' + i + (i === 0 ? ' (joined)' : '') + '</th>';
    }
    html += '</tr></thead><tbody>';

    grid.forEach(function(row) {
      var label = new Date(row.ym + '-01').toLocaleString('en-IN', { month: 'short', year: '2-digit' });
      html += '<tr><td><strong>' + label + '</strong></td><td>' + row.members + '</td>';
      row.cells.forEach(function(cell, i) {
        if (cell === null) {
          html += '<td style="text-align:center;color:var(--muted);font-size:12px">—</td>';
        } else {
          var pct = cell.total > 0 ? Math.round((cell.retained / cell.total) * 100) : 0;
          var col = retColor(i === 0 ? 100 : pct);
          html += '<td style="text-align:center;background:' + col.bg + ';color:' + col.text + ';font-weight:700;border-radius:4px">'
            + (i === 0 ? '100%' : pct + '%')
            + '<div style="font-size:10px;font-weight:400;opacity:.8">' + (i === 0 ? row.members : cell.retained) + '/' + cell.total + '</div></td>';
        }
      });
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;font-size:11px">'
      + '<span style="background:#d1fae5;color:#065f46;padding:2px 8px;border-radius:10px">≥80% Excellent</span>'
      + '<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:10px">40–60% Fair</span>'
      + '<span style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:10px">&lt;40% Poor</span>'
      + '<span style="color:var(--muted)">— = future month not yet reached</span>'
      + '</div>';

    el.innerHTML = html;
  })();

  // ── RFM Analysis ──
  (function() {
    var rfmEl = document.getElementById('analytics-rfm'); if (!rfmEl) return;
    var today = new Date(); today.setHours(0,0,0,0);

    // Score each filtered customer
    var scored = filtCusts.map(function(c) {
      // Recency: days since last present attendance
      var custAtt = D.attendance.filter(function(a){ return a.customer_id === c.id && a.status === 'present'; });
      var lastDate = custAtt.length ? custAtt.reduce(function(mx,a){ return a.date > mx ? a.date : mx; }, '') : null;
      var recencyDays = lastDate ? Math.floor((today - new Date(lastDate)) / 86400000) : 999;

      // Frequency: visits per week over pack duration
      var packDays = parsePack(c.pack_type) || 30;
      var freqPerWeek = packDays > 0 ? (custAtt.length / packDays * 7) : 0;

      // Monetary: pack_price + sum of renewals from pack history
      var renewals = (D.packHistory||[]).filter(function(p){ return p.customer_name === c.name; });
      var monetary = (Number(c.pack_price)||0) + renewals.reduce(function(s,p){ return s + (Number(p.price)||0); }, 0);

      // R score 1-5 (5 = visited very recently)
      var rScore = recencyDays <= 7 ? 5 : recencyDays <= 14 ? 4 : recencyDays <= 30 ? 3 : recencyDays <= 60 ? 2 : 1;
      // F score 1-5 (5 = visits 5+ days/week)
      var fScore = freqPerWeek >= 5 ? 5 : freqPerWeek >= 4 ? 4 : freqPerWeek >= 3 ? 3 : freqPerWeek >= 2 ? 2 : 1;
      // M score 1-5 (relative to filtered set — assigned after all calculated)
      return { c:c, recencyDays:recencyDays, freqPerWeek:parseFloat(freqPerWeek.toFixed(1)), monetary:monetary, rScore:rScore, fScore:fScore };
    });

    // M score: quintile-based within filtered set
    var monVals = scored.map(function(s){ return s.monetary; }).sort(function(a,b){ return a-b; });
    var q1 = monVals[Math.floor(monVals.length*0.2)]||0;
    var q2 = monVals[Math.floor(monVals.length*0.4)]||0;
    var q3 = monVals[Math.floor(monVals.length*0.6)]||0;
    var q4 = monVals[Math.floor(monVals.length*0.8)]||0;
    scored.forEach(function(s) {
      s.mScore = s.monetary > q4 ? 5 : s.monetary > q3 ? 4 : s.monetary > q2 ? 3 : s.monetary > q1 ? 2 : 1;
    });

    // Segment assignment
    function segment(r, f, m) {
      var avg = (r + f + m) / 3;
      if (r >= 4 && f >= 4)                  return { label:'Champion',     emoji:'🏆', bg:'#d1fae5', c:'#065f46', desc:'Highly active, recent, and valuable' };
      if (r >= 3 && f >= 3 && m >= 3)        return { label:'Loyal',        emoji:'💚', bg:'#dcfce7', c:'#166534', desc:'Consistent visits and spend' };
      if (r >= 3 && m >= 4)                  return { label:'Big Spender',   emoji:'💰', bg:'#fef9c3', c:'#854d0e', desc:'High monetary value' };
      if (r <= 2 && f >= 3)                  return { label:'At Risk',       emoji:'⚠️',  bg:'#fef3c7', c:'#92400e', desc:'Was active but not visiting recently' };
      if (r >= 4 && f <= 2)                  return { label:'New Customer',  emoji:'🌱', bg:'#dbeafe', c:'#1e40af', desc:'Recently joined, building habit' };
      if (r <= 2 && f <= 2 && m >= 3)        return { label:'Hibernating',   emoji:'😴', bg:'#f3e8ff', c:'#6b21a8', desc:'Paid well but gone quiet' };
      if (r === 1 && f === 1)                return { label:'Lost',          emoji:'🔴', bg:'#fee2e2', c:'#991b1b', desc:'No recent activity' };
      return { label:'Occasional',           emoji:'🔵', bg:'#e0f2fe', c:'#075985', desc:'Visits sometimes' };
    }

    scored.forEach(function(s) { s.seg = segment(s.rScore, s.fScore, s.mScore); });

    // Group by segment
    var groups = {};
    scored.forEach(function(s) {
      var k = s.seg.label;
      if (!groups[k]) groups[k] = { seg: s.seg, members: [] };
      groups[k].members.push(s);
    });

    var order = ['Champion','Loyal','Big Spender','New Customer','At Risk','Hibernating','Occasional','Lost'];
    var sorted = order.filter(function(k){ return groups[k]; }).map(function(k){ return groups[k]; });

    if (!scored.length) { rfmEl.innerHTML = '<div style="color:var(--muted);font-size:13px">No customer data available.</div>'; return; }

    // Legend
    var html = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">';
    sorted.forEach(function(g) {
      html += '<div style="background:'+g.seg.bg+';color:'+g.seg.c+';border-radius:20px;padding:4px 12px;font-size:12px;font-weight:700;cursor:default" title="'+g.seg.desc+'">'
        + g.seg.emoji + ' ' + g.seg.label + ' <span style="font-weight:400">('+g.members.length+')</span></div>';
    });
    html += '</div>';

    // Table
    html += '<div class="twrap"><table><thead><tr>'
      + '<th>Customer</th><th>Segment</th><th>Last Visit</th><th>Visits/wk</th><th>Total Spend</th><th>R</th><th>F</th><th>M</th>'
      + '</tr></thead><tbody>';
    scored.sort(function(a,b){ return (b.rScore+b.fScore+b.mScore)-(a.rScore+a.fScore+a.mScore); }).forEach(function(s) {
      html += '<tr>'
        + '<td><strong>' + s.c.name + '</strong></td>'
        + '<td><span style="background:'+s.seg.bg+';color:'+s.seg.c+';border-radius:12px;padding:2px 9px;font-size:11px;font-weight:700">'+s.seg.emoji+' '+s.seg.label+'</span></td>'
        + '<td>' + (s.recencyDays === 999 ? '—' : s.recencyDays + 'd ago') + '</td>'
        + '<td>' + s.freqPerWeek + '</td>'
        + '<td>' + (s.monetary ? '₹' + s.monetary.toLocaleString('en-IN') : '—') + '</td>'
        + '<td style="text-align:center;font-weight:700;color:' + (s.rScore>=4?'#16a34a':s.rScore<=2?'#e74c3c':'#b07800') + '">' + s.rScore + '</td>'
        + '<td style="text-align:center;font-weight:700;color:' + (s.fScore>=4?'#16a34a':s.fScore<=2?'#e74c3c':'#b07800') + '">' + s.fScore + '</td>'
        + '<td style="text-align:center;font-weight:700;color:' + (s.mScore>=4?'#16a34a':s.mScore<=2?'#e74c3c':'#b07800') + '">' + s.mScore + '</td>'
        + '</tr>';
    });
    html += '</tbody></table></div>';
    html += '<div style="font-size:10px;color:var(--muted);margin-top:8px">R = Recency (5=visited this week), F = Frequency (5=5+ visits/wk), M = Monetary (5=top 20% spender). Scores are relative to filtered customers.</div>';
    rfmEl.innerHTML = html;
  })();

  // ── Walk-ins Analytics ──
  (function() {
    var el = document.getElementById('analytics-walkins');
    if (!el) return;

    var walkins = (D.walkins || []).filter(function(w) {
      if (!inRange(w.date)) return false;
      if (centerFilter && w.wellness_center_id !== centerFilter) return false;
      return true;
    });

    if (!walkins.length) {
      el.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:12px 0">No walk-in data in this period.</div>';
      return;
    }

    var total = walkins.length;
    var converted = walkins.filter(function(w){ return w.converted; }).length;
    var convPct = total > 0 ? Math.round((converted / total) * 100) : 0;
    var productRev = walkins.reduce(function(s, w){ return s + (parseFloat(w.amount_received) || 0); }, 0);
    var avgSale = converted > 0 ? Math.round(productRev / walkins.filter(function(w){ return (parseFloat(w.amount_received)||0) > 0; }).length || 1) : 0;
    var paidCount = walkins.filter(function(w){ return (parseFloat(w.amount_received)||0) > 0; }).length;
    avgSale = paidCount > 0 ? Math.round(productRev / paidCount) : 0;

    // KPI row
    var html = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px">';
    html += kpiCard('Total Walk-ins', total, '#2563eb');
    html += kpiCard('Converted', converted + ' (' + convPct + '%)', '#16a34a');
    html += kpiCard('Product Revenue', '₹' + productRev.toLocaleString('en-IN'), '#d97706');
    html += kpiCard('Avg Sale', paidCount ? '₹' + avgSale.toLocaleString('en-IN') : '—', '#7c3aed');
    html += '</div>';

    function kpiCard(label, val, color) {
      return '<div style="background:var(--bg2);border-radius:10px;padding:12px;text-align:center">'
        + '<div style="font-size:18px;font-weight:700;color:' + color + '">' + val + '</div>'
        + '<div style="font-size:11px;color:var(--muted);margin-top:3px">' + label + '</div>'
        + '</div>';
    }

    // Source breakdown
    var sourceDef = [
      { key: 'google', label: 'Google / Search' },
      { key: 'customer_referral', label: 'Customer Referral' },
      { key: 'coach_referral', label: 'Coach Referral' },
      { key: 'owner', label: 'Owner / Self' },
      { key: 'other', label: 'Other' }
    ];
    var sourceCounts = {};
    walkins.forEach(function(w){ var s = w.source || 'other'; sourceCounts[s] = (sourceCounts[s] || 0) + 1; });
    var maxSrc = Math.max.apply(null, sourceDef.map(function(s){ return sourceCounts[s.key] || 0; }).concat([1]));

    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px">';

    // Source bars
    html += '<div><div style="font-size:13px;font-weight:700;margin-bottom:10px">How They Found Us</div>';
    sourceDef.forEach(function(s) {
      var cnt = sourceCounts[s.key] || 0;
      var pct = Math.round((cnt / maxSrc) * 100);
      html += '<div style="margin-bottom:8px">'
        + '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px"><span>' + s.label + '</span><strong>' + cnt + '</strong></div>'
        + '<div style="background:var(--bg2);border-radius:4px;height:8px"><div style="background:#2563eb;width:' + pct + '%;height:8px;border-radius:4px;transition:width 0.4s"></div></div>'
        + '</div>';
    });
    html += '</div>';

    // Outcome breakdown
    var outcomeDef = [
      { key: 'checkup', label: 'Body Checkup', color: '#06b6d4' },
      { key: 'trial_pack', label: 'Trial Pack', color: '#8b5cf6' },
      { key: 'product_sale', label: 'Product Sale', color: '#f59e0b' },
      { key: 'monthly_pack', label: 'Monthly Pack', color: '#16a34a' },
      { key: 'other', label: 'Other', color: '#6b7280' }
    ];
    var outcomeCounts = {}, outcomeRev = {};
    walkins.forEach(function(w) {
      var o = w.outcome || 'other';
      outcomeCounts[o] = (outcomeCounts[o] || 0) + 1;
      outcomeRev[o] = (outcomeRev[o] || 0) + (parseFloat(w.amount_received) || 0);
    });
    var maxOut = Math.max.apply(null, outcomeDef.map(function(o){ return outcomeCounts[o.key] || 0; }).concat([1]));

    html += '<div><div style="font-size:13px;font-weight:700;margin-bottom:10px">Outcomes</div>';
    outcomeDef.forEach(function(o) {
      var cnt = outcomeCounts[o.key] || 0;
      var rev = outcomeRev[o.key] || 0;
      var pct = Math.round((cnt / maxOut) * 100);
      html += '<div style="margin-bottom:8px">'
        + '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px">'
        + '<span>' + o.label + '</span>'
        + '<strong>' + cnt + (rev > 0 ? ' · ₹' + rev.toLocaleString('en-IN') : '') + '</strong>'
        + '</div>'
        + '<div style="background:var(--bg2);border-radius:4px;height:8px"><div style="background:' + o.color + ';width:' + pct + '%;height:8px;border-radius:4px;transition:width 0.4s"></div></div>'
        + '</div>';
    });
    html += '</div>';
    html += '</div>'; // grid end

    // Monthly trend (last 6 months)
    var months = [];
    for (var mi = 5; mi >= 0; mi--) {
      var d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - mi);
      months.push({ label: d.toLocaleString('default',{month:'short'})+' '+d.getFullYear().toString().slice(2), y: d.getFullYear(), m: d.getMonth() });
    }
    var monthlyCounts = months.map(function(mo) {
      return walkins.filter(function(w) {
        var d = new Date(w.date); return d.getFullYear() === mo.y && d.getMonth() === mo.m;
      }).length;
    });
    var maxMo = Math.max.apply(null, monthlyCounts.concat([1]));

    html += '<div style="margin-top:4px"><div style="font-size:13px;font-weight:700;margin-bottom:10px">Monthly Trend</div>';
    html += '<div style="display:flex;align-items:flex-end;gap:8px;height:70px">';
    months.forEach(function(mo, i) {
      var cnt = monthlyCounts[i];
      var h = Math.max(4, Math.round((cnt / maxMo) * 60));
      html += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">'
        + '<div style="font-size:11px;font-weight:700;color:' + (cnt ? '#2563eb' : 'var(--muted)') + '">' + (cnt || '') + '</div>'
        + '<div style="width:100%;background:#2563eb;border-radius:4px 4px 0 0;height:' + h + 'px;opacity:' + (cnt ? '1' : '0.15') + '"></div>'
        + '<div style="font-size:9px;color:var(--muted);text-align:center">' + mo.label + '</div>'
        + '</div>';
    });
    html += '</div></div>';

    el.innerHTML = html;
  })();

  // ── Peak Hour Tracker ──
  (function() {
    var el = document.getElementById('analytics-peak-hours'); if (!el) return;
    var att = filterByCenterViaCustomer(D.attendance);
    // Only records with check_in_time
    var timed = att.filter(function(a){ return a.check_in_time && a.status === 'present'; });
    if (!timed.length) {
      el.innerHTML = '<div class="empty"><div class="ei">⏰</div><p>No check-in time data yet. Check-in times will be recorded automatically from now on when marking attendance.</p></div>';
      return;
    }
    // Build hourly buckets 5am–10pm
    var buckets = {};
    for (var h = 5; h <= 22; h++) buckets[h] = 0;
    timed.forEach(function(a) {
      var parts = a.check_in_time.split(':');
      var hr = parseInt(parts[0]);
      if (hr >= 5 && hr <= 22) buckets[hr]++;
      else if (hr < 5) buckets[5]++;
      else buckets[22]++;
    });
    var hours = Object.keys(buckets).map(Number).sort(function(a,b){return a-b;});
    var counts = hours.map(function(h){ return buckets[h]; });
    var maxCount = Math.max.apply(null, counts.concat([1]));
    var peakHr = hours[counts.indexOf(maxCount)];
    function fmtHr(h) {
      if (h === 0) return '12 AM';
      if (h === 12) return '12 PM';
      return h < 12 ? h + ' AM' : (h-12) + ' PM';
    }
    var html = '<div style="font-size:12px;color:var(--muted);margin-bottom:12px">Peak time: <strong style="color:var(--primary)">' + fmtHr(peakHr) + '</strong> · ' + timed.length + ' timed check-ins</div>';
    html += '<div style="display:flex;align-items:flex-end;gap:4px;height:90px;padding-bottom:2px">';
    hours.forEach(function(h) {
      var cnt = buckets[h];
      var barH = Math.max(4, Math.round((cnt / maxCount) * 76));
      var isPeak = h === peakHr;
      html += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px" title="' + fmtHr(h) + ': ' + cnt + '">'
        + (cnt ? '<div style="font-size:9px;font-weight:700;color:' + (isPeak ? 'var(--primary)' : 'var(--muted)') + '">' + cnt + '</div>' : '<div style="font-size:9px">&nbsp;</div>')
        + '<div style="width:100%;background:' + (isPeak ? 'var(--primary)' : '#93c5fd') + ';border-radius:3px 3px 0 0;height:' + barH + 'px;opacity:' + (cnt ? '1' : '0.2') + '"></div>'
        + '</div>';
    });
    html += '</div>';
    html += '<div style="display:flex;gap:4px;margin-top:4px">';
    hours.forEach(function(h) {
      html += '<div style="flex:1;text-align:center;font-size:8px;color:var(--muted);white-space:nowrap;overflow:hidden">' + fmtHr(h).replace(' ','') + '</div>';
    });
    html += '</div>';

    // Top 3 busiest hours summary
    var ranked = hours.slice().sort(function(a,b){ return buckets[b]-buckets[a]; }).slice(0,3).filter(function(h){return buckets[h]>0;});
    if (ranked.length) {
      html += '<div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">';
      ranked.forEach(function(h, i) {
        var medal = i===0 ? '🥇' : i===1 ? '🥈' : '🥉';
        html += '<div style="background:var(--bg2);border-radius:8px;padding:8px 14px;font-size:12px"><span>' + medal + ' </span><strong>' + fmtHr(h) + '</strong><span style="color:var(--muted)"> — ' + buckets[h] + ' check-ins</span></div>';
      });
      html += '</div>';
    }
    el.innerHTML = html;
  })();
}

// ── Slicer helpers ──
function setSlicer(type, el) {
  if (type === 'period') {
    document.querySelectorAll('.slicer-chip[data-slicer="period"]').forEach(function(c){c.classList.remove('active');});
    el.classList.add('active');
    // Clear custom date inputs
    document.getElementById('slicer-from').value = '';
    document.getElementById('slicer-to').value = '';
  } else if (type === 'status') {
    document.querySelectorAll('.slicer-chip[data-slicer="status"]').forEach(function(c){c.classList.remove('active');});
    el.classList.add('active');
  } else if (type === 'custom') {
    // Deactivate period chips when custom dates used
    document.querySelectorAll('.slicer-chip[data-slicer="period"]').forEach(function(c){c.classList.remove('active');});
  }
  renderAnalytics();
}

function resetSlicers() {
  document.querySelectorAll('.slicer-chip[data-slicer="period"]').forEach(function(c){
    c.classList.toggle('active', c.dataset.val==='3');
  });
  document.querySelectorAll('.slicer-chip[data-slicer="status"]').forEach(function(c){
    c.classList.toggle('active', c.dataset.val==='');
  });
  ['slicer-pack','slicer-goal','slicer-gender','slicer-center','slicer-revenue-type','slicer-metric'].forEach(function(id){
    var el=document.getElementById(id); if(el) el.value='';
  });
  document.getElementById('slicer-metric').value = 'weight';
  document.getElementById('slicer-from').value = '';
  document.getElementById('slicer-to').value = '';
  renderAnalytics();
}

function mkRetRow(label, count, total, color) {
  var pct = total > 0 ? Math.round((count/total)*100) : 0;
  return '<div style="margin-bottom:12px">'
    +'<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px"><span>'+label+'</span><strong style="color:'+color+'">'+count+' ('+pct+'%)</strong></div>'
    +'<div style="background:var(--surface2);border-radius:20px;height:8px;overflow:hidden"><div style="background:'+color+';height:100%;width:'+pct+'%;border-radius:20px;transition:width .5s"></div></div>'
    +'</div>';
}




// ── Weekly Progress WhatsApp (from Customer List) ──
function sendWeeklyProgressWA(cid) {
  var c = D.customers.find(function(x){return x.id===cid;});
  if (!c || !c.contact) { showToast('No contact number for this customer','error'); return; }

  var recs = D.body
    .filter(function(b){return b.customer_id===cid;})
    .sort(function(a,b){return new Date(b.date)-new Date(a.date);});

  if (recs.length < 2) { showToast('Need at least 2 body scan records','error'); return; }

  var latest = recs[0];
  var prev   = recs[1];
  var first  = recs[recs.length-1];

  // Week changes
  var wDiff  = (Number(latest.weight)           - Number(prev.weight)).toFixed(1);
  var fDiff  = (Number(latest.fat_percentage)   - Number(prev.fat_percentage)).toFixed(1);
  var mDiff  = (Number(latest.muscle_percentage)- Number(prev.muscle_percentage)).toFixed(1);

  // Total journey
  var wTotal = (Number(latest.weight)           - Number(first.weight)).toFixed(1);
  var fTotal = (Number(latest.fat_percentage)   - Number(first.fat_percentage)).toFixed(1);

  function fmt(val, goodWhenNeg) {
    var n = Number(val);
    if (n === 0) return '→ No change';
    var better = goodWhenNeg ? n < 0 : n > 0;
    return (n > 0 ? '+' : '') + val + (better ? ' ✅' : ' ⚠️');
  }

  var goal = c.goal || 'wellness';
  var streak = getStreak(cid);

  var msg =
    '🌿 *Weekly Progress Report*\n' +
    '_' + c.name + ' | ' + latest.date + '_\n\n' +

    '📊 *This Week vs Last Week:*\n' +
    '• Weight: *' + latest.weight + 'kg* (' + fmt(wDiff, true) + ')\n' +
    '• Body Fat: *' + latest.fat_percentage + '%* (' + fmt(fDiff, true) + ')\n' +
    '• Muscle: *' + latest.muscle_percentage + '%* (' + fmt(mDiff, false) + ')\n\n' +

    '🏁 *Total Journey Progress:*\n' +
    '• Weight: ' + fmt(wTotal, true) + ' from start\n' +
    '• Body Fat: ' + fmt(fTotal, true) + ' from start\n\n' +

    '🔥 *Current Streak: ' + streak + ' day' + (streak===1?'':'s') + '*\n\n' +

    (goal === 'Weight Loss'
      ? (Number(wDiff) < 0
          ? '👏 Great progress this week! Keep up the consistency.\n'
          : '💪 Let\'s focus on water intake and shake timing this week.\n')
      : goal === 'Weight Gain'
      ? (Number(wDiff) > 0
          ? '👏 Gaining well! Keep your protein shake on schedule.\n'
          : '💪 Let\'s increase your meal frequency this week.\n')
      : '👏 Keep up the great work this week!\n'
    ) +
    '\n_Your '+getCenterName()+' Team_ 🌱';

  var phone = c.contact.replace(/\D/g,'');
  if (phone.length === 10) phone = COUNTRY_CODE + phone;
  window.open('https://api.whatsapp.com/send?phone=' + phone + '&text=' + encodeURIComponent(msg), '_blank');
}


// ══════════════════════════════════════════════
// BODY COMPOSITION — HELPERS
// ══════════════════════════════════════════════
var _selectedBodyCustId = null;
function switchBodyTab(name, el) {
  document.getElementById('body-sec-records').style.display = name==='records'?'block':'none';
  document.getElementById('body-sec-recheck').style.display = name==='recheck'?'block':'none';
  document.getElementById('body-sec-myprofile').style.display = name==='myprofile'?'block':'none';
  document.querySelectorAll('#sec-body .tab-btn').forEach(function(b){b.classList.remove('active');});
  el.classList.add('active');
  if (name==='recheck') renderRecheckList();
  if (name==='myprofile') { loadSvProfile(); renderSvBody(); autoRecoverSvBodyIfNeeded(); }
}
// ── SUPERVISOR BODY COMPOSITION ──
function saveSvProfile() {
  var p = {
    name:   (document.getElementById('sv-name')||{}).value||'',
    age:    (document.getElementById('sv-age')||{}).value||'',
    height: (document.getElementById('sv-height')||{}).value||'',
    gender: (document.getElementById('sv-gender')||{}).value||'',
    goal:   (document.getElementById('sv-goal')||{}).value||'Weight Loss'
  };
  localStorage.setItem('sv_profile', JSON.stringify(p));
}
function loadSvProfile() {
  var p = JSON.parse(localStorage.getItem('sv_profile')||'{}');
  var n=document.getElementById('sv-name');   if(n) n.value=p.name||'';
  var a=document.getElementById('sv-age');    if(a) a.value=p.age||'';
  var h=document.getElementById('sv-height'); if(h) h.value=p.height||'';
  var g=document.getElementById('sv-gender'); if(g) g.value=p.gender||'';
  var gl=document.getElementById('sv-goal');  if(gl&&p.goal) gl.value=p.goal;
}
function renderSvBody() {
  var op = JSON.parse(localStorage.getItem('ownerProfile')||'{}');
  var svId = op.sv_body_id;
  var recs = svId ? (D.body||[]).filter(function(b){ return b.customer_id===svId; }) : [];
  var tb=document.getElementById('sv-body-body');
  var empty=document.getElementById('sv-body-empty');
  var wrap=document.getElementById('sv-body-records-wrap');
  if(!tb||!empty||!wrap) return;
  if(!recs.length){ empty.style.display='block'; wrap.style.display='none'; return; }
  empty.style.display='none'; wrap.style.display='block';
  var p=JSON.parse(localStorage.getItem('sv_profile')||'{}');
  var revWeight=(p.goal||'Weight Loss')==='Weight Gain';
  var sorted=recs.slice().sort(function(a,b){return new Date(a.date)-new Date(b.date);});
  // ── Health Score Card ──
  var latest=sorted[sorted.length-1], first=sorted[0];
  var scoreEl=document.getElementById('sv-body-score-card');
  if(scoreEl && latest) {
    var lVfKg=parseFloat(latest.visceral_fat)||0;
    var svPhone=(JSON.parse(localStorage.getItem('sv_profile')||'{}')).phone||'';
    var wChange=(first&&latest&&first.weight&&latest.weight)?(Number(latest.weight)-Number(first.weight)).toFixed(1):null;
    var fChange=(first&&latest&&first.fat_percentage&&latest.fat_percentage)?(Number(latest.fat_percentage)-Number(first.fat_percentage)).toFixed(1):null;
    var mChange=(first&&latest&&first.muscle_percentage&&latest.muscle_percentage)?(Number(latest.muscle_percentage)-Number(first.muscle_percentage)).toFixed(1):null;
    function svDiffColor(val,goodWhenNeg){if(val===null)return'rgba(255,255,255,.6)';var n=Number(val);if(n===0)return'rgba(255,255,255,.6)';return(goodWhenNeg?n<0:n>0)?'#a8e6b8':'#f4a7a0';}
    function svFmt(val,unit){if(val===null)return'—';return(Number(val)>0?'+':'')+val+(unit||'');}
    // Ideal card — build synthetic cust from sv_profile
    var svP = JSON.parse(localStorage.getItem('sv_profile')||'{}');
    var svCust = { name: op.name||'Supervisor', gender: svP.gender||'', dob: svP.age ? String(new Date().getFullYear() - parseInt(svP.age)) : null };
    renderIdealCard(svCust, latest, 'sv-ideal-card');
    scoreEl.innerHTML = svBuildHealthScoreCard(latest.bmi, latest.fat_percentage, lVfKg, latest.date, {name:op.name||'Supervisor', phone:svPhone, weight:latest.weight, musclePct:latest.muscle_percentage, gender:svP.gender||''}) +
      '<div class="body-profile" style="margin-top:10px">' +
      '<div class="body-profile-name">'+(p.name||'Supervisor')+'</div>' +
      '<div class="body-profile-meta">'+(p.goal?'🎯 '+p.goal+' &nbsp;·&nbsp; ':'')+sorted.length+' scan'+(sorted.length===1?'':'s')+' total</div>' +
      '<div class="body-profile-stats">' +
        '<div class="body-profile-stat"><div class="body-profile-stat-lbl">Current Weight</div><div class="body-profile-stat-val">'+(latest.weight?latest.weight+' kg':'—')+'</div>'+(wChange?'<div class="body-profile-stat-diff" style="color:'+svDiffColor(wChange,revWeight)+'">'+svFmt(wChange,' kg')+'</div>':'')+'</div>' +
        '<div class="body-profile-stat"><div class="body-profile-stat-lbl">Body Fat</div><div class="body-profile-stat-val">'+(latest.fat_percentage?latest.fat_percentage+'%':'—')+'</div>'+(fChange?'<div class="body-profile-stat-diff" style="color:'+svDiffColor(fChange,true)+'">'+svFmt(fChange,' %')+'</div>':'')+'</div>' +
        '<div class="body-profile-stat"><div class="body-profile-stat-lbl">Muscle</div><div class="body-profile-stat-val">'+(latest.muscle_percentage?latest.muscle_percentage+'%':'—')+'</div>'+(mChange?'<div class="body-profile-stat-diff" style="color:'+svDiffColor(mChange,false)+'">'+svFmt(mChange,' %')+'</div>':'')+'</div>' +
        '<div class="body-profile-stat"><div class="body-profile-stat-lbl">BMI</div><div class="body-profile-stat-val">'+(latest.bmi||'—')+'</div></div>' +
        '<div class="body-profile-stat"><div class="body-profile-stat-lbl">BMR</div><div class="body-profile-stat-val">'+(latest.bmr||'—')+'</div></div>' +
      '</div></div>';
  }
  tb.innerHTML=sorted.map(function(b,idx){
    var prev=sorted[idx-1]||null;
    var cw=Number(b.weight),pw=prev?Number(prev.weight):null;
    var cf=Number(b.fat_percentage),pf=prev?Number(prev.fat_percentage):null;
    var csf=Number(b.subcutaneous_fat_percentage),psf=prev?Number(prev.subcutaneous_fat_percentage):null;
    var cm=Number(b.muscle_percentage),pm=prev?Number(prev.muscle_percentage):null;
    var cfKg=(cw&&cf)?parseFloat((cw*cf/100).toFixed(2)):null;
    var pfKg=(pw&&pf)?parseFloat((pw*pf/100).toFixed(2)):null;
    var csfKg=(cw&&csf)?parseFloat((cw*csf/100).toFixed(2)):null;
    var psfKg=(pw&&psf)?parseFloat((pw*psf/100).toFixed(2)):null;
    var cmKg=(cw&&cm)?parseFloat((cw*cm/100).toFixed(2)):null;
    var pmKg=(pw&&pm)?parseFloat((pw*pm/100).toFixed(2)):null;
    var cV=(cfKg!==null&&csfKg!==null)?parseFloat((cfKg-csfKg).toFixed(2)):null;
    var pV=(pfKg!==null&&psfKg!==null)?parseFloat((pfKg-psfKg).toFixed(2)):null;
    var cv=(b.visceral_fat)?Number(b.visceral_fat):null;
    var pv=(prev&&prev.visceral_fat)?Number(prev.visceral_fat):null;
    function svKgCell(kg, pct, pKg, goodWhenDown) {
      if (kg === null && !pct) return '<td>—</td>';
      var main = kg !== null ? kg + ' kg' : (pct ? pct + '%' : '—');
      var sub  = (kg !== null && pct) ? '<div style="font-size:11px;color:var(--muted);line-height:1">' + pct + '%</div>' : '';
      var arr  = kg !== null ? getArr(kg, pKg, goodWhenDown) : '';
      return '<td style="line-height:1.4">' + main + arr + sub + '</td>';
    }
    var isMostRecent=idx===sorted.length-1;
    return '<tr'+(isMostRecent?' style="background:#f0fdf4"':'')+'>'
      +'<td>'+b.date+(isMostRecent?' <span class="badge bg" style="font-size:9px">Latest</span>':'')+'</td>'
      +'<td>'+(cw||'—')+getArr(cw,pw,revWeight)+'</td>'
      +svKgCell(cfKg, cf, pfKg, true)
      +'<td>'+(cv!==null?cv:'—')+getArr(cv,pv,false)+'</td>'
      +'<td>'+(b.bmr||'—')+'</td>'
      +'<td>'+(b.bmi||'—')+'</td>'
      +'<td>'+(b.body_age||'—')+'</td>'
      +svKgCell(csfKg, csf, psfKg, true)
      +svKgCell(cmKg, cm, pmKg, false)
      +'<td><div class="acts">'
        +'<button class="btn-e" onclick="editSvBody(\''+b.id+'\')">Edit</button>'
        +'<button class="btn-d" onclick="delSvBody(\''+b.id+'\')">Del</button>'
      +'</div></td>'
      +'</tr>';
  }).join('');
}
async function autoRecoverSvBodyIfNeeded() {
  var op = JSON.parse(localStorage.getItem('ownerProfile')||'{}');
  if (op.sv_body_id) return; // already linked, nothing to do
  getCredentials();
  if (!getActiveSbUrl() || !(SB_KEY || CENTER_SB_KEY)) return;
  try {
    var knownIds = new Set(
      (D.customers||[]).map(function(c){return c.id;})
      .concat((D.coaches||[]).map(function(c){return c.id;}))
      .concat((D.walkins||[]).map(function(w){return w.id;}))
    );
    var url = getActiveSbUrl() + '/rest/v1/body_composition?order=date.asc&limit=1000';
    var res = await fetch(url, {
      headers: { 'apikey': SB_KEY || CENTER_SB_KEY, 'Authorization': 'Bearer ' + getActiveSbKey() }
    });
    var allRecs = await res.json();
    if (!Array.isArray(allRecs)) return;
    var orphanGroups = {};
    allRecs.forEach(function(b){
      if (!knownIds.has(b.customer_id)) {
        if (!orphanGroups[b.customer_id]) orphanGroups[b.customer_id] = [];
        orphanGroups[b.customer_id].push(b);
      }
    });
    var groupKeys = Object.keys(orphanGroups);
    if (!groupKeys.length) return;
    var selectedId;
    if (groupKeys.length === 1) {
      // Only one orphan group — auto-link silently
      selectedId = groupKeys[0];
    } else {
      // Multiple — prompt user to pick
      var lines = groupKeys.map(function(id, i){
        var recs = orphanGroups[id];
        var name = recs[0].customer_name || '(no name)';
        var dates = recs.map(function(r){return r.date;}).sort();
        return (i+1)+'. '+name+' — '+recs.length+' record(s), '+dates[0]+' to '+dates[dates.length-1];
      }).join('\n');
      var choice = prompt('Multiple unlinked profiles found. Which is yours?\n\n'+lines+'\n\nEnter number (or Cancel):');
      if (!choice) return;
      var idx = parseInt(choice) - 1;
      if (isNaN(idx) || idx < 0 || idx >= groupKeys.length) return;
      selectedId = groupKeys[idx];
    }
    op.sv_body_id = selectedId;
    localStorage.setItem('ownerProfile', JSON.stringify(op));
    OWNER_PROFILE = op;
    await loadBody();
    renderSvBody();
  } catch(e) { /* silent fail — user can use manual Recover button */ }
}
async function recoverSvBodyRecords() {
  getCredentials();
  if (!getActiveSbUrl() || !(SB_KEY || CENTER_SB_KEY)) {
    showToast('Not connected to Supabase', 'error'); return;
  }
  showToast('Scanning Supabase for unlinked records…', 'success');
  // Build set of all known IDs (customers + coaches + walkins + current sv_body_id)
  var knownIds = new Set(
    (D.customers||[]).map(function(c){return c.id;})
    .concat((D.coaches||[]).map(function(c){return c.id;}))
    .concat((D.walkins||[]).map(function(w){return w.id;}))
  );
  var op = JSON.parse(localStorage.getItem('ownerProfile')||'{}');
  if (op.sv_body_id) knownIds.add(op.sv_body_id);
  // Fetch ALL body_composition records directly (no customer_id filter)
  try {
    var url = getActiveSbUrl() + '/rest/v1/body_composition?order=date.asc&limit=1000';
    var res = await fetch(url, {
      headers: { 'apikey': SB_KEY || CENTER_SB_KEY, 'Authorization': 'Bearer ' + getActiveSbKey() }
    });
    var allRecs = await res.json();
    if (!Array.isArray(allRecs)) { showToast('Could not fetch records from Supabase', 'error'); return; }
    // Group by customer_id, keeping only those not in knownIds
    var orphanGroups = {};
    allRecs.forEach(function(b){
      if (!knownIds.has(b.customer_id)) {
        if (!orphanGroups[b.customer_id]) orphanGroups[b.customer_id] = [];
        orphanGroups[b.customer_id].push(b);
      }
    });
    var groupKeys = Object.keys(orphanGroups);
    if (!groupKeys.length) {
      showToast('No unlinked records found in Supabase. Records may have been deleted or are already linked.', 'error');
      return;
    }
    var lines = groupKeys.map(function(id, i){
      var recs = orphanGroups[id];
      var name = recs[0].customer_name || '(no name)';
      var dates = recs.map(function(r){return r.date;}).sort();
      return (i+1)+'. '+name+' — '+recs.length+' record(s), '+dates[0]+' to '+dates[dates.length-1];
    }).join('\n');
    var choice = prompt('Found these unlinked profiles:\n\n'+lines+'\n\nEnter the number to link as your My Profile (or Cancel):');
    if (!choice) return;
    var idx = parseInt(choice) - 1;
    if (isNaN(idx) || idx < 0 || idx >= groupKeys.length) { showToast('Invalid selection','error'); return; }
    var selectedId = groupKeys[idx];
    op.sv_body_id = selectedId;
    localStorage.setItem('ownerProfile', JSON.stringify(op));
    OWNER_PROFILE = op;
    showToast('Profile linked! Loading records…', 'success');
    await loadBody();
    renderSvBody();
  } catch(e) {
    showToast('Error: ' + e.message, 'error');
  }
}
async function migrateSvBodyToSupabase() {
  var old = JSON.parse(localStorage.getItem('sv_body_records')||'[]');
  if (!old.length) return;
  getCredentials(); if (!getActiveSbUrl() || !getActiveSbKey()) return;
  var op = JSON.parse(localStorage.getItem('ownerProfile')||'{}');
  if (!op.sv_body_id) {
    op.sv_body_id = (crypto.randomUUID ? crypto.randomUUID() : 'sv-' + Date.now() + '-' + Math.random().toString(36).slice(2));
    localStorage.setItem('ownerProfile', JSON.stringify(op));
  }
  var svId = op.sv_body_id;
  var existing = (D.body||[]).filter(function(b){ return b.customer_id===svId; }).map(function(b){ return b.date; });
  var toMigrate = old.filter(function(r){ return !existing.includes(r.date); });
  for (var i=0; i<toMigrate.length; i++) {
    var r = toMigrate[i];
    try {
      await dbInsert('body_composition', {
        customer_id:svId, customer_name:op.name||'Supervisor',
        date:r.date, height:r.height||null, age:r.age||null, weight:r.weight||null,
        fat_percentage:r.fat_percentage||null, visceral_fat:r.visceral_fat||null,
        bmr:r.bmr||null, bmi:r.bmi||null, body_age:r.body_age||null,
        subcutaneous_fat_percentage:r.subcutaneous_fat_percentage||null,
        muscle_percentage:r.muscle_percentage||null, notes:r.notes||null
      });
    } catch(e) {}
  }
  if (toMigrate.length) {
    localStorage.removeItem('sv_body_records');
    await loadBody(); renderSvBody();
    showToast(toMigrate.length + ' old supervisor body record(s) migrated to Supabase ✓', 'success');
  }
}
var _svDietDay = null;
var _svDietInFlight = false;

function renderSvDietPlan() {
  var el = document.getElementById('sv-diet-output'); if (!el) return;
  var op = JSON.parse(localStorage.getItem('ownerProfile')||'{}');
  var plan = op.sv_diet_plan ? JSON.parse(op.sv_diet_plan) : null;
  if (!plan) { el.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:10px 0">No plan yet — fill in Goal, Diet Type and Activity Level, then click Generate My Plan.</div>'; return; }
  // Restore dropdown selections from saved plan
  var dg = document.getElementById('sv-diet-goal'), dt = document.getElementById('sv-diet-type'), da = document.getElementById('sv-diet-activity');
  if (dg && plan.goal) dg.value = plan.goal;
  if (dt && plan.diet_type) dt.value = plan.diet_type;
  if (da && plan.activity) da.value = plan.activity;
  var dayKeys = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
  var dayLabels = {monday:'Mon',tuesday:'Tue',wednesday:'Wed',thursday:'Thu',friday:'Fri',saturday:'Sat',sunday:'Sun'};
  var todayKey = dayKeys[new Date().getDay() === 0 ? 6 : new Date().getDay()-1];
  if (!_svDietDay || !plan.days[_svDietDay]) _svDietDay = todayKey;
  var meals = plan.days[_svDietDay] || {};
  var html = '<div class="diet-header"><h2>My 7-Day Diet Plan</h2>'
    + '<p>Goal: ' + (plan.goal||'') + ' &nbsp;|&nbsp; Generated: ' + (plan.generated||'') + '</p>'
    + '<div class="diet-macros">'
    + '<div class="diet-macro"><div class="diet-macro-val">' + (plan.target_calories||'—') + '</div><div class="diet-macro-lbl">Target kcal</div></div>'
    + '<div class="diet-macro"><div class="diet-macro-val">' + (plan.target_protein||'—') + 'g</div><div class="diet-macro-lbl">Target Protein</div></div>'
    + '<div class="diet-macro"><div class="diet-macro-val">' + (meals.total_calories||0) + '</div><div class="diet-macro-lbl">Today kcal</div></div>'
    + '<div class="diet-macro"><div class="diet-macro-val">' + (meals.total_protein||0) + 'g</div><div class="diet-macro-lbl">Today Protein</div></div>'
    + '<div class="diet-macro"><div class="diet-macro-val">' + Math.round(plan.rmr||0) + '</div><div class="diet-macro-lbl">RMR</div></div>'
    + '</div></div>'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">';
  dayKeys.forEach(function(dk) {
    var isActive = dk === _svDietDay, isToday = dk === todayKey;
    html += '<button onclick="_svDietDay=\''+dk+'\';renderSvDietPlan()" style="padding:6px 12px;border-radius:20px;border:2px solid '+(isActive?'#16a34a':'#e2e8f0')+';background:'+(isActive?'#16a34a':'#fff')+';color:'+(isActive?'#fff':'#374151')+';font-family:inherit;font-size:12px;font-weight:'+(isToday?'700':'500')+';cursor:pointer">' + dayLabels[dk] + (isToday?' ★':'') + '</button>';
  });
  html += '</div>';
  var slots = [
    { key:'breakfast', icon:'🌅', iconBg:'#d97706', title:'Breakfast', fixed:'shake' },
    { key:'mid_morning', icon:'🍎', iconBg:'#16a34a', title:'Mid-Morning Snack' },
    { key:'lunch', icon:'☀️', iconBg:'#2563eb', title:'Lunch' },
    { key:'evening', icon:'🌆', iconBg:'#db2777', title:'Evening Snack' },
    { key:'dinner', icon:'🌙', iconBg:'#7c3aed', title:'Dinner' }
  ];
  slots.forEach(function(slot) {
    var items = slot.fixed ? null : meals[slot.key];
    var slotCal = 0, slotPro = 0, itemsHtml = '';
    if (slot.fixed === 'shake') {
      itemsHtml = '<div class="meal-item"><div><div class="meal-item-name">Protein Shake</div><div class="meal-item-detail">Morning shake — mixed with 250ml low-fat milk</div></div></div>';
    } else if (!items) { return; }
    else if (Array.isArray(items)) {
      items.forEach(function(it) { slotCal += Number(it.calories||0); slotPro += Number(it.protein||0); itemsHtml += '<div class="meal-item"><div><div class="meal-item-name">'+it.name+'</div><div class="meal-item-detail">'+it.grams+'g &nbsp;·&nbsp; '+Number(it.calories).toFixed(0)+' kcal</div></div><div class="meal-item-badge">'+Number(it.protein).toFixed(1)+'g protein</div></div>'; });
    } else {
      slotCal = Number(items.calories||0); slotPro = Number(items.protein||0);
      itemsHtml = '<div class="meal-item"><div><div class="meal-item-name">'+items.name+'</div><div class="meal-item-detail">'+items.grams+'g &nbsp;·&nbsp; '+Number(items.calories).toFixed(0)+' kcal</div></div><div class="meal-item-badge">'+Number(items.protein).toFixed(1)+'g protein</div></div>';
    }
    html += '<div class="meal-slot"><div class="meal-slot-header"><div class="meal-slot-icon" style="background:'+slot.iconBg+'">'+slot.icon+'</div><div style="flex:1"><div class="meal-slot-title">'+slot.title+'</div>'+(slotCal>0?'<div class="meal-slot-cal">~'+Math.round(slotCal)+' kcal &nbsp;·&nbsp; '+Number(slotPro).toFixed(1)+'g protein</div>':'')+'</div></div>'+itemsHtml+'</div>';
  });
  el.innerHTML = html;
}

async function generateSvDietPlan() {
  if (_svDietInFlight) return;
  if (!getGroqKey()) { showToast('Set Groq API key in SQL/Config section first', 'error'); return; }
  if (!D_FOODS.length) { showToast('Add foods to the Food Database first', 'error'); return; }
  var op = JSON.parse(localStorage.getItem('ownerProfile')||'{}');
  var svP = JSON.parse(localStorage.getItem('sv_profile')||'{}');
  var svId = op.sv_body_id;
  var latestBody = svId ? (D.body||[]).filter(function(b){ return b.customer_id===svId; }).sort(function(a,b){ return b.date>a.date?1:-1; })[0] : null;
  var weight = latestBody ? parseFloat(latestBody.weight) : null;
  var height = latestBody ? parseFloat(latestBody.height) : null;
  var age = svP.age ? parseInt(svP.age) : null;
  var gender = (svP.gender||'').toLowerCase();
  if (!weight || !height || !age) { showToast('Need weight, height (from body records) and age (from Your Profile) to generate', 'error'); return; }
  var goal = document.getElementById('sv-diet-goal').value;
  var dietType = document.getElementById('sv-diet-type').value;
  var activity = document.getElementById('sv-diet-activity').value;
  var isWL = goal === 'Weight Loss';
  var rmr = (10*weight) + (6.25*height) - (5*age) + (gender==='female' ? -161 : 5);
  var actMult = { sedentary:1.2, light:1.375, moderate:1.55, active:1.725 }[activity] || 1.375;
  var tdee = Math.round(rmr * actMult);
  var targetCal = isWL ? Math.round(tdee-400) : Math.round(tdee+400);
  var targetProtein = Math.round(weight * 2.0);
  var shakeKcal = isWL ? 170 : 178, shakeProtein = 19.3;
  var foodCalBudget = targetCal - shakeKcal;
  var foodProteinBudget = targetProtein - shakeProtein;
  var foods = D_FOODS.filter(function(f){ return !(dietType==='veg' && f.category==='non-veg'); });
  var foodList = foods.map(function(f){ return f.name+' (Cal:'+f.calories+' Protein:'+f.protein+'g Carbs:'+f.carbs+'g Fat:'+f.fat+'g per 100g, best for: '+f.meal_time+')'; }).join('\n');
  var dayTemplate = '{"mid_morning":{"name":"","grams":0,"calories":0,"protein":0},"lunch":[{"name":"","grams":0,"calories":0,"protein":0}],"evening":{"name":"","grams":0,"calories":0,"protein":0},"dinner":[{"name":"","grams":0,"calories":0,"protein":0}],"total_calories":0,"total_protein":0}';
  var prompt = 'You are a sports nutritionist. Create a personalized 7-day meal plan (Monday to Sunday) for a wellness center supervisor.\n\n'
    + 'Name: '+(op.name||'Supervisor')+' | Age: '+age+' | Gender: '+(gender||'not specified')+' | Goal: '+goal+'\n'
    + 'Diet: '+(dietType==='veg'?'Vegetarian':'Non-Vegetarian')+'\n'
    + 'RMR: '+Math.round(rmr)+' kcal | TDEE: '+tdee+' kcal\n'
    + 'Total Daily Target: '+targetCal+' kcal | '+targetProtein+'g protein\n'
    + 'Protein Shake accounts for: '+shakeKcal+' kcal + '+shakeProtein+'g protein\n'
    + 'Remaining food budget: '+foodCalBudget+' kcal | '+Math.round(foodProteinBudget)+'g protein\n'
    + 'Weight: '+weight+'kg | Height: '+height+'cm\n\n'
    + 'RULES: Breakfast shake is already accounted for — do NOT include in JSON. Each day: Mid-Morning Snack (1 item), Lunch (2-3 items), Evening Snack (1 item), Dinner (2-3 items). Pick ONLY from the food list. Vary meals across days.\n\n'
    + 'AVAILABLE FOODS:\n'+foodList+'\n\n'
    + 'Return ONLY valid JSON:\n'
    + '{"target_calories":'+targetCal+',"target_protein":'+targetProtein+',"rmr":'+Math.round(rmr)+',"tdee":'+tdee
    + ',"goal":"'+goal+'","shake_kcal":'+shakeKcal+',"shake_protein":'+shakeProtein+',"note":"",'
    + '"days":{"monday":'+dayTemplate+',"tuesday":'+dayTemplate+',"wednesday":'+dayTemplate+','
    + '"thursday":'+dayTemplate+',"friday":'+dayTemplate+',"saturday":'+dayTemplate+',"sunday":'+dayTemplate+'}}';

  var btn = document.getElementById('sv-diet-gen-btn');
  btn.textContent = '⏳ Generating...'; btn.disabled = true;
  _svDietInFlight = true;
  try {
    var raw = await callGroq(null, prompt, { temperature: 0.3 });
    var jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI did not return valid JSON');
    var plan = JSON.parse(jsonMatch[0]);
    plan.generated = new Date().toISOString().split('T')[0];
    plan.diet_type = dietType;
    plan.activity = activity;
    op.sv_diet_plan = JSON.stringify(plan);
    localStorage.setItem('ownerProfile', JSON.stringify(op));
    _svDietDay = null;
    renderSvDietPlan();
    showToast('Diet plan generated!', 'success');
  } catch(e) { showToast('Error: '+e.message, 'error'); }
  finally { btn.textContent = '🤖 Generate My Plan'; btn.disabled = false; _svDietInFlight = false; }
}

function openBodyModalSv() {
  document.getElementById('body-id').value='';
  document.getElementById('body-customer').value='__sv__';
  document.getElementById('body-date').value=new Date().toISOString().slice(0,10);
  // Clear all body fields first
  ['body-height','body-weight','body-fat','body-visceral','body-bmr','body-bmi','body-age','body-subfat','body-muscle','body-notes'].forEach(function(id){
    var el=document.getElementById(id); if(el) { el.value=''; el.dataset.manual=''; }
  });
  document.getElementById('body-age-field').value='';
  // Auto-fill height and age from latest body record (stored in Supabase via body_composition)
  var op=JSON.parse(localStorage.getItem('ownerProfile')||'{}');
  var svId=op.sv_body_id;
  var lastRec=svId ? (D.body||[]).filter(function(b){return b.customer_id===svId;}).sort(function(a,b){return new Date(b.date)-new Date(a.date);})[0] : null;
  if(lastRec) {
    if(lastRec.height) document.getElementById('body-height').value=lastRec.height;
    if(lastRec.age)    document.getElementById('body-age-field').value=lastRec.age;
  } else {
    // First scan — fallback to My Profile fields
    var p=JSON.parse(localStorage.getItem('sv_profile')||'{}');
    if(p.height) document.getElementById('body-height').value=p.height;
    if(p.age)    document.getElementById('body-age-field').value=p.age;
  }
  openModal('body');
}
function editSvBody(id) {
  var op=JSON.parse(localStorage.getItem('ownerProfile')||'{}');
  var b=(D.body||[]).find(function(x){return x.id===id && x.customer_id===op.sv_body_id;}); if(!b) return;
  document.getElementById('body-id').value=b.id;
  document.getElementById('body-customer').value='__sv__';
  document.getElementById('body-date').value=b.date;
  document.getElementById('body-height').value=b.height||'';
  document.getElementById('body-age-field').value=b.age||'';
  document.getElementById('body-weight').value=b.weight||'';
  document.getElementById('body-fat').value=b.fat_percentage||'';
  document.getElementById('body-visceral').value=b.visceral_fat||'';
  document.getElementById('body-bmr').value=b.bmr||'';
  var bmiEl2=document.getElementById('body-bmi'); bmiEl2.value=b.bmi||''; bmiEl2.dataset.manual=b.bmi?'1':'';
  document.getElementById('body-age').value=b.body_age||'';
  document.getElementById('body-subfat').value=b.subcutaneous_fat_percentage||'';
  document.getElementById('body-muscle').value=b.muscle_percentage||'';
  document.getElementById('body-notes').value=b.notes||'';
  calcBody();
  openModal('body');
}
async function delSvBody(id) {
  if(!confirm('Delete this record?')) return;
  getCredentials(); if(!getActiveSbUrl()||!getActiveSbKey()) return;
  try { await dbDelete('body_composition', id); await loadBody(); renderSvBody(); }
  catch(e) { showToast('Error: '+e.message,'error'); }
}

function updateBodyCustSelect() {
  var sel = document.getElementById('body-cust-select'); if(!sel) return;
  var prev = sel.value;
  var custOpts = D.customers.map(function(c){return '<option value="'+c.id+'">'+c.name+'</option>';}).join('');
  var coachOpts = D.coaches.length ? '<optgroup label="── Coaches ──">'+D.coaches.map(function(c){return '<option value="'+c.id+'">'+c.name+' 👨‍🏫</option>';}).join('')+'</optgroup>' : '';
  var _wl = (D.walkins||[]).filter(function(w){ return !ACTIVE_CENTER||w.wellness_center_id===ACTIVE_CENTER; });
  var walkinOpts = _wl.length ? '<optgroup label="── Walk-ins ──">'+_wl.map(function(w){return '<option value="walkin__'+w.id+'">'+w.name+' 🚶 ('+(w.date||'')+')</option>';}).join('')+'</optgroup>' : '';
  sel.innerHTML = '<option value="">— Choose a person —</option>' + custOpts + coachOpts + walkinOpts;
  if(prev) sel.value = prev;
}
function onBodyCustomerChange() {
  var raw = document.getElementById('body-cust-select').value||null;
  _selectedBodyCustId = raw && raw.startsWith('walkin__') ? raw.slice(8) : raw;
  document.getElementById('body-search').value='';
  renderBody();
}
function onBodySearch() {
  var q = document.getElementById('body-search').value.toLowerCase().trim();
  var sel = document.getElementById('body-cust-select');
  if(!q){_selectedBodyCustId=null;sel.value='';renderBody();return;}
  var match = D.customers.find(function(c){return(c.name||'').toLowerCase().includes(q);})
           || D.coaches.find(function(c){return(c.name||'').toLowerCase().includes(q);});
  if(match){_selectedBodyCustId=match.id;sel.value=match.id;}
  else {
    var wMatch = (D.walkins||[]).find(function(w){return(w.name||'').toLowerCase().includes(q);});
    if(wMatch){_selectedBodyCustId=wMatch.id;sel.value='walkin__'+wMatch.id;}
    else{_selectedBodyCustId=null;sel.value='';}
  }
  renderBody();
}

// ══════════════════════════════════════════════
// LOYALTY & PACK RENEWAL
// ══════════════════════════════════════════════
function getLoyaltyTier(joinDate){
  if(!joinDate) return null;
  var days=Math.floor((new Date()-new Date(joinDate))/86400000);
  var months=Math.floor(days/30);
  if(months>=12) return{label:'💎 Diamond Member',sub:Math.floor(months/12)+' year'+(Math.floor(months/12)>1?'s':'')+' with us',cls:'loyalty-gold',months};
  if(months>=6)  return{label:'🏆 Gold Member',   sub:months+' months with us',cls:'loyalty-gold',months};
  if(months>=3)  return{label:'🌟 Silver Member', sub:months+' months with us',cls:'loyalty-green',months};
  if(months>=1)  return{label:'🌱 Rising Member', sub:months+' month'+(months>1?'s':'')+' with us',cls:'loyalty-blue',months};
  return           {label:'✨ New Member',         sub:days+' days with us',cls:'loyalty-purple',months};
}
function showCustomerJourney(cid){
  var c=D.customers.find(function(x){return x.id===cid;}); if(!c) return;
  var section=document.getElementById('pack-history-section');
  section.style.display='block';
  section.scrollIntoView({behavior:'smooth',block:'start'});
  var joinDate=c.join_date||c.pack_start_date;
  var tier=getLoyaltyTier(joinDate);
  var bannerEl=document.getElementById('pack-loyalty-banner');
  if(tier){
    var msgs={'💎':'An incredible journey! Thank you 🙏','🏆':'Half a year strong! 💪','🌟':'Three months and thriving! 🌟','🌱':'One month done, many more to go! 🌱','✨':'Welcome to the family! ✨'};
    var mKey=Object.keys(msgs).find(function(k){return tier.label.includes(k);})||'✨';
    bannerEl.innerHTML='<div class="loyalty-banner '+tier.cls+'">'
      +'<div><div class="loyalty-label">'+tier.label+' — '+c.name+'</div>'
      +'<div class="loyalty-sub">'+tier.sub+(joinDate?' · Since '+joinDate:'')+'</div>'
      +'<div class="loyalty-sub" style="margin-top:4px">'+msgs[mKey]+'</div></div>'
      +(c.contact?'<button class="wa-btn" style="background:rgba(255,255,255,.2);color:#fff;border:1px solid rgba(255,255,255,.4);font-size:12px;padding:6px 14px" onclick="sendLoyaltyWA(\''+c.id+'\')">💬 Send WA</button>':'')
      +'</div>';
  }
  var allPacks=(D.packHistory||[]).filter(function(p){return p.customer_id===cid;}).sort(function(a,b){return new Date(a.start_date)-new Date(b.start_date);});
  var currentInHist=allPacks.find(function(p){return p.pack_type===c.pack_type&&p.start_date===c.pack_start_date;});
  if(!currentInHist&&c.pack_type&&c.pack_start_date) allPacks.push({pack_type:c.pack_type,start_date:c.pack_start_date,price:c.pack_price,notes:'Current',_cur:true});
  var tlEl=document.getElementById('pack-timeline-list');
  tlEl.innerHTML=allPacks.length?'<div class="pack-timeline">'+allPacks.map(function(p,i){
    var isCur=p._cur||(i===allPacks.length-1&&getDaysLeft(c).active);
    var dotCls=isCur?'active':i===0?'first':'completed';
    return'<div class="pack-item"><div class="pack-dot '+dotCls+'" style="top:10px">'+(isCur?'▶':i===0?'★':'✓')+'</div>'
      +'<div class="pack-card'+(isCur?' active-pack':'')+'">'
      +'<div style="display:flex;justify-content:space-between"><strong style="font-size:13px">'+(p.pack_type||'—')+(i===0?' <span style="font-size:10px;color:var(--accent)">FIRST</span>':'')+(isCur?' <span class="badge bg" style="font-size:9px">ACTIVE</span>':'')+'</strong>'
      +(p.price?'<span style="font-weight:700;color:var(--primary);font-size:13px">₹'+Number(p.price).toLocaleString('en-IN')+'</span>':'')
      +'</div><div style="font-size:11px;color:var(--muted);margin-top:4px">📅 '+(p.start_date||'—')+(p.notes?' · '+p.notes:'')+'</div>'
      +'</div></div>';
  }).join('')+'</div>':'<div style="color:var(--muted);font-size:13px">No pack history yet.</div>';
  var sessions=D.attendance.filter(function(a){return a.customer_id===cid&&a.status==='present';}).length;
  var bodyRecs=D.body.filter(function(b){return b.customer_id===cid;}).sort(function(a,b){return new Date(a.date)-new Date(b.date);});
  var wLost=(bodyRecs.length>=2)?(Number(bodyRecs[0].weight)-Number(bodyRecs[bodyRecs.length-1].weight)).toFixed(1):null;
  var daysW=joinDate?Math.floor((new Date()-new Date(joinDate))/86400000):null;
  var totalSpent=(allPacks.reduce(function(s,p){return s+Number(p.price||0);},0));
  document.getElementById('pack-journey-stats').innerHTML=[
    {lbl:'Total Packs',val:allPacks.length},
    {lbl:'Total Spent',val:totalSpent>0?'₹'+totalSpent.toLocaleString('en-IN'):'—'},
    {lbl:'Sessions',val:sessions},
    {lbl:'Days With Us',val:daysW!==null?daysW+' days':'—'},
    {lbl:'Weight Change',val:wLost!==null?(Number(wLost)>0?'+':'')+wLost+' kg':'—'},
    {lbl:'Body Scans',val:bodyRecs.length},
  ].map(function(s){return'<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--surface2);font-size:13px"><span style="color:var(--muted)">'+s.lbl+'</span><strong style="color:var(--primary)">'+s.val+'</strong></div>';}).join('')
  +'<div style="margin-top:14px;display:flex;gap:8px">'
  +'<button class="btn-p" style="flex:1;background:#8b5cf6;font-size:12px" onclick="openRenewForCustomer(\''+cid+'\')">🔄 Renew Pack</button>'
  +'<button class="btn-p" style="flex:1;background:#dc2626;font-size:12px" onclick="openRefundModal(\''+cid+'\')">↩ Refund / Cancel</button>'
  +'</div>';
}
function onRenewPayModeChange(){
  var mode=document.getElementById('renew-pay-mode').value;
  document.getElementById('renew-partial-row').style.display = mode==='partial'?'block':'none';
  document.getElementById('renew-none-row').style.display    = mode==='none'?'block':'none';
}
function onRenewPackTypeChange() {
  var pack = document.getElementById('renew-pack-type').value;
  if (pack === 'Star UMS 90 days') {
    var pr = document.getElementById('renew-price');
    if (pr) { pr.value = 15000; onRenewPriceChange(); }
  }
}
function onRenewPriceChange(){
  // reset paid-now if price changes
  var pn=document.getElementById('renew-paid-now'); if(pn) pn.value='';
}
function openRenewForCustomer(cid){
  var c=D.customers.find(function(x){return x.id===cid;}); if(!c) return;
  document.getElementById('renew-cust-id').value=c.id;
  document.getElementById('renew-type').value='customer';
  document.getElementById('renew-cust-name').textContent=c.name;
  document.getElementById('renew-prev-pack').textContent='Previous: '+(c.pack_type||'—')+' started '+(c.pack_start_date||'—');
  document.getElementById('renew-pack-type').value=c.pack_type||'';
  document.getElementById('renew-start-date').value=new Date().toISOString().split('T')[0];
  document.getElementById('renew-price').value=c.pack_price||'';
  openModal('renew-pack');
}
function openRenewForCoach(coachId){
  var c=D.coaches.find(function(x){return x.id===coachId;}); if(!c) return;
  document.getElementById('renew-cust-id').value=c.id;
  document.getElementById('renew-type').value='coach';
  document.getElementById('renew-cust-name').textContent=c.name+' (Coach)';
  document.getElementById('renew-prev-pack').textContent='Previous: '+(c.pack_type||'—')+' started '+(c.pack_start_date||'—');
  document.getElementById('renew-pack-type').value=c.pack_type||'';
  document.getElementById('renew-start-date').value=new Date().toISOString().split('T')[0];
  document.getElementById('renew-price').value=c.pack_price||'';
  openModal('renew-pack');
}
async function saveRenewal(){
  getCredentials();if(!getActiveSbUrl()||!getActiveSbKey()){showToast('Not connected','error');return;}
  var cid       = document.getElementById('renew-cust-id').value;
  var isCoach   = document.getElementById('renew-type').value === 'coach';
  var packType  = document.getElementById('renew-pack-type').value;
  var startDate = document.getElementById('renew-start-date').value;
  var price     = parseFloat(document.getElementById('renew-price').value)||null;
  var payMode   = document.getElementById('renew-pay-mode').value;
  var paidNow   = parseFloat(document.getElementById('renew-paid-now').value)||0;
  var dueDate   = document.getElementById('renew-due-date').value||document.getElementById('renew-due-date-none').value||null;
  var today     = new Date().toISOString().split('T')[0];
  var c         = isCoach ? D.coaches.find(function(x){return x.id===cid;}) : D.customers.find(function(x){return x.id===cid;});
  if(!packType||!startDate){showToast('Pack type and start date required','error');return;}
  var displayName = c ? c.name : (isCoach ? 'Coach' : 'Customer');
  try{
    // Archive old pack
    if(c&&c.pack_type&&c.pack_start_date){
      var archiveRow = {pack_type:c.pack_type,start_date:c.pack_start_date,price:c.pack_price||null,notes:'Archived on renewal',customer_name:displayName};
      if(isCoach) archiveRow.coach_id=cid; else archiveRow.customer_id=cid;
      await dbInsert('pack_history',archiveRow);
    }
    // Save new pack to history
    var histRow = {pack_type:packType,start_date:startDate,price:price,notes:'Renewal — '+payMode,customer_name:displayName};
    if(isCoach) histRow.coach_id=cid; else histRow.customer_id=cid;
    await dbInsert('pack_history',histRow);
    // Update record in the right table
    await dbUpdate(isCoach?'coaches':'customers',cid,{pack_type:packType,pack_start_date:startDate,pack_price:price});

    // ── Payment handling ──
    var finCategory = isCoach ? 'Coach pack payment' : 'Pack sale to customer';
    var _renewCenter = (c && c.wellness_center_id) || null;
    if(price){
      if(payMode==='full'){
        await dbInsert('finance',{type:'income',description:displayName+' — Pack renewal',amount:price,category:finCategory,date:today,wellness_center_id:_renewCenter});
        showToast('Pack renewed + ₹'+price.toLocaleString('en-IN')+' income recorded! 🎉');
      } else if(payMode==='partial'){
        if(paidNow>0) await dbInsert('finance',{type:'income',description:displayName+' — Partial renewal payment',amount:paidNow,category:finCategory,date:today,wellness_center_id:_renewCenter});
        await dbInsert('payments',{person_id:cid,person_name:displayName,total_amount:price,amount_paid:paidNow,payment_date:today,due_date:dueDate,description:packType,notes:'Renewal — balance due'});
        showToast('Pack renewed! Balance ₹'+(price-paidNow).toLocaleString('en-IN')+' due. 🎉');
      } else {
        await dbInsert('payments',{person_id:cid,person_name:displayName,total_amount:price,amount_paid:0,payment_date:today,due_date:dueDate,description:packType,notes:'Renewal — not yet paid'});
        showToast('Pack renewed! ₹'+price.toLocaleString('en-IN')+' payment pending. 🎉');
      }
      await loadPayments(); await loadFinance();
    } else {
      showToast('Pack renewed! 🎉');
    }

    closeModal('renew-pack');
    if(isCoach){ await loadCoaches(); } else { await loadCustomers(); }
    await loadPackHistory();renderOverview();

    if(c&&c.contact){
      var balMsg = payMode==='full' ? 'Payment received in full. ✅' : payMode==='partial' ? 'Partial payment received. Balance ₹'+(price-paidNow).toLocaleString('en-IN')+' due.' : 'Payment of ₹'+(price||0).toLocaleString('en-IN')+' pending.';
      var msg='🌿 *Pack Renewed!*\n\nHi *'+displayName+'*! 🎉\n\nYour *'+packType+'* starts *'+startDate+'*.\n'+balMsg+'\n\nThank you for continuing your wellness journey! 💪\n\n_Your '+getCenterName()+' Family_ 💚';
      var phone=c.contact.replace(/\D/g,'');if(phone.length===10)phone=COUNTRY_CODE+phone;
      setTimeout(function(){if(confirm('Send WhatsApp renewal confirmation to '+displayName+'?'))window.open('https://api.whatsapp.com/send?phone='+phone+'&text='+encodeURIComponent(msg),'_blank');},400);
    }
  }catch(e){showToast('Error: '+e.message,'error');}
}
// ── REFUND / CANCEL PACK ──
function openRefundModal(cid) {
  var c = D.customers.find(function(x){return x.id===cid;});
  if (!c) return;
  document.getElementById('refund-cust-id').value = c.id;
  document.getElementById('refund-cust-name').textContent = c.name;
  document.getElementById('refund-curr-pack').textContent = 'Pack: '+(c.pack_type||'None')+' · Started: '+(c.pack_start_date||'—')+(c.pack_price?' · ₹'+Number(c.pack_price).toLocaleString('en-IN'):'');
  document.getElementById('refund-amount').value = c.pack_price || '';
  document.getElementById('refund-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('refund-reason').value = '';
  document.getElementById('refund-clear-pack').checked = !!c.pack_type;
  openModal('refund-pack');
}
async function saveRefund() {
  getCredentials(); if (!getActiveSbUrl() || !getActiveSbKey()) { showToast('Not connected','error'); return; }
  var cid    = document.getElementById('refund-cust-id').value;
  var amount = parseFloat(document.getElementById('refund-amount').value) || 0;
  var date   = document.getElementById('refund-date').value;
  var method = document.getElementById('refund-method').value;
  var reason = document.getElementById('refund-reason').value.trim();
  var clearPack = document.getElementById('refund-clear-pack').checked;
  var c = D.customers.find(function(x){return x.id===cid;});
  if (!date)   { showToast('Date is required','error'); return; }
  if (!reason) { showToast('Reason is required','error'); return; }
  if (clearPack && !confirm('Clear the pack for '+(c?c.name:'this customer')+'? This removes their current pack record.')) return;
  try {
    if (amount > 0) {
      await dbInsert('finance', {
        type:'expense', category:'Refund',
        description: (c?c.name:'Customer')+' — Refund via '+method+' — '+reason,
        amount: amount, date: date,
        wellness_center_id: (c&&c.wellness_center_id)||null
      });
    }
    var pending = (D.payments||[]).find(function(p){
      return p.person_id===cid && Math.max(0,Number(p.total_amount)-Number(p.amount_paid))>0;
    });
    if (pending) {
      await dbUpdate('payments', pending.id, {
        amount_paid: pending.total_amount,
        notes: (pending.notes||'')+' — Refunded '+date
      });
    }
    if (clearPack) {
      await dbUpdate('customers', cid, {pack_type:null, pack_start_date:null, pack_price:null});
    }
    auditLog('Refund','Customer',(c?c.name:'')+(amount>0?' — ₹'+amount+' refunded':'')+' — '+reason);
    showToast('Refund recorded'+(clearPack?' & pack cleared':'')+'! ₹'+amount.toLocaleString('en-IN')+' logged as expense.','success');
    closeModal('refund-pack');
    await loadFinance(); await loadCustomers();
    if (pending) await loadPayments();
    renderOverview();
  } catch(e) { showToast('Error: '+e.message,'error'); }
}

function sendLoyaltyWA(cid){
  var c=D.customers.find(function(x){return x.id===cid;}); if(!c||!c.contact) return;
  var joinDate=c.join_date||c.pack_start_date;
  var tier=getLoyaltyTier(joinDate);
  var months=tier?tier.months:0;
  var msg='🌿 *Thank You from '+getCenterName()+'!*\n\nDear *'+c.name+'*, 🙏\n\n';
  if(months>=12) msg+='It\'s been *'+Math.floor(months/12)+' year'+(Math.floor(months/12)>1?'s':'')+' together*! 🎊\n\nYou are family. Thank you for trusting us with your wellness journey. Here\'s to many more years! 💎';
  else if(months>=6) msg+='Six months of amazing progress! 🏆\n\nYour commitment is inspiring. Thank you for being our Gold Member! 🌟';
  else if(months>=3) msg+='Three months strong! 🌟\n\nYour consistency is amazing. Thank you for being such a wonderful member! 💪';
  else msg+='Welcome to your first month! 🌱\n\nYou took the most important step. We\'re with you every step! 💚';
  msg+='\n\n_Your '+getCenterName()+' Family_ 🌿';
  var phone=c.contact.replace(/\D/g,'');if(phone.length===10)phone=COUNTRY_CODE+phone;
  window.open('https://api.whatsapp.com/send?phone='+phone+'&text='+encodeURIComponent(msg),'_blank');
}
async function loadPackHistory(){
  getCredentials();if(!getActiveSbUrl()||!getActiveSbKey())return;
  try{var r=await dbGet('pack_history','start_date', _custIdsFilter());D.packHistory=Array.isArray(r)?r:[];}
  catch(e){D.packHistory=[];}
}

// ══════════════════════════════════════════════
// RENDER CUSTOMERS (updated with new buttons)
// ══════════════════════════════════════════════
var _origRenderCustomers = typeof renderCustomers === 'function' ? renderCustomers : null;

// ══════════════════════════════════════════════
// ORG TREE
// ══════════════════════════════════════════════
function updateCoachUplineSelects(excludeId){
  excludeId = excludeId || '';
  var ownerName = (JSON.parse(localStorage.getItem('ownerProfile')||'{}')).name || 'You (Root)';
  var opts='<option value="">'+ownerName+' (Root — You)</option>'+D.coaches
    .filter(function(c){ return !excludeId || c.id !== excludeId; })
    .map(function(c){
      var pin = c.herbalife_pin ? ' · '+c.herbalife_pin : '';
      return '<option value="'+c.id+'">'+c.name+pin+'</option>';
    }).join('');
  var sel=document.getElementById('coach-upline-sel');
  if(sel){ var prev=sel.value; sel.innerHTML=opts; if(prev) sel.value=prev; }
}
// ══════════════════════════════════════════════
// 🏅 PIN TRACKER
// ══════════════════════════════════════════════
function initPinTracker() {
  var sel = document.getElementById('pin-month'); if(!sel) return;
  var now = new Date();
  sel.innerHTML = '';
  for(var i=0; i<6; i++) {
    var d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    var val = d.toISOString().substring(0,7);
    var label = d.toLocaleString('en-IN',{month:'long',year:'numeric'});
    sel.innerHTML += '<option value="'+val+'"'+(i===0?' selected':'')+'>'+label+'</option>';
  }
  // Set target from profile
  var target = document.getElementById('pin-target');
  if(OWNER_PROFILE && OWNER_PROFILE.next_pin && target) {
    for(var j=0;j<target.options.length;j++) {
      if(target.options[j].value === OWNER_PROFILE.next_pin) { target.value = OWNER_PROFILE.next_pin; break; }
    }
  }
  renderPinTracker();
}

function renderPinTracker() {
  var container = document.getElementById('pin-tracker-content'); if(!container) return;
  var month = (document.getElementById('pin-month')||{}).value || new Date().toISOString().substring(0,7);
  var targetPin = (document.getElementById('pin-target')||{}).value || '2500 GET Team';
  var req = PIN_REQUIREMENTS[targetPin];
  if(!req) { container.innerHTML = '<div class="empty">Unknown pin target</div>'; return; }

  var personalVP = getPersonalVP(month);
  var orgVP = getOrgVP(month);
  var totalVP = personalVP + orgVP;
  var firstLine = getFirstLineStatus();

  // Count first-line with required pin level
  var reqPinLevel = req.firstLine[0] || 'GET Team';
  var pinIndex = HERBALIFE_PINS.indexOf(reqPinLevel);
  var qualifiedFL = firstLine.filter(function(f) {
    var fIdx = HERBALIFE_PINS.indexOf(f.pin);
    return fIdx >= pinIndex;
  });

  // Count active associates (for Millionaire Team)
  var activeAssociates = firstLine.filter(function(f) { return f.active; }).length;

  // Progress percentages
  var pVPPct = Math.min(100, Math.round((personalVP / req.personalVP) * 100));
  var oVPPct = Math.min(100, Math.round((orgVP / req.orgVP) * 100));
  var flPct = req.firstLineCount > 0 ? Math.min(100, Math.round((qualifiedFL.length / req.firstLineCount) * 100)) : 100;

  // Gaps
  var pGap = Math.max(0, req.personalVP - personalVP);
  var oGap = Math.max(0, req.orgVP - orgVP);
  var flGap = Math.max(0, req.firstLineCount - qualifiedFL.length);

  // How many more customers needed
  var avgVP = 48; // Standard 26-day pack
  var pCustsNeeded = pGap > 0 ? Math.ceil(pGap / avgVP) : 0;
  var oCustsNeeded = oGap > 0 ? Math.ceil(oGap / avgVP) : 0;

  var html = '';

  // ── Overall Status ──
  var allMet = pGap===0 && oGap===0 && flGap===0 && (!req.associates || activeAssociates >= req.associates);
  html += '<div class="pin-card" style="border-left:4px solid '+(allMet?'var(--success)':'var(--accent)')+'"><h3>'+(allMet?'🎉':'🎯')+' '+targetPin+'</h3>';
  if(allMet) html += '<div style="font-size:15px;color:var(--success);font-weight:700">Congratulations! You qualify for '+targetPin+'! 🏆</div>';
  else html += '<div style="font-size:13px;color:var(--muted)">Track your progress toward '+targetPin+' qualification</div>';
  html += '</div>';

  // ── Personal VP ──
  html += '<div class="pin-card"><h3>💪 Personal Volume Points</h3>';
  html += '<div class="pin-metric"><span class="pin-metric-label">Your Center VP</span><span class="pin-metric-val" style="color:'+(pGap===0?'var(--success)':'var(--primary)')+'">'+personalVP.toLocaleString('en-IN')+'</span></div>';
  html += '<div class="pin-metric"><span class="pin-metric-label">Required</span><span style="font-size:14px;color:var(--muted)">'+req.personalVP.toLocaleString('en-IN')+' VP</span></div>';
  html += '<div class="pin-progress"><div class="pin-fill" style="width:'+pVPPct+'%;background:'+(pVPPct>=100?'var(--success)':pVPPct>=60?'var(--accent)':'var(--danger)')+'"><span class="pin-fill-label">'+pVPPct+'%</span></div></div>';
  if(pGap > 0) html += '<div class="pin-gap">📌 Need <strong>'+pGap.toLocaleString('en-IN')+' more VP</strong> — that\'s about <strong>'+pCustsNeeded+' more Standard pack customers</strong> from your center this month.</div>';
  else html += '<div class="pin-action">✅ Personal VP target met!</div>';
  html += '</div>';

  // ── Organizational VP ──
  html += '<div class="pin-card"><h3>🌐 Organizational Volume Points</h3>';
  html += '<div class="pin-metric"><span class="pin-metric-label">Downline VP</span><span class="pin-metric-val" style="color:'+(oGap===0?'var(--success)':'var(--primary)')+'">'+orgVP.toLocaleString('en-IN')+'</span></div>';
  html += '<div class="pin-metric"><span class="pin-metric-label">Required</span><span style="font-size:14px;color:var(--muted)">'+req.orgVP.toLocaleString('en-IN')+' VP</span></div>';
  html += '<div class="pin-progress"><div class="pin-fill" style="width:'+oVPPct+'%;background:'+(oVPPct>=100?'var(--success)':oVPPct>=30?'var(--accent)':'var(--danger)')+'"><span class="pin-fill-label">'+oVPPct+'%</span></div></div>';
  if(oGap > 0) {
    html += '<div class="pin-gap">📌 Need <strong>'+oGap.toLocaleString('en-IN')+' more VP</strong> from downline centers — about <strong>'+oCustsNeeded+' more pack sales</strong> across your organization.</div>';
  } else {
    html += '<div class="pin-action">✅ Organizational VP target met!</div>';
  }
  html += '</div>';

  // ── First Line Status ──
  html += '<div class="pin-card"><h3>👥 First Line — '+reqPinLevel+' Pins Required: '+req.firstLineCount+'</h3>';
  html += '<div class="pin-metric"><span class="pin-metric-label">Qualified</span><span class="pin-metric-val" style="color:'+(flGap===0?'var(--success)':'var(--danger)')+'">'+qualifiedFL.length+' / '+req.firstLineCount+'</span></div>';
  html += '<div class="pin-progress"><div class="pin-fill" style="width:'+flPct+'%;background:'+(flPct>=100?'var(--success)':'var(--danger)')+'"><span class="pin-fill-label">'+flPct+'%</span></div></div>';
  if(firstLine.length) {
    html += '<div style="margin-top:12px">';
    firstLine.forEach(function(f) {
      var fIdx = HERBALIFE_PINS.indexOf(f.pin);
      var qualified = fIdx >= pinIndex;
      html += '<div class="pin-fl-row">'
        +'<span style="font-size:18px">'+(qualified?'✅':'⏳')+'</span>'
        +'<div style="flex:1"><strong>'+f.name+'</strong>'+(f.center?' — '+f.center:'')
        +'<div style="font-size:11px;color:var(--muted)">PIN: <span class="badge '+(qualified?'bg':'by')+'">'+f.pin+'</span>'
        +(f.vp?' &nbsp; VP this month: <strong>'+f.vp+'</strong>':'')+'</div>'
        +'</div></div>';
    });
    html += '</div>';
  } else {
    html += '<div style="color:var(--muted);font-size:13px;margin-top:8px">No coaches found. Add coaches in the Coaches tab.</div>';
  }
  if(flGap > 0) html += '<div class="pin-gap">📌 Need <strong>'+flGap+' more first-line '+reqPinLevel+'</strong> pin holder'+(flGap>1?'s':'')+'. Focus on helping your closest coaches qualify!</div>';
  html += '</div>';

  // ── Active Associates (for Millionaire+) ──
  if(req.associates > 0) {
    var assocGap = Math.max(0, req.associates - activeAssociates);
    var assocPct = Math.min(100, Math.round((activeAssociates / req.associates) * 100));
    html += '<div class="pin-card"><h3>🤝 Active Associates Required: '+req.associates+'</h3>';
    html += '<div class="pin-metric"><span class="pin-metric-label">Active</span><span class="pin-metric-val" style="color:'+(assocGap===0?'var(--success)':'var(--danger)')+'">'+activeAssociates+' / '+req.associates+'</span></div>';
    html += '<div class="pin-progress"><div class="pin-fill" style="width:'+assocPct+'%;background:'+(assocPct>=100?'var(--success)':'var(--danger)')+'"><span class="pin-fill-label">'+assocPct+'%</span></div></div>';
    if(assocGap > 0) html += '<div class="pin-gap">📌 Need <strong>'+assocGap+' more active associate'+(assocGap>1?'s':'')+'</strong> generating personal volume.</div>';
    html += '</div>';
  }

  // ── Downline Center Performance ──
  html += '<div class="pin-card"><h3>📊 Center-wise VP Breakdown ('+month+')</h3>';
  var centerVPs = D.centers.map(function(c) {
    return { name:c.name, type:c.type, vp: calcMonthlyVP(month, c.id), id:c.id };
  }).sort(function(a,b){return b.vp-a.vp;});
  var maxCVP = Math.max.apply(null, centerVPs.map(function(c){return c.vp;}))||1;
  if(centerVPs.length) {
    centerVPs.forEach(function(c) {
      var barW = Math.round((c.vp/maxCVP)*100);
      html += '<div class="pin-center-row">'
        +'<div style="flex:1;min-width:0"><strong style="font-size:13px">'+c.name+'</strong> <span class="badge '+(c.type==='main'?'bg':'by')+'" style="font-size:9px">'+c.type+'</span>'
        +'<div class="pin-progress" style="height:12px;margin-top:4px"><div class="pin-fill" style="width:'+barW+'%;background:'+(c.type==='main'?'var(--primary)':'var(--accent)')+'"></div></div></div>'
        +'<span style="font-family:DM Serif Display,serif;font-size:18px;color:var(--primary);min-width:60px;text-align:right">'+c.vp+'</span>'
        +'</div>';
    });
  }
  html += '</div>';

  // ── Action Plan ──
  if(!allMet) {
    html += '<div class="pin-card" style="border-left:4px solid var(--primary)"><h3>🚀 Action Plan for '+targetPin+'</h3><div class="pin-action" style="background:none;border:none;padding:0">';
    var actions = [];
    if(pGap > 0) actions.push('📍 <strong>Your center</strong>: Add '+pCustsNeeded+' more customers with Standard/Premium packs to hit '+req.personalVP.toLocaleString('en-IN')+' personal VP');
    if(oGap > 0) {
      var perCenter = D.centers.length > 1 ? Math.ceil(oCustsNeeded / (D.centers.length - 1)) : oCustsNeeded;
      actions.push('📍 <strong>Downline</strong>: Each center needs ~'+perCenter+' more pack sales to collectively close the '+oGap.toLocaleString('en-IN')+' VP gap');
    }
    if(flGap > 0) actions.push('📍 <strong>Coach development</strong>: Help '+flGap+' first-line coach'+(flGap>1?'es':'')+' reach '+reqPinLevel+' — review their VP and customer pipeline');
    if(req.associates > 0 && activeAssociates < req.associates) actions.push('📍 <strong>Associates</strong>: Recruit '+(req.associates-activeAssociates)+' more active associates generating personal volume');
    actions.push('📍 <strong>Retention</strong>: Focus on pack renewals — a renewed customer = VP without new acquisition cost');
    html += actions.join('<br style="margin-bottom:8px">');
    html += '</div></div>';
  }

  container.innerHTML = html;
}

// ══════════════════════════════════════════════
// 📊 BUSINESS ANALYST
// ══════════════════════════════════════════════
function initBizAnalyst() {
  var sel = document.getElementById('biz-month'); if(!sel) return;
  if (isCenterSession() && !isGrowthPlan()) {
    var el = document.getElementById('biz-org-summary');
    if (el) el.innerHTML = planLockHtml('Business Analyst', 'Get AI-powered analysis of every coach\'s business performance and multi-center reports.');
    return;
  }
  var now = new Date();
  sel.innerHTML = '';
  for(var i=0;i<6;i++){
    var d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    var val = d.toISOString().substring(0,7);
    sel.innerHTML += '<option value="'+val+'"'+(i===0?' selected':'')+'>'+d.toLocaleString('en-IN',{month:'long',year:'numeric'})+'</option>';
  }
  renderBizAnalyst();
}

function renderBizAnalyst() {
  var month = (document.getElementById('biz-month')||{}).value || new Date().toISOString().substring(0,7);
  var todayStr = new Date().toISOString().split('T')[0];

  // ── Org Summary — scoped to active center ──
  var _bizCusts = filterByCenter(D.customers);
  var _bizCustIds = _bizCusts.map(function(c){return c.id;});
  var totalPersonalVP = getPersonalVP(month);
  var totalOrgVP = getOrgVP(month);
  var totalVP = totalPersonalVP + totalOrgVP;
  var allActiveCusts = _bizCusts.filter(function(c){ return getDaysLeft(c).active; }).length;
  var allInactive = _bizCusts.filter(function(c){ return isInactive(c.id); }).length;
  var monthRenewals = (D.packHistory||[]).filter(function(h){ return h.start_date&&h.start_date.startsWith(month)&&(!ACTIVE_CENTER||_bizCustIds.indexOf(h.customer_id)>-1); }).length;

  document.getElementById('biz-org-summary').innerHTML =
    '<div class="stats" style="margin-bottom:0">' +
    '<div class="stat"><div class="stat-ic">⚡</div><div class="stat-l">Total Org VP ('+month+')</div><div class="stat-v" style="color:var(--primary)">'+totalVP.toLocaleString('en-IN')+'</div></div>' +
    '<div class="stat"><div class="stat-ic">🏠</div><div class="stat-l">Your Center VP</div><div class="stat-v">'+totalPersonalVP+'</div></div>' +
    '<div class="stat"><div class="stat-ic">🌐</div><div class="stat-l">Downline VP</div><div class="stat-v">'+totalOrgVP+'</div></div>' +
    '<div class="stat"><div class="stat-ic">✅</div><div class="stat-l">Active Customers</div><div class="stat-v" style="color:var(--success)">'+allActiveCusts+'</div></div>' +
    '<div class="stat"><div class="stat-ic">😴</div><div class="stat-l">Inactive (7d+)</div><div class="stat-v" style="color:'+(allInactive?'var(--danger)':'var(--success)')+'">'+allInactive+'</div></div>' +
    '<div class="stat"><div class="stat-ic">🔄</div><div class="stat-l">Renewals This Month</div><div class="stat-v" style="color:var(--success)">'+monthRenewals+'</div></div>' +
    '</div>';

  // ── Per-coach cards — scoped to active center ──
  var coachData = D.coaches.filter(function(coach){
    if(!ACTIVE_CENTER) return true;
    var center = D.centers.find(function(c){ return c.owner_id===coach.id; });
    return center && center.id === ACTIVE_CENTER;
  }).map(function(coach) {
    var center = D.centers.find(function(c){ return c.owner_id===coach.id; });
    var cid = center ? center.id : null;
    var custs = D.customers.filter(function(c){ return c.wellness_center_id===cid; });
    var activeCusts = custs.filter(function(c){ return getDaysLeft(c).active; }).length;
    var inactiveCusts = custs.filter(function(c){ return isInactive(c.id); }).length;
    var expiring = custs.filter(function(c){ var st=getDaysLeft(c); return st.active&&st.days<=5; }).length;
    var vp = calcMonthlyVP(month, cid);
    var custIds = custs.map(function(c){return c.id;});
    var monthAtt = D.attendance.filter(function(a){
      return a.date && a.date.startsWith(month) && a.status==='present' && custIds.indexOf(a.customer_id)>-1;
    }).length;
    var renewals = (D.packHistory||[]).filter(function(h){
      return h.start_date&&h.start_date.startsWith(month)&&custIds.indexOf(h.customer_id)>-1;
    }).length;
    // Score: VP(40%) + active%(30%) + renewals(20%) + low-inactive(10%)
    var activeRate = custs.length ? activeCusts/custs.length : 0;
    var inactiveRate = custs.length ? inactiveCusts/custs.length : 0;
    var score = Math.round((Math.min(vp/100,40)) + (activeRate*30) + (Math.min(renewals*5,20)) + ((1-inactiveRate)*10));
    return { coach:coach, center:center, custs:custs.length, activeCusts:activeCusts, inactiveCusts:inactiveCusts, expiring:expiring, vp:vp, monthAtt:monthAtt, renewals:renewals, score:score };
  }).sort(function(a,b){ return b.score-a.score; });

  // ── Coach Leaderboard table (merged from Coach Performance) ──
  var lbEl = document.getElementById('biz-leaderboard');
  if(lbEl) {
    if(!coachData.length) {
      lbEl.innerHTML = '<div class="empty"><p>No coaches found.</p></div>';
    } else {
      var maxRev = 0;
      var lbRowData = coachData.map(function(d, i) {
        var coach = d.coach;
        var custs = D.customers.filter(function(c){ return c.referred_by===coach.id||c.coach_id===coach.id; });
        var newThis = custs.filter(function(c){ return (c.created_at||'').startsWith(month)||(c.join_date||'').startsWith(month); }).length;
        var custIds = custs.map(function(c){return c.id;});
        var monthAttCt = D.attendance.filter(function(a){ return a.date&&a.date.startsWith(month)&&a.status==='present'&&custIds.indexOf(a.customer_id)!==-1; });
        var uniqueAtt = monthAttCt.reduce(function(s,a){if(s.indexOf(a.customer_id)===-1)s.push(a.customer_id);return s;},[]).length;
        var attRate = custs.length ? Math.round((uniqueAtt/custs.length)*100) : 0;
        var leads = (D.leads||[]).filter(function(l){return l.coach_id===coach.id;}).length;
        // Revenue: finance income from coach's center this month
        var centerRev = d.center ? D.finance.filter(function(f){ return f.type==='income' && f.wellness_center_id===d.center.id && (f.date||'').startsWith(month); }).reduce(function(s,f){return s+Number(f.amount);},0) : 0;
        if (centerRev > maxRev) maxRev = centerRev;
        var medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
        return { coach:coach, center:d.center, custs:custs, newThis:newThis, attRate:attRate, leads:leads, centerRev:centerRev, medal:medal };
      });
      var lbRows = lbRowData.map(function(d) {
        var revBarW = maxRev > 0 ? Math.round(d.centerRev/maxRev*100) : 0;
        return '<div class="cp-row" style="grid-template-columns:2fr 1fr 1fr 1.5fr 1fr 1.2fr">'+
          '<span style="font-weight:700">'+d.medal+' '+d.coach.name+'<div style="font-size:11px;font-weight:400;color:var(--muted)">'+(d.center?d.center.name:'No center')+'</div></span>'+
          '<span style="font-weight:700">'+d.custs.length+'</span>'+
          '<span style="color:var(--success);font-weight:700">+'+d.newThis+'</span>'+
          '<div><span style="font-weight:700">'+d.attRate+'%</span><div class="cp-bar-wrap"><div class="cp-bar" style="width:'+d.attRate+'%"></div></div></div>'+
          '<span>'+d.leads+'</span>'+
          '<div><span style="font-weight:700;color:var(--success);font-size:12px">₹'+d.centerRev.toLocaleString('en-IN')+'</span><div class="cp-bar-wrap"><div class="cp-bar" style="width:'+revBarW+'%;background:#16a34a"></div></div></div>'+
        '</div>';
      });
      lbEl.innerHTML = lbRows.join('');
    }
  }

  if(!coachData.length) {
    document.getElementById('biz-content').innerHTML = '<div class="tcard" style="padding:32px;text-align:center"><div style="font-size:40px">📊</div><p style="color:var(--muted);margin-top:8px">No coaches added yet. Add coaches in the Coaches section to see business analysis here.</p></div>';
    return;
  }

  var html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px">';
  coachData.forEach(function(d, idx) {
    var coach = d.coach;
    var rank = idx+1;
    var rankColor = rank===1?'var(--accent)':rank===2?'#aaa':rank===3?'#cd7f32':'var(--muted)';
    var rankIcon = rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':'#'+rank;
    var scoreColor = d.score>=70?'var(--success)':d.score>=40?'var(--accent)':'var(--danger)';
    var health = d.score>=70?'Healthy':d.score>=40?'Needs Attention':'At Risk';
    var healthColor = d.score>=70?'bg':d.score>=40?'by':'br';
    var phone = (coach.contact||'').replace(/\D/g,''); if(phone.length===10) phone=COUNTRY_CODE+phone;
    var waMsg = encodeURIComponent('Hi '+coach.name+'! Checking in on your center\'s progress for '+month+'. VP: '+d.vp+', Active customers: '+d.activeCusts+'. Let\'s connect! 💪');
    html += '<div class="tcard" style="padding:18px;border-top:3px solid '+rankColor+'">'
      +'<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">'
      +'<div>'
      +'<div style="font-size:13px;color:var(--muted);margin-bottom:2px">'+rankIcon+' Rank #'+rank+'</div>'
      +'<div style="font-weight:700;font-size:16px">'+coach.name+'</div>'
      +'<div style="font-size:11px;color:var(--muted);margin-top:2px">'+(d.center?d.center.name:'No center linked')+' &nbsp;·&nbsp; <span style="color:var(--primary)">'+(coach.herbalife_pin||'Associate')+'</span></div>'
      +'</div>'
      +'<div style="text-align:right">'
      +'<div style="font-family:DM Serif Display,serif;font-size:26px;color:'+scoreColor+'">'+d.score+'</div>'
      +'<div style="font-size:10px;color:var(--muted)">score</div>'
      +'<span class="badge '+healthColor+'" style="font-size:9px;margin-top:4px">'+health+'</span>'
      +'</div>'
      +'</div>'
      +(function(){
          var rev = d.center ? D.finance.filter(function(f){ return f.type==='income' && f.wellness_center_id===d.center.id && (f.date||'').startsWith(month); }).reduce(function(s,f){return s+Number(f.amount);},0) : 0;
          var exp = d.center ? D.finance.filter(function(f){ return f.type==='expense' && f.wellness_center_id===d.center.id && (f.date||'').startsWith(month); }).reduce(function(s,f){return s+Number(f.amount);},0) : 0;
          var net = rev - exp;
          return '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;margin-bottom:12px;text-align:center">'
            +'<div style="background:var(--surface2);border-radius:8px;padding:8px 4px"><div style="font-size:16px;font-weight:700;color:var(--primary)">'+d.vp+'</div><div style="font-size:10px;color:var(--muted)">VP</div></div>'
            +'<div style="background:var(--surface2);border-radius:8px;padding:8px 4px"><div style="font-size:16px;font-weight:700;color:var(--success)">'+d.activeCusts+'</div><div style="font-size:10px;color:var(--muted)">active</div></div>'
            +'<div style="background:var(--surface2);border-radius:8px;padding:8px 4px"><div style="font-size:16px;font-weight:700;color:'+(d.inactiveCusts?'var(--danger)':'var(--success)')+'">'+d.inactiveCusts+'</div><div style="font-size:10px;color:var(--muted)">inactive</div></div>'
            +'<div style="background:'+(net>=0?'#f0fdf4':'#fef2f2')+';border-radius:8px;padding:8px 4px"><div style="font-size:13px;font-weight:700;color:'+(net>=0?'#16a34a':'#e74c3c')+'">₹'+Math.round(rev).toLocaleString('en-IN')+'</div><div style="font-size:10px;color:var(--muted)">revenue</div></div>'
            +'</div>';
        })()

      +'<div style="font-size:12px;color:var(--muted);margin-bottom:10px;display:flex;gap:12px">'
      +'<span>👥 '+d.custs+' total customers</span>'
      +'<span>📋 '+d.monthAtt+' check-ins</span>'
      +'<span>🔄 '+d.renewals+' renewals</span>'
      +(d.expiring?'<span style="color:var(--danger)">⏰ '+d.expiring+' expiring</span>':'')
      +'</div>'
      // Insights
      +(d.inactiveCusts>3?'<div style="font-size:11px;background:var(--danger-light);color:var(--danger);border-radius:6px;padding:5px 8px;margin-bottom:6px">⚠️ '+d.inactiveCusts+' inactive customers — follow up needed</div>':'')
      +(d.expiring>2?'<div style="font-size:11px;background:#fff3cd;color:#856404;border-radius:6px;padding:5px 8px;margin-bottom:6px">⏰ '+d.expiring+' packs expiring in 5 days — renewal push!</div>':'')
      +(d.vp===0?'<div style="font-size:11px;background:var(--danger-light);color:var(--danger);border-radius:6px;padding:5px 8px;margin-bottom:6px">📌 No VP recorded — add customers or pack renewals</div>':'')
      +(d.renewals===0&&d.activeCusts>3?'<div style="font-size:11px;background:#fff3cd;color:#856404;border-radius:6px;padding:5px 8px;margin-bottom:6px">💡 0 renewals this month — push for pack renewals</div>':'')
      +(d.score>=70?'<div style="font-size:11px;background:#d4edda;color:#155724;border-radius:6px;padding:5px 8px;margin-bottom:6px">✅ Business is healthy this month!</div>':'')
      +'<div style="display:flex;justify-content:flex-end;gap:6px;margin-top:4px">'
      +(phone?'<button class="wa-btn" style="font-size:11px;padding:4px 10px" onclick="window.open(\'https://api.whatsapp.com/send?phone='+phone+'&text='+waMsg+'\',\'_blank\')">💬 WhatsApp</button>':'')
      +'</div>'
      +'</div>';
  });
  html += '</div>';
  document.getElementById('biz-content').innerHTML = html;
}

var _bizAiInFlight = false;
async function generateBizAIReport() {
  if (isCenterSession() && !isElitePlan()) { showToast('AI Business Analyst report is an Elite plan feature (₹999/mo). Upgrade to unlock. 🙏', 'error'); return; }
  if(_bizAiInFlight) return;
  if(!getGroqKey()) { showToast('Add your Groq API key in SQL/Config to use AI Report','error'); return; }
  var month = (document.getElementById('biz-month')||{}).value || new Date().toISOString().substring(0,7);
  _bizAiInFlight = true;
  var btn = document.querySelector('[onclick="generateBizAIReport()"]');
  if(btn) btn.textContent = '⏳ Generating...';
  var resultEl = document.getElementById('biz-ai-result');
  resultEl.style.display = 'block';
  resultEl.innerHTML = '<div style="color:var(--muted);font-size:13px">Analysing your business data...</div>';

  // Build context for AI
  var totalVP = getPersonalVP(month) + getOrgVP(month);
  var activeCusts = D.customers.filter(function(c){ return getDaysLeft(c).active; }).length;
  var inactiveCusts = D.customers.filter(function(c){ return isInactive(c.id); }).length;
  var renewals = (D.packHistory||[]).filter(function(h){ return h.start_date&&h.start_date.startsWith(month); }).length;
  var monthAtt = D.attendance.filter(function(a){ return a.date&&a.date.startsWith(month)&&a.status==='present'; }).length;
  var coachCount = D.coaches.length;
  var centerCount = D.centers.length;
  var coachLines = D.coaches.map(function(c){
    var center = D.centers.find(function(ct){ return ct.owner_id===c.id; });
    var cid = center?center.id:null;
    var vp = calcMonthlyVP(month, cid);
    var custs = D.customers.filter(function(cu){ return cu.wellness_center_id===cid; });
    return c.name+' ('+( c.herbalife_pin||'Associate')+', VP:'+vp+', customers:'+custs.length+')';
  }).join('; ');

  var prompt = 'You are a wellness business coach analysing a wellness center supervisor\'s monthly performance for '+month+'. Here is their data:\n\n'
    +'- Total org VP: '+totalVP+'\n'
    +'- Active customers: '+activeCusts+'\n'
    +'- Inactive customers (7+ days absent): '+inactiveCusts+'\n'
    +'- Pack renewals this month: '+renewals+'\n'
    +'- Total attendance check-ins this month: '+monthAtt+'\n'
    +'- Coaches in network: '+coachCount+'\n'
    +'- Downline centers: '+centerCount+'\n'
    +'- Coach breakdown: '+coachLines+'\n\n'
    +'Give a 150-word business analysis covering: 1) Overall health of the business, 2) Top 2 strengths, 3) Top 2 urgent issues to fix, 4) One specific action to take this week to grow VP. Be direct, practical, and encouraging. Use Indian business context.';

  try {
    var text = await callGroq(null, prompt, { maxTokens: 300 });
    resultEl.innerHTML = '<div style="font-weight:600;margin-bottom:8px;font-size:14px">✨ AI Business Report — '+month+'</div><div style="font-size:13px;line-height:1.8">'+text.replace(/\n/g,'<br>')+'</div>';
  } catch(e) {
    resultEl.innerHTML = '<div style="color:var(--danger)">Error: '+e.message+'</div>';
    showToast('Business AI error: ' + e.message, 'error');
  } finally {
    _bizAiInFlight = false;
    if(btn) btn.textContent = '✨ AI Report';
  }
}

// ══════════════════════════════════════════════
// PLAN MANAGEMENT (supervisor only)
// ══════════════════════════════════════════════
var PLAN_LABELS = { free:'Free', growth:'Growth ₹499', elite:'Elite ₹999', president:"Founder's Deal ₹499" };
var PLAN_COLORS = { free:'#6b7280', growth:'#7c3aed', elite:'#b45309', president:'#0f766e' };

function renderPlanMgmt() {
  var tb = document.getElementById('planmgmt-body'); if (!tb) return;
  var centers = (D.centers||[]).slice().sort(function(a,b){ return (a.name||'').localeCompare(b.name||''); });
  if (!centers.length) { tb.innerHTML='<tr><td colspan="6"><div class="empty"><div class="ei">💎</div><p>No centers found.</p></div></td></tr>'; return; }
  var today = Date.now();
  var growthCount = centers.filter(function(c){ return c.plan_type==='growth'||c.plan_type==='elite'||c.plan_type==='president'; }).length;
  var statsEl = document.getElementById('planmgmt-stats');
  if (statsEl) statsEl.innerHTML =
    '<div class="stat"><div class="stat-l">Total Centers</div><div class="stat-v">'+centers.length+'</div></div>'+
    '<div class="stat"><div class="stat-l">Free</div><div class="stat-v">'+(centers.length-growthCount)+'</div></div>'+
    '<div class="stat"><div class="stat-l">Paid</div><div class="stat-v" style="color:#7c3aed">'+growthCount+'</div></div>';
  tb.innerHTML = centers.map(function(c) {
    var plan = c.plan_type || 'free';
    var days = c.created_at ? Math.floor((today - new Date(c.created_at).getTime()) / 86400000) : '—';
    var color = PLAN_COLORS[plan] || '#6b7280';
    var opts = Object.keys(PLAN_LABELS).map(function(k){
      return '<option value="'+k+'"'+(k===plan?' selected':'')+'>'+PLAN_LABELS[k]+'</option>';
    }).join('');
    return '<tr>'
      +'<td><strong>'+c.name+'</strong></td>'
      +'<td style="font-size:12px;color:var(--muted)">'+(c.owner_name||c.owner_email||'—')+'</td>'
      +'<td>'+days+' days</td>'
      +'<td><span style="font-weight:700;color:'+color+'">'+PLAN_LABELS[plan]+'</span></td>'
      +'<td><select id="plan-sel-'+c.id+'" style="padding:5px 8px;border:1.5px solid var(--border);border-radius:6px;font-family:inherit;font-size:12px">'+opts+'</select></td>'
      +'<td><button class="btn-p" style="font-size:11px;padding:4px 12px" onclick="saveCenterPlan(\''+c.id+'\')">Save</button></td>'
      +'</tr>';
  }).join('');
}

async function saveCenterPlan(centerId) {
  var sel = document.getElementById('plan-sel-'+centerId); if (!sel) return;
  var newPlan = sel.value;
  var center = (D.centers||[]).find(function(c){ return c.id===centerId; });
  if (!center) return;
  try {
    var res = await fetch(CENTER_SB_URL + '/rest/v1/wellness_centers?id=eq.' + centerId, {
      method: 'PATCH',
      headers: {
        'apikey': CENTER_SB_KEY,
        'Authorization': 'Bearer ' + (_authSession && _authSession.access_token ? _authSession.access_token : CENTER_SB_KEY),
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ plan_type: newPlan })
    });
    if (!res.ok) { var err = await res.json(); throw new Error(err.message || 'HTTP ' + res.status); }
    center.plan_type = newPlan;
    showToast((center.name||'Center')+' upgraded to '+PLAN_LABELS[newPlan]+'!', 'success');
    renderPlanMgmt();
  } catch(e) {
    showToast('Failed to update plan: '+(e&&e.message?e.message:String(e)), 'error');
  }
}

function renderOrgTree(){
  var container=document.getElementById('orgtree-container');if(!container)return;
  var centers=D.centers||[];
  var roots=centers.filter(function(c){return!c.upline_center_id;});
  var downlines=centers.filter(function(c){return!!c.upline_center_id;});
  var totalCusts=D.customers?D.customers.length:0;

  document.getElementById('orgtree-stats').innerHTML=
    '<div class="stat"><div class="stat-l">Total Centers</div><div class="stat-v">'+centers.length+'</div></div>'+
    '<div class="stat"><div class="stat-l">Root</div><div class="stat-v">'+roots.length+'</div></div>'+
    '<div class="stat"><div class="stat-l">Downlines</div><div class="stat-v">'+downlines.length+'</div></div>'+
    '<div class="stat"><div class="stat-l">Total Customers</div><div class="stat-v">'+totalCusts+'</div></div>';

  if(!centers.length){container.innerHTML='<div class="empty"><div class="ei">🌳</div><p>No centers yet.</p></div>';return;}

  function getCenterCustCount(centerId){
    return (D.customers||[]).filter(function(c){return c.wellness_center_id===centerId;}).length;
  }

  function buildCenterNode(center, level){
    var children=centers.filter(function(c){return c.upline_center_id===center.id;});
    var custCount=getCenterCustCount(center.id);
    var lvlCls=level===0?'root':level===1?'l1':'l2';
    var typeBadge='<span style="font-size:9px;background:rgba(255,255,255,.2);padding:1px 6px;border-radius:10px;margin-left:4px">'+center.type+'</span>';
    var nid=center.network_id?'<div style="font-family:monospace;font-size:10px;opacity:.75;margin-top:2px">'+center.network_id+'</div>':'';
    var email=center.owner_email?'<div style="font-size:10px;opacity:.7;margin-top:2px">✉️ '+center.owner_email+'</div>':'';
    var custs=custCount>0?'<div style="font-size:10px;margin-top:3px">👥 '+custCount+' customers</div>':'';
    var inviteBtn='<div style="margin-top:6px"><button onclick="copyInviteLink(\''+center.network_id+'\')" style="background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.3);color:#fff;padding:3px 8px;border-radius:6px;font-size:10px;cursor:pointer;font-family:inherit">🔗 Copy Invite</button></div>';

    var html='<div class="org-child"><div class="org-node '+lvlCls+'">';
    html+='<div style="font-weight:700;font-size:13px">'+center.name+typeBadge+'</div>';
    html+=nid+email+custs;
    if(center.network_id) html+=inviteBtn;
    html+='</div>';
    if(children.length){html+='<div class="org-line">';children.forEach(function(ch){html+=buildCenterNode(ch,level+1);});html+='</div>';}
    html+='</div>';
    return html;
  }

  var currentMonthStr = new Date().toISOString().substring(0,7);
  var networkRevenue = 0;
  var expiringCount = 0;
  var avgPackPrice = 1200;
  
  var allIncomes = (D.finance||[]).filter(function(f){ return f.type === 'income' && Number(f.amount) > 0; });
  if(allIncomes.length) {
    var totalInc = allIncomes.reduce(function(s,f){ return s + Number(f.amount); }, 0);
    avgPackPrice = totalInc / allIncomes.length;
  }
  
  centers.forEach(function(center) {
    var centerRev = (D.finance||[]).filter(function(f){
      return f.type==='income' && f.wellness_center_id===center.id && (f.date||'').startsWith(currentMonthStr);
    }).reduce(function(s,f){ return s+Number(f.amount); },0);
    networkRevenue += centerRev;
    
    var centerCusts = (D.customers||[]).filter(function(c) { return c.wellness_center_id === center.id && c.status === 'active'; });
    centerCusts.forEach(function(c) {
      if(c.join_date && c.pack_days) {
        var joinD = new Date(c.join_date);
        var expD = new Date(joinD.getTime() + c.pack_days * 24 * 60 * 60 * 1000);
        var today = new Date();
        today.setHours(0,0,0,0);
        var diffTime = expD - today;
        var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if(diffDays >= 0 && diffDays <= 15) {
          expiringCount++;
        }
      }
    });
  });
  
  var projectedRevenue = networkRevenue + (expiringCount * avgPackPrice * 0.85);
  
  var forecastHtml = '<div style="margin-bottom:16px; background:linear-gradient(135deg, rgba(74, 222, 128, 0.08) 0%, rgba(9, 131, 239, 0.08) 100%); border-left:4px solid var(--accent); border-radius:12px; display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:16px; padding:16px 20px; width:100%">' +
    '<div style="text-align:left">' +
      '<div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:var(--muted)">📈 Network Performance & Renewal Forecasting (Elite)</div>' +
      '<div style="font-size:18px; font-weight:700; color:var(--text); margin-top:4px">Network Revenue Forecast</div>' +
      '<div style="font-size:12px; color:var(--muted); margin-top:2px">Assumes 85% renewal probability on ' + expiringCount + ' packages expiring in next 15 days (Avg price: ₹' + Math.round(avgPackPrice) + ')</div>' +
    '</div>' +
    '<div style="display:flex; gap:24px; flex-wrap:wrap; text-align:left">' +
      '<div>' +
        '<div style="font-size:11px; font-weight:600; color:var(--muted); text-transform:uppercase;">Current Month (Actual)</div>' +
        '<div style="font-size:22px; font-weight:800; color:var(--primary); margin-top:2px">₹' + Math.round(networkRevenue).toLocaleString('en-IN') + '</div>' +
      '</div>' +
      '<div>' +
        '<div style="font-size:11px; font-weight:600; color:var(--muted); text-transform:uppercase;">Next Month (Projected)</div>' +
        '<div style="font-size:22px; font-weight:800; color:var(--accent); margin-top:2px">₹' + Math.round(projectedRevenue).toLocaleString('en-IN') + '</div>' +
      '</div>' +
    '</div>' +
  '</div>';

  var html= forecastHtml + '<div style="display:flex;flex-wrap:wrap;gap:30px;justify-content:center;width:100%">';
  roots.forEach(function(r){html+=buildCenterNode(r,0);});
  var orphans=centers.filter(function(c){return c.upline_center_id&&!centers.find(function(x){return x.id===c.upline_center_id;});});
  if(orphans.length){
    html+='<div style="margin-top:20px;width:100%"><div style="font-size:12px;color:var(--muted);margin-bottom:8px">⚠️ Centers with unknown upline (upline not in system):</div><div style="display:flex;gap:12px;flex-wrap:wrap">';
    orphans.forEach(function(c){
      html+='<div class="org-node l2"><div style="font-weight:700;font-size:13px">'+c.name+'</div>'+(c.network_id?'<div style="font-family:monospace;font-size:10px;opacity:.75;margin-top:2px">'+c.network_id+'</div>':'')+'</div>';
    });
    html+='</div></div>';
  }
  container.innerHTML=html+'</div>';
}

// ══════════════════════════════════════════════
// COUPONS
// ══════════════════════════════════════════════
async function loadCoupons(){
  getCredentials();if(!getActiveSbUrl()||!getActiveSbKey())return;
  try{var r=await dbGet('coupons','created_at');D.coupons=Array.isArray(r)?r:[];}
  catch(e){D.coupons=[];}
}
function updateCouponCoachSelects(){
  // Searchable dropdowns are updated via updateCoachSelects() → sdSetItems
  // This function kept for compatibility with loadCoaches() call
}
function getCouponBalance(personId){
  var all=(D.coupons||[]).filter(function(x){return x.coach_id===personId;});
  var earned=all.filter(function(x){return x.type==='earn';}).reduce(function(s,x){return s+Number(x.quantity);},0);
  var used=all.filter(function(x){return x.type==='use';}).reduce(function(s,x){return s+Number(x.quantity);},0);
  return{earned:earned,used:used,balance:earned-used};
}
// Look up a person by ID from coaches or customers
function findPerson(id){
  var c=D.coaches.find(function(x){return x.id===id;});
  if(c) return {name:c.name, pack_price:c.pack_price, pack_type:c.pack_type, pack_start_date:c.pack_start_date, type:'coach'};
  var cu=D.customers.find(function(x){return x.id===id;});
  if(cu) return {name:cu.name, pack_price:cu.pack_price, pack_type:cu.pack_type, pack_start_date:cu.pack_start_date, type:'customer'};
  return null;
}
function renderReferralLeaderboard() {
  var el = document.getElementById('referral-leaderboard'); if (!el) return;
  var coupons = D.coupons || [];
  if (!coupons.length) { el.innerHTML = '<div class="empty"><div class="ei">🏆</div><p>No coupon data yet.</p></div>'; return; }
  // Aggregate earned coupons per person
  var map = {};
  coupons.filter(function(c){ return c.type === 'earned'; }).forEach(function(c){
    var pid = c.coach_id; if (!pid) return;
    if (!map[pid]) map[pid] = 0;
    map[pid] += Number(c.coupons) || 0;
  });
  var ranked = Object.keys(map).map(function(pid){
    var p = findPerson(pid);
    return { name: p ? p.name : 'Unknown', type: p ? p.type : '?', earned: map[pid] };
  }).filter(function(r){ return r.earned > 0; })
    .sort(function(a,b){ return b.earned - a.earned; })
    .slice(0, 10);
  if (!ranked.length) { el.innerHTML = '<div class="empty"><div class="ei">🏆</div><p>No earned coupons yet.</p></div>'; return; }
  var medals = ['🥇','🥈','🥉'];
  el.innerHTML = '<div style="display:flex;flex-direction:column;gap:8px">'
    + ranked.map(function(r, i){
        var medal = medals[i] || ('<span style="font-weight:700;color:var(--muted);min-width:24px;display:inline-block">#'+(i+1)+'</span>');
        var badge = r.type === 'coach'
          ? '<span style="font-size:10px;background:#dbeafe;color:#1d4ed8;padding:2px 7px;border-radius:20px;font-weight:600">Coach</span>'
          : '<span style="font-size:10px;background:#dcfce7;color:#166534;padding:2px 7px;border-radius:20px;font-weight:600">Customer</span>';
        var barW = Math.round(r.earned / ranked[0].earned * 100);
        return '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--surface2);border-radius:10px">'
          + '<span style="font-size:18px;min-width:26px">' + medal + '</span>'
          + '<div style="flex:1">'
          +   '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">'
          +     '<span style="font-weight:700;font-size:13px">'+r.name+'</span>'+badge
          +   '</div>'
          +   '<div style="background:var(--border);border-radius:4px;height:6px;width:100%">'
          +     '<div style="background:var(--accent);height:6px;border-radius:4px;width:'+barW+'%"></div>'
          +   '</div>'
          + '</div>'
          + '<span style="font-weight:800;font-size:16px;color:var(--accent);min-width:36px;text-align:right">'+r.earned+'</span>'
          + '</div>';
      }).join('')
    + '</div>';
}

function renderCouponView(){
  renderCoupons();
  renderReferralLeaderboard();
  var cid=document.getElementById('coupon-coach-sel')?document.getElementById('coupon-coach-sel').value:'';
  var card=document.getElementById('coupon-coach-card');
  if(!cid){card.style.display='none';return;}
  var p=findPerson(cid);if(!p){card.style.display='none';return;}
  var bal=getCouponBalance(cid);
  var price=Number(p.pack_price)||0;
  var days=p.pack_type?(p.pack_type.includes('26')?26:30):26;
  var perShake=days>0?price/days:0;
  card.style.display='block';
  card.innerHTML='<div class="coupon-card" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">'
    +'<div><div style="font-size:12px;opacity:.8;margin-bottom:4px">'+p.name+' <span class="badge '+(p.type==='coach'?'bg':'ms-green')+'">'+p.type+'</span></div>'
    +'<div class="coupon-val">🎟️ '+bal.balance+'</div>'
    +'<div style="font-size:11px;opacity:.85;margin-top:4px">Earned: '+bal.earned+' · Used: '+bal.used+'</div></div>'
    +'<div style="text-align:right">'
    +(price>0?'<div style="font-size:12px;opacity:.8">₹'+price+' ÷ '+days+'d = ₹'+perShake.toFixed(2)+'/shake</div>'
      +'<div style="font-size:16px;font-weight:700;margin-top:4px">Discount: ₹'+(bal.balance*perShake).toFixed(0)+'</div>'
      :'<div style="font-size:12px;opacity:.8">Set pack price to see discount</div>')+'</div></div>';
  // Warn if pack expiring soon and coupons unused
  if(bal.balance>0 && p.pack_start_date){
    var packEnd=new Date(p.pack_start_date); packEnd.setDate(packEnd.getDate()+days);
    var daysToExpiry=Math.ceil((packEnd-new Date())/(1000*60*60*24));
    if(daysToExpiry<=5){
      card.innerHTML+='<div style="margin-top:10px;padding:10px 14px;background:#fdf0ef;border:1.5px solid var(--danger);border-radius:8px;font-size:13px;color:var(--danger);font-weight:600">'
        +'⚠️ Pack expires in '+Math.max(0,daysToExpiry)+' day'+(daysToExpiry!==1?'s':'')+' — <strong>'+bal.balance+' coupon'+(bal.balance>1?'s':'')+' will be WASTED</strong> if not redeemed at next renewal! Tell '+p.name+' to renew now.</div>';
    }
  }
}
function renderCoupons(){
  if (isCenterSession() && !isGrowthPlan()) {
    var _cpLock = document.getElementById('coupons-body') || document.querySelector('#sec-coupons .tcard');
    if (_cpLock) _cpLock.innerHTML = planLockHtml('Coupon & Referral System', 'Auto-earn coupons when customers refer friends. Track and manage all referral rewards.');
    return;
  }
  var cid=document.getElementById('coupon-coach-sel')?document.getElementById('coupon-coach-sel').value:'';
  var _centerPersonIds=null;
  if(ACTIVE_CENTER){
    var _ccIds=filterByCenter(D.customers).map(function(c){return c.id;});
    var _coIds=D.coaches.filter(function(co){return D.centers.some(function(ct){return ct.id===ACTIVE_CENTER&&ct.owner_id===co.id;});}).map(function(co){return co.id;});
    _centerPersonIds=_ccIds.concat(_coIds);
  }
  var allCoupons=(_centerPersonIds?(D.coupons||[]).filter(function(x){return _centerPersonIds.indexOf(x.coach_id)>-1;}):(D.coupons||[]));
  var rows=allCoupons.filter(function(x){return!cid||x.coach_id===cid;});
  var tb=document.getElementById('coupon-body');if(!tb)return;
  if(!rows.length){tb.innerHTML='<tr><td colspan="7"><div class="empty"><div class="ei">🎟️</div><p>No coupons yet.</p></div></td></tr>';return;}
  rows.sort(function(a,b){return new Date(b.date||b.created_at)-new Date(a.date||a.created_at);});
  tb.innerHTML=rows.map(function(r){
    var person=findPerson(r.coach_id);
    var pName=person?person.name:r.coach_id;
    var pBadge=person?(' <span class="badge '+(person.type==='coach'?'bg':'ms-green')+'" style="font-size:9px">'+person.type+'</span>'):'';
    return'<tr><td><strong>'+pName+'</strong>'+pBadge+'</td><td>'+(r.reason||'—')+'</td>'
      +'<td style="font-weight:700;color:'+(r.type==='earn'?'var(--success)':'var(--danger)')+'">'+(r.type==='earn'?'+':'-')+r.quantity+'</td>'
      +'<td><span class="badge '+(r.type==='earn'?'bg':'br')+'">'+(r.type==='earn'?'Earned':'Used')+'</span></td>'
      +'<td>'+(r.date||'—')+'</td><td>'+(r.referred_person||'—')+'</td>'
      +'<td><button class="btn-d" onclick="delCoupon(\''+r.id+'\')">Del</button></td></tr>';
  }).join('');
  // Stats: scoped to active center
  var statsPersonIds={};
  allCoupons.forEach(function(x){ statsPersonIds[x.coach_id]=true; });
  var total=0;
  Object.keys(statsPersonIds).forEach(function(pid){ total+=getCouponBalance(pid).balance; });
  var el=document.getElementById('coupon-stats');
  if(el)el.innerHTML='<div class="stat"><div class="stat-l">Total Earned</div><div class="stat-v">'+
    allCoupons.filter(function(x){return x.type==='earn';}).reduce(function(s,x){return s+Number(x.quantity);},0)+'</div></div>'+
    '<div class="stat"><div class="stat-l">Total Used</div><div class="stat-v">'+
    allCoupons.filter(function(x){return x.type==='use';}).reduce(function(s,x){return s+Number(x.quantity);},0)+'</div></div>'+
    '<div class="stat"><div class="stat-l">Outstanding</div><div class="stat-v" style="color:var(--accent)">'+total+'</div></div>';
}
async function saveCoupon(){
  getCredentials();if(!getActiveSbUrl()||!getActiveSbKey()){showToast('Not connected','error');return;}
  var personId=document.getElementById('coupon-coach-id').value;
  var qty=Number(document.getElementById('coupon-qty').value)||1;
  var reason=document.getElementById('coupon-reason').value;
  var refId=document.getElementById('coupon-ref-person-id').value||null;
  var refPerson=refId?findPerson(refId):null;
  var refName=refPerson?refPerson.name:(document.getElementById('coupon-ref-input').value.trim()||null);
  var date=document.getElementById('coupon-date').value;
  if(!personId||!date){showToast('Person and date required','error');return;}
  try{await dbInsert('coupons',{coach_id:personId,quantity:qty,type:'earn',reason:reason,referred_person:refName,date:date});
    showToast('Coupon added!');closeModal('add-coupon');sdClear('coupon-person');sdClear('coupon-ref');await loadCoupons();renderCouponView();}
  catch(e){showToast('Error: '+e.message,'error');}
}
async function delCoupon(id){
  if(!confirm('Delete?'))return;
  try{await dbDelete('coupons',id);showToast('Deleted!');await loadCoupons();renderCouponView();}
  catch(e){showToast('Error: '+e.message,'error');}
}
function calcCouponRenewal(){
  var cid=document.getElementById('cr-coach').value;
  var price=Number(document.getElementById('cr-price').value)||0;
  var days=Number(document.getElementById('cr-days').value)||26;
  var use=Number(document.getElementById('cr-use').value)||0;
  var bd=document.getElementById('cr-breakdown');
  if(!cid||!price){bd.style.display='none';return;}
  var bal=getCouponBalance(cid);
  var perShake=price/days;
  var actualUse=Math.min(use,bal.balance);
  var discount=actualUse*perShake;
  bd.style.display='block';
  bd.innerHTML='<div style="font-weight:700;margin-bottom:8px;color:var(--primary)">💰 Calculation</div>'
    +'<div class="coupon-row"><span>Pack Price</span><strong>₹'+price.toLocaleString('en-IN')+'</strong></div>'
    +'<div class="coupon-row"><span>Per Shake Value</span><strong>₹'+perShake.toFixed(2)+'</strong></div>'
    +'<div class="coupon-row"><span>Available Coupons</span><strong style="color:var(--accent)">'+bal.balance+'</strong></div>'
    +'<div class="coupon-row"><span>Coupons Used ('+actualUse+')</span><strong style="color:var(--danger)">-₹'+discount.toFixed(0)+'</strong></div>'
    +'<div class="coupon-row" style="border-bottom:none"><span style="font-weight:700">Final to Pay</span><strong style="font-size:16px;color:var(--primary)">₹'+Math.max(0,price-discount).toFixed(0)+'</strong></div>'
    +(use>bal.balance?'<div style="color:var(--danger);font-size:11px;margin-top:6px">⚠️ Only '+bal.balance+' available</div>':'')
    +(bal.balance>0 && actualUse<bal.balance?'<div style="color:var(--danger);font-size:12px;margin-top:8px;padding:8px 10px;background:#fdf0ef;border-radius:8px;font-weight:600">⚠️ WARNING: '+(bal.balance-actualUse)+' unused coupon'+(bal.balance-actualUse>1?'s':'')+' will be WASTED after this renewal! Use them now or they expire.</div>':'');
}
async function saveCouponRenewal(){
  getCredentials();if(!getActiveSbUrl()||!getActiveSbKey()){showToast('Not connected','error');return;}
  var cid=document.getElementById('cr-coach').value;
  var price=Number(document.getElementById('cr-price').value)||0;
  var days=Number(document.getElementById('cr-days').value)||26;
  var use=Math.min(Number(document.getElementById('cr-use').value)||0,getCouponBalance(cid).balance);
  var start=document.getElementById('cr-start').value;
  var packType=days===26?'Standard 26 days':'Premium 30 days';
  if(!cid||!price||!start){showToast('Fill all fields','error');return;}
  var person=findPerson(cid);
  if(!person){showToast('Person not found','error');return;}
  try{
    if(use>0)await dbInsert('coupons',{coach_id:cid,quantity:use,type:'use',reason:'Pack renewal',date:start});
    // Expire any remaining unused coupons
    var remaining=getCouponBalance(cid).balance - use;
    if(remaining>0)await dbInsert('coupons',{coach_id:cid,quantity:remaining,type:'use',reason:'Expired — not redeemed at renewal',date:start});
    // Archive old pack
    if(person.pack_start_date)await dbInsert('pack_history',{coach_id:cid,customer_name:person.name,pack_type:person.pack_type,start_date:person.pack_start_date,price:person.pack_price,notes:person.type+' pack archived'});
    await dbInsert('pack_history',{coach_id:cid,customer_name:person.name,pack_type:packType,start_date:start,price:price,notes:person.type+' pack renewed with '+use+' coupons'});
    // Update the coach or customer record
    var table=person.type==='coach'?'coaches':'customers';
    await dbUpdate(table,cid,{pack_type:packType,pack_start_date:start,pack_price:price});
    showToast('Renewal saved! 🎉');closeModal('coupon-renew');sdClear('renew-person');
    if(person.type==='coach'){await loadCoaches();}else{await loadCustomers();}
    await loadCoupons();
  }catch(e){showToast('Error: '+e.message,'error');}
}

function openShakeRedeem(){
  sdClear('shake-person');
  document.getElementById('sr-qty').value='1';
  document.getElementById('sr-date').value=new Date().toISOString().split('T')[0];
  document.getElementById('sr-balance-info').innerHTML='';
  openModal('shake-redeem');
}
function showShakeBalance(){
  var cid=document.getElementById('sr-person-id').value;
  var el=document.getElementById('sr-balance-info');
  if(!cid){el.innerHTML='';return;}
  var bal=getCouponBalance(cid).balance;
  el.innerHTML='<div style="padding:10px 12px;background:var(--accent-light);border-radius:8px;font-size:13px;margin-top:8px">'
    +'🎟️ Available coupons: <strong style="color:var(--primary)">'+bal+'</strong>'
    +(bal===0?'<div style="color:var(--danger);font-size:11px;margin-top:4px">No coupons available</div>':'')
    +'</div>';
  document.getElementById('sr-qty').max=bal;
}
async function saveShakeRedemption(){
  getCredentials();if(!getActiveSbUrl()||!getActiveSbKey()){showToast('Not connected','error');return;}
  var cid=document.getElementById('sr-person-id').value;
  var qty=Math.max(1,Number(document.getElementById('sr-qty').value)||1);
  var date=document.getElementById('sr-date').value;
  if(!cid||!date){showToast('Fill all fields','error');return;}
  var person=findPerson(cid);
  if(!person){showToast('Person not found','error');return;}
  var bal=getCouponBalance(cid).balance;
  if(bal<qty){showToast('Only '+bal+' coupon'+(bal!==1?'s':'')+' available','error');return;}
  try{
    await dbInsert('coupons',{coach_id:cid,quantity:qty,type:'use',reason:'Free shake redemption',date:date});
    await dbInsert('attendance',{customer_id:cid,customer_name:person.name,date:date,status:'coupon_shake',servings:qty,notes:'Coupon shake redemption ('+qty+' coupon'+(qty>1?'s':'')+' used)'});
    showToast('🥤 '+qty+' free shake'+(qty>1?'s':'')+' redeemed!','success');
    closeModal('shake-redeem');sdClear('shake-person');
    await loadCoupons();await loadAttendance();
    // WhatsApp notification
    var phone=(person.phone||'').replace(/\D/g,'');
    if(phone){
      var _cn=getCenterName();
      var msg='🥤 Hi '+person.name+'!\n\nYour '+qty+' free shake'+(qty>1?'s have':' has')+' been redeemed today using your coupons. Enjoy!\n\nRemaining coupons: '+(bal-qty)+'\n\n— '+_cn;
      var waLink=document.getElementById('att-wa-bar-link');
      var bar=document.getElementById('att-wa-bar');
      if(waLink&&bar){waLink.href='https://api.whatsapp.com/send?phone='+COUNTRY_CODE+phone+'&text='+encodeURIComponent(msg);bar.style.display='flex';document.getElementById('att-wa-bar-text').textContent='Send shake confirmation to '+person.name+'?';}
      else{window.open('https://api.whatsapp.com/send?phone='+COUNTRY_CODE+phone+'&text='+encodeURIComponent(msg),'_blank');}
    }
  }catch(e){showToast('Error: '+e.message,'error');}
}

// ══════════════════════════════════════════════
// PARTIAL PAYMENTS
// ══════════════════════════════════════════════
async function loadPayments(){
  getCredentials();if(!getActiveSbUrl()||!getActiveSbKey())return;
  try{var r=await dbGet('payments','payment_date');D.payments=Array.isArray(r)?r:[];}
  catch(e){D.payments=[];}
  renderPayments();checkOverduePayments();
}
function updatePaymentPersonSelect(){
  var all=D.customers.map(function(c){return{id:c.id,name:c.name};})
    .concat(D.coaches.map(function(c){return{id:c.id,name:c.name+' (Coach)'};}));
  var sel=document.getElementById('payment-person');
  if(sel)sel.innerHTML='<option value="">Select person</option>'+all.map(function(p){return'<option value="'+p.id+'">'+p.name+'</option>';}).join('');
}
function calcBalance(){
  var total=Number(document.getElementById('payment-total').value)||0;
  var paid=Number(document.getElementById('payment-paid').value)||0;
  var el=document.getElementById('payment-balance-preview');
  if(el){el.textContent='₹'+Math.max(0,total-paid).toLocaleString('en-IN');el.style.color=paid<total?'var(--danger)':'var(--success)';}
}
function renderPayments(){
  var q=(document.getElementById('payment-search')||{value:''}).value.toLowerCase();
  var allPayments=(D.payments||[]);
  if(ACTIVE_CENTER){
    var _pCustIds=filterByCenter(D.customers).map(function(c){return c.id;});
    var _pCoachIds=filterByCenter(D.coaches).map(function(co){return co.id;});
    var _pPersonIds=_pCustIds.concat(_pCoachIds);
    allPayments=allPayments.filter(function(p){return _pPersonIds.indexOf(p.person_id)>-1;});
  }
  var rows=allPayments.filter(function(p){return(p.person_name||'').toLowerCase().includes(q)||(p.description||'').toLowerCase().includes(q);});
  var tb=document.getElementById('payment-body');if(!tb)return;
  if(!rows.length){tb.innerHTML='<tr><td colspan="9"><div class="empty"><div class="ei">💳</div><p>No payments yet.</p></div></td></tr>';return;}
  rows.sort(function(a,b){return new Date(b.payment_date)-new Date(a.payment_date);});
  var today=new Date().toISOString().split('T')[0];
  tb.innerHTML=rows.map(function(p){
    var total=Number(p.total_amount),paid=Number(p.amount_paid),bal=Math.max(0,total-paid);
    var pct=total>0?Math.round((paid/total)*100):100;
    var isOverdue=bal>0&&p.due_date&&p.due_date<today;
    var badge=bal===0?'<span class="badge bg">Paid</span>':(isOverdue?'<span class="badge br">Overdue</span>':'<span class="badge by">Pending</span>');
    return'<tr style="'+(isOverdue?'background:#fff5f5':'')+'">'
      +'<td><strong>'+(p.person_name||'—')+'</strong></td><td>'+(p.description||'—')+'</td>'
      +'<td>₹'+total.toLocaleString('en-IN')+'</td>'
      +'<td style="color:var(--success)">₹'+paid.toLocaleString('en-IN')+'</td>'
      +'<td style="color:'+(bal>0?'var(--danger)':'var(--success)')+'">₹'+bal.toLocaleString('en-IN')+'</td>'
      +'<td><div class="payment-bar"><div class="payment-fill'+(isOverdue?' overdue':'')+'" style="width:'+pct+'%"></div></div><span style="font-size:10px;color:var(--muted)">'+pct+'%</span></td>'
      +'<td>'+(p.due_date||'—')+'</td><td>'+badge+'</td>'
      +'<td><div class="acts">'
      +(bal>0?'<button class="btn-p" style="font-size:11px;padding:3px 8px;background:var(--success);border-color:var(--success)" onclick="openInstallmentModal(\''+p.id+'\')">💰 Pay</button> ':'')
      +(bal>0&&p.person_id?'<button class="wa-btn" style="font-size:11px;padding:3px 7px" onclick="sendPaymentWA(\''+p.id+'\')">💬</button> ':'')
      +'<button class="btn-e" onclick="editPayment(\''+p.id+'\')">Edit</button>'
      +'<button class="btn-d" onclick="delPayment(\''+p.id+'\')">Del</button></div></td></tr>';
  }).join('');
  var totalBal=allPayments.reduce(function(s,p){return s+Math.max(0,Number(p.total_amount)-Number(p.amount_paid));},0);
  var overdueCount=allPayments.filter(function(p){return Math.max(0,Number(p.total_amount)-Number(p.amount_paid))>0&&p.due_date&&p.due_date<today;}).length;
  var el=document.getElementById('payment-stats');
  if(el)el.innerHTML='<div class="stat"><div class="stat-l">Outstanding</div><div class="stat-v" style="color:var(--danger)">₹'+totalBal.toLocaleString('en-IN')+'</div></div>'
    +'<div class="stat"><div class="stat-l">Overdue</div><div class="stat-v" style="color:var(--danger)">'+overdueCount+'</div></div>'
    +'<div class="stat"><div class="stat-l">Records</div><div class="stat-v">'+allPayments.length+'</div></div>';
}
// ── CUSTOMER PAYMENT MODAL HELPERS ──
// ── COACH PAYMENT SETUP (for existing coaches) ──
function openCoachPaymentSetup(coachId) {
  var c = D.coaches.find(function(x){return x.id===coachId;});
  if (!c) return;
  document.getElementById('cps-coach-id').value = coachId;
  document.getElementById('cps-info').innerHTML =
    '<strong>'+c.name+'</strong><br>'+
    'Pack: <strong>'+(c.pack_type||'—')+'</strong> &nbsp;|&nbsp; '+
    'Pack Price: <strong style="color:var(--primary)">₹'+Number(c.pack_price).toLocaleString('en-IN')+'</strong>'+
    (c.pack_start_date ? '<br>Started: '+c.pack_start_date : '');
  document.getElementById('cps-pay-mode').value = 'full';
  document.getElementById('cps-paid-now-box').style.display = 'none';
  document.getElementById('cps-due-row').style.display = 'none';
  document.getElementById('cps-paid-now').value = '';
  document.getElementById('cps-due-date').value = '';
  document.getElementById('cps-date').value = c.pack_start_date || new Date().toISOString().split('T')[0];
  updateCpsPreview();
  openModal('coach-pay-setup');
}
function onCpsPayModeChange() {
  var mode = document.getElementById('cps-pay-mode').value;
  document.getElementById('cps-paid-now-box').style.display = mode==='partial' ? 'block' : 'none';
  document.getElementById('cps-due-row').style.display = (mode==='partial'||mode==='none') ? 'flex' : 'none';
  updateCpsPreview();
}
function updateCpsPreview() {
  var coachId = document.getElementById('cps-coach-id').value;
  var c = D.coaches.find(function(x){return x.id===coachId;});
  if (!c) return;
  var total = Number(c.pack_price)||0;
  var paid = Number(document.getElementById('cps-paid-now').value)||0;
  var bal = total - paid;
  var el = document.getElementById('cps-balance-preview');
  if(el) el.innerHTML = 'Balance: <strong style="color:'+(bal>0?'var(--danger)':'var(--success)')+'">₹'+bal.toLocaleString('en-IN')+'</strong>';
}
async function saveCoachPaymentSetup() {
  getCredentials(); if(!getActiveSbUrl()||!getActiveSbKey()){showToast('Not connected','error');return;}
  var coachId = document.getElementById('cps-coach-id').value;
  var c = D.coaches.find(function(x){return x.id===coachId;});
  if (!c) return;
  var packPrice = Number(c.pack_price)||0;
  var mode = document.getElementById('cps-pay-mode').value;
  var payDate = document.getElementById('cps-date').value || new Date().toISOString().split('T')[0];
  try {
    if (mode === 'full') {
      await dbInsert('payments', { person_id:coachId, person_name:c.name, total_amount:packPrice, amount_paid:packPrice, payment_date:payDate, description:c.pack_type||'Coach Pack', notes:'Coach pack — full payment' });
      await dbInsert('finance', { type:'income', description:c.name+' — Coach pack sale', amount:packPrice, category:'Coach pack payment', date:payDate, wellness_center_id:c.wellness_center_id||null });
      showToast('Payment recorded! ₹'+packPrice.toLocaleString('en-IN')+' income logged.', 'success');
    } else if (mode === 'partial') {
      var paidNow = Number(document.getElementById('cps-paid-now').value)||0;
      var dueDate = document.getElementById('cps-due-date').value||null;
      await dbInsert('payments', { person_id:coachId, person_name:c.name, total_amount:packPrice, amount_paid:paidNow, payment_date:payDate, due_date:dueDate, description:c.pack_type||'Coach Pack', notes:'Coach pack — partial' });
      if (paidNow > 0) await dbInsert('finance', { type:'income', description:c.name+' — Partial coach pack payment', amount:paidNow, category:'Coach pack payment', date:payDate, wellness_center_id:c.wellness_center_id||null });
      showToast('Payment plan created! Balance: ₹'+(packPrice-paidNow).toLocaleString('en-IN'), 'success');
    } else {
      var dueDateNone = document.getElementById('cps-due-date').value||null;
      await dbInsert('payments', { person_id:coachId, person_name:c.name, total_amount:packPrice, amount_paid:0, payment_date:payDate, due_date:dueDateNone, description:c.pack_type||'Coach Pack', notes:'Coach pack — pending' });
      showToast('Payment reminder created!', 'success');
    }
    closeModal('coach-pay-setup');
    await loadPayments(); await loadFinance(); await loadCoaches(); renderOverview();
  } catch(e) {
    if(e.message && e.message.toLowerCase().includes('payments')) {
      showToast('⚠️ Payments table missing — go to SQL Setup Guide and run the SQL first!', 'error');
    } else { showToast('Error: '+e.message,'error'); }
  }
}

// ── COACH PAYMENT HELPERS ──
function onCoachPackTypeChange() {
  var pack = document.getElementById('coach-pack-type').value;
  if (pack === 'Star UMS 90 days') {
    var pr = document.getElementById('coach-pack-price');
    if (pr) { pr.value = 15000; onCoachPackPriceChange(); }
  }
}
function onCoachPackPriceChange() {
  var price = Number(document.getElementById('coach-pack-price').value)||0;
  var isNew = !document.getElementById('coach-id').value;
  var isOwner = (document.getElementById('coach-role')||{value:'coach'}).value === 'owner';
  document.getElementById('coach-pay-section').style.display = (price>0 && isNew && !isOwner) ? 'block' : 'none';
  updateCoachBalancePreview();
}
function onCoachPayModeChange() {
  var mode = (document.getElementById('coach-pay-mode')||{value:'full'}).value;
  document.getElementById('coach-paid-now-box').style.display = mode==='partial' ? 'block' : 'none';
  document.getElementById('coach-due-row').style.display = (mode==='partial'||mode==='none') ? 'flex' : 'none';
  updateCoachBalancePreview();
}
function updateCoachBalancePreview() {
  var total = Number(document.getElementById('coach-pack-price').value)||0;
  var paid = Number((document.getElementById('coach-paid-now')||{value:0}).value)||0;
  var bal = total - paid;
  var el = document.getElementById('coach-balance-preview');
  if(el) el.innerHTML = 'Balance: <strong style="color:'+(bal>0?'var(--danger)':'var(--success)')+'">₹'+bal.toLocaleString('en-IN')+'</strong>';
}

function openNewCustomerModal() {
  document.getElementById('customer-id').value='';
  ['customer-name','customer-contact','customer-address','customer-ref-name','customer-ref-phone'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=''; });
  ['customer-age','customer-height','customer-pack-price','customer-paid-now'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=''; });
  ['customer-gender','customer-pack','customer-goal','customer-center','customer-lang'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=''; });
  var dtEl=document.getElementById('customer-diet-type'); if(dtEl) dtEl.value='veg';
  var alEl=document.getElementById('customer-activity-level'); if(alEl) alEl.value='light';
  var ttEl2=document.getElementById('customer-training-type'); if(ttEl2) ttEl2.value='dumbbell';
  var prEl2=document.getElementById('customer-protein-ratio'); if(prEl2) prEl2.value='2.0';
  var sfEl2=document.getElementById('customer-shake-freq'); if(sfEl2) sfEl2.value='once';
  var foEl2=document.getElementById('customer-food-override'); if(foEl2) foEl2.value='';
  var frEl2=document.getElementById('customer-food-restrict'); if(frEl2) frEl2.value='';
  sdClear('ref');
  ['customer-join','customer-start','customer-dob','customer-due-date'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('other-ref-row').style.display='none';
  document.getElementById('cust-pay-section').style.display='none';
  document.getElementById('cust-paid-now-row').style.display='none';
  document.getElementById('cust-due-row').style.display='none';
  document.getElementById('customer-pay-mode').value='full';
  document.getElementById('customer-pay-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('customer-photo-before').value = '';
  document.getElementById('customer-photo-after').value  = '';
  document.getElementById('cust-before-preview').innerHTML = '';
  document.getElementById('cust-after-preview').innerHTML  = '';
  document.getElementById('customer-modal-title').textContent='Add Customer';
  openModal('customer');
}
function onCustomerPackChange() {
  var pack = document.getElementById('customer-pack').value;
  if (pack === 'Star UMS 90 days') {
    var pr = document.getElementById('customer-pack-price');
    if (pr) { pr.value = 15000; onPackPriceChange(); }
  }
}
function onPackPriceChange() {
  var price = Number(document.getElementById('customer-pack-price').value)||0;
  var isNew = !document.getElementById('customer-id').value;
  document.getElementById('cust-pay-section').style.display = (price>0 && isNew) ? 'block' : 'none';
  updateCustBalancePreview();
}
function onCustomerPayModeChange() {
  var mode = document.getElementById('customer-pay-mode').value;
  document.getElementById('cust-paid-now-row').style.display = (mode==='partial'||mode==='none') ? 'flex' : 'none';
  document.getElementById('cust-due-row').style.display = mode==='partial' ? 'block' : 'none';
  updateCustBalancePreview();
}
function updateCustBalancePreview() {
  var total = Number(document.getElementById('customer-pack-price').value)||0;
  var paid = Number((document.getElementById('customer-paid-now')||{value:0}).value)||0;
  var bal = total - paid;
  var el = document.getElementById('cust-balance-preview');
  if (el) el.innerHTML = 'Balance: <strong style="color:'+(bal>0?'var(--danger)':'var(--success)')+'">₹'+bal.toLocaleString('en-IN')+'</strong>';
}

// ── INSTALLMENT PAYMENT ──
function openInstallmentModal(paymentId) {
  var p = (D.payments||[]).find(function(x){return x.id===paymentId;});
  if (!p) return;
  var total=Number(p.total_amount), paid=Number(p.amount_paid), bal=total-paid;
  document.getElementById('inst-payment-id').value = paymentId;
  document.getElementById('inst-amount').value = '';
  document.getElementById('inst-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('inst-notes').value = '';
  document.getElementById('inst-balance-preview').style.display='none';
  document.getElementById('inst-info').innerHTML =
    '<strong>'+(p.person_name||'Customer')+'</strong> — '+(p.description||'Pack')+'<br>'+
    'Total: <strong>₹'+total.toLocaleString('en-IN')+'</strong> &nbsp;|&nbsp; '+
    'Paid: <span style="color:var(--success)">₹'+paid.toLocaleString('en-IN')+'</span> &nbsp;|&nbsp; '+
    'Remaining: <span style="color:var(--danger)">₹'+bal.toLocaleString('en-IN')+'</span>';
  openModal('installment');
}
function updateInstPreview() {
  var pid = document.getElementById('inst-payment-id').value;
  var p = (D.payments||[]).find(function(x){return x.id===pid;});
  if (!p) return;
  var total=Number(p.total_amount), paid=Number(p.amount_paid);
  var adding = Number(document.getElementById('inst-amount').value)||0;
  var newPaid = paid + adding;
  var newBal = total - newPaid;
  var el = document.getElementById('inst-balance-preview');
  el.style.display='block';
  el.innerHTML = 'After this payment: Paid <strong style="color:var(--success)">₹'+newPaid.toLocaleString('en-IN')+'</strong> &nbsp;|&nbsp; Balance <strong style="color:'+(newBal>0?'var(--danger)':'var(--success)')+'">₹'+Math.max(0,newBal).toLocaleString('en-IN')+'</strong>'+(newBal<=0?' &nbsp;<span style="color:var(--success)">✅ Fully paid!</span>':'');
}
async function saveInstallment() {
  getCredentials(); if(!getActiveSbUrl()||!getActiveSbKey()){showToast('Not connected','error');return;}
  var pid = document.getElementById('inst-payment-id').value;
  var p = (D.payments||[]).find(function(x){return x.id===pid;});
  if (!p) return;
  var adding = Number(document.getElementById('inst-amount').value)||0;
  var date = document.getElementById('inst-date').value;
  var notes = document.getElementById('inst-notes').value.trim();
  if (!adding||adding<=0) { showToast('Enter amount received','error'); return; }
  if (!date) { showToast('Date is required','error'); return; }
  var newPaid = Number(p.amount_paid) + adding;
  try {
    await dbUpdate('payments', pid, { amount_paid: newPaid, notes: (p.notes?p.notes+'; ':'')+date+': ₹'+adding+(notes?' ('+notes+')':'') });
    var _instPerson = D.customers.find(function(x){return x.id===p.person_id;}) || D.coaches.find(function(x){return x.id===p.person_id;});
    await dbInsert('finance', { type:'income', description:(p.person_name||'Customer')+' — '+(p.description||'Pack')+' installment', amount:adding, category:'Pack sale to customer', date:date, wellness_center_id:(_instPerson&&_instPerson.wellness_center_id)||null });
    showToast('₹'+adding.toLocaleString('en-IN')+' recorded + income logged!', 'success');
    closeModal('installment');
    await loadPayments(); await loadFinance(); renderOverview();
  } catch(e) { showToast('Error: '+e.message,'error'); }
}

async function savePayment(){
  getCredentials();if(!getActiveSbUrl()||!getActiveSbKey()){showToast('Not connected','error');return;}
  var id=document.getElementById('payment-id').value;
  var personSel=document.getElementById('payment-person');
  var personName=personSel?personSel.options[personSel.selectedIndex].text:'';
  var total=document.getElementById('payment-total').value;
  var paid=document.getElementById('payment-paid').value;
  var date=document.getElementById('payment-date').value;
  if(!total||!paid||!date){showToast('Amount and date required','error');return;}
  var payload={person_id:document.getElementById('payment-person').value||null,person_name:personName,
    total_amount:Number(total),amount_paid:Number(paid),payment_date:date,
    due_date:document.getElementById('payment-due-date').value||null,
    description:document.getElementById('payment-desc').value.trim(),
    notes:document.getElementById('payment-notes')?document.getElementById('payment-notes').value.trim()||null:null};
  try{if(id)await dbUpdate('payments',id,payload);else await dbInsert('payments',payload);
    showToast(id?'Updated!':'Saved!');closeModal('payment');await loadPayments();}
  catch(e){showToast('Error: '+e.message,'error');}
}
function editPayment(id){
  var p=(D.payments||[]).find(function(x){return x.id===id;});if(!p)return;
  document.getElementById('payment-id').value=p.id;
  document.getElementById('payment-person').value=p.person_id||'';
  document.getElementById('payment-desc').value=p.description||'';
  document.getElementById('payment-total').value=p.total_amount||'';
  document.getElementById('payment-paid').value=p.amount_paid||'';
  document.getElementById('payment-date').value=p.payment_date||'';
  document.getElementById('payment-due-date').value=p.due_date||'';
  calcBalance();
  document.getElementById('payment-modal-title').textContent='💳 Edit Payment';
  openModal('payment');
}
async function delPayment(id){
  if(!confirm('Delete?'))return;
  try{await dbDelete('payments',id);showToast('Deleted!');await loadPayments();}
  catch(e){showToast('Error: '+e.message,'error');}
}
function sendPaymentWA(pid){
  var p=(D.payments||[]).find(function(x){return x.id===pid;});if(!p)return;
  var bal=Math.max(0,Number(p.total_amount)-Number(p.amount_paid));
  var person=D.customers.find(function(x){return x.id===p.person_id;})||D.coaches.find(function(x){return x.id===p.person_id;});
  var phone=(person&&person.contact?person.contact:'').replace(/\D/g,'');
  if(phone.length===10)phone=COUNTRY_CODE+phone;
  if(!phone){showToast('No contact number','error');return;}
  var msg='🌿 *Payment Reminder — '+getCenterName()+'*\n\nHi *'+p.person_name+'*! 😊\n\n📋 *'+p.description+'*\n✅ Paid: ₹'+Number(p.amount_paid).toLocaleString('en-IN')+'\n⚠️ Balance: *₹'+bal.toLocaleString('en-IN')+'*\n'+(p.due_date?'📅 Due: *'+p.due_date+'*\n':'')+'\nPlease clear at earliest. Thank you! 🙏\n\n_'+getCenterName()+'_ 💚';
  window.open('https://api.whatsapp.com/send?phone='+phone+'&text='+encodeURIComponent(msg),'_blank');
}
function checkOverduePayments(){
  var today=new Date().toISOString().split('T')[0];
  var overdue=(D.payments||[]).filter(function(p){return Math.max(0,Number(p.total_amount)-Number(p.amount_paid))>0&&p.due_date&&p.due_date<today;});
  var el=document.getElementById('overdue-alert');
  if(!el){el=document.createElement('div');el.id='overdue-alert';var ov=document.getElementById('overview-stats');if(ov)ov.parentNode.insertBefore(el,ov);}
  el.innerHTML=overdue.length?'<div style="background:var(--danger-light);border:1px solid var(--danger);border-radius:var(--radius);padding:10px 16px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:8px"><span style="font-weight:700;color:var(--danger)">⚠️ '+overdue.length+' overdue payment'+(overdue.length>1?'s':'')+' — ₹'+overdue.reduce(function(s,p){return s+Math.max(0,Number(p.total_amount)-Number(p.amount_paid));},0).toLocaleString('en-IN')+' outstanding</span></div>':'';
}

// ══════════════════════════════════════════════
// COACH PACK STATUS + ALERTS
// ══════════════════════════════════════════════
function getCoachPackStatus(coach){
  if(!coach.pack_type||!coach.pack_start_date)return{days:0,active:false};
  var dur=coach.pack_type.includes('26')?26:30;
  var end=new Date(coach.pack_start_date);end.setDate(end.getDate()+dur);
  return{days:Math.max(0,Math.ceil((end-new Date())/86400000)),active:end>new Date()};
}
function renderCoachPackAlerts(){
  var exp=D.coaches.filter(function(c){var s=getCoachPackStatus(c);return s.active&&s.days<=3;});
  var expired=D.coaches.filter(function(c){return c.pack_type&&!getCoachPackStatus(c).active;});
  var el=document.getElementById('coach-alerts');
  if(!el){el=document.createElement('div');el.id='coach-alerts';var ov=document.getElementById('overview-stats');if(ov)ov.parentNode.insertBefore(el,ov);}
  var alerts=exp.map(function(c){return'<span style="color:var(--accent)">⚠️ '+c.name+' pack expires in '+getCoachPackStatus(c).days+'d</span>';})
    .concat(expired.map(function(c){return'<span style="color:var(--danger)">🔴 '+c.name+' pack expired</span>';}));
  el.innerHTML=alerts.length?'<div style="background:var(--accent-light);border:1px solid var(--accent);border-radius:var(--radius);padding:10px 16px;margin-bottom:14px;font-size:13px"><strong style="color:#b07800">📦 Coach Pack Alerts:</strong> '+alerts.join(' · ')+'</div>':'';
}

// ══════════════════════════════════════════════
// SLICER HELPERS + mkRetRow
// ══════════════════════════════════════════════




// ══════════════════════════════════════════════
// AUTO-PING (free plan protection)
// ══════════════════════════════════════════════
function startAutoPing(){
  setInterval(function(){
    getCredentials();
    if(SB_URL&&SB_KEY)fetch(SB_URL+'/rest/v1/wellness_centers?limit=1',{headers:{'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY}}).catch(function(){});
  },4*24*60*60*1000);
}

// ── RENDER CUSTOMERS ──
function renderCustomers() {
  var q = document.getElementById('customers-search').value.toLowerCase();
  var _custs = filterByCenter(D.customers);
  var rows = _custs.filter(function(c){ return (c.name||'').toLowerCase().includes(q)||(c.contact||'').toLowerCase().includes(q); });
  var tb = document.getElementById('customers-body');
  var todayMMDD = new Date().toISOString().slice(5,10);
  if (!rows.length) { tb.innerHTML='<tr><td colspan="9"><div class="empty"><div class="ei">👤</div><p>No customers found.</p></div></td></tr>'; }
  else tb.innerHTML = rows.map(function(c){
    var st = getDaysLeft(c);
    var streak = getStreak(c.id);
    var bdg = st.days > 3 ? 'bg' : (st.days > 0 ? 'by' : 'br');
    var refs = D.customers.filter(function(x){return x.referred_by_id===c.id;}).length;
    var refBadge = refs>=2?'<span class="star-cust">⭐ '+refs+'</span>':(refs===1?'<span style="color:var(--muted);font-size:12px">1</span>':'<span style="color:var(--muted);font-size:12px">—</span>');
    var bdayFlag = (c.dob&&c.dob.slice(5,10)===todayMMDD)?' 🎂':'';
    var noDobBadge = !c.dob ? '<span style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:10px;background:#fef3c7;color:#92400e;display:inline-block;margin-left:4px" title="Add DOB so client can log in securely">⚠️ No DOB</span>' : '';
    var wasReferred = c.referred_by_id || c.external_referrer_name;
    var custAttCount = D.attendance.filter(function(a){return a.customer_id===c.id;}).length;
    var freeDay = (wasReferred && custAttCount===0)?' <span class="badge by" style="font-size:9px" title="Free checkup, counselling &amp; shake">🆓 Free 1st Day</span>':'';
    var waRenew = (st.active&&st.days<=3&&c.contact)?'<button class="wa-btn" style="font-size:11px;padding:3px 6px" onclick="sendRenewalWA(\''+c.id+'\')">💬 Renew</button> ':'';
    var waReeng = (isInactive(c.id)&&c.contact)?'<button class="wa-btn" style="font-size:11px;padding:3px 6px;background:#8b5cf6" onclick="sendInactiveWA(\''+c.id+'\')">💬 Re-engage</button> ':'';
    var bodyCount = D.body.filter(function(b){return b.customer_id===c.id;}).length;
    var waWeekly = (bodyCount>=2&&c.contact)?'<button class="wa-btn" style="font-size:11px;padding:3px 6px;background:#0ea5e9" onclick="sendWeeklyProgressWA(\''+c.id+'\')">📊</button> ':'';
    var sharedBadge = '';
    if(c.pack_owner_id) {
      var po = D.customers.find(function(x){return x.id===c.pack_owner_id;});
      sharedBadge = '<span class="badge bb" style="font-size:9px;display:block;margin-top:2px">👥 On '+(po?po.name:'?')+'\'s pack</span>';
    }
    var members = D.customers.filter(function(x){return x.pack_owner_id===c.id;});
    var memberBadge = members.length ? '<span class="badge by" style="font-size:9px;display:block;margin-top:2px">👥 '+members.map(function(m){return m.name;}).join(', ')+'</span>' : '';
    var enrollCoach = c.referred_by_id ? D.coaches.find(function(x){return x.id===c.referred_by_id;}) : null;
    var coachBadge = enrollCoach ? '<span class="badge" style="background:#eff6ff;color:#1d4ed8;font-size:9px;display:block;margin-top:2px">👨‍🏫 '+enrollCoach.name+'</span>' : '';
    var risk = getChurnRisk(c.id);
    var riskBadge = risk.label ? '<span style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:10px;display:block;margin-top:2px;'+(risk.level==='critical'?'background:#fee2e2;color:#b91c1c':'background:#fef9c3;color:#854d0e')+'" title="'+risk.reasons.join(', ')+'">'+risk.label+'</span>' : '';
    var msBadges = getMilestones(c.id).slice(-2).map(function(m){ return '<span class="milestone-badge ms-gold" style="font-size:9px;display:inline-block;margin-top:2px">'+m.icon+' '+m.label+'</span>'; }).join('');
    return '<tr>'
      +'<td><strong>'+c.name+bdayFlag+'</strong>'+noDobBadge+freeDay+sharedBadge+memberBadge+coachBadge+riskBadge+(msBadges?'<div>'+msBadges+'</div>':'')+'</td>'
      +'<td>'+(c.contact||'—')+'</td>'
      +'<td>'+(c.pack_owner_id ? '↗ shared' : (c.pack_type||'—'))+'</td>'
      +'<td>'+(c.pack_owner_id ? '—' : (c.pack_start_date||'—'))+'</td>'
      +'<td><span class="badge '+bdg+'">'+st.used+'/'+st.total+' used</span></td>'
      +'<td>🔥 '+streak+'</td>'
      +'<td>'+refBadge+'</td>'
      +'<td><span class="badge '+(st.active?'bg':'br')+'">'+(st.active?'Active':'Expired')+'</span></td>'
      +'<td><div class="acts">'+waRenew+waReeng+waWeekly
        +'<button class="btn-p" style="font-size:11px;padding:3px 6px;background:#0ea5e9" onclick="showCustomerJourney(\''+c.id+'\')" title="Journey">🎁</button> '
        +'<button class="btn-p" style="font-size:11px;padding:3px 6px;background:#8b5cf6" onclick="openRenewForCustomer(\''+c.id+'\')" title="Renew">🔄</button> '
        +'<button class="btn-p" style="font-size:11px;padding:3px 6px;background:#dc2626" onclick="openRefundModal(\''+c.id+'\')" title="Refund / Cancel Pack">↩</button> '
        +'<button class="btn-p" style="font-size:11px;padding:3px 6px;background:#16a34a" onclick="generateDietPlan(\''+c.id+'\')" title="'+(c.diet_plan?'Regenerate Diet Plan':'Generate Diet Plan')+'">🥗'+(c.diet_plan?' ✓':'')+' Diet</button> '
        +(c.diet_plan?'<button class="btn-p" style="font-size:11px;padding:3px 6px;background:#0891b2" onclick="viewMealCompliance(\''+c.id+'\',\''+c.name+'\')" title="Meal Compliance">📋 Compliance</button> ':'')
        +(c.diet_plan?'<button class="btn-p" style="font-size:11px;padding:3px 6px;background:#7c3aed" onclick="viewDietHistory(\''+c.id+'\',\''+c.name.replace(/'/g,"\\'")+'\')" title="Diet Plan History">📜 History</button> ':'')
        +'<button class="btn-p" style="font-size:11px;padding:3px 6px;background:#f59e0b;border-color:#f59e0b" onclick="openNotesModal(\''+c.id+'\',\''+c.name.replace(/'/g,"\\'")+'\')" title="Notes &amp; Follow-ups">📝 Notes</button> '
        +'<button class="btn-e" onclick="editCustomer(\''+c.id+'\')">Edit</button>'
        +'<button class="btn-e" onclick="convertToCoach(\''+c.id+'\')" style="background:#fef3c7;color:#92400e;border-color:#fcd34d" title="Convert to Coach">⭐ Make Coach</button>'
        +'<button class="btn-d" onclick="delRecord(\'customers\',\''+c.id+'\',\'customers\')">Delete</button>'
      +'</div></td></tr>';
  }).join('');
  var active=_custs.filter(function(c){return getDaysLeft(c).active;}).length;
  var expiring=_custs.filter(function(c){var s=getDaysLeft(c);return s.active&&s.days<=3;}).length;
  var stars=_custs.filter(function(c){return _custs.filter(function(x){return x.referred_by_id===c.id;}).length>=2;}).length;
  document.getElementById('customers-stats').innerHTML=
    '<div class="stat"><div class="stat-l">Total</div><div class="stat-v">'+_custs.length+'</div></div>'+
    '<div class="stat"><div class="stat-l">Active Packs</div><div class="stat-v">'+active+'</div></div>'+
    '<div class="stat"><div class="stat-l">Expired</div><div class="stat-v">'+(_custs.length-active)+'</div></div>'+
    '<div class="stat"><div class="stat-l" style="color:var(--danger)">⚠️ Expiring Soon</div><div class="stat-v" style="color:var(--danger)">'+expiring+'</div></div>'+
    '<div class="stat"><div class="stat-l">⭐ Stars</div><div class="stat-v" style="color:#b07800">'+stars+'</div></div>';
  // Check birthdays
  checkBirthdaysToday();
}

// ══════════════════════════════════════════════
// HOW TO USE GUIDE
// ══════════════════════════════════════════════
var _guideLang = 'en';

var GUIDE_DATA = [
  {
    icon: '🏠',
    en_title: 'Overview Dashboard',
    te_title: 'Overview Dashboard',
    en_steps: [
      'When you open the app, the Overview page opens first.',
      'You can see today\'s attendance count, expiring packs, pending payments, and recent activity.',
      'Use the Quick Action buttons at the top to jump to any section fast.',
      'Revenue cards show this month\'s income, expenses, and net profit.',
      'The 7-day bar chart shows how many customers came each day this week.'
    ],
    te_steps: [
      'App తెరిచినప్పుడు ముందుగా Overview page వస్తుంది.',
      'ఈ రోజు attendance, expire అవుతున్న packs, pending payments అన్నీ ఇక్కడ కనిపిస్తాయి.',
      'పైన ఉన్న Quick Action buttons తో ఏ section కైనా వెంటనే వెళ్ళవచ్చు.',
      'Revenue cards లో ఈ నెల income, expenses, మరియు net profit చూడవచ్చు.',
      'Bar chart లో ఈ వారం రోజువారీ attendance చూడవచ్చు.'
    ],
    en_tip: 'Check this page every morning to know what needs attention today.',
    te_tip: 'ప్రతి రోజు ఉదయం ఈ page చూడండి — ఏం చేయాలో అర్థమవుతుంది.'
  },
  {
    icon: '📞',
    en_title: 'Leads — Track Potential Customers',
    te_title: 'Leads — కొత్త Customers ని Track చేయడం',
    en_steps: [
      'Click "Leads" in the sidebar to open the Leads section.',
      'Click "+ Add Lead" to save a new person\'s name and mobile number.',
      'Set a "Next Follow-up Date" — the date you want to call them.',
      'Every morning, open Leads → "Due Today" tab to see who to call today.',
      'After calling, click "Log Call" → write what they said → set next call date → Save.',
      'If they want to join, click "Convert to Customer" — their details move to the Customers form automatically.',
      'If they said "call me next Friday", type that date in "Next Call Date" when logging the call.'
    ],
    te_steps: [
      'Sidebar లో "Leads" click చేయండి.',
      '"+ Add Lead" button తో కొత్త person పేరు మరియు mobile number save చేయండి.',
      '"Next Follow-up Date" set చేయండి — ఆ రోజు call చేయాలని reminder వస్తుంది.',
      'ప్రతి ఉదయం Leads → "Due Today" tab చూడండి — ఈ రోజు ఎవరికి call చేయాలో కనిపిస్తుంది.',
      'Call చేసిన తర్వాత "Log Call" click చేయండి → ఏం చెప్పారో రాయండి → తదుపరి call date set చేయండి → Save.',
      'Join అవ్వాలని అంటే "Convert to Customer" click చేయండి — వారి details automatically Customer form లో వస్తాయి.',
      '"వచ్చే Friday call చేయండి" అంటే, Log Call లో ఆ date type చేయండి.'
    ],
    en_tip: 'A red banner appears at the top if you have overdue follow-ups — don\'t ignore it!',
    te_tip: 'Overdue follow-ups ఉంటే top లో red banner కనిపిస్తుంది — దాన్ని ignore చేయకండి!'
  },
  {
    icon: '👤',
    en_title: 'Customers — Add & Manage Members',
    te_title: 'Customers — Members ని Add & Manage చేయడం',
    en_steps: [
      'Click "Customers" in the sidebar.',
      'Click "+ Add Customer" to add a new member with their name, mobile, pack type, and start date.',
      'The "Days Left" column shows how many days remain in their pack.',
      'Red badge means pack is expiring soon — remind them to renew.',
      'Click "Edit" on any customer to update their details or renew their pack.',
      'The "Referred By" field tracks who brought them — that person earns coupon points.'
    ],
    te_steps: [
      'Sidebar లో "Customers" click చేయండి.',
      '"+ Add Customer" button తో కొత్త member పేరు, mobile, pack type, start date add చేయండి.',
      '"Days Left" column లో pack ఎన్ని రోజులు మిగిలిందో కనిపిస్తుంది.',
      'Red badge వస్తే pack expire అవుతోందని అర్థం — వారికి renew చేయమని చెప్పండి.',
      'ఏ customer ను అయినా "Edit" click చేసి details update చేయవచ్చు లేదా pack renew చేయవచ్చు.',
      '"Referred By" field లో ఎవరు తీసుకొచ్చారో mention చేయండి — వారికి coupon points వస్తాయి.'
    ],
    en_tip: 'Stars (⭐) next to a customer name mean they referred others — reward them with coupons!',
    te_tip: 'Customer పేరు పక్కన ⭐ ఉంటే వారు others ని refer చేశారని అర్థం — వారికి coupons ఇవ్వండి!'
  },
  {
    icon: '📅',
    en_title: 'Attendance — Mark Daily Check-ins',
    te_title: 'Attendance — రోజువారీ Attendance వేయడం',
    en_steps: [
      'Click "Attendance" in the sidebar.',
      'You see two lists — "Present Today" (green) and "Not Yet" (red).',
      'Find the customer in the "Not Yet" list and click the green ✓ button to mark them present.',
      'To send a WhatsApp message after marking, click the WhatsApp button on their card.',
      'Use the "Monthly Grid" tab to see the full month\'s attendance for all customers.'
    ],
    te_steps: [
      'Sidebar లో "Attendance" click చేయండి.',
      'రెండు lists కనిపిస్తాయి — "Present Today" (green) మరియు "Not Yet" (red).',
      '"Not Yet" list లో customer ని కనుగొని green ✓ button click చేసి present mark చేయండి.',
      'Mark చేసిన తర్వాత WhatsApp button click చేస్తే వారికి message వెళ్ళిపోతుంది.',
      '"Monthly Grid" tab లో ఒక నెల మొత్తం attendance చూడవచ్చు.'
    ],
    en_tip: 'Mark attendance every day without fail — this helps track streaks and pack usage accurately.',
    te_tip: 'ప్రతి రోజూ attendance mark చేయండి — streaks మరియు pack usage సరిగ్గా track అవుతుంది.'
  },
  {
    icon: '💰',
    en_title: 'Finance — Track Income & Expenses',
    te_title: 'Finance — Income & Expenses Track చేయడం',
    en_steps: [
      'Click "Finance" in the sidebar.',
      'Click "+ Add Entry" to record any income (pack fee, product sale) or expense (rent, supplies).',
      'Select "Income" or "Expense" from the type dropdown.',
      'The totals at the top update automatically.',
      'Use the date filter to see a specific month\'s records.'
    ],
    te_steps: [
      'Sidebar లో "Finance" click చేయండి.',
      '"+ Add Entry" click చేసి income (pack fee, product sale) లేదా expense (rent, supplies) record చేయండి.',
      'Type dropdown లో "Income" లేదా "Expense" select చేయండి.',
      'Totals పైన automatically update అవుతాయి.',
      'Date filter తో specific నెల records చూడవచ్చు.'
    ],
    en_tip: 'Record every transaction the same day — don\'t leave it for later or you\'ll forget.',
    te_tip: 'ప్రతి transaction అదే రోజు record చేయండి — తర్వాత చేద్దాం అని వదిలేస్తే మర్చిపోతారు.'
  },
  {
    icon: '🎟️',
    en_title: 'Coupons — Reward Referrals',
    te_title: 'Coupons — Referrals కి Reward ఇవ్వడం',
    en_steps: [
      'Coupons are earned automatically when a customer refers someone new.',
      '+1 coupon when they invite someone, +3 coupons if that person takes a pack.',
      'Click "Coupons" in the sidebar to see everyone\'s coupon balance.',
      'To redeem coupons, click "+ Redeem" and select the person.',
      'Coupons can be held by both coaches and customers.'
    ],
    te_steps: [
      'Customer ఎవరైనా కొత్త person ని refer చేస్తే automatically coupons వస్తాయి.',
      'Invite చేస్తే +1 coupon, ఆ person pack తీసుకుంటే +3 coupons వస్తాయి.',
      'Sidebar లో "Coupons" click చేస్తే అందరి coupon balance కనిపిస్తుంది.',
      'Redeem చేయాలంటే "+ Redeem" click చేసి person select చేయండి.',
      'Coaches మరియు customers ఇద్దరూ coupons earn చేయవచ్చు.'
    ],
    en_tip: 'Tell every customer: "Refer a friend and earn free coupons!" — it\'s the best way to grow.',
    te_tip: 'ప్రతి customer కి చెప్పండి: "Friend ని refer చేస్తే free coupons వస్తాయి!" — ఇది center grow అవ్వడానికి best way.'
  },
  {
    icon: '💬',
    en_title: 'WhatsApp Messages',
    te_title: 'WhatsApp Messages పంపడం',
    en_steps: [
      'WhatsApp buttons appear on Customer cards, Attendance cards, and Lead cards.',
      'Clicking WhatsApp opens a pre-written message in WhatsApp with their number.',
      'Messages are customized automatically — renewal reminders, milestone congratulations, birthday wishes.',
      'You can edit the message before sending if needed.',
      'No extra app needed — it opens directly in WhatsApp Web or your phone.'
    ],
    te_steps: [
      'Customer cards, Attendance cards, మరియు Lead cards లో WhatsApp buttons ఉంటాయి.',
      'WhatsApp button click చేస్తే వారి number తో pre-written message WhatsApp లో తెరుచుకుంటుంది.',
      'Messages automatically customize అవుతాయి — renewal reminders, milestones, birthday wishes.',
      'పంపే ముందు message edit చేయవచ్చు.',
      'Extra app అవసరం లేదు — directly WhatsApp Web లేదా phone లో తెరుచుకుంటుంది.'
    ],
    en_tip: 'Send a WhatsApp message to every new customer on their joining day — it makes them feel welcome!',
    te_tip: 'కొత్త customer join అయిన రోజే WhatsApp message పంపండి — వారికి చాలా special feel అవుతుంది!'
  },
  {
    icon: '📊',
    en_title: 'Analytics & Reports',
    te_title: 'Analytics & Reports చూడడం',
    en_steps: [
      'Click "Analytics" in the sidebar to see charts and reports.',
      'See monthly revenue trends, attendance patterns, and top customers.',
      'Use "Biz Analyst" for AI-powered weekly business summaries.',
      'Filter by center or date range to focus on specific data.'
    ],
    te_steps: [
      'Sidebar లో "Analytics" click చేయండి.',
      'Monthly revenue trends, attendance patterns, మరియు top customers చూడవచ్చు.',
      '"Biz Analyst" లో AI weekly business summary చూడవచ్చు.',
      'Center లేదా date range filter చేసి specific data చూడవచ్చు.'
    ],
    en_tip: 'Check Analytics every Sunday to plan the coming week.',
    te_tip: 'ప్రతి Sunday Analytics చూడండి — next week ఏం చేయాలో plan చేయవచ్చు.'
  }
];

function setGuideLang(lang) {
  _guideLang = lang;
  document.getElementById('guide-lang-en').style.background = lang === 'en' ? 'var(--primary)' : 'transparent';
  document.getElementById('guide-lang-en').style.color = lang === 'en' ? '#fff' : 'var(--muted)';
  document.getElementById('guide-lang-te').style.background = lang === 'te' ? 'var(--primary)' : 'transparent';
  document.getElementById('guide-lang-te').style.color = lang === 'te' ? '#fff' : 'var(--muted)';
  renderGuide();
}

function renderGuide() {
  var lang = _guideLang;
  var html = '';
  GUIDE_DATA.forEach(function(item, idx) {
    var title = lang === 'te' ? item.te_title : item.en_title;
    var steps = lang === 'te' ? item.te_steps : item.en_steps;
    var tip = lang === 'te' ? item.te_tip : item.en_tip;
    var stepsHtml = steps.map(function(s, i) {
      return '<div class="guide-step"><div class="guide-step-num">'+(i+1)+'</div><div>'+s+'</div></div>';
    }).join('');
    html += '<div class="guide-card" id="guide-card-'+idx+'">' +
      '<div class="guide-card-header" onclick="toggleGuideCard('+idx+')">' +
        '<div class="guide-card-icon">'+item.icon+'</div>' +
        '<div class="guide-card-title">'+title+'</div>' +
        '<span class="guide-card-arrow">▶</span>' +
      '</div>' +
      '<div class="guide-card-body">' +
        stepsHtml +
        '<div class="guide-tip">💡 '+tip+'</div>' +
      '</div>' +
    '</div>';
  });
  document.getElementById('guide-content').innerHTML = html;
}

function toggleGuideCard(idx) {
  var card = document.getElementById('guide-card-'+idx);
  card.classList.toggle('open');
}

// ══════════════════════════════════════════════
// PROMOTE TO SUPERVISOR / OPEN NEW CENTER
// ══════════════════════════════════════════════

var _promoteStep = 1;
var _promoteCoachId = null;
var _promoteCoachCusts = [];

function openPromoteModal(coachId) {
  var coach = D.coaches.find(function(c){ return c.id === coachId; });
  if(!coach) return;
  _promoteCoachId = coachId;
  document.getElementById('promote-coach-info').innerHTML =
    '🏆 Promoting <strong>'+coach.name+'</strong> to Supervisor'
    +(coach.herbalife_pin?' &nbsp;·&nbsp; Current pin: <span style="background:#e8f4fd;color:var(--primary);padding:2px 8px;border-radius:10px;font-size:12px">'+coach.herbalife_pin+'</span>':'')
    +(coach.contact?'<br><span style="font-size:12px;color:var(--muted);margin-top:4px;display:block">📞 '+coach.contact+'</span>':'');
  document.getElementById('promote-center-name').value = coach.name+'\'s Wellness Center';
  document.getElementById('promote-center-location').value = '';
  document.getElementById('promote-center-contact').value = coach.contact||'';
  document.getElementById('promote-center-pin').value = '';
  _promoteCoachCusts = D.customers.filter(function(c){
    return c.referred_by_id===coachId || c.coach_id===coachId;
  });
  promoteShowStep(1);
  openModal('promote');
}

function promoteShowStep(n) {
  _promoteStep = n;
  [1,2,3].forEach(function(i){
    document.getElementById('promote-step-'+i).style.display = i===n?'block':'none';
    var s = document.getElementById('ps-'+i);
    s.style.background = i===n?'var(--primary)':(i<n?'var(--success)':'var(--surface2)');
    s.style.color = i<=n?'#fff':'var(--muted)';
  });
  document.getElementById('promote-back-btn').style.display = n>1?'block':'none';
  var btn = document.getElementById('promote-next-btn');
  btn.disabled = false;
  if(n===1) btn.textContent='Next → Select Customers';
  else if(n===2) btn.textContent='Next → Review';
  else btn.textContent='✅ Confirm & Create Center';
  if(n===2) renderPromoteCustList();
  if(n===3) renderPromoteSummary();
}

function renderPromoteCustList() {
  var el = document.getElementById('promote-cust-list');
  document.getElementById('promote-cust-count').textContent = _promoteCoachCusts.length+' customer(s) linked to this coach';
  if(!_promoteCoachCusts.length){
    el.innerHTML='<div style="padding:24px;text-align:center;color:var(--muted);font-size:13px">No customers referred by or assigned to this coach.</div>';
    return;
  }
  el.innerHTML = _promoteCoachCusts.map(function(c){
    var st = getDaysLeft(c);
    var reason = (c.referred_by_id===_promoteCoachId&&c.coach_id===_promoteCoachId)?'Referred + Assigned'
      :c.referred_by_id===_promoteCoachId?'Referred by coach':'Assigned to coach';
    return '<label style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid var(--border);cursor:pointer">'
      +'<input type="checkbox" class="promote-cust-cb" value="'+c.id+'" style="width:16px;height:16px;accent-color:var(--primary);cursor:pointer">'
      +'<div style="flex:1">'
        +'<div style="font-weight:600;font-size:14px">'+c.name+'</div>'
        +'<div style="font-size:12px;color:var(--muted);margin-top:2px">'+(c.contact||'No contact')+' &nbsp;·&nbsp; '+(c.pack_type||'No pack')
        +'<span style="margin-left:8px;background:#f0f4ff;color:#3b4fcf;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:600">'+reason+'</span></div>'
      +'</div>'
      +'<span class="badge '+(st.active?'bg':'br')+'" style="font-size:10px;white-space:nowrap">'+(st.active?st.days+'d left':'Expired')+'</span>'
      +'</label>';
  }).join('');
}

function promoteSelectAll(val) {
  document.querySelectorAll('.promote-cust-cb').forEach(function(cb){ cb.checked=val; });
}

function renderPromoteSummary() {
  var centerName = document.getElementById('promote-center-name').value.trim();
  var location = document.getElementById('promote-center-location').value.trim();
  var selected = Array.from(document.querySelectorAll('.promote-cust-cb:checked')).map(function(cb){return cb.value;});
  var selectedCusts = _promoteCoachCusts.filter(function(c){return selected.indexOf(c.id)!==-1;});
  var coach = D.coaches.find(function(c){return c.id===_promoteCoachId;});
  document.getElementById('promote-summary').innerHTML =
    '<div style="background:#f0fdf4;border:1px solid #a7f3d0;border-radius:12px;padding:18px;margin-bottom:14px">'
    +'<div style="font-size:15px;font-weight:700;color:#065f46;margin-bottom:12px">✅ What will happen:</div>'
    +'<div style="display:flex;flex-direction:column;gap:10px;font-size:13px">'
    +'<div>🏢 New <strong>Downline Center</strong> created: <strong>'+centerName+'</strong>'+(location?' in <strong>'+location+'</strong>':'')+'</div>'
    +'<div>👤 <strong>'+(coach?coach.name:'Coach')+'</strong> set as owner of the new center</div>'
    +'<div>🏅 Coach pin updated to <span style="background:#e8f4fd;color:var(--primary);padding:2px 8px;border-radius:10px;font-weight:700">Supervisor</span></div>'
    +(selectedCusts.length
      ?'<div>👥 <strong>'+selectedCusts.length+' customer(s)</strong> will move to '+centerName+':<br><div style="margin-top:6px;padding-left:16px;line-height:1.9">'+selectedCusts.map(function(c){return '• '+c.name+(c.contact?' <span style="color:var(--muted);font-size:11px">'+c.contact+'</span>':'');}).join('<br>')+'</div></div>'
      :'<div style="color:var(--muted)">👥 No customers selected to move — all stay in your center</div>')
    +'</div></div>'
    +'<div style="background:#fef9c3;border:1px solid #fde047;border-radius:10px;padding:12px 16px;font-size:12px;color:#854d0e">'
    +'⚠️ The coach stays in your coaches list as a Downline connection. Customers who don\'t move remain in your center.'
    +'</div>';
}

function promoteBack() {
  if(_promoteStep>1) promoteShowStep(_promoteStep-1);
}

function promoteNext() {
  if(_promoteStep===1){
    var name=document.getElementById('promote-center-name').value.trim();
    var loc=document.getElementById('promote-center-location').value.trim();
    var pin=document.getElementById('promote-center-pin').value.trim();
    if(!name){showToast('Center name is required','error');return;}
    if(!loc){showToast('City / Location is required','error');return;}
    if(pin&&!/^\d{4}$/.test(pin)){showToast('PIN must be exactly 4 digits','error');return;}
    promoteShowStep(2);
  } else if(_promoteStep===2){
    promoteShowStep(3);
  } else {
    executePromotion();
  }
}

async function executePromotion() {
  var coach = D.coaches.find(function(c){return c.id===_promoteCoachId;});
  if(!coach) return;
  getCredentials();
  if(!getActiveSbUrl()||!getActiveSbKey()){showToast('Supabase not configured','error');return;}
  var centerName=document.getElementById('promote-center-name').value.trim();
  var location=document.getElementById('promote-center-location').value.trim();
  var contact=document.getElementById('promote-center-contact').value.trim();
  var pin=document.getElementById('promote-center-pin').value.trim();
  var selected=Array.from(document.querySelectorAll('.promote-cust-cb:checked')).map(function(cb){return cb.value;});
  var btn=document.getElementById('promote-next-btn');
  btn.disabled=true; btn.textContent='⏳ Processing…';
  try{
    // 1. Create new Downline center
    var networkId=generateNetworkId(centerName);
    var centerPayload={name:centerName,location:location,contact:contact||null,type:'downline',owner_id:_promoteCoachId,center_pin:pin||null,network_id:networkId};
    var newCenterArr=await dbInsert('wellness_centers',centerPayload);
    var newCenterId=Array.isArray(newCenterArr)&&newCenterArr[0]?newCenterArr[0].id:null;
    // 2. Update coach pin to Supervisor
    await dbUpdate('coaches',_promoteCoachId,{herbalife_pin:'Supervisor'});
    // 3. Move selected customers to new center
    if(selected.length&&newCenterId){
      await Promise.all(selected.map(function(cid){return dbUpdate('customers',cid,{wellness_center_id:newCenterId});}));
    }
    auditLog('Promoted','Coach',coach.name+' → Supervisor · New center: '+centerName+' ('+location+')'+(selected.length?' · '+selected.length+' customers moved':''));
    showToast('🎉 '+coach.name+' promoted! New center created in '+location+(selected.length?' with '+selected.length+' customer(s)':'')+'.','success');
    closeModal('promote');
    await Promise.all([loadCenters(),loadCoaches(),loadCustomers()]);
    renderOverview();
  }catch(e){
    btn.disabled=false; btn.textContent='✅ Confirm & Create Center';
    showToast('Error: '+e.message,'error');
  }
}

// ══════════════════════════════════════════════
// WALK-INS
// ══════════════════════════════════════════════

async function loadWalkins() {
  var filter = ACTIVE_CENTER ? 'wellness_center_id=eq.'+ACTIVE_CENTER : '';
  D.walkins = await dbGet('walkins', 'created_at', filter);
  renderWalkins();
  updateCustSelects();
  updateBodyCustSelect();
}

function renderWalkins() {
  var q = ((document.getElementById('walkins-search')||{}).value||'').toLowerCase();
  var filterOutcome = (document.getElementById('walkins-filter-outcome')||{}).value||'';
  var filterDate = (document.getElementById('walkins-filter-date')||{}).value||'';
  var all = D.walkins || [];
  var today = new Date().toISOString().slice(0,10);

  // Stats
  var si = document.getElementById('wi-stat-today'); if(si) si.textContent = all.filter(function(w){return w.date===today;}).length;
  si = document.getElementById('wi-stat-checkup'); if(si) si.textContent = all.filter(function(w){return w.outcome==='checkup';}).length;
  si = document.getElementById('wi-stat-trial'); if(si) si.textContent = all.filter(function(w){return w.outcome==='trial';}).length;
  si = document.getElementById('wi-stat-sale'); if(si) si.textContent = all.filter(function(w){return w.outcome==='product_sale';}).length;
  si = document.getElementById('wi-stat-converted'); if(si) si.textContent = all.filter(function(w){return w.converted;}).length;

  var rows = all.filter(function(w) {
    if(filterOutcome && w.outcome !== filterOutcome) return false;
    if(filterDate && w.date !== filterDate) return false;
    return (w.name||'').toLowerCase().includes(q) || (w.phone||'').includes(q);
  }).sort(function(a,b){return (b.date||'').localeCompare(a.date||'');});

  var tb = document.getElementById('walkins-body');
  if(!rows.length){
    tb.innerHTML='<tr><td colspan="8"><div class="empty"><div class="ei">🚶</div><p>No walk-ins yet. Add your first visitor!</p></div></td></tr>';
    return;
  }
  var SRC = {google:'🔍 Google',customer_referral:'👤 Customer',coach_referral:'👨‍🏫 Coach',owner:'🏢 Owner',other:'Other'};
  var OUT = {checkup:'🔬 Checkup',trial:'📦 Trial Pack',product_sale:'🛒 Product Sale',other:'Other'};
  var OUT_COL = {checkup:'#1d4ed8',trial:'#b07800',product_sale:'#16a34a',other:'var(--muted)'};
  tb.innerHTML = rows.map(function(w) {
    var refName = w.referred_by_name || (w.referred_by_id ? (findPerson&&findPerson(w.referred_by_id)||'') : '');
    var srcLbl = (SRC[w.source]||w.source||'—') + (refName ? '<br><span style="font-size:11px;color:var(--muted)">'+refName+'</span>' : '');
    var outLbl = '<span style="font-weight:600;color:'+(OUT_COL[w.outcome]||'var(--muted)')+'">'+( OUT[w.outcome]||w.outcome||'—')+'</span>'+(w.product_details?'<br><span style="font-size:11px;color:var(--muted)">'+w.product_details+'</span>':'');
    var amt = (w.outcome==='checkup') ? '<span style="color:var(--success);font-size:11px;font-weight:600">Free</span>' : (w.amount_received ? '₹'+Number(w.amount_received).toLocaleString('en-IN') : '—');
    var waBtn = w.phone ? '<a class="wa-btn" href="https://api.whatsapp.com/send?phone='+COUNTRY_CODE+w.phone.replace(/\D/g,'')+'&text=Hi+'+encodeURIComponent(w.name||'')+',+thank+you+for+visiting+our+wellness+center!+We+hope+to+see+you+again+soon+%F0%9F%8C%BF" target="_blank" rel="noopener" style="font-size:11px;padding:3px 7px;text-decoration:none">💬 WA</a>' : '';
    var convertBtn = w.converted
      ? '<span class="badge bg" style="font-size:10px">✅ Customer</span>'
      : '<button class="btn-p" style="font-size:11px;padding:3px 7px;background:#8b5cf6" onclick="convertWalkinToCustomer(\''+w.id+'\')">👤 Convert</button>';
    return '<tr>'
      +'<td>'+( w.date||'—')+'</td>'
      +'<td><strong>'+(w.name||'—')+'</strong>'+(w.pincode?'<br><span style="font-size:11px;color:var(--muted)">📍 '+w.pincode+'</span>':'')+'</td>'
      +'<td>'+(w.phone||'—')+'</td>'
      +'<td>'+srcLbl+'</td>'
      +'<td>'+outLbl+'</td>'
      +'<td>'+amt+'</td>'
      +'<td style="max-width:140px;font-size:12px;color:var(--muted)">'+(w.notes||'—')+'</td>'
      +'<td><div class="acts">'+waBtn+' '+convertBtn+' <button class="btn-e" onclick="openWalkinModal(\''+w.id+'\')">Edit</button> <button class="btn-e" style="background:#fee2e2;color:#dc2626;border-color:#fca5a5" onclick="deleteWalkin(\''+w.id+'\')">🗑</button></div></td>'
      +'</tr>';
  }).join('');
}

function openWalkinModal(id) {
  ['walkin-id','walkin-finance-id','walkin-name','walkin-phone','walkin-pincode','walkin-notes','walkin-product'].forEach(function(f){
    var el=document.getElementById(f); if(el) el.value='';
  });
  document.getElementById('walkin-date').value = new Date().toISOString().slice(0,10);
  document.getElementById('walkin-source').value='';
  document.getElementById('walkin-outcome').value='';
  document.getElementById('walkin-amount').value='';
  document.getElementById('walkin-referred-by-id').value='';
  document.getElementById('sd-walkin-ref-input').value='';
  document.getElementById('walkin-referred-wrap').style.display='none';
  document.getElementById('walkin-amount-wrap').style.display='none';
  document.getElementById('walkin-modal-title').textContent='🚶 Add Walk-in';
  if(id) {
    var w=(D.walkins||[]).find(function(x){return x.id===id;});
    if(w){
      document.getElementById('walkin-modal-title').textContent='✏️ Edit Walk-in';
      document.getElementById('walkin-id').value=w.id;
      document.getElementById('walkin-finance-id').value=w.finance_id||'';
      document.getElementById('walkin-date').value=w.date||'';
      document.getElementById('walkin-name').value=w.name||'';
      document.getElementById('walkin-phone').value=w.phone||'';
      document.getElementById('walkin-pincode').value=w.pincode||'';
      document.getElementById('walkin-source').value=w.source||'';
      document.getElementById('walkin-outcome').value=w.outcome||'';
      document.getElementById('walkin-amount').value=w.amount_received||'';
      document.getElementById('walkin-product').value=w.product_details||'';
      document.getElementById('walkin-notes').value=w.notes||'';
      if(w.referred_by_id){ document.getElementById('walkin-referred-by-id').value=w.referred_by_id; }
      if(w.referred_by_name){ document.getElementById('sd-walkin-ref-input').value=w.referred_by_name; }
      onWalkinSourceChange(); onWalkinOutcomeChange();
    }
  }
  openModal('walkin');
}

function onWalkinSourceChange(){
  var src=document.getElementById('walkin-source').value;
  document.getElementById('walkin-referred-wrap').style.display=(src==='customer_referral'||src==='coach_referral')?'block':'none';
  // Clear previous selection
  document.getElementById('walkin-referred-by-id').value='';
  document.getElementById('sd-walkin-ref-input').value='';
  // Filter dropdown to only customers or only coaches from the active center
  var persons=[];
  if(src==='customer_referral'){
    persons=(D.customers||[]).filter(function(c){
      return !ACTIVE_CENTER||c.wellness_center_id===ACTIVE_CENTER;
    }).map(function(c){return{id:c.id,label:c.name};});
  } else if(src==='coach_referral'){
    persons=(D.coaches||[]).filter(function(c){
      return !ACTIVE_CENTER||c.wellness_center_id===ACTIVE_CENTER;
    }).map(function(c){return{id:c.id,label:c.name+' 👨‍🏫'};});
  }
  sdSetItems('walkin-ref',persons);
}
function onWalkinOutcomeChange(){
  var out=document.getElementById('walkin-outcome').value;
  document.getElementById('walkin-amount-wrap').style.display=(out==='trial'||out==='product_sale')?'block':'none';
}

async function saveWalkin(){
  var name=(document.getElementById('walkin-name').value||'').trim();
  if(!name){showToast('Name is required','error');return;}
  var id=document.getElementById('walkin-id').value;
  var src=document.getElementById('walkin-source').value;
  var isRef=src==='customer_referral'||src==='coach_referral';
  var refId=document.getElementById('walkin-referred-by-id').value;
  var refName=document.getElementById('sd-walkin-ref-input').value.trim();
  var data={
    date:document.getElementById('walkin-date').value,
    name:name,
    phone:(document.getElementById('walkin-phone').value||'').trim(),
    pincode:(document.getElementById('walkin-pincode').value||'').trim(),
    source:src,
    referred_by_id:isRef&&refId?refId:null,
    referred_by_name:isRef&&refName?refName:null,
    outcome:document.getElementById('walkin-outcome').value,
    amount_received:Number(document.getElementById('walkin-amount').value)||0,
    product_details:(document.getElementById('walkin-product').value||'').trim(),
    notes:(document.getElementById('walkin-notes').value||'').trim(),
    wellness_center_id:ACTIVE_CENTER||null
  };
  getCredentials(); if(!getActiveSbUrl()||!getActiveSbKey()){showToast('Supabase not configured','error');return;}
  var existingFinanceId = document.getElementById('walkin-finance-id') ? document.getElementById('walkin-finance-id').value : '';
  var hasAmount = data.outcome === 'product_sale' && data.amount_received > 0;
  var finDesc = 'Walk-in product sale — ' + name + (data.product_details ? ' (' + data.product_details + ')' : '');
  try{
    if(id){
      // ── Edit mode ──
      await dbUpdate('walkins', id, data);
      if(existingFinanceId && hasAmount){
        // Update existing finance record
        await dbUpdate('finance', existingFinanceId, {description:finDesc, amount:data.amount_received, date:data.date, wellness_center_id:data.wellness_center_id||null});
        showToast('Walk-in & finance updated ✅','success');
      } else if(existingFinanceId && !hasAmount){
        // Amount removed or outcome changed — delete finance record
        await dbDelete('finance', existingFinanceId);
        await dbUpdate('walkins', id, {finance_id: null});
        showToast('Walk-in updated (finance entry removed)','success');
      } else if(!existingFinanceId && hasAmount){
        // Amount newly added on edit — create finance record and link it
        var newFin = await dbInsert('finance',{type:'income',description:finDesc,amount:data.amount_received,category:'Walk-in product sale',date:data.date,wellness_center_id:data.wellness_center_id||null});
        if(newFin && newFin[0] && newFin[0].id) await dbUpdate('walkins', id, {finance_id: newFin[0].id});
        showToast('Walk-in updated · ₹'+data.amount_received.toLocaleString('en-IN')+' added to finance ✅','success');
      } else {
        showToast('Walk-in updated','success');
      }
    } else {
      // ── New entry ──
      var savedWalkin = await dbInsert('walkins', data);
      if(hasAmount){
        var fin = await dbInsert('finance',{type:'income',description:finDesc,amount:data.amount_received,category:'Walk-in product sale',date:data.date,wellness_center_id:data.wellness_center_id||null});
        if(fin && fin[0] && fin[0].id && savedWalkin && savedWalkin[0] && savedWalkin[0].id){
          await dbUpdate('walkins', savedWalkin[0].id, {finance_id: fin[0].id});
        }
        showToast('Walk-in saved · ₹'+data.amount_received.toLocaleString('en-IN')+' added to finance ✅','success');
      } else {
        showToast('Walk-in saved ✅','success');
      }
    }
    await loadFinance();
    closeModal('walkin');
    await loadWalkins();
  }catch(e){showToast('Error: '+e.message,'error');}
}

async function deleteWalkin(id){
  if(!confirm('Delete this walk-in record?'))return;
  getCredentials();
  try{
    var w=(D.walkins||[]).find(function(x){return x.id===id;});
    if(w && w.finance_id) await dbDelete('finance', w.finance_id);
    await dbDelete('walkins',id);
    showToast('Deleted','success');
    await loadWalkins();
    await loadFinance();
  }catch(e){showToast('Error: '+e.message,'error');}
}

function convertWalkinToCustomer(walkinId){
  var w=(D.walkins||[]).find(function(x){return x.id===walkinId;});
  if(!w)return;
  // Store walkin id to mark converted after save
  window._convertingWalkinId=walkinId;
  // Reset and open customer modal pre-filled
  openNewCustomerModal();
  setTimeout(function(){
    document.getElementById('customer-name').value=w.name||'';
    document.getElementById('customer-contact').value=w.phone||'';
    document.getElementById('customer-modal-title').textContent='👤 Add Customer (from Walk-in)';
    if(w.referred_by_id) sdSetSelected('ref',w.referred_by_id,w.referred_by_name||'');
    showToast('Pre-filled from walk-in — complete pack details & save','success');
  },100);
}

// Call this from saveCustomer after a successful save when _convertingWalkinId is set
async function _markWalkinConverted(customerId){
  var wid=window._convertingWalkinId;
  if(!wid)return;
  window._convertingWalkinId=null;
  try{
    await dbUpdate('walkins',wid,{converted:true,converted_customer_id:customerId});
    await loadWalkins();
  }catch(e){}
}

// ══════════════════════════════════════════════
// LEADS
// ══════════════════════════════════════════════

async function loadLeads() {
  D.leads = await dbGet('leads', 'id', _cFilter('center_id'));
  D.leadFollowups = await dbGet('lead_followups', 'called_at');
  renderLeadsStats();
  renderLeads();
  checkOverdueBanner();
}

function checkOverdueBanner() {
  var today = todayStr();
  var overdue = filterLeadsByCenter(D.leads).filter(function(l){
    return l.next_followup_date && l.next_followup_date < today && l.status !== 'Joined' && l.status !== 'Not Interested';
  });
  var banner = document.getElementById('overdue-leads-banner');
  if (!banner) return;
  if (overdue.length > 0) {
    document.getElementById('overdue-banner-text').textContent =
      overdue.length + ' overdue follow-up'+(overdue.length>1?'s':'')+' — these leads are waiting for your call!';
    banner.style.display = 'flex';
  } else {
    banner.style.display = 'none';
  }
}

function gotoOverdueLeads() {
  var navBtn = document.querySelector('.nav-item[onclick*="leads"]');
  if (navBtn) goTo('leads', navBtn);
  setLeadTab('overdue', document.getElementById('ltab-overdue'));
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function filterLeadsByCenter(leads) {
  if (!ACTIVE_CENTER) return leads;
  return leads.filter(function(l){ return l.center_id === ACTIVE_CENTER; });
}

function setLeadTab(tab, el) {
  _leadTab = tab;
  document.querySelectorAll('.lead-tab').forEach(function(b){ b.classList.remove('active'); });
  el.classList.add('active');
  renderLeads();
}

function renderLeadsStats() {
  var today = todayStr();
  var leads = filterLeadsByCenter(D.leads);
  var due = leads.filter(function(l){ return l.next_followup_date === today && l.status !== 'Joined' && l.status !== 'Not Interested'; }).length;
  var overdue = leads.filter(function(l){ return l.next_followup_date && l.next_followup_date < today && l.status !== 'Joined' && l.status !== 'Not Interested'; }).length;
  var called = leads.filter(function(l){ return l.last_called_date === today; }).length;
  var joined = leads.filter(function(l){ return l.status === 'Joined'; }).length;
  document.getElementById('ls-due').textContent = due;
  document.getElementById('ls-called').textContent = called;
  document.getElementById('ls-overdue').textContent = overdue;
  document.getElementById('ls-total').textContent = leads.length;
  document.getElementById('ls-joined').textContent = joined;
}

function renderLeads() {
  var today = todayStr();
  var q = (document.getElementById('leads-search') || {}).value || '';
  q = q.toLowerCase();
  var leads = filterLeadsByCenter(D.leads);

  // filter by tab
  if (_leadTab === 'today') {
    leads = leads.filter(function(l){ return l.next_followup_date === today && l.status !== 'Joined' && l.status !== 'Not Interested'; });
  } else if (_leadTab === 'overdue') {
    leads = leads.filter(function(l){ return l.next_followup_date && l.next_followup_date < today && l.status !== 'Joined' && l.status !== 'Not Interested'; });
  } else if (_leadTab === 'new') {
    leads = leads.filter(function(l){ return l.status === 'New'; });
  } else if (_leadTab === 'interested') {
    leads = leads.filter(function(l){ return l.status === 'Interested'; });
  } else if (_leadTab === 'joined') {
    leads = leads.filter(function(l){ return l.status === 'Joined'; });
  } else if (_leadTab === 'notinterested') {
    leads = leads.filter(function(l){ return l.status === 'Not Interested'; });
  }

  // search filter
  if (q) leads = leads.filter(function(l){
    return (l.name||'').toLowerCase().includes(q) || (l.mobile||'').includes(q);
  });

  var container = document.getElementById('leads-list');
  if (!leads.length) {
    container.innerHTML = '<div class="ov-empty">No leads found for this filter.</div>';
    return;
  }

  var html = '';
  leads.forEach(function(lead) {
    var initial = (lead.name||'?')[0].toUpperCase();
    var st = lead.status || 'New';
    var stKey = st.toLowerCase().replace(/\s/g,'');
    var statusBadge = '<span class="badge lead-status-'+stKey+'" style="font-size:11px">'+st+'</span>';

    var nfd = lead.next_followup_date;
    var nextLabel = '', nextClass = 'none';
    if (nfd) {
      if (nfd === today) { nextLabel = 'Call Today'; nextClass = 'today'; }
      else if (nfd < today) { nextLabel = 'Overdue: '+nfd; nextClass = 'overdue'; }
      else { nextLabel = 'Next: '+nfd; nextClass = 'future'; }
    } else {
      nextLabel = 'No follow-up set';
    }

    var cardClass = 'lead-card';
    if (nfd === today && st !== 'Joined') cardClass += ' due-today';
    else if (nfd && nfd < today && st !== 'Joined') cardClass += ' overdue';
    else if (st === 'Joined') cardClass += ' joined';

    var fuCount = D.leadFollowups.filter(function(f){ return f.lead_id === lead.id; }).length;
    var centerName = '';
    var ctr = D.centers.find(function(c){ return c.id === lead.center_id; });
    if (ctr) centerName = '<span style="font-size:11px;color:var(--muted)">'+ctr.name+'</span> &bull; ';

    var convertBtn = (st === 'Interested') ?
      '<button class="btn-p" style="font-size:11px;padding:5px 10px;background:var(--success)" onclick="convertLeadToCustomer(\''+lead.id+'\')">Convert to Customer</button>' : '';

    var waBtn = lead.mobile ?
      '<button class="btn-e" style="font-size:11px;padding:5px 10px;background:#25D366;color:#fff;border:none;border-radius:6px;cursor:pointer" onclick="window.open(\'https://api.whatsapp.com/send?phone=\'+COUNTRY_CODE+\''+lead.mobile+'\',\'_blank\')">WhatsApp</button>' : '';

    html += '<div class="'+cardClass+'" id="lead-card-'+lead.id+'">'+
      '<div class="lead-avatar">'+initial+'</div>'+
      '<div class="lead-info">'+
        '<div class="lead-name">'+lead.name+'</div>'+
        '<div class="lead-mobile">'+centerName+(lead.mobile||'No mobile')+(lead.source ? ' &bull; via '+lead.source : '')+'</div>'+
        '<div class="lead-meta">'+
          statusBadge+
          '<span class="lead-next '+nextClass+'">'+nextLabel+'</span>'+
          (fuCount ? '<span style="font-size:11px;color:var(--muted)">'+fuCount+' call'+(fuCount>1?'s':'')+'</span>' : '')+
        '</div>'+
        (lead.notes ? '<div style="font-size:11px;color:var(--muted);margin-top:4px;font-style:italic">'+lead.notes+'</div>' : '')+
        '<div class="lead-acts">'+
          '<button class="btn-p" style="font-size:11px;padding:5px 10px" onclick="openFollowupModal(\''+lead.id+'\')">Log Call</button>'+
          '<button class="btn-e" style="font-size:11px;padding:5px 10px" onclick="openLeadHistory(\''+lead.id+'\')">History ('+fuCount+')</button>'+
          waBtn+
          convertBtn+
          '<button class="btn-e" style="font-size:11px;padding:5px 10px" onclick="openLeadModal(\''+lead.id+'\')">Edit</button>'+
          '<button class="btn-d" style="font-size:11px;padding:5px 10px" onclick="delLead(\''+lead.id+'\')">Delete</button>'+
        '</div>'+
      '</div>'+
    '</div>';
  });
  container.innerHTML = html;
}

function updateLeadCenterSel() {
  var sel = document.getElementById('lead-center-sel');
  if (!sel) return;
  var cur = sel.value;
  sel.innerHTML = '<option value="">Select center</option>';
  D.centers.forEach(function(c){ sel.innerHTML += '<option value="'+c.id+'">'+(c.name||c.id)+'</option>'; });
  if (cur) sel.value = cur;
  if (!sel.value && ACTIVE_CENTER) sel.value = ACTIVE_CENTER;
}

function openLeadModal(id) {
  document.getElementById('lead-modal-title').textContent = id ? 'Edit Lead' : 'Add Lead';
  document.getElementById('lead-id').value = id || '';
  updateLeadCenterSel();
  if (id) {
    var lead = D.leads.find(function(l){ return l.id === id; });
    if (!lead) return;
    document.getElementById('lead-name').value = lead.name || '';
    document.getElementById('lead-mobile').value = lead.mobile || '';
    document.getElementById('lead-center-sel').value = lead.center_id || '';
    document.getElementById('lead-status').value = lead.status || 'New';
    document.getElementById('lead-source').value = lead.source || '';
    document.getElementById('lead-next-date').value = lead.next_followup_date || '';
    document.getElementById('lead-notes').value = lead.notes || '';
  } else {
    document.getElementById('lead-next-date').value = todayStr();
    if (ACTIVE_CENTER) document.getElementById('lead-center-sel').value = ACTIVE_CENTER;
  }
  document.getElementById('modal-lead').classList.add('open');
}

async function saveLead() {
  getCredentials();
  if (!getActiveSbUrl()) { showToast('Not connected — please set up your Supabase credentials first', 'error'); return; }
  var id = document.getElementById('lead-id').value;
  var name = document.getElementById('lead-name').value.trim();
  var mobile = document.getElementById('lead-mobile').value.trim();
  if (!name) { showToast('Name is required', 'error'); return; }
  var data = {
    name: name,
    mobile: mobile,
    center_id: document.getElementById('lead-center-sel').value || null,
    status: document.getElementById('lead-status').value,
    source: document.getElementById('lead-source').value.trim(),
    next_followup_date: document.getElementById('lead-next-date').value || null,
    notes: document.getElementById('lead-notes').value.trim()
  };
  try {
    if (id) {
      await dbUpdate('leads', id, data);
      var idx = D.leads.findIndex(function(l){ return l.id === id; });
      if (idx !== -1) D.leads[idx] = Object.assign(D.leads[idx], data);
    } else {
      // Duplicate check — match by mobile (if given) or exact name
      var duplicate = D.leads.find(function(l) {
        if (mobile && l.mobile && l.mobile.trim() === mobile) return true;
        if (!mobile && l.name.trim().toLowerCase() === name.toLowerCase()) return true;
        return false;
      });
      if (duplicate) {
        showToast('Lead already exists: ' + duplicate.name + (duplicate.mobile ? ' (' + duplicate.mobile + ')' : ''), 'error');
        return;
      }
      var res = await dbInsert('leads', data);
      if (Array.isArray(res) && res[0]) D.leads.unshift(res[0]);
    }
    closeModal('lead');
    renderLeadsStats();
    renderLeads();
    showToast(id ? 'Lead updated' : 'Lead added');
  } catch(e) {
    if (e.message === 'Failed to fetch') {
      showToast('Connection issue — check internet and try again.', 'error');
    } else {
      showToast('Error: '+e.message, 'error');
    }
  }
}

async function delLead(id) {
  if (!confirm('Delete this lead and all follow-up history?')) return;
  try {
    await dbDelete('leads', id);
    D.leads = D.leads.filter(function(l){ return l.id !== id; });
    D.leadFollowups = D.leadFollowups.filter(function(f){ return f.lead_id !== id; });
    renderLeadsStats();
    renderLeads();
    showToast('Lead deleted');
  } catch(e) { showToast('Error: '+e.message, 'error'); }
}

function openFollowupModal(leadId) {
  var lead = D.leads.find(function(l){ return l.id === leadId; });
  if (!lead) return;
  document.getElementById('fu-lead-id').value = leadId;
  document.getElementById('fu-lead-info').innerHTML = '<strong>'+lead.name+'</strong>'+(lead.mobile ? ' — '+lead.mobile : '')+'<br><span style="color:var(--muted);font-size:12px">Current status: '+lead.status+'</span>';
  document.getElementById('fu-date').value = todayStr();
  document.getElementById('fu-note').value = '';
  document.getElementById('fu-status').value = lead.status === 'New' ? 'Contacted' : lead.status;
  // default next date = +7 days
  var d = new Date(); d.setDate(d.getDate()+7);
  document.getElementById('fu-next-date').value = d.toISOString().split('T')[0];
  document.getElementById('modal-followup').classList.add('open');
}

function setFuNextDate(days) {
  var d = new Date(); d.setDate(d.getDate()+days);
  document.getElementById('fu-next-date').value = d.toISOString().split('T')[0];
}

async function saveFollowup() {
  var leadId = document.getElementById('fu-lead-id').value;
  var calledAt = document.getElementById('fu-date').value;
  var note = document.getElementById('fu-note').value.trim();
  var nextDate = document.getElementById('fu-next-date').value || null;
  var newStatus = document.getElementById('fu-status').value;
  if (!calledAt) { showToast('Please set call date', 'error'); return; }
  try {
    // save followup record
    var fuData = { lead_id: leadId, called_at: calledAt, note: note, next_followup_date: nextDate };
    var res = await dbInsert('lead_followups', fuData);
    if (Array.isArray(res) && res[0]) D.leadFollowups.push(res[0]);

    // update lead
    var leadUpdate = { status: newStatus, next_followup_date: nextDate, last_called_date: calledAt };
    await dbUpdate('leads', leadId, leadUpdate);
    var idx = D.leads.findIndex(function(l){ return l.id === leadId; });
    if (idx !== -1) D.leads[idx] = Object.assign(D.leads[idx], leadUpdate);

    closeModal('followup');
    renderLeadsStats();
    renderLeads();
    checkOverdueBanner();
    showToast('Call logged! Next follow-up: '+(nextDate||'not set'));
  } catch(e) { showToast('Error: '+e.message, 'error'); }
}

function openLeadHistory(leadId) {
  var lead = D.leads.find(function(l){ return l.id === leadId; });
  if (!lead) return;
  document.getElementById('lh-title').textContent = 'Follow-up History — '+lead.name;
  document.getElementById('lh-lead-info').innerHTML =
    '<strong>'+lead.name+'</strong>'+(lead.mobile ? ' — '+lead.mobile : '')+
    '<br><span style="color:var(--muted);font-size:12px">Status: '+lead.status+
    (lead.next_followup_date ? ' &bull; Next call: '+lead.next_followup_date : '')+'</span>';

  var fus = D.leadFollowups.filter(function(f){ return f.lead_id === leadId; });
  fus.sort(function(a,b){ return b.called_at > a.called_at ? 1 : -1; });

  var html = '';
  if (!fus.length) {
    html = '<div class="ov-empty">No follow-ups logged yet.</div>';
  } else {
    fus.forEach(function(f){
      html += '<div class="fu-item">'+
        '<div class="fu-date">'+f.called_at+(f.next_followup_date ? ' &rarr; Next: '+f.next_followup_date : '')+'</div>'+
        '<div class="fu-note">'+(f.note || '<em>No note recorded</em>')+'</div>'+
      '</div>';
    });
  }
  document.getElementById('lh-list').innerHTML = html;
  document.getElementById('modal-lead-history').classList.add('open');
}

function convertLeadToCustomer(leadId) {
  var lead = D.leads.find(function(l){ return l.id === leadId; });
  if (!lead) return;
  if (!confirm('Convert "'+lead.name+'" to a customer? This will open the Add Customer form pre-filled.')) return;

  // Mark lead as Joined
  dbUpdate('leads', leadId, { status: 'Joined' }).then(function(){
    var idx = D.leads.findIndex(function(l){ return l.id === leadId; });
    if (idx !== -1) D.leads[idx].status = 'Joined';
    renderLeadsStats();
    renderLeads();
  });

  // Pre-fill customer form and open it
  goTo('customers', document.getElementById('nav-customers'));
  setTimeout(function(){
    openNewCustomerModal();
    setTimeout(function(){
      var nameEl = document.getElementById('customer-name');
      var contactEl = document.getElementById('customer-contact');
      if (nameEl) nameEl.value = lead.name;
      if (contactEl) contactEl.value = lead.mobile || '';
      var centerEl = document.getElementById('customer-center');
      if (centerEl && lead.center_id) centerEl.value = lead.center_id;
    }, 100);
  }, 200);
  showToast('Lead marked as Joined — fill in the customer details');
}

// ══════════════════════════════════════════
//  EXPENSE TRACKER
// ══════════════════════════════════════════
// ── Expense DB helpers ──
function expFromDB(r) {
  var center = D.centers.find(function(c){ return c.id === r.wellness_center_id; });
  return { id: r.id, cat: r.category||'Other', amount: Number(r.amount)||0, desc: r.description||'', date: r.date||'', notes: '', centerId: r.wellness_center_id||'', centerName: center ? center.name : '' };
}
function getExpenses() { return D.expenses; }
async function loadExpenses() {
  var filter = 'type=eq.expense' + (ACTIVE_CENTER ? '&wellness_center_id=eq.' + ACTIVE_CENTER : '');
  var rows = await dbGet('finance', 'date', filter);
  D.expenses = rows.map(expFromDB);
}
async function migrateExpensesFromLocalStorage() {
  var local = JSON.parse(localStorage.getItem('supervisorExpenses') || '[]');
  if (!local.length) return;
  var existingIds = D.expenses.map(function(e){ return e.id; });
  var toMigrate = local.filter(function(e){ return !existingIds.includes(e.id); });
  if (!toMigrate.length) { localStorage.removeItem('supervisorExpenses'); return; }
  showToast('Migrating ' + toMigrate.length + ' expenses to cloud...', 'info');
  for (var i = 0; i < toMigrate.length; i++) {
    try { await dbInsert('expenses', expToDB(toMigrate[i])); } catch(err) { console.error('migrate expense', err); }
  }
  localStorage.removeItem('supervisorExpenses');
  var rows = await dbGet('expenses', 'date');
  D.expenses = rows.map(expFromDB);
  showToast('Expenses migrated to cloud!');
}
function openExpenseModal(id) {
  var e = id ? getExpenses().find(function(x){ return x.id === id; }) : null;
  document.getElementById('expense-id').value = id || '';
  document.getElementById('expense-modal-title').textContent = id ? 'Edit Expense' : 'Add Expense';
  // Populate center select
  var csel = document.getElementById('exp-center');
  csel.innerHTML = '<option value="">All / General</option>' +
    D.centers.map(function(c){ return '<option value="'+c.id+'">'+c.name+'</option>'; }).join('');
  if (e) {
    document.getElementById('exp-cat').value    = e.cat || 'Rent';
    document.getElementById('exp-amount').value = e.amount || '';
    document.getElementById('exp-desc').value   = e.desc || '';
    document.getElementById('exp-date').value   = e.date || '';
    document.getElementById('exp-notes').value  = e.notes || '';
    csel.value = e.centerId || '';
  } else {
    document.getElementById('exp-cat').value    = 'Rent';
    document.getElementById('exp-amount').value = '';
    document.getElementById('exp-desc').value   = '';
    document.getElementById('exp-date').value   = new Date().toISOString().split('T')[0];
    document.getElementById('exp-notes').value  = '';
    csel.value = ACTIVE_CENTER || '';
  }
  openModal('expense');
}
function quickAddWaterCans(loc) {
  var key    = loc === 'home' ? 'waterCansHomeAmt' : 'waterCansCenterAmt';
  var label  = loc === 'home' ? 'Water Can — Home' : 'Water Can — ' + getCenterName();
  var lastAmt = localStorage.getItem(key) || '10';
  openExpenseModal();
  document.getElementById('exp-cat').value    = 'Water Cans';
  document.getElementById('exp-desc').value   = label;
  document.getElementById('exp-amount').value = lastAmt;
  if (loc === 'center') {
    var csel = document.getElementById('exp-center');
    if (ACTIVE_CENTER) {
      csel.value = ACTIVE_CENTER;
    } else {
      // Default to first center when no active center
      if (D.centers.length === 1) csel.value = D.centers[0].id;
    }
  }
}
async function saveExpense() {
  var cat    = document.getElementById('exp-cat').value;
  var amount = parseFloat(document.getElementById('exp-amount').value) || 0;
  var desc   = document.getElementById('exp-desc').value.trim();
  var date   = document.getElementById('exp-date').value;
  if (!desc)   { showToast('Enter a description', 'error'); return; }
  if (!amount) { showToast('Enter a valid amount', 'error'); return; }
  if (!date)   { showToast('Select a date', 'error'); return; }
  var id = document.getElementById('expense-id').value;
  var centerId = document.getElementById('exp-center').value;
  var centerName = '';
  if (centerId) { var cc = D.centers.find(function(c){ return c.id === centerId; }); centerName = cc ? cc.name : ''; }
  if (cat === 'Water Cans') {
    if (desc.indexOf('Home') !== -1) localStorage.setItem('waterCansHomeAmt', amount);
    else localStorage.setItem('waterCansCenterAmt', amount);
  }
  var financeData = { type: 'expense', category: cat, amount: amount, description: desc, date: date, wellness_center_id: centerId || null };
  try {
    if (id) { await dbUpdate('finance', id, financeData); }
    else    { await dbInsert('finance', financeData); }
    closeModal('expense');
    await loadExpenses();
    renderExpenses();
    showToast('Expense saved!');
  } catch(e) { showToast('Save failed: ' + e.message, 'error'); }
}
async function delExpense(id) {
  if (!confirm('Delete this expense?')) return;
  try {
    await dbDelete('finance', id);
    await loadExpenses();
    renderExpenses();
    showToast('Deleted', 'info');
  } catch(e) { showToast('Delete failed: ' + e.message, 'error'); }
}
function renderExpenses() {
  var monthFilter = (document.getElementById('exp-month-filter')||{value:''}).value;
  var catFilter   = (document.getElementById('exp-cat-filter')||{value:''}).value;
  // Default to current month
  if (!monthFilter) {
    var d = new Date(); var mm = String(d.getMonth()+1).padStart(2,'0');
    var def = d.getFullYear()+'-'+mm;
    var mel = document.getElementById('exp-month-filter');
    if (mel && !mel.value) { mel.value = def; monthFilter = def; }
  }
  var expenses = getExpenses();
  if (monthFilter) expenses = expenses.filter(function(e){ return e.date && e.date.startsWith(monthFilter); });
  if (catFilter)   expenses = expenses.filter(function(e){ return e.cat === catFilter; });
  expenses.sort(function(a,b){ return b.date.localeCompare(a.date); });

  // Stats
  var allMonth = getExpenses().filter(function(e){ return !monthFilter || e.date.startsWith(monthFilter); });
  var total    = allMonth.reduce(function(s,e){ return s+e.amount; }, 0);
  var cats     = {};
  allMonth.forEach(function(e){ cats[e.cat] = (cats[e.cat]||0)+e.amount; });
  var topCat   = Object.keys(cats).sort(function(a,b){ return cats[b]-cats[a]; })[0] || '—';

  var statsEl = document.getElementById('exp-stats');
  if (statsEl) statsEl.innerHTML =
    '<div class="stat"><div class="stat-l">Total This Month</div><div class="stat-v" style="color:var(--danger)">\u20B9'+total.toLocaleString()+'</div></div>'+
    '<div class="stat"><div class="stat-l">Entries</div><div class="stat-v">'+allMonth.length+'</div></div>'+
    '<div class="stat"><div class="stat-l">Top Category</div><div class="stat-v" style="font-size:16px">'+topCat+'</div></div>';

  var el = document.getElementById('exp-list');
  if (!el) return;
  if (!expenses.length) { el.innerHTML = '<div class="empty"><div class="ei">📋</div><p>No expenses recorded for this period.</p></div>'; return; }
  el.innerHTML = expenses.map(function(e){
    var meta = (e.centerName||'General') + ' \u2022 ' + e.date + (e.notes ? ' \u2022 ' + e.notes : '');
    return '<div class="exp-row">'+
      '<div style="flex:1;min-width:140px">'+
        '<div style="font-weight:600;font-size:13px">'+e.desc+'</div>'+
        '<div style="font-size:11px;color:var(--muted);margin-top:2px">'+meta+'</div>'+
      '</div>'+
      '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'+
        '<span class="exp-cat-badge">'+e.cat+'</span>'+
        '<span style="font-size:15px;font-weight:700;color:var(--danger)">\u2212\u20B9'+e.amount.toLocaleString()+'</span>'+
        '<button class="btn-e" style="font-size:11px;padding:3px 8px" onclick="openExpenseModal(\''+e.id+'\')">Edit</button>'+
        '<button class="btn-d" style="font-size:11px;padding:3px 8px" onclick="delExpense(\''+e.id+'\')">Del</button>'+
      '</div>'+
    '</div>';
  }).join('');
}

// ══════════════════════════════════════════
//  COACH PERFORMANCE
// ══════════════════════════════════════════
function renderCoachPerf() {
  var monthEl = document.getElementById('cp-month');
  if (!monthEl) return;
  if (!monthEl.value) {
    var d = new Date(); monthEl.value = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
  }
  var ym = monthEl.value;
  var today = new Date().toISOString().split('T')[0];

  // Per-coach metrics
  var rows = D.coaches.filter(function(c){ return c.status !== 'Inactive'; }).map(function(coach){
    var custs = D.customers.filter(function(c){ return c.referred_by === coach.id || c.coach_id === coach.id; });
    var newThisMonth = custs.filter(function(c){ return (c.created_at||'').startsWith(ym) || (c.join_date||'').startsWith(ym); }).length;
    // Attendance rate: of this coach's customers, how many attended this month?
    var custIds = custs.map(function(c){ return c.id; });
    var monthAtt = D.attendance.filter(function(a){ return a.date && a.date.startsWith(ym) && a.status === 'present' && custIds.indexOf(a.customer_id) !== -1; });
    var uniqueAttCustomers = monthAtt.reduce(function(s,a){ if(s.indexOf(a.customer_id)===-1)s.push(a.customer_id); return s;}, []);
    var attRate = custs.length ? Math.round((uniqueAttCustomers.length / custs.length) * 100) : 0;
    var leads = (D.leads||[]).filter(function(l){ return l.coach_id === coach.id; }).length;
    return { coach, custs: custs.length, newThisMonth, attRate, leads };
  });

  rows.sort(function(a,b){ return b.custs - a.custs; });

  // Summary stats
  var totalCusts = rows.reduce(function(s,r){ return s+r.custs; }, 0);
  var topCoach   = rows[0] ? rows[0].coach.name : '—';
  var avgAtt     = rows.length ? Math.round(rows.reduce(function(s,r){ return s+r.attRate; }, 0)/rows.length) : 0;
  var statsEl = document.getElementById('cp-stats');
  if (statsEl) statsEl.innerHTML =
    '<div class="stat"><div class="stat-l">Total Coaches</div><div class="stat-v">'+rows.length+'</div></div>'+
    '<div class="stat"><div class="stat-l">Top Coach</div><div class="stat-v" style="font-size:15px">'+topCoach+'</div></div>'+
    '<div class="stat"><div class="stat-l">Avg Att. Rate</div><div class="stat-v" style="color:var(--success)">'+avgAtt+'%</div></div>';

  // Table
  var tableEl = document.getElementById('cp-table');
  if (tableEl) {
    if (!rows.length) { tableEl.innerHTML = '<div class="empty"><p>No coaches found.</p></div>'; }
    else tableEl.innerHTML = rows.map(function(r, i){
      var medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
      return '<div class="cp-row">'+
        '<span style="font-weight:700">'+medal+' '+r.coach.name+'<div style="font-size:11px;font-weight:400;color:var(--muted)">'+r.coach.center_name+'</div></span>'+
        '<span style="font-weight:700">'+r.custs+'</span>'+
        '<span style="color:var(--success);font-weight:700">+'+r.newThisMonth+'</span>'+
        '<div>'+
          '<span style="font-weight:700">'+r.attRate+'%</span>'+
          '<div class="cp-bar-wrap"><div class="cp-bar" style="width:'+r.attRate+'%"></div></div>'+
        '</div>'+
        '<span>'+r.leads+'</span>'+
      '</div>';
    }).join('');
  }

  // Breakdown cards
  var bdEl = document.getElementById('cp-breakdown');
  if (bdEl) {
    bdEl.innerHTML = rows.map(function(r){
      var custs = D.customers.filter(function(c){ return c.referred_by === r.coach.id || c.coach_id === r.coach.id; });
      var expiring = custs.filter(function(c){ if(!c.pack_type) return false; var days = getDaysLeftSv(c); return days >= 0 && days <= 7; }).length;
      return '<div class="goal-card">'+
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'+
          '<div style="font-weight:700;font-size:14px">'+r.coach.name+'</div>'+
          '<span style="font-size:12px;color:var(--muted)">'+r.coach.center_name+'</span>'+
        '</div>'+
        '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;text-align:center">'+
          '<div style="background:var(--surface2);border-radius:8px;padding:10px"><div style="font-size:20px;font-weight:700;color:var(--primary)">'+r.custs+'</div><div style="font-size:10px;color:var(--muted)">Customers</div></div>'+
          '<div style="background:var(--surface2);border-radius:8px;padding:10px"><div style="font-size:20px;font-weight:700;color:var(--success)">+'+r.newThisMonth+'</div><div style="font-size:10px;color:var(--muted)">New This Month</div></div>'+
          '<div style="background:var(--surface2);border-radius:8px;padding:10px"><div style="font-size:20px;font-weight:700">'+r.attRate+'%</div><div style="font-size:10px;color:var(--muted)">Att. Rate</div></div>'+
          '<div style="background:var(--surface2);border-radius:8px;padding:10px"><div style="font-size:20px;font-weight:700;color:var(--accent)">'+expiring+'</div><div style="font-size:10px;color:var(--muted)">Expiring Soon</div></div>'+
        '</div>'+
      '</div>';
    }).join('') || '<div class="empty"><p>No coach data available.</p></div>';
  }
}

// ══════════════════════════════════════════
//  COACH COMMISSION CALCULATOR
// ══════════════════════════════════════════
function initCommission() {
  var sel = document.getElementById('comm-month');
  if (!sel) return;
  if (!sel.options.length) {
    var months = []; var cur = new Date();
    for (var i = 0; i < 6; i++) {
      var d = new Date(cur.getFullYear(), cur.getMonth()-i, 1);
      var val = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
      months.push('<option value="'+val+'">'+d.toLocaleString('default',{month:'long',year:'numeric'})+'</option>');
    }
    sel.innerHTML = months.join('');
  }
  renderCommission();
}

function renderCommission() {
  var sel = document.getElementById('comm-month');
  if (!sel) return;
  var month = sel.value;
  if (!month) { var d = new Date(); month = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }
  var rates = JSON.parse(localStorage.getItem('commissionRates') || '{}');
  var defRate = parseFloat(rates.default !== undefined ? rates.default : 10) / 100;

  var data = D.coaches.map(function(coach) {
    var myCusts = D.customers.filter(function(c){
      return c.coach_id === coach.id || c.referred_by_id === coach.id;
    });
    var custIds = myCusts.map(function(c){ return c.id; });

    var newEnrolled = myCusts.filter(function(c){
      var d = c.join_date || c.pack_start_date || (c.created_at||'').substring(0,10);
      return d && d.startsWith(month);
    });
    var newEarnings = newEnrolled.reduce(function(s, c){
      var price = Number(c.pack_price) || 0;
      var key = (c.pack_type||'').trim();
      var rate = rates[key] !== undefined ? parseFloat(rates[key])/100 : defRate;
      return s + price * rate;
    }, 0);

    var renewals = (D.packHistory||[]).filter(function(h){
      return h.start_date && h.start_date.startsWith(month) && custIds.indexOf(h.customer_id) !== -1;
    });
    var renewalEarnings = renewals.reduce(function(s, h){
      var price = Number(h.pack_price) || 0;
      return s + price * defRate;
    }, 0);

    return {
      coach: coach,
      newCount: newEnrolled.length,
      renewCount: renewals.length,
      newEarnings: Math.round(newEarnings),
      renewalEarnings: Math.round(renewalEarnings),
      total: Math.round(newEarnings + renewalEarnings),
      totalCusts: myCusts.length
    };
  }).sort(function(a,b){ return b.total - a.total; });

  var grandTotal = data.reduce(function(s,d){ return s + d.total; }, 0);
  var el = document.getElementById('commission-content');
  if (!el) return;

  if (!data.length) {
    el.innerHTML = '<div class="empty" style="padding:24px"><p>No coaches added yet.</p></div>';
    return;
  }

  var html = '<div class="stats" style="margin-bottom:12px">'
    +'<div class="stat"><div class="stat-ic">💰</div><div class="stat-l">Total Payout</div><div class="stat-v" style="color:var(--primary)">₹'+grandTotal.toLocaleString('en-IN')+'</div></div>'
    +'<div class="stat"><div class="stat-ic">👨‍🏫</div><div class="stat-l">Coaches</div><div class="stat-v">'+data.length+'</div></div>'
    +'<div class="stat"><div class="stat-ic">🔄</div><div class="stat-l">Total Renewals</div><div class="stat-v">'+data.reduce(function(s,d){return s+d.renewCount;},0)+'</div></div>'
    +'<div class="stat"><div class="stat-ic">🆕</div><div class="stat-l">New Enrollments</div><div class="stat-v">'+data.reduce(function(s,d){return s+d.newCount;},0)+'</div></div>'
    +'</div>';

  html += '<div class="twrap"><table><thead><tr>'
    +'<th>Coach</th><th>Customers</th><th>New</th><th>Renewals</th>'
    +'<th>New Earnings</th><th>Renewal Earnings</th><th style="color:var(--primary)">Total Due</th>'
    +'</tr></thead><tbody>';

  data.forEach(function(d, i) {
    var medal = i===0&&d.total>0?'🥇 ':i===1&&d.total>0?'🥈 ':i===2&&d.total>0?'🥉 ':'';
    var phone = (d.coach.contact||'').replace(/\D/g,''); if(phone.length===10) phone=COUNTRY_CODE+phone;
    var msg = encodeURIComponent('Hi '+d.coach.name+'! Your commission for '+month+' is ready: ₹'+d.total.toLocaleString('en-IN')+' ('+d.newCount+' new + '+d.renewCount+' renewals). Thank you! 🙏');
    html += '<tr>'
      +'<td><strong>'+medal+d.coach.name+'</strong><div style="font-size:11px;color:var(--muted)">'+(d.coach.herbalife_pin||'Associate')+'</div></td>'
      +'<td>'+d.totalCusts+'</td>'
      +'<td style="color:var(--success);font-weight:700">+'+d.newCount+'</td>'
      +'<td>'+d.renewCount+'</td>'
      +'<td>₹'+d.newEarnings.toLocaleString('en-IN')+'</td>'
      +'<td>₹'+d.renewalEarnings.toLocaleString('en-IN')+'</td>'
      +'<td style="font-weight:700;color:var(--primary)"><div style="display:flex;align-items:center;gap:6px">₹'+d.total.toLocaleString('en-IN')
        +(phone&&d.total>0?' <button class="wa-btn" style="font-size:10px;padding:2px 7px" onclick="window.open(\'https://api.whatsapp.com/send?phone='+phone+'&text='+msg+'\',\'_blank\')" title="Notify coach">💬</button>':'')
      +'</div></td>'
      +'</tr>';
  });

  html += '<tr style="background:var(--surface2);font-weight:700">'
    +'<td colspan="4" style="text-align:right;font-size:13px">Grand Total</td>'
    +'<td>₹'+data.reduce(function(s,d){return s+d.newEarnings;},0).toLocaleString('en-IN')+'</td>'
    +'<td>₹'+data.reduce(function(s,d){return s+d.renewalEarnings;},0).toLocaleString('en-IN')+'</td>'
    +'<td style="color:var(--primary)">₹'+grandTotal.toLocaleString('en-IN')+'</td>'
    +'</tr>';

  html += '</tbody></table></div>';
  el.innerHTML = html;
}

function openCommissionSettings() {
  var rates = JSON.parse(localStorage.getItem('commissionRates') || '{}');
  document.getElementById('comm-rate-default').value = rates.default !== undefined ? rates.default : 10;
  var packTypes = [];
  D.customers.forEach(function(c){ if(c.pack_type && packTypes.indexOf(c.pack_type)===-1) packTypes.push(c.pack_type); });
  var packHtml = packTypes.map(function(pt){
    var val = rates[pt] !== undefined ? rates[pt] : '';
    return '<div style="display:flex;align-items:center;gap:10px">'
      +'<label style="flex:1;font-size:12px;color:var(--muted)">'+pt+'</label>'
      +'<div style="display:flex;align-items:center;gap:4px">'
      +'<input type="number" class="comm-pack-rate-input" data-pack="'+pt+'" min="0" max="100" step="0.5" value="'+val+'" placeholder="default" style="width:70px;padding:6px 10px;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:12px;text-align:right">'
      +'<span style="font-size:12px;color:var(--muted)">%</span>'
      +'</div></div>';
  }).join('');
  document.getElementById('comm-pack-rates').innerHTML = packHtml || '<div style="font-size:12px;color:var(--muted)">No pack types found.</div>';
  openModal('commission-rates');
}

function saveCommissionRates() {
  var rates = {};
  rates.default = parseFloat(document.getElementById('comm-rate-default').value) || 10;
  document.querySelectorAll('.comm-pack-rate-input').forEach(function(inp){
    var v = inp.value.trim();
    if(v !== '') rates[inp.dataset.pack] = parseFloat(v);
  });
  localStorage.setItem('commissionRates', JSON.stringify(rates));
  closeModal('commission-rates');
  renderCommission();
  showToast('Commission rates saved', 'success');
}

// Helper: days left for supervisor context (uses Supabase data structure)
function getDaysLeftSv(c) {
  if (!c.pack_type || !c.pack_start_date) return -1;
  var total = parseInt((c.pack_type||'').split(' ')[0]) || 0;
  if (!total) return -1;
  var attended = (D.attendance||[]).filter(function(a){ return a.customer_id===c.id && a.status==='present'; }).length;
  return Math.max(total - attended, 0);
}

// ══════════════════════════════════════════
//  GOAL SETTING
// ══════════════════════════════════════════
function getGoals() {
  return JSON.parse(localStorage.getItem('supervisorGoals') || '{}');
}
function saveGoals() {
  var goals = getGoals();
  var d = new Date(); var ym = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
  if (!goals[ym]) goals[ym] = {};
  goals[ym].newMembers  = parseInt(document.getElementById('goal-new-members').value) || 0;
  goals[ym].revenue     = parseInt(document.getElementById('goal-revenue').value) || 0;
  goals[ym].attendance  = parseInt(document.getElementById('goal-attendance').value) || 0;
  goals[ym].leads       = parseInt(document.getElementById('goal-leads').value) || 0;
  localStorage.setItem('supervisorGoals', JSON.stringify(goals));
  renderGoals();
  showToast('Goals saved!');
}
function renderGoals() {
  var d = new Date(); var ym = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var monthLabel = months[d.getMonth()]+' '+d.getFullYear();
  var lbl = document.getElementById('goals-month-label');
  if (lbl) lbl.textContent = monthLabel;

  var goals = (getGoals()[ym]) || {};
  var gmEl = document.getElementById('goal-new-members');
  var grEl = document.getElementById('goal-revenue');
  var gaEl = document.getElementById('goal-attendance');
  var glEl = document.getElementById('goal-leads');
  if (gmEl && !gmEl.value) gmEl.value = goals.newMembers || '';
  if (grEl && !grEl.value) grEl.value = goals.revenue || '';
  if (gaEl && !gaEl.value) gaEl.value = goals.attendance || '';
  if (glEl && !glEl.value) glEl.value = goals.leads || '';

  // Calculate actuals — scoped to active center
  var _gcusts = filterByCenter(D.customers);
  var _gatt   = filterByCenterViaCustomer(D.attendance);
  var _gleads = ACTIVE_CENTER ? (D.leads||[]).filter(function(l){return l.center_id===ACTIVE_CENTER;}) : (D.leads||[]);
  var newMembers  = _gcusts.filter(function(c){ return (c.created_at||'').startsWith(ym) || (c.join_date||'').startsWith(ym); }).length;
  var todayStr    = new Date().toISOString().split('T')[0];
  // Attendance avg this month
  var monthDays   = Math.max(d.getDate(), 1);
  var monthAttTotal = _gatt.filter(function(a){ return a.date && a.date.startsWith(ym) && a.status==='present'; }).length;
  var avgDailyAtt = Math.round(monthAttTotal / monthDays);
  // Revenue estimate from pack prices
  var monthRevenue = _gcusts.filter(function(c){ return (c.created_at||'').startsWith(ym) || (c.join_date||'').startsWith(ym); })
    .reduce(function(s,c){ var days=parseInt((c.pack_type||'').split(' ')[0])||0; var price=days===26?2600:days===3?300:days===30?3000:0; return s+price; }, 0);
  var leadsConverted = _gleads.filter(function(l){ return l.status==='Joined' && (l.created_at||'').startsWith(ym); }).length;

  function progressCard(label, icon, actual, target, color, unit) {
    var pct = target ? Math.min(Math.round((actual/target)*100), 100) : 0;
    var barColor = pct >= 100 ? 'var(--success)' : pct >= 60 ? color : 'var(--accent)';
    var badge = pct >= 100
      ? '<span style="background:#d1fae5;color:#065f46;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px">\u2705 Reached</span>'
      : '<span style="background:var(--surface2);color:var(--muted);font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px">'+pct+'%</span>';
    return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px 20px">'+
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">'+
        '<div>'+
          '<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:4px">'+icon+' '+label+'</div>'+
          '<div style="font-size:26px;font-weight:800;color:'+color+';line-height:1">'+(unit||'')+actual.toLocaleString()+'</div>'+
          '<div style="font-size:12px;color:var(--muted);margin-top:3px">Target: '+(unit||'')+(target||0).toLocaleString()+'</div>'+
        '</div>'+
        badge+
      '</div>'+
      '<div style="background:var(--surface2);border-radius:20px;height:8px;overflow:hidden">'+
        '<div style="height:100%;border-radius:20px;width:'+pct+'%;background:'+barColor+';transition:width .6s ease"></div>'+
      '</div>'+
    '</div>';
  }

  var statsEl = document.getElementById('goals-progress-stats');
  if (statsEl) statsEl.innerHTML =
    '<div class="stat"><div class="stat-l">New Members</div><div class="stat-v" style="color:var(--primary)">'+newMembers+(goals.newMembers?'/'+goals.newMembers:'')+'</div></div>'+
    '<div class="stat"><div class="stat-l">Revenue</div><div class="stat-v" style="color:var(--success)">\u20B9'+monthRevenue.toLocaleString()+'</div></div>'+
    '<div class="stat"><div class="stat-l">Avg Daily Att.</div><div class="stat-v">'+avgDailyAtt+'</div></div>'+
    '<div class="stat"><div class="stat-l">Leads Converted</div><div class="stat-v" style="color:var(--accent)">'+leadsConverted+'</div></div>';

  var cardsEl = document.getElementById('goals-progress-cards');
  if (!cardsEl) return;
  if (!goals.newMembers && !goals.revenue && !goals.attendance && !goals.leads) {
    cardsEl.innerHTML = '<div style="grid-column:1/-1"><div class="empty"><p>Set your targets above and tap Save Goals to track progress.</p></div></div>';
    return;
  }
  cardsEl.innerHTML =
    progressCard('New Members',      '\uD83D\uDC65', newMembers,    goals.newMembers||0,  'var(--primary)', '')+
    progressCard('Revenue',          '\uD83D\uDCB0', monthRevenue,  goals.revenue||0,     'var(--success)', '\u20B9')+
    progressCard('Avg Daily Att.',   '\uD83D\uDCC5', avgDailyAtt,   goals.attendance||0,  '#2563eb', '')+
    progressCard('Leads Converted',  '\uD83D\uDCAC', leadsConverted,goals.leads||0,       'var(--accent)', '');
}

// ══════════════════════════════════════════
//  NOTIFICATIONS & ALERTS
// ══════════════════════════════════════════
function renderNotifications() {
  var alerts = [];
  var today  = new Date().toISOString().split('T')[0];

  // 1. Expired packs
  var expired = D.customers.filter(function(c){
    if (!c.pack_type) return false;
    return getDaysLeftSv(c) <= 0;
  });
  if (expired.length) alerts.push({
    icon: '\u274C', title: expired.length+' Expired Pack'+(expired.length!==1?'s':''),
    sub: expired.slice(0,3).map(function(c){ return c.name; }).join(', ')+(expired.length>3?' +more':''),
    type: 'critical', action: "goTo('customers',document.getElementById('nav-customers'))"
  });

  // 2. Packs expiring in ≤3 days
  var expiring3 = D.customers.filter(function(c){
    if (!c.pack_type) return false; var d = getDaysLeftSv(c); return d > 0 && d <= 3;
  });
  if (expiring3.length) alerts.push({
    icon: '\u26A0\uFE0F', title: expiring3.length+' Pack'+(expiring3.length!==1?'s':'')+' Expiring in ≤3 Days',
    sub: expiring3.map(function(c){ return c.name; }).join(', '),
    type: 'warning'
  });

  // 3. Overdue leads
  var overdue = (D.leads||[]).filter(function(l){ return l.next_followup_date && l.next_followup_date < today && l.status !== 'Joined' && l.status !== 'Not Interested'; });
  if (overdue.length) alerts.push({
    icon: '\uD83D\uDCDE', title: overdue.length+' Overdue Lead Follow-up'+(overdue.length!==1?'s':''),
    sub: overdue.slice(0,3).map(function(l){ return l.name; }).join(', ')+(overdue.length>3?' +more':''),
    type: 'critical', action: "goTo('leads',document.querySelector('[onclick*=leads]'))"
  });

  // 4. Inactive customers (7+ days)
  var inactive = D.customers.filter(function(c){
    var lastAtt = D.attendance.filter(function(a){ return a.customer_id===c.id && a.status==='present'; })
      .sort(function(a,b){ return b.date.localeCompare(a.date); })[0];
    if (!lastAtt) return false;
    var days = Math.floor((new Date(today)-new Date(lastAtt.date))/86400000);
    return days >= 7;
  });
  if (inactive.length) alerts.push({
    icon: '\uD83D\uDCA4', title: inactive.length+' Inactive Customer'+(inactive.length!==1?'s':'')+' (7+ days)',
    sub: inactive.slice(0,3).map(function(c){ return c.name; }).join(', ')+(inactive.length>3?' +more':''),
    type: 'warning'
  });

  // 5. Pending payments
  var pending = (D.payments||[]).filter(function(p){ return p.status === 'pending' || p.status === 'Pending'; });
  if (pending.length) alerts.push({
    icon: '\uD83D\uDCB3', title: pending.length+' Pending Payment'+(pending.length!==1?'s':''),
    sub: 'Total pending: \u20B9'+pending.reduce(function(s,p){ return s+(Number(p.amount)||0); },0).toLocaleString(),
    type: 'info', action: "goTo('payments',document.querySelector('[onclick*=payments]'))"
  });

  // 6. Low inventory (if applicable)
  // 7. Today's attendance zero
  var todayAtt = D.attendance.filter(function(a){ return a.date===today && a.status==='present'; }).length;
  if (todayAtt === 0) alerts.push({
    icon: '\uD83D\uDCC5', title: 'No Attendance Marked Today',
    sub: 'No customer has been marked present yet today.',
    type: 'info', action: "goTo('attendance',document.querySelector('[onclick*=attendance]'))"
  });

  // Summary stats
  var critical = alerts.filter(function(a){ return a.type==='critical'; }).length;
  var warning  = alerts.filter(function(a){ return a.type==='warning'; }).length;
  var info     = alerts.filter(function(a){ return a.type==='info'; }).length;
  var sumEl = document.getElementById('notif-summary');
  if (sumEl) sumEl.innerHTML =
    '<div class="stat"><div class="stat-l">Critical</div><div class="stat-v" style="color:var(--danger)">'+critical+'</div></div>'+
    '<div class="stat"><div class="stat-l">Warnings</div><div class="stat-v" style="color:var(--accent)">'+warning+'</div></div>'+
    '<div class="stat"><div class="stat-l">Info</div><div class="stat-v" style="color:#2563eb">'+info+'</div></div>'+
    '<div class="stat"><div class="stat-l">Total</div><div class="stat-v">'+alerts.length+'</div></div>';

  var el = document.getElementById('notif-list');
  if (!el) return;
  if (!alerts.length) { el.innerHTML = '<div class="empty"><div style="font-size:40px;margin-bottom:10px">\uD83C\uDF89</div><p>All clear! No alerts right now.</p></div>'; return; }
  el.innerHTML = alerts.map(function(a){
    var badgeClass = a.type === 'critical' ? 'notif-critical' : a.type === 'warning' ? 'notif-warning' : 'notif-info';
    var badgeLabel = a.type === 'critical' ? 'Action Needed' : a.type === 'warning' ? 'Warning' : 'Info';
    return '<div class="notif-item">'+
      '<div class="notif-icon">'+a.icon+'</div>'+
      '<div class="notif-body">'+
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'+
          '<div class="notif-title">'+a.title+'</div>'+
          '<span class="notif-badge '+badgeClass+'">'+badgeLabel+'</span>'+
        '</div>'+
        '<div class="notif-sub">'+a.sub+'</div>'+
      '</div>'+
      (a.action ? '<button class="btn-e" style="font-size:11px;padding:4px 10px;flex-shrink:0" onclick="'+a.action+'">View →</button>' : '')+
    '</div>';
  }).join('');
}

// ── AI DIET PLAN GENERATOR ──
var _dietInFlight = false;
async function generateDietPlan(custId, silent) {
  if(_dietInFlight){ if(!silent) showToast('Already generating a plan...','error'); return; }
  var c = D.customers.find(function(x){return x.id===custId;});
  if(!c){ if(!silent) showToast('Customer not found','error'); return; }

  // Get latest body composition for weight
  var bodyRecs = D.body.filter(function(b){return b.customer_id===custId;}).sort(function(a,b){return b.date>a.date?1:-1;});
  var latestWeight = bodyRecs.length ? parseFloat(bodyRecs[0].weight) : null;
  var height = parseFloat(c.height) || null;
  var age = c.age ? parseInt(c.age) : (c.dob ? Math.floor((new Date()-new Date(c.dob))/(365.25*24*3600*1000)) : null);
  var gender = (c.gender||'').toLowerCase();
  var goal = c.goal || 'Weight Loss';
  var dietType = c.diet_type || 'veg';
  var activity = c.activity_level || 'light';
  var trainingType = c.training_type || 'dumbbell';
  var proteinRatio = parseFloat(c.protein_ratio) || 2.0;
  var shakeTwice = (c.shake_frequency === 'twice');

  if(!latestWeight || !height || !age){ if(!silent) showToast('Client needs weight (body record), height, and age to generate plan','error'); return; }
  if(!D_FOODS.length){ if(!silent) showToast('Add foods to the Food Database first','error'); return; }

  if(!getGroqKey()){ if(!silent) showToast('Set your Groq API key in SQL/Config section first','error'); return; }

  // Calculate RMR (Mifflin-St Jeor)
  var rmr = (10 * latestWeight) + (6.25 * height) - (5 * age) + (gender==='female' ? -161 : 5);
  var actMult = {sedentary:1.2, light:1.375, moderate:1.55, active:1.725}[activity] || 1.375;
  var tdee = Math.round(rmr * actMult);
  var isWL = goal.toLowerCase().includes('loss');
  var targetCal = isWL ? Math.round(tdee - 400) : Math.round(tdee + 400);
  var targetProtein = Math.round(latestWeight * proteinRatio);

  // Shake nutrition (subtracted from food budget — hidden from clients)
  var shakeNutrition = getShakeNutrition(goal);
  var shakeCount = shakeTwice ? 2 : 1;
  var shakeCal = shakeNutrition.kcal * shakeCount;
  var shakeProtein = Math.round(shakeNutrition.protein * shakeCount * 10) / 10;
  var foodCalBudget = targetCal - shakeCal;
  var foodProteinBudget = targetProtein - shakeProtein;

  // Training description for AI context
  var trainingDesc = {
    'dumbbell': 'Dumbbell weight training at wellness center',
    'bodyweight': 'Bodyweight/fitness exercises at wellness center',
    'walking': 'Walking (10,000 steps/day target)',
    'dumbbell+walking': 'Dumbbell weight training + 10,000 steps/day walking',
    'bodyweight+walking': 'Bodyweight/fitness exercises + 10,000 steps/day walking'
  }[trainingType] || trainingType;

  // ── Food availability logic ──
  // 1. Center-level unavailable foods
  var center = c.wellness_center_id ? D.centers.find(function(x){return x.id===c.wellness_center_id;}) : null;
  var centerUnavail = center && center.unavailable_foods
    ? center.unavailable_foods.split(',').map(function(f){return f.trim().toLowerCase();}).filter(Boolean)
    : [];
  // 2. Customer override (can get despite center restriction)
  var custOverride = c.food_override
    ? c.food_override.split(',').map(function(f){return f.trim().toLowerCase();}).filter(Boolean)
    : [];
  // 3. Customer personal restriction (allergies/preferences)
  var custRestrict = c.food_restrict
    ? c.food_restrict.split(',').map(function(f){return f.trim().toLowerCase();}).filter(Boolean)
    : [];

  // Final unavailable = (center unavailable - customer override) + customer personal restriction
  var finalUnavail = centerUnavail.filter(function(f){ return !custOverride.includes(f); }).concat(custRestrict);

  // Build food list
  var foods = D_FOODS.filter(function(f){
    if(dietType==='veg' && f.category==='non-veg') return false;
    if(finalUnavail.some(function(u){ return f.name.toLowerCase().includes(u); })) return false;
    return true;
  });
  var foodList = foods.map(function(f){
    return f.name+' (Cal:'+f.calories+' Protein:'+f.protein+'g Carbs:'+f.carbs+'g Fiber:'+f.fiber+'g Fat:'+f.fat+'g per 100g, best for: '+f.meal_time+')';
  }).join('\n');

  // ── Protein source check (warn coach if too few protein foods remain after filtering) ──
  var proteinSourceCount = countProteinSources(foods);
  if(!silent && proteinSourceCount < 3) {
    var proceed = confirm(
      '⚠️ Only '+proteinSourceCount+' protein-rich food'+(proteinSourceCount===1?'':'s')+' available for '+c.name+' after applying food restrictions.\n\n'+
      'This may make it hard to meet the '+targetProtein+'g protein target.\n\n'+
      'Tip: Check their food restrictions or the center\'s unavailable foods list.\n\n'+
      'Generate anyway?'
    );
    if(!proceed) return;
  }

  _dietInFlight = true;
  showToast('Generating 7-day diet plan for '+c.name+'...','success');

  var dayTemplate = shakeTwice
    ? '{"mid_morning":{"name":"","grams":0,"calories":0,"protein":0},"lunch":[{"name":"","grams":0,"calories":0,"protein":0}],"dinner":[{"name":"","grams":0,"calories":0,"protein":0}],"total_calories":0,"total_protein":0}'
    : '{"mid_morning":{"name":"","grams":0,"calories":0,"protein":0},"lunch":[{"name":"","grams":0,"calories":0,"protein":0}],"evening":{"name":"","grams":0,"calories":0,"protein":0},"dinner":[{"name":"","grams":0,"calories":0,"protein":0}],"total_calories":0,"total_protein":0}';

  var prompt = 'You are a sports nutritionist at a nutrition wellness center in India. Create a personalized 7-day meal plan (Monday to Sunday) for this client.\n\n'+
    'Client: '+c.name+'\n'+
    'Primary Goal: '+(isWL?'Weight Loss (fat loss while preserving muscle)':'Weight Gain (lean muscle mass)')+'\n'+
    'Secondary Goal: MUSCLE GAIN — applies to ALL clients\n'+
    'Diet: '+(dietType==='veg'?'Vegetarian':'Non-Vegetarian')+'\n'+
    'Training: '+trainingDesc+'\n'+
    'RMR: '+Math.round(rmr)+' kcal | TDEE: '+tdee+' kcal\n'+
    'Total Daily Target: '+targetCal+' kcal | '+targetProtein+'g protein\n'+
    'Protein Shake already accounts for: '+shakeCal+' kcal + '+shakeProtein+'g protein ('+shakeCount+'x shake/day)\n'+
    'Remaining food budget: '+foodCalBudget+' kcal | '+Math.round(foodProteinBudget)+'g protein from food\n'+
    'Weight: '+latestWeight+'kg | Height: '+height+'cm | Age: '+age+'\n\n'+
    'RULES:\n'+
    '- Breakfast shake and'+(shakeTwice?' post-workout shake are':' breakfast shake is')+' already accounted for — do NOT include in JSON\n'+
    (shakeTwice?'- Each day: Mid-Morning Snack (1 item), Lunch (2-3 items), Dinner (2-3 items) — NO evening snack (post-workout shake replaces it)\n':'- Each day: Mid-Morning Snack (1 item), Lunch (2-3 items), Evening Snack (1 item), Dinner (2-3 items)\n')+
    '- Pick ONLY from the food list below\n'+
    '- Specify exact grams for each food item\n'+
    '- Vary meals across days — no same lunch or dinner two days in a row\n'+
    '- Food must provide '+Math.round(foodProteinBudget)+'g protein and '+foodCalBudget+' kcal (remaining after shake)\n'+
    '- Choose muscle-building foods\n\n'+
    'AVAILABLE FOODS:\n'+foodList+'\n\n'+
    'Return ONLY valid JSON:\n'+
    '{"target_calories":'+targetCal+',"target_protein":'+targetProtein+',"rmr":'+Math.round(rmr)+',"tdee":'+tdee+
    ',"goal":"'+goal+'","protein_ratio":'+proteinRatio+',"shake_twice":'+shakeTwice+',"shake_kcal":'+shakeCal+',"shake_protein":'+shakeProtein+',"note":"",'+
    '"days":{"monday":'+dayTemplate+',"tuesday":'+dayTemplate+',"wednesday":'+dayTemplate+','+
    '"thursday":'+dayTemplate+',"friday":'+dayTemplate+',"saturday":'+dayTemplate+',"sunday":'+dayTemplate+'}}';

  try {
    var raw = await callGroq(null, prompt, { temperature: 0.3 });
    // Extract JSON from response
    var jsonMatch = raw.match(/\{[\s\S]*\}/);
    if(!jsonMatch) throw new Error('AI did not return valid JSON');
    var plan = JSON.parse(jsonMatch[0]);
    plan.generated = new Date().toISOString().split('T')[0];
    plan.client_name = c.name;
    // Save to Supabase
    await dbUpdate('customers', custId, { diet_plan: JSON.stringify(plan) });
    // Save to diet_plan_history
    try { await dbInsert('diet_plan_history', { customer_id: custId, plan_json: JSON.stringify(plan), generated_at: plan.generated || new Date().toISOString().split('T')[0] }); } catch(e) { /* history save is non-critical */ }
    // Update local cache
    var idx = D.customers.findIndex(function(x){return x.id===custId;});
    if(idx>=0) D.customers[idx].diet_plan = JSON.stringify(plan);
    showToast('Diet plan generated for '+c.name+'!','success');
    renderCustomers();
  } catch(e) {
    showToast('Error: '+e.message,'error');
  } finally {
    _dietInFlight = false;
  }
}

// ── DIET PLAN HISTORY VIEWER ──
async function viewDietHistory(custId, custName) {
  document.getElementById('diet-history-cust-name').textContent = custName;
  var el = document.getElementById('diet-history-list');
  el.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:20px">Loading…</div>';
  openModal('diet-history');
  var records = [];
  try {
    records = await dbGet('diet_plan_history', { customer_id: 'eq.' + custId, order: 'created_at.desc' });
  } catch(e) { records = []; }

  // Also show current plan if no history yet
  if (!records.length) {
    var cust = D.customers.find(function(x){ return x.id === custId; });
    if (cust && cust.diet_plan) {
      try {
        var p = JSON.parse(cust.diet_plan);
        records = [{ plan_json: cust.diet_plan, generated_at: p.generated || 'Current', id: 'current' }];
      } catch(e) {}
    }
  }

  if (!records.length) { el.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:24px">No diet plan history found. Generate a plan first.</div>'; return; }

  el.innerHTML = records.map(function(r, i) {
    var plan = {};
    try { plan = JSON.parse(r.plan_json); } catch(e) { return ''; }
    var isLatest = i === 0;
    var days = plan.days || [];
    var label = r.generated_at || plan.generated || '—';
    var calories = plan.targetCalories || '—';
    var protein = plan.targetProtein || '—';
    var collapsed = i > 0; // only latest expanded by default

    var daysHtml = days.map(function(day) {
      return '<div style="margin-bottom:10px">'
        + '<div style="font-weight:700;font-size:12px;color:var(--primary);margin-bottom:4px">'+day.day+'</div>'
        + (day.meals||[]).map(function(meal){
            return '<div style="font-size:12px;padding:4px 0;border-bottom:1px solid var(--border)">'
              + '<span style="font-weight:600;color:var(--muted)">'+meal.time+'</span> — '+meal.items
              + (meal.calories?' <span style="color:var(--muted);font-size:11px">('+meal.calories+' kcal)</span>':'')
              + '</div>';
          }).join('')
        + '</div>';
    }).join('');

    var uid = 'dph-' + r.id;
    return '<div style="border:1px solid var(--border);border-radius:10px;margin-bottom:12px;overflow:hidden">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--surface2);cursor:pointer" onclick="var b=document.getElementById(\''+uid+'\');b.style.display=b.style.display===\'none\'?\'block\':\'none\'">'
      +   '<div>'
      +     '<span style="font-weight:700;font-size:13px">'+(isLatest?'⭐ Latest — ':'')+label+'</span>'
      +     '<span style="font-size:11px;color:var(--muted);margin-left:10px">'+calories+' kcal · '+protein+'g protein · '+days.length+' days</span>'
      +     '<button class="btn-p" style="font-size:10px;padding:2px 6px;margin-left:12px;background:#0369a1;border-color:#0369a1;color:#fff" onclick="event.stopPropagation();generateGroceryList(\''+custId+'\')">🛒 AI Grocery List</button>'
      +   '</div>'
      +   '<span style="font-size:12px;color:var(--muted)">'+(collapsed?'▼ Expand':'▲ Collapse')+'</span>'
      + '</div>'
      + '<div id="'+uid+'" style="padding:14px 16px;display:'+(collapsed?'none':'block')+'">'
      +   (daysHtml || '<div style="color:var(--muted);font-size:12px">No day data</div>')
      + '</div>'
      + '</div>';
  }).join('');
}

// ── MEAL COMPLIANCE VIEWER ──
async function viewMealCompliance(custId, custName) {
  var cust = D.customers.find(function(c){return c.id===custId;})||{};
  var isTwice = cust.shake_frequency === 'twice';
  var today = new Date().toISOString().split('T')[0];
  var dates = [];
  for(var i=6;i>=0;i--){ var d=new Date(); d.setDate(d.getDate()-i); dates.push(d.toISOString().split('T')[0]); }
  showToast('Loading compliance data...','success');
  var logs=[], attLogs=[];
  try { logs = await dbGet('meal_logs','customer_id=eq.'+custId+'&date=gte.'+dates[0]+'&order=date.asc')||[]; } catch(e){}
  try { attLogs = await dbGet('attendance','customer_id=eq.'+custId+'&date=gte.'+dates[0]+'&order=date.asc')||[]; } catch(e){}

  var mealLabels = {breakfast:'Breakfast',mid_morning:'Mid-Morning',lunch:'Lunch',evening:'Evening Snack',post_workout:'Post-Workout Shake',dinner:'Dinner'};
  var shakeIcon = {center:'✅ Center',home:'🏠 Home',missed:'❌ Missed',na:'—'};

  var html = '<div style="font-family:inherit">';
  html += '<h3 style="margin:0 0 4px;font-size:16px">📋 Meal Compliance — '+custName+'</h3>';
  html += '<p style="font-size:12px;color:#6b7280;margin-bottom:14px">Shake: '+(isTwice?'2x/day (morning + post-workout)':'1x/day')+' &nbsp;|&nbsp; Last 7 days</p>';

  dates.forEach(function(date){
    var dayLogs = logs.filter(function(l){return l.date===date;});
    var attRec  = attLogs.find(function(a){return a.date===date;});
    var completed = dayLogs.filter(function(l){return l.completed;}).length;
    var total = dayLogs.length||0;
    var pct = total ? Math.round((completed/total)*100) : 0;
    var label = new Date(date+'T00:00:00').toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'});

    // Shake missed alert
    var shakeAlert = '';
    if(isTwice && attRec && attRec.status==='present'){
      var ms = attRec.morning_shake||'center';
      var pw = attRec.postworkout_shake||'center';
      if(ms==='missed'||pw==='missed') shakeAlert = '<span style="font-size:10px;background:#fee2e2;color:#991b1b;padding:2px 6px;border-radius:6px;margin-left:6px">⚠️ Missed shake</span>';
    }

    html += '<div style="margin-bottom:14px;padding:10px 12px;border-radius:10px;background:#f9fafb;border:1px solid #e5e7eb">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:600;margin-bottom:6px">'+
      '<span>'+label+(date===today?' <span style="color:#16a34a">(Today)</span>':'')+'</span>'+
      '<span style="color:#374151">'+completed+'/'+total+' meals'+shakeAlert+'</span></div>';

    // Shake tracking from attendance
    if(attRec){
      html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">';
      html += '<span style="font-size:10px;padding:2px 8px;border-radius:10px;background:'+(attRec.morning_shake==='missed'?'#fee2e2':attRec.morning_shake==='home'?'#dbeafe':'#dcfce7')+';color:#374151">☀️ Morning: '+(shakeIcon[attRec.morning_shake]||'—')+'</span>';
      if(isTwice) html += '<span style="font-size:10px;padding:2px 8px;border-radius:10px;background:'+(attRec.postworkout_shake==='missed'?'#fee2e2':attRec.postworkout_shake==='home'?'#dbeafe':'#dcfce7')+';color:#374151">💪 Post-workout: '+(shakeIcon[attRec.postworkout_shake]||'—')+'</span>';
      html += '</div>';
    }

    if(total>0){
      html += '<div style="height:6px;background:#e5e7eb;border-radius:4px;margin-bottom:6px"><div style="height:6px;border-radius:4px;background:'+(pct>=80?'#16a34a':pct>=50?'#f59e0b':'#ef4444')+';width:'+pct+'%"></div></div>';
      html += '<div style="display:flex;gap:4px;flex-wrap:wrap">';
      dayLogs.forEach(function(l){
        html += '<span style="font-size:10px;padding:2px 6px;border-radius:10px;background:'+(l.completed?'#dcfce7':'#fee2e2')+';color:'+(l.completed?'#166534':'#991b1b')+'">'+(mealLabels[l.meal_type]||l.meal_type)+'</span>';
      });
      html += '</div>';
    } else {
      html += '<div style="font-size:11px;color:#9ca3af">No meal data recorded by client</div>';
    }
    html += '</div>';
  });
  html += '</div>';

  // Show in a simple modal
  var modal = document.getElementById('modal-overlay') || document.createElement('div');
  modal.id = 'compliance-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
  modal.innerHTML = '<div style="background:#fff;border-radius:16px;padding:24px;max-width:480px;width:100%;max-height:80vh;overflow-y:auto">'+html+
    '<button onclick="document.getElementById(\'compliance-modal\').remove()" style="margin-top:16px;width:100%;padding:10px;background:#f3f4f6;border:none;border-radius:8px;font-family:inherit;cursor:pointer;font-size:14px">Close</button></div>';
  document.body.appendChild(modal);
}

// ── BULK DIET PLAN GENERATOR ──
async function bulkGenerateDietPlans() {
  if (isCenterSession() && !isElitePlan()) { showToast('AI Diet Plans are an Elite plan feature (₹999/mo). Request upgrade via WhatsApp.', 'error'); return; }
  if(_dietInFlight){ showToast('Already generating a plan...','error'); return; }
  var groqKey = getGroqKey();
  if(!groqKey){ showToast('Set your Groq API key in SQL/Config section first','error'); return; }
  if(!D_FOODS.length){ showToast('Add foods to the Food Database first','error'); return; }

  // Separate eligible vs ineligible
  var pending = [], skipped = [];
  D.customers.forEach(function(c){
    if(c.diet_plan) return; // already has plan
    var bodyRecs = D.body.filter(function(b){return b.customer_id===c.id;});
    var w   = bodyRecs.length ? parseFloat(bodyRecs[0].weight) : null;
    var h   = parseFloat(c.height) || null;
    var age = c.age ? parseInt(c.age) : (c.dob ? Math.floor((new Date()-new Date(c.dob))/(365.25*24*3600*1000)) : null);
    if(w && h && age){ pending.push(c); }
    else {
      var missing = [];
      if(!w)   missing.push('body scan weight');
      if(!h)   missing.push('height');
      if(!age) missing.push('age/DOB');
      skipped.push({name:c.name, missing:missing.join(', ')});
    }
  });

  if(!pending.length && !skipped.length){ showToast('All customers already have a diet plan!','success'); return; }

  // Show skipped report before generating
  if(skipped.length){
    var skipHtml = '<div style="font-family:inherit"><h3 style="margin:0 0 12px;font-size:15px">⚠️ '+skipped.length+' customers need data before a plan can be generated:</h3>';
    skipHtml += '<div style="max-height:260px;overflow-y:auto">';
    skipped.forEach(function(s){
      skipHtml += '<div style="padding:8px 12px;border-radius:8px;background:#fef3c7;margin-bottom:6px;font-size:13px">'+
        '<strong>'+s.name+'</strong><br><span style="color:#92400e">Missing: '+s.missing+'</span></div>';
    });
    skipHtml += '</div>';
    if(pending.length){
      skipHtml += '<p style="margin-top:12px;font-size:13px;color:#374151">Will generate plans for the other <strong>'+pending.length+' customers</strong> who have complete data.</p>';
    }
    skipHtml += '<div style="display:flex;gap:8px;margin-top:14px">'+
      (pending.length?'<button onclick="document.getElementById(\'bulk-skip-modal\').remove();_doBulkGenerate();" style="flex:1;padding:10px;background:#16a34a;color:#fff;border:none;border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer">Generate for '+pending.length+' eligible</button>':'')+
      '<button onclick="document.getElementById(\'bulk-skip-modal\').remove()" style="flex:1;padding:10px;background:#f3f4f6;border:none;border-radius:8px;font-family:inherit;font-size:13px;cursor:pointer">Close — fix data first</button>'+
    '</div></div>';
    var modal = document.createElement('div');
    modal.id = 'bulk-skip-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
    modal.innerHTML = '<div style="background:#fff;border-radius:16px;padding:24px;max-width:480px;width:100%">'+skipHtml+'</div>';
    document.body.appendChild(modal);
    if(!pending.length) return;
    return; // wait for user to click "Generate for X eligible"
  }

  _doBulkGenerate();
}

async function _doBulkGenerate() {
  var pending = D.customers.filter(function(c){
    if(c.diet_plan) return false;
    var bodyRecs = D.body.filter(function(b){return b.customer_id===c.id;});
    var w   = bodyRecs.length ? parseFloat(bodyRecs[0].weight) : null;
    var h   = parseFloat(c.height) || null;
    var age = c.age ? parseInt(c.age) : (c.dob ? Math.floor((new Date()-new Date(c.dob))/(365.25*24*3600*1000)) : null);
    return w && h && age;
  });
  if(!pending.length){ showToast('All eligible customers already have a diet plan!','success'); return; }

  getCredentials();
  if(!SB_URL){ showToast('Supabase not connected','error'); return; }

  var btn = document.getElementById('bulk-diet-btn');
  if(btn){ btn.disabled=true; btn.textContent='⏳ Generating...'; }
  _dietInFlight = true;
  showToast('Sending '+pending.length+' customers to edge function...','success');

  try {
    var edgeUrl = SB_URL.replace(/\/$/, '') + '/functions/v1/bulk-diet';
    var res = await fetch(edgeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + SB_KEY
      },
      body: JSON.stringify({
        customerIds: pending.map(function(c){ return c.id; }),
        foodsDb: D_FOODS
      })
    });

    var data = await res.json();
    if(!res.ok) throw new Error(data.error || 'Edge function error ' + res.status);

    // Reload customers so diet_plan fields reflect what the edge function saved
    var fresh = await dbGet('customers', '*');
    if(fresh) D.customers = fresh;

    renderCustomers();
    showToast('Done! '+data.done+' plans generated'+(data.failed?' | '+data.failed+' failed':''),'success');
    if(data.errors && data.errors.length) console.warn('Bulk diet errors:', data.errors);
  } catch(e) {
    showToast('Bulk generate failed: '+e.message,'error');
    console.error(e);
  }

  _dietInFlight = false;
  if(btn){ btn.disabled=false; btn.textContent='🥗 Bulk Diet Plans'; }
}

// ── FOOD DATABASE ──
var D_FOODS = [];

async function seedIndianFoods() {
  if(!confirm('This will add locally available Nandyal foods + common Indian foods to your database. Continue?')) return;
  var seeds = [
    // ── WEIGHT LOSS — Slow Carbs ──
    {name:'Ragi (Finger Millet)',goal:'weight_loss',category:'veg',calories:336,protein:7.3,carbs:72,fat:1.9,fiber:3.6,meal_time:'any'},
    {name:'Jowar (Sorghum)',goal:'weight_loss',category:'veg',calories:329,protein:10.4,carbs:67,fat:3.4,fiber:6.3,meal_time:'any'},
    {name:'Brown Rice',goal:'weight_loss',category:'veg',calories:111,protein:2.6,carbs:23,fat:0.9,fiber:1.8,meal_time:'lunch'},
    {name:'Oats',goal:'weight_loss',category:'veg',calories:389,protein:17,carbs:66,fat:7,fiber:10.6,meal_time:'breakfast'},
    {name:'Whole Wheat Atta',goal:'weight_loss',category:'veg',calories:340,protein:12,carbs:71,fat:1.9,fiber:12.2,meal_time:'any'},
    {name:'Barley (Jav)',goal:'weight_loss',category:'veg',calories:354,protein:12.5,carbs:73,fat:2.3,fiber:17.3,meal_time:'any'},
    // ── WEIGHT GAIN — Calorie Dense Carbs ──
    {name:'White Rice',goal:'weight_gain',category:'veg',calories:130,protein:2.7,carbs:28,fat:0.3,fiber:0.4,meal_time:'lunch'},
    {name:'Sweet Potato',goal:'weight_gain',category:'veg',calories:86,protein:1.6,carbs:20,fat:0.1,fiber:3,meal_time:'any'},
    {name:'Banana',goal:'weight_gain',category:'veg',calories:89,protein:1.1,carbs:23,fat:0.3,fiber:2.6,meal_time:'breakfast'},
    {name:'Ragi Malt with Jaggery',goal:'weight_gain',category:'veg',calories:350,protein:7,carbs:75,fat:2,fiber:3,meal_time:'breakfast'},
    {name:'Whole Wheat Bread',goal:'weight_gain',category:'veg',calories:247,protein:9,carbs:48,fat:3.4,fiber:4,meal_time:'breakfast'},
    {name:'Mango',goal:'weight_gain',category:'veg',calories:60,protein:0.8,carbs:15,fat:0.4,fiber:1.6,meal_time:'snack'},
    // ── PROTEINS (both goals) ──
    {name:'Eggs (Whole)',goal:'both',category:'both',calories:155,protein:13,carbs:1.1,fat:11,fiber:0,meal_time:'breakfast'},
    {name:'Egg White (Boiled)',goal:'weight_loss',category:'both',calories:52,protein:11,carbs:0.7,fat:0.2,fiber:0,meal_time:'any'},
    {name:'Chicken Breast',goal:'weight_loss',category:'non-veg',calories:165,protein:31,carbs:0,fat:3.6,fiber:0,meal_time:'lunch'},
    {name:'Chicken Thighs',goal:'weight_gain',category:'non-veg',calories:209,protein:26,carbs:0,fat:11,fiber:0,meal_time:'lunch'},
    {name:'Rohu / Catla Fish',goal:'both',category:'non-veg',calories:97,protein:18,carbs:0,fat:2.4,fiber:0,meal_time:'lunch'},
    {name:'Mutton',goal:'weight_gain',category:'non-veg',calories:258,protein:26,carbs:0,fat:17,fiber:0,meal_time:'lunch'},
    {name:'Toor Dal',goal:'weight_loss',category:'veg',calories:343,protein:22,carbs:63,fat:1.9,fiber:15,meal_time:'lunch'},
    {name:'Moong Dal',goal:'both',category:'veg',calories:347,protein:24,carbs:63,fat:1.2,fiber:16.3,meal_time:'any'},
    {name:'Chana Dal',goal:'weight_loss',category:'veg',calories:364,protein:20,carbs:65,fat:5.3,fiber:17.4,meal_time:'lunch'},
    {name:'Rajma (Kidney Beans)',goal:'both',category:'veg',calories:333,protein:24,carbs:60,fat:1.5,fiber:24.9,meal_time:'lunch'},
    {name:'Chana (Chickpeas)',goal:'both',category:'veg',calories:164,protein:8.9,carbs:27,fat:2.6,fiber:7.6,meal_time:'lunch'},
    {name:'Paneer',goal:'both',category:'veg',calories:265,protein:18,carbs:1.2,fat:21,fiber:0,meal_time:'any'},
    {name:'Curd (Homemade)',goal:'weight_loss',category:'veg',calories:61,protein:3.5,carbs:4.7,fat:3.3,fiber:0,meal_time:'any'},
    {name:'Full-fat Milk',goal:'weight_gain',category:'veg',calories:61,protein:3.2,carbs:4.8,fat:3.3,fiber:0,meal_time:'breakfast'},
    {name:'Groundnuts / Peanuts',goal:'both',category:'veg',calories:567,protein:26,carbs:16,fat:49,fiber:8.5,meal_time:'snack'},
    {name:'Peanut Butter',goal:'weight_gain',category:'veg',calories:588,protein:25,carbs:20,fat:50,fiber:6,meal_time:'breakfast'},
    {name:'Chikki (Groundnut+Jaggery)',goal:'weight_gain',category:'veg',calories:450,protein:12,carbs:55,fat:22,fiber:4,meal_time:'snack'},
    {name:'Mixed Nuts',goal:'weight_gain',category:'veg',calories:607,protein:18,carbs:21,fat:54,fiber:7,meal_time:'snack'},
    {name:'Soya Chunks',goal:'both',category:'veg',calories:149,protein:18,carbs:14,fat:0.5,fiber:2.5,meal_time:'lunch'},
    // ── VEGETABLES (weight loss) ──
    {name:'Drumstick (Munagakaya)',goal:'weight_loss',category:'veg',calories:37,protein:2.1,carbs:8.5,fat:0.2,fiber:3.2,meal_time:'lunch'},
    {name:'Bitter Gourd (Kakarakaya)',goal:'weight_loss',category:'veg',calories:17,protein:1,carbs:3.7,fat:0.2,fiber:2.8,meal_time:'lunch'},
    {name:'Ridge Gourd (Beerakaya)',goal:'weight_loss',category:'veg',calories:17,protein:0.7,carbs:4,fat:0.1,fiber:0.5,meal_time:'lunch'},
    {name:'Snake Gourd (Potlakaya)',goal:'weight_loss',category:'veg',calories:18,protein:0.5,carbs:3.3,fat:0.5,fiber:0.8,meal_time:'lunch'},
    {name:'Brinjal',goal:'weight_loss',category:'veg',calories:25,protein:1,carbs:5.9,fat:0.2,fiber:3,meal_time:'lunch'},
    {name:'Tomato',goal:'weight_loss',category:'veg',calories:18,protein:0.9,carbs:3.9,fat:0.2,fiber:1.2,meal_time:'any'},
    {name:'Spinach (Palakura)',goal:'weight_loss',category:'veg',calories:23,protein:2.9,carbs:3.6,fat:0.4,fiber:2.2,meal_time:'any'},
    {name:'Fenugreek Leaves (Menthi)',goal:'weight_loss',category:'veg',calories:49,protein:4.4,carbs:6,fat:0.9,fiber:2.7,meal_time:'any'},
    {name:'Cluster Beans (Goru Chikkudu)',goal:'weight_loss',category:'veg',calories:16,protein:3.2,carbs:0,fat:0.4,fiber:1.4,meal_time:'lunch'},
    {name:'Bottle Gourd (Sorakaya)',goal:'weight_loss',category:'veg',calories:14,protein:0.6,carbs:3.4,fat:0.1,fiber:0.5,meal_time:'lunch'},
    {name:'Onion',goal:'both',category:'veg',calories:40,protein:1.1,carbs:9.3,fat:0.1,fiber:1.7,meal_time:'any'},
    {name:'Capsicum',goal:'weight_loss',category:'veg',calories:31,protein:1,carbs:6,fat:0.3,fiber:2.1,meal_time:'any'},
    {name:'Cabbage',goal:'weight_loss',category:'veg',calories:25,protein:1.3,carbs:5.8,fat:0.1,fiber:2.5,meal_time:'any'},
    {name:'Carrot',goal:'weight_loss',category:'veg',calories:41,protein:0.9,carbs:9.6,fat:0.2,fiber:2.8,meal_time:'snack'},
    {name:'Beetroot',goal:'both',category:'veg',calories:43,protein:1.6,carbs:9.6,fat:0.2,fiber:2.8,meal_time:'any'},
    {name:'Cucumber',goal:'weight_loss',category:'veg',calories:16,protein:0.7,carbs:3.6,fat:0.1,fiber:0.5,meal_time:'snack'},
    // ── FRUITS ──
    {name:'Guava',goal:'weight_loss',category:'veg',calories:68,protein:2.6,carbs:14,fat:1,fiber:5.4,meal_time:'snack'},
    {name:'Papaya',goal:'both',category:'veg',calories:43,protein:0.5,carbs:11,fat:0.3,fiber:1.7,meal_time:'breakfast'},
    {name:'Watermelon',goal:'weight_loss',category:'veg',calories:30,protein:0.6,carbs:7.6,fat:0.2,fiber:0.4,meal_time:'snack'},
    {name:'Pomegranate',goal:'both',category:'veg',calories:83,protein:1.7,carbs:19,fat:1.2,fiber:4,meal_time:'snack'},
    {name:'Amla (Indian Gooseberry)',goal:'both',category:'veg',calories:44,protein:0.9,carbs:10,fat:0.6,fiber:4.3,meal_time:'any'},
    {name:'Lime / Lemon',goal:'weight_loss',category:'veg',calories:29,protein:1.1,carbs:9.3,fat:0.3,fiber:2.8,meal_time:'any'},
    {name:'Orange',goal:'weight_loss',category:'veg',calories:47,protein:0.9,carbs:12,fat:0.1,fiber:2.4,meal_time:'snack'},
    {name:'Mosambi (Sweet Lime)',goal:'weight_loss',category:'veg',calories:43,protein:0.8,carbs:10,fat:0.1,fiber:0.5,meal_time:'snack'},
    {name:'Apple',goal:'both',category:'veg',calories:52,protein:0.3,carbs:14,fat:0.2,fiber:2.4,meal_time:'snack'},
    // ── FATS ──
    {name:'Flaxseeds (Avise Ginjalu)',goal:'both',category:'veg',calories:534,protein:18,carbs:29,fat:42,fiber:27,meal_time:'any'},
    {name:'Sesame Seeds (Nuvvulu)',goal:'both',category:'veg',calories:573,protein:17,carbs:23,fat:50,fiber:11.8,meal_time:'any'},
    {name:'Coconut',goal:'both',category:'veg',calories:354,protein:3.3,carbs:15,fat:33,fiber:9,meal_time:'any'},
    // ── BEVERAGES ──
    {name:'Buttermilk (Majjiga)',goal:'weight_loss',category:'veg',calories:40,protein:3.5,carbs:4.9,fat:1,fiber:0,meal_time:'any'},
    {name:'Coconut Water',goal:'both',category:'veg',calories:19,protein:0.7,carbs:3.7,fat:0.2,fiber:1.1,meal_time:'any'},
    {name:'Jeera Water',goal:'weight_loss',category:'veg',calories:5,protein:0.2,carbs:0.9,fat:0.1,fiber:0.1,meal_time:'any'},
    // ── OTHER COMMON INDIAN FOODS ──
    {name:'Roti (Whole Wheat)',goal:'both',category:'veg',calories:71,protein:2.7,carbs:15,fat:0.4,fiber:2,meal_time:'any'},
    {name:'Poha',goal:'weight_loss',category:'veg',calories:110,protein:2.5,carbs:23,fat:0.5,fiber:0.9,meal_time:'breakfast'},
    {name:'Upma',goal:'both',category:'veg',calories:120,protein:3,carbs:22,fat:2.5,fiber:1.5,meal_time:'breakfast'},
    {name:'Idli (plain)',goal:'weight_loss',category:'veg',calories:58,protein:2,carbs:12,fat:0.4,fiber:0.5,meal_time:'breakfast'},
    {name:'Sambar',goal:'weight_loss',category:'veg',calories:55,protein:2.5,carbs:9,fat:1,fiber:2,meal_time:'any'},
    {name:'Moong Dal Khichdi',goal:'weight_loss',category:'veg',calories:130,protein:5.5,carbs:24,fat:1.5,fiber:2.5,meal_time:'dinner'},
    {name:'Besan Chilla',goal:'weight_loss',category:'veg',calories:150,protein:8,carbs:22,fat:3,fiber:4,meal_time:'breakfast'},
    {name:'Tofu',goal:'weight_loss',category:'veg',calories:76,protein:8,carbs:1.9,fat:4.8,fiber:0.3,meal_time:'any'},
    // ── NANDYAL / ANDHRA SPECIFIC ──
    {name:'Korra (Foxtail Millet)',goal:'weight_loss',category:'veg',calories:331,protein:12.3,carbs:67,fat:3.3,fiber:6.7,meal_time:'any'},
    {name:'Sajja (Pearl Millet / Bajra)',goal:'weight_loss',category:'veg',calories:361,protein:11.6,carbs:67,fat:5,fiber:1.2,meal_time:'any'},
    {name:'Ulavalu (Horse Gram)',goal:'both',category:'veg',calories:321,protein:22,carbs:57,fat:0.5,fiber:5.3,meal_time:'lunch'},
    {name:'Minapappu (Urad Dal)',goal:'both',category:'veg',calories:347,protein:25,carbs:59,fat:1.6,fiber:18.3,meal_time:'any'},
    {name:'Pesarapappu (Moong Beans)',goal:'both',category:'veg',calories:347,protein:24,carbs:63,fat:1,fiber:16.3,meal_time:'any'},
    {name:'Gongura (Sorrel Leaves)',goal:'weight_loss',category:'veg',calories:46,protein:3,carbs:9,fat:0.2,fiber:2.5,meal_time:'lunch'},
    {name:'Dosakaya (Yellow Cucumber)',goal:'weight_loss',category:'veg',calories:14,protein:0.6,carbs:3,fat:0.1,fiber:0.5,meal_time:'lunch'},
    {name:'Bendakaya (Lady Finger / Okra)',goal:'weight_loss',category:'veg',calories:33,protein:2,carbs:7,fat:0.2,fiber:3.2,meal_time:'lunch'},
    {name:'Chikkudukaya (Broad Beans)',goal:'weight_loss',category:'veg',calories:40,protein:3.6,carbs:7,fat:0.4,fiber:2,meal_time:'lunch'},
    {name:'Munaga Aaku (Drumstick Leaves)',goal:'weight_loss',category:'veg',calories:64,protein:9.4,carbs:8.5,fat:1.4,fiber:2,meal_time:'any'},
    {name:'Thotakura (Amaranth Leaves)',goal:'weight_loss',category:'veg',calories:27,protein:2.5,carbs:4,fat:0.3,fiber:1.5,meal_time:'any'},
    {name:'Pesarattu (Moong Crepe)',goal:'weight_loss',category:'veg',calories:130,protein:6,carbs:18,fat:4,fiber:2,meal_time:'breakfast'},
    {name:'Jonna Roti (Jowar Flatbread)',goal:'weight_loss',category:'veg',calories:150,protein:4,carbs:30,fat:1.5,fiber:2.5,meal_time:'any'},
    {name:'Pongal (Rice + Dal)',goal:'both',category:'veg',calories:150,protein:4.5,carbs:25,fat:4,fiber:1.5,meal_time:'breakfast'},
    {name:'Chepa Pulusu (Fish Curry)',goal:'both',category:'non-veg',calories:150,protein:15,carbs:8,fat:6,fiber:1,meal_time:'lunch'},
    {name:'Kodi Kura (Chicken Curry)',goal:'both',category:'non-veg',calories:175,protein:20,carbs:5,fat:8,fiber:0.5,meal_time:'lunch'},
    {name:'Gongura Pachadi (Chutney)',goal:'weight_loss',category:'veg',calories:60,protein:2,carbs:8,fat:2,fiber:1.5,meal_time:'any'},
    {name:'Nuvvula Unda (Sesame Ladoo)',goal:'weight_gain',category:'veg',calories:380,protein:7,carbs:50,fat:18,fiber:4,meal_time:'snack'},
    {name:'Dosa (Plain)',goal:'weight_loss',category:'veg',calories:168,protein:4,carbs:30,fat:3.7,fiber:1,meal_time:'breakfast'}
  ];
  var existing = D_FOODS.map(function(f){return f.name.toLowerCase();});
  var toInsert = seeds.filter(function(s){return !existing.includes(s.name.toLowerCase());});
  if(!toInsert.length){ showToast('All foods already exist in the database!','success'); return; }
  showToast('Seeding '+toInsert.length+' foods...','success');
  var failed=0;
  for(var i=0;i<toInsert.length;i++){
    try{ await dbInsert('foods', toInsert[i]); } catch(e){ failed++; }
  }
  await loadFoods();
  showToast('Seeded '+(toInsert.length-failed)+' Indian foods!'+(failed?' '+failed+' failed':''),'success');
}

async function loadFoods() {
  try { D_FOODS = await dbGet('foods') || []; } catch(e) { D_FOODS = []; }
  if(document.getElementById('sec-foods') && document.getElementById('sec-foods').classList.contains('active')) renderFoods();
  renderFoodStats();
}

function renderFoodStats() {
  var el = document.getElementById('food-stats'); if(!el) return;
  var veg = D_FOODS.filter(function(f){return f.category==='veg';}).length;
  var nonveg = D_FOODS.filter(function(f){return f.category==='non-veg';}).length;
  var both = D_FOODS.filter(function(f){return f.category==='both';}).length;
  el.innerHTML = '<div class="stat"><div class="stat-l">Total Foods</div><div class="stat-v">'+D_FOODS.length+'</div></div>'+
    '<div class="stat"><div class="stat-l">Veg</div><div class="stat-v" style="color:var(--success)">'+veg+'</div></div>'+
    '<div class="stat"><div class="stat-l">Non-Veg</div><div class="stat-v" style="color:var(--danger)">'+nonveg+'</div></div>'+
    '<div class="stat"><div class="stat-l">Both</div><div class="stat-v">'+both+'</div></div>';
}

function renderFoods() {
  var q    = (document.getElementById('food-search').value||'').toLowerCase();
  var cat  = document.getElementById('food-cat-filter').value;
  var meal = document.getElementById('food-meal-filter').value;
  var goal = document.getElementById('food-goal-filter').value;
  var list = D_FOODS.filter(function(f){
    if(cat  && f.category !== cat)  return false;
    if(meal && f.meal_time !== meal) return false;
    if(goal && f.goal !== goal)      return false;
    if(q    && !(f.name||'').toLowerCase().includes(q)) return false;
    return true;
  });
  var tbody = document.getElementById('food-tbody');
  if(!list.length){ tbody.innerHTML='<tr><td colspan="10" style="text-align:center;padding:30px;color:var(--muted)">No foods found. Click + Add Food or use 🌱 Seed Indian Foods to get started.</td></tr>'; return; }
  var mealTag = {breakfast:'🌅 Breakfast',lunch:'☀️ Lunch',dinner:'🌙 Dinner',snack:'🍎 Snack',any:'🕐 Any'};
  var typeTag = {veg:'<span style="background:#eafaf1;color:#27ae60;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700">Veg</span>',
    'non-veg':'<span style="background:#fdf0ef;color:#c0392b;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700">Non-Veg</span>',
    both:'<span style="background:#f0f0ff;color:#5a5aaa;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700">Both</span>'};
  var goalTag = {weight_loss:'<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700">Loss</span>',
    weight_gain:'<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700">Gain</span>',
    both:'<span style="background:#e0e7ff;color:#3730a3;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700">Both</span>'};
  tbody.innerHTML = list.map(function(f){
    return '<tr>'+
      '<td style="font-weight:600">'+f.name+'</td>'+
      '<td>'+(typeTag[f.category]||f.category)+'</td>'+
      '<td>'+(goalTag[f.goal]||goalTag.both)+'</td>'+
      '<td>'+(mealTag[f.meal_time]||f.meal_time||'Any')+'</td>'+
      '<td>'+Number(f.calories||0).toFixed(0)+' kcal</td>'+
      '<td>'+Number(f.protein||0).toFixed(1)+'g</td>'+
      '<td>'+Number(f.carbs||0).toFixed(1)+'g</td>'+
      '<td>'+Number(f.fiber||0).toFixed(1)+'g</td>'+
      '<td>'+Number(f.fat||0).toFixed(1)+'g</td>'+
      '<td><button class="btn-e" onclick="editFood(\''+f.id+'\')">Edit</button> '+
      '<button class="btn-e" style="color:var(--danger)" onclick="deleteFood(\''+f.id+'\',\''+f.name+'\')">Delete</button></td>'+
    '</tr>';
  }).join('');
}

function openFoodModal() {
  document.getElementById('food-id').value='';
  document.getElementById('food-name').value='';
  document.getElementById('food-type').value='veg';
  document.getElementById('food-goal').value='both';
  document.getElementById('food-meal-time').value='any';
  document.getElementById('food-calories').value='';
  document.getElementById('food-protein').value='';
  document.getElementById('food-carbs').value='';
  document.getElementById('food-fiber').value='';
  document.getElementById('food-fat').value='';
  document.getElementById('food-modal-title').textContent='Add Food';
  openModal('food');
}

function editFood(id) {
  var f = D_FOODS.find(function(x){return x.id===id;}); if(!f) return;
  document.getElementById('food-id').value=f.id;
  document.getElementById('food-name').value=f.name||'';
  document.getElementById('food-type').value=f.category||'veg';
  document.getElementById('food-goal').value=f.goal||'both';
  document.getElementById('food-meal-time').value=f.meal_time||'any';
  document.getElementById('food-calories').value=f.calories||'';
  document.getElementById('food-protein').value=f.protein||'';
  document.getElementById('food-carbs').value=f.carbs||'';
  document.getElementById('food-fiber').value=f.fiber||'';
  document.getElementById('food-fat').value=f.fat||'';
  document.getElementById('food-modal-title').textContent='Edit Food';
  openModal('food');
}

async function saveFood() {
  var name = document.getElementById('food-name').value.trim();
  if(!name){ showToast('Food name is required','error'); return; }
  var payload = {
    name: name,
    category: document.getElementById('food-type').value,
    goal: document.getElementById('food-goal').value,
    meal_time: document.getElementById('food-meal-time').value,
    calories: parseFloat(document.getElementById('food-calories').value)||0,
    protein: parseFloat(document.getElementById('food-protein').value)||0,
    carbs: parseFloat(document.getElementById('food-carbs').value)||0,
    fiber: parseFloat(document.getElementById('food-fiber').value)||0,
    fat: parseFloat(document.getElementById('food-fat').value)||0
  };
  var id = document.getElementById('food-id').value;
  try {
    if(id) await dbUpdate('foods',id,payload); else await dbInsert('foods',payload);
    showToast(id?'Food updated!':'Food added!');
    closeModal('food');
    await loadFoods();
    renderFoods();
  } catch(e){ showToast('Error: '+e.message,'error'); }
}

async function deleteFood(id, name) {
  if(!confirm('Delete "'+name+'"?')) return;
  try {
    await dbDelete('foods',id);
    showToast('Food deleted');
    await loadFoods();
    renderFoods();
  } catch(e){ showToast('Error: '+e.message,'error'); }
}


// ══════════════════════════════════════════
//  CONTESTS
// ══════════════════════════════════════════

var _activeContestId = null;
var _contestTypeFilter = 'all';

var CONTEST_CONFIG = {
  weight_loss:  { label:'Weight Loss',  icon:'⬇️', color:'#ef4444', gradient:'linear-gradient(135deg,#c0392b,#e74c3c)', metric:'weight',          dir:-1, unit:'kg',  field:'current_weight',  startField:'start_weight' },
  weight_gain:  { label:'Weight Gain',  icon:'⬆️', color:'#2b5ce6', gradient:'linear-gradient(135deg,#1e3a8a,#2b5ce6)', metric:'weight',          dir:1,  unit:'kg',  field:'current_weight',  startField:'start_weight' },
  fat_loss:     { label:'Fat Loss',     icon:'🔥', color:'#f59e0b', gradient:'linear-gradient(135deg,#b45309,#f59e0b)', metric:'fat_percentage',  dir:-1, unit:'%',   field:'current_fat',     startField:'start_fat' },
  muscle_gain:  { label:'Muscle Gain',  icon:'💪', color:'#27ae60', gradient:'linear-gradient(135deg,#166534,#27ae60)', metric:'muscle_percentage',dir:1,  unit:'%',   field:'current_muscle',  startField:'start_muscle' }
};

async function loadContests() {
  D.contests = await dbGet('contests', 'created_at');
  D.contestParticipants = await dbGet('contest_participants', 'created_at');
}

function openContestModal(id) {
  document.getElementById('contest-id').value = id || '';
  if (id) {
    var c = D.contests.find(function(x){ return x.id === id; });
    if (!c) return;
    document.getElementById('contest-name').value        = c.name || '';
    document.getElementById('contest-type').value        = c.type || 'weight_loss';
    document.getElementById('contest-start').value       = c.start_date || '';
    document.getElementById('contest-prize').value       = c.prize_amount || '';
    document.getElementById('contest-entry-fee').value   = c.entry_fee || '';
    document.getElementById('contest-senior-amount').value = c.senior_amount || '';
    document.getElementById('contest-desc').value        = c.description || '';
    document.getElementById('contest-duration').value    = c.duration_days || '21';
  } else {
    document.getElementById('contest-name').value        = '';
    document.getElementById('contest-type').value        = 'weight_loss';
    document.getElementById('contest-start').value       = new Date().toISOString().slice(0,10);
    document.getElementById('contest-prize').value       = '';
    document.getElementById('contest-entry-fee').value   = '';
    document.getElementById('contest-senior-amount').value = '';
    document.getElementById('contest-desc').value        = '';
    document.getElementById('contest-duration').value    = '21';
  }
  openModal('contest');
}

function switchContestTab(tab) {
  document.getElementById('contest-leaderboard').style.display = tab==='leaderboard' ? '' : 'none';
  document.getElementById('contest-tracker').style.display     = tab==='tracker'     ? '' : 'none';
  document.getElementById('cd-tab-leaderboard').classList.toggle('active', tab==='leaderboard');
  document.getElementById('cd-tab-tracker').classList.toggle('active', tab==='tracker');
  if (tab==='tracker' && _activeContestId) renderContestTracker(_activeContestId);
}

function renderContestTracker(contestId) {
  var c   = D.contests.find(function(x){ return x.id===contestId; });
  var pts = D.contestParticipants.filter(function(p){ return p.contest_id===contestId; });
  var el  = document.getElementById('contest-tracker');
  if (!c || !el) return;

  var entryFee  = parseFloat(c.entry_fee||0);
  var seniorAmt = parseFloat(c.senior_amount||0);
  var paidCount = pts.filter(function(p){ return p.fee_paid; }).length;
  var totalCollected = paidCount * entryFee;
  var sentToSenior   = c.amount_sent_to_senior;

  // ── Summary bar ──
  var summaryHtml =
    '<div class="tracker-summary-bar">' +
      '<span class="tracker-summary-chip" style="background:var(--success-light);color:var(--success)">✅ Fee Paid: '+paidCount+'/'+pts.length+'</span>' +
      '<span class="tracker-summary-chip" style="background:var(--accent-light);color:#92400e">💰 Collected: ₹'+totalCollected+'</span>' +
      (seniorAmt>0 ? '<span class="tracker-summary-chip" style="background:#ede9fe;color:#6d28d9">📤 Senior share: ₹'+seniorAmt+'</span>' : '')+
      '<button class="senior-send-btn '+(sentToSenior?'done':'pending')+'" onclick="toggleSentToSenior(\''+contestId+'\')">' +
        (sentToSenior ? '✅ Amount Sent to Senior' : '📤 Mark Sent to Senior') +
      '</button>' +
    '</div>';

  if (!pts.length) {
    el.innerHTML = summaryHtml + '<div class="empty"><div class="ei">👥</div><p>No participants yet</p></div>';
    return;
  }

  // ── Rows ──
  var rows = pts.map(function(p) {
    var vt = p.video_tracking
      ? (typeof p.video_tracking==='string' ? JSON.parse(p.video_tracking) : p.video_tracking)
      : {};

    // Measurements — start vs final
    var hasFinal  = p.current_fat || p.current_muscle || p.current_weight;
    var startMeas = (p.start_weight||'—') + ' kg &nbsp;·&nbsp; ' +
                    (p.start_fat||'—') + '% fat &nbsp;·&nbsp; ' +
                    (p.start_muscle||'—') + '% muscle';
    var finalMeas = hasFinal
      ? (p.current_weight||'—') + ' kg &nbsp;·&nbsp; ' +
        (p.current_fat||'—')    + '% fat &nbsp;·&nbsp; ' +
        (p.current_muscle||'—') + '% muscle'
      : null;

    // 3 weight video columns (fixed)
    var videoCells = '';
    for (var w=1; w<=3; w++) {
      var wk  = vt['week'+w] || {};
      var got = wk.received  || false;
      var fwd = wk.forwarded || false;
      videoCells +=
        '<td style="border-left:2px solid var(--border);text-align:center">' +
          '<button class="tracker-toggle '+(got?'on':'')+'" onclick="toggleVideoStatus(\''+p.id+'\','+w+',\'received\')" title="Week '+w+' video '+(got?'received':'not received')+'">'+(got?'✅':'📹')+'</button>' +
        '</td>' +
        '<td style="text-align:center">' +
          '<button class="tracker-toggle '+(fwd?'on':got?'warn':'')+'" onclick="toggleVideoStatus(\''+p.id+'\','+w+',\'forwarded\')" title="'+(fwd?'Sent to senior':got?'Not sent yet':'Need video first')+'">'+(fwd?'✅':got?'📤':'—')+'</button>' +
        '</td>';
    }

    return '<tr>' +
      // Name
      '<td style="font-weight:600;white-space:nowrap">'+p.customer_name+'</td>' +

      // Fee paid
      '<td style="text-align:center">' +
        '<button class="tracker-toggle '+(p.fee_paid?'on':'')+'" onclick="togglePayment(\''+p.id+'\')" title="'+(p.fee_paid?'Paid':'Not paid')+'">' +
          (p.fee_paid?'✅':'₹') +
        '</button>' +
        (p.fee_paid && entryFee ? '<div style="font-size:10px;color:var(--success);margin-top:2px;font-weight:700">₹'+entryFee+'</div>' : '') +
      '</td>' +

      // Start measurements
      '<td style="font-size:11px;color:var(--muted)">'+startMeas+'</td>' +

      // Final measurements
      '<td>' +
        (finalMeas
          ? '<span style="font-size:11px;font-weight:700;color:var(--primary)">'+finalMeas+'</span>'
          : '<button class="btn-e" style="font-size:11px;padding:4px 10px;white-space:nowrap" onclick="openUpdateProgressModal(\''+p.id+'\')">Enter Final</button>') +
      '</td>' +

      // 3 video columns
      videoCells +
    '</tr>';
  }).join('');

  el.innerHTML = summaryHtml +
    '<div class="tracker-wrap">' +
      '<table class="tracker-tbl">' +
        '<thead>' +
          '<tr>' +
            '<th rowspan="2" style="text-align:left;min-width:120px">Participant</th>' +
            '<th rowspan="2">Fee<br>Paid</th>' +
            '<th rowspan="2" style="min-width:160px">Start Measurements<br><span style="font-weight:500;font-size:9px">(Day 1)</span></th>' +
            '<th rowspan="2" style="min-width:160px">Final Measurements<br><span style="font-weight:500;font-size:9px">(Last Day)</span></th>' +
            '<th colspan="2" style="border-left:2px solid var(--border)">Week 1 Video</th>' +
            '<th colspan="2" style="border-left:2px solid var(--border)">Week 2 Video</th>' +
            '<th colspan="2" style="border-left:2px solid var(--border)">Week 3 Video</th>' +
          '</tr>' +
          '<tr>' +
            '<th style="border-left:2px solid var(--border);font-size:9px">Got</th><th style="font-size:9px">Sent</th>' +
            '<th style="border-left:2px solid var(--border);font-size:9px">Got</th><th style="font-size:9px">Sent</th>' +
            '<th style="border-left:2px solid var(--border);font-size:9px">Got</th><th style="font-size:9px">Sent</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>'+rows+'</tbody>' +
      '</table>' +
    '</div>';
}

async function togglePayment(pid) {
  var p = D.contestParticipants.find(function(x){ return x.id===pid; });
  if (!p) return;
  var newVal = !p.fee_paid;
  try {
    await dbUpdate('contest_participants', pid, { fee_paid: newVal });
    p.fee_paid = newVal;
    renderContestTracker(_activeContestId);
    showToast(newVal ? '✅ Marked as paid' : 'Marked as unpaid', newVal?'success':'info');
  } catch(e) { showToast('Error: '+e.message,'error'); }
}

async function toggleVideoStatus(pid, week, field) {
  var p = D.contestParticipants.find(function(x){ return x.id===pid; });
  if (!p) return;
  var vt = p.video_tracking ? (typeof p.video_tracking==='string' ? JSON.parse(p.video_tracking) : Object.assign({}, p.video_tracking)) : {};
  if (!vt['week'+week]) vt['week'+week] = { received:false, forwarded:false };
  vt['week'+week][field] = !vt['week'+week][field];
  // Can't mark forwarded if not received
  if (field==='forwarded' && vt['week'+week].forwarded && !vt['week'+week].received) {
    vt['week'+week].received = true;
  }
  try {
    await dbUpdate('contest_participants', pid, { video_tracking: vt });
    p.video_tracking = vt;
    renderContestTracker(_activeContestId);
    var action = field==='received' ? (vt['week'+week].received?'Video received ✅':'Unmarked') : (vt['week'+week].forwarded?'Sent to senior ✅':'Unmarked');
    showToast(action, 'success');
  } catch(e) { showToast('Error: '+e.message,'error'); }
}

async function toggleSentToSenior(contestId) {
  var c = D.contests.find(function(x){ return x.id===contestId; });
  if (!c) return;
  if (c.amount_sent_to_senior) return; // Already sent, don't untoggle
  if (!confirm('Mark all collected amount as sent to senior?')) return;
  try {
    await dbUpdate('contests', contestId, { amount_sent_to_senior: true, senior_sent_date: new Date().toISOString().slice(0,10) });
    c.amount_sent_to_senior = true;
    renderContestTracker(contestId);
    showToast('✅ Marked as sent to senior!', 'success');
  } catch(e) { showToast('Error: '+e.message,'error'); }
}

async function saveContest() {
  var name       = document.getElementById('contest-name').value.trim();
  var type       = document.getElementById('contest-type').value;
  var start      = document.getElementById('contest-start').value;
  var prize      = document.getElementById('contest-prize').value;
  var entryFee   = document.getElementById('contest-entry-fee').value;
  var seniorAmt  = document.getElementById('contest-senior-amount').value;
  var desc       = document.getElementById('contest-desc').value.trim();
  var days       = parseInt(document.getElementById('contest-duration').value) || 21;
  var id         = document.getElementById('contest-id').value;
  if (!name || !start) { showToast('Name and start date are required', 'error'); return;  }
  var startD = new Date(start);
  var endD   = new Date(startD); endD.setDate(endD.getDate() + days);
  var endDate = endD.toISOString().slice(0,10);
  var payload = { name:name, type:type, start_date:start, end_date:endDate, duration_days:days, prize_amount:prize||0, entry_fee:entryFee||0, senior_amount:seniorAmt||0, description:desc, status:'active', wellness_center_id:ACTIVE_CENTER||null };
  try {
    if (id) {
      await dbUpdate('contests', id, payload);
      var idx = D.contests.findIndex(function(c){ return c.id===id; });
      if (idx>=0) D.contests[idx] = Object.assign(D.contests[idx], payload);
    } else {
      var row = await dbInsert('contests', payload);
      if (row && row[0]) D.contests.unshift(row[0]);
    }
    closeModal('contest');
    renderContests();
    showToast('Contest saved!', 'success');
  } catch(e) { showToast('Error: '+e.message, 'error'); }
}

async function deleteContest(id) {
  if (!confirm('Delete this contest and all participant data?')) return;
  try {
    await dbDelete('contests', id);
    D.contestParticipants = D.contestParticipants.filter(function(p){ return p.contest_id !== id; });
    D.contests = D.contests.filter(function(c){ return c.id !== id; });
    if (_activeContestId === id) closeContestDetail();
    renderContests();
    showToast('Contest deleted', 'info');
  } catch(e) { showToast('Error: '+e.message, 'error'); }
}

async function markContestComplete(id) {
  try {
    await dbUpdate('contests', id, { status:'completed' });
    var c = D.contests.find(function(x){ return x.id===id; });
    if (c) c.status = 'completed';
    renderContests();
    showToast('Contest marked as completed!', 'success');
  } catch(e) { showToast('Error: '+e.message, 'error'); }
}

function filterContestType(type, el) {
  _contestTypeFilter = type;
  document.querySelectorAll('.contest-type-chip').forEach(function(c){ c.classList.remove('active'); });
  if (el) el.classList.add('active');
  renderContests();
}

function renderContests() {
  var filter = _contestTypeFilter;
  var all = D.contests.filter(function(c){
    if(ACTIVE_CENTER && c.wellness_center_id && c.wellness_center_id !== ACTIVE_CENTER) return false;
    return filter==='all' || c.type===filter;
  });
  var active    = all.filter(function(c){ return c.status !== 'completed'; });
  var completed = all.filter(function(c){ return c.status === 'completed'; });
  var today = new Date(); today.setHours(0,0,0,0);

  // Active grid
  var activeGrid = document.getElementById('contests-active-grid');
  var activeEmpty = document.getElementById('contests-active-empty');
  if (!active.length) {
    activeGrid.innerHTML = '';
    activeGrid.appendChild(activeEmpty);
    activeEmpty.style.display = '';
  } else {
    activeGrid.innerHTML = active.map(function(c){ return buildContestCard(c, today); }).join('');
  }

  // Completed list
  var completedList = document.getElementById('contests-completed-list');
  var completedEmpty = document.getElementById('contests-completed-empty');
  if (!completed.length) {
    completedList.innerHTML = '';
    completedList.appendChild(completedEmpty);
    completedEmpty.style.display = '';
  } else {
    completedList.innerHTML = completed.map(function(c){
      var cfg = CONTEST_CONFIG[c.type] || CONTEST_CONFIG.weight_loss;
      var pts = D.contestParticipants.filter(function(p){ return p.contest_id===c.id; });
      var winner = pts.sort(function(a,b){ return cfg.dir*(parseFloat(b.progress||0)-parseFloat(a.progress||0)); })[0];
      return '<div class="contest-completed-row" onclick="openContestDetail(\''+c.id+'\')">' +
        '<div>' +
          '<div style="font-weight:700;font-size:14px">'+cfg.icon+' '+c.name+'</div>' +
          '<div style="font-size:11px;color:var(--muted);margin-top:2px">'+c.start_date+' → '+c.end_date+' · '+pts.length+' participants</div>' +
        '</div>' +
        '<div style="text-align:right">' +
          (winner ? '<div style="font-size:12px;font-weight:700;color:var(--accent)">🥇 '+winner.customer_name+'</div>' : '') +
          (c.prize_amount > 0 ? '<div style="font-size:11px;color:var(--muted)">₹'+c.prize_amount+' prize</div>' : '') +
        '</div>' +
        '<button class="btn-d" onclick="event.stopPropagation();deleteContest(\''+c.id+'\')">🗑</button>' +
      '</div>';
    }).join('');
  }
}

function buildContestCard(c, today) {
  var cfg = CONTEST_CONFIG[c.type] || CONTEST_CONFIG.weight_loss;
  var pts  = D.contestParticipants.filter(function(p){ return p.contest_id === c.id; });
  var startD = new Date(c.start_date); startD.setHours(0,0,0,0);
  var endD   = new Date(c.end_date);   endD.setHours(0,0,0,0);
  var totalDays  = Math.max(1, Math.round((endD - startD) / 86400000));
  var elapsedDays = Math.max(0, Math.min(totalDays, Math.round((today - startD) / 86400000)));
  var daysLeft = Math.max(0, totalDays - elapsedDays);
  var pct = Math.round((elapsedDays / totalDays) * 100);

  // Top 3 for preview
  var ranked = pts.slice().sort(function(a,b){ return cfg.dir*(parseFloat(b.progress||0)-parseFloat(a.progress||0)); });
  var topHtml = ranked.slice(0,3).map(function(p,i){
    var prog = parseFloat(p.progress||0);
    var medal = i===0?'🥇':i===1?'🥈':'🥉';
    var sign  = cfg.dir===1 ? (prog>0?'+':'') : (prog<0?'':'+');
    var disp  = cfg.dir===-1 ? Math.abs(prog).toFixed(1) : prog.toFixed(1);
    return '<div class="contest-rank-row">' +
      '<div class="contest-rank-num '+(i===0?'contest-rank-1':i===1?'contest-rank-2':'contest-rank-3')+'">'+medal+'</div>' +
      '<div style="flex:1;font-weight:600;font-size:13px">'+p.customer_name+'</div>' +
      '<div style="font-size:12px;font-weight:700;color:'+cfg.color+'">'+(prog?disp+cfg.unit:'—')+'</div>' +
    '</div>';
  }).join('');

  return '<div class="contest-card" onclick="openContestDetail(\''+c.id+'\')">' +
    '<div class="contest-card-banner" style="background:'+cfg.gradient+'">' +
      '<div class="contest-card-type">'+cfg.icon+' '+cfg.label+'</div>' +
      '<div class="contest-card-name">'+c.name+'</div>' +
      (c.prize_amount>0 ? '<div class="contest-card-prize">🏆 ₹'+c.prize_amount+' prize</div>' : '') +
    '</div>' +
    '<div class="contest-card-body">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">' +
        '<span style="font-size:11px;font-weight:700;color:var(--muted)">'+pct+'% complete</span>' +
        '<span style="font-size:11px;font-weight:700;color:'+(daysLeft<=3?'var(--danger)':'var(--primary)')+'">'+daysLeft+' days left</span>' +
      '</div>' +
      '<div class="contest-days-bar"><div class="contest-days-fill" style="width:'+pct+'%;background:'+cfg.color+'"></div></div>' +
      '<div class="contest-meta-row"><span>'+pts.length+' participants</span><span>'+c.start_date+' – '+c.end_date+'</span></div>' +
      (pts.length ? '<div style="margin-top:10px">'+topHtml+'</div>' : '<div style="text-align:center;padding:16px 0;font-size:12px;color:var(--muted)">No participants yet</div>') +
      '<div style="display:flex;gap:6px;margin-top:12px">' +
        '<button class="btn-e" style="flex:1" onclick="event.stopPropagation();openAddParticipantModal(\''+c.id+'\')">+ Participant</button>' +
        '<button class="btn-e" onclick="event.stopPropagation();openContestModal(\''+c.id+'\')">✏️</button>' +
        '<button class="btn-e" onclick="event.stopPropagation();markContestComplete(\''+c.id+'\')">✅</button>' +
        '<button class="btn-d" onclick="event.stopPropagation();deleteContest(\''+c.id+'\')">🗑</button>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function openContestDetail(id) {
  _activeContestId = id;
  var c   = D.contests.find(function(x){ return x.id===id; });
  if (!c) return;
  var cfg = CONTEST_CONFIG[c.type] || CONTEST_CONFIG.weight_loss;
  var pts = D.contestParticipants.filter(function(p){ return p.contest_id===id; });
  var today = new Date(); today.setHours(0,0,0,0);
  var startD = new Date(c.start_date); startD.setHours(0,0,0,0);
  var endD   = new Date(c.end_date);   endD.setHours(0,0,0,0);
  var totalDays   = Math.max(1, Math.round((endD - startD) / 86400000));
  var elapsedDays = Math.max(0, Math.min(totalDays, Math.round((today - startD) / 86400000)));
  var daysLeft = Math.max(0, totalDays - elapsedDays);
  var pct = Math.round((elapsedDays / totalDays) * 100);

  var header = document.getElementById('contest-detail-header');
  header.innerHTML =
    '<div style="font-size:11px;opacity:.7;text-transform:uppercase;letter-spacing:.6px;margin-bottom:4px">'+cfg.icon+' '+cfg.label+'</div>' +
    '<div style="font-size:20px;font-weight:700;margin-bottom:6px">'+c.name+'</div>' +
    '<div style="display:flex;gap:16px;flex-wrap:wrap;font-size:12px;opacity:.8">' +
      '<span>📅 '+c.start_date+' → '+c.end_date+'</span>' +
      (c.prize_amount>0 ? '<span>🏆 ₹'+c.prize_amount+' prize</span>' : '') +
      '<span>⏱ '+daysLeft+' days left ('+pct+'% done)</span>' +
      '<span>👥 '+pts.length+' participants</span>' +
    '</div>' +
    '<div style="height:5px;background:rgba(255,255,255,.2);border-radius:10px;margin-top:10px;overflow:hidden">' +
      '<div style="height:100%;width:'+pct+'%;background:'+cfg.color+';border-radius:10px;transition:width .6s"></div>' +
    '</div>';

  // Leaderboard
  var ranked = pts.slice().sort(function(a,b){ return cfg.dir*(parseFloat(b.progress||0)-parseFloat(a.progress||0)); });
  var lb = document.getElementById('contest-leaderboard');
  if (!ranked.length) {
    lb.innerHTML = '<div class="empty"><div class="ei">👥</div><p>No participants yet. Add someone to start!</p></div>';
  } else {
    lb.innerHTML = '<div class="tcard" style="padding:0;overflow:hidden">' +
      '<table><thead><tr>' +
        '<th style="width:40px">Rank</th><th>Participant</th>' +
        '<th>Start '+cfg.label.split(' ')[1]+'</th>' +
        '<th>Current</th><th>Change</th><th>Actions</th>' +
      '</tr></thead><tbody>' +
      ranked.map(function(p, i) {
        var medal  = i===0?'🥇':i===1?'🥈':i===2?'🥉':'#'+(i+1);
        var startV = parseFloat(p[cfg.startField]||0);
        var curV   = parseFloat(p[cfg.field]||0);
        var change = curV ? (curV - startV) : null;
        var changeDisp = change!==null ? (change>0?'+':'')+change.toFixed(1)+cfg.unit : '—';
        var changeColor= change===null ? 'var(--muted)' : (cfg.dir===1?(change>0?'var(--success)':'var(--danger)'):(change<0?'var(--success)':'var(--danger)'));
        var hasProgress = change !== null && ((cfg.dir === -1 && change < 0) || (cfg.dir === 1 && change > 0));
        var certBtn = hasProgress ? '<button class="btn-p" style="font-size:11px;padding:3.5px 7px;background:#6366f1;border-color:#6366f1;color:#fff" onclick="generateContestCertificate(\''+p.id+'\')">🎓 Cert</button>' : '';
        return '<tr>' +
          '<td style="font-size:16px;text-align:center">'+medal+'</td>' +
          '<td><div style="font-weight:600">'+p.customer_name+'</div></td>' +
          '<td>'+(startV||'—')+(startV?cfg.unit:'')+'</td>' +
          '<td>'+(curV||'—')+(curV?cfg.unit:'')+'</td>' +
          '<td style="font-weight:700;color:'+changeColor+'">'+changeDisp+'</td>' +
          '<td><div style="display:flex;gap:4px">' +
            certBtn +
            '<button class="btn-e" onclick="openUpdateProgressModal(\''+p.id+'\')">📊 Update</button>' +
            '<button class="btn-d" onclick="removeContestParticipant(\''+p.id+'\')">🗑</button>' +
          '</div></td>' +
        '</tr>';
      }).join('') +
      '</tbody></table></div>';
  }

  // Reset to leaderboard tab
  switchContestTab('leaderboard');
  document.getElementById('contest-detail-panel').style.display = 'block';
  document.getElementById('contest-detail-panel').scrollIntoView({ behavior:'smooth', block:'start' });
}

function closeContestDetail() {
  _activeContestId = null;
  document.getElementById('contest-detail-panel').style.display = 'none';
}

function openAddParticipantModal(contestId) {
  var id = contestId || _activeContestId;
  if (!id) return;
  document.getElementById('cp-contest-id').value   = id;
  document.getElementById('cp-participant-id').value = '';
  document.getElementById('cp-start-weight').value  = '';
  document.getElementById('cp-start-fat').value     = '';
  document.getElementById('cp-start-muscle').value  = '';
  document.getElementById('cp-start-bmi').value     = '';
  // Populate customer dropdown (exclude already enrolled)
  var enrolled = D.contestParticipants.filter(function(p){ return p.contest_id===id; }).map(function(p){ return p.customer_id; });
  var sel = document.getElementById('cp-customer');
  sel.innerHTML = '<option value="">— Select customer —</option>' +
    D.customers.filter(function(c){ return enrolled.indexOf(c.id)===-1; })
      .map(function(c){ return '<option value="'+c.id+'">'+c.name+'</option>'; }).join('');
  openModal('contest-participant');
}

async function saveContestParticipant() {
  var contestId  = document.getElementById('cp-contest-id').value;
  var custId     = document.getElementById('cp-customer').value;
  var startW     = document.getElementById('cp-start-weight').value;
  var startF     = document.getElementById('cp-start-fat').value;
  var startM     = document.getElementById('cp-start-muscle').value;
  var startBmi   = document.getElementById('cp-start-bmi').value;
  if (!custId) { showToast('Select a customer', 'error'); return; }
  var cust = D.customers.find(function(c){ return c.id===custId; });
  var payload = {
    contest_id: contestId,
    customer_id: custId,
    customer_name: cust ? cust.name : custId,
    start_weight: startW||null,
    start_fat: startF||null,
    start_muscle: startM||null,
    start_bmi: startBmi||null,
    current_weight: startW||null,
    current_fat: startF||null,
    current_muscle: startM||null,
    progress: 0
  };
  try {
    var row = await dbInsert('contest_participants', payload);
    if (row && row[0]) D.contestParticipants.push(row[0]);
    closeModal('contest-participant');
    renderContests();
    if (_activeContestId === contestId) openContestDetail(contestId);
    showToast('Participant added!', 'success');
  } catch(e) { showToast('Error: '+e.message, 'error'); }
}

function openUpdateProgressModal(participantId) {
  var p = D.contestParticipants.find(function(x){ return x.id===participantId; });
  if (!p) return;
  var c   = D.contests.find(function(x){ return x.id===p.contest_id; });
  var cfg = c ? CONTEST_CONFIG[c.type] : CONTEST_CONFIG.weight_loss;
  document.getElementById('cpp-participant-id').value = participantId;
  document.getElementById('cp-progress-title').textContent = '📊 '+p.customer_name+' — Update';
  document.getElementById('cpp-weight').value  = p.current_weight  || '';
  document.getElementById('cpp-fat').value     = p.current_fat     || '';
  document.getElementById('cpp-muscle').value  = p.current_muscle  || '';
  document.getElementById('cpp-bmi').value     = p.current_bmi     || '';
  document.getElementById('cpp-start-summary').innerHTML =
    '<strong>Starting:</strong> ' +
    (p.start_weight  ? 'Weight '+p.start_weight+'kg' : '') +
    (p.start_fat     ? '  ·  Fat '+p.start_fat+'%' : '') +
    (p.start_muscle  ? '  ·  Muscle '+p.start_muscle+'%' : '') +
    '  <span style="color:var(--primary);font-weight:700">Goal: '+cfg.label+'</span>';
  openModal('contest-progress');
}

async function saveContestProgress() {
  var pid    = document.getElementById('cpp-participant-id').value;
  var weight = document.getElementById('cpp-weight').value;
  var fat    = document.getElementById('cpp-fat').value;
  var muscle = document.getElementById('cpp-muscle').value;
  var bmi    = document.getElementById('cpp-bmi').value;
  var p = D.contestParticipants.find(function(x){ return x.id===pid; });
  if (!p) return;
  var c   = D.contests.find(function(x){ return x.id===p.contest_id; });
  var cfg = c ? CONTEST_CONFIG[c.type] : CONTEST_CONFIG.weight_loss;
  // Calculate progress based on contest type
  var curVal   = parseFloat({ weight_loss:'weight', weight_gain:'weight', fat_loss:'fat', muscle_gain:'muscle' }[c.type]==='weight'?weight:c.type==='fat_loss'?fat:muscle) || 0;
  var startKey = { weight_loss:'start_weight', weight_gain:'start_weight', fat_loss:'start_fat', muscle_gain:'start_muscle' }[c.type];
  var startVal = parseFloat(p[startKey]) || 0;
  var progress = startVal && curVal ? parseFloat((curVal - startVal).toFixed(2)) : 0;
  var payload = { current_weight:weight||null, current_fat:fat||null, current_muscle:muscle||null, current_bmi:bmi||null, progress:progress };
  try {
    await dbUpdate('contest_participants', pid, payload);
    Object.assign(p, payload);
    closeModal('contest-progress');
    renderContests();
    if (_activeContestId) openContestDetail(_activeContestId);
    showToast('Progress updated!', 'success');
  } catch(e) { showToast('Error: '+e.message, 'error'); }
}

async function removeContestParticipant(pid) {
  if (!confirm('Remove this participant?')) return;
  try {
    await dbDelete('contest_participants', pid);
    D.contestParticipants = D.contestParticipants.filter(function(p){ return p.id!==pid; });
    renderContests();
    if (_activeContestId) openContestDetail(_activeContestId);
    showToast('Removed', 'info');
  } catch(e) { showToast('Error: '+e.message, 'error'); }
}

// ==========================================
// LEAD ENGINEER ADDITIONS
// ==========================================

// --- Chime Sound & Real-time Check-in Polling ---
function playChimeSound() {
  try {
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    var now = ctx.currentTime;
    osc.type = 'sine';
    
    // Note 1: E5
    osc.frequency.setValueAtTime(659.25, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
    
    // Note 2: A5
    osc.frequency.setValueAtTime(880.00, now + 0.15);
    gain.gain.setValueAtTime(0.15, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    
    osc.start(now);
    osc.stop(now + 0.6);
  } catch(e) {
    console.error("Failed to play chime:", e);
  }
}

async function pollQrCheckins() {
  if (!getActiveSbUrl() || !getActiveSbKey()) return;
  var todayStr = new Date().toISOString().split('T')[0];
  try {
    // Only query today's attendance records to keep payload tiny
    var todayAtt = await dbGet('attendance', 'date', '&date=eq.' + todayStr);
    var todayCoachAtt = await dbGet('coach_attendance', 'date', '&date=eq.' + todayStr);
    
    var hasNew = false;
    
    if (Array.isArray(todayAtt)) {
      todayAtt.forEach(function(att) {
        var exists = D.attendance.some(function(a) { return a.id === att.id; });
        if (!exists) {
          D.attendance.push(att);
          hasNew = true;
          showToast('🌿 ' + att.customer_name + ' checked in via QR kiosk!', 'success');
          playChimeSound();
        }
      });
    }
    
    if (Array.isArray(todayCoachAtt)) {
      todayCoachAtt.forEach(function(att) {
        if (typeof D.coachAttendance === 'undefined') D.coachAttendance = [];
        var exists = D.coachAttendance.some(function(a) { return a.id === att.id; });
        if (!exists) {
          D.coachAttendance.push(att);
          var coach = D.coaches.find(function(c) { return c.id === att.coach_id; });
          var coachName = coach ? coach.name : 'Coach';
          showToast('👨‍🏫 Coach ' + coachName + ' checked in via QR kiosk!', 'success');
          playChimeSound();
          hasNew = true;
        }
      });
    }
    
    if (hasNew) {
      _daysLeftCache = {};
      renderOverview();
      renderAttendance();
    }
  } catch(e) {
    console.error("Polling error:", e);
  }
}

// --- QR Check-in Kiosk ---
function openQrKioskModal() {
  var centerId = ACTIVE_CENTER;
  if(!centerId && D.centers.length === 1) centerId = D.centers[0].id;
  if(!centerId) {
    showToast('Please select a wellness center first.', 'error');
    return;
  }
  var centerName = getCenterName();
  var qrUrl = window.location.origin + '/client.html?center=' + encodeURIComponent(centerId) + '&action=checkin';
  
  document.getElementById('qr-kiosk-center-name').textContent = centerName;
  document.getElementById('qr-kiosk-url').textContent = qrUrl;
  document.getElementById('qr-kiosk-img').src = 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=' + encodeURIComponent(qrUrl);
  
  openModal('qr-kiosk');
}

function copyQrKioskUrl() {
  var urlText = document.getElementById('qr-kiosk-url').textContent;
  navigator.clipboard.writeText(urlText).then(function() {
    showToast('Kiosk URL copied to clipboard!', 'success');
  }).catch(function() {
    showToast('Failed to copy URL.', 'error');
  });
}

// --- Absence Recovery Nudges ---
function renderAbsenceNudges() {
  var activeCenter = ACTIVE_CENTER;
  var customers = (D.customers||[]).filter(function(c) {
    if(c.status !== 'active') return false;
    if(activeCenter && c.wellness_center_id !== activeCenter) return false;
    return true;
  });
  
  var now = new Date();
  now.setHours(0,0,0,0);
  
  var nudgeData = [];
  
  customers.forEach(function(c) {
    var att = (D.attendance||[]).filter(function(a) { return a.customer_id === c.id; })
                          .sort(function(a,b) { return new Date(b.date) - new Date(a.date); });
    var lastPresent = att[0] ? new Date(att[0].date) : null;
    var daysAbsent = lastPresent ? Math.floor((now - lastPresent) / 86400000) : 999;
    
    if(daysAbsent >= 3) {
      nudgeData.push({
        customer: c,
        lastPresentDate: lastPresent ? att[0].date : 'Never',
        daysAbsent: daysAbsent
      });
    }
  });
  
  nudgeData.sort(function(a,b) { return b.daysAbsent - a.daysAbsent; });
  
  var html = '';
  if(nudgeData.length === 0) {
    html = '<div style="color:var(--muted);font-size:13px;padding:30px;text-align:center;">Everyone is attending regularly! 🎉</div>';
  } else {
    html = '<div class="twrap"><table>' +
      '<thead><tr><th>Name</th><th>Phone</th><th>Last Visit</th><th>Days Absent</th><th>Action</th></tr></thead>' +
      '<tbody>' +
      nudgeData.map(function(item) {
        var c = item.customer;
        var text = 'Hi ' + c.name + '! We missed you at the center. Hope everything is fine. Your consistency is key to your health goals. Hope to see you tomorrow! 💪';
        var waUrl = c.phone ? 'https://wa.me/' + (c.phone.startsWith(COUNTRY_CODE) ? '' : COUNTRY_CODE) + c.phone.replace(/[^0-9]/g, '') + '?text=' + encodeURIComponent(text) : '#';
        return '<tr>' +
          '<td><strong>' + c.name + '</strong></td>' +
          '<td>' + (c.phone || '—') + '</td>' +
          '<td>' + item.lastPresentDate + '</td>' +
          '<td><span class="badge" style="background:' + (item.daysAbsent >= 7 ? 'var(--danger)' : 'var(--accent)') + ';color:#fff;border-radius:20px;padding:2px 8px;font-size:11px">' + (item.daysAbsent === 999 ? 'Never visited' : item.daysAbsent + ' days') + '</span></td>' +
          '<td>' + (c.phone ? '<a href="' + waUrl + '" target="_blank" class="btn-p" style="background:#25D366;color:#fff;border-color:#25D366;text-decoration:none;font-size:11px;padding:4px 8px;display:inline-block;border-radius:6px;font-weight:700" onclick="document.getElementById(\'att-nudges-view\').style.display=\'block\'">💬 Nudge</a>' : '<button class="btn-c" disabled style="font-size:11px;padding:4px 8px">No Phone</button>') + '</td>' +
          '</tr>';
      }).join('') +
      '</tbody></table></div>';
  }
  document.getElementById('att-nudges-list').innerHTML = html;
}

// --- Branded Progress Card (Social Share) ---
var _selectedCardCust = null;
var _selectedCardBase = null;
var _selectedCardComp = null;

function openShareCardModal() {
  if(!_selectedBodyCustId) return;
  var cust = D.customers.find(function(x){ return x.id === _selectedBodyCustId; })
    || D.coaches.find(function(x){ return x.id === _selectedBodyCustId; });
  if(!cust) return;
  
  _selectedCardCust = cust;
  
  var sorted = D.body
    .filter(function(b){ return b.customer_id === _selectedBodyCustId; })
    .sort(function(a,b){ return new Date(a.date) - new Date(b.date); });
    
  if(sorted.length < 2) {
    showToast('At least 2 body scans are required to generate a progress card.', 'error');
    return;
  }
  
  var fromSel = document.getElementById('share-scan-from');
  var toSel = document.getElementById('share-scan-to');
  
  fromSel.innerHTML = sorted.map(function(b, idx) {
    return '<option value="' + b.id + '"' + (idx === 0 ? ' selected' : '') + '>' + b.date + ' (' + b.weight + ' kg)</option>';
  }).join('');
  
  toSel.innerHTML = sorted.map(function(b, idx) {
    return '<option value="' + b.id + '"' + (idx === sorted.length - 1 ? ' selected' : '') + '>' + b.date + ' (' + b.weight + ' kg)</option>';
  }).join('');
  
  document.getElementById('share-card-title').value = cust.name + "'s Progress";
  
  openModal('share-card');
  drawProgressCard();
}

function drawProgressCard() {
  var canvas = document.getElementById('progress-card-canvas');
  if(!canvas) return;
  var ctx = canvas.getContext('2d');
  
  var sorted = D.body.filter(function(b){ return b.customer_id === _selectedBodyCustId; });
  var baseId = document.getElementById('share-scan-from').value;
  var toId = document.getElementById('share-scan-to').value;
  
  var base = sorted.find(function(b){ return b.id === baseId; }) || sorted[0];
  var comp = sorted.find(function(b){ return b.id === toId; }) || sorted[sorted.length-1];
  
  var title = document.getElementById('share-card-title').value || "Health Journey";
  var theme = document.getElementById('share-card-theme').value;
  
  var grad = ctx.createLinearGradient(0, 0, 1080, 1080);
  if(theme === 'midnight') {
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(1, '#1e293b');
  } else if(theme === 'sunset') {
    grad.addColorStop(0, '#2d1c08');
    grad.addColorStop(1, '#452a0a');
  } else { 
    grad.addColorStop(0, '#0d1f14');
    grad.addColorStop(1, '#1a3a28');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1080, 1080);
  
  ctx.strokeStyle = theme === 'sunset' ? '#f59e0b' : '#4ade80';
  ctx.lineWidth = 14;
  ctx.strokeRect(30, 30, 1020, 1020);
  
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PULSEZEN WELLNESS CENTER', 540, 100);
  
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 56px Georgia, serif';
  ctx.fillText(title, 540, 180);
  
  function drawStatCol(x, title, scan) {
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x - 200, 260, 400, 420, 20);
    ctx.fill();
    ctx.stroke();
    
    ctx.fillStyle = theme === 'sunset' ? '#f59e0b' : '#4ade80';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(title.toUpperCase(), x, 315);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '20px sans-serif';
    ctx.fillText(scan ? scan.date : '—', x, 350);
    
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.moveTo(x - 160, 375);
    ctx.lineTo(x + 160, 375);
    ctx.stroke();
    
    var items = [
      { lbl: 'WEIGHT', val: scan ? scan.weight + ' kg' : '—' },
      { lbl: 'BODY FAT', val: scan && scan.fat_percentage ? scan.fat_percentage + '%' : '—' },
      { lbl: 'MUSCLE', val: scan && scan.muscle_percentage ? scan.muscle_percentage + '%' : '—' }
    ];
    
    items.forEach(function(item, idx) {
      var y = 430 + (idx * 80);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(item.lbl, x, y);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px sans-serif';
      ctx.fillText(item.val, x, y + 40);
    });
  }
  
  drawStatCol(300, 'Initial Scan', base);
  drawStatCol(780, 'Latest Scan', comp);
  
  ctx.fillStyle = theme === 'sunset' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(74, 222, 128, 0.15)';
  ctx.beginPath();
  ctx.arc(540, 470, 70, 0, 2*Math.PI);
  ctx.fill();
  ctx.fillStyle = theme === 'sunset' ? '#f59e0b' : '#4ade80';
  ctx.font = 'bold 48px sans-serif';
  ctx.fillText('➔', 540, 480);
  
  var wDiff = comp && base ? Number(comp.weight) - Number(base.weight) : 0;
  var fDiff = comp && base && comp.fat_percentage && base.fat_percentage ? Number(comp.fat_percentage) - Number(base.fat_percentage) : 0;
  
  var resultText = "";
  var badgeColor = '#4ade80';
  if(wDiff < 0) {
    resultText = "LOST " + Math.abs(wDiff).toFixed(1) + " KG!";
    badgeColor = '#4ade80';
  } else if(wDiff > 0) {
    resultText = "GAINED " + wDiff.toFixed(1) + " KG!";
    badgeColor = '#fbbf24';
  } else {
    resultText = "MAINTAINED WEIGHT!";
    badgeColor = '#38bdf8';
  }
  
  ctx.fillStyle = badgeColor;
  ctx.beginPath();
  ctx.roundRect(140, 740, 800, 160, 24);
  ctx.fill();
  
  ctx.fillStyle = '#0d1f14';
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText(resultText, 540, 840);
  
  if(fDiff < 0) {
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText("AND REDUCED BODY FAT BY " + Math.abs(fDiff).toFixed(1) + "%!", 540, 875);
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText(resultText, 540, 825);
  }
  
  var centerName = getCenterName();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('Coached at ' + centerName.toUpperCase(), 540, 960);
  ctx.fillStyle = theme === 'sunset' ? '#f59e0b' : '#4ade80';
  ctx.fillText('www.pulsezen.in', 540, 995);
}

function downloadProgressCard() {
  var canvas = document.getElementById('progress-card-canvas');
  var link = document.createElement('a');
  link.download = _selectedCardCust.name + '-progress-card.png';
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function copyProgressCardToClipboard() {
  var canvas = document.getElementById('progress-card-canvas');
  canvas.toBlob(function(blob) {
    var item = new ClipboardItem({ 'image/png': blob });
    navigator.clipboard.write([item]).then(function() {
      showToast('Progress card copied to clipboard!', 'success');
    }).catch(function() {
      showToast('Clipboard copy failed. Try downloading instead.', 'error');
    });
  });
}

// --- Milestone Certificate Generator ---
var _selectedCertificateData = null;

function generateContestCertificate(participantId) {
  var p = (D.contestParticipants||[]).find(function(x){ return x.id === participantId; });
  if(!p) {
    showToast('Participant not found', 'error');
    return;
  }
  var c = (D.contests||[]).find(function(x){ return x.id === p.contest_id; });
  if(!c) {
    showToast('Contest not found', 'error');
    return;
  }
  var cfg = CONTEST_CONFIG[c.type] || CONTEST_CONFIG.weight_loss;
  var startV = parseFloat(p[cfg.startField]||0);
  var curV   = parseFloat(p[cfg.field]||0);
  var change = curV ? (curV - startV) : null;
  if(change === null) {
    showToast('No progress recorded for certificate.', 'error');
    return;
  }
  
  var changeDisp = (change>0?'+':'') + change.toFixed(1) + cfg.unit;
  var centerName = getCenterName();
  
  openModal('certificate');
  
  var canvas = document.getElementById('certificate-canvas');
  var ctx = canvas.getContext('2d');
  
  ctx.clearRect(0,0,canvas.width,canvas.height);
  
  var grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  grad.addColorStop(0, '#112217'); 
  grad.addColorStop(1, '#08130e'); 
  ctx.fillStyle = grad;
  ctx.fillRect(0,0,canvas.width,canvas.height);
  
  ctx.strokeStyle = '#d4af37'; 
  ctx.lineWidth = 20;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);
  
  ctx.strokeStyle = '#f3e5ab'; 
  ctx.lineWidth = 2;
  ctx.strokeRect(35, 35, canvas.width - 70, canvas.height - 70);
  
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(35, 35, 50, 6);
  ctx.fillRect(35, 35, 6, 50);
  ctx.fillRect(canvas.width - 85, 35, 50, 6);
  ctx.fillRect(canvas.width - 41, 35, 6, 50);
  ctx.fillRect(35, canvas.height - 41, 50, 6);
  ctx.fillRect(35, canvas.height - 85, 6, 50);
  ctx.fillRect(canvas.width - 85, canvas.height - 41, 50, 6);
  ctx.fillRect(canvas.width - 41, canvas.height - 85, 6, 50);
  
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  ctx.font = 'bold 36px Georgia, serif';
  ctx.fillStyle = '#d4af37';
  ctx.fillText('CERTIFICATE OF ACHIEVEMENT', canvas.width/2, 160);
  
  ctx.font = 'italic 20px sans-serif';
  ctx.fillStyle = '#f3e5ab';
  ctx.fillText('This certificate is proudly presented to', canvas.width/2, 230);
  
  ctx.font = 'bold 44px Georgia, serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(p.customer_name.toUpperCase(), canvas.width/2, 300);
  
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(canvas.width/2 - 150, 360);
  ctx.lineTo(canvas.width/2 + 150, 360);
  ctx.stroke();
  
  ctx.font = '22px sans-serif';
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText('for outstanding performance and dedication in the', canvas.width/2, 420);
  
  ctx.font = 'bold 30px Georgia, serif';
  ctx.fillStyle = '#fbbf24'; 
  ctx.fillText(c.name, canvas.width/2, 480);
  
  ctx.font = 'bold 26px sans-serif';
  ctx.fillStyle = '#4ade80'; 
  var verb = cfg.dir === -1 ? 'reducing' : 'gaining';
  ctx.fillText('by successfully ' + verb + ' ' + changeDisp.replace('+', '') + '!', canvas.width/2, 545);
  
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(80, 620);
  ctx.lineTo(canvas.width - 80, 620);
  ctx.stroke();
  
  ctx.textAlign = 'left';
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#94a3b8';
  var dateStr = new Date().toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'});
  ctx.fillText('Date: ' + dateStr, 100, 660);
  
  ctx.textAlign = 'right';
  ctx.font = 'bold 18px Georgia, serif';
  ctx.fillStyle = '#f3e5ab';
  ctx.fillText(centerName, canvas.width - 100, 660);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Certified Wellness Center', canvas.width - 100, 690);
  
  ctx.textAlign = 'center';
  ctx.fillStyle = '#d4af37';
  ctx.beginPath();
  ctx.arc(canvas.width/2, 630, 45, 0, 2*Math.PI);
  ctx.fill();
  ctx.fillStyle = '#112217';
  ctx.beginPath();
  ctx.arc(canvas.width/2, 630, 40, 0, 2*Math.PI);
  ctx.fill();
  ctx.fillStyle = '#d4af37';
  ctx.font = 'bold 24px serif';
  ctx.fillText('⭐', canvas.width/2, 625);
  
  _selectedCertificateData = p.customer_name;
}

function downloadCertificate() {
  var canvas = document.getElementById('certificate-canvas');
  var link = document.createElement('a');
  link.download = (_selectedCertificateData || 'participant') + '-certificate.png';
  link.href = canvas.toDataURL("image/png");
  link.click();
}

// --- AI Grocery List & Meal Prep Assistant ---
var _groceryInFlight = false;
var _currentGroceryText = ""; 
var _currentGroceryCustName = "";
var _currentGroceryPhone = "";

async function generateGroceryList(custId) {
  var c = D.customers.find(function(x){ return x.id === custId; });
  if(!c || !c.diet_plan) {
    showToast('Generate a diet plan first.', 'error');
    return;
  }
  
  if(_groceryInFlight) return;
  _groceryInFlight = true;
  
  document.getElementById('grocery-list-cust-info').textContent = 'Generating for ' + c.name + '...';
  document.getElementById('grocery-list-content').innerHTML = '<div style="color:var(--muted);text-align:center;padding:24px;">AI is compiling your weekly grocery list & cooking prep instructions... 🥕</div>';
  openModal('grocery-list');
  
  _currentGroceryCustName = c.name;
  _currentGroceryPhone = c.phone || c.contact || '';
  
  var userPrompt = "Create a weekly grocery list (with estimated quantities) and 3 meal prep tips for this 7-day Indian meal plan:\n\n" + c.diet_plan + "\n\nFormat your response as clean HTML. Use checkboxes for grocery items like: <label style='display:block;margin-bottom:6px;'><input type='checkbox'> Item name (qty)</label> and group them under beautiful headings. Avoid outer HTML tags like <html> or <body>, start directly with headers. Add 3 prep tips in an ordered list.";
  
  try {
    var text = await callGroq("You are a helpful wellness coach and meal prep assistant.", userPrompt, { temperature: 0.3, maxTokens: 800 });
    _currentGroceryText = text.replace(/<[^>]*>/g, ''); 
    document.getElementById('grocery-list-cust-info').textContent = 'Weekly Grocery List & Prep Guide for ' + c.name;
    document.getElementById('grocery-list-content').innerHTML = text;
  } catch(e) {
    document.getElementById('grocery-list-content').innerHTML = '<div style="color:var(--danger);text-align:center;padding:24px;">Error: ' + e.message + '</div>';
    showToast('Failed to generate grocery list.', 'error');
  } finally {
    _groceryInFlight = false;
  }
}

function shareGroceryListWA() {
  if(!_currentGroceryText) return;
  var text = "Hi " + _currentGroceryCustName + "! Here is your AI Grocery List & Meal Prep Guide for this week:\n\n" + _currentGroceryText.trim().substring(0, 1500) + "\n\nLet's stay consistent! 💪";
  var url = 'https://wa.me/' + (window.COUNTRY_CODE || '91') + _currentGroceryPhone.replace(/[^0-9]/g, '') + '?text=' + encodeURIComponent(text);
  window.open(url, '_blank');
}
