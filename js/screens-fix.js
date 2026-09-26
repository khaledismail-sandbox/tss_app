/* screens-fix.js — The Secret Society demo · the standalone "after" page (TSS.screens.venueFix).
   Contract: ARCHITECTURE.md §9 "Fix page", SPEC.md §9. Plain ES2019 browser JS, no modules.

   Route /venue/fix/seat-at-approval · role any · no tab bar · title 'Seat at approval'. The router fires the only
   event this page ever produces ([Amplitude] Page Viewed); nothing in this file talks to the SDK — the buttons
   animate an in-memory demo state and send nothing.

   Demo state (fresh on every render): the Obsidian Lounge VIP Table with its 4 slots × 3 seats, preloaded
   2/3 · 3/3 · 1/3 · 0/3, and 5 pending applicants. Two applicants bring a +1 guest (the real Apply sheet's
   1–2 guest stepper), so they need 2 seats — with 6 free seats for 7 requested, "Approve all" seats four and
   waitlists one instead of pushing anyone into a full slot.

   Test hooks: TSS.fix.getState() (deep copy), TSS.fix.plan(state) (pure round-robin plan), TSS.fix.reset(). */
window.TSS = window.TSS || {};
(function () {
  'use strict';
  var TSS = window.TSS;
  var screens = TSS.screens = TSS.screens || {};
  var ui = TSS.ui;
  var esc = function (s) { return ui.escape(s); };
  var SEP = ui.SEP;

  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  var VENUE = { venue_name: 'Obsidian Lounge', experience_name: 'VIP Table', art: 'nightlife' };

  // The offer's four slots (OFR-DEMO-02) with the preloaded occupancy. Pre-seated guests each hold one seat.
  var SLOT_SEED = [
    { slot_id: 'SL-DEMO-02-1', weekday: 'Saturday',  time: '22:00', seats: 3, popular: true, pre: ['Noor K.', 'Khalid M.'] },
    { slot_id: 'SL-DEMO-02-2', weekday: 'Friday',    time: '23:00', seats: 3, pre: ['Dana R.', 'Faisal A.', 'Rita S.'] },
    { slot_id: 'SL-DEMO-02-3', weekday: 'Tuesday',   time: '21:00', seats: 3, pre: ['Hana T.'] },
    { slot_id: 'SL-DEMO-02-4', weekday: 'Wednesday', time: '22:00', seats: 3, pre: [] }
  ];
  // Five fictional creators in application order (oldest first, like the inbox). guests = seats needed.
  var APPLICANT_SEED = [
    { id: 'fx-a1', name: 'Sara Al Amiri',  first: 'Sara',  niche: 'lifestyle', guests: 1, art: 'beauty',    applied: '2 days ago' },
    { id: 'fx-a2', name: 'Omar Haddad',    first: 'Omar',  niche: 'food',      guests: 2, art: 'dining',    applied: 'Yesterday' },
    { id: 'fx-a3', name: 'Lina Farouk',    first: 'Lina',  niche: 'travel',    guests: 1, art: 'wellness',  applied: 'Yesterday' },
    { id: 'fx-a4', name: 'Yusuf Rahman',   first: 'Yusuf', niche: 'nightlife', guests: 2, art: 'nightlife', applied: '3h ago' },
    { id: 'fx-a5', name: 'Maya Chen',      first: 'Maya',  niche: 'beauty',    guests: 1, art: 'fitness',   applied: '1h ago' }
  ];
  var FOLLOWER_BAND = '10k-25k';

  /* ---------- dates & labels (self-contained; same format as TSS.data.slotLabel / slotLabelLong) ---------- */
  function nextDateForWeekday(weekday) {
    var d = new Date(); d.setHours(0, 0, 0, 0);
    var target = WEEKDAYS.indexOf(weekday);
    if (target < 0) return d;
    var diff = (target - d.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    d.setDate(d.getDate() + diff);
    return d;
  }
  function shortDay(slot) { return WEEKDAYS_SHORT[slot.date.getDay()] + ' ' + slot.date.getDate() + ' ' + MONTHS_SHORT[slot.date.getMonth()]; }

  /* ---------- state ---------- */
  var S = null;                  // current demo state (created by render, driven by mount)
  var M = null;                  // mount context { root, timers, onClick }

  function freshState() {
    var slots = SLOT_SEED.map(function (s) {
      var date = nextDateForWeekday(s.weekday);
      return {
        slot_id: s.slot_id, weekday: s.weekday, time: s.time, seats: s.seats, popular: !!s.popular,
        date: date, ts: date.getTime(),
        label: WEEKDAYS_SHORT[date.getDay()] + ' ' + s.time,                 // 'Wed 22:00'
        guests: s.pre.map(function (n) { return { name: n, seats: 1, pre: true }; })
      };
    });
    slots.sort(function (a, b) { return a.ts - b.ts; });                     // chronological
    var applicants = APPLICANT_SEED.map(function (a) {
      return { id: a.id, name: a.name, first: a.first, niche: a.niche, band: FOLLOWER_BAND, guests: a.guests, art: a.art, applied: a.applied, status: 'pending', slot_id: null, fresh: false };
    });
    return { slots: slots, applicants: applicants, busy: false, result: null };
  }
  function taken(slot) { return slot.guests.reduce(function (n, g) { return n + g.seats; }, 0); }
  function free(slot) { return Math.max(0, slot.seats - taken(slot)); }
  function pct(slot) { return Math.round(taken(slot) / slot.seats * 1000) / 10; }
  function isFull(slot) { return free(slot) <= 0; }
  function slotById(state, id) { for (var i = 0; i < state.slots.length; i++) if (state.slots[i].slot_id === id) return state.slots[i]; return null; }
  function applicantById(state, id) { for (var i = 0; i < state.applicants.length; i++) if (state.applicants[i].id === id) return state.applicants[i]; return null; }
  function pending(state) { return state.applicants.filter(function (a) { return a.status === 'pending'; }); }
  function waitlisted(state) { return state.applicants.filter(function (a) { return a.status === 'waitlisted'; }); }
  function approved(state) { return state.applicants.filter(function (a) { return a.status === 'approved'; }); }
  function totalFree(state) { return state.slots.reduce(function (n, s) { return n + free(s); }, 0); }
  function totalSeats(state) { return state.slots.reduce(function (n, s) { return n + s.seats; }, 0); }

  // Best open slot for `needed` seats: most free seats first, then earliest. null when nothing fits.
  function bestSlot(slots, needed, freeOf) {
    freeOf = freeOf || free;
    var best = null;
    slots.forEach(function (s) {
      var f = freeOf(s);
      if (f < needed) return;
      if (!best || f > freeOf(best) || (f === freeOf(best) && s.ts < best.ts)) best = s;
    });
    return best;
  }
  // Pure plan for "Approve all": remaining applicants round-robin across open slots (most free seats first, then
  // earliest); anyone who no longer fits goes to the waitlist. Never mutates `state`.
  function plan(state) {
    var freeMap = {};
    state.slots.forEach(function (s) { freeMap[s.slot_id] = free(s); });
    var freeOf = function (s) { return freeMap[s.slot_id]; };
    return pending(state).map(function (a) {
      var s = bestSlot(state.slots, a.guests, freeOf);
      if (s) freeMap[s.slot_id] -= a.guests;
      return { id: a.id, slot_id: s ? s.slot_id : null };
    });
  }
  function seat(state, applicant, slot) {
    applicant.status = 'approved';
    applicant.slot_id = slot.slot_id;
    applicant.fresh = true;
    slot.guests.push({ name: applicant.name, seats: applicant.guests, pre: false, id: applicant.id, fresh: true });
  }
  function waitlist(state, applicant) {
    applicant.status = 'waitlisted';
    applicant.slot_id = null;
    applicant.fresh = true;
  }
  function clearFresh(state) {
    state.applicants.forEach(function (a) { a.fresh = false; });
    state.slots.forEach(function (s) { s.guests.forEach(function (g) { g.fresh = false; }); });
  }

  /* ---------- view ---------- */
  function seatsWord(n) { return n + (n === 1 ? ' seat' : ' seats'); }
  function guestsWord(n) { return n + (n === 1 ? ' guest' : ' guests'); }

  function capBar(slot, extraCls) {
    return '<span class="cap-bar' + (isFull(slot) ? ' is-full' : '') + (extraCls ? ' ' + extraCls : '') + '" style="--fill:' + pct(slot) + '%" role="img" aria-label="' + taken(slot) + ' of ' + slot.seats + ' seats taken"><span class="cap-bar-fill"></span></span>';
  }

  function slotCard(slot) {
    var full = isFull(slot);
    var guests = slot.guests.length
      ? slot.guests.map(function (g) {
        return '<li class="fix-guest' + (g.fresh ? ' is-new' : '') + (g.pre ? ' is-pre' : '') + '"><span class="fix-guest-dot"></span><span class="truncate">' + esc(g.name) + (g.seats > 1 ? ' +' + (g.seats - 1) : '') + '</span></li>';
      }).join('')
      : '<li class="fix-guest is-empty"><span class="fix-guest-dot"></span><span>No guests yet</span></li>';
    return '<article class="fix-slot' + (full ? ' is-full' : '') + '" data-slot="' + esc(slot.slot_id) + '">' +
      '<div class="fix-slot-top"><span class="fix-slot-day">' + esc(shortDay(slot)) + '</span><span class="fix-slot-time">' + esc(slot.time) + '</span></div>' +
      '<div class="fix-slot-seats"><span>' + taken(slot) + ' of ' + slot.seats + ' seats</span>' +
      (full ? ui.tag('Full', 'red') : slot.popular ? ui.tag('Popular', 'teal') : '') + '</div>' +
      capBar(slot) +
      '<ul class="fix-slot-guests" aria-label="Approved for ' + esc(slot.label) + '">' + guests + '</ul>' +
      '</article>';
  }

  function applicantRow(a, state) {
    var sub = esc(a.band) + SEP + esc(a.niche);
    var meta = esc(guestsWord(a.guests)) + SEP + esc(a.applied);
    var action = '<button class="btn btn-primary btn-sm" type="button" data-fix="approve" data-id="' + esc(a.id) + '" aria-label="Approve ' + esc(a.name) + '"' + (state.busy ? ' disabled' : '') + '>Approve</button>';
    return ui.listRow({ id: 'fx-row-' + a.id, cls: 'fix-row', data: { id: a.id }, avatarArt: a.art, title: esc(a.name), sub: sub, meta: meta, action: action });
  }
  function waitlistRow(a) {
    var reason = a.guests > 1 ? 'Needs ' + seatsWord(a.guests) + SEP + 'no slot has ' + a.guests + ' left' : 'All slots full';
    return ui.listRow({ id: 'fx-wait-' + a.id, cls: 'fix-row' + (a.fresh ? ' is-new' : ''), data: { id: a.id }, avatarArt: a.art, title: esc(a.name), sub: esc(a.band) + SEP + esc(a.niche), meta: reason, action: ui.tag('Waitlist', 'outline') });
  }

  function view(state) {
    var pend = pending(state), wait = waitlisted(state), done = approved(state);
    var header = ui.header({ left: 'title', title: 'Applications', large: true, actions: [ui.tag('After', 'teal')] });

    var venueRow = '<div class="section fix-venue">' +
      '<div class="thumb art art-' + esc(VENUE.art) + ' is-lg"></div>' +
      '<div class="fix-venue-body"><div class="fix-venue-caption">' + esc(VENUE.venue_name) + SEP + 'Seat at approval</div>' +
      '<div class="fix-venue-title">' + esc(VENUE.experience_name) + '</div></div></div>';

    var slots = '<div class="section section-head fix-head"><h2 class="t-h2">Slots</h2><span class="fix-head-meta" id="fix-free">' + totalFree(state) + ' of ' + totalSeats(state) + ' seats free</span></div>' +
      '<div class="section"><div class="fix-slots">' + state.slots.map(slotCard).join('') + '</div></div>';

    var applicants = '<div class="section section-head fix-head"><span class="header-group"><h2 class="t-h2">Applicants</h2>' +
      (pend.length ? '<span class="badge">' + pend.length + '</span>' : '') + '</span>' +
      (pend.length ? '<span class="fix-head-meta">Oldest first</span>' : '') + '</div>' +
      '<div class="section fix-list" id="fix-pending">' +
      (pend.length ? pend.map(function (a) { return applicantRow(a, state); }).join('')
        : '<div class="card fix-empty"><span class="fix-empty-icon">' + ui.icon('check', 20, 'heavy') + '</span>' +
          '<div class="fix-empty-body"><div class="card-title">Inbox clear</div>' +
          '<div class="card-meta">' + done.length + ' seated' + SEP + wait.length + ' waitlisted' + SEP + 'nobody sent to a full slot</div></div></div>') +
      '</div>';

    var waitHtml = wait.length
      ? '<div class="section section-head fix-head"><span class="header-group"><h2 class="t-h2">Waitlist</h2><span class="badge">' + wait.length + '</span></span>' +
        '<span class="fix-head-meta">Seated first when a seat opens</span></div>' +
        '<div class="section fix-list fix-waitlist" id="fix-waitlist">' + wait.map(waitlistRow).join('') + '</div>'
      : '';

    var foot = '<div class="fix-foot"><div class="btn-row is-wide">' +
      ui.button('Reset', { cls: 'btn-secondary btn-lg', id: 'fix-reset', disabled: !!state.busy }) +
      ui.button('Approve all', { cls: 'btn-primary btn-lg', id: 'fix-approve-all', disabled: !!state.busy || !pend.length }) +
      '</div></div>';

    return '<div class="fix-page">' + header + '<div class="fix-body">' + venueRow + slots + applicants + waitHtml + '</div>' + foot + '</div>';
  }

  /* ---------- slot picker sheet ---------- */
  function pickRow(slot, applicant, selectedId) {
    var f = free(slot), full = isFull(slot), fits = f >= applicant.guests;
    var on = slot.slot_id === selectedId;
    var side = full ? ui.tag('Full', 'red') : !fits ? ui.tag(seatsWord(f) + ' left', 'outline') : '<span class="fix-pick-seats">' + esc(seatsWord(f)) + ' free</span>';
    return '<button class="fix-pick' + (on ? ' is-selected' : '') + (full ? ' is-full' : '') + '" type="button" role="radio" aria-checked="' + (on ? 'true' : 'false') + '"' +
      ' data-fix="pick" data-slot="' + esc(slot.slot_id) + '"' + (fits ? '' : ' disabled aria-disabled="true"') + '>' +
      '<span class="fix-pick-top"><span class="fix-pick-title">' + esc(shortDay(slot)) + SEP + esc(slot.time) + '</span>' +
      '<span class="fix-pick-side">' + side + '<span class="fix-check" aria-hidden="true">' + ui.icon('check', 14, 'badge') + '</span></span></span>' +
      capBar(slot, 'is-sm') +
      '</button>';
  }
  function primaryLabel(slot) { return slot ? 'Approve into ' + slot.label : 'Add to waitlist'; }

  function openPicker(applicant) {
    var best = bestSlot(S.slots, applicant.guests);
    var selected = best ? best.slot_id : null;
    var body = '<div class="fix-picks" role="radiogroup" aria-label="Choose a slot">' +
      S.slots.map(function (s) { return pickRow(s, applicant, selected); }).join('') + '</div>';
    var sub = esc(applicant.band) + SEP + esc(applicant.niche) + SEP +
      (applicant.guests > 1 ? 'brings a guest' + SEP + 'needs ' + seatsWord(applicant.guests) : guestsWord(applicant.guests)) +
      (best ? '' : SEP + '<span class="c-danger">no slot has room</span>');
    var el = ui.sheet.open({
      title: 'Approve ' + esc(applicant.first),
      sub: sub,
      body: body,
      cls: 'fix-sheet',
      primary: { label: primaryLabel(best), id: 'fix-confirm', onClick: function () { confirmApprove(applicant.id, selected); } }
    });
    if (!el) return;
    el.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-fix="pick"]') : null;
      if (!b || b.disabled) return;
      selected = b.getAttribute('data-slot');
      Array.prototype.forEach.call(el.querySelectorAll('[data-fix="pick"]'), function (r) {
        var on = r === b;
        r.classList.toggle('is-selected', on);
        r.setAttribute('aria-checked', on ? 'true' : 'false');
      });
      var primary = el.querySelector('[data-sheet-primary]');
      if (primary) primary.textContent = primaryLabel(slotById(S, selected));
    });
  }

  /* ---------- mount-time behaviour ---------- */
  function root() { return M && M.root; }
  function later(fn, ms) {
    if (!M) return null;
    var t = setTimeout(function () {
      if (!M) return;
      M.timers = M.timers.filter(function (x) { return x !== t; });
      fn();
    }, ms);
    M.timers.push(t);
    return t;
  }
  function draw() {
    var r = root();
    if (!r || !S) return;
    r.innerHTML = view(S);
  }
  // Slide the applicant's row out, then run `then` (which commits the state change and redraws).
  function leaveRow(id, then) {
    var r = root();
    var row = r && r.querySelector('#fx-row-' + id);
    if (!row) { then(); return; }
    row.classList.add('is-leaving');
    later(then, 220);
  }
  // Grow the slot's bar from its previous fill after a redraw, ring the card, and keep it in view.
  function animateSlot(slot_id, fromPct) {
    var r = root();
    var card = r && r.querySelector('.fix-slot[data-slot="' + slot_id + '"]');
    if (!card) return;
    var bar = card.querySelector('.cap-bar');
    if (bar) {
      var to = bar.style.getPropertyValue('--fill');
      bar.style.setProperty('--fill', fromPct + '%');
      void bar.offsetWidth;                       // commit the old width before the transition to the new one
      bar.style.setProperty('--fill', to);
    }
    card.classList.remove('is-hit');
    void card.offsetWidth;
    card.classList.add('is-hit');
    try { card.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* older engines */ }
  }
  function confirmApprove(applicantId, slot_id) {
    var a = applicantById(S, applicantId);
    if (!a || a.status !== 'pending' || S.busy) { ui.sheet.close(); return; }
    var slot = slot_id ? slotById(S, slot_id) : null;
    if (slot && free(slot) < a.guests) slot = null;   // stale selection — fall back to the waitlist
    ui.sheet.close();
    S.busy = true;
    var from = slot ? pct(slot) : 0;
    leaveRow(a.id, function () {
      clearFresh(S);
      if (slot) seat(S, a, slot); else waitlist(S, a);
      S.busy = false;
      draw();
      if (slot) animateSlot(slot.slot_id, from);
      ui.toast(slot ? a.first + ' placed in ' + slot.label : a.first + ' added to the waitlist');
    });
  }
  function approveAll() {
    if (S.busy || !pending(S).length) return;
    var steps = plan(S);
    var seated = 0, waited = 0;
    S.busy = true;
    draw();
    (function next(i) {
      if (i >= steps.length) {
        S.busy = false;
        S.result = { approved: seated, waitlisted: waited };
        draw();
        ui.toast(seated + ' approved · ' + waited + ' waitlisted');
        return;
      }
      var st = steps[i];
      var a = applicantById(S, st.id);
      var slot = st.slot_id ? slotById(S, st.slot_id) : null;
      var from = slot ? pct(slot) : 0;
      leaveRow(st.id, function () {
        clearFresh(S);
        if (slot) { seat(S, a, slot); seated += 1; } else { waitlist(S, a); waited += 1; }
        draw();
        if (slot) animateSlot(slot.slot_id, from);
        later(function () { next(i + 1); }, 140);
      });
    })(0);
  }
  function reset() {
    if (!M) return;
    M.timers.forEach(clearTimeout);
    M.timers = [];
    ui.sheet.close();
    S = freshState();
    draw();
    ui.toast('Demo reset' + ' · ' + pending(S).length + ' applicants pending');
  }
  function onClick(e) {
    var t = e.target;
    if (!t || typeof t.closest !== 'function' || !S) return;
    var b = t.closest('[data-fix="approve"], #fix-approve-all, #fix-reset');
    if (!b || b.disabled) return;
    if (b.id === 'fix-reset') { reset(); return; }
    if (S.busy) return;
    if (b.id === 'fix-approve-all') { approveAll(); return; }
    var a = applicantById(S, b.getAttribute('data-id'));
    if (a && a.status === 'pending') openPicker(a);
  }

  /* ---------- screen ---------- */
  screens.venueFix = {
    role: 'any', tab: null, tabbar: null, tracked: true,
    title: function () { return 'Seat at approval'; },
    render: function () {
      S = freshState();
      return view(S);
    },
    mount: function (params, rootEl) {
      M = { root: rootEl, timers: [] };
      rootEl.addEventListener('click', onClick);
      return function () {
        M.timers.forEach(clearTimeout);
        rootEl.removeEventListener('click', onClick);
        ui.sheet.close();
        M = null;
      };
    }
  };

  /* ---------- test hooks (own sub-namespace) ---------- */
  TSS.fix = {
    getState: function () {
      if (!S) return null;
      return {
        busy: S.busy,
        result: S.result,
        slots: S.slots.map(function (s) { return { slot_id: s.slot_id, label: s.label, seats: s.seats, taken: taken(s), free: free(s), full: isFull(s), guests: s.guests.map(function (g) { return { name: g.name, seats: g.seats, pre: g.pre }; }) }; }),
        applicants: S.applicants.map(function (a) { return { id: a.id, name: a.name, guests: a.guests, status: a.status, slot_id: a.slot_id }; })
      };
    },
    plan: function (state) { return plan(state || S); },
    reset: reset
  };
})();
