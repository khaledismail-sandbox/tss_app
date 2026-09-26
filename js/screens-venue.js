/* screens-venue.js — The Secret Society demo · venue-manager screens (ARCHITECTURE §9 "Venue"):
   venueDashboard · venueCalendar · venueApplications · venueCheckin · venueReview · venueProfile.
   Plain ES2019 browser JS, no modules. Registers into TSS.screens (router.js); its own helpers live in TSS.venueUI.
   Every event / property name below is the SPEC §7.3 contract verbatim. Manager events carry the user-level venue
   group set at login, so no event-level groups are passed here. Screen events fire once per NAVIGATION and never on a
   market-driven refresh (TSS.venueUI.isFreshNav). Every screen subscribes to TSS.state.onMarketChange and re-renders
   through TSS.router.refresh(), so the other window's applications / acceptances show up live. */
window.TSS = window.TSS || {};
(function () {
  'use strict';
  var TSS = window.TSS;
  var screens = TSS.screens = TSS.screens || {};
  var ui = TSS.ui;
  var V = TSS.venueUI = TSS.venueUI || {};
  var esc = function (s) { return ui.escape(s); };
  var SEP = ui.SEP;
  var PAGE_VIEWED = '[Amplitude] Page Viewed';

  /* ---------- module state (survives refreshes; per window) ---------- */
  V.inboxSeg = 'pending';                                  // Applications segment: pending | approved | declined
  V.checkin = { draft: '', last: null, focusNext: false }; // typed code body, invite checked in a moment ago
  V.review = { invite_id: null, rating: 5, punctuality: true, presentation: true, deliverables_complete: true };

  /* ---------- small helpers ---------- */
  function cfg() { return TSS.config || {}; }
  function sess() { try { return TSS.state.getSession(); } catch (e) { return {}; } }
  function venue() { var s = sess(); return s && s.venue_id ? TSS.data.venue(s.venue_id) : null; }
  function demoOffer(v) { return v ? TSS.data.demoOfferForVenue(v.venue_id) : null; }
  function offerOf(id) { return TSS.data.offer(id); }
  function activeOffers(v) { return TSS.data.offersForVenue(v.venue_id).filter(function (o) { return o.demo; }).length; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function fmtClock(ts) { var d = new Date(ts || Date.now()); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
  // "31 Jan 24 2:34 PM" (6.5.5 "Last updated" line)
  function fmtUpdated(ts) {
    var d = new Date(ts || Date.now());
    var h = d.getHours(), h12 = h % 12 || 12;
    return d.getDate() + ' ' + TSS.data.MONTHS_SHORT[d.getMonth()] + ' ' + String(d.getFullYear()).slice(2) + ' ' + h12 + ':' + pad2(d.getMinutes()) + ' ' + (h < 12 ? 'AM' : 'PM');
  }
  var PERSONA_ART = { sara: 'beauty', omar: 'dining' };
  var ART_CYCLE = ['beauty', 'dining', 'wellness', 'fitness', 'rooftop', 'cafe'];
  function personaArt(p) {
    var k = String(p || '').toLowerCase();
    if (PERSONA_ART[k]) return PERSONA_ART[k];
    var h = 0;
    for (var i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
    return ART_CYCLE[h % ART_CYCLE.length];
  }
  // tssIcon with an extra class on the <svg> (e.g. the dash-tile arrow)
  function icon(name, size, stroke, cls) {
    var svg = ui.icon(name, size, stroke);
    return cls ? svg.replace('class="icon ', 'class="icon ' + cls + ' ') : svg;
  }
  function slotById(offer, id) {
    if (!id || id === 'unassigned') return null;
    var slots = (offer && offer.slots) || [];
    for (var i = 0; i < slots.length; i++) if (slots[i].slot_id === id) return slots[i];
    return TSS.data.slotById(id);
  }
  function slotShort(slot) { return slot ? TSS.data.slotLabel(slot) : 'unassigned'; }          // 'Sat 14:00'
  function slotLong(slot) { return slot ? TSS.data.slotLabelLong(slot) : 'Slot not chosen yet'; } // 'Saturday 4 Oct · 14:00'
  function slotDay(slot) { var d = TSS.data.slotDate(slot); return slot.weekday + ' ' + d.getDate() + ' ' + TSS.data.MONTHS_SHORT[d.getMonth()]; }
  function slotDayShort(slot) { var d = TSS.data.slotDate(slot); return TSS.data.WEEKDAYS_SHORT[d.getDay()] + ' ' + d.getDate() + ' ' + TSS.data.MONTHS_SHORT[d.getMonth()]; }
  function plural(n, one, many) { n = Number(n) || 0; return n + ' ' + (n === 1 ? one : many); }
  function guests(n) { return plural(Math.max(1, Number(n) || 1), 'guest', 'guests'); }
  function niche() { return (cfg().BLOGGER_PROFILE || {}).primary_niche || 'lifestyle'; }
  function followerBand(app) { return (app && app.follower_band) || (cfg().BLOGGER_PROFILE || {}).follower_band || '10k-25k'; }
  function creditsFor(offer, inv) { return (offer ? Number(offer.credits_per_guest) || 1 : 1) * Math.max(1, Number(inv && inv.guest_count) || 1); }
  function price() { return Number(cfg().CREDIT_PRICE_AED) || 120; }
  function isPending(a) { return a.status === 'pending'; }
  function isApproved(a) { return a.status === 'approved'; }
  function isRejected(a) { return a.status === 'rejected'; }
  function navigate(p, o) { TSS.router.navigate(p, o); }
  function refresh() { TSS.router.refresh(); }
  function track(ev, props, opts) {
    try { return TSS.analytics.track(ev, props, opts); }
    catch (e) { if (window.console) console.error('[TSS] track failed', ev, e); return null; }
  }
  function bump(n) { try { TSS.analytics.bumpFunnel(n); } catch (e) { /* ignore */ } }
  function toast(t) { try { ui.toast(t); } catch (e) { /* ignore */ } }
  function subscribe() { return TSS.state.onMarketChange(function () { refresh(); }); }
  function currentPath() { try { return TSS.router.current().path; } catch (e) { return location.pathname; } }
  function notFound() {
    return screens.notFound ? screens.notFound.render({ path: currentPath() }) : '<div class="section pad-top"><p class="mt-10">Not found</p></div>';
  }

  // Once per navigation: the router records '[Amplitude] Page Viewed' right before it renders + mounts, so on a real
  // navigation the newest debug entry is a Page Viewed this screen has not seen yet. A market-driven refresh() re-mounts
  // with nothing new on top (or with the screen's own action events, which are not page views). If the log cannot be
  // read at all, the first mount counts as fresh so the screen event is never lost.
  var consumedPV = {};
  V.isFreshNav = function (key) {
    var top = null;
    try { top = (TSS.analytics.getDebugLog() || [])[0] || null; } catch (e) { top = null; }
    if (!top || top.event_type !== PAGE_VIEWED) {
      if (Object.prototype.hasOwnProperty.call(consumedPV, key)) return false;
      consumedPV[key] = null;
      return true;
    }
    if (consumedPV[key] === top.insert_id) return false;
    consumedPV[key] = top.insert_id;
    return true;
  };

  /* ---------- shared markup ---------- */
  function bellBtn(v, opts) {
    opts = opts || {};
    var pending = v ? TSS.state.pendingFor(v.venue_id).length : 0;
    return ui.iconBtn('bell', { badge: pending > 0 ? pending : null, label: 'Notifications', nav: opts.nav === null ? undefined : (opts.nav || '/venue/applications') });
  }
  function pillHeader(v, actions) {
    return ui.header({ left: 'pill', name: v.manager_name || 'Manager', icon: 'briefcase', chevron: false, actions: actions });
  }
  function sectionHead(title, right, cls) {
    return '<div class="section section-head' + (cls ? ' ' + cls : '') + '"><h2 class="t-h2">' + title + '</h2>' + (right || '') + '</div>';
  }
  function seeAll(nav, label) {
    return '<button class="section-link" type="button" data-nav="' + esc(nav) + '">' + (label || 'See All') + ' ' + icon('arrow-up-right', 19) + '</button>';
  }
  function seatDots(taken, seats) {
    var out = '<span class="seat-dots" aria-hidden="true">';
    for (var i = 0; i < seats; i++) out += '<span class="seat-dot' + (i < taken ? ' is-taken' : '') + '"></span>';
    return out + '</span>';
  }
  function kvLine(k, v, mono) { return '<div class="kv-line"><span class="k">' + k + '</span><span class="v' + (mono ? ' mono' : '') + '">' + v + '</span></div>'; }
  function yesNo(b) { return b ? 'Yes' : 'No'; }
  function statTile(n, label, gradient) {
    return '<div class="stat-tile' + (gradient ? ' gradient' : '') + '"><span class="stat-tile-number">' + esc(n) + '</span><span class="stat-tile-label">' + label + '</span></div>';
  }
  // Dashboard tile (100×100): status square with a count, ↗ in meta grey, two-line label. No nav → inert (Create tile).
  function tile(o) {
    var tag = o.nav ? 'a' : 'div';
    var attrs = ' class="dash-tile' + (o.cls ? ' ' + o.cls : '') + '"' +
      (o.nav ? ' href="' + esc((cfg().BASE || '/tss-demo') + o.nav) + '" data-nav="' + esc(o.nav) + '"' : ' role="button" aria-disabled="true"') +
      (o.data ? ' data-tile="' + esc(o.data) + '"' : '');
    return '<' + tag + attrs + '>' +
      '<span class="dash-tile-icon ' + o.icon + '">' + o.value + '</span>' +
      (o.nav ? icon('arrow-up-right', 18, 'bold', 'dash-tile-arrow') : '') +
      '<span class="dash-tile-label">' + o.label + '</span>' +
      '</' + tag + '>';
  }
  // Task card (6.5.5): thumb · teal tag · title · meta · caption · gradient CTA
  function taskCard(o) {
    return '<article class="card task-card"' + (o.id ? ' id="' + esc(o.id) + '"' : '') + '>' +
      '<div class="thumb art art-' + esc(o.art || 'nightlife') + '"></div>' +
      '<div class="task-card-body">' + ui.tag(o.tag, o.tagKind || 'teal') +
      '<h3 class="card-title">' + o.title + '</h3>' +
      '<div class="card-meta">' + o.meta + '</div>' +
      '<span class="t-caption">' + o.caption + '</span>' +
      ui.button(o.cta, { cls: 'btn-primary is-wide', nav: o.nav, id: o.ctaId }) +
      '</div></article>';
  }
  // To Review-style row with an optional footer under the text (status tags, or the Decline | Approve pair)
  function vaRow(o) {
    var attrs = ' class="list-row va-row' + (o.cls ? ' ' + o.cls : '') + '"' + (o.id ? ' id="' + esc(o.id) + '"' : '');
    if (o.data) Object.keys(o.data).forEach(function (k) { attrs += ' data-' + k + '="' + esc(o.data[k]) + '"'; });
    return '<div' + attrs + '>' + ui.artThumb(o.avatarArt, { portrait: true, checked: !!o.checked }) +
      '<div class="list-row-body"><div class="list-row-title">' + o.title + '</div>' +
      (o.sub ? '<div class="list-row-sub">' + o.sub + '</div>' : '') +
      (o.meta ? '<div class="list-row-meta">' + o.meta + '</div>' : '') +
      (o.foot ? '<div class="va-row-foot' + (o.footCls ? ' ' + o.footCls : '') + '">' + o.foot + '</div>' : '') + '</div>' +
      (o.action ? '<div class="list-row-action">' + o.action + '</div>' : '') +
      '</div>';
  }
  function pendingRow(app, primaryAction, primaryLabel) {
    return vaRow({
      avatarArt: personaArt(app.persona), title: esc(app.blogger_name), data: { app: app.app_id },
      sub: 'Influencer' + SEP + esc(followerBand(app)) + SEP + esc(niche()),
      meta: 'Applied ' + fmtClock(app.submitted_at) + SEP + esc(guests(app.guest_count)) + SEP + esc(app.pitch_length_chars) + '-char pitch',
      footCls: 'is-actions',
      foot: '<button class="btn btn-secondary btn-sm" type="button" data-action="decline" data-app="' + esc(app.app_id) + '">Decline</button>' +
        '<button class="btn btn-primary btn-sm" type="button" data-action="' + primaryAction + '" data-app="' + esc(app.app_id) + '">' + primaryLabel + '</button>'
    });
  }
  // Checked-in guest row with the "Rate" gradient link (dashboard, check-in screen)
  function checkinRow(inv) {
    var offer = offerOf(inv.offer_id), slot = slotById(offer, inv.accepted_slot_id);
    var action = inv.rating
      ? ui.tag('Rated ' + esc(Number(inv.rating.rating)) + '/5', 'teal')
      : '<button class="link-gradient" type="button" data-nav="/venue/collabs/' + esc(inv.invite_id) + '/review" data-rate="' + esc(inv.invite_id) + '">Rate</button>';
    return vaRow({
      avatarArt: personaArt(inv.persona), checked: true, title: esc(inv.blogger_name), data: { invite: inv.invite_id },
      sub: 'Influencer' + SEP + esc(followerBand(TSS.state.application(inv.app_id))),
      meta: 'Checked in ' + fmtClock(inv.checked_in_at) + SEP + esc(slotShort(slot)) + SEP + esc(guests(inv.guest_count)),
      action: action
    });
  }

  /* ---------- approval / rejection flows (shared by calendar + inbox) ---------- */
  var REASONS = [
    ['capacity_reached', 'Capacity reached', 'Every seat for this offer is spoken for'],
    ['profile_fit', 'Not the right fit', 'Content style does not match the venue'],
    ['follower_threshold', 'Below follower threshold', 'Reach is under the venue minimum']
  ];
  V.REASONS = REASONS;

  function radioRows(el, selector, attr, onPick) {
    var items = Array.prototype.slice.call(el.querySelectorAll(selector));
    items.forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        items.forEach(function (b) { var on = b === btn; b.classList.toggle('is-selected', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); });
        onPick(btn.getAttribute(attr));
      });
    });
  }

  // Slot calendar: approve INTO a seat. Sheet lists the offer's slots; default = first slot with a free seat.
  function openSeatSheet(app, offer, v) {
    var rows = TSS.state.slotAvailability(offer.offer_id, { forUnseatedInvite: false });
    var free = rows.filter(function (r) { return !r.is_full; });
    var selected = free.length ? free[0].slot_id : null;
    function label(id) {
      var r = rows.filter(function (x) { return x.slot_id === id; })[0];
      return r ? 'Approve into ' + slotShort(r.slot) : 'No seats left';
    }
    var body = '<div class="pick-list" role="radiogroup" aria-label="Seat">' + rows.map(function (r) {
      var on = r.slot_id === selected;
      return '<button class="pick slot-pick' + (on ? ' is-selected' : '') + (r.is_full ? ' is-full' : '') + '" type="button" role="radio" aria-checked="' + (on ? 'true' : 'false') + '" data-slot="' + esc(r.slot_id) + '"' + (r.is_full ? ' disabled' : '') + '>' +
        '<span class="pick-body"><span class="pick-title">' + esc(slotDay(r.slot)) + SEP + esc(r.slot.time) + '</span>' +
        '<span class="pick-sub">' + (r.is_full ? 'Full' : esc(r.left + ' of ' + r.slot.seats + ' seats free')) + '</span></span>' +
        (r.is_full ? ui.tag('Full', 'red') : seatDots(r.taken, r.slot.seats)) +
        '<span class="persona-check">' + icon('check', 14, 'badge') + '</span></button>';
    }).join('') + '</div>';
    var el = ui.sheet.open({
      title: 'Approve ' + esc(app.blogger_name),
      sub: esc(offer.experience_name) + SEP + esc(guests(app.guest_count)) + SEP + 'choose a seat',
      body: body,
      primary: { label: label(selected), id: 'seat-approve', onClick: approve },
      dismissible: true
    });
    if (!el) return;
    var primary = el.querySelector('[data-sheet-primary]');
    if (!selected && primary) primary.disabled = true;
    radioRows(el, '.slot-pick', 'data-slot', function (id) { selected = id; if (primary) primary.textContent = label(selected); });
    function approve() {
      if (!selected) return;
      var slot = slotById(offer, selected);
      var inv = TSS.state.approveApplication(app.app_id, { approval_source: 'slot_calendar', slot_id: selected });
      if (!inv) { toast('Could not approve — try again'); return; }
      track('Applicant Approved', {
        offer_id: app.offer_id, venue_name: v.venue_name, approval_source: 'slot_calendar',
        seat_assigned: !!inv.seat_reserved, slot_id: inv.slot_id || 'unassigned',
        applicant_follower_band: followerBand(app), approval_style: v.approval_style
      });
      bump(3);
      ui.sheet.close();
      toast(app.blogger_name + ' placed in ' + slotShort(slot));
    }
  }

  // Inbox: approve with NO seat (the creator picks a slot later). Returns the invite.
  function approveFromInbox(app, v) {
    var inv = TSS.state.approveApplication(app.app_id, { approval_source: 'inbox', slot_id: null });
    if (!inv) { toast('Could not approve — try again'); return null; }
    track('Applicant Approved', {
      offer_id: app.offer_id, venue_name: v.venue_name, approval_source: 'inbox',
      seat_assigned: !!inv.seat_reserved, slot_id: inv.slot_id || 'unassigned',
      applicant_follower_band: followerBand(app), approval_style: v.approval_style
    });
    bump(3);
    return inv;
  }
  function approveAll(v, offer) {
    var list = TSS.state.pendingFor(v.venue_id);
    if (!list.length) return;
    track('Bulk Approve Used', { offer_id: offer ? offer.offer_id : list[0].offer_id, approved_count: list.length, seat_assignment: 'manual' });
    var n = 0;
    list.forEach(function (app) { if (approveFromInbox(app, v)) n += 1; });
    toast(n + ' approved — creators pick their own slots');
  }

  function openDeclineSheet(app, offer, source) {
    var selected = REASONS[0][0];
    var body = '<div class="pick-list" role="radiogroup" aria-label="Reason">' + REASONS.map(function (r, i) {
      var on = i === 0;
      return '<button class="pick reason-pick' + (on ? ' is-selected' : '') + '" type="button" role="radio" aria-checked="' + (on ? 'true' : 'false') + '" data-reason="' + r[0] + '">' +
        '<span class="pick-body"><span class="pick-title">' + r[1] + '</span><span class="pick-sub">' + r[2] + '</span></span>' +
        '<span class="persona-check">' + icon('check', 14, 'badge') + '</span></button>';
    }).join('') + '</div>';
    var el = ui.sheet.open({
      title: 'Decline ' + esc(app.blogger_name) + '?',
      sub: esc(offer ? offer.experience_name : app.offer_id) + SEP + 'the creator sees “Declined”, never the reason',
      body: body,
      primary: { label: 'Decline application', id: 'decline-confirm', onClick: decline },
      secondary: { label: 'Keep in review', id: 'decline-cancel', onClick: function () { ui.sheet.close(); } },
      dismissible: true
    });
    if (!el) return;
    radioRows(el, '.reason-pick', 'data-reason', function (r) { selected = r; });
    function decline() {
      var rec = TSS.state.rejectApplication(app.app_id, selected);
      if (!rec || rec.status !== 'rejected') { toast('Could not decline'); ui.sheet.close(); return; }
      track('Applicant Rejected', { offer_id: app.offer_id, approval_source: source, reason: rec.reject_reason || selected });
      ui.sheet.close();
      toast(app.blogger_name + ' declined');
    }
  }

  /* ====================================================================================================== */
  /* venueDashboard — /venue/dashboard                                                                        */
  /* ====================================================================================================== */
  screens.venueDashboard = {
    role: 'venue_manager', tab: 'dashboard', tabbar: 'venue', tracked: true,
    title: function () { return 'Venue dashboard'; },
    render: function () {
      var v = venue();
      if (!v) return notFound();
      var offer = demoOffer(v);
      var stats = TSS.state.venueStats(v.venue_id);
      var accepted = TSS.state.invitesForVenue(v.venue_id).filter(function (i) { return i.status === 'accepted'; }).length;
      var checkins = TSS.state.checkinsFor(v.venue_id);
      var isSlot = v.approval_style === 'slot_calendar';
      var cards = '';
      if (offer) {
        var avail = TSS.state.offerAvailability(offer.offer_id);
        var first = offer.slots[0];
        cards += taskCard({
          id: 'task-offer', art: offer.art, tag: 'Open for applications', title: esc(offer.experience_name),
          meta: (first ? esc(slotDayShort(first)) + SEP + esc(first.time) : esc(v.venue_name)) + SEP + esc(plural(avail.seats_left, 'seat', 'seats')),
          caption: stats.pending ? esc(plural(stats.pending, 'pending applicant', 'pending applicants')) : 'No new applicants',
          cta: isSlot ? 'Open slot calendar' : 'Review applications', ctaId: 'task-cta',
          nav: isSlot ? '/venue/offers/' + offer.offer_id + '/calendar' : '/venue/applications'
        });
      }
      cards += taskCard({
        id: 'task-door', art: v.art, tag: 'At the door', tagKind: 'outline', title: 'Guest check-in',
        meta: esc(plural(accepted, 'guest expected', 'guests expected')) + SEP + esc(stats.checked_in) + ' checked in',
        caption: accepted ? esc(plural(accepted, 'code active', 'codes active')) : 'No codes yet',
        cta: 'Scan guest code', ctaId: 'task-cta-door', nav: '/venue/checkin'
      });
      var recent = checkins.slice(0, 3).map(checkinRow).join('');
      return '<div class="va-page va-dash">' +
        pillHeader(v, [ui.iconBtn('search', { label: 'Search' }), bellBtn(v)]) +
        '<div class="section mt-6 row center gap-2 c-secondary va-updated">' + icon('refresh-cw', 12) +
        '<span class="t-meta c-secondary">Last updated : <span id="dash-updated">' + esc(fmtUpdated()) + '</span></span></div>' +
        sectionHead('Your Tasks', seeAll('/venue/applications'), 'mt-8') +
        '<div class="scroll-x task-carousel mt-title">' + cards + '</div>' +
        '<div class="section venue-row mt-8"><div class="thumb is-lg art art-' + esc(v.art || 'nightlife') + '"></div>' +
        '<div class="venue-row-body"><span class="venue-row-caption">The Secret Society</span><span class="venue-row-title">Events at ' + esc(v.venue_name) + '</span></div></div>' +
        '<div class="section mt-5"><div class="dash-grid">' +
        tile({ icon: 'is-red', value: esc(stats.pending), label: 'Under<br>review', nav: '/venue/applications', data: 'pending' }) +
        tile({ icon: 'is-teal', value: esc(stats.approved), label: 'Approved<br>creators', nav: '/venue/applications', data: 'approved' }) +
        tile({ icon: 'is-green', value: esc(stats.checked_in), label: 'Checked<br>in', nav: '/venue/checkin', data: 'checked_in' }) +
        tile({ icon: 'is-purple', value: esc(stats.credits_balance), label: 'Credits<br>balance', nav: '/venue/profile', data: 'credits' }) +
        tile({ icon: 'is-neutral', value: esc(activeOffers(v)), label: 'Active<br>offers', nav: isSlot && offer ? '/venue/offers/' + offer.offer_id + '/calendar' : '/venue/applications', data: 'offers' }) +
        tile({ icon: 'is-accent', value: icon('plus', 16, 'heavy'), label: 'Create<br>new event', cls: 'is-create', data: 'create' }) +
        '</div></div>' +
        (recent ? sectionHead('Recent check-ins', seeAll('/venue/checkin'), 'mt-8') + '<div class="section mt-4 stack gap-4" id="dash-checkins">' + recent + '</div>' : '') +
        '</div>';
    },
    mount: function () {
      var v = venue();
      if (!v) return null;
      if (V.isFreshNav('venueDashboard')) {
        var stats = TSS.state.venueStats(v.venue_id);
        track('Venue Dashboard Viewed', { venue_id: v.venue_id, venue_name: v.venue_name, credits_balance: stats.credits_balance, active_offers: activeOffers(v) });
        bump(1);
      }
      return subscribe();
    }
  };

  /* ====================================================================================================== */
  /* venueCalendar — /venue/offers/:offer_id/calendar (Slot Planner approval surface)                         */
  /* ====================================================================================================== */
  function calendarOffer(params) {
    var v = venue(), offer = offerOf(params && params.offer_id);
    return v && offer && offer.venue_id === v.venue_id ? { venue: v, offer: offer } : null;
  }
  function pendingForOffer(v, offer) {
    return TSS.state.pendingFor(v.venue_id).filter(function (a) { return a.offer_id === offer.offer_id; });
  }
  screens.venueCalendar = {
    role: 'venue_manager', tab: 'applications', tabbar: 'venue', tracked: true,
    title: function (params) { var c = calendarOffer(params); return c ? 'Slot calendar · ' + c.offer.experience_name : 'Not found'; },
    render: function (params) {
      var c = calendarOffer(params);
      if (!c) return notFound();
      var v = c.venue, offer = c.offer;
      var rows = TSS.state.slotAvailability(offer.offer_id, { forUnseatedInvite: false });
      var pending = pendingForOffer(v, offer);
      var cat = TSS.data.categoryBySlug(offer.category_slug);
      var avail = TSS.state.offerAvailability(offer.offer_id);
      var total = rows.reduce(function (n, r) { return n + (Number(r.slot.seats) || 0); }, 0);
      var slotCards = rows.map(function (r) {
        var seated = TSS.state.invitesForSlot(r.slot_id);
        var names = seated.map(function (i) { return ui.tag(esc(i.blogger_name), i.status === 'pending' ? 'outline' : 'teal'); }).join('');
        return '<div class="card slot-card' + (r.is_full ? ' is-full' : '') + '" data-slot="' + esc(r.slot_id) + '">' +
          '<div class="slot-card-day">' + esc(slotDay(r.slot)) + '</div>' +
          '<div class="slot-card-time">' + esc(r.slot.time) + '</div>' +
          seatDots(r.taken, r.slot.seats) +
          '<div class="slot-card-meta">' + (r.is_full ? 'Full' : esc(r.left + ' of ' + r.slot.seats + ' seats free')) + '</div>' +
          (names ? '<div class="slot-card-names">' + names + '</div>' : '') +
          '</div>';
      }).join('');
      var applicants = pending.length
        ? pending.map(function (a) { return pendingRow(a, 'seat', 'Place in seat'); }).join('')
        : '<div class="card va-empty">No pending applicants. Approved creators appear in their seats above.</div>';
      return '<div class="va-page va-calendar">' +
        ui.header({ left: 'back', title: 'Slot calendar', badge: pending.length || null, actions: [bellBtn(v)] }) +
        '<div class="section mt-6"><div class="card offer-card">' +
        '<div class="offer-card-head"><div class="thumb art art-' + esc(offer.art || 'nightlife') + '"></div>' +
        '<div class="grow"><div class="t-list-title-strong">' + esc(offer.experience_name) + '</div>' +
        '<div class="card-kv mt-1"><span class="k">Venue :</span> ' + esc(v.venue_name) + '</div></div>' +
        ui.tag('Slot planner', 'teal') + '</div>' +
        '<div class="tag-row mt-4">' + ui.tag(esc(cat ? cat.name : offer.category_slug)) + ui.tag(esc(offer.credits_per_guest + ' credits / guest')) + ui.tag(esc(TSS.data.fmtAED(offer.experience_value))) + '</div>' +
        '<div class="row gap-2 c-secondary mt-5">' + icon('map-pin', 16, 'heavy') + '<span class="t-meta c-secondary">' + esc(avail.seats_left + ' of ' + total + ' seats free across ' + rows.length + ' slots') + SEP + 'Dubai</span></div>' +
        '<div class="btn-row is-wide mt-5">' + ui.button('Applications', { cls: 'btn-secondary', nav: '/venue/applications' }) + ui.button('Check-in', { cls: 'btn-secondary', nav: '/venue/checkin' }) + '</div>' +
        '</div></div>' +
        sectionHead('Slots', '<span class="t-meta c-secondary">' + esc(plural(avail.slots_available, 'slot open', 'slots open')) + '</span>', 'mt-8') +
        '<div class="section mt-4"><div class="slot-grid" id="slot-grid">' + slotCards + '</div></div>' +
        sectionHead('Applicants' + (pending.length ? ' <span class="badge">' + pending.length + '</span>' : ''), '', 'mt-8') +
        '<div class="section mt-4 stack gap-4" id="applicants">' + applicants + '</div>' +
        '</div>';
    },
    mount: function (params, root) {
      var c = calendarOffer(params);
      if (!c) return null;
      var v = c.venue, offer = c.offer;
      if (V.isFreshNav('venueCalendar')) {
        var rows = TSS.state.slotAvailability(offer.offer_id, { forUnseatedInvite: false });
        track('Slot Calendar Viewed', {
          offer_id: offer.offer_id, slots_count: rows.length,
          total_capacity: rows.reduce(function (n, r) { return n + (Number(r.slot.seats) || 0); }, 0),
          applicants_count: pendingForOffer(v, offer).length
        });
      }
      function onClick(e) {
        var b = e.target && e.target.closest ? e.target.closest('[data-action][data-app]') : null;
        if (!b || !root.contains(b)) return;
        var app = TSS.state.application(b.getAttribute('data-app'));
        if (!app || app.status !== 'pending') { toast('This application was already handled'); refresh(); return; }
        var action = b.getAttribute('data-action');
        if (action === 'seat') openSeatSheet(app, offer, v);
        else if (action === 'decline') openDeclineSheet(app, offer, 'slot_calendar');
      }
      root.addEventListener('click', onClick);
      var unsub = subscribe();
      return function () { root.removeEventListener('click', onClick); unsub(); };
    }
  };

  /* ====================================================================================================== */
  /* venueApplications — /venue/applications (Inbox Clearer approval surface — no seat picker anywhere)       */
  /* ====================================================================================================== */
  var SEGS = [['pending', 'Pending'], ['approved', 'Approved'], ['declined', 'Declined']];
  function approvedRow(app) {
    var inv = app.invite_id ? TSS.state.invite(app.invite_id) : null;
    var offer = offerOf(app.offer_id);
    var slot = inv ? slotById(offer, inv.accepted_slot_id || (inv.seat_reserved ? inv.slot_id : null)) : null;
    var status;
    if (!inv) status = ui.tag('Approved', 'teal');
    else if (inv.status === 'checked_in') status = ui.tag('Checked in', 'teal-solid');
    else if (inv.status === 'accepted') status = ui.tag('Accepted' + SEP + esc(slotShort(slot)), 'teal');
    else if (inv.status === 'abandoned') status = ui.tag('Slot unavailable', 'red');
    else status = inv.seat_reserved ? ui.tag(esc(slotShort(slot)) + ' — seat reserved', 'teal') : ui.tag('Picks own slot', 'outline');
    var action = inv && inv.status === 'checked_in' && !inv.rating
      ? '<button class="link-gradient" type="button" data-nav="/venue/collabs/' + esc(inv.invite_id) + '/review">Rate</button>' : '';
    return vaRow({
      avatarArt: personaArt(app.persona), checked: !!(inv && (inv.status === 'accepted' || inv.status === 'checked_in')),
      title: esc(app.blogger_name), data: { app: app.app_id },
      sub: 'Influencer' + SEP + esc(followerBand(app)),
      meta: 'Approved via ' + (app.approval_source === 'slot_calendar' ? 'slot calendar' : 'inbox') + SEP + esc(guests(app.guest_count)) + (inv ? SEP + esc(inv.invite_id) : ''),
      foot: '<div class="tag-row">' + status + '</div>', action: action
    });
  }
  function declinedRow(app) {
    var why = REASONS.filter(function (r) { return r[0] === app.reject_reason; })[0];
    return vaRow({
      avatarArt: personaArt(app.persona), title: esc(app.blogger_name), data: { app: app.app_id },
      sub: 'Influencer' + SEP + esc(followerBand(app)),
      meta: 'Applied ' + fmtClock(app.submitted_at) + SEP + esc(guests(app.guest_count)),
      foot: '<div class="tag-row">' + ui.tag('Declined', 'red') + (why ? ui.tag(esc(why[1])) : '') + '</div>'
    });
  }
  screens.venueApplications = {
    role: 'venue_manager', tab: 'applications', tabbar: 'venue', tracked: true,
    title: function () { return 'Applications'; },
    render: function () {
      var v = venue();
      if (!v) return notFound();
      var offer = demoOffer(v);
      var apps = TSS.state.applicationsFor(v.venue_id); // chronological, oldest first
      var groups = { pending: apps.filter(isPending), approved: apps.filter(isApproved), declined: apps.filter(isRejected) };
      var seg = groups[V.inboxSeg] ? V.inboxSeg : 'pending';
      var list = groups[seg];
      var segHtml = '<div class="seg is-3up" role="tablist" aria-label="Applications">' + SEGS.map(function (s) {
        var on = s[0] === seg;
        return '<button class="seg-item' + (on ? ' is-active' : '') + '" type="button" role="tab" aria-selected="' + (on ? 'true' : 'false') + '" data-seg="' + s[0] + '">' +
          s[1] + (groups[s[0]].length ? ' ' + groups[s[0]].length : '') + '</button>';
      }).join('') + '</div>';
      var body;
      if (seg === 'pending') {
        body = '<div class="inbox-actions mt-6">' +
          '<span class="t-count' + (list.length ? ' accent-text' : ' c-muted') + '" id="inbox-count">' + esc(plural(list.length, 'application pending', 'applications pending')) + '</span>' +
          ui.button('Approve all', { cls: 'btn-primary btn-sm', id: 'approve-all', disabled: !list.length }) + '</div>' +
          (v.approval_style === 'slot_calendar' && offer
            ? '<div class="card tip-card mt-4"><span class="t-body">Tip: place applicants straight into a seat from the Slot calendar — they arrive with their slot reserved.</span>' +
              '<button class="link-gradient" type="button" data-nav="/venue/offers/' + esc(offer.offer_id) + '/calendar">Open slot calendar</button></div>' : '') +
          '<div class="stack gap-4 mt-4" id="inbox-list">' +
          (list.length ? list.map(function (a) { return pendingRow(a, 'approve', 'Approve'); }).join('')
            : '<div class="card va-empty">No pending applications. New creators land here the moment they apply.</div>') + '</div>';
      } else if (seg === 'approved') {
        body = '<div class="stack gap-4 mt-6" id="inbox-list">' + (list.length ? list.map(approvedRow).join('') : '<div class="card va-empty">Nobody approved yet.</div>') + '</div>';
      } else {
        body = '<div class="stack gap-4 mt-6" id="inbox-list">' + (list.length ? list.map(declinedRow).join('') : '<div class="card va-empty">No declined applications.</div>') + '</div>';
      }
      return '<div class="va-page va-inbox">' +
        ui.header({ left: 'title', title: 'Applications', badge: groups.pending.length || null, large: true, actions: [bellBtn(v, { nav: null })] }) +
        '<div class="section is-review mt-8">' + segHtml + body + '</div></div>';
    },
    mount: function (params, root) {
      var v = venue();
      if (!v) return null;
      var offer = demoOffer(v);
      if (V.isFreshNav('venueApplications')) {
        var apps = TSS.state.applicationsFor(v.venue_id);
        track('Applications Inbox Viewed', {
          offer_id: offer ? offer.offer_id : (apps[0] ? apps[0].offer_id : (TSS.data.offersForVenue(v.venue_id)[0] || {}).offer_id || v.venue_id),
          applicants_count: apps.length, pending_count: apps.filter(isPending).length
        });
        if (V.inboxSeg !== 'pending') { V.inboxSeg = 'pending'; refresh(); }
      }
      function onClick(e) {
        var t = e.target;
        if (!t || !t.closest) return;
        var segBtn = t.closest('[data-seg]');
        if (segBtn && root.contains(segBtn)) { V.inboxSeg = segBtn.getAttribute('data-seg'); refresh(); return; }
        var all = t.closest('#approve-all');
        if (all && root.contains(all)) { approveAll(v, offer); return; }
        var b = t.closest('[data-action][data-app]');
        if (!b || !root.contains(b)) return;
        var app = TSS.state.application(b.getAttribute('data-app'));
        if (!app || app.status !== 'pending') { toast('This application was already handled'); refresh(); return; }
        var action = b.getAttribute('data-action');
        if (action === 'approve') { if (approveFromInbox(app, v)) toast(app.blogger_name + ' approved — they pick their own slot'); }
        else if (action === 'decline') openDeclineSheet(app, offerOf(app.offer_id) || offer, 'inbox');
      }
      root.addEventListener('click', onClick);
      var unsub = subscribe();
      return function () { root.removeEventListener('click', onClick); unsub(); };
    }
  };

  /* ====================================================================================================== */
  /* venueCheckin — /venue/checkin (Scan guest code)                                                          */
  /* ====================================================================================================== */
  function normalizeCode(raw) {
    var s = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (s.indexOf('TSS') === 0) s = s.slice(3);
    return s.slice(0, 4);
  }
  function displayCode(body) { return body ? 'TSS-' + body : ''; }
  // Abstract QR-like viewfinder: 9×9 cells, finder blocks in the corners, the rest from a deterministic hash — no image.
  function qrGrid(seed) {
    var str = String(seed || 'tss'), h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    var cells = '';
    for (var k = 0; k < 81; k++) {
      h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0;
      var r = Math.floor(k / 9), c = k % 9;
      var corner = (r < 3 && c < 3) || (r < 3 && c > 5) || (r > 5 && c < 3);
      var on = corner || (h % 100) < 42;
      cells += '<span class="qr-cell' + (on ? ' is-on' : '') + '"></span>';
    }
    return '<div class="qr-grid" aria-hidden="true">' + cells + '</div>';
  }
  function openCheckinSheet(inv, v) {
    var offer = offerOf(inv.offer_id), slot = slotById(offer, inv.accepted_slot_id), app = TSS.state.application(inv.app_id);
    var credits = creditsFor(offer, inv), revenue = credits * price();
    ui.sheet.open({
      title: 'Check in ' + esc(inv.blogger_name) + '?',
      sub: esc(offer ? offer.experience_name : inv.offer_id) + SEP + esc(v.venue_name),
      body: '<div class="kv-list">' +
        kvLine('Slot', esc(slotLong(slot))) +
        kvLine('Guests', esc(guests(inv.guest_count))) +
        kvLine('Credits to consume', esc(plural(credits, 'credit', 'credits'))) +
        kvLine('Experience value', esc(TSS.data.fmtAED(offer ? offer.experience_value : 0))) +
        kvLine('Revenue', '<b>' + esc(TSS.data.fmtAED(revenue)) + '</b>') + '</div>',
      primary: { label: 'Confirm check-in', id: 'checkin-go', onClick: go },
      secondary: { label: 'Cancel', id: 'checkin-cancel', onClick: function () { ui.sheet.close(); } },
      dismissible: true
    });
    function go() {
      V.checkin.last = { invite_id: inv.invite_id, at: Date.now() };
      V.checkin.draft = '';
      var done = TSS.state.checkInInvite(inv.invite_id);
      if (!done || done.status !== 'checked_in') { V.checkin.last = null; ui.sheet.close(); toast('Could not check in'); refresh(); return; }
      track('Guest Checked In', {
        offer_id: inv.offer_id, invite_id: inv.invite_id, venue_name: v.venue_name, venue_category: v.venue_category,
        slot_id: done.accepted_slot_id || inv.accepted_slot_id, slot_time: slot ? slot.time : '00:00',
        guest_count: Math.max(1, Number(done.guest_count) || 1), credits_consumed: credits, credit_price_aed: price(),
        experience_value: offer ? Number(offer.experience_value) : 0, currency: cfg().CURRENCY || 'AED',
        approval_style: v.approval_style, blogger_follower_band: followerBand(app)
      }, { revenue: { productId: inv.offer_id, price: price(), quantity: credits, revenue: revenue, revenueType: 'credits_consumed' } });
      bump(5);
      ui.sheet.close();
      toast(inv.blogger_name + ' checked in · ' + plural(credits, 'credit', 'credits') + ' · ' + TSS.data.fmtAED(revenue));
    }
  }
  screens.venueCheckin = {
    role: 'venue_manager', tab: 'checkin', tabbar: 'venue', tracked: true,
    title: function () { return 'Check-in'; },
    render: function () {
      var v = venue();
      if (!v) return notFound();
      var invites = TSS.state.invitesForVenue(v.venue_id);
      var expected = invites.filter(function (i) { return i.status === 'accepted'; });
      var checkins = TSS.state.checkinsFor(v.venue_id);
      var success = '';
      var last = V.checkin.last ? TSS.state.invite(V.checkin.last.invite_id) : null;
      if (last && last.status === 'checked_in') {
        var lo = offerOf(last.offer_id), ls = slotById(lo, last.accepted_slot_id), lc = creditsFor(lo, last);
        success = '<div class="card checkin-success mt-6" id="checkin-success"><div class="row gap-4">' + ui.artThumb(personaArt(last.persona), { portrait: true, checked: true }) +
          '<div class="grow"><div class="card-title">' + esc(last.blogger_name) + ' checked in</div>' +
          '<div class="card-meta mt-1">' + esc(plural(lc, 'credit', 'credits')) + SEP + esc(TSS.data.fmtAED(lc * price())) + SEP + esc(slotShort(ls)) + '</div></div></div>' +
          '<div class="btn-row is-wide mt-5">' + ui.button('Done', { cls: 'btn-secondary', id: 'checkin-done' }) +
          ui.button('Rate collaboration', { cls: 'btn-primary', nav: '/venue/collabs/' + last.invite_id + '/review', id: 'checkin-rate' }) + '</div></div>';
      }
      var expectedHtml = expected.map(function (i) {
        var o = offerOf(i.offer_id), s = slotById(o, i.accepted_slot_id);
        return vaRow({
          avatarArt: personaArt(i.persona), title: esc(i.blogger_name), data: { invite: i.invite_id },
          sub: esc(o ? o.experience_name : i.offer_id) + SEP + esc(slotShort(s)),
          meta: esc(guests(i.guest_count)) + SEP + 'code on their invite', action: ui.tag('Expected', 'teal')
        });
      }).join('');
      return '<div class="va-page va-checkin">' +
        ui.header({ left: 'title', title: 'Check-in', large: true, actions: [bellBtn(v)] }) +
        '<div class="section">' + success +
        '<div class="card scan-card mt-6">' +
        '<div class="qr-frame"><span class="qr-corner is-tl"></span><span class="qr-corner is-tr"></span><span class="qr-corner is-bl"></span><span class="qr-corner is-br"></span>' + qrGrid(v.venue_id) + '</div>' +
        '<div class="card-title mt-5 text-center">Scan guest code</div>' +
        '<div class="card-meta mt-1 text-center">Ask the creator for the code on their invite</div>' +
        '<label class="field-label mt-5" for="checkin-code">Guest code</label>' +
        '<div class="field code-field"><input id="checkin-code" type="text" inputmode="text" autocomplete="off" autocorrect="off" autocapitalize="characters" spellcheck="false" maxlength="9" placeholder="TSS-XXXX" value="' + esc(displayCode(V.checkin.draft)) + '" aria-label="Guest code"></div>' +
        '<div class="checkin-error" id="checkin-error" role="alert" hidden></div>' +
        ui.button('Confirm', { cls: 'btn-primary btn-lg btn-block mt-4', id: 'checkin-confirm' }) +
        '</div></div>' +
        (expected.length ? sectionHead('Expected guests', '<span class="badge">' + expected.length + '</span>', 'mt-8') + '<div class="section mt-4 stack gap-4" id="expected-list">' + expectedHtml + '</div>' : '') +
        (checkins.length ? sectionHead('Checked in tonight', seeAll('/venue/dashboard'), 'mt-8') + '<div class="section mt-4 stack gap-4" id="checkin-list">' + checkins.map(checkinRow).join('') + '</div>' : '') +
        '</div>';
    },
    mount: function (params, root) {
      var v = venue();
      if (!v) return null;
      var fresh = V.isFreshNav('venueCheckin');
      if (fresh && V.checkin.last) { V.checkin.last = null; V.checkin.draft = ''; V.checkin.focusNext = true; refresh(); return null; }
      var input = root.querySelector('#checkin-code'), err = root.querySelector('#checkin-error');
      var field = input ? input.closest('.field') : null;
      function showError(msg) {
        if (!err) return;
        err.innerHTML = ui.tag(esc(msg), 'red');
        err.hidden = false;
        if (field) { field.classList.remove('is-shake'); void field.offsetWidth; field.classList.add('is-shake'); }
      }
      function clearError() { if (err) { err.hidden = true; err.innerHTML = ''; } }
      function confirm() {
        var body = normalizeCode(input ? input.value : V.checkin.draft);
        if (body.length < 4) { showError('Enter the 4-character code'); if (input) input.focus(); return; }
        var inv = TSS.state.findInviteByCode('TSS-' + body);
        if (!inv || inv.venue_id !== v.venue_id) { showError('Code not found'); return; }
        if (inv.status === 'checked_in') { showError('Already checked in'); return; }
        if (inv.status !== 'accepted') { showError('Invite not accepted yet'); return; }
        clearError();
        openCheckinSheet(inv, v);
      }
      if (input) {
        input.addEventListener('input', function () {
          var body = normalizeCode(input.value);
          V.checkin.draft = body;
          var shown = displayCode(body);
          if (input.value !== shown) {
            input.value = shown;
            try { input.setSelectionRange(shown.length, shown.length); } catch (e) { /* ignore */ }
          }
          clearError();
        });
        input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); confirm(); } });
        if (fresh || V.checkin.focusNext) { V.checkin.focusNext = false; try { input.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
      }
      var btn = root.querySelector('#checkin-confirm');
      if (btn) btn.addEventListener('click', confirm);
      function onClick(e) {
        var d = e.target && e.target.closest ? e.target.closest('#checkin-done') : null;
        if (d && root.contains(d)) { V.checkin.last = null; refresh(); }
      }
      root.addEventListener('click', onClick);
      var unsub = subscribe();
      return function () { root.removeEventListener('click', onClick); unsub(); };
    }
  };

  /* ====================================================================================================== */
  /* venueReview — /venue/collabs/:invite_id/review (Rate collaboration)                                       */
  /* ====================================================================================================== */
  var RATING_LABELS = { 1: 'Poor', 2: 'Below expectations', 3: 'Good', 4: 'Great', 5: 'Outstanding' };
  function stars(n, readonly) {
    var out = '';
    for (var i = 1; i <= 5; i++) {
      var on = i <= n;
      out += readonly
        ? '<span class="star-btn' + (on ? ' is-on' : '') + '">' + icon('star', 28) + '</span>'
        : '<button class="star-btn' + (on ? ' is-on' : '') + '" type="button" role="radio" aria-checked="' + (i === n ? 'true' : 'false') + '" aria-label="' + i + (i === 1 ? ' star' : ' stars') + '" data-star="' + i + '">' + icon('star', 28) + '</button>';
    }
    return out;
  }
  function toggleRow(key, label, sub, on) {
    return '<div class="toggle-row"><div class="grow"><div class="t-body">' + label + '</div><div class="t-meta mt-1">' + esc(sub) + '</div></div>' +
      '<button class="toggle' + (on ? '' : ' is-off') + '" type="button" role="switch" aria-checked="' + (on ? 'true' : 'false') + '" aria-label="' + label + '" data-flag="' + key + '"></button></div>';
  }
  function reviewInvite(params) {
    var v = venue(), inv = TSS.state.invite(params && params.invite_id);
    return v && inv && inv.venue_id === v.venue_id ? { venue: v, invite: inv } : null;
  }
  screens.venueReview = {
    role: 'venue_manager', tab: 'checkin', tabbar: 'venue', tracked: true,
    title: function (params) { return reviewInvite(params) ? 'Rate collaboration' : 'Not found'; },
    render: function (params) {
      var c = reviewInvite(params);
      if (!c) return notFound();
      var inv = c.invite;
      if (V.review.invite_id !== inv.invite_id) V.review = { invite_id: inv.invite_id, rating: 5, punctuality: true, presentation: true, deliverables_complete: true };
      var offer = offerOf(inv.offer_id), slot = slotById(offer, inv.accepted_slot_id), app = TSS.state.application(inv.app_id);
      var who = '<div class="card"><div class="row gap-4">' + ui.artThumb(personaArt(inv.persona), { portrait: true, checked: inv.status === 'checked_in' }) +
        '<div class="grow"><div class="t-list-title">' + esc(inv.blogger_name) + '</div>' +
        '<div class="list-row-sub">Influencer' + SEP + esc(followerBand(app)) + '</div>' +
        '<div class="list-row-meta">' + esc(offer ? offer.experience_name : inv.offer_id) + SEP + esc(slotLong(slot)) + (inv.checked_in_at ? SEP + 'checked in ' + fmtClock(inv.checked_in_at) : '') + '</div></div></div></div>';
      var body;
      if (inv.rating) {
        var r = inv.rating;
        body = '<div class="card mt-4"><div class="t-body c-secondary text-center">Your rating</div><div class="stars is-readonly mt-3">' + stars(Number(r.rating), true) + '</div>' +
          '<div class="kv-list mt-5">' + kvLine('Punctuality', yesNo(r.punctuality)) + kvLine('Presentation', yesNo(r.presentation)) + kvLine('Deliverables complete', yesNo(r.deliverables_complete)) + '</div></div>' +
          '<div class="mt-8">' + ui.button('Back to dashboard', { cls: 'btn-secondary btn-lg btn-block', nav: '/venue/dashboard', id: 'review-back' }) + '</div>';
      } else {
        var R = V.review;
        body = '<div class="card mt-4"><div class="t-body c-secondary text-center">How did the collaboration go?</div>' +
          '<div class="stars mt-3" role="radiogroup" aria-label="Rating">' + stars(R.rating, false) + '</div>' +
          '<div class="t-meta text-center mt-2" id="rating-label">' + RATING_LABELS[R.rating] + '</div></div>' +
          '<div class="card mt-4">' +
          toggleRow('punctuality', 'Punctuality', 'Arrived on time for the slot', R.punctuality) +
          toggleRow('presentation', 'Presentation', 'Looked the part and engaged the team', R.presentation) +
          toggleRow('deliverables_complete', 'Deliverables complete', inv.deliverables ? plural(inv.deliverables.stories_posted, 'story posted', 'stories posted') + ', venue tagged' : 'Stories and reel delivered as agreed', R.deliverables_complete) +
          '</div>' +
          '<div class="mt-8">' + ui.button('Submit rating', { cls: 'btn-primary btn-lg btn-block', id: 'review-submit' }) + '</div>';
      }
      return '<div class="va-page va-review">' + ui.header({ left: 'back', title: 'Rate collaboration' }) + '<div class="section mt-6">' + who + body + '</div></div>';
    },
    mount: function (params, root) {
      var c = reviewInvite(params);
      if (!c) return null;
      var inv = c.invite;
      V.isFreshNav('venueReview'); // Page Viewed only — no screen event
      function paintStars() {
        Array.prototype.forEach.call(root.querySelectorAll('[data-star]'), function (b) {
          var i = Number(b.getAttribute('data-star'));
          b.classList.toggle('is-on', i <= V.review.rating);
          b.setAttribute('aria-checked', i === V.review.rating ? 'true' : 'false');
        });
        var lbl = root.querySelector('#rating-label');
        if (lbl) lbl.textContent = RATING_LABELS[V.review.rating];
      }
      function submit() {
        var R = V.review;
        var rec = TSS.state.rateCollab(inv.invite_id, { rating: R.rating, punctuality: R.punctuality, presentation: R.presentation, deliverables_complete: R.deliverables_complete });
        if (!rec || !rec.rating) { toast('Could not save the rating'); return; }
        track('Collaboration Rated', {
          offer_id: inv.offer_id, invite_id: inv.invite_id, rating: Number(rec.rating.rating),
          punctuality: !!rec.rating.punctuality, presentation: !!rec.rating.presentation, deliverables_complete: !!rec.rating.deliverables_complete
        });
        toast('Rating saved — thank you');
        navigate('/venue/dashboard');
      }
      function onClick(e) {
        var t = e.target;
        if (!t || !t.closest) return;
        var star = t.closest('[data-star]');
        if (star && root.contains(star)) { V.review.rating = Number(star.getAttribute('data-star')) || 5; paintStars(); return; }
        var tg = t.closest('[data-flag]');
        if (tg && root.contains(tg)) {
          var k = tg.getAttribute('data-flag');
          V.review[k] = !V.review[k];
          tg.classList.toggle('is-off', !V.review[k]);
          tg.setAttribute('aria-checked', V.review[k] ? 'true' : 'false');
          return;
        }
        var sub = t.closest('#review-submit');
        if (sub && root.contains(sub)) submit();
      }
      root.addEventListener('click', onClick);
      var unsub = subscribe();
      return function () { root.removeEventListener('click', onClick); unsub(); };
    }
  };

  /* ====================================================================================================== */
  /* venueProfile — /venue/profile (manager profile + Log out)                                                */
  /* ====================================================================================================== */
  screens.venueProfile = {
    role: 'venue_manager', tab: 'venue-profile', tabbar: 'venue', tracked: true,
    title: function () { return 'Venue profile'; },
    render: function () {
      var v = venue();
      if (!v) return notFound();
      var s = sess(), stats = TSS.state.venueStats(v.venue_id), a = s.attribution || {};
      var isSlot = v.approval_style === 'slot_calendar';
      return '<div class="va-page va-profile">' + pillHeader(v, [bellBtn(v)]) +
        '<div class="section mt-6">' +
        '<div class="card venue-card"><div class="venue-card-head"><div class="thumb is-lg art art-' + esc(v.art || 'nightlife') + '"></div>' +
        '<div class="grow"><div class="t-list-title-strong">' + esc(v.venue_name) + '</div><div class="card-meta mt-1">' + esc(v.venue_category) + SEP + esc(v.city || 'Dubai') + '</div></div></div>' +
        '<div class="tag-row mt-4">' + ui.tag(isSlot ? 'Slot Planner' : 'Inbox Clearer', isSlot ? 'teal' : 'outline') + ui.tag(esc(v.approval_style)) + ui.tag(esc(v.venue_id)) + '</div>' +
        '<div class="card-kv mt-4"><span class="k">Manager :</span> ' + esc(v.manager_name || 'Manager') + SEP + 'marketing manager</div></div>' +
        '<div class="stat-row mt-6">' + statTile(stats.pending, 'Pending', true) + statTile(stats.approved, 'Approved') + statTile(stats.checked_in, 'Checked in') + statTile(stats.credits_balance, 'Credits') + '</div>' +
        '<div class="demo-id mt-6"><span class="t-label c-muted">Manager ID</span><span class="demo-id-value" id="venue-manager-id">' + esc(s.user_id || v.manager_id) + '</span>' +
        '<span class="t-meta-sm">Stable demo manager' + SEP + 'user-level group venue = ' + esc(v.venue_id) + '</span></div>' +
        '<div class="card mt-6"><div class="t-body c-secondary">Attribution</div><div class="kv-list mt-3">' +
        kvLine('utm_source', esc(a.utm_source || '—'), true) + kvLine('utm_medium', esc(a.utm_medium || '—'), true) + kvLine('utm_campaign', esc(a.utm_campaign || '—'), true) + kvLine('referring_domain', esc(a.referring_domain || '—'), true) +
        '</div></div>' +
        '<div class="mt-8">' + ui.button('Log out', { cls: 'btn-secondary btn-lg btn-block', id: 'venue-logout' }) + '</div>' +
        '</div></div>';
    },
    mount: function (params, root) {
      var v = venue();
      if (!v) return null;
      V.isFreshNav('venueProfile'); // Page Viewed only
      var btn = root.querySelector('#venue-logout');
      if (btn) btn.addEventListener('click', function () {
        btn.disabled = true;
        try { TSS.analytics.logout(); }
        catch (e) { if (window.console) console.error('[TSS] logout failed', e); }
        navigate('/');
      });
      return subscribe();
    }
  };

  /* ---------- exports for tests / other files ---------- */
  V.personaArt = personaArt;
  V.fmtUpdated = fmtUpdated;
  V.normalizeCode = normalizeCode;
  V.openSeatSheet = openSeatSheet;
  V.openDeclineSheet = openDeclineSheet;
  V.openCheckinSheet = openCheckinSheet;
})();
