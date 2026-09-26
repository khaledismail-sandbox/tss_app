/* analytics.js — The Secret Society demo · TSS.analytics
   The whole SPEC §6–§8 analytics contract (ARCHITECTURE §6): plugin order, init options, localhost opt-out,
   the explicit tracking wrapper (insert_id, event-level groups, top-level revenue, local geo + validation,
   sessionStorage debug ring buffer), page views, blogger / manager identity, attribution, Experiment
   (fetch only — never exposures), funnel bookkeeping, session_ended (pagehide via beacon, and logout).

   Browser SDK 2.x facts this file relies on (verified against the unified loader + analytics-browser 2.42.4):
   · window.amplitude is a queueing stub until the async loader lands the real SDK and REPLACES the global —
     so every call goes through amp() at call time; nothing here ever caches window.amplitude.
   · When opted out (localhost) process() returns before the plugin timeline runs, so geo + validation are
     ALSO applied locally in the wrapper — the debug log must show what would have been sent.
   · The timeline schedules plugin execution with setTimeout(0), but flush() drains the pending queue
     synchronously into apply(), so setTransport('beacon') → track → flush inside pagehide does send.
   · The second-stage loader rewrites a queued sessionReplay.plugin(conf): a missing
     privacyConfig.defaultMaskLevel is replaced by "conservative", so the level is always set explicitly.
   · The second-stage loader ALSO queues its own init({autocapture:{elementInteractions:true}}) + a sampleRate-0
     Session Replay plugin whenever the SR bundle lands before any init is queued. With the CDN cached, that
     happens while our page scripts are still waiting on the fonts stylesheet, i.e. before app.js can call
     TSS.analytics.init() — autocapture on, cookie identity, no localhost opt-out. init() detects and repairs
     what it can ('late' boot mode below) but cannot un-send the SDK's own session_start / autocaptured events.
     The only ordering that can never lose that race is an INLINE bootstrap in the shell <head>, directly after
     the two loader <script> tags and before any <link>. Drop this in (analytics.js picks it up as 'inline'):

       <script>
       (function (a) { if (!a) return;
         var b = window.TSS_AMP = { sr_added: false, engagement_added: false, ready: null };
         try { if (window.sessionReplay) { a.add(window.sessionReplay.plugin({ sampleRate: 1, privacyConfig: { defaultMaskLevel: 'medium' } })); b.sr_added = true; } } catch (e) {}
         try { if (window.engagement) { a.add(window.engagement.plugin()); b.engagement_added = true; } } catch (e) {}
         b.ready = a.init('91a049dfcf02afc23c2aa2d43f1d3748', { fetchRemoteConfig: true, autocapture: false, defaultTracking: false, identityStorage: 'sessionStorage' }).promise;
         if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) a.setOptOut(true);
       })(window.amplitude);
       </script> */
