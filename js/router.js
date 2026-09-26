/* router.js — The Secret Society demo · History-API router + screen registry (TSS.router, TSS.screens).
   Contract: ARCHITECTURE.md §7. Plain ES2019 browser JS, no modules.

   TSS.screens.<key> = { role, tab, tabbar, title(params), venueGroup(params), tracked, render(params), mount(params, root) }
   Render sequence per NAVIGATION (start / navigate / popstate): resolve route (unknown → notFound) → role guard →
   document.title → Page Viewed via TSS.analytics.pageView (skipped when tracked === false) → run the previous
   mount's cleanup → TSS.ui.render → #screen scrollTop 0 → mount. refresh() re-renders WITHOUT Page Viewed and keeps
   the scroll position. Clicks on [data-nav] navigate, [data-back] go back; nested interactive children (e.g. the
   heart button inside a media card) are left alone. */
window.TSS = window.TSS || {};
(function () {
  'use strict';
  var TSS = window.TSS;
  TSS.screens = TSS.screens || {};
  var router = TSS.router = TSS.router || {};

  var ROUTES = [
    ['/', 'welcome'], ['/signup', 'signup'], ['/login', 'login'],
    ['/events', 'explore'], ['/events/category/:slug', 'category'], ['/search', 'search'],
    ['/events/:offer_id', 'offer'], ['/events/:offer_id/apply', 'apply'],
    ['/invites', 'invites'], ['/invites/:invite_id', 'invite'], ['/invites/:invite_id/slots', 'slots'], ['/invites/:invite_id/accepted', 'accepted'], ['/invites/:invite_id/checkin', 'checkin'],
    ['/collabs/:invite_id/deliverables', 'deliverables'], ['/profile', 'profile'],
    ['/venue/login', 'venueLogin'], ['/venue/dashboard', 'venueDashboard'], ['/venue/offers/:offer_id/calendar', 'venueCalendar'], ['/venue/applications', 'venueApplications'], ['/venue/checkin', 'venueCheckin'], ['/venue/collabs/:invite_id/review', 'venueReview'], ['/venue/profile', 'venueProfile'], ['/venue/fix/seat-at-approval', 'venueFix'],
    ['/debug', 'debug']
  ];

  var compiled = null;
  var started = false;
  var depth = 0;            // history entries pushed by this app (from history.state.idx) — back() falls back to a parent route at 0
  var cur = { path: '/', params: {}, screenKey: null };
  var cleanup = null;       // the current screen's mount cleanup
  var renderSeq = 0;        // re-entrancy token: a mount that navigates must not leak its cleanup onto the next screen
  var rendering = false;
  var pendingRefresh = false;

  function base() { return (TSS.config && TSS.config.BASE) || '/tss-demo'; }
  function appName() { return (TSS.config && TSS.config.APP_NAME) || 'The Secret Society'; }
  function log(err, what) { if (window.console) console.error('[TSS] router: ' + what, err); }

  function compile() {
    compiled = ROUTES.map(function (r) {
      var keys = [];
      var src = r[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\/:([A-Za-z_]+)/g, function (m, k) { keys.push(k); return '/([^/]+)'; });
      return { pattern: r[0], key: r[1], keys: keys, re: new RegExp('^' + src + '$') };
    });
  }

  // '/tss-demo/events/' → '/events'; '/tss-demo' → '/'; full URLs and base-prefixed paths are accepted.
  function normalize(path) {
    path = String(path === undefined || path === null ? '/' : path);
    if (/^https?:\/\//i.test(path)) { try { path = new URL(path).pathname; } catch (e) { /* keep */ } }
    path = path.split('?')[0].split('#')[0];
    var b = base();
    if (path === b || path.indexOf(b + '/') === 0) path = path.slice(b.length);
    if (!path) path = '/';
    if (path.charAt(0) !== '/') path = '/' + path;
    path = path.replace(/\/index\.html$/i, '/');
    if (path.length > 1) path = path.replace(/\/+$/, '');
    return path || '/';
  }
  function currentPath() { return normalize(location.pathname); }
  function urlFor(path) { return path === '/' ? base() + '/' : base() + path; }

  function resolve(path) {
    if (!compiled) compile();
    for (var i = 0; i < compiled.length; i++) {
      var m = compiled[i].re.exec(path);
      if (!m) continue;
      var params = {};
      compiled[i].keys.forEach(function (k, j) {
        var v = m[j + 1];
        try { v = decodeURIComponent(v); } catch (e) { /* keep raw */ }
        params[k] = v;
      });
      return { key: compiled[i].key, params: params, pattern: compiled[i].pattern };
    }
    return { key: 'notFound', params: { path: path }, pattern: null };
  }

  function session() { try { return TSS.state.getSession(); } catch (e) { return null; } }

  function runCleanup() {
    var c = cleanup;
    cleanup = null;
    if (typeof c === 'function') { try { c(); } catch (e) { log(e, 'cleanup failed'); } }
  }

  // isNav: true for start / navigate / popstate (Page Viewed + scroll reset); false for refresh().
  function render(path, isNav) {
    var match = resolve(path);
    var key = match.key;
    var params = match.params;
    var screen = TSS.screens[key];
    if (!screen) {
      params = { path: path, missing: key === 'notFound' ? null : key };
      key = 'notFound';
      screen = TSS.screens.notFound;
    }
    if (!screen) {
      document.getElementById('screen').innerHTML = '<div class="section pad-top"><p class="mt-10">Screen "' + (match.key || '') + '" is not available.</p></div>';
      return;
    }
    // Role guard: creator screens need a creator session, venue screens a venue_manager session.
    var need = screen.role || 'any';
    if (need !== 'any') {
      var s = session();
      if (!s || s.role !== need) {
        navigate(need === 'creator' ? '/login' : '/venue/login', { replace: true });
        return;
      }
    }
    var title = '';
    try { title = typeof screen.title === 'function' ? screen.title(params) : (screen.title || key); } catch (e) { log(e, 'title failed'); title = key; }
    title = String(title || key);
    document.title = title + ' · ' + appName();

    var groups;
    if (typeof screen.venueGroup === 'function') {
      try { var vg = screen.venueGroup(params); if (vg) groups = { venue: vg }; } catch (e) { log(e, 'venueGroup failed'); }
    }
    if (isNav && screen.tracked !== false) {
      try { TSS.analytics.pageView({ path: base() + path, title: title, groups: groups }); }
      catch (e) { log(e, 'pageView failed'); }
    }

    rendering = true;
    var token = ++renderSeq;
    runCleanup();
    var root = document.getElementById('screen');
    var keepScroll = isNav ? 0 : root.scrollTop;
    TSS.ui.render(screen, params, key);
    root.scrollTop = keepScroll;
    cur = { path: path, params: params, screenKey: key };
    var c = null;
    if (typeof screen.mount === 'function') {
      try { c = screen.mount(params, root); } catch (e) { log(e, 'mount failed (' + key + ')'); }
    }
    if (token === renderSeq) {
      if (typeof c === 'function') cleanup = c;
    } else if (typeof c === 'function') {
      // the mount navigated away already — its screen is gone, so retire its cleanup right now
      try { c(); } catch (e) { log(e, 'stale cleanup failed'); }
    }
    rendering = false;
    if (pendingRefresh) { pendingRefresh = false; refresh(); }
  }

  function navigate(path, opts) {
    opts = opts || {};
    path = normalize(path);
    if (started && !opts.replace && path === cur.path && !opts.force) {
      var root = document.getElementById('screen');
      if (root) root.scrollTop = 0;   // tapping the active tab: scroll to top, no new Page Viewed
      return;
    }
    try {
      if (opts.replace) history.replaceState({ idx: depth }, '', urlFor(path));
      else { depth += 1; history.pushState({ idx: depth }, '', urlFor(path)); }
    } catch (e) { log(e, 'history update failed'); }
    if (TSS.ui && TSS.ui.sheet) TSS.ui.sheet.close();
    render(path, true);
  }

  function refresh() {
    if (rendering) { pendingRefresh = true; return; }
    render(cur.path, false);
  }

  function current() { return { path: cur.path, params: Object.assign({}, cur.params), screenKey: cur.screenKey }; }

  // Parent route for back() when there is nothing to pop: drop path segments until a registered screen matches,
  // else the role's tab root, else welcome.
  function parentOf(path) {
    var screen = TSS.screens[cur.screenKey] || {};
    var parts = path.split('/').filter(Boolean);
    while (parts.length > 1) {
      parts.pop();
      var candidate = '/' + parts.join('/');
      var m = resolve(candidate);
      if (m.key !== 'notFound' && TSS.screens[m.key]) return candidate;
    }
    if (screen.tabbar === 'venue') return '/venue/dashboard';
    if (screen.tabbar === 'creator') return '/events';
    return '/';
  }
  function back() {
    if (depth > 0) { history.back(); return; }
    navigate(parentOf(cur.path), { replace: true });
  }

  function onPopState(e) {
    depth = e.state && typeof e.state.idx === 'number' ? e.state.idx : 0;
    if (TSS.ui && TSS.ui.sheet) TSS.ui.sheet.close();
    render(currentPath(), true);
  }

  function onClick(e) {
    if (e.defaultPrevented || e.button !== 0) return;
    var t = e.target;
    if (!t || typeof t.closest !== 'function') return;
    var el = t.closest('[data-nav],[data-back]');
    if (!el) return;
    // a nested control inside a navigating card (heart, stepper, action button) handles itself
    var inner = t.closest('button,a,input,textarea,select,label,[data-save],[data-action]');
    if (inner && inner !== el && el.contains(inner) && !inner.hasAttribute('data-nav') && !inner.hasAttribute('data-back')) return;
    if ((e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) && el.tagName === 'A') return;   // let the browser open a new tab
    e.preventDefault();
    if (el.hasAttribute('data-back')) back();
    else navigate(el.getAttribute('data-nav'));
  }
  function onKeyDown(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var t = e.target;
    if (!t || typeof t.closest !== 'function') return;
    if (/^(A|BUTTON|INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    var el = t.closest('[data-nav],[data-back]');
    if (!el || el !== t) return;
    e.preventDefault();
    if (el.hasAttribute('data-back')) back();
    else navigate(el.getAttribute('data-nav'));
  }

  function start() {
    if (started) return;
    started = true;
    if (!compiled) compile();
    try {
      if (!history.state || typeof history.state.idx !== 'number') history.replaceState({ idx: 0 }, '', location.href);
      depth = history.state && typeof history.state.idx === 'number' ? history.state.idx : 0;
    } catch (e) { depth = 0; }
    window.addEventListener('popstate', onPopState);
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeyDown);
    render(currentPath(), true);
  }

  router.ROUTES = ROUTES;
  router.start = start;
  router.navigate = navigate;
  router.refresh = refresh;
  router.current = current;
  router.back = back;
  router.resolve = resolve;
  router.normalize = normalize;
})();
