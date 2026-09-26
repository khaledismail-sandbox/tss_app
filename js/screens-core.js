/* screens-core.js — The Secret Society demo · core screens: welcome, signup, login, venueLogin, debug, notFound.
   Contract: ARCHITECTURE.md §9 (Core). Plain ES2019 browser JS, no modules. Registers into TSS.screens (router.js).
   The debug screen is tracked:false and renders wide; it never calls TSS.analytics.pageView. */
window.TSS = window.TSS || {};
(function () {
  'use strict';
  var TSS = window.TSS;
  var screens = TSS.screens = TSS.screens || {};
  var ui = TSS.ui;
  var esc = function (s) { return ui.escape(s); };
  var SEP = ui.SEP;

  /* ---------- shared helpers (defensive: the data modules may be missing while agents work in parallel) ---------- */
  function cfg() { return TSS.config || {}; }
  function session() { try { return TSS.state.getSession(); } catch (e) { return {}; } }
  function personas() { return cfg().PERSONAS || { sara: { name: 'Sara' }, omar: { name: 'Omar' } }; }
  function personaName(key) {
    var p = personas()[key];
    if (p && p.name) return p.name;
    return String(key || '').charAt(0).toUpperCase() + String(key || '').slice(1);
  }
  var PERSONA_ART = { sara: 'beauty', omar: 'dining' };
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function localSuffix() { var d = new Date(); return pad2(d.getMonth() + 1) + pad2(d.getDate()) + '-' + pad2(d.getHours()) + pad2(d.getMinutes()); }
  function previewId(persona) {
    try { return TSS.state.bloggerId(persona, TSS.state.newSuffix()); }
    catch (e) { return 'demo-blogger-' + String(persona || 'sara').toLowerCase() + '-' + localSuffix(); }
  }
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  function navigate(path, opts) { TSS.router.navigate(path, opts); }
  function fmtTime(ts) {
    var d = ts ? new Date(ts) : new Date();
    if (isNaN(d)) return String(ts);
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  }
  function json(v, pretty) {
    try { return esc(pretty ? JSON.stringify(v, null, 2) : JSON.stringify(v)); } catch (e) { return esc(String(v)); }
  }

  var VENUE_FALLBACK = [
    { venue_id: 'VEN-DEMO-SLOT', venue_name: 'Solace Beach Club', venue_category: 'Beach & Pool', approval_style: 'slot_calendar', city: 'Dubai', manager_id: 'demo-manager-solace', manager_name: 'Layla', art: 'beach' },
    { venue_id: 'VEN-DEMO-INBOX', venue_name: 'Obsidian Lounge', venue_category: 'Nightlife', approval_style: 'inbox', city: 'Dubai', manager_id: 'demo-manager-obsidian', manager_name: 'Omar', art: 'nightlife' }
  ];
  function demoVenues() {
    try {
      var V = TSS.data.VENUES;
      var list = ['VEN-DEMO-SLOT', 'VEN-DEMO-INBOX'].map(function (id) { return V[id]; }).filter(Boolean);
      if (list.length === 2) return list;
    } catch (e) { /* fall through */ }
    return VENUE_FALLBACK;
  }
  function managerEmail(v) {
    if (v.manager_email) return v.manager_email;
    return String(v.manager_name || 'manager').toLowerCase() + '@' + String(v.venue_name || 'venue').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.tss';
  }
  function approvalLabel(style) { return style === 'slot_calendar' ? 'Slot Planner' : 'Inbox'; }

  // Radio-card group: toggles .is-selected / aria-checked on [data-<attr>] buttons inside root; calls onChange(value).
  function radioGroup(root, attr, onChange) {
    var items = Array.prototype.slice.call(root.querySelectorAll('[data-' + attr + ']'));
    items.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var v = btn.getAttribute('data-' + attr);
        items.forEach(function (b) {
          var on = b === btn;
          b.classList.toggle('is-selected', on);
          b.classList.toggle('is-active', on && b.classList.contains('seg-item'));
          b.setAttribute('aria-checked', on ? 'true' : 'false');
        });
        if (onChange) onChange(v);
      });
    });
  }

  function personaPicker(selected) {
    var P = personas();
    var prof = cfg().BLOGGER_PROFILE || {};
    var sub = esc(cap(prof.primary_niche || 'lifestyle')) + SEP + esc(prof.follower_band || '10k-25k');
    return '<div class="persona-grid" role="radiogroup" aria-label="Persona">' + Object.keys(P).map(function (k) {
      var on = k === selected;
      return '<button class="persona-card' + (on ? ' is-selected' : '') + '" type="button" role="radio" aria-checked="' + (on ? 'true' : 'false') + '" data-persona="' + esc(k) + '">' +
        ui.artThumb(PERSONA_ART[k] || 'nightlife', { size: 'lg', portrait: true }) +
        '<span class="persona-name">' + esc(P[k].name || cap(k)) + '</span>' +
        '<span class="persona-sub">' + sub + '</span>' +
        '<span class="persona-check">' + ui.icon('check', 14, 'badge') + '</span>' +
        '</button>';
    }).join('') + '</div>';
  }
  function demoIdCard(persona, note) {
    return '<div class="demo-id auth-block">' +
      '<span class="t-label c-muted">Your demo ID</span>' +
      '<span class="demo-id-value" id="demo-id">' + esc(previewId(persona)) + '</span>' +
      '<span class="t-meta-sm">' + note + '</span>' +
      '</div>';
  }
  function authShell(o) {
    return '<div class="auth">' + ui.header({ left: 'back', title: esc(o.title) }) +
      '<div class="auth-body">' +
      '<h1 class="auth-heading">' + o.heading + '</h1>' +
      (o.sub ? '<p class="auth-sub">' + o.sub + '</p>' : '') +
      o.body +
      '</div></div>';
  }
  // Keeps the demo-ID preview live (every minute the suffix changes) and switches it on persona change.
  function liveDemoId(root, getPersona) {
    var el = root.querySelector('#demo-id');
    function update() {
      if (!el) return;
      var v = previewId(getPersona());
      if (el.textContent !== v) el.textContent = v;
    }
    var timer = setInterval(update, 1000);
    return { update: update, stop: function () { clearInterval(timer); } };
  }
  function submitBlogger(btn, opts) {
    btn.disabled = true;
    try { TSS.analytics.identifyBlogger(opts); }
    catch (e) {
      if (window.console) console.error('[TSS] identifyBlogger failed', e);
      ui.toast('Could not sign in — see console');
      btn.disabled = false;
      return;
    }
    navigate('/events', { replace: true });
  }

  /* ---------- welcome — / ---------- */
  screens.welcome = {
    role: 'any', tab: null, tabbar: null, tracked: true,
    title: function () { return 'Welcome'; },
    render: function () {
      var s = session();
      var cont = '';
      if (s && s.role) {
        var name = s.display_name || (s.persona ? personaName(s.persona) : null);
        if (!name && s.role === 'venue_manager') {
          var v = demoVenues().filter(function (x) { return x.venue_id === s.venue_id; })[0];
          name = v ? v.manager_name : 'manager';
        }
        var to = s.role === 'venue_manager' ? '/venue/dashboard' : '/events';
        cont = ui.button('Continue as ' + (name || 'member'), { cls: 'btn-ghost btn-lg btn-block', nav: to, id: 'welcome-continue' });
      }
      return '<div class="welcome">' +
        '<div class="welcome-hero"><div class="art art-nightlife"></div><div class="hero-scrim"></div>' +
        '<div class="welcome-brand"><span class="wordmark">The Secret Society</span><span class="welcome-kicker t-label">Dubai' + SEP + 'Members only</span></div></div>' +
        '<div class="welcome-body section">' +
        '<h1 class="welcome-title">Do what you <span class="accent-text">can\'t</span></h1>' +
        '<p class="welcome-sub">Complimentary experiences at Dubai\'s finest venues, in exchange for the content only you can make.</p>' +
        '<div class="welcome-actions">' + cont +
        ui.button("I'm a creator", { cls: 'btn-primary btn-lg btn-block', nav: '/signup', id: 'welcome-creator' }) +
        ui.button("I'm a venue", { cls: 'btn-secondary btn-lg btn-block', nav: '/venue/login', id: 'welcome-venue' }) +
        '</div>' +
        '<p class="auth-foot">Already a member? <button class="link-gradient" type="button" data-nav="/login">Log in</button></p>' +
        '</div></div>';
    },
    mount: function () { return null; }
  };

  /* ---------- signup — /signup (Join) ---------- */
  screens.signup = {
    role: 'any', tab: null, tabbar: null, tracked: true,
    title: function () { return 'Join'; },
    render: function () {
      var methods = [['email', 'Email'], ['apple', 'Apple'], ['google', 'Google']];
      return authShell({
        title: 'Join',
        heading: 'Who\'s joining?',
        sub: 'Pick a creator profile. Every join creates a brand-new member.',
        body: '<div class="auth-block">' + personaPicker('sara') + '</div>' +
          '<div class="auth-block"><span class="field-label">Sign up with</span>' +
          '<div class="seg is-3up" role="radiogroup" aria-label="Sign-up method">' + methods.map(function (m, i) {
            return '<button class="seg-item' + (i === 0 ? ' is-active is-selected' : '') + '" type="button" role="radio" aria-checked="' + (i === 0 ? 'true' : 'false') + '" data-method="' + m[0] + '">' + m[1] + '</button>';
          }).join('') + '</div></div>' +
          demoIdCard('sara', 'A new member ID every minute — each rehearsal is a fresh user.') +
          '<div class="auth-cta">' + ui.button('Join The Secret Society', { cls: 'btn-primary btn-lg btn-block', id: 'join-btn' }) + '</div>' +
          '<p class="auth-foot">Already a member? <button class="link-gradient" type="button" data-nav="/login">Log in</button></p>'
      });
    },
    mount: function (params, root) {
      var persona = 'sara', method = 'email';
      var live = liveDemoId(root, function () { return persona; });
      radioGroup(root, 'persona', function (v) { persona = v; live.update(); });
      radioGroup(root, 'method', function (v) { method = v; });
      var btn = root.querySelector('#join-btn');
      if (btn) btn.addEventListener('click', function () { submitBlogger(btn, { persona: persona, mode: 'join', signup_method: method }); });
      return live.stop;
    }
  };

  /* ---------- login — /login ---------- */
  screens.login = {
    role: 'any', tab: null, tabbar: null, tracked: true,
    title: function () { return 'Log in'; },
    render: function () {
      return authShell({
        title: 'Log in',
        heading: 'Welcome back',
        sub: 'Returning members land straight on Explore.',
        body: '<div class="auth-block">' + personaPicker('sara') + '</div>' +
          '<div class="auth-block field-stack">' +
          '<div><label class="field-label" for="login-email">Email</label><div class="field is-readonly"><input id="login-email" type="email" value="sara@demo.tss" readonly tabindex="-1" aria-readonly="true"></div></div>' +
          '<div><label class="field-label" for="login-password">Password</label><div class="field is-readonly"><input id="login-password" type="password" value="secretsociety" readonly tabindex="-1" aria-readonly="true"></div></div>' +
          '</div>' +
          demoIdCard('sara', 'Returning member · account_age_days 180') +
          '<div class="auth-cta">' + ui.button('Log in', { cls: 'btn-primary btn-lg btn-block', id: 'login-btn' }) + '</div>' +
          '<p class="auth-foot">New here? <button class="link-gradient" type="button" data-nav="/signup">Join</button></p>'
      });
    },
    mount: function (params, root) {
      var persona = 'sara';
      var live = liveDemoId(root, function () { return persona; });
      var email = root.querySelector('#login-email');
      radioGroup(root, 'persona', function (v) {
        persona = v;
        if (email) email.value = String(v).toLowerCase() + '@demo.tss';
        live.update();
      });
      var btn = root.querySelector('#login-btn');
      if (btn) btn.addEventListener('click', function () { submitBlogger(btn, { persona: persona, mode: 'login' }); });
      return live.stop;
    }
  };

  /* ---------- venueLogin — /venue/login (Business log in) ---------- */
  screens.venueLogin = {
    role: 'any', tab: null, tabbar: null, tracked: true,
    title: function () { return 'Business log in'; },
    render: function () {
      var venues = demoVenues();
      var first = venues[0];
      var list = '<div class="venue-pick-list" role="radiogroup" aria-label="Venue">' + venues.map(function (v, i) {
        var on = i === 0;
        return '<button class="venue-pick' + (on ? ' is-selected' : '') + '" type="button" role="radio" aria-checked="' + (on ? 'true' : 'false') + '" data-venue="' + esc(v.venue_id) + '">' +
          '<span class="thumb art art-' + esc(v.art || 'nightlife') + '"></span>' +
          '<span class="venue-pick-body">' +
          '<span class="card-title">' + esc(v.venue_name) + '</span>' +
          '<span class="card-meta">' + esc(v.venue_category) + SEP + esc(v.city || 'Dubai') + '</span>' +
          ui.tag(esc(approvalLabel(v.approval_style)), v.approval_style === 'slot_calendar' ? 'teal' : 'outline') +
          '</span>' +
          '<span class="persona-check">' + ui.icon('check', 14, 'badge') + '</span>' +
          '</button>';
      }).join('') + '</div>';
      return authShell({
        title: 'Business log in',
        heading: 'Choose your venue',
        sub: 'Two venues, two ways to approve.',
        body: '<div class="auth-block">' + list + '</div>' +
          '<div class="auth-block field-stack">' +
          '<div><label class="field-label" for="venue-email">Manager email</label><div class="field is-readonly"><input id="venue-email" type="email" value="' + esc(managerEmail(first)) + '" readonly tabindex="-1" aria-readonly="true"></div></div>' +
          '</div>' +
          '<div class="demo-id auth-block"><span class="t-label c-muted">Manager ID</span><span class="demo-id-value" id="manager-id">' + esc(first.manager_id) + '</span><span class="t-meta-sm">Stable venue manager — carries the venue group.</span></div>' +
          '<div class="auth-cta">' + ui.button('Log in', { cls: 'btn-primary btn-lg btn-block', id: 'venue-login-btn' }) + '</div>' +
          '<p class="auth-foot">Looking for creator access? <button class="link-gradient" type="button" data-nav="/login">Log in as a creator</button></p>'
      });
    },
    mount: function (params, root) {
      var venues = demoVenues();
      var venue_id = venues[0].venue_id;
      var email = root.querySelector('#venue-email');
      var mid = root.querySelector('#manager-id');
      radioGroup(root, 'venue', function (v) {
        venue_id = v;
        var venue = venues.filter(function (x) { return x.venue_id === v; })[0];
        if (venue) {
          if (email) email.value = managerEmail(venue);
          if (mid) mid.textContent = venue.manager_id;
        }
      });
      var btn = root.querySelector('#venue-login-btn');
      if (btn) btn.addEventListener('click', function () {
        btn.disabled = true;
        try { TSS.analytics.identifyManager({ venue_id: venue_id }); }
        catch (e) {
          if (window.console) console.error('[TSS] identifyManager failed', e);
          ui.toast('Could not log in — see console');
          btn.disabled = false;
          return;
        }
        navigate('/venue/dashboard', { replace: true });
      });
      return null;
    }
  };

  /* ---------- notFound ---------- */
  screens.notFound = {
    role: 'any', tab: null, tabbar: null, tracked: true,
    title: function () { return 'Not found'; },
    render: function (params) {
      params = params || {};
      var path = params.path || (TSS.router && TSS.router.current().path) || '';
      var missing = params.missing ? '<p class="notfound-sub mono">Screen "' + esc(params.missing) + '" is not available in this build.</p>' : '';
      return '<div class="notfound">' + ui.header({ left: 'back', title: 'Not found' }) +
        '<div class="notfound-body">' +
        '<div class="art art-nightlife notfound-art"></div>' +
        '<h1 class="notfound-title">Nothing here</h1>' +
        '<p class="notfound-sub">The page <span class="mono">' + esc(path) + '</span> doesn\'t exist in the demo.</p>' + missing +
        '<div class="notfound-actions">' +
        ui.button('Back to Welcome', { cls: 'btn-primary btn-lg btn-block', nav: '/', id: 'notfound-home' }) +
        '</div></div></div>';
    },
    mount: function () { return null; }
  };

  /* ---------- debug — /debug (never tracked, renders wide) ---------- */
  var FIXED_ROUTES = [
    '/', '/signup', '/login', '/events',
    '/events/category/dining', '/events/category/nightlife', '/events/category/beach-pool', '/events/category/wellness-spa', '/events/category/beauty', '/events/category/fitness',
    '/search',
    '/events/OFR-DEMO-01', '/events/OFR-DEMO-02', '/events/OFR-0016', '/events/OFR-0008', '/events/OFR-0054', '/events/OFR-0019', '/events/OFR-0055', '/events/OFR-0006',
    '/events/OFR-DEMO-01/apply', '/events/OFR-DEMO-02/apply',
    '/invites', '/profile',
    '/venue/login', '/venue/dashboard', '/venue/offers/OFR-DEMO-01/calendar', '/venue/applications', '/venue/checkin', '/venue/profile', '/venue/fix/seat-at-approval',
    '/debug'
  ];
  function status(kind, text) { return '<span class="dbg-status is-' + kind + '"><span class="dbg-dot"></span>' + text + '</span>'; }
  function kv(pairs) {
    return '<div class="dbg-kv">' + pairs.map(function (p) {
      return '<span class="k">' + esc(p[0]) + '</span><span class="v mono">' + (p[1] === undefined || p[1] === null || p[1] === '' ? '<span class="c-muted">—</span>' : p[1]) + '</span>';
    }).join('') + '</div>';
  }
  function card(title, body, opts) {
    opts = opts || {};
    return '<section class="dbg-card' + (opts.full ? ' is-full' : '') + '"><h2>' + title + (opts.aside ? '<span class="t-meta-sm">' + opts.aside + '</span>' : '') + '</h2>' + body + '</section>';
  }
  function buildDebug(ctx) {
    var C = cfg();
    var s = session();
    var sdk = s.sdk || {};
    var ex = s.experiment || {};
    var amp = window.amplitude;
    var analyticsLoaded = !!(amp && typeof amp.track === 'function');
    var ident = null, log = [], market = null, errs = {};
    try { ident = TSS.analytics.identityInfo(); } catch (e) { errs.identity = e; }
    try { log = TSS.analytics.getDebugLog() || []; } catch (e) { errs.log = e; }
    try { market = TSS.state.getMarket(); } catch (e) { errs.market = e; }
    var deviceId = ident && ident.device_id;
    var base = C.BASE || '/tss-demo';

    // 1 · SDK presence
    var exStatus = ex.status === 'fetched' ? status('ok', 'initialized · fetched')
      : ex.status === 'initializing' ? status('warn', 'initializing…')
      : ex.status === 'error' ? status('bad', 'error: ' + esc(ex.error || 'unknown'))
      : status('warn', 'idle — initializes after login');
    var exVariant = ex.status === 'fetched' ? (ex.variant ? 'variant: <b>' + esc(ex.variant) + '</b>' : 'no variant returned — flag has no deployment attached yet') : '';
    var presence = '<div class="dbg-scroll"><table class="dbg-table"><thead><tr><th>SDK</th><th>Status</th><th>Detail</th></tr></thead><tbody>' +
      '<tr><td class="k">Analytics (Browser SDK 2)</td><td>' + (analyticsLoaded && deviceId ? status('ok', 'loaded') : status('bad', analyticsLoaded ? 'loaded · no device_id yet' : 'window.amplitude missing')) + '</td><td class="mono">' +
        (TSS.analytics ? 'autocapture off · defaultTracking off · identityStorage sessionStorage' : 'js/analytics.js not loaded') +
        (sdk.boot_mode ? ' · boot ' + esc(sdk.boot_mode) : '') +
        (sdk.loader_won_race ? '<br>' + status('bad', 'loader initialised the SDK first — autocapture may have fired; check the shell bootstrap') : '') + '</td></tr>' +
      '<tr><td class="k">Session Replay plugin</td><td>' + (sdk.sr_added ? status('ok', 'active') : status('bad', typeof window.sessionReplay === 'undefined' ? 'window.sessionReplay missing' : 'not added')) + '</td><td class="mono">sampleRate ' + esc(sdk.sr_sample_rate === undefined || sdk.sr_sample_rate === null ? 1 : sdk.sr_sample_rate) + ' · defaultMaskLevel medium · fetchRemoteConfig true (remote config may override the sample rate)</td></tr>' +
      '<tr><td class="k">Guides &amp; Surveys (engagement)</td><td>' + (sdk.engagement_added ? status('ok', 'loaded') : status('bad', 'not added')) + '</td><td class="mono">typeof window.engagement = ' + esc(typeof window.engagement) + '</td></tr>' +
      '<tr><td class="k">Experiment</td><td>' + exStatus + '</td><td class="mono">key ' + esc(ex.key_used || C.EXPERIMENT_DEPLOYMENT_KEY || '—') + ' · flag ' + esc(C.FLAG_KEY || '—') +
        (ex.fetch_ms !== undefined && ex.fetch_ms !== null ? ' · fetch ' + esc(ex.fetch_ms) + ' ms' : '') + (exVariant ? '<br>' + exVariant : '') + ' · exposures never sent · typeof window.Experiment = ' + esc(typeof window.Experiment) + '</td></tr>' +
      '<tr><td class="k">Localhost mode</td><td>' + (C.IS_LOCAL ? status('warn', 'opted out — events logged here only') : status('ok', 'sending to Amplitude')) + '</td><td class="mono">' + esc(location.hostname) + (C.PROD_DOMAIN ? ' · production ' + esc(C.PROD_DOMAIN) : '') + '</td></tr>' +
      '</tbody></table></div>';

    // 2 · Identity
    var a = s.attribution || {};
    var identity = kv([
      ['user_id', ident && ident.user_id ? esc(ident.user_id) : null],
      ['device_id', deviceId ? esc(deviceId) : null],
      ['session_id', ident && ident.session_id ? esc(ident.session_id) : (C.IS_LOCAL && deviceId ? '<span class="c-muted">deferred — SDK opted out on localhost (numeric in production)</span>' : null)],
      ['groups', ident && ident.groups && Object.keys(ident.groups).length ? json(ident.groups) : '<span class="c-muted">none (bloggers carry groups per event)</span>'],
      ['role', s.role ? esc(s.role) + (s.persona ? ' · ' + esc(s.persona) : '') + (s.mode ? ' · ' + esc(s.mode) : '') : '<span class="c-muted">no session in this window</span>'],
      ['funnel', s.role ? 'step ' + esc(s.funnel_step) + ' · ' + esc(s.screens_viewed) + ' screens viewed' : null],
      ['attribution', a.utm_source ? esc(a.utm_source) + ' / ' + esc(a.utm_medium) + ' / ' + esc(a.utm_campaign) + '<br>' + esc(a.referrer || '') + (a.referring_domain ? ' (' + esc(a.referring_domain) + ')' : '') : null]
    ]) + (errs.identity ? '<p class="dbg-note">identityInfo failed: ' + esc(errs.identity.message) + '</p>' : '');

    // 3 · Last 20 events
    var recent = log.slice(0, 20);
    var invalidCount = log.filter(function (e) { return e.status === 'invalid'; }).length;
    var rows = recent.map(function (e, i) {
      var k = 'evt-' + (e.ts || 0) + '-' + i;
      var invalid = e.status === 'invalid';
      var props = e.user_properties ? { user_properties: e.user_properties, event_properties: e.event_properties } : (e.event_properties || {});
      var nProps = Object.keys(e.event_properties || {}).length + (e.user_properties ? Object.keys(e.user_properties).length : 0);
      var rev = e.revenue ? esc(e.revenue.revenue) + ' ' + esc(e.revenue.revenueType || '') + '<br>' + esc(e.revenue.quantity) + ' × ' + esc(e.revenue.price) + ' · ' + esc(e.revenue.productId || '') : '<span class="c-muted">—</span>';
      return '<tr class="' + (invalid ? 'is-invalid' : '') + '">' +
        '<td class="mono">' + esc(fmtTime(e.ts)) + '</td>' +
        '<td><b>' + esc(e.event_type) + '</b>' + (e.user_id ? '<div class="mono c-muted">' + esc(e.user_id) + '</div>' : '') + '</td>' +
        '<td>' + (invalid ? status('bad', 'invalid') + '<div class="dbg-errors">' + (e.errors || []).map(esc).join('<br>') + '</div>' : status('ok', 'ok')) + '</td>' +
        '<td><details class="dbg-details" data-k="' + k + '"' + (ctx.open[k] ? ' open' : '') + '><summary>' + nProps + ' props</summary><pre>' + json(props, true) + '</pre></details></td>' +
        '<td class="mono">' + (e.groups && Object.keys(e.groups).length ? json(e.groups) : '<span class="c-muted">—</span>') + '</td>' +
        '<td class="mono">' + rev + '</td>' +
        '<td>' + (e.sent ? 'yes' : 'no') + '</td>' +
        '</tr>';
    }).join('');
    var events = (recent.length ? '<div class="dbg-scroll"><table class="dbg-table"><thead><tr><th>Time</th><th>Event</th><th>Status</th><th>Properties</th><th>Groups</th><th>Revenue</th><th>Sent</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      : '<p class="dbg-empty">' + (errs.log ? 'getDebugLog failed: ' + esc(errs.log.message) : 'No events in this window yet — join or log in to start.') + '</p>') +
      '<div class="dbg-actions">' + ui.button('Copy log as JSON', { cls: 'btn-secondary', data: { dbg: 'copy' }, disabled: !log.length }) + '</div>';

    // 4 · Marketplace
    var marketBody;
    if (market) {
      var apps = Object.keys(market.applications || {}).map(function (k) { return market.applications[k]; });
      var invs = Object.keys(market.invites || {}).map(function (k) { return market.invites[k]; });
      var count = function (list, st) { return list.filter(function (x) { return x.status === st; }).length; };
      marketBody = kv([
        ['applications', apps.length + ' · pending ' + count(apps, 'pending') + ' · approved ' + count(apps, 'approved') + ' · rejected ' + count(apps, 'rejected')],
        ['invites', invs.length + ' · pending ' + count(invs, 'pending') + ' · accepted ' + count(invs, 'accepted') + ' · abandoned ' + count(invs, 'abandoned') + ' · checked in ' + count(invs, 'checked_in')],
        ['seats_taken', Object.keys(market.seats_taken || {}).length ? json(market.seats_taken) : '<span class="c-muted">none</span>'],
        ['updated_at', market.updated_at ? esc(fmtTime(market.updated_at)) : null]
      ]) +
        (apps.length || invs.length ? '<div class="dbg-list mt-4">' +
          apps.map(function (x) { return '<div>' + ui.tag(esc(x.status), x.status === 'approved' ? 'teal' : x.status === 'rejected' ? 'red' : 'outline') + esc(x.app_id) + ' · ' + esc(x.blogger_name || x.blogger_id) + ' → ' + esc(x.offer_id) + '</div>'; }).join('') +
          invs.map(function (x) { return '<div>' + ui.tag(esc(x.status), x.status === 'checked_in' ? 'teal-solid' : x.status === 'accepted' ? 'teal' : x.status === 'abandoned' ? 'red' : 'outline') + esc(x.invite_id) + ' · seat ' + esc(x.seat_reserved ? x.slot_id : 'unassigned') + (x.accepted_slot_id ? ' → ' + esc(x.accepted_slot_id) : '') + (x.checkin_code ? ' · ' + esc(x.checkin_code) : '') + '</div>'; }).join('') +
          '</div>' : '');
    } else {
      marketBody = '<p class="dbg-empty">' + (errs.market ? 'getMarket failed: ' + esc(errs.market.message) : 'js/state.js not loaded') + '</p>';
    }
    var armed = ctx.armedUntil > Date.now();
    marketBody += '<div class="dbg-actions">' +
      ui.button(armed ? 'Tap again to confirm reset' : 'Reset demo', { cls: armed ? 'btn-primary' : 'btn-secondary', data: { dbg: 'reset' }, id: 'dbg-reset' }) +
      ui.button('Clear this window\'s session', { cls: 'btn-secondary', data: { dbg: 'clear' }, id: 'dbg-clear' }) +
      '</div><p class="dbg-note">Reset clears the shared localStorage marketplace for both windows (applications, invites, seats, check-in codes). Clear session resets this window\'s identity and SDK user.</p>';

    // 5 · Routes
    var routes = '<div class="dbg-links">' + FIXED_ROUTES.map(function (p) {
      var href = base + (p === '/' ? '/' : p + '/');
      return '<a class="dbg-link" href="' + esc(href) + '">' + esc(p) + '</a>';
    }).join('') + '<a class="dbg-link" href="' + esc(base + '/debug/style/') + '">/debug/style</a></div>' +
      '<p class="dbg-note">Fixed routes load from their own folder shell; dynamic invite / collab routes come through 404.html. Open a route in a second window for the two-role demo.</p>';

    return '<header class="dbg-head"><span class="wordmark">The Secret Society</span><h1>Debug · SDK presence &amp; event log</h1>' + ui.tag('Not tracked', 'red') +
      '<span class="dbg-clock">refreshes every 2 s · ' + esc(fmtTime(Date.now())) + '</span>' +
      ui.button('Back to app', { cls: 'btn-secondary btn-sm', nav: '/', id: 'dbg-back' }) + '</header>' +
      '<div class="dbg-grid">' +
      card('SDK presence', presence, { full: true }) +
      card('Identity', identity) +
      card('Marketplace (shared)', marketBody) +
      card('Last 20 events', events, { full: true, aside: log.length + ' logged · ' + invalidCount + ' invalid' + (invalidCount ? ' — fix before the demo' : '') }) +
      card('Routes', routes, { full: true }) +
      '</div>';
  }

  screens.debug = {
    role: 'any', tab: null, tabbar: null, tracked: false,
    title: function () { return 'Debug'; },
    render: function () { return ''; },
    mount: function () {
      var ctx = { open: {}, armedUntil: 0 };
      var app = document.getElementById('app');
      function draw() {
        var wide = document.getElementById('wide');
        if (wide) {
          ctx.open = {};
          Array.prototype.forEach.call(wide.querySelectorAll('details[open][data-k]'), function (d) { ctx.open[d.getAttribute('data-k')] = true; });
        }
        var html;
        try { html = buildDebug(ctx); }
        catch (e) { if (window.console) console.error('[TSS] debug render failed', e); html = '<div class="dbg-card"><h2>Debug</h2><p class="dbg-empty">Render failed: ' + esc(e.message) + '</p></div>'; }
        ui.renderWide(html);
      }
      function onClick(e) {
        var b = e.target && e.target.closest ? e.target.closest('[data-dbg]') : null;
        if (!b) return;
        var action = b.getAttribute('data-dbg');
        if (action === 'reset') {
          if (ctx.armedUntil > Date.now()) {
            ctx.armedUntil = 0;
            try { TSS.state.resetMarket(); ui.toast('Marketplace reset for both windows'); }
            catch (err) { ui.toast('Reset failed: ' + err.message); }
          } else {
            ctx.armedUntil = Date.now() + 5000;
            setTimeout(function () { if (ctx.armedUntil && ctx.armedUntil <= Date.now()) { ctx.armedUntil = 0; draw(); } }, 5100);
          }
          draw();
        } else if (action === 'clear') {
          try { TSS.state.clearSession(); } catch (err) { /* ignore */ }
          try { if (window.amplitude && typeof window.amplitude.reset === 'function') window.amplitude.reset(); } catch (err) { /* ignore */ }
          ui.toast('Session cleared for this window');
          draw();
        } else if (action === 'copy') {
          var text = '[]';
          try { text = JSON.stringify(TSS.analytics.getDebugLog(), null, 2); } catch (err) { /* keep */ }
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function () { ui.toast('Log copied as JSON'); }, function () { ui.toast('Copy failed — clipboard blocked'); });
          } else {
            ui.toast('Clipboard not available');
          }
        }
      }
      app.addEventListener('click', onClick);
      draw();
      var timer = setInterval(draw, 2000);
      return function () {
        clearInterval(timer);
        app.removeEventListener('click', onClick);
      };
    }
  };
})();