window.TSS = window.TSS || {};
(function () {
  'use strict';
  var TSS = window.TSS;

  // ---------------------------------------------------------------------------------------------
  // Constants (contract values; TSS.config wins whenever it defines the same key)
  // ---------------------------------------------------------------------------------------------
  var DEFAULTS = {
    API_KEY: '91a049dfcf02afc23c2aa2d43f1d3748',
    EXPERIMENT_DEPLOYMENT_KEY: '91a049dfcf02afc23c2aa2d43f1d3748',
    FLAG_KEY: 'slot-full-notice-viewed-reduction',
    BASE: '/tss-demo',
    APP_NAME: 'The Secret Society',
    GEO: { country: 'United Arab Emirates', region: 'Dubai', city: 'Dubai', platform: 'Web' },
    DEBUG_KEY: 'tss-demo-debug',
    DEBUG_LOG_MAX: 60,
    ATTRIBUTION_BUNDLES: [
      { utm_medium: 'cpc', utm_source: 'google', utm_campaign: 'tss_creator_acquisition_search', referrer: 'https://www.google.com/' },
      { utm_medium: 'organic', utm_source: 'google', utm_campaign: 'tss_seo_creator_guides', referrer: 'https://www.google.com/' },
      { utm_medium: 'social', utm_source: 'instagram', utm_campaign: 'tss_ig_creator_invites', referrer: 'https://l.instagram.com/' },
      { utm_medium: 'social', utm_source: 'tiktok', utm_campaign: 'tss_tiktok_creator_spotlight', referrer: 'https://www.tiktok.com/' },
      { utm_medium: 'affiliate', utm_source: 'creator_referral', utm_campaign: 'tss_member_get_member', referrer: 'https://linktr.ee/' },
      { utm_medium: 'email', utm_source: 'newsletter', utm_campaign: 'tss_weekly_drops', referrer: 'https://mail.google.com/' }
    ],
    FALLBACK_BUNDLE: { utm_medium: 'social', utm_source: 'instagram', utm_campaign: 'tss_ig_creator_invites', referrer: 'https://l.instagram.com/' },
    PERSONAS: { sara: { name: 'Sara' }, omar: { name: 'Omar' } },
    BLOGGER_PROFILE: { track_record: 'Steady Regulars', primary_niche: 'lifestyle', follower_band: '10k-25k', home_city: 'Dubai', device_type: 'ios', applications_30d: 0, checkins_30d: 0 }
  };
  // SPEC §4.1 / §4.4 — used only when TSS.data does not answer (e.g. the analytics harness).
  var DEMO_VENUES = {
    'VEN-DEMO-SLOT': { venue_id: 'VEN-DEMO-SLOT', venue_name: 'Solace Beach Club', venue_category: 'Beach & Pool', approval_style: 'slot_calendar', manager_id: 'demo-manager-solace', manager_name: 'Layla', account_age_days: 400 },
    'VEN-DEMO-INBOX': { venue_id: 'VEN-DEMO-INBOX', venue_name: 'Obsidian Lounge', venue_category: 'Nightlife', approval_style: 'inbox', manager_id: 'demo-manager-obsidian', manager_name: 'Omar', account_age_days: 250 }
  };
  var GEO_FIELDS = ['country', 'region', 'city', 'platform'];
  var REVENUE_FIELDS = ['productId', 'price', 'quantity', 'revenue', 'revenueType'];
  var SR_PLUGIN_NAME = '@amplitude/plugin-session-replay-browser';
  // Plugins the loader's own init(autocapture) would install; removed if that init ever wins the race.
  var AUTOCAPTURE_PLUGINS = [
    '@amplitude/plugin-autocapture-browser', '@amplitude/plugin-page-view-tracking-browser',
    '@amplitude/plugin-form-interaction-tracking-browser', '@amplitude/plugin-file-download-tracking-browser',
    '@amplitude/plugin-web-attribution-browser', '@amplitude/plugin-frustration-browser',
    '@amplitude/plugin-network-capture-browser', '@amplitude/plugin-performance-browser',
    '@amplitude/plugin-page-url-enrichment-browser'
  ];
  var INIT_OPTIONS = { fetchRemoteConfig: true, autocapture: false, defaultTracking: false, identityStorage: 'sessionStorage' };
  var SR_OPTIONS = { sampleRate: 1, privacyConfig: { defaultMaskLevel: 'medium' } };

  function C(key) {
    var c = TSS.config;
    return c && c[key] !== undefined && c[key] !== null ? c[key] : DEFAULTS[key];
  }
  function isLocal() {
    var c = TSS.config;
    if (c && typeof c.IS_LOCAL === 'boolean') return c.IS_LOCAL;
    return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  }
  function amp() { return window.amplitude || null; }
  function now() { return (window.performance && typeof performance.now === 'function') ? performance.now() : Date.now(); }
  function safeCall(target, method, args) {
    if (!target || typeof target[method] !== 'function') return undefined;
    try { return target[method].apply(target, args || []); }
    catch (e) { console.error('[TSS] amplitude.' + method + ' threw', e); return undefined; }
  }
  function promiseOf(r) { return (r && typeof r.promise !== 'undefined') ? Promise.resolve(r.promise) : Promise.resolve(r); }
  function shallowCopy(o) { var out = {}; if (o && typeof o === 'object') Object.keys(o).forEach(function (k) { out[k] = o[k]; }); return out; }
  function pick(o, keys) { var out = {}; keys.forEach(function (k) { if (o[k] !== undefined) out[k] = o[k]; }); return out; }
  function capitalize(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function errText(e) { return e && e.message ? String(e.message) : String(e); }

  function uuid() {
    try { if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID(); } catch (e) { /* fall through */ }
    var b = new Array(16), i;
    try {
      var u = new Uint8Array(16); window.crypto.getRandomValues(u);
      for (i = 0; i < 16; i++) b[i] = u[i];
    } catch (e) {
      for (i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
    }
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    var h = b.map(function (x) { return (x + 256).toString(16).slice(1); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }

  // ---------------------------------------------------------------------------------------------
  // Session access (TSS.state per ARCHITECTURE §5.1; an in-memory copy keeps analytics alive if it fails)
  // ---------------------------------------------------------------------------------------------
  function freshSession() {
    return {
      role: null, user_id: null, persona: null, display_name: null, suffix: null, venue_id: null, mode: null,
      is_returning: false, attribution: null, funnel_step: 0, screens_viewed: 0, session_started_at: null,
      session_ended_sent: false, saved_offers: [], searches: 0,
      sdk: { sr_added: false, sr_sample_rate: 1, engagement_added: false, analytics_ready: false },
      experiment: { status: 'idle', variant: null, payload: null, fetch_ms: null, error: null, key_used: C('EXPERIMENT_DEPLOYMENT_KEY'), at: null }
    };
  }
  var memSession = freshSession();
  function getSession() {
    try { if (TSS.state && typeof TSS.state.getSession === 'function') { var s = TSS.state.getSession(); if (s) return s; } }
    catch (e) { console.error('[TSS] state.getSession failed', e); }
    return memSession;
  }
  function setSession(patch) {
    try { if (TSS.state && typeof TSS.state.setSession === 'function') return TSS.state.setSession(patch); }
    catch (e) { console.error('[TSS] state.setSession failed', e); }
    Object.keys(patch).forEach(function (k) { memSession[k] = patch[k]; });
    return memSession;
  }
  function newSuffix() {
    try { if (TSS.state && typeof TSS.state.newSuffix === 'function') return TSS.state.newSuffix(); } catch (e) { /* fall through */ }
    var d = new Date();
    return pad2(d.getMonth() + 1) + pad2(d.getDate()) + '-' + pad2(d.getHours()) + pad2(d.getMinutes());
  }
  function bloggerId(persona, suffix) {
    try { if (TSS.state && typeof TSS.state.bloggerId === 'function') return TSS.state.bloggerId(persona, suffix); } catch (e) { /* fall through */ }
    return 'demo-blogger-' + persona + '-' + suffix;
  }
  function venueRecord(venue_id) {
    var rec = null;
    try {
      if (TSS.data && typeof TSS.data.venue === 'function') rec = TSS.data.venue(venue_id);
      if (!rec && TSS.data && TSS.data.VENUES) rec = TSS.data.VENUES[venue_id] || null;
    } catch (e) { rec = null; }
    var fallback = DEMO_VENUES[venue_id] || null;
    if (!rec && !fallback) return null;
    var out = shallowCopy(fallback || {});
    if (rec) Object.keys(rec).forEach(function (k) { if (rec[k] !== undefined && rec[k] !== null && rec[k] !== '') out[k] = rec[k]; });
    return out;
  }

  // ---------------------------------------------------------------------------------------------
  // Geo + validation (SPEC §6.3 / §6.4)
  // ---------------------------------------------------------------------------------------------
  function applyGeo(event) {
    var geo = C('GEO');
    if (!event || typeof event !== 'object') return event;
    GEO_FIELDS.forEach(function (f) { event[f] = geo[f]; });
    return event;
  }
  function isEmptyValue(v) {
    if (v === null || v === undefined) return true;
    if (typeof v === 'number') return isNaN(v);
    if (typeof v !== 'string') return false;
    var t = v.trim().toLowerCase();
    return t === '' || t === 'none' || t === '(none)';
  }
  function describe(v) {
    if (v === null) return 'null';
    if (v === undefined) return 'undefined';
    if (typeof v === 'number') return 'NaN';
    return v.trim() === '' ? '"" (empty string)' : JSON.stringify(v);
  }
  function walk(value, path, errors) {
    if (isEmptyValue(value)) { errors.push(path + ' is ' + describe(value)); return; }
    if (Array.isArray(value)) { value.forEach(function (v, i) { walk(v, path + '[' + i + ']', errors); }); return; }
    if (typeof value === 'object') Object.keys(value).forEach(function (k) { walk(value[k], path + '.' + k, errors); });
  }
  function walkBag(bag, prefix, errors) {
    if (!bag || typeof bag !== 'object') return;
    Object.keys(bag).forEach(function (k) { walk(bag[k], prefix + '.' + k, errors); });
  }
  // → [errors]. Walks event_properties, user_properties.$set/$setOnce, groups, and the top-level geo /
  // revenue fields that are present; fails on null, undefined, '', 'none', '(none)' (trimmed, case-insensitive)
  // and NaN; also fails when country is missing.
  function validate(obj) {
    var errors = [];
    if (!obj || typeof obj !== 'object') return ['event is not an object'];
    if (isEmptyValue(obj.event_type)) errors.push('event_type is ' + describe(obj.event_type));
    walkBag(obj.event_properties, 'event_properties', errors);
    if (obj.user_properties && typeof obj.user_properties === 'object') {
      walkBag(obj.user_properties.$set, 'user_properties.$set', errors);
      walkBag(obj.user_properties.$setOnce, 'user_properties.$setOnce', errors);
    }
    walkBag(obj.groups, 'groups', errors);
    GEO_FIELDS.concat(REVENUE_FIELDS).forEach(function (f) {
      if (Object.prototype.hasOwnProperty.call(obj, f) && isEmptyValue(obj[f])) errors.push(f + ' is ' + describe(obj[f]));
    });
    if (!Object.prototype.hasOwnProperty.call(obj, 'country')) errors.push('country is missing');
    return errors;
  }

  // ---------------------------------------------------------------------------------------------
  // Debug ring buffer (sessionStorage DEBUG_KEY, newest first, capped at DEBUG_LOG_MAX)
  // ---------------------------------------------------------------------------------------------
  var memLog = [];
  function readLog() {
    try {
      var raw = sessionStorage.getItem(C('DEBUG_KEY'));
      var arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) { memLog = arr; return arr; }
    } catch (e) { /* private mode, quota, corrupt JSON → memory copy */ }
    return memLog;
  }
  function writeLog(arr) {
    var max = Number(C('DEBUG_LOG_MAX')) || 60;
    arr = arr.slice(0, max);
    memLog = arr;
    try { sessionStorage.setItem(C('DEBUG_KEY'), JSON.stringify(arr)); } catch (e) { /* keep the memory copy */ }
    return arr;
  }
  function pushLog(entry) { var arr = readLog().slice(); arr.unshift(entry); writeLog(arr); return entry; }
  function updateLog(insert_id, fn) {
    var arr = readLog().slice();
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] && arr[i].insert_id === insert_id) { fn(arr[i]); writeLog(arr); return true; }
    }
    return false;
  }
  function hasRevenue(obj) { return REVENUE_FIELDS.some(function (f) { return obj[f] !== undefined; }); }
  function makeEntry(kind, obj, status, errors, extra) {
    extra = extra || {};
    var id = identityInfo();
    return {
      ts: Date.now(),
      kind: kind,                                   // 'track' | 'identify' | 'setGroup' | 'plugin'
      insert_id: obj.insert_id || null,
      event_type: obj.event_type,
      event_properties: shallowCopy(obj.event_properties || {}),
      groups: obj.groups ? shallowCopy(obj.groups) : null,
      revenue: hasRevenue(obj) ? pick(obj, REVENUE_FIELDS) : null,
      user_properties: obj.user_properties ? obj.user_properties : null,
      user_id: obj.user_id || extra.user_id || id.user_id,
      device_id: obj.device_id || id.device_id,
      session_id: obj.session_id || id.session_id,
      country: obj.country, region: obj.region, city: obj.city, platform: obj.platform,
      reason: extra.reason || undefined,
      status: status,
      errors: errors.slice(),
      sent: extra.sent !== undefined ? extra.sent : !isLocal()
    };
  }
  function getDebugLog() { return readLog().slice(); }
  function clearDebugLog() { writeLog([]); }

  // ---------------------------------------------------------------------------------------------
  // Plugins (Browser SDK 2.x enrichment plugins)
  // ---------------------------------------------------------------------------------------------
  var geoPlugin = {
    name: 'tss-geo-enrichment',
    type: 'enrichment',
    setup: function () { return Promise.resolve(); },
    execute: function (event) { return Promise.resolve(applyGeo(event)); }
  };
  // Events the vendor SDKs emit on their own (the Guides & Surveys bundle tracks '[Guides-Surveys] Engagement
  // Booted' with null-valued init arguments by design). They are outside the tracking plan and cannot be shaped
  // by this app, so they are logged and geo-enriched but not held to the no-empty-values rule.
  function isSdkInternalEvent(event) {
    return typeof event.event_type === 'string' && event.event_type.indexOf('[Guides-Surveys]') === 0;
  }
  var validationPlugin = {
    name: 'tss-validation',
    type: 'enrichment',
    setup: function () { return Promise.resolve(); },
    execute: function (event) {
      var internal = isSdkInternalEvent(event);
      var errors = internal ? [] : validate(event);
      if (errors.length) console.error('[TSS] validation failed', event.event_type, errors);
      var matched = event.insert_id && updateLog(event.insert_id, function (entry) {
        if (errors.length) {
          entry.status = 'invalid';
          errors.forEach(function (e) { if (entry.errors.indexOf(e) < 0) entry.errors.push(e); });
        }
        entry.sent = true;
      });
      // Anything that reached the pipeline without going through the wrapper (SDK-internal events, anything a
      // loader could inject) is logged too, so the debug panel shows everything that leaves.
      if (!matched) {
        var entry = makeEntry('plugin', event, errors.length ? 'invalid' : 'ok', errors, { sent: true });
        entry.validated = !internal;
        pushLog(entry);
      }
      return Promise.resolve(event);
    }
  };

  // ---------------------------------------------------------------------------------------------
  // Core send path
  // ---------------------------------------------------------------------------------------------
  function buildEvent(event_type, event_properties, opts) {
    opts = opts || {};
    var obj = { event_type: event_type, event_properties: shallowCopy(event_properties || {}), insert_id: uuid() };
    if (opts.groups && typeof opts.groups === 'object' && Object.keys(opts.groups).length) obj.groups = shallowCopy(opts.groups);
    if (opts.revenue && typeof opts.revenue === 'object') {
      REVENUE_FIELDS.forEach(function (f) { if (opts.revenue[f] !== undefined) obj[f] = opts.revenue[f]; });
    }
    return applyGeo(obj);
  }
  // Validates, logs (debug ring buffer + console on localhost) and does the session bookkeeping — synchronously,
  // so the debug log always reflects call order even when the SDK call itself has to wait for readiness.
  function record(obj, extra) {
    var errors = validate(obj);
    var status = errors.length ? 'invalid' : 'ok';
    if (errors.length) console.error('[TSS] validation failed', obj.event_type, errors);
    pushLog(makeEntry('track', obj, status, errors, extra));
    if (isLocal()) console.info('[TSS] event', obj);
    if (!sdkPersisted) persistSdk();
    if (obj.event_type !== 'session_ended' && getSession().session_ended_sent) setSession({ session_ended_sent: false });
    return status;
  }
  function dispatchTrack(obj) {
    var a = amp();
    if (!a || typeof a.track !== 'function') { console.error('[TSS] amplitude.track unavailable — event not sent', obj.event_type); return Promise.resolve(null); }
    try { return promiseOf(a.track(obj)); }
    catch (e) { console.error('[TSS] amplitude.track threw', e); return Promise.resolve(null); }
  }
  // opts = { groups?: {venue:'VEN-…'}, revenue?: {productId, price, quantity, revenue, revenueType} } → Promise
  function track(event_type, event_properties, opts) {
    var obj = buildEvent(event_type, event_properties, opts);
    record(obj, {});
    return whenReady(function () { return dispatchTrack(obj); });
  }

  function normalizePath(p, base) {
    p = String(p || location.pathname || '/');
    var cut = p.search(/[?#]/); if (cut >= 0) p = p.slice(0, cut);
    if (p.indexOf(base) !== 0) p = base + (p.charAt(0) === '/' ? p : '/' + p);
    if (p === base || p === base + '/') return base + '/';
    return p.replace(/\/+$/, '');
  }
  function pageTitle(t) {
    var name = C('APP_NAME'), suffix = ' · ' + name;
    t = (t === undefined || t === null) ? '' : String(t).trim();
    if (!t) t = (document.title || '').trim();
    if (!t || t === name) return name;
    return t.slice(-suffix.length) === suffix ? t : t + suffix;
  }
  // '[Amplitude] Page Viewed' with the five SPEC §7.1 properties; increments session.screens_viewed.
  function pageView(arg) {
    arg = arg || {};
    var base = C('BASE');
    var path = normalizePath(arg.path, base);
    if (path.indexOf(base + '/debug') === 0) return Promise.resolve(null); // /debug* is never tracked
    var props = {
      '[Amplitude] Page Path': path,
      '[Amplitude] Page URL': location.origin + path,
      '[Amplitude] Page Title': pageTitle(arg.title),
      '[Amplitude] Page Domain': location.hostname,
      '[Amplitude] Page Location': location.href
    };
    setSession({ screens_viewed: (Number(getSession().screens_viewed) || 0) + 1 });
    return track('[Amplitude] Page Viewed', props, arg.groups ? { groups: arg.groups } : {});
  }

  // ---------------------------------------------------------------------------------------------
  // Identity (SPEC §6.6)
  // ---------------------------------------------------------------------------------------------
  function identityInfo() {
    var a = amp(), s = getSession();
    var user_id = null, device_id = null, session_id = null;
    try {
      if (a && typeof a.getUserId === 'function') user_id = a.getUserId() || null;
      if (a && typeof a.getDeviceId === 'function') device_id = a.getDeviceId() || null;
      if (a && typeof a.getSessionId === 'function') session_id = a.getSessionId() || null;
    } catch (e) { /* stub or half-initialised SDK */ }
    return {
      user_id: user_id, device_id: device_id, session_id: session_id,
      groups: s.role === 'venue_manager' && s.venue_id ? { venue: s.venue_id } : {}
    };
  }
  // A fresh device per rehearsal / per role switch: when a different user was identified before, rotate the
  // device id BEFORE setUserId so Amplitude never merges two demo users through a shared device.
  function switchUser(user_id) {
    var prevSessionUser = getSession().user_id;   // read now: the session is updated right after this call
    return whenReady(function () {
      var a = amp(), sdkUser = null;
      try { if (a && typeof a.getUserId === 'function') sdkUser = a.getUserId() || null; } catch (e) { /* ignore */ }
      if ((prevSessionUser && prevSessionUser !== user_id) || (sdkUser && sdkUser !== user_id)) safeCall(a, 'setDeviceId', [uuid()]);
      safeCall(a, 'setUserId', [user_id]);
    });
  }
  function initialProps(att) {
    return {
      initial_utm_source: att.utm_source, initial_utm_medium: att.utm_medium, initial_utm_campaign: att.utm_campaign,
      initial_referrer: att.referrer, initial_referring_domain: att.referring_domain
    };
  }
  function sendIdentify(set, setOnce, user_id) {
    var obj = { event_type: '$identify', event_properties: {}, user_properties: { $set: set, $setOnce: setOnce }, insert_id: uuid() };
    applyGeo(obj);
    var errors = validate(obj);
    if (errors.length) console.error('[TSS] validation failed', '$identify', errors);
    pushLog(makeEntry('identify', obj, errors.length ? 'invalid' : 'ok', errors, { user_id: user_id }));
    if (isLocal()) console.info('[TSS] identify', obj.user_properties);
    return whenReady(function () {
      var a = amp();
      if (!a || typeof a.Identify !== 'function' || typeof a.identify !== 'function') { console.error('[TSS] amplitude.identify unavailable'); return Promise.resolve(null); }
      try {
        var identify = new a.Identify();
        Object.keys(set).forEach(function (k) { identify.set(k, set[k]); });
        Object.keys(setOnce).forEach(function (k) { identify.setOnce(k, setOnce[k]); });
        return promiseOf(a.identify(identify, { insert_id: obj.insert_id }));
      } catch (e) { console.error('[TSS] amplitude.identify threw', e); return Promise.resolve(null); }
    });
  }
  function sendSetGroup(groupType, groupName, user_id) {
    var groups = {}; groups[groupType] = groupName;
    var set = {}; set[groupType] = groupName;
    var obj = { event_type: '$identify', event_properties: {}, groups: groups, user_properties: { $set: set }, insert_id: uuid() };
    applyGeo(obj);
    var errors = validate(obj);
    if (errors.length) console.error('[TSS] validation failed', '$identify (setGroup)', errors);
    pushLog(makeEntry('setGroup', obj, errors.length ? 'invalid' : 'ok', errors, { user_id: user_id }));
    if (isLocal()) console.info('[TSS] setGroup', groups);
    return whenReady(function () {
      var a = amp();
      if (!a || typeof a.setGroup !== 'function') { console.error('[TSS] amplitude.setGroup unavailable'); return Promise.resolve(null); }
      try { return promiseOf(a.setGroup(groupType, groupName, { insert_id: obj.insert_id })); }
      catch (e) { console.error('[TSS] amplitude.setGroup threw', e); return Promise.resolve(null); }
    });
  }

  // {persona:'sara'|'omar', mode:'join'|'login', signup_method?:'email'|'apple'|'google'} → user_id
  function identifyBlogger(arg) {
    arg = arg || {};
    var persona = String(arg.persona || 'sara').toLowerCase();
    var mode = arg.mode === 'login' ? 'login' : 'join';
    var method = String(arg.signup_method || 'email').toLowerCase();
    if (['email', 'apple', 'google'].indexOf(method) < 0) method = 'email';
    var suffix = newSuffix();
    var user_id = bloggerId(persona, suffix);
    var att = ensureAttribution();
    var profile = C('BLOGGER_PROFILE');
    var personas = C('PERSONAS');
    var display_name = (personas && personas[persona] && personas[persona].name) || capitalize(persona);

    switchUser(user_id);
    var set = {
      user_role: 'creator',
      track_record: profile.track_record,
      primary_niche: profile.primary_niche,
      follower_band: profile.follower_band,
      home_city: profile.home_city,
      account_age_days: mode === 'join' ? 0 : 180,
      device_type: profile.device_type,
      applications_30d: profile.applications_30d,
      checkins_30d: profile.checkins_30d,
      utm_source: att.utm_source, utm_medium: att.utm_medium, utm_campaign: att.utm_campaign,
      referrer: att.referrer, referring_domain: att.referring_domain
    };
    sendIdentify(set, initialProps(att), user_id);
    setSession({
      role: 'creator', user_id: user_id, persona: persona, display_name: display_name, suffix: suffix, venue_id: null,
      mode: mode, is_returning: mode === 'login', funnel_step: 0, session_started_at: Date.now(), session_ended_sent: false
    });
    if (mode === 'join') {
      track('Account Created', { signup_method: method, user_role: 'creator', primary_niche: profile.primary_niche, follower_band: profile.follower_band });
    } else {
      track('Logged In', { login_method: 'email', user_role: 'creator' });
    }
    initExperiment();
    return user_id;
  }

  // {venue_id:'VEN-DEMO-SLOT'|'VEN-DEMO-INBOX'} → user_id ('demo-manager-solace' | 'demo-manager-obsidian')
  function identifyManager(arg) {
    var venue_id = (arg && arg.venue_id) || 'VEN-DEMO-SLOT';
    var v = venueRecord(venue_id);
    if (!v || !v.manager_id) throw new Error('[TSS] identifyManager: unknown venue ' + venue_id);
    var user_id = v.manager_id;
    var att = ensureAttribution();

    switchUser(user_id);
    sendSetGroup('venue', venue_id, user_id);
    var set = {
      user_role: 'venue_manager',
      manager_role: 'marketing_manager',
      venue_id: venue_id,
      venue_name: v.venue_name,
      venue_category: v.venue_category,
      approval_style: v.approval_style,
      account_age_days: Number(v.account_age_days),
      device_type: 'ios',
      utm_source: att.utm_source, utm_medium: att.utm_medium, utm_campaign: att.utm_campaign,
      referrer: att.referrer, referring_domain: att.referring_domain
    };
    sendIdentify(set, initialProps(att), user_id);
    setSession({
      role: 'venue_manager', user_id: user_id, persona: null, display_name: v.manager_name || 'Manager', suffix: null, venue_id: venue_id,
      mode: 'login', is_returning: true, funnel_step: 0, session_started_at: Date.now(), session_ended_sent: false
    });
    track('Logged In', { login_method: 'email', user_role: 'venue_manager', venue_id: venue_id, venue_name: v.venue_name });
    initExperiment();
    return user_id;
  }

  // ---------------------------------------------------------------------------------------------
  // Attribution (SPEC §6.6) — resolved once per session; route loads drop the query string, so a stored
  // bundle is kept unless the landing URL carries all three utm parameters.
  // ---------------------------------------------------------------------------------------------
  function cleanParam(v) { v = (v === null || v === undefined) ? '' : String(v).trim(); return isEmptyValue(v) ? '' : v; }
  function hostOf(url) { try { return new URL(url).hostname; } catch (e) { return String(url || '').replace(/^https?:\/\//, '').split('/')[0]; } }
  function completeAttribution(a) {
    return !!a && ['utm_source', 'utm_medium', 'utm_campaign', 'referrer', 'referring_domain'].every(function (k) { return !isEmptyValue(a[k]); });
  }
  function fromBundle(b) {
    return { utm_source: b.utm_source, utm_medium: b.utm_medium, utm_campaign: b.utm_campaign, referrer: b.referrer, referring_domain: hostOf(b.referrer) };
  }
  function resolveAttribution() {
    var s = getSession(), att = null, q = null;
    try { q = new URLSearchParams(location.search); } catch (e) { q = null; }
    var src = cleanParam(q && q.get('utm_source')), med = cleanParam(q && q.get('utm_medium')), cmp = cleanParam(q && q.get('utm_campaign'));
    var bundles = C('ATTRIBUTION_BUNDLES') || [], fallback = C('FALLBACK_BUNDLE');
    if (src && med && cmp) {
      var match = bundles.filter(function (b) { return b && b.utm_source === src; })[0];
      var referrer = (match && match.referrer) || fallback.referrer;
      att = { utm_source: src, utm_medium: med, utm_campaign: cmp, referrer: referrer, referring_domain: hostOf(referrer) };
    } else if (completeAttribution(s.attribution)) {
      att = s.attribution;
    } else {
      att = fromBundle(fallback);
    }
    setSession({ attribution: att });
    return att;
  }
  function ensureAttribution() {
    var s = getSession();
    return completeAttribution(s.attribution) ? s.attribution : resolveAttribution();
  }

  // ---------------------------------------------------------------------------------------------
  // Experiment (SPEC §6.5) — fetch variants for the current user; never gate UI, never call exposure().
  // ---------------------------------------------------------------------------------------------
  var experimentClient = null;
  function initExperiment() {
    var key = C('EXPERIMENT_DEPLOYMENT_KEY'), flag = C('FLAG_KEY');
    var base = { status: 'initializing', variant: null, payload: null, fetch_ms: null, error: null, key_used: key, at: null };
    var t0 = now();
    function finish(patch) {
      var rec = shallowCopy(base);
      Object.keys(patch).forEach(function (k) { rec[k] = patch[k]; });
      rec.fetch_ms = Math.round(now() - t0);
      rec.at = Date.now();
      setSession({ experiment: rec });
      if (isLocal()) console.info('[TSS] experiment', rec);
      return rec;
    }
    var E = window.Experiment;
    if (!E || typeof E.initializeWithAmplitudeAnalytics !== 'function') {
      console.warn('[TSS] Experiment SDK not present');
      return Promise.resolve(finish({ status: 'error', error: 'Experiment SDK not present' }));
    }
    setSession({ experiment: base });
    var client;
    try {
      client = experimentClient = E.initializeWithAmplitudeAnalytics(key, { automaticExposureTracking: false, fetchOnStart: false });
    } catch (e) {
      console.error('[TSS] Experiment initialize failed', e);
      return Promise.resolve(finish({ status: 'error', error: errText(e) }));
    }
    return Promise.resolve()
      .then(function () { return client.fetch(); })
      .then(function () {
        var v = {};
        try { v = client.variant(flag) || {}; } catch (e) { v = {}; }
        var value = (v.value === undefined || v.value === null || v.value === '') ? null : v.value;
        return finish({ status: 'fetched', variant: value, payload: v.payload === undefined ? null : v.payload });
      }, function (e) {
        console.error('[TSS] Experiment fetch failed', e);
        return finish({ status: 'error', error: errText(e) });
      });
  }

  // ---------------------------------------------------------------------------------------------
  // Funnel + session end
  // ---------------------------------------------------------------------------------------------
  function bumpFunnel(step) {
    var n = Number(step) || 0, s = getSession();
    if (n > (Number(s.funnel_step) || 0)) setSession({ funnel_step: n });
  }
  // reason 'pagehide' | 'logout'. No-op without a role or when already sent for this session.
  function sessionEnded(reason) {
    reason = reason === 'logout' ? 'logout' : 'pagehide';
    var s = getSession();
    if (!s.role || s.session_ended_sent) return Promise.resolve(null);
    var step = Math.max(1, Math.min(5, Number(s.funnel_step) || 0));
    var started = Number(s.session_started_at) || Date.now();
    var props = {
      user_role: s.role,
      deepest_funnel_step_reached: step,
      converted: s.role === 'venue_manager' ? step >= 5 : step >= 4,
      screens_viewed: Number(s.screens_viewed) || 0,
      session_duration_seconds: Math.max(1, Math.round((Date.now() - started) / 1000))
    };
    var obj = buildEvent('session_ended', props, {});
    // Pin the identity on the event itself: the SDK stamps identity on a later task, so a logout reset()
    // (or the loader's queue replay) must not re-label this event.
    var id = identityInfo();
    if (id.user_id) obj.user_id = id.user_id;
    if (id.device_id) obj.device_id = id.device_id;
    if (id.session_id) obj.session_id = id.session_id;
    setSession({ session_ended_sent: true });
    record(obj, { reason: reason });
    return whenReady(function () {
      var a = amp();
      if (reason === 'pagehide') safeCall(a, 'setTransport', ['beacon']);
      var p = dispatchTrack(obj);
      safeCall(a, 'flush');   // flush() drains the timeline queue synchronously, so the event leaves in this task
      return p;
    });
  }
  // sessionEnded('logout') → amplitude.reset() → TSS.state.clearSession(). Caller navigates to '/'.
  function logout() {
    try { sessionEnded('logout'); } catch (e) { console.error('[TSS] session_ended (logout) failed', e); }
    whenReady(function () { safeCall(amp(), 'reset'); });
    try { if (TSS.state && typeof TSS.state.clearSession === 'function') TSS.state.clearSession(); }
    catch (e) { console.error('[TSS] state.clearSession failed', e); }
    var att = memSession.attribution, sdk = memSession.sdk;   // in-memory fallback mirrors clearSession(): keeps attribution
    memSession = freshSession();
    memSession.attribution = att; memSession.sdk = sdk;
  }

  // ---------------------------------------------------------------------------------------------
  // Init (SPEC §6.2) — three boot modes, decided by what window.amplitude is when init() runs:
  //  'stub'   the loader's queueing stub is still there: every call below is queued and replayed atomically
  //           when the SDK lands, ahead of the SDK's own init work. The verified normal path.
  //  'inline' the shell bootstrapped the SDK itself in an inline <script> right after the loader tags and left
  //           window.TSS_AMP = { sr_added, engagement_added, ready }. Only the TSS plugins are added here.
  //           (This is the only ordering that can never lose the race below — see the header comment.)
  //  'late'   the real SDK already replaced the stub, which means the second-stage loader found no queued
  //           init and ran its own: autocapture ON, cookie identity, Session Replay sampleRate 0, no opt-out.
  //           Happens when the CDN chain is cached and our page scripts wait on the fonts stylesheet.
  //           The SDK drains its pre-ready call queue exactly once during that init, so add()/setOptOut()
  //           issued meanwhile are silently lost; we therefore wait for true readiness with a probe whose
  //           setup runs synchronously only once the SDK is ready, then repair what can be repaired.
  // ---------------------------------------------------------------------------------------------
  var initialized = false, lifecycleInstalled = false;
  var bootMode = 'none';
  var deferCalls = false;                       // 'late' mode only: hold SDK calls until readiness
  var readyPromise = Promise.resolve(false);    // resolves true when the SDK is ready and our plugins are in
  var sdkFlags = null, sdkPersisted = false;

  function whenReady(fn) { return deferCalls ? readyPromise.then(function () { return fn(); }) : fn(); }
  // session.sdk is written whenever TSS.state is available (init may legitimately run before state.js loads)
  function persistSdk() {
    if (!sdkFlags) return;
    try {
      if (TSS.state && typeof TSS.state.setSession === 'function') { TSS.state.setSession({ sdk: shallowCopy(sdkFlags) }); sdkPersisted = true; }
      else memSession.sdk = shallowCopy(sdkFlags);
    } catch (e) { /* keep the in-memory flags */ }
  }
  function srPlugin() {
    return window.sessionReplay.plugin({ sampleRate: SR_OPTIONS.sampleRate, privacyConfig: { defaultMaskLevel: SR_OPTIONS.privacyConfig.defaultMaskLevel } });
  }
  function hasSR() { return !!(window.sessionReplay && typeof window.sessionReplay.plugin === 'function'); }
  function hasEngagement() { return !!(window.engagement && typeof window.engagement.plugin === 'function'); }
  function addTssPlugins(a) {
    try { a.add(geoPlugin); a.add(validationPlugin); }
    catch (e) { console.error('[TSS] TSS plugins failed to register', e); }
  }
  function isSessionReplayPluginArg(x) {
    return !!x && typeof x === 'object' && (x._STUBBED_PLUGIN_NAME === 'sr' || x.name === SR_PLUGIN_NAME);
  }
  // Stub present: drop any loader-queued init / sampleRate-0 Session Replay add so ours are the only ones.
  function guardLoaderQueue(a) {
    var kept = [], dropped = 0;
    a._q.forEach(function (item) {
      var foreignInit = item && item.name === 'init';
      var foreignSR = item && item.name === 'add' && Array.isArray(item.args) && item.args.some(isSessionReplayPluginArg);
      if (foreignInit || foreignSR) {
        dropped++;
        if (typeof item.resolve === 'function') { try { item.resolve(); } catch (e) { /* ignore */ } }
      } else kept.push(item);
    });
    if (dropped) {
      a._q.length = 0;
      kept.forEach(function (i) { a._q.push(i); });
      console.warn('[TSS] dropped ' + dropped + ' loader-queued Amplitude call(s) so TSS.analytics.init() controls init and Session Replay');
    }
  }
  function initStub(a) {
    guardLoaderQueue(a);
    try { if (hasSR()) { a.add(srPlugin()); sdkFlags.sr_added = true; } else console.warn('[TSS] window.sessionReplay not present — no Session Replay plugin added'); }
    catch (e) { console.error('[TSS] Session Replay plugin failed', e); }
    try { if (hasEngagement()) { a.add(window.engagement.plugin()); sdkFlags.engagement_added = true; } else console.warn('[TSS] window.engagement not present — no Guides & Surveys plugin added'); }
    catch (e) { console.error('[TSS] Engagement plugin failed', e); }
    addTssPlugins(a);
    var r = null;
    try { r = a.init(C('API_KEY'), shallowCopy(INIT_OPTIONS)); }
    catch (e) { console.error('[TSS] amplitude.init threw', e); }
    if (isLocal()) { safeCall(a, 'setOptOut', [true]); console.info('[TSS] localhost: Amplitude opt-out, events logged only'); }
    return promiseOf(r).then(function () { return true; }, function (e) { console.error('[TSS] amplitude.init failed', e); return false; });
  }
  function initInline(a, boot) {
    sdkFlags.sr_added = !!boot.sr_added;
    sdkFlags.engagement_added = !!boot.engagement_added;
    var isStub = Array.isArray(a._q) && typeof a.runQueuedFunctions !== 'function';
    if (isStub) addTssPlugins(a);            // queued behind the inline init → registered before the SDK is ready
    if (isLocal()) console.info('[TSS] localhost: Amplitude opt-out, events logged only');
    return Promise.resolve(boot.ready).then(function () {
      if (!isStub) addTssPlugins(a);         // SDK already ready → registers immediately
      if (isLocal()) safeCall(a, 'setOptOut', [true]);
      return true;
    }, function (e) { console.error('[TSS] inline amplitude.init failed', e); return false; });
  }
  // Resolves true once add() runs a plugin's setup synchronously — which the SDK only does when it is ready.
  function awaitSdkReady(a) {
    return new Promise(function (resolve) {
      var n = 0, probes = [], timer = null, done = false;
      function finish(ok) {
        if (done) return;
        done = true;
        if (timer) clearInterval(timer);
        // every probe that got registered (synchronously now, or earlier through the SDK's own queue drain) goes
        probes.forEach(function (p) { if (p.registered) safeCall(a, 'remove', [p.name]); });
        resolve(ok);
      }
      function attempt() {
        if (done) return;
        n++;
        var probe = {
          name: 'tss-ready-probe-' + n, type: 'enrichment', registered: false,
          setup: function () { probe.registered = true; return Promise.resolve(); },
          execute: function (e) { return Promise.resolve(e); }
        };
        probes.push(probe);
        try { a.add(probe); } catch (e) { /* ignore */ }
        if (probe.registered) { finish(true); return; }   // setup ran inside add() itself → the SDK is ready
        if (n >= 80) { console.error('[TSS] Amplitude SDK did not become ready within 20 s'); finish(false); }
      }
      attempt();
      if (!done) timer = setInterval(attempt, 25);   // readiness usually lands within a few hundred ms; poll tightly
    });
  }
  function initLate(a) {
    sdkFlags.loader_won_race = true;
    deferCalls = true;
    if (isLocal()) safeCall(a, 'setOptOut', [true]);   // speculative: lands at once if the SDK is already ready
    console.error('[TSS] Amplitude was initialised by the CDN loader before TSS.analytics.init() ran (the page scripts loaded after the cached SDK). The loader init has autocapture ON, cookie identity and Session Replay sampleRate 0. Recovering: waiting for the SDK, removing autocapture plugins, re-adding Session Replay (sampleRate 1, medium masking) and the TSS plugins' + (isLocal() ? ', forcing localhost opt-out' : '') + '. Permanent fix: bootstrap Amplitude in an inline <script> right after the loader tags in the shell <head> (window.TSS_AMP, see the analytics.js header).');
    return awaitSdkReady(a).then(function (ok) {
      if (!ok) { deferCalls = false; return false; }
      AUTOCAPTURE_PLUGINS.forEach(function (n) { safeCall(a, 'remove', [n]); });
      var p = Promise.resolve();
      if (hasSR()) {
        p = promiseOf(safeCall(a, 'remove', [SR_PLUGIN_NAME])).then(function () {
          try { a.add(srPlugin()); sdkFlags.sr_added = true; } catch (e) { console.error('[TSS] Session Replay plugin failed', e); }
        });
      }
      try { if (hasEngagement()) { a.add(window.engagement.plugin()); sdkFlags.engagement_added = true; } }
      catch (e) { console.error('[TSS] Engagement plugin failed', e); }
      addTssPlugins(a);
      if (isLocal()) { safeCall(a, 'setOptOut', [true]); console.info('[TSS] localhost: Amplitude opt-out, events logged only'); }
      return p.then(function () { deferCalls = false; return true; }, function () { deferCalls = false; return true; });
    });
  }
  function installLifecycle() {
    if (lifecycleInstalled) return;
    lifecycleInstalled = true;
    window.addEventListener('pagehide', function () {
      try { sessionEnded('pagehide'); } catch (e) { console.error('[TSS] session_ended (pagehide) failed', e); }
    });
    window.addEventListener('pageshow', function () { whenReady(function () { safeCall(amp(), 'setTransport', ['fetch']); }); });
  }
  function init() {
    if (initialized) return TSS.analytics.ready;
    initialized = true;
    installLifecycle();
    var a = amp();
    sdkFlags = { sr_added: false, sr_sample_rate: SR_OPTIONS.sampleRate, engagement_added: false, analytics_ready: false, boot_mode: 'none', loader_won_race: false };
    if (!a) {
      console.error('[TSS] window.amplitude missing — the unified loader did not run; analytics disabled');
      persistSdk();
      TSS.analytics.ready = readyPromise = Promise.resolve(false);
      return TSS.analytics.ready;
    }
    var boot = window.TSS_AMP;
    var isStub = Array.isArray(a._q) && typeof a.runQueuedFunctions !== 'function';
    bootMode = (boot && typeof boot === 'object' && boot.ready) ? 'inline' : (isStub ? 'stub' : 'late');
    sdkFlags.boot_mode = bootMode;
    console.info('[TSS] analytics.init: boot mode ' + bootMode);
    readyPromise = bootMode === 'inline' ? initInline(a, boot) : bootMode === 'stub' ? initStub(a) : initLate(a);
    persistSdk();
    TSS.analytics.ready = readyPromise.then(function (ok) {
      sdkFlags.analytics_ready = !!ok;
      persistSdk();
      return !!ok;
    });
    return TSS.analytics.ready;
  }

  // ---------------------------------------------------------------------------------------------
  TSS.analytics = {
    init: init,
    track: track,
    pageView: pageView,
    identifyBlogger: identifyBlogger,
    identifyManager: identifyManager,
    resolveAttribution: resolveAttribution,
    initExperiment: initExperiment,
    bumpFunnel: bumpFunnel,
    sessionEnded: sessionEnded,
    logout: logout,
    getDebugLog: getDebugLog,
    validate: validate,
    identityInfo: identityInfo,
    geoPlugin: geoPlugin,
    validationPlugin: validationPlugin,
    // extras (own namespace, not in the shared contract)
    ready: Promise.resolve(false),         // resolves true once amplitude.init() has completed
    clearDebugLog: clearDebugLog,
    uuid: uuid,
    getExperimentClient: function () { return experimentClient; }
  };
})();
