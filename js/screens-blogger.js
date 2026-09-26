/* screens-blogger.js — The Secret Society demo · blogger screens.
   Contract: ARCHITECTURE.md §9 (Blogger) — explore, category, search, offer, apply, invites, invite, slots, accepted,
   checkin, deliverables, profile. Plain ES2019 browser JS, no modules. Registers into TSS.screens (router.js) and
   uses the shared renderers in TSS.ui, the market/session in TSS.state and the exact tracking contract in
   TSS.analytics (SPEC §7.2). Helpers that the shared files do not provide live in TSS.bloggerUI (this file only).

   Event rules honoured here:
   · every venue-related event passes { groups: { venue: venue_id } } (event-level group, never user-level);
   · screen events fire in mount() AFTER the router's Page Viewed, and never again on a live market refresh
     (TSS.bloggerUI.liveRefresh() flags the re-render so mounts skip their "screen opened" event);
   · Run B determinism: for an unseated invite the two always-full slots look open (no seat count, no full marker),
     tapping one always shows "This slot is full" → Slot Full Notice Viewed → Close → Invite Abandoned;
   · a seated invite (Run A) never routes to /slots — the invite screen offers "Accept invite" directly. */
window.TSS = window.TSS || {};
(function () {
  'use strict';
  var TSS = window.TSS;
  var screens = TSS.screens = TSS.screens || {};
  var ui = TSS.ui;
  var esc = function (s) { return ui.escape(s); };
  var SEP = ui.SEP;
  var B = TSS.bloggerUI = TSS.bloggerUI || {};

  /* ════════════════════════════════════════════════════════════════════════════════════════ */
  /* Access helpers                                                                            */
  /* ════════════════════════════════════════════════════════════════════════════════════════ */
  function cfg() { return TSS.config || {}; }
  function D() { return TSS.data; }
  function S() { return TSS.state; }
  function session() { try { return S().getSession(); } catch (e) { return {}; } }
  function navigate(path, opts) { TSS.router.navigate(path, opts); }
  function bump(n) { try { TSS.analytics.bumpFunnel(n); } catch (e) { if (window.console) console.error('[TSS] bumpFunnel failed', e); } }
  // track(name, props, venue_id) — venue_id → event-level group { venue: venue_id }
  function track(name, props, venue_id) {
    var opts = venue_id ? { groups: { venue: venue_id } } : undefined;
    try { return TSS.analytics.track(name, props, opts); }
    catch (e) { if (window.console) console.error('[TSS] track failed', name, e); return null; }
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function fmtClock(ts) { var d = new Date(ts || Date.now()); if (isNaN(d)) d = new Date(); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function profile() { return cfg().BLOGGER_PROFILE || { track_record: 'Steady Regulars', primary_niche: 'lifestyle', follower_band: '10k-25k', home_city: 'Dubai', device_type: 'ios' }; }
  function firstName() {
    var s = session();
    if (s.display_name) return s.display_name;
    if (s.persona) { try { return S().personaName(s.persona); } catch (e) { /* fall through */ } }
    return 'there';
  }
  function userId() { return session().user_id || ''; }
  function myInvites() { var id = userId(); return id ? S().invitesFor(id) : []; }
  function myApplications() { var id = userId(); return id ? S().applicationsBy(id) : []; }
  function pendingInvites() { return myInvites().filter(function (i) { return i.status === 'pending'; }).length; }
  function attribution() {
    var s = session();
    if (s.attribution && s.attribution.utm_medium) return s.attribution;
    try { return TSS.analytics.resolveAttribution(); } catch (e) { return cfg().FALLBACK_BUNDLE || { utm_medium: 'social' }; }
  }
  function offerOf(id) { return D().offer(id); }
  function venueOf(offer) { return offer ? D().venue(offer.venue_id) : null; }
  function catOf(offer) { return offer ? D().categoryBySlug(offer.category_slug) : null; }
  function slotOf(offer, slot_id) {
    if (!slot_id || slot_id === 'unassigned') return null;
    var slots = (offer && offer.slots) || [];
    for (var i = 0; i < slots.length; i++) if (slots[i].slot_id === slot_id) return slots[i];
    return D().slotById(slot_id);
  }
  function categoryName(offer, venue) { var c = catOf(offer); return c ? c.name : (venue && venue.venue_category) || 'Experience'; }
  // An invite is only shown to the blogger it belongs to (another blogger's URL → not found).
  function ownedInvite(id) {
    var inv = S().invite(id);
    if (!inv) return null;
    var uid = userId();
    if (uid && inv.blogger_id !== uid) return null;
    return inv;
  }
  // { inv, offer, venue, slot_id, slot } — slot = accepted slot, else the reserved seat, else null
  function inviteBundle(id) {
    var inv = ownedInvite(id);
    if (!inv) return null;
    var offer = offerOf(inv.offer_id) || {};
    var venue = venueOf(offer) || D().venue(inv.venue_id) || {};
    var slot_id = inv.accepted_slot_id || (inv.seat_reserved && inv.slot_id !== 'unassigned' ? inv.slot_id : null);
    return { inv: inv, offer: offer, venue: venue, slot_id: slot_id, slot: slot_id ? slotOf(offer, slot_id) : null };
  }
  function notFound(path) {
    return screens.notFound ? screens.notFound.render({ path: path }) : '<div class="section"><p class="mt-10">Not found</p></div>';
  }
  function cleanupAll(fns) {
    return function () { fns.forEach(function (f) { if (typeof f === 'function') { try { f(); } catch (e) { /* ignore */ } } }); };
  }

  /* ---------- live market refresh (re-render without a new Page Viewed, and without re-firing screen events) ---------- */
  var viaRefresh = false;
  function liveRefresh() {
    viaRefresh = true;
    try { TSS.router.refresh(); }
    finally { viaRefresh = false; }
  }
  // mounts call this once: true when the mount is a live refresh (skip the "screen opened" event)
  function isRefresh() { var v = viaRefresh; viaRefresh = false; return v; }
  function subscribe() { return S().onMarketChange(function () { liveRefresh(); }); }

  /* ---------- saved offers (session) + heart buttons ---------- */
  function savedList() { return (session().saved_offers || []).slice(); }
  function isSaved(offer_id) { return savedList().indexOf(offer_id) !== -1; }
  function toggleSaved(offer_id) {
    var list = savedList(), i = list.indexOf(offer_id), now;
    if (i === -1) { list.push(offer_id); now = true; } else { list.splice(i, 1); now = false; }
    S().setSession({ saved_offers: list });
    return now;
  }
  function paintHearts(root, offer_id, liked) {
    var nodes = root.querySelectorAll('[data-save="' + offer_id + '"]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].classList.toggle('is-liked', liked);
      nodes[i].setAttribute('aria-pressed', liked ? 'true' : 'false');
      nodes[i].setAttribute('aria-label', liked ? 'Saved' : 'Save');
    }
  }
  // Heart tap → Event Saved [G] {offer_id, venue_name} + toast; un-saving fires nothing.
  function bindHearts(root) {
    function onClick(e) {
      var btn = e.target && e.target.closest ? e.target.closest('[data-save]') : null;
      if (!btn || !root.contains(btn)) return;
      e.preventDefault();
      var offer_id = btn.getAttribute('data-save');
      var offer = offerOf(offer_id);
      if (!offer) return;
      var liked = toggleSaved(offer_id);
      paintHearts(root, offer_id, liked);
      if (liked) {
        var v = venueOf(offer);
        track('Event Saved', { offer_id: offer_id, venue_name: v ? v.venue_name : offer.venue_id }, offer.venue_id);
        ui.toast('Saved');
      } else {
        ui.toast('Removed from saved');
      }
    }
    root.addEventListener('click', onClick);
    return function () { root.removeEventListener('click', onClick); };
  }

  /* ---------- small renderers ---------- */
  function bellBtn() {
    var n = pendingInvites();
    return ui.iconBtn('bell', { nav: '/invites', label: 'Invites', badge: n > 0 ? n : undefined });
  }
  function cardList(offers, cls) {
    return '<div class="card-list' + (cls ? ' ' + cls : '') + '">' + offers.map(function (o) { return ui.mediaCard(o, { liked: isSaved(o.offer_id) }); }).join('') + '</div>';
  }
  function emptyState(o) {
    return '<div class="empty' + (o.cls ? ' ' + o.cls : '') + '">' +
      (o.art ? '<div class="art art-' + esc(o.art) + ' empty-art"></div>' : '') +
      (o.title ? '<div class="empty-title">' + o.title + '</div>' : '') +
      (o.sub ? '<div class="empty-sub">' + o.sub + '</div>' : '') +
      (o.action || '') + '</div>';
  }
  function statTile(n, label, o) {
    o = o || {};
    return '<div class="stat-tile' + (o.gradient ? ' gradient' : '') + '">' + (o.dot ? '<span class="badge-dot"></span>' : '') +
      '<span class="stat-tile-number">' + esc(n) + '</span><span class="stat-tile-label">' + label + '</span></div>';
  }
  function kvRows(rows) {
    return '<div class="kv">' + rows.map(function (r) { return '<span class="k">' + r[0] + '</span><span class="v">' + r[1] + '</span>'; }).join('') + '</div>';
  }
  // QR-looking block generated from the code (finder patterns + timing rows + hashed data modules) — no image.
  function hash32(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  }
  function qr(code) {
    var N = 21, h = hash32(String(code || 'TSS')), out = '';
    function rnd() { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 4294967296; }
    function finder(x, y, fx, fy) {
      var dx = x - fx, dy = y - fy;
      if (dx < -1 || dx > 7 || dy < -1 || dy > 7) return null;
      if (dx < 0 || dx > 6 || dy < 0 || dy > 6) return false;                      // separator ring
      return dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4);
    }
    for (var y = 0; y < N; y++) {
      for (var x = 0; x < N; x++) {
        var f = finder(x, y, 0, 0); if (f === null) f = finder(x, y, N - 7, 0); if (f === null) f = finder(x, y, 0, N - 7);
        var on;
        if (f !== null) on = f;
        else if (y === 6 || x === 6) on = (x + y) % 2 === 0;                        // timing patterns
        else on = rnd() < 0.46;
        out += on ? '<b></b>' : '<i></i>';
      }
    }
    return '<div class="qr" aria-hidden="true">' + out + '</div>';
  }

  /* ════════════════════════════════════════════════════════════════════════════════════════ */
  /* explore — /events                                                                          */
  /* ════════════════════════════════════════════════════════════════════════════════════════ */
  screens.explore = {
    role: 'creator', tab: 'explore', tabbar: 'creator', tracked: true,
    title: function () { return 'Explore'; },
    render: function () {
      var offers = D().allOffers();
      var featured = offers.filter(function (o) { return o.demo; });
      var more = offers.filter(function (o) { return !o.demo; });
      var chips = D().CATEGORIES.map(function (c) { return ui.chip(esc(c.name), { icon: c.icon, nav: '/events/category/' + c.slug }); }).join('');
      return '<div class="explore">' +
        '<div class="hero explore-hero"><div class="art art-nightlife"></div><div class="hero-scrim"></div>' +
        ui.header({ left: 'pill', name: firstName(), icon: 'user-round', chevron: true, nav: '/profile', overlay: true,
          actions: [ui.iconBtn('search', { nav: '/search', label: 'Search' }), bellBtn()] }) +
        '<h1 class="hero-title">Upcoming<br>Events in <span class="accent-text is-hero">Dubai</span>' + ui.icon('chevron-down', 26) + '</h1>' +
        '</div>' +
        '<div class="scroll-x chip-row explore-chips" aria-label="Categories">' + chips + '</div>' +
        '<div class="section mt-5"><span class="t-count accent-text">' + offers.length + ' Events found</span></div>' +
        '<div class="section mt-5 section-head"><h2 class="t-h2">Featured</h2><button class="section-link" type="button" data-nav="/search">See all ' + ui.icon('arrow-up-right', 19) + '</button></div>' +
        '<div class="section mt-4">' + cardList(featured) + '</div>' +
        '<div class="section mt-8 section-head"><h2 class="t-h2">More this week</h2><span class="t-meta">' + plural(more.length, 'venue', 'venues') + '</span></div>' +
        '<div class="section mt-4">' + cardList(more) + '</div>' +
        '</div>';
    },
    mount: function (params, root) {
      if (!isRefresh()) {
        var s = session(), att = attribution();
        track('Offers Feed Viewed', { utm_medium: att.utm_medium, is_returning: !!s.is_returning, city: 'Dubai' });
        bump(1);
      }
      return cleanupAll([bindHearts(root), subscribe()]);
    }
  };

  /* ════════════════════════════════════════════════════════════════════════════════════════ */
  /* category — /events/category/:slug                                                          */
  /* ════════════════════════════════════════════════════════════════════════════════════════ */
  screens.category = {
    role: 'creator', tab: 'explore', tabbar: 'creator', tracked: true,
    title: function (p) { var c = D().categoryBySlug(p.slug); return c ? c.name : 'Not found'; },
    render: function (p) {
      var c = D().categoryBySlug(p.slug);
      if (!c) return notFound('/events/category/' + p.slug);
      var offers = D().offersByCategory(p.slug);
      return '<div class="category">' + ui.header({ left: 'back', title: esc(c.name), actions: [bellBtn()] }) +
        '<div class="section mt-6 row-between gap-3"><span class="t-count accent-text">' + plural(offers.length, 'Event', 'Events') + ' found</span>' +
        ui.chip('Recommended', { icon: 'arrow-down-wide-narrow', cls: 'chip-static' }) + '</div>' +
        '<div class="section mt-5">' + (offers.length ? cardList(offers) : emptyState({ art: 'nightlife', title: 'Nothing in ' + esc(c.name) + ' yet', sub: 'New experiences drop every week.', action: ui.button('Back to Explore', { cls: 'btn-primary', nav: '/events' }) })) + '</div>' +
        '</div>';
    },
    mount: function (p, root) {
      var c = D().categoryBySlug(p.slug);
      var refreshed = isRefresh();
      if (!c) return null;
      if (!refreshed) {
        track('Category Browsed', { category_name: c.name, events_shown: D().offersByCategory(p.slug).length, sort_by: 'recommended' });
        bump(1);
      }
      return cleanupAll([bindHearts(root), subscribe()]);
    }
  };

  /* ════════════════════════════════════════════════════════════════════════════════════════ */
  /* search — /search                                                                           */
  /* ════════════════════════════════════════════════════════════════════════════════════════ */
  var SUGGESTIONS = ['beach club', 'VIP table', 'yoga', 'brunch'];
  function searchResults(q, res) {
    if (!res.length) {
      return emptyState({ art: 'nightlife', title: 'No events found', sub: 'Nothing matches “' + esc(q) + '”. Try “beach club”, “VIP table” or a category.', cls: 'search-empty' });
    }
    return '<div class="t-count accent-text">' + plural(res.length, 'result', 'results') + ' for “' + esc(q) + '”</div><div class="mt-4">' + cardList(res) + '</div>';
  }
  screens.search = {
    role: 'creator', tab: 'search', tabbar: 'creator', tracked: true,
    title: function () { return 'Search'; },
    render: function () {
      return '<div class="search">' + ui.header({ left: 'title', title: 'Search', large: true, actions: [bellBtn()] }) +
        '<form class="section mt-6" id="search-form" role="search" autocomplete="off">' +
        '<label class="sr-only" for="search-input">Search venues, experiences, categories</label>' +
        '<div class="field search-field">' + ui.icon('search', 22) +
        '<input id="search-input" type="search" name="q" placeholder="Venues, experiences, categories" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="search">' +
        '<button class="btn btn-primary btn-sm" type="submit" id="search-go">Search</button></div></form>' +
        '<div class="scroll-x chip-row mt-4" aria-label="Suggestions">' + SUGGESTIONS.map(function (s) { return ui.chip(esc(s), { data: { suggest: s } }); }).join('') + '</div>' +
        '<div class="section mt-6" id="search-results" aria-live="polite">' +
        '<p class="t-body c-tertiary">Try a venue, an experience or a category — results appear here.</p></div>' +
        '</div>';
    },
    mount: function (p, root) {
      isRefresh();
      var form = root.querySelector('#search-form'), input = root.querySelector('#search-input'), results = root.querySelector('#search-results');
      function submit(q) {
        q = String(q || '').trim();
        if (!q) { if (input) input.focus(); return; }
        var res = D().searchOffers(q);
        track('Events Searched', { search_query: q, results_returned: res.length, zero_results: res.length === 0 });
        S().setSession({ searches: (Number(session().searches) || 0) + 1 });
        if (results) results.innerHTML = searchResults(q, res);
      }
      if (form) form.addEventListener('submit', function (e) { e.preventDefault(); submit(input ? input.value : ''); });
      var chips = root.querySelectorAll('[data-suggest]');
      for (var i = 0; i < chips.length; i++) {
        chips[i].addEventListener('click', function () {
          var q = this.getAttribute('data-suggest');
          if (input) input.value = q;
          submit(q);
        });
      }
      return bindHearts(root);
    }
  };

  /* ════════════════════════════════════════════════════════════════════════════════════════ */
  /* offer — /events/:offer_id                                                                  */
  /* ════════════════════════════════════════════════════════════════════════════════════════ */
  function heroText(o, v, tagHtml) {
    return '<div class="offer-hero-text"><h1 class="offer-title">' + esc(o.experience_name) + '</h1>' +
      '<div class="offer-subline"><span class="t-body">' + esc(v.venue_name || '') + '</span>' + (tagHtml || '') + '</div></div>';
  }
  screens.offer = {
    role: 'creator', tab: 'explore', tabbar: 'creator', tracked: true,
    title: function (p) { var o = offerOf(p.offer_id), v = venueOf(o); return o ? o.experience_name + ' at ' + (v ? v.venue_name : o.venue_id) : 'Not found'; },
    venueGroup: function (p) { var o = offerOf(p.offer_id); return o ? o.venue_id : null; },
    render: function (p) {
      var o = offerOf(p.offer_id);
      if (!o) return notFound('/events/' + p.offer_id);
      var v = venueOf(o) || {}, av = S().offerAvailability(o.offer_id), liked = isSaved(o.offer_id);
      var perks = (o.perks || []).map(function (x) { return '<li>' + ui.icon('check', 16, 'bold') + '<span>' + esc(x) + '</span></li>'; }).join('');
      var slots;
      if (o.slots && o.slots.length) {
        slots = S().slotAvailability(o.offer_id, { forUnseatedInvite: false }).map(function (r) {
          return '<li class="slot-line"><span class="slot-line-label">' + esc(D().slotLabelLong(r.slot)) + '</span><span class="t-meta">' + plural(r.left, 'seat', 'seats') + ' left</span></li>';
        }).join('');
      } else {
        slots = '<li class="slot-line"><span class="slot-line-label">Dates shared on approval</span><span class="t-meta">' + plural(av.slots_available, 'open slot', 'open slots') + '</span></li>';
      }
      var cta = o.demo
        ? ui.button('Apply', { cls: 'btn-primary btn-lg btn-block', nav: '/events/' + o.offer_id + '/apply', id: 'offer-apply' })
        : ui.button('Applications closed', { cls: 'btn-lg btn-block', disabled: true, id: 'offer-closed' });
      return '<div class="offer">' +
        '<div class="hero is-establishments offer-hero"><div class="art art-' + esc(o.art || 'nightlife') + '"></div><div class="hero-scrim"></div>' +
        '<div class="header is-overlay">' + ui.iconBtn('arrow-left', { back: true, label: 'Back' }) + '<span class="grow"></span>' +
        ui.iconBtn('heart', { data: { save: o.offer_id }, cls: liked ? 'is-liked' : '', label: liked ? 'Saved' : 'Save' }) + '</div>' +
        heroText(o, v, ui.tag(esc(categoryName(o, v)), 'outline')) +
        '</div>' +
        '<div class="section offer-body stack gap-3">' +
        '<div class="card offer-value"><div class="row-between gap-3"><div><div class="t-label c-muted">Experience value</div><div class="offer-price">' + esc(ui.money(o.experience_value)) + '</div></div>' + ui.tag(esc(D().creditsLabel(o)), 'teal') + '</div>' +
        '<div class="card-meta mt-3">' + esc(plural(av.seats_left, 'seat', 'seats') + ' left across ' + plural(av.slots_available, 'slot', 'slots')) + '</div></div>' +
        '<div class="card"><h2 class="card-title">What you get</h2><ul class="perk-list mt-3">' + perks + '</ul></div>' +
        '<div class="card"><div class="card-kv"><span class="k">Deliverables :</span> ' + esc(o.deliverables || '') + '</div></div>' +
        '<div class="card"><h2 class="card-title">Available slots</h2><ul class="slot-list mt-2">' + slots + '</ul></div>' +
        '<div class="card offer-venue row gap-4">' + ui.artThumb(v.art || o.art, { size: 'lg' }) + '<div class="grow"><div class="card-title">' + esc(v.venue_name || '') + '</div><div class="card-meta mt-1">' + esc(v.venue_category || '') + SEP + esc(v.city || 'Dubai') + '</div></div>' + ui.icon('chevron-right', 20) + '</div>' +
        '<p class="t-body c-secondary offer-desc">' + esc(o.description || '') + '</p>' +
        '</div>' +
        '<div class="cta-bar">' + cta + '</div>' +
        '</div>';
    },
    mount: function (p, root) {
      var o = offerOf(p.offer_id);
      var refreshed = isRefresh();
      if (!o) return null;
      if (!refreshed) {
        var v = venueOf(o) || {}, av = S().offerAvailability(o.offer_id);
        track('Offer Viewed', {
          offer_id: o.offer_id, experience_name: o.experience_name, venue_name: v.venue_name || o.venue_id,
          venue_category: categoryName(o, v), experience_value: o.experience_value,
          slots_available: av.slots_available, seats_left: av.seats_left
        }, o.venue_id);
        bump(1);
      }
      return bindHearts(root);
    }
  };

  /* ════════════════════════════════════════════════════════════════════════════════════════ */
  /* apply — /events/:offer_id/apply (demo offers only; renders as a sheet over the dimmed offer) */
  /* ════════════════════════════════════════════════════════════════════════════════════════ */
  screens.apply = {
    role: 'creator', tab: 'explore', tabbar: null, tracked: true,
    title: function (p) { var o = offerOf(p.offer_id); return o ? 'Apply to attend · ' + o.experience_name : 'Not found'; },
    venueGroup: function (p) { var o = offerOf(p.offer_id); return o ? o.venue_id : null; },
    render: function (p) {
      var o = offerOf(p.offer_id);
      if (!o) return notFound('/events/' + p.offer_id + '/apply');
      if (!o.demo) return '';   // mount redirects to the offer
      var v = venueOf(o) || {}, first = (o.slots || [])[0];
      var pitch = String(cfg().PITCH_DEFAULT || '');
      return '<div class="apply">' +
        '<div class="apply-under" aria-hidden="true"><div class="hero is-establishments"><div class="art art-' + esc(o.art || 'nightlife') + '"></div><div class="hero-scrim"></div>' + heroText(o, v) + '</div></div>' +
        '<div class="apply-scrim" data-back="1" aria-hidden="true"></div>' +
        '<div class="sheet apply-sheet" role="dialog" aria-modal="true" aria-labelledby="apply-title"><div class="sheet-grabber"></div>' +
        '<div class="sheet-row apply-head"><div><h2 class="sheet-title" id="apply-title">Apply to attend</h2>' +
        '<p class="sheet-sub">' + esc(o.experience_name) + SEP + esc(v.venue_name || '') + SEP + esc(first ? D().slotLabel(first) : 'Flexible dates') + '</p></div>' +
        ui.iconBtn('x', { back: true, label: 'Close' }) + '</div>' +
        '<div class="mt-6"><label class="field-label" for="apply-pitch">Message to the venue</label>' +
        '<div class="field is-textarea"><textarea id="apply-pitch" rows="4" maxlength="400">' + esc(pitch) + '</textarea></div>' +
        '<div class="row-between mt-2"><span class="t-meta-sm">Short and specific wins</span><span class="t-meta-sm"><span id="apply-count">' + pitch.length + '</span> chars</span></div></div>' +
        '<div class="sheet-row mt-5"><div><div class="t-body">Guests</div><div class="t-meta mt-1">Including you' + SEP + 'max 2</div></div>' +
        '<div class="stepper"><button class="stepper-btn" type="button" id="apply-minus" aria-label="Fewer guests" disabled>' + ui.icon('minus', 20) + '</button>' +
        '<span class="stepper-value" id="apply-guests" aria-live="polite">1</span>' +
        '<button class="stepper-btn" type="button" id="apply-plus" aria-label="More guests">' + ui.icon('plus', 20) + '</button></div></div>' +
        ui.button('Send application', { cls: 'btn-primary btn-lg btn-block', id: 'apply-send' }) +
        '</div></div>';
    },
    mount: function (p, root) {
      var o = offerOf(p.offer_id);
      var refreshed = isRefresh();
      if (!o) return null;
      if (!o.demo) { navigate('/events/' + o.offer_id, { replace: true }); return null; }
      var v = venueOf(o) || {};
      if (!refreshed) track('Application Started', { offer_id: o.offer_id, venue_name: v.venue_name || o.venue_id, experience_value: o.experience_value }, o.venue_id);
      var guests = 1;
      var ta = root.querySelector('#apply-pitch'), count = root.querySelector('#apply-count'), val = root.querySelector('#apply-guests');
      var minus = root.querySelector('#apply-minus'), plus = root.querySelector('#apply-plus'), send = root.querySelector('#apply-send');
      function paint() { if (val) val.textContent = guests; if (minus) minus.disabled = guests <= 1; if (plus) plus.disabled = guests >= 2; }
      if (ta) ta.addEventListener('input', function () { if (count) count.textContent = ta.value.trim().length; });
      if (minus) minus.addEventListener('click', function () { if (guests > 1) { guests -= 1; paint(); } });
      if (plus) plus.addEventListener('click', function () { if (guests < 2) { guests += 1; paint(); } });
      if (send) send.addEventListener('click', function () {
        send.disabled = true;
        var text = ta ? ta.value.trim() : '';
        var len = text.length > 0 ? text.length : String(cfg().PITCH_DEFAULT || '').length;
        if (len < 1) len = 1;
        var app = S().submitApplication({ offer_id: o.offer_id, session: session(), guest_count: guests, pitch_length_chars: len });
        if (!app) { send.disabled = false; ui.toast('Could not send — try again'); return; }
        track('Application Submitted', {
          offer_id: o.offer_id, venue_name: v.venue_name || o.venue_id, venue_category: categoryName(o, v), experience_value: o.experience_value,
          guest_count: guests, pitch_length_chars: len, follower_band: profile().follower_band
        }, o.venue_id);
        bump(2);
        ui.toast('Application sent');
        navigate('/invites', { replace: true });
      });
      return null;
    }
  };

  /* ════════════════════════════════════════════════════════════════════════════════════════ */
  /* invites — /invites                                                                         */
  /* ════════════════════════════════════════════════════════════════════════════════════════ */
  function applicationRow(app) {
    var o = offerOf(app.offer_id) || {}, v = venueOf(o) || D().venue(app.venue_id) || {};
    var status = app.status === 'rejected' ? ui.tag('Declined', 'outline') : ui.tag('Under review', 'red');
    return ui.listRow({
      avatarArt: o.art || v.art || 'nightlife', portrait: false, cls: 'application-row', data: { app: app.app_id },
      title: esc(o.experience_name || app.offer_id), sub: esc(v.venue_name || app.venue_id),
      meta: 'Applied ' + esc(fmtClock(app.submitted_at)) + SEP + esc(plural(app.guest_count || 1, 'guest', 'guests')),
      action: status
    });
  }
  screens.invites = {
    role: 'creator', tab: 'invites', tabbar: 'creator', tracked: true,
    title: function () { return 'Invites'; },
    render: function () {
      var invites = myInvites(), allApps = myApplications();
      var apps = allApps.filter(function (a) { return a.status !== 'approved'; });
      var pending = invites.filter(function (i) { return i.status === 'pending'; }).length;
      var accepted = invites.filter(function (i) { return i.status === 'accepted' || i.status === 'checked_in'; }).length;
      var checked = invites.filter(function (i) { return i.status === 'checked_in'; }).length;
      var tiles = '<div class="stat-row invites-stats">' + statTile(allApps.length, 'Applied', { gradient: true, dot: apps.length > 0 }) +
        statTile(pending, 'To confirm', { dot: pending > 0 }) + statTile(accepted, 'Accepted') + statTile(checked, 'Checked in') + '</div>';
      var invitesHtml = invites.length
        ? '<div class="card-list">' + invites.map(function (inv) { var o = offerOf(inv.offer_id) || {}; return ui.inviteCard(inv, o, venueOf(o) || D().venue(inv.venue_id) || {}); }).join('') + '</div>'
        : emptyState({ art: 'beach', title: 'No invites yet',
          sub: apps.length ? 'Your application is with the venue — approvals land here live.' : 'Apply to an experience and the venue’s invite lands here.',
          action: ui.button('Explore events', { cls: 'btn-primary', nav: '/events', id: 'invites-explore' }) });
      var appsHtml = apps.length ? '<div class="card-list is-tight">' + apps.map(applicationRow).join('') + '</div>' : '<p class="t-body c-tertiary">No applications waiting.</p>';
      return '<div class="invites">' + ui.header({ left: 'title', title: 'Invites', large: true, actions: [bellBtn()] }) +
        '<div class="section mt-5">' + tiles + '</div>' +
        '<div class="section"><div class="divider mt-8"></div></div>' +
        '<div class="section mt-6 section-head"><h2 class="t-h2">Your invites</h2><span class="t-meta">' + plural(invites.length, 'invite', 'invites') + '</span></div>' +
        '<div class="section mt-4" id="invites-list">' + invitesHtml + '</div>' +
        '<div class="section mt-8 section-head"><h2 class="t-h2">Applications</h2><span class="t-meta">' + plural(apps.length, 'under review', 'under review') + '</span></div>' +
        '<div class="section mt-4" id="applications-list">' + appsHtml + '</div>' +
        '</div>';
    },
    mount: function () { isRefresh(); return subscribe(); }
  };

  /* ════════════════════════════════════════════════════════════════════════════════════════ */
  /* invite — /invites/:invite_id                                                               */
  /* ════════════════════════════════════════════════════════════════════════════════════════ */
  screens.invite = {
    role: 'creator', tab: 'invites', tabbar: 'creator', tracked: true,
    title: function (p) { var b = inviteBundle(p.invite_id); return b ? 'Invite · ' + (b.offer.experience_name || 'Experience') : 'Not found'; },
    venueGroup: function (p) { var b = inviteBundle(p.invite_id); return b ? b.inv.venue_id : null; },
    render: function (p) {
      var b = inviteBundle(p.invite_id);
      if (!b) return notFound('/invites/' + p.invite_id);
      var inv = b.inv, o = b.offer, v = b.venue, slot = b.slot;
      var guests = plural(inv.guest_count || 1, 'guest', 'guests');
      var when = slot ? esc(D().slotLabelLong(slot)) : '';
      var seat = '', footer = '';
      if (inv.status === 'pending' && inv.seat_reserved) {
        seat = ui.tag(esc(slot ? D().slotLabel(slot) : 'Seat') + ' — seat reserved', 'teal') + '<div class="seat-when">' + when + '</div>' +
          '<div class="card-meta">' + esc(v.venue_name || '') + ' placed you in this slot' + SEP + esc(guests) + '</div>';
        footer = ui.button('Accept invite', { cls: 'btn-primary btn-lg btn-block', id: 'invite-accept' });
      } else if (inv.status === 'pending') {
        seat = ui.tag('Pick your slot', 'outline') + '<div class="seat-when">Choose when to come</div>' +
          '<div class="card-meta">' + esc(v.venue_name || 'The venue') + ' approved you — the slot is yours to pick' + SEP + esc(guests) + '</div>';
        footer = ui.button('Choose slot', { cls: 'btn-primary btn-lg btn-block', nav: '/invites/' + inv.invite_id + '/slots', id: 'invite-choose' });
      } else if (inv.status === 'accepted') {
        seat = ui.tag('Accepted' + SEP + esc(slot ? D().slotLabel(slot) : ''), 'teal') + '<div class="seat-when">' + when + '</div><div class="card-meta">' + esc(guests) + SEP + 'Show your code at the door</div>';
        footer = ui.button('View check-in code', { cls: 'btn-primary btn-lg btn-block', nav: '/invites/' + inv.invite_id + '/checkin', id: 'invite-code' });
      } else if (inv.status === 'abandoned') {
        seat = ui.tag('Slot unavailable', 'red') + '<div class="seat-when">Invite released</div><div class="card-meta">The slot you picked had no seats left, so this invite was released.</div>';
        footer = ui.button('Slot unavailable', { cls: 'btn-lg btn-block', disabled: true }) + ui.button('Back to invites', { cls: 'btn-ghost btn-lg btn-block', nav: '/invites' });
      } else if (inv.status === 'checked_in') {
        seat = ui.tag(ui.icon('check', 12, 'badge') + 'Checked in', 'teal-solid') + '<div class="seat-when">' + when + '</div><div class="card-meta">Checked in at ' + esc(fmtClock(inv.checked_in_at)) + SEP + esc(guests) + '</div>';
        footer = ui.button('Deliverables', { cls: 'btn-primary btn-lg btn-block', nav: '/collabs/' + inv.invite_id + '/deliverables', id: 'invite-deliverables' });
      }
      return '<div class="invite">' + ui.header({ left: 'back', title: 'Invite' }) +
        '<div class="section mt-6 stack gap-3">' +
        '<div class="card invite-hero"><div class="art art-' + esc(o.art || v.art || 'nightlife') + ' invite-art"></div><div class="invite-hero-body">' +
        '<h1 class="t-h1-strong">' + esc(o.experience_name || 'Experience') + '</h1>' +
        '<div class="card-meta mt-1">' + esc(v.venue_name || '') + SEP + esc(categoryName(o, v)) + '</div>' +
        '<div class="tag-row mt-3">' + ui.tag(esc(ui.money(o.experience_value)) + ' experience', 'teal') + ui.tag(esc(D().creditsLabel(o)), 'outline') + '</div></div></div>' +
        '<div class="card seat-block">' + seat + '</div>' +
        '<div class="card"><div class="card-kv"><span class="k">Deliverables :</span> ' + esc(o.deliverables || '') + '</div>' +
        '<div class="card-kv mt-2"><span class="k">Invite ID :</span> <span class="mono">' + esc(inv.invite_id) + '</span></div></div>' +
        '<div class="invite-footer stack gap-3">' + footer + '</div>' +
        '</div></div>';
    },
    mount: function (p, root) {
      var b = inviteBundle(p.invite_id);
      var refreshed = isRefresh();
      if (!b) return null;
      var inv = b.inv, o = b.offer, v = b.venue;
      if (inv.status === 'pending' && !refreshed) {
        track('Invite Opened', {
          offer_id: inv.offer_id, invite_id: inv.invite_id, venue_name: v.venue_name || inv.venue_id,
          seat_reserved: !!inv.seat_reserved, slot_id: inv.seat_reserved && inv.slot_id ? inv.slot_id : 'unassigned', experience_value: o.experience_value
        }, inv.venue_id);
        bump(3);
      }
      var unsub = subscribe();
      var accept = root.querySelector('#invite-accept');
      if (accept) accept.addEventListener('click', function () {
        accept.disabled = true;
        unsub();
        var res = S().acceptInvite(inv.invite_id, inv.slot_id);
        if (!res || res.status !== 'accepted') { accept.disabled = false; unsub = subscribe(); ui.toast('Could not accept — try again'); return; }
        var slot = slotOf(o, res.accepted_slot_id) || {};
        track('Invite Accepted', {
          offer_id: inv.offer_id, invite_id: inv.invite_id, venue_name: v.venue_name || inv.venue_id, slot_id: res.accepted_slot_id,
          slot_time: slot.time, slot_weekday: slot.weekday, guest_count: res.guest_count || 1, approval_style: v.approval_style
        }, inv.venue_id);
        bump(4);
        navigate('/invites/' + inv.invite_id + '/accepted', { replace: true });
      });
      return function () { unsub(); };
    }
  };

  /* ════════════════════════════════════════════════════════════════════════════════════════ */
  /* slots — /invites/:invite_id/slots (unseated invites only)                                  */
  /* ════════════════════════════════════════════════════════════════════════════════════════ */
  function slotRow(r) {
    var right;
    if (r.forced_full) right = r.popular ? ui.tag('Most popular', 'teal') : '';                     // looks open: no seat count, no full marker
    else if (r.is_full) right = ui.tag('Full', 'red');
    else right = '<span class="t-meta">' + plural(r.left, 'seat', 'seats') + ' left</span>';
    return '<button class="card slot-row" type="button" data-slot="' + esc(r.slot_id) + '">' +
      '<div class="slot-row-body"><div class="card-title">' + esc(D().slotLabelLong(r.slot)) + '</div>' +
      '<div class="card-meta mt-1">' + esc(r.slot.weekday) + SEP + 'Doors ' + esc(r.slot.time) + '</div></div>' +
      '<div class="slot-row-right">' + right + ui.icon('chevron-right', 20) + '</div></button>';
  }
  screens.slots = {
    role: 'creator', tab: 'invites', tabbar: 'creator', tracked: true,
    title: function () { return 'Choose a slot'; },
    venueGroup: function (p) { var b = inviteBundle(p.invite_id); return b ? b.inv.venue_id : null; },
    render: function (p) {
      var b = inviteBundle(p.invite_id);
      if (!b) return notFound('/invites/' + p.invite_id + '/slots');
      var inv = b.inv, o = b.offer, v = b.venue;
      if (inv.status !== 'pending' || inv.seat_reserved) return '';   // mount redirects (seated invites never choose)
      var rows = S().slotAvailability(o.offer_id, { forUnseatedInvite: true });
      return '<div class="slots">' + ui.header({ left: 'back', title: 'Choose a slot' }) +
        '<div class="section mt-6"><p class="t-body c-secondary">Pick when you’ll come to ' + esc(v.venue_name || 'the venue') + '. You were approved without a seat, so the slot is first come, first served.</p></div>' +
        '<div class="section mt-5 card-list is-tight" id="slot-list">' + rows.map(slotRow).join('') + '</div>' +
        '</div>';
    },
    mount: function (p, root) {
      var b = inviteBundle(p.invite_id);
      isRefresh();
      if (!b) return null;
      var inv = b.inv, o = b.offer, v = b.venue;
      if (inv.status !== 'pending' || inv.seat_reserved) { navigate('/invites/' + inv.invite_id, { replace: true }); return null; }
      var busy = false;
      function onTap(slot_id) {
        if (busy) return;
        var rows = S().slotAvailability(o.offer_id, { forUnseatedInvite: true });
        var row = null;
        for (var i = 0; i < rows.length; i++) if (rows[i].slot_id === slot_id) row = rows[i];
        if (!row) return;
        if (!row.is_full) {
          busy = true;
          var res = S().acceptInvite(inv.invite_id, slot_id);
          if (!res || res.status !== 'accepted') { busy = false; ui.toast('That slot just filled up'); liveRefresh(); return; }
          track('Invite Accepted', {
            offer_id: inv.offer_id, invite_id: inv.invite_id, venue_name: v.venue_name || inv.venue_id, slot_id: slot_id,
            slot_time: row.slot.time, slot_weekday: row.slot.weekday, guest_count: res.guest_count || 1, approval_style: v.approval_style
          }, inv.venue_id);
          bump(4);
          navigate('/invites/' + inv.invite_id + '/accepted', { replace: true });
          return;
        }
        // Full slot → notice → Close releases the invite (Run B)
        busy = true;
        S().markSlotFullSeen(inv.invite_id);
        var remaining = rows.filter(function (r) { return !r.is_full; }).length;
        var done = false;
        function abandon() {
          if (done) return;
          done = true;
          S().abandonInvite(inv.invite_id);
          track('Invite Abandoned', { offer_id: inv.offer_id, invite_id: inv.invite_id, venue_name: v.venue_name || inv.venue_id, reason: 'slot_full' }, inv.venue_id);
          ui.sheet.close();
          ui.toast('Invite released');
          navigate('/invites', { replace: true });
        }
        ui.sheet.open({
          cls: 'slot-full',
          title: 'This slot is full',
          sub: esc(D().slotLabelLong(row.slot)) + ' has no seats left. ' + remaining + ' other ' + (remaining === 1 ? 'slot is' : 'slots are') + ' still open.',
          body: '<p class="t-body c-secondary">Popular slots go first. ' + esc(v.venue_name || 'The venue') + ' approved you without reserving a seat, so seats here are first come, first served.</p>',
          primary: { label: 'Close', id: 'slot-full-close', onClick: abandon },
          onClose: abandon,
          dismissible: true
        });
        track('Slot Full Notice Viewed', {
          offer_id: inv.offer_id, invite_id: inv.invite_id, venue_name: v.venue_name || inv.venue_id, approval_style: v.approval_style,
          reason: 'unassigned_seat', slot_requested: slot_id, slots_remaining: remaining
        }, inv.venue_id);
      }
      function onClick(e) {
        var btn = e.target && e.target.closest ? e.target.closest('[data-slot]') : null;
        if (!btn || !root.contains(btn)) return;
        e.preventDefault();
        onTap(btn.getAttribute('data-slot'));
      }
      root.addEventListener('click', onClick);
      return function () { root.removeEventListener('click', onClick); };
    }
  };

  /* ════════════════════════════════════════════════════════════════════════════════════════ */
  /* accepted — /invites/:invite_id/accepted                                                    */
  /* ════════════════════════════════════════════════════════════════════════════════════════ */
  function acceptedOrCheckedIn(inv) { return inv.status === 'accepted' || inv.status === 'checked_in'; }
  screens.accepted = {
    role: 'creator', tab: 'invites', tabbar: 'creator', tracked: true,
    title: function () { return 'You’re in'; },
    venueGroup: function (p) { var b = inviteBundle(p.invite_id); return b ? b.inv.venue_id : null; },
    render: function (p) {
      var b = inviteBundle(p.invite_id);
      if (!b) return notFound('/invites/' + p.invite_id + '/accepted');
      var inv = b.inv, o = b.offer, v = b.venue, slot = b.slot;
      if (!acceptedOrCheckedIn(inv)) return '';
      return '<div class="accepted">' +
        '<div class="accepted-hero"><div class="art art-' + esc(o.art || 'nightlife') + ' accepted-art"></div><div class="hero-scrim"></div>' +
        '<div class="accepted-badge">' + ui.icon('check', 40, 'heavy') + '</div></div>' +
        '<div class="section accepted-body"><h1 class="accepted-title">You’re in!</h1>' +
        '<p class="t-body c-secondary mt-2">' + esc(o.experience_name || '') + SEP + esc(v.venue_name || '') + '</p>' +
        '<div class="card mt-6">' + kvRows([
          ['When', slot ? esc(D().slotLabelLong(slot)) : 'To be confirmed'],
          ['Guests', esc(plural(inv.guest_count || 1, 'guest', 'guests'))],
          ['Venue', esc(v.venue_name || '') + SEP + esc(v.city || 'Dubai')],
          ['Bring', esc(D().creditsLabel(o)) + ' — covered by the venue']
        ]) + '</div>' +
        '<div class="stack gap-3 mt-6">' +
        ui.button('View check-in code', { cls: 'btn-primary btn-lg btn-block', nav: '/invites/' + inv.invite_id + '/checkin', id: 'accepted-code' }) +
        ui.button('Back to invites', { cls: 'btn-ghost btn-lg btn-block', nav: '/invites', id: 'accepted-back' }) +
        '</div></div></div>';
    },
    mount: function (p) {
      var b = inviteBundle(p.invite_id);
      isRefresh();
      if (!b) return null;
      if (!acceptedOrCheckedIn(b.inv)) { navigate('/invites/' + b.inv.invite_id, { replace: true }); }
      return null;
    }
  };

  /* ════════════════════════════════════════════════════════════════════════════════════════ */
  /* checkin — /invites/:invite_id/checkin                                                      */
  /* ════════════════════════════════════════════════════════════════════════════════════════ */
  screens.checkin = {
    role: 'creator', tab: 'invites', tabbar: 'creator', tracked: true,
    title: function () { return 'Check-in code'; },
    venueGroup: function (p) { var b = inviteBundle(p.invite_id); return b ? b.inv.venue_id : null; },
    render: function (p) {
      var b = inviteBundle(p.invite_id);
      if (!b) return notFound('/invites/' + p.invite_id + '/checkin');
      var inv = b.inv, o = b.offer, v = b.venue, slot = b.slot;
      if (!acceptedOrCheckedIn(inv)) return '';
      var code = inv.checkin_code || S().checkinCodeFor(inv.invite_id);
      var checked = inv.status === 'checked_in';
      var status = checked
        ? '<div class="checkin-status">' + ui.tag(ui.icon('check', 12, 'badge') + 'Checked in', 'teal-solid') + '<span class="t-meta">' + esc(fmtClock(inv.checked_in_at)) + SEP + 'enjoy your night</span></div>'
        : '<div class="checkin-status">' + ui.tag('Show at the door', 'teal') + '<span class="t-meta">Updates live when the venue scans</span></div>';
      var action = checked
        ? ui.button('Deliverables', { cls: 'btn-primary btn-lg btn-block', nav: '/collabs/' + inv.invite_id + '/deliverables', id: 'checkin-deliverables' })
        : ui.button('Back to invites', { cls: 'btn-ghost btn-lg btn-block', nav: '/invites', id: 'checkin-back' });
      return '<div class="checkin">' + ui.header({ left: 'back', title: 'Check-in code' }) +
        '<div class="section mt-6"><div class="card checkin-card" data-status="' + esc(inv.status) + '">' + status + qr(code) +
        '<div class="checkin-code" id="checkin-code">' + esc(code) + '</div>' +
        '<div class="t-body">Show this at the door</div>' +
        '<div class="card-meta mt-1">' + (slot ? esc(D().slotLabelLong(slot)) : '') + '</div>' +
        '<div class="divider mt-4"></div>' +
        '<div class="row gap-3 mt-4">' + ui.artThumb(v.art || o.art) + '<div class="grow"><div class="card-title">' + esc(v.venue_name || '') + '</div>' +
        '<div class="card-meta">' + esc(o.experience_name || '') + SEP + esc(plural(inv.guest_count || 1, 'guest', 'guests')) + '</div></div></div>' +
        '</div><div class="mt-6">' + action + '</div></div></div>';
    },
    mount: function (p) {
      var b = inviteBundle(p.invite_id);
      var refreshed = isRefresh();
      if (!b) return null;
      var inv = b.inv, v = b.venue;
      if (!acceptedOrCheckedIn(inv)) { navigate('/invites/' + inv.invite_id, { replace: true }); return null; }
      if (!refreshed) {
        track('Check-in Code Shown', { offer_id: inv.offer_id, invite_id: inv.invite_id, venue_name: v.venue_name || inv.venue_id, slot_id: inv.accepted_slot_id }, inv.venue_id);
        bump(5);
      }
      return subscribe();
    }
  };

  /* ════════════════════════════════════════════════════════════════════════════════════════ */
  /* deliverables — /collabs/:invite_id/deliverables                                            */
  /* ════════════════════════════════════════════════════════════════════════════════════════ */
  function toggleRow(id, label, sub, on) {
    return '<div class="card form-row"><div><div class="t-body">' + label + '</div><div class="t-meta mt-1">' + sub + '</div></div>' +
      '<button class="toggle' + (on ? '' : ' is-off') + '" type="button" role="switch" aria-checked="' + (on ? 'true' : 'false') + '" id="' + id + '" aria-label="' + label + '"></button></div>';
  }
  function yesNo(b) { return b ? 'Yes' : 'No'; }
  screens.deliverables = {
    role: 'creator', tab: 'invites', tabbar: 'creator', tracked: true,
    title: function () { return 'Deliverables'; },
    venueGroup: function (p) { var b = inviteBundle(p.invite_id); return b ? b.inv.venue_id : null; },
    render: function (p) {
      var b = inviteBundle(p.invite_id);
      if (!b) return notFound('/collabs/' + p.invite_id + '/deliverables');
      var inv = b.inv, o = b.offer, v = b.venue;
      if (!acceptedOrCheckedIn(inv)) return '';
      var head = ui.header({ left: 'back', title: 'Deliverables' });
      var intro = '<div class="card deliverables-offer row gap-4">' + ui.artThumb(o.art || v.art) + '<div class="grow"><div class="card-title">' + esc(o.experience_name || '') + '</div>' +
        '<div class="card-meta mt-1">' + esc(v.venue_name || '') + SEP + esc(o.deliverables || '') + '</div></div></div>';
      if (inv.deliverables) {
        var d = inv.deliverables;
        return '<div class="deliverables">' + head + '<div class="section mt-6 stack gap-3">' + intro +
          '<div class="card"><div class="row-between"><h2 class="card-title">Submitted</h2>' + ui.tag(ui.icon('check', 12, 'badge') + 'Done', 'teal-solid') + '</div>' +
          kvRows([['Stories posted', esc(d.stories_posted)], ['Venue tagged', yesNo(d.venue_tagged)], ['Posted on time', yesNo(d.on_time)], ['Submitted', esc(fmtClock(d.at))]]) + '</div>' +
          ui.button('Back to invites', { cls: 'btn-ghost btn-lg btn-block', nav: '/invites' }) + '</div></div>';
      }
      return '<div class="deliverables">' + head + '<div class="section mt-6 stack gap-3">' + intro +
        '<div class="card form-row"><div><div class="t-body">Stories posted</div><div class="t-meta mt-1">Tagged @' + esc(String(v.venue_name || 'venue').toLowerCase().replace(/[^a-z0-9]+/g, '')) + '</div></div>' +
        '<div class="stepper"><button class="stepper-btn" type="button" id="stories-minus" aria-label="Fewer stories">' + ui.icon('minus', 20) + '</button>' +
        '<span class="stepper-value" id="stories-value" aria-live="polite">4</span>' +
        '<button class="stepper-btn" type="button" id="stories-plus" aria-label="More stories">' + ui.icon('plus', 20) + '</button></div></div>' +
        toggleRow('toggle-tagged', 'Venue tagged', 'Location and handle in every story', true) +
        toggleRow('toggle-ontime', 'Posted on time', 'Within 48 hours of the visit', true) +
        '<div class="mt-3">' + ui.button('Submit deliverables', { cls: 'btn-primary btn-lg btn-block', id: 'deliverables-submit' }) + '</div>' +
        '</div></div>';
    },
    mount: function (p, root) {
      var b = inviteBundle(p.invite_id);
      isRefresh();
      if (!b) return null;
      var inv = b.inv, v = b.venue;
      if (!acceptedOrCheckedIn(inv)) { navigate('/invites/' + inv.invite_id, { replace: true }); return null; }
      if (inv.deliverables) return null;
      var stories = 4;
      var val = root.querySelector('#stories-value'), minus = root.querySelector('#stories-minus'), plus = root.querySelector('#stories-plus');
      var tagged = root.querySelector('#toggle-tagged'), ontime = root.querySelector('#toggle-ontime'), submit = root.querySelector('#deliverables-submit');
      function paint() { if (val) val.textContent = stories; if (minus) minus.disabled = stories <= 1; if (plus) plus.disabled = stories >= 10; }
      function flip(t) { var on = t.getAttribute('aria-checked') !== 'true'; t.setAttribute('aria-checked', on ? 'true' : 'false'); t.classList.toggle('is-off', !on); }
      function isOn(t) { return !!t && t.getAttribute('aria-checked') === 'true'; }
      if (minus) minus.addEventListener('click', function () { if (stories > 1) { stories -= 1; paint(); } });
      if (plus) plus.addEventListener('click', function () { if (stories < 10) { stories += 1; paint(); } });
      if (tagged) tagged.addEventListener('click', function () { flip(tagged); });
      if (ontime) ontime.addEventListener('click', function () { flip(ontime); });
      if (submit) submit.addEventListener('click', function () {
        submit.disabled = true;
        var d = { stories_posted: stories, venue_tagged: isOn(tagged), on_time: isOn(ontime) };
        var res = S().submitDeliverables(inv.invite_id, d);
        if (!res) { submit.disabled = false; ui.toast('Could not submit — try again'); return; }
        track('Deliverables Submitted', { offer_id: inv.offer_id, invite_id: inv.invite_id, venue_name: v.venue_name || inv.venue_id, stories_posted: d.stories_posted, venue_tagged: d.venue_tagged, on_time: d.on_time }, inv.venue_id);
        ui.toast('Deliverables submitted');
        navigate('/invites');
      });
      paint();
      return null;
    }
  };

  /* ════════════════════════════════════════════════════════════════════════════════════════ */
  /* profile — /profile                                                                         */
  /* ════════════════════════════════════════════════════════════════════════════════════════ */
  var PERSONA_ART = { sara: 'beauty', omar: 'dining' };
  var PERSONA_FOLLOWERS = { sara: '18K', omar: '14K' };
  var profilePanel = 'engagement';
  screens.profile = {
    role: 'creator', tab: 'profile', tabbar: 'creator', tracked: true,
    title: function () { return 'Profile'; },
    render: function () {
      var s = session(), name = firstName(), uid = s.user_id || '', prof = profile(), att = s.attribution || {};
      var persona = String(s.persona || 'sara').toLowerCase();
      var art = PERSONA_ART[persona] || 'beauty';
      var invites = myInvites(), apps = myApplications(), saved = savedList();
      var checked = invites.filter(function (i) { return i.status === 'checked_in'; }).length;
      var handle = '@' + persona + '.dxb';
      var eng = profilePanel === 'engagement';
      return '<div class="profile">' +
        '<div class="hero is-profile profile-hero"><div class="art art-' + esc(art) + ' art-portrait"></div><div class="hero-scrim"></div>' +
        ui.header({ left: 'pill', name: name, icon: 'user-round', chevron: true, overlay: true,
          actions: [ui.iconBtn('pencil', { label: 'Edit profile', id: 'profile-edit' }), ui.iconBtn('menu', { label: 'Menu', id: 'profile-menu' })] }) +
        '<div class="profile-photos"><span class="photo-bars" aria-hidden="true"><i class="is-on"></i><i></i><i></i><i></i></span><span class="t-meta-sm">1/4 photos</span></div>' +
        '</div>' +
        '<div class="section profile-head"><div class="avatar art art-' + esc(art) + ' art-portrait profile-avatar"></div>' +
        '<h1 class="profile-name">' + esc(name) + ' Demo</h1><div class="profile-role">Blogger</div></div>' +
        '<div class="section mt-5"><div class="seg" role="tablist" aria-label="Profile sections">' +
        '<button class="seg-item' + (eng ? ' is-active' : '') + '" type="button" role="tab" aria-selected="' + (eng ? 'true' : 'false') + '" data-panel="engagement">Engagement</button>' +
        '<button class="seg-item' + (eng ? '' : ' is-active') + '" type="button" role="tab" aria-selected="' + (eng ? 'false' : 'true') + '" data-panel="health">Profile health</button></div></div>' +
        '<div class="section mt-5" data-panel-body="engagement"' + (eng ? '' : ' hidden') + '>' +
        '<div class="profile-grid">' +
        '<div class="card stat-card"><div class="t-big-stat">' + esc(PERSONA_FOLLOWERS[persona] || '18K') + '</div><div class="t-body c-muted">Followers</div><div class="divider mt-4"></div>' +
        '<div class="t-meta-sm mt-4">Linked account</div><span class="row gap-1 mt-1"><span class="link-gradient">' + esc(handle) + '</span>' + ui.icon('arrow-up-right', 16) + '</span></div>' +
        '<div class="card stat-card"><div class="donut" role="img" aria-label="Audience: 55% female, 45% male"><span class="donut-label">Followers</span></div>' +
        '<div class="legend mt-3"><span class="legend-dot is-a"></span>55% Female</div><div class="legend"><span class="legend-dot is-b"></span>45% Male</div></div>' +
        '</div>' +
        '<div class="stat-row profile-stats mt-4">' + statTile(apps.length, 'Applied', { gradient: true }) + statTile(invites.length, 'Invites', { dot: pendingInvites() > 0 }) + statTile(checked, 'Check-ins') + statTile(saved.length, 'Saved') + '</div>' +
        '</div>' +
        '<div class="section mt-5" data-panel-body="health"' + (eng ? ' hidden' : '') + '>' +
        '<div class="card"><h2 class="card-title">Creator profile</h2>' + kvRows([
          ['Niche', esc(prof.primary_niche)], ['Followers', esc(prof.follower_band)], ['Home city', esc(prof.home_city)],
          ['Track record', esc(prof.track_record)], ['Device', esc(prof.device_type)], ['Member since', s.mode === 'login' ? '180 days' : 'Today']
        ]) + '</div>' +
        '<div class="card mt-3"><h2 class="card-title">Attribution</h2>' + kvRows([
          ['utm_source', esc(att.utm_source || '')], ['utm_medium', esc(att.utm_medium || '')], ['utm_campaign', esc(att.utm_campaign || '')], ['referrer', esc(att.referring_domain || '')]
        ]) + '</div>' +
        '</div>' +
        '<div class="section mt-5"><div class="card demo-id-card"><span class="t-label c-muted">Your demo ID</span>' +
        '<div class="row-between gap-3"><span class="demo-id-value" id="profile-user-id">' + esc(uid) + '</span>' + ui.button('Copy', { cls: 'btn-secondary btn-sm', id: 'profile-copy' }) + '</div>' +
        '<span class="t-meta-sm">' + (s.mode === 'login' ? 'Returning member' : 'New member this rehearsal') + SEP + 'Amplitude user_id</span></div></div>' +
        '<div class="section mt-6 screen-foot">' + ui.button('Log out', { cls: 'btn-secondary btn-lg btn-block', icon: 'log-out', id: 'logout' }) + '</div>' +
        '</div>';
    },
    mount: function (p, root) {
      isRefresh();
      var tabs = root.querySelectorAll('[data-panel]');
      for (var i = 0; i < tabs.length; i++) {
        tabs[i].addEventListener('click', function () {
          profilePanel = this.getAttribute('data-panel');
          for (var j = 0; j < tabs.length; j++) {
            var on = tabs[j] === this;
            tabs[j].classList.toggle('is-active', on);
            tabs[j].setAttribute('aria-selected', on ? 'true' : 'false');
          }
          var bodies = root.querySelectorAll('[data-panel-body]');
          for (var k = 0; k < bodies.length; k++) bodies[k].hidden = bodies[k].getAttribute('data-panel-body') !== profilePanel;
        });
      }
      var copy = root.querySelector('#profile-copy'), idEl = root.querySelector('#profile-user-id');
      if (copy) copy.addEventListener('click', function () {
        var text = idEl ? idEl.textContent : '';
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { ui.toast('Demo ID copied'); }, function () { ui.toast('Copy blocked — select the ID instead'); });
        else ui.toast('Clipboard not available');
      });
      var inert = root.querySelectorAll('#profile-edit, #profile-menu');
      for (var n = 0; n < inert.length; n++) inert[n].addEventListener('click', function () { ui.toast('Not part of the demo'); });
      var logout = root.querySelector('#logout');
      if (logout) logout.addEventListener('click', function () {
        logout.disabled = true;
        try { TSS.analytics.logout(); }
        catch (e) { if (window.console) console.error('[TSS] logout failed', e); }
        navigate('/', { replace: true });
      });
      return subscribe();
    }
  };

  /* ---------- exports (own namespace; nothing shared is renamed) ---------- */
  B.liveRefresh = liveRefresh;
  B.bindHearts = bindHearts;
  B.isSaved = isSaved;
  B.toggleSaved = toggleSaved;
  B.qr = qr;
  B.statTile = statTile;
  B.emptyState = emptyState;
  B.inviteBundle = inviteBundle;
  B.pendingInvites = pendingInvites;
  B.SUGGESTIONS = SUGGESTIONS;
})();
