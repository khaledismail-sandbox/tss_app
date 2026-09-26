/* ui.js — The Secret Society demo · shared renderers (TSS.ui).
   Contract: ARCHITECTURE.md §8. Plain ES2019 browser JS, no modules. Every renderer returns an HTML
   string unless stated otherwise (render / renderWide / sheet / toast touch the DOM).
   Markup for the status bar, "Hi, name" pill, circular icon buttons, tab bars and the bottom sheet is
   copied from the approved style tile (debug/style/index.html) so the app matches it exactly.
   Nothing here reads TSS.config / TSS.state / TSS.data at load time — only inside functions — so the
   file is safe to load before (or without) the data modules.

   Notes for screen authors:
   · text you pass to tag() / chip() / listRow() / sheet.open() / header({title}) is treated as HTML so
     you can include <span class="sep">•</span>; escape user-derived strings with TSS.ui.escape().
   · sheet.open({onClose}) — onClose(reason) fires ONLY when the viewer dismisses the sheet
     (reason 'backdrop' | 'esc'); TSS.ui.sheet.close() never calls it, so a primary-button handler can
     do its work and then close() without running twice.
   · toast() uses textContent (never HTML). */
window.TSS = window.TSS || {};
(function () {
  'use strict';
  var TSS = window.TSS;
  var ui = TSS.ui = TSS.ui || {};

  var SEP = '<span class="sep">•</span>';

  /* ---------- helpers ---------- */
  function base() { return (TSS.config && TSS.config.BASE) || '/tss-demo'; }
  function escape(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function has(v) { return v !== undefined && v !== null && v !== '' && v !== false && v !== 0; }
  function dataAttrs(obj) {
    if (!obj) return '';
    return Object.keys(obj).map(function (k) { return ' data-' + escape(k) + '="' + escape(obj[k]) + '"'; }).join('');
  }
  function icon(name, size, stroke) { return window.tssIcon ? window.tssIcon(name, size, stroke) : ''; }
  function money(n) {
    var v = Number(n);
    if (!isFinite(v)) v = 0;
    var whole = Math.floor(Math.abs(v));
    var s = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    var frac = Math.round((Math.abs(v) - whole) * 100) / 100;
    if (frac > 0) s += String(frac).slice(1);
    return ((TSS.config && TSS.config.CURRENCY) || 'AED') + ' ' + (v < 0 ? '-' : '') + s;
  }
  function safe(fn, fallback) { try { return fn(); } catch (e) { return fallback; } }
  function capitalize(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }

  /* ---------- status bar (style tile: "9:41" + signal / wifi / battery) ---------- */
  function statusbar() {
    return window.tssStatusBar ? window.tssStatusBar('9:41') : '<span class="statusbar-time">9:41</span>';
  }
  function ensureStatusbar() {
    var sb = document.getElementById('statusbar');
    if (sb && !sb.firstChild) sb.innerHTML = statusbar();
  }

  /* ---------- "Hi, Sara ⌄" pill ---------- */
  function headerPill(o) {
    o = o || {};
    var tag = o.nav ? 'button' : 'div';
    var attrs = ' class="header-pill"' + (o.nav ? ' type="button" data-nav="' + escape(o.nav) + '"' : '') + (o.id ? ' id="' + escape(o.id) + '"' : '');
    return '<' + tag + attrs + '>' +
      '<span class="header-pill-avatar">' + icon(o.icon || 'user-round', 27) + '</span>' +
      'Hi, ' + escape(o.name || '') +
      (o.chevron ? icon('chevron-down', 16) : '') +
      '</' + tag + '>';
  }

  /* ---------- ⌀50 circular icon button ---------- */
  // Glyph boxes per the tile: search 26, bell 22 bold, back arrow 28 'back', pencil 24, menu 26.
  var ICON_BTN_SPEC = { bell: [22, 'bold'], 'arrow-left': [28, 'back'], pencil: [24], x: [24, 'bold'], heart: [17, 'bold'], server: [15] };
  function iconBtn(name, o) {
    o = o || {};
    if (o.back && !name) name = 'arrow-left';
    var spec = ICON_BTN_SPEC[name] || [26];
    var label = o.label || (o.back ? 'Back' : capitalize(String(name).replace(/-/g, ' ')));
    var attrs = ' class="icon-btn' + (o.cls ? ' ' + o.cls : '') + '" type="button" aria-label="' + escape(label) + '"';
    if (o.back) attrs += ' data-back="1"';
    else if (o.nav) attrs += ' data-nav="' + escape(o.nav) + '"';
    if (o.id) attrs += ' id="' + escape(o.id) + '"';
    if (o.disabled) attrs += ' disabled';
    attrs += dataAttrs(o.data);
    var badge = has(o.badge) ? '<span class="icon-btn-badge">' + escape(o.badge) + '</span>' : '';
    return '<button' + attrs + '>' + icon(name, spec[0], spec[1]) + badge + '</button>';
  }

  /* ---------- header rows ---------- */
  // left: 'pill' (name, icon, chevron) | 'back' (title, badge) | 'title' (title, badge; large for the 68-top variant) | raw html
  function header(o) {
    o = o || {};
    var cls = 'header' + (o.large ? ' is-large' : '') + (o.overlay ? ' is-overlay' : '') + (o.cls ? ' ' + o.cls : '');
    var badge = has(o.badge) ? '<span class="badge">' + escape(o.badge) + '</span>' : '';
    var left = '';
    if (o.left === 'back') {
      left = iconBtn('arrow-left', { back: true, label: 'Back' }) +
        '<span class="header-group"><span class="header-back-title">' + (o.title || '') + '</span>' + badge + '</span>';
    } else if (o.left === 'title') {
      left = '<span class="header-group"><h1 class="header-title">' + (o.title || '') + '</h1>' + badge + '</span>';
    } else if (o.left === 'pill') {
      left = headerPill({ name: o.name, icon: o.icon, chevron: o.chevron !== false, nav: o.nav });
    } else if (o.left) {
      left = o.left;
    }
    return '<div class="' + cls + '">' + left + '<span class="grow"></span>' + (o.actions || []).join('') + '</div>';
  }

  /* ---------- tab bars ---------- */
  var TABS = {
    creator: [
      ['explore', 'zap-square', 'Explore', '/events'],
      ['search', 'search', 'Search', '/search'],
      ['invites', 'ticket', 'Invites', '/invites'],
      ['profile', 'user-round', 'Profile', '/profile']
    ],
    venue: [
      ['dashboard', 'layout-grid', 'Dashboard', '/venue/dashboard'],
      ['applications', 'inbox', 'Applications', '/venue/applications'],
      ['checkin', 'qr-code', 'Check-in', '/venue/checkin'],
      ['venue-profile', 'user-round', 'Profile', '/venue/profile']
    ]
  };
  // .tab-dot when the current user has something waiting: a pending invite (creator) / pending application (venue)
  function tabDots(kind) {
    var dots = {};
    try {
      var s = TSS.state.getSession();
      if (kind === 'creator' && s.user_id) {
        var inv = TSS.state.invitesFor(s.user_id) || [];
        if (inv.some(function (i) { return i.status === 'pending'; })) dots.invites = true;
      }
      if (kind === 'venue' && s.venue_id) {
        if ((TSS.state.pendingFor(s.venue_id) || []).length) dots.applications = true;
      }
    } catch (e) { /* state not available yet */ }
    return dots;
  }
  function tabbar(kind, active) {
    var tabs = TABS[kind];
    if (!tabs) return '';
    var dots = tabDots(kind);
    return tabs.map(function (t) {
      var on = t[0] === active;
      return '<a class="tab' + (on ? ' is-active' : '') + '" href="' + escape(base() + t[3]) + '" data-nav="' + escape(t[3]) + '" data-tab="' + t[0] + '"' + (on ? ' aria-current="page"' : '') + '>' +
        '<span class="tab-icon">' + icon(t[1], 26) + (dots[t[0]] ? '<span class="tab-dot"></span>' : '') + '</span>' + t[2] + '</a>';
    }).join('');
  }

  /* ---------- screen rendering ---------- */
  function keyOf(screen) {
    var S = TSS.screens || {};
    for (var k in S) if (S[k] === screen) return k;
    return '';
  }
  function errorCard(err) {
    return '<div class="section pad-top"><div class="card mt-10"><div class="card-title">This screen hit an error</div>' +
      '<div class="card-meta mt-2 mono">' + escape(err && err.message ? err.message : String(err)) + '</div></div></div>';
  }
  function exitWide() {
    var app = document.getElementById('app');
    if (!app) return;
    app.classList.remove('is-wide');
    var w = document.getElementById('wide');
    if (w && w.parentNode) w.parentNode.removeChild(w);
    var wt = document.getElementById('wide-toast');
    if (wt && wt.parentNode) wt.parentNode.removeChild(wt);
  }
  // Sets #screen, toggles .has-tabbar / .is-<key>, renders the tab bar (hidden when screen.tabbar is null),
  // renders the status bar once. Returns the #screen element. Never throws on a failing screen.
  function render(screen, params, key) {
    exitWide();
    ensureStatusbar();
    var root = document.getElementById('screen');
    var html = '';
    try { html = screen.render(params) || ''; }
    catch (e) { if (window.console) console.error('[TSS] screen render failed', e); html = errorCard(e); }
    root.innerHTML = html;
    key = key || keyOf(screen);
    root.className = 'screen' + (screen.tabbar ? ' has-tabbar' : '') + (key ? ' is-' + key : '');
    var tb = document.getElementById('tabbar');
    if (tb) {
      if (screen.tabbar && TABS[screen.tabbar]) {
        tb.innerHTML = tabbar(screen.tabbar, screen.tab);
        tb.setAttribute('aria-label', screen.tabbar === 'venue' ? 'Venue manager' : 'Creator');
        tb.hidden = false;
      } else {
        tb.innerHTML = '';
        tb.hidden = true;
      }
    }
    return root;
  }
  // Debug: #app becomes `stage is-wide`, the phone is hidden (css/screens.css) and html fills a desktop container.
  function renderWide(html) {
    var app = document.getElementById('app');
    app.classList.add('is-wide');
    var w = document.getElementById('wide');
    if (!w) {
      w = document.createElement('div');
      w.id = 'wide';
      w.className = 'wide';
      app.appendChild(w);
    }
    w.innerHTML = html;
    var tb = document.getElementById('tabbar');
    if (tb) tb.hidden = true;
    return w;
  }

  /* ---------- small pieces ---------- */
  function tag(text, kind) {
    var cls = 'tag' + (kind && kind !== 'outline' ? ' tag-' + kind : '');
    return '<span class="' + cls + '">' + (text || '') + '</span>';
  }
  function chip(text, o) {
    o = o || {};
    var attrs = ' class="chip' + (o.active ? ' is-active' : '') + (o.cls ? ' ' + o.cls : '') + '" type="button"';
    if (o.nav) attrs += ' data-nav="' + escape(o.nav) + '"';
    if (o.id) attrs += ' id="' + escape(o.id) + '"';
    if (o.active) attrs += ' aria-pressed="true"';
    attrs += dataAttrs(o.data);
    return '<button' + attrs + '>' + (o.icon ? icon(o.icon, 17) : '') + (text || '') +
      (has(o.badge) ? '<span class="chip-badge">' + escape(o.badge) + '</span>' : '') + '</button>';
  }
  function artThumb(art, o) {
    o = o || {};
    var size = o.size === 'sm' ? ' is-sm' : o.size === 'lg' ? ' is-lg' : '';
    return '<div class="avatar art art-' + escape(art || 'nightlife') + (o.portrait ? ' art-portrait' : '') + size + (o.cls ? ' ' + escape(o.cls) : '') + '">' +
      (o.checked ? '<span class="check-badge">' + icon('check', 14, 'badge') + '</span>' : '') + '</div>';
  }
  // Generic button (not in the contract, handy for screens): TSS.ui.button('Apply', {cls:'btn-primary btn-block', nav:'/x'})
  function button(label, o) {
    o = o || {};
    var attrs = ' class="btn ' + (o.cls || 'btn-secondary') + '" type="button"';
    if (o.back) attrs += ' data-back="1"';
    else if (o.nav) attrs += ' data-nav="' + escape(o.nav) + '"';
    if (o.id) attrs += ' id="' + escape(o.id) + '"';
    if (o.disabled) attrs += ' disabled';
    attrs += dataAttrs(o.data);
    return '<button' + attrs + '>' + (o.icon ? icon(o.icon, 18) : '') + (o.html ? label : escape(label)) + '</button>';
  }

  /* ---------- cards ---------- */
  function offerBits(offer) {
    return {
      venue: safe(function () { return TSS.data.venue(offer.venue_id); }, null),
      cat: safe(function () { return TSS.data.categoryBySlug(offer.category_slug); }, null),
      avail: safe(function () { return TSS.state.offerAvailability(offer.offer_id); }, null)
    };
  }
  // Explore event card: art, heart (data-save), title, venue • category, value tag, seats left
  function mediaCard(offer, o) {
    o = o || {};
    offer = offer || {};
    var b = offerBits(offer);
    var venueName = b.venue ? b.venue.venue_name : (offer.venue_name || '');
    var catName = b.cat ? b.cat.name : (offer.venue_category || '');
    var nav = o.nav || ('/events/' + offer.offer_id);
    var liked = !!o.liked;
    var seats = null;
    if (offer.demo === false || !(offer.slots && offer.slots.length)) {
      if (typeof offer.availability_seats === 'number') seats = offer.availability_seats;
    } else if (b.avail && typeof b.avail.seats_left === 'number') {
      seats = b.avail.seats_left;
    }
    var right = seats === null ? 'Applications closed' : seats + ' seats left';
    return '<article class="media-card" data-nav="' + escape(nav) + '" data-offer="' + escape(offer.offer_id) + '" role="link" tabindex="0">' +
      '<div class="media-card-img"><div class="art art-' + escape(offer.art || 'nightlife') + '"></div>' +
      '<button class="heart-btn' + (liked ? ' is-liked' : '') + '" type="button" data-save="' + escape(offer.offer_id) + '" aria-label="' + (liked ? 'Saved' : 'Save') + '" aria-pressed="' + (liked ? 'true' : 'false') + '">' + icon('heart', 17, 'bold') + '</button></div>' +
      '<div class="media-card-body">' +
      '<h3 class="media-card-title">' + escape(offer.experience_name) + '</h3>' +
      '<div class="media-card-meta">' + escape(venueName) + SEP + escape(catName) + '</div>' +
      '<div class="media-card-foot"><span class="tag tag-teal">' + escape(money(offer.experience_value)) + ' experience' +
      (offer.credits_per_guest ? SEP + escape(offer.credits_per_guest) + ' credits / guest' : '') + '</span>' +
      '<span class="t-meta-sm">' + right + '</span></div>' +
      '</div></article>';
  }
  function slotOf(offer, slotId) {
    if (!offer || !slotId) return null;
    var slots = offer.slots || [];
    for (var i = 0; i < slots.length; i++) if (slots[i].slot_id === slotId) return slots[i];
    return safe(function () { return TSS.data.slotById(slotId); }, null);
  }
  // Invite card: thumb · title · meta · status tag + CTA (per invite.status)
  function inviteCard(invite, offer, venue, o) {
    o = o || {};
    invite = invite || {};
    offer = offer || {};
    venue = venue || {};
    var id = invite.invite_id;
    var nav = o.nav || ('/invites/' + id);
    var slotId = invite.accepted_slot_id || (invite.slot_id && invite.slot_id !== 'unassigned' ? invite.slot_id : null);
    var slot = slotOf(offer, slotId);
    var shortLabel = slot ? safe(function () { return TSS.data.slotLabel(slot); }, slotId) : '';
    var longLabel = slot ? safe(function () { return TSS.data.slotLabelLong(slot); }, slotId) : '';
    var meta = escape(venue.venue_name || '') + SEP + (longLabel ? escape(longLabel) : 'Pick your slot');
    var status = '', cta = '';
    switch (invite.status) {
      case 'pending':
        status = invite.seat_reserved ? tag(escape(shortLabel) + ' — seat reserved', 'teal') : tag('Pick your slot', 'outline');
        cta = button('View invite', { cls: 'btn-primary btn-sm', nav: nav });
        break;
      case 'accepted':
        status = tag('Accepted' + SEP + escape(shortLabel), 'teal');
        cta = button('Check-in code', { cls: 'btn-primary btn-sm', nav: '/invites/' + id + '/checkin' });
        break;
      case 'abandoned':
        status = tag('Slot unavailable', 'red');
        break;
      case 'checked_in':
        status = tag('Checked in', 'teal-solid');
        cta = button('Deliverables', { cls: 'btn-secondary btn-sm', nav: '/collabs/' + id + '/deliverables' });
        break;
      default:
        status = tag(escape(invite.status || 'invite'), 'outline');
    }
    return '<article class="card invite-card" data-nav="' + escape(nav) + '" data-invite="' + escape(id) + '" role="link" tabindex="0">' +
      '<div class="thumb art art-' + escape(offer.art || venue.art || 'nightlife') + '"></div>' +
      '<div class="invite-card-body">' +
      '<h3 class="card-title">' + escape(offer.experience_name || 'Invite') + '</h3>' +
      '<div class="card-meta">' + meta + '</div>' +
      '<div class="invite-card-actions">' + status + cta + '</div>' +
      '</div></article>';
  }
  // To Review-style row: avatar · title / sub / meta · action (html)
  function listRow(o) {
    o = o || {};
    var avatar = o.avatarArt ? artThumb(o.avatarArt, { portrait: o.portrait !== false, checked: !!o.checked }) : '';
    var attrs = ' class="list-row' + (o.cls ? ' ' + escape(o.cls) : '') + '"' + (o.id ? ' id="' + escape(o.id) + '"' : '') + (o.nav ? ' data-nav="' + escape(o.nav) + '"' : '') + dataAttrs(o.data);
    return '<div' + attrs + '>' + avatar +
      '<div class="list-row-body"><div class="list-row-title">' + (o.title || '') + '</div>' +
      (o.sub ? '<div class="list-row-sub">' + o.sub + '</div>' : '') +
      (o.meta ? '<div class="list-row-meta">' + o.meta + '</div>' : '') + '</div>' +
      (o.action ? '<div class="list-row-action">' + o.action + '</div>' : '') +
      '</div>';
  }

  /* ---------- bottom sheet (style tile section 09) ---------- */
  var sheet = (function () {
    var state = null, seq = 0;
    function root() { return document.getElementById('sheet-root'); }
    function onKey(e) { if (e.key === 'Escape' && state && state.dismissible) dismiss('esc'); }
    function close() {
      if (!state) return;
      document.removeEventListener('keydown', onKey);
      var r = root();
      if (r) { r.classList.remove('is-open'); r.innerHTML = ''; }
      state = null;
    }
    function dismiss(reason) {
      var cb = state && state.onClose;
      close();
      if (typeof cb === 'function') { try { cb(reason || 'dismiss'); } catch (e) { if (window.console) console.error('[TSS] sheet onClose failed', e); } }
    }
    function open(o) {
      o = o || {};
      close();
      var r = root();
      if (!r) return null;
      var tid = 'sheet-title-' + (++seq);
      var html = '<div class="sheet-backdrop" data-sheet-backdrop></div>' +
        '<div class="sheet" role="dialog" aria-modal="true"' + (o.title ? ' aria-labelledby="' + tid + '"' : '') + (o.cls ? ' data-kind="' + escape(o.cls) + '"' : '') + '>' +
        '<div class="sheet-grabber"></div>' +
        (o.title ? '<h2 class="sheet-title" id="' + tid + '">' + o.title + '</h2>' : '') +
        (o.sub ? '<p class="sheet-sub">' + o.sub + '</p>' : '') +
        (o.body ? '<div class="sheet-body">' + o.body + '</div>' : '') +
        (o.primary ? '<button class="btn btn-primary btn-lg btn-block" type="button"' + (o.primary.id ? ' id="' + escape(o.primary.id) + '"' : '') + ' data-sheet-primary>' + escape(o.primary.label || 'Continue') + '</button>' : '') +
        (o.secondary ? '<button class="btn btn-secondary btn-lg btn-block" type="button"' + (o.secondary.id ? ' id="' + escape(o.secondary.id) + '"' : '') + ' data-sheet-secondary>' + escape(o.secondary.label || 'Cancel') + '</button>' : '') +
        '</div>';
      r.innerHTML = html;
      var el = r.querySelector('.sheet');
      state = { el: el, onClose: o.onClose, dismissible: o.dismissible !== false };
      r.querySelector('[data-sheet-backdrop]').addEventListener('click', function () { if (state && state.dismissible) dismiss('backdrop'); });
      document.addEventListener('keydown', onKey);
      if (o.primary && typeof o.primary.onClick === 'function') el.querySelector('[data-sheet-primary]').addEventListener('click', o.primary.onClick);
      if (o.secondary && typeof o.secondary.onClick === 'function') el.querySelector('[data-sheet-secondary]').addEventListener('click', o.secondary.onClick);
      // slide-up on the next frame (css/screens.css #sheet-root.is-open)
      void el.offsetHeight;
      requestAnimationFrame(function () { if (state && state.el === el) r.classList.add('is-open'); });
      var focusable = el.querySelector('[data-sheet-primary], button, [tabindex]');
      if (focusable && typeof focusable.focus === 'function') { try { focusable.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
      return el;
    }
    return { open: open, close: close, dismiss: dismiss, isOpen: function () { return !!state; } };
  })();

  /* ---------- toast ---------- */
  var toastTimer = null;
  function toast(text, o) {
    o = o || {};
    var app = document.getElementById('app');
    var wide = app && app.classList.contains('is-wide');
    var host;
    if (wide) {
      // own host outside #wide, so renderWide()'s innerHTML replacement (debug auto-refresh) cannot wipe it
      host = document.getElementById('wide-toast');
      if (!host) { host = document.createElement('div'); host.id = 'wide-toast'; host.className = 'wide-toast'; app.appendChild(host); }
    } else {
      host = document.getElementById('toast-root');
    }
    if (!host) return null;
    var old = host.querySelector('.toast');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.textContent = String(text);
    host.appendChild(el);
    void el.offsetHeight;
    requestAnimationFrame(function () { el.classList.add('is-in'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('is-in');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
    }, o.ms || 2200);
    return el;
  }

  /* ---------- exports ---------- */
  ui.SEP = SEP;
  ui.TABS = TABS;
  ui.icon = icon;
  ui.escape = escape;
  ui.money = money;
  ui.statusbar = statusbar;
  ui.headerPill = headerPill;
  ui.iconBtn = iconBtn;
  ui.header = header;
  ui.tabbar = tabbar;
  ui.render = render;
  ui.renderWide = renderWide;
  ui.exitWide = exitWide;
  ui.mediaCard = mediaCard;
  ui.inviteCard = inviteCard;
  ui.listRow = listRow;
  ui.tag = tag;
  ui.chip = chip;
  ui.button = button;
  ui.artThumb = artThumb;
  ui.sheet = sheet;
  ui.toast = toast;
})();
