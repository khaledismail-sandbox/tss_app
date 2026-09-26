/* state.js — The Secret Society demo · TSS.state (ARCHITECTURE §5).
   Two stores, no DOM, no SDK:
     • Session   — sessionStorage[TSS.config.SESSION_KEY]; per window/tab, like the SDK identity.
     • Marketplace — localStorage[TSS.config.MARKET_KEY]; shared by the blogger and manager windows.
       Every domain operation is a read-modify-write on the CURRENT stored value (never a cached
       copy), so two windows never clobber each other, and every write emits to same-window
       subscribers; the other window hears it through the browser's 'storage' event.
   All storage access is try/catch-wrapped with in-memory fallbacks, and every parse tolerates
   corrupt JSON (→ defaults). Every record field is JSON-safe and non-empty where it feeds an event.

   Contract (keep names exactly): getSession · setSession · clearSession · newSuffix · bloggerId · inviteId ·
     getMarket · updateMarket · resetMarket · onMarketChange · submitApplication · applicationsFor · pendingFor ·
     approveApplication · rejectApplication · slotAvailability · offerAvailability · invitesFor · invite ·
     acceptInvite · markSlotFullSeen · abandonInvite · findInviteByCode · checkInInvite · submitDeliverables ·
     rateCollab · checkinsFor · venueStats
   Extras (not in §5, safe to use): personaName(persona) · checkinCodeFor(invite_id) · CHECKIN_ALPHABET ·
     application(app_id) · applicationsBy(blogger_id) · invitesForVenue(venue_id) · invitesForSlot(slot_id) ·
     REJECT_REASONS · marketDefaults() · sessionDefaults() */
window.TSS = window.TSS || {};

(function () {
  'use strict';

  var state = {};
  TSS.state = state;

  // Read config/data lazily so load order inside the shell can never bite.
  function C() { return TSS.config; }
  function D() { return TSS.data; }

  /* ── tiny utils ─────────────────────────────────────────────────────────────────────────── */
  function isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }
  function clone(v) {
    return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  }
  function assign(target) {
    for (var i = 1; i < arguments.length; i++) {
      var src = arguments[i];
      if (!src) continue;
      for (var k in src) if (Object.prototype.hasOwnProperty.call(src, k)) target[k] = src[k];
    }
    return target;
  }
  function toInt(v, dflt) {
    var n = typeof v === 'number' ? v : parseInt(v, 10);
    return isFinite(n) ? Math.round(n) : dflt;
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function values(obj) {
    var out = [];
    for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k) && isPlainObject(obj[k])) out.push(obj[k]);
    return out;
  }
  function byAsc(field) {
    return function (a, b) { return (a[field] || 0) - (b[field] || 0) || String(a.app_id || a.invite_id).localeCompare(String(b.app_id || b.invite_id)); };
  }
  function byDesc(field) {
    return function (a, b) { return (b[field] || 0) - (a[field] || 0) || String(a.app_id || a.invite_id).localeCompare(String(b.app_id || b.invite_id)); };
  }
  function warn() {
    if (typeof console !== 'undefined' && console.warn) console.warn.apply(console, ['[TSS] state:'].concat([].slice.call(arguments)));
  }

  /* ── storage wrappers (never throw) ─────────────────────────────────────────────────────── */
  var mem = { session: null, market: null };

  function storage(kind) {
    try {
      var s = kind === 'local' ? window.localStorage : window.sessionStorage;
      return s || null;
    } catch (e) { return null; }
  }
  function readJSON(kind, key) {
    var s = storage(kind);
    if (!s) return mem[kind === 'local' ? 'market' : 'session'];
    try {
      var raw = s.getItem(key);
      if (raw === null || raw === undefined) return undefined;
      return JSON.parse(raw);
    } catch (e) { return undefined; } // corrupt JSON → caller falls back to defaults
  }
  function writeJSON(kind, key, value) {
    mem[kind === 'local' ? 'market' : 'session'] = value;
    var s = storage(kind);
    if (!s) return;
    try { s.setItem(key, JSON.stringify(value)); } catch (e) { warn('could not write', key, e && e.message); }
  }
  function removeKey(kind, key) {
    mem[kind === 'local' ? 'market' : 'session'] = null;
    var s = storage(kind);
    if (!s) return;
    try { s.removeItem(key); } catch (e) { /* ignore */ }
  }

  /* ════════════════════════════════════════════════════════════════════════════════════════ */
  /* 5.1 Session                                                                               */
  /* ════════════════════════════════════════════════════════════════════════════════════════ */
  state.sessionDefaults = function () {
    return {
      role: null,               // null | 'creator' | 'venue_manager'
      user_id: null,
      persona: null,            // null | 'sara' | 'omar'
      display_name: null,
      suffix: null,             // 'MMDD-HHmm'
      venue_id: null,           // managers
      mode: null,               // 'join' | 'login'
      is_returning: false,
      attribution: null,        // {utm_source, utm_medium, utm_campaign, referrer, referring_domain}
      funnel_step: 0,           // 0..5
      screens_viewed: 0,
      session_started_at: null, // epoch ms
      session_ended_sent: false,
      saved_offers: [],
      searches: 0,
      sdk: { sr_added: false, sr_sample_rate: 1, engagement_added: false, analytics_ready: false },
      experiment: { status: 'idle', variant: null, payload: null, fetch_ms: null, error: null, key_used: C().EXPERIMENT_DEPLOYMENT_KEY, at: null }
    };
  };

  function normalizeSession(raw) {
    var d = state.sessionDefaults();
    if (!isPlainObject(raw)) return d;
    var s = assign(d, raw);
    s.sdk = assign(state.sessionDefaults().sdk, isPlainObject(raw.sdk) ? raw.sdk : {});
    s.experiment = assign(state.sessionDefaults().experiment, isPlainObject(raw.experiment) ? raw.experiment : {});
    if (!Array.isArray(s.saved_offers)) s.saved_offers = [];
    if (!isPlainObject(s.attribution)) s.attribution = null;
    s.funnel_step = Math.max(0, Math.min(5, toInt(s.funnel_step, 0)));
    s.screens_viewed = Math.max(0, toInt(s.screens_viewed, 0));
    s.searches = Math.max(0, toInt(s.searches, 0));
    return s;
  }

  // Never null; defaults filled for every missing key (also inside sdk/experiment).
  state.getSession = function () {
    return normalizeSession(readJSON('session', C().SESSION_KEY));
  };

  // Shallow merge; plain-object values (sdk, experiment, attribution) merge one level deep so
  // setSession({experiment:{status:'fetched'}}) keeps key_used. Returns the merged session.
  state.setSession = function (patch) {
    var cur = state.getSession();
    if (isPlainObject(patch)) {
      for (var k in patch) {
        if (!Object.prototype.hasOwnProperty.call(patch, k)) continue;
        if (isPlainObject(patch[k]) && isPlainObject(cur[k])) cur[k] = assign({}, cur[k], patch[k]);
        else cur[k] = patch[k];
      }
    }
    var next = normalizeSession(cur);
    writeJSON('session', C().SESSION_KEY, next);
    return next;
  };

  // Back to defaults but keeps attribution (resolved once per landing, SPEC §6.6).
  state.clearSession = function () {
    var attribution = state.getSession().attribution;
    var next = state.sessionDefaults();
    next.attribution = attribution;
    writeJSON('session', C().SESSION_KEY, next);
    return next;
  };

  // 'MMDD-HHmm' from local time, zero-padded (e.g. '0927-0136'). Optional Date for tests.
  state.newSuffix = function (now) {
    var d = (now instanceof Date && !isNaN(now)) ? now : new Date();
    return pad2(d.getMonth() + 1) + pad2(d.getDate()) + '-' + pad2(d.getHours()) + pad2(d.getMinutes());
  };

  // 'demo-blogger-sara-0927-0136' (persona lower-cased)
  state.bloggerId = function (persona, suffix) {
    return 'demo-blogger-' + String(persona || 'sara').toLowerCase() + '-' + (suffix || state.newSuffix());
  };

  // 'OFR-DEMO-01' → 'INV-DEMO01-<suffix>', 'OFR-DEMO-02' → 'INV-DEMO02-<suffix>'
  state.inviteId = function (offer_id, suffix) {
    return 'INV-' + String(offer_id || '').replace(/^OFR-/, '').replace(/-/g, '') + '-' + (suffix || state.newSuffix());
  };

  // 'sara' → 'Sara'
  state.personaName = function (persona) {
    var p = C().PERSONAS[String(persona || '').toLowerCase()];
    if (p && p.name) return p.name;
    var s = String(persona || 'Guest');
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  /* ════════════════════════════════════════════════════════════════════════════════════════ */
  /* 5.2 Marketplace                                                                           */
  /* ════════════════════════════════════════════════════════════════════════════════════════ */
  state.marketDefaults = function () {
    return { version: 1, updated_at: Date.now(), applications: {}, invites: {}, seats_taken: {} };
  };

  function normalizeMarket(raw) {
    if (!isPlainObject(raw) || raw.version !== 1) return state.marketDefaults();
    var m = state.marketDefaults();
    m.updated_at = toInt(raw.updated_at, m.updated_at);
    if (isPlainObject(raw.applications)) m.applications = raw.applications;
    if (isPlainObject(raw.invites)) m.invites = raw.invites;
    if (isPlainObject(raw.seats_taken)) m.seats_taken = raw.seats_taken;
    return m;
  }

  // Always the CURRENT stored market (defaults if missing/corrupt/wrong version).
  state.getMarket = function () {
    return normalizeMarket(readJSON('local', C().MARKET_KEY));
  };

  var subscribers = [];
  var storageBound = false;

  function emit(market, source) {
    var list = subscribers.slice();
    for (var i = 0; i < list.length; i++) {
      try { list[i](market, { source: source }); }
      catch (e) { if (typeof console !== 'undefined') console.error('[TSS] onMarketChange subscriber failed', e); }
    }
  }

  function bindStorage() {
    if (storageBound || typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    storageBound = true;
    window.addEventListener('storage', function (e) {
      // e.key === null → localStorage.clear() somewhere; otherwise only our key matters.
      if (!e || (e.key !== null && e.key !== C().MARKET_KEY)) return;
      emit(state.getMarket(), 'storage');
    });
  }

  // fn(market) mutates a clone of the current market; then saved + emitted to same-window
  // subscribers (the other window gets the 'storage' event). Returns the saved market.
  state.updateMarket = function (fn) {
    var m = clone(state.getMarket());
    if (typeof fn === 'function') fn(m);
    m = normalizeMarket(m);
    m.updated_at = Date.now();
    writeJSON('local', C().MARKET_KEY, m);
    emit(m, 'local');
    return m;
  };

  // Clears the shared key (the other window sees a 'storage' event with a null value) and emits defaults.
  state.resetMarket = function () {
    removeKey('local', C().MARKET_KEY);
    var m = state.marketDefaults();
    emit(m, 'reset');
    return m;
  };

  // cb(market, {source:'local'|'storage'|'reset'}) → unsubscribe()
  state.onMarketChange = function (cb) {
    if (typeof cb !== 'function') return function () {};
    bindStorage();
    subscribers.push(cb);
    return function unsubscribe() {
      var i = subscribers.indexOf(cb);
      if (i !== -1) subscribers.splice(i, 1);
    };
  };

  /* ════════════════════════════════════════════════════════════════════════════════════════ */
  /* 5.3 Domain operations (each returns a copy of the created/updated record, or null)        */
  /* ════════════════════════════════════════════════════════════════════════════════════════ */
  state.REJECT_REASONS = ['capacity_reached', 'profile_fit', 'follower_threshold'];

  // Creates a pending application. app_id = 'APP-<suffix>-<offer_id>' (re-applying to the same offer
  // within the same minute overwrites the previous pending application).
  state.submitApplication = function (opts) {
    opts = opts || {};
    var offer = D().offer(opts.offer_id);
    if (!offer) { warn('submitApplication: unknown offer', opts.offer_id); return null; }
    var s = isPlainObject(opts.session) ? opts.session : state.getSession();
    var suffix = s.suffix || state.newSuffix();
    var persona = String(s.persona || 'sara').toLowerCase();
    var app = {
      app_id: 'APP-' + suffix + '-' + offer.offer_id,
      offer_id: offer.offer_id,
      venue_id: offer.venue_id,
      blogger_id: s.user_id || state.bloggerId(persona, suffix),
      blogger_name: s.display_name || state.personaName(persona),
      persona: persona,
      follower_band: C().BLOGGER_PROFILE.follower_band,
      guest_count: Math.max(1, toInt(opts.guest_count, 1)),
      pitch_length_chars: Math.max(1, toInt(opts.pitch_length_chars, C().PITCH_DEFAULT.length)),
      submitted_at: Date.now(),
      status: 'pending',
      invite_id: null,
      approval_source: null,
      reject_reason: null,
      suffix: suffix
    };
    state.updateMarket(function (m) { m.applications[app.app_id] = app; });
    return clone(app);
  };

  state.application = function (app_id) {
    var a = state.getMarket().applications[app_id];
    return isPlainObject(a) ? clone(a) : null;
  };

  // Chronological (submitted_at asc) — the inbox order.
  state.applicationsFor = function (venue_id) {
    return values(state.getMarket().applications)
      .filter(function (a) { return a.venue_id === venue_id; })
      .sort(byAsc('submitted_at'));
  };

  state.pendingFor = function (venue_id) {
    return state.applicationsFor(venue_id).filter(function (a) { return a.status === 'pending'; });
  };

  // A blogger's own applications, newest first (the Invites screen's "Applications" section).
  state.applicationsBy = function (blogger_id) {
    return values(state.getMarket().applications)
      .filter(function (a) { return a.blogger_id === blogger_id; })
      .sort(byDesc('submitted_at'));
  };

  // approval_source 'slot_calendar' | 'inbox'; slot_id 'SL-…' (seated) | null (unassigned).
  // Creates the invite: seat_reserved = !!slot_id, slot_id = slot_id || 'unassigned',
  // invite_id = inviteId(offer_id, app.suffix); seated → seats_taken[slot_id] += 1 (one seat per
  // invite — the party sits together). Approving an already-approved application returns its invite.
  state.approveApplication = function (app_id, opts) {
    opts = opts || {};
    var m0 = state.getMarket();
    var app0 = m0.applications[app_id];
    if (!isPlainObject(app0)) { warn('approveApplication: unknown application', app_id); return null; }
    if (app0.status === 'approved' && app0.invite_id && m0.invites[app0.invite_id]) return clone(m0.invites[app0.invite_id]);

    var offer = D().offer(app0.offer_id);
    var slot_id = (typeof opts.slot_id === 'string' && opts.slot_id && opts.slot_id !== 'unassigned') ? opts.slot_id : null;
    if (slot_id && offer && !offer.slots.some(function (sl) { return sl.slot_id === slot_id; })) {
      warn('approveApplication: slot does not belong to offer, approving without a seat', slot_id, app0.offer_id);
      slot_id = null;
    }
    var source = opts.approval_source === 'inbox' || opts.approval_source === 'slot_calendar'
      ? opts.approval_source
      : (slot_id ? 'slot_calendar' : 'inbox');

    var result = null;
    state.updateMarket(function (m) {
      var app = m.applications[app_id];
      if (!isPlainObject(app)) return;
      var suffix = app.suffix || state.newSuffix();
      var invite_id = state.inviteId(app.offer_id, suffix);
      var inv = {
        invite_id: invite_id,
        app_id: app.app_id,
        offer_id: app.offer_id,
        venue_id: app.venue_id,
        blogger_id: app.blogger_id,
        blogger_name: app.blogger_name,
        persona: app.persona,
        suffix: suffix,
        seat_reserved: !!slot_id,
        slot_id: slot_id || 'unassigned',
        guest_count: Math.max(1, toInt(app.guest_count, 1)),
        status: 'pending',
        accepted_slot_id: null,
        checkin_code: null,
        created_at: Date.now(),
        accepted_at: null,
        abandoned_at: null,
        checked_in_at: null,
        slot_full_seen: false,
        deliverables: null,
        rating: null
      };
      app.status = 'approved';
      app.approval_source = source;
      app.invite_id = invite_id;
      app.reject_reason = null;
      m.invites[invite_id] = inv;
      if (slot_id) m.seats_taken[slot_id] = Math.max(0, toInt(m.seats_taken[slot_id], 0)) + 1;
      result = inv;
    });
    return result ? clone(result) : null;
  };

  // reason 'capacity_reached' | 'profile_fit' | 'follower_threshold' (anything else → 'profile_fit').
  // An already-approved application is left untouched (its invite exists).
  state.rejectApplication = function (app_id, reason) {
    var m0 = state.getMarket();
    var app0 = m0.applications[app_id];
    if (!isPlainObject(app0)) { warn('rejectApplication: unknown application', app_id); return null; }
    if (app0.status === 'approved') return clone(app0);
    var why = state.REJECT_REASONS.indexOf(reason) !== -1 ? reason : 'profile_fit';
    var result = null;
    state.updateMarket(function (m) {
      var app = m.applications[app_id];
      if (!isPlainObject(app)) return;
      app.status = 'rejected';
      app.reject_reason = why;
      app.rejected_at = Date.now();
      result = app;
    });
    return result ? clone(result) : null;
  };

  // [ {slot, slot_id, taken, left, is_full, popular, forced_full} ] in offer slot order.
  // left = seats - taken (nominal). With {forUnseatedInvite:true}, slots flagged
  // always_full_for_unseated are reported is_full:true / left:0 (forced_full:true) — this is what makes
  // Run B reproduce every time. Unknown offer / browse-only offer → [].
  state.slotAvailability = function (offer_id, opts) {
    var offer = D().offer(offer_id);
    if (!offer || !offer.slots || !offer.slots.length) return [];
    var forUnseated = !!(opts && opts.forUnseatedInvite);
    var taken = state.getMarket().seats_taken;
    return offer.slots.map(function (slot) {
      var t = Math.max(0, toInt(taken[slot.slot_id], 0));
      var left = Math.max(0, toInt(slot.seats, 0) - t);
      var forced = forUnseated && !!slot.always_full_for_unseated;
      if (forced) left = 0;
      return { slot: slot, slot_id: slot.slot_id, taken: t, left: left, is_full: left <= 0, popular: !!slot.popular, forced_full: forced };
    });
  };

  // Nominal availability (ignores the always_full rule) for cards and Offer Viewed.
  // Offers with slots: slots_available = count(left>0), seats_left = sum(left) — OFR-DEMO-02 fresh →
  // {slots_available:4, seats_left:12}. Browse-only offers (slots []) → the per-offer constants
  // availability_slots / availability_seats from data.js. Unknown offer → {0, 0}. Always numbers.
  state.offerAvailability = function (offer_id) {
    var offer = D().offer(offer_id);
    if (!offer) return { slots_available: 0, seats_left: 0 };
    if (!offer.slots || !offer.slots.length) {
      return { slots_available: Math.max(0, toInt(offer.availability_slots, 0)), seats_left: Math.max(0, toInt(offer.availability_seats, 0)) };
    }
    var rows = state.slotAvailability(offer_id, { forUnseatedInvite: false });
    var slots = 0, seats = 0;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].left > 0) slots += 1;
      seats += rows[i].left;
    }
    return { slots_available: slots, seats_left: seats };
  };

  // A blogger's invites, newest first.
  state.invitesFor = function (blogger_id) {
    return values(state.getMarket().invites)
      .filter(function (i) { return i.blogger_id === blogger_id; })
      .sort(byDesc('created_at'));
  };

  // A venue's invites (any status), newest first.
  state.invitesForVenue = function (venue_id) {
    return values(state.getMarket().invites)
      .filter(function (i) { return i.venue_id === venue_id; })
      .sort(byDesc('created_at'));
  };

  // Invites occupying a slot (seated pending, accepted or checked in) — for the calendar's seat dots.
  state.invitesForSlot = function (slot_id) {
    return values(state.getMarket().invites).filter(function (i) {
      if (i.status === 'abandoned') return false;
      if (i.status === 'pending') return i.seat_reserved && i.slot_id === slot_id;
      return i.accepted_slot_id === slot_id;
    }).sort(byAsc('created_at'));
  };

  state.invite = function (invite_id) {
    var i = state.getMarket().invites[invite_id];
    return isPlainObject(i) ? clone(i) : null;
  };

  // Deterministic check-in code: 'TSS-' + 4 chars from [A-Z2-9], derived from invite_id alone, so the
  // blogger window and the manager window always compute the same code.
  state.CHECKIN_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789'; // 34 symbols

  function hash32(str) {
    var h = 0x811c9dc5; // FNV-1a
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; // murmur3 finaliser for spread
    h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0;
    h ^= h >>> 16;
    return h >>> 0;
  }

  state.checkinCodeFor = function (invite_id) {
    var h = hash32(String(invite_id || ''));
    var A = state.CHECKIN_ALPHABET, out = '';
    for (var i = 0; i < 4; i++) {
      out += A.charAt(h % A.length);
      h = Math.floor(h / A.length);
    }
    return 'TSS-' + out;
  };

  // Accept a pending invite. Seated invites accept into their reserved slot (slot_id may be omitted);
  // unseated invites must pass an OPEN slot_id (checked with the forUnseatedInvite rule — a full
  // slot is refused → null) and then consume a seat (seats_taken[slot_id] += 1).
  // Sets status 'accepted', accepted_slot_id, accepted_at, checkin_code. Already accepted → unchanged copy.
  state.acceptInvite = function (invite_id, slot_id) {
    var m0 = state.getMarket();
    var inv0 = m0.invites[invite_id];
    if (!isPlainObject(inv0)) { warn('acceptInvite: unknown invite', invite_id); return null; }
    if (inv0.status !== 'pending') return clone(inv0);

    var wanted = (typeof slot_id === 'string' && slot_id && slot_id !== 'unassigned') ? slot_id : null;
    var chosen = inv0.seat_reserved ? (wanted || inv0.slot_id) : wanted;
    if (!chosen || chosen === 'unassigned') { warn('acceptInvite: unseated invite needs a slot_id', invite_id); return null; }
    if (!inv0.seat_reserved) {
      var rows = state.slotAvailability(inv0.offer_id, { forUnseatedInvite: true });
      var row = null;
      for (var i = 0; i < rows.length; i++) if (rows[i].slot_id === chosen) row = rows[i];
      if (!row) { warn('acceptInvite: slot does not belong to offer', chosen, inv0.offer_id); return null; }
      if (row.is_full) { warn('acceptInvite: slot is full', chosen); return null; }
    }

    var result = null;
    state.updateMarket(function (m) {
      var inv = m.invites[invite_id];
      if (!isPlainObject(inv) || inv.status !== 'pending') return;
      inv.status = 'accepted';
      inv.accepted_slot_id = chosen;
      inv.accepted_at = Date.now();
      inv.checkin_code = state.checkinCodeFor(invite_id);
      if (!inv.seat_reserved) m.seats_taken[chosen] = Math.max(0, toInt(m.seats_taken[chosen], 0)) + 1;
      result = inv;
    });
    return result ? clone(result) : null;
  };

  state.markSlotFullSeen = function (invite_id) {
    if (!isPlainObject(state.getMarket().invites[invite_id])) return null;
    var result = null;
    state.updateMarket(function (m) {
      var inv = m.invites[invite_id];
      if (!isPlainObject(inv)) return;
      inv.slot_full_seen = true;
      inv.slot_full_seen_at = Date.now();
      result = inv;
    });
    return result ? clone(result) : null;
  };

  // pending → abandoned (releases the reserved seat if the invite was seated). Other statuses unchanged.
  state.abandonInvite = function (invite_id) {
    var inv0 = state.getMarket().invites[invite_id];
    if (!isPlainObject(inv0)) return null;
    if (inv0.status !== 'pending') return clone(inv0);
    var result = null;
    state.updateMarket(function (m) {
      var inv = m.invites[invite_id];
      if (!isPlainObject(inv) || inv.status !== 'pending') return;
      inv.status = 'abandoned';
      inv.abandoned_at = Date.now();
      if (inv.seat_reserved && inv.slot_id && inv.slot_id !== 'unassigned') {
        m.seats_taken[inv.slot_id] = Math.max(0, toInt(m.seats_taken[inv.slot_id], 0) - 1);
      }
      result = inv;
    });
    return result ? clone(result) : null;
  };

  // Case-insensitive; ignores spaces, dashes and any other punctuation; accepts the code with or
  // without its 'TSS-' prefix ('tss 4f7k', 'TSS-4F7K', '4f7k' all match 'TSS-4F7K').
  state.findInviteByCode = function (code) {
    var wanted = String(code == null ? '' : code).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!wanted) return null;
    var list = values(state.getMarket().invites);
    for (var i = 0; i < list.length; i++) {
      var c = list[i].checkin_code;
      if (typeof c !== 'string' || !c) continue;
      var full = c.toUpperCase().replace(/[^A-Z0-9]/g, '');
      var body = full.replace(/^TSS/, '');
      if (wanted === full || wanted === body) return clone(list[i]);
    }
    return null;
  };

  // accepted → checked_in. Already checked in → unchanged copy; pending/abandoned → unchanged copy
  // (callers decide from .status). Unknown → null.
  state.checkInInvite = function (invite_id) {
    var inv0 = state.getMarket().invites[invite_id];
    if (!isPlainObject(inv0)) return null;
    if (inv0.status !== 'accepted') return clone(inv0);
    var result = null;
    state.updateMarket(function (m) {
      var inv = m.invites[invite_id];
      if (!isPlainObject(inv) || inv.status !== 'accepted') return;
      inv.status = 'checked_in';
      inv.checked_in_at = Date.now();
      result = inv;
    });
    return result ? clone(result) : null;
  };

  state.submitDeliverables = function (invite_id, d) {
    d = d || {};
    if (!isPlainObject(state.getMarket().invites[invite_id])) return null;
    var result = null;
    state.updateMarket(function (m) {
      var inv = m.invites[invite_id];
      if (!isPlainObject(inv)) return;
      inv.deliverables = {
        stories_posted: Math.max(0, toInt(d.stories_posted, 4)),
        venue_tagged: d.venue_tagged === undefined ? true : !!d.venue_tagged,
        on_time: d.on_time === undefined ? true : !!d.on_time,
        at: Date.now()
      };
      result = inv;
    });
    return result ? clone(result) : null;
  };

  state.rateCollab = function (invite_id, r) {
    r = r || {};
    if (!isPlainObject(state.getMarket().invites[invite_id])) return null;
    var rating = Number(r.rating);
    if (!isFinite(rating)) rating = 5;
    rating = Math.max(1, Math.min(5, rating));
    var result = null;
    state.updateMarket(function (m) {
      var inv = m.invites[invite_id];
      if (!isPlainObject(inv)) return;
      inv.rating = {
        rating: rating,
        punctuality: r.punctuality === undefined ? true : !!r.punctuality,
        presentation: r.presentation === undefined ? true : !!r.presentation,
        deliverables_complete: r.deliverables_complete === undefined ? true : !!r.deliverables_complete,
        at: Date.now()
      };
      result = inv;
    });
    return result ? clone(result) : null;
  };

  // Checked-in invites of a venue, newest first.
  state.checkinsFor = function (venue_id) {
    return values(state.getMarket().invites)
      .filter(function (i) { return i.venue_id === venue_id && i.status === 'checked_in'; })
      .sort(byDesc('checked_in_at'));
  };

  // {pending, approved, checked_in, credits_balance} (+ rejected, accepted, credits_consumed, revenue_aed).
  // credits_balance is the venue's constant (200) — the dashboard tile and Venue Dashboard Viewed use it.
  state.venueStats = function (venue_id) {
    var venue = D().venue(venue_id);
    var apps = state.applicationsFor(venue_id);
    var invites = state.invitesForVenue(venue_id);
    var stats = { pending: 0, approved: 0, rejected: 0, accepted: 0, checked_in: 0, credits_consumed: 0, revenue_aed: 0,
      credits_balance: venue && typeof venue.credits_balance === 'number' ? venue.credits_balance : 200 };
    for (var i = 0; i < apps.length; i++) {
      if (apps[i].status === 'pending') stats.pending += 1;
      else if (apps[i].status === 'approved') stats.approved += 1;
      else if (apps[i].status === 'rejected') stats.rejected += 1;
    }
    for (var j = 0; j < invites.length; j++) {
      var inv = invites[j];
      if (inv.status === 'accepted') stats.accepted += 1;
      if (inv.status === 'checked_in') {
        stats.checked_in += 1;
        var offer = D().offer(inv.offer_id);
        var credits = (offer ? toInt(offer.credits_per_guest, 1) : 1) * Math.max(1, toInt(inv.guest_count, 1));
        stats.credits_consumed += credits;
        stats.revenue_aed += credits * C().CREDIT_PRICE_AED;
      }
    }
    return stats;
  };
})();
