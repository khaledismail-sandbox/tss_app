/* data.js — The Secret Society demo · TSS.data (ARCHITECTURE §4).
   Fixed demo catalogue (SPEC §4) + pure helpers. No DOM, no SDK, no storage. Every value that can
   end up in an event property is non-empty and already in its final type (experience_value is a
   JS number, slot time is 'HH:MM' 24h, weekday is the full English name).

   Contract (keep names exactly):
     TSS.data.CATEGORIES, VENUES, OFFERS
     TSS.data.offer(id) · venue(id) · offersByCategory(slug) · categoryBySlug(slug) · allOffers() · searchOffers(q)
     TSS.data.nextDateForWeekday(weekday[, from]) · slotDate(slot) · slotLabel(slot) · slotLabelLong(slot)
     TSS.data.fmtAED(n) · creditsLabel(offer)
   Extras (not in §4, safe to use): WEEKDAYS, WEEKDAYS_SHORT, MONTHS_SHORT, ART_BY_CATEGORY, OFFER_ORDER,
     DEMO_OFFER_FOR_VENUE, weekdayIndex(name), slotById(slot_id), offersForVenue(venue_id),
     demoOfferForVenue(venue_id), fmtNumber(n) */
window.TSS = window.TSS || {};

(function () {
  'use strict';

  var data = {};
  TSS.data = data;

  /* ── Calendar constants ─────────────────────────────────────────────────────────────────── */
  data.WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  data.WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  data.MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* ── Categories (SPEC §3.1 slugs; icon names exist in js/icons.js) ─────────────────────── */
  data.CATEGORIES = [
    { slug: 'dining',       name: 'Dining',         icon: 'star' },
    { slug: 'nightlife',    name: 'Nightlife',      icon: 'zap-square' },
    { slug: 'beach-pool',   name: 'Beach & Pool',   icon: 'map-pin' },
    { slug: 'wellness-spa', name: 'Wellness & Spa', icon: 'heart' },
    { slug: 'beauty',       name: 'Beauty',         icon: 'pencil' },
    { slug: 'fitness',      name: 'Fitness',        icon: 'clock' }
  ];

  // CSS gradient art per category (classes .art-<name> in components.css — no images anywhere).
  data.ART_BY_CATEGORY = {
    'dining': 'dining',
    'nightlife': 'nightlife',
    'beach-pool': 'beach',
    'wellness-spa': 'wellness',
    'beauty': 'beauty',
    'fitness': 'fitness'
  };

  /* ── Venues (SPEC §4.1 demo venues + §4.3 browse-only venues) ──────────────────────────── */
  // Demo venues already exist in Amplitude with full group properties — never groupIdentify.
  data.VENUES = {
    'VEN-DEMO-SLOT': {
      venue_id: 'VEN-DEMO-SLOT', venue_name: 'Solace Beach Club', venue_category: 'Beach & Pool',
      approval_style: 'slot_calendar', city: 'Dubai', demo: true,
      manager_id: 'demo-manager-solace', manager_name: 'Layla', manager_email: 'layla@solacebeach.demo',
      account_age_days: 400, credits_balance: 200, art: 'beach'
    },
    'VEN-DEMO-INBOX': {
      venue_id: 'VEN-DEMO-INBOX', venue_name: 'Obsidian Lounge', venue_category: 'Nightlife',
      approval_style: 'inbox', city: 'Dubai', demo: true,
      manager_id: 'demo-manager-obsidian', manager_name: 'Omar', manager_email: 'omar@obsidianlounge.demo',
      account_age_days: 250, credits_balance: 200, art: 'nightlife'
    },
    // Browse-only venues (Offer Viewed / Event Saved only; Apply shows "Applications closed").
    'VEN-0010': { venue_id: 'VEN-0010', venue_name: 'Cobalt Cove',            venue_category: 'Beach & Pool',   city: 'Dubai', demo: false, art: 'beach' },
    'VEN-0004': { venue_id: 'VEN-0004', venue_name: 'Lotus Rooftop',          venue_category: 'Nightlife',      city: 'Dubai', demo: false, art: 'rooftop' },
    'VEN-0031': { venue_id: 'VEN-0031', venue_name: 'Sol Trattoria',          venue_category: 'Dining',         city: 'Dubai', demo: false, art: 'dining' },
    'VEN-0011': { venue_id: 'VEN-0011', venue_name: 'Serene Wellness Lounge', venue_category: 'Wellness & Spa', city: 'Dubai', demo: false, art: 'wellness' },
    'VEN-0032': { venue_id: 'VEN-0032', venue_name: 'Sable Atelier',          venue_category: 'Beauty',         city: 'Dubai', demo: false, art: 'beauty' },
    'VEN-0003': { venue_id: 'VEN-0003', venue_name: 'Maison Athletic Club',   venue_category: 'Fitness',        city: 'Dubai', demo: false, art: 'fitness' }
  };

  /* ── Offers ─────────────────────────────────────────────────────────────────────────────── */
  // Slot shape: { slot_id, offer_id, weekday, time:'HH:MM', seats, popular?, always_full_for_unseated? }.
  // Days resolve to the next occurrence of the weekday strictly after today (nextDateForWeekday).
  //
  // Browse-only offers have slots: [] — they are never applied to — so TSS.state.offerAvailability()
  // cannot compute availability from seats. Instead every browse-only offer carries the honest,
  // per-offer constants `availability_slots` / `availability_seats` (what its card and Offer Viewed
  // report as slots_available / seats_left). They are plain numbers and never empty.
  data.OFFERS = {
    'OFR-DEMO-01': {
      offer_id: 'OFR-DEMO-01', venue_id: 'VEN-DEMO-SLOT',
      experience_name: 'Daybed Experience', experience_value: 900, credits_per_guest: 2,
      category_slug: 'beach-pool', demo: true, art: 'beach',
      description: 'A full day on a reserved daybed by the infinity pool, with a welcome drink, a shared mezze platter and sunset access to the beach deck.',
      perks: ['Reserved daybed for up to 2 guests', 'Welcome drink + shared mezze platter', 'Towels, sunscreen and beach deck access', 'Sunset DJ set from 17:00'],
      deliverables: '4 stories · 1 reel · tag @venue',
      tags: ['beach club', 'daybed', 'pool', 'sunset', 'brunch'],
      slots: [
        { slot_id: 'SL-DEMO-01-1', offer_id: 'OFR-DEMO-01', weekday: 'Saturday',  time: '14:00', seats: 4 },
        { slot_id: 'SL-DEMO-01-2', offer_id: 'OFR-DEMO-01', weekday: 'Saturday',  time: '16:00', seats: 4 },
        { slot_id: 'SL-DEMO-01-3', offer_id: 'OFR-DEMO-01', weekday: 'Tuesday',   time: '14:00', seats: 4 },
        { slot_id: 'SL-DEMO-01-4', offer_id: 'OFR-DEMO-01', weekday: 'Wednesday', time: '12:00', seats: 4 }
      ]
    },
    'OFR-DEMO-02': {
      offer_id: 'OFR-DEMO-02', venue_id: 'VEN-DEMO-INBOX',
      experience_name: 'VIP Table', experience_value: 2500, credits_per_guest: 5,
      category_slug: 'nightlife', demo: true, art: 'nightlife',
      description: 'A reserved VIP table on the mezzanine with bottle service, a dedicated host and the best view of the resident DJ.',
      perks: ['Reserved VIP table for up to 2 guests', 'Bottle service + mixers', 'Dedicated host and skip-the-line entry', 'Resident DJ set from 23:00'],
      deliverables: '4 stories · 1 reel · tag @venue',
      tags: ['vip table', 'bottle service', 'club', 'dj', 'lounge'],
      slots: [
        { slot_id: 'SL-DEMO-02-1', offer_id: 'OFR-DEMO-02', weekday: 'Saturday',  time: '22:00', seats: 3, popular: true, always_full_for_unseated: true },
        { slot_id: 'SL-DEMO-02-2', offer_id: 'OFR-DEMO-02', weekday: 'Friday',    time: '23:00', seats: 3, always_full_for_unseated: true },
        { slot_id: 'SL-DEMO-02-3', offer_id: 'OFR-DEMO-02', weekday: 'Tuesday',   time: '21:00', seats: 3 },
        { slot_id: 'SL-DEMO-02-4', offer_id: 'OFR-DEMO-02', weekday: 'Wednesday', time: '22:00', seats: 3 }
      ]
    },
    // Browse-only (SPEC §4.3, in SPEC order).
    'OFR-0016': {
      offer_id: 'OFR-0016', venue_id: 'VEN-0010',
      experience_name: 'Cabana Day', experience_value: 1400, credits_per_guest: 3,
      category_slug: 'beach-pool', demo: false, art: 'beach',
      description: 'A private cabana for the day at Cobalt Cove beach club, with a fruit platter, chilled towels and a two-course lunch.',
      perks: ['Private cabana for up to 2 guests', 'Fruit platter + chilled towels', 'Two-course lunch at the beach grill'],
      deliverables: '3 stories · 1 reel · tag @venue',
      tags: ['beach club', 'cabana', 'pool', 'beach day'],
      slots: [], availability_slots: 3, availability_seats: 6
    },
    'OFR-0008': {
      offer_id: 'OFR-0008', venue_id: 'VEN-0004',
      experience_name: 'DJ Sunset Set', experience_value: 900, credits_per_guest: 2,
      category_slug: 'nightlife', demo: false, art: 'rooftop',
      description: 'Golden-hour rooftop session with a guest DJ, a signature cocktail and reserved lounge seating over the skyline.',
      perks: ['Reserved lounge seating', 'Signature cocktail + bar snacks', 'Guest DJ from 18:00'],
      deliverables: '3 stories · 1 reel · tag @venue',
      tags: ['rooftop', 'sunset', 'dj', 'cocktails'],
      slots: [], availability_slots: 2, availability_seats: 4
    },
    'OFR-0054': {
      offer_id: 'OFR-0054', venue_id: 'VEN-0031',
      experience_name: 'Weekend Roast', experience_value: 450, credits_per_guest: 1,
      category_slug: 'dining', demo: false, art: 'dining',
      description: 'A slow-roast sharing lunch for two with antipasti, house wine pairing and dessert at Sol Trattoria.',
      perks: ['Sharing roast for 2', 'Antipasti + dessert', 'House wine pairing'],
      deliverables: '3 stories · tag @venue',
      tags: ['brunch', 'roast', 'italian', 'lunch'],
      slots: [], availability_slots: 4, availability_seats: 8
    },
    'OFR-0019': {
      offer_id: 'OFR-0019', venue_id: 'VEN-0011',
      experience_name: 'Signature Massage', experience_value: 600, credits_per_guest: 2,
      category_slug: 'wellness-spa', demo: false, art: 'wellness',
      description: 'A 75-minute signature massage with steam room access and herbal tea in the relaxation lounge.',
      perks: ['75-minute signature massage', 'Steam room + relaxation lounge', 'Herbal tea ritual'],
      deliverables: '3 stories · tag @venue',
      tags: ['spa', 'massage', 'wellness', 'relax'],
      slots: [], availability_slots: 3, availability_seats: 3
    },
    'OFR-0055': {
      offer_id: 'OFR-0055', venue_id: 'VEN-0032',
      experience_name: 'Signature Facial', experience_value: 600, credits_per_guest: 2,
      category_slug: 'beauty', demo: false, art: 'beauty',
      description: 'A 60-minute signature facial with skin analysis, LED therapy and a take-home serum sample.',
      perks: ['60-minute signature facial', 'Skin analysis + LED therapy', 'Take-home serum sample'],
      deliverables: '3 stories · tag @venue',
      tags: ['facial', 'skincare', 'beauty', 'glow'],
      slots: [], availability_slots: 2, availability_seats: 2
    },
    'OFR-0006': {
      offer_id: 'OFR-0006', venue_id: 'VEN-0003',
      experience_name: 'Hot Yoga Flow', experience_value: 280, credits_per_guest: 1,
      category_slug: 'fitness', demo: false, art: 'fitness',
      description: 'A 60-minute heated vinyasa flow followed by a cold-pressed juice and access to the recovery lounge.',
      perks: ['60-minute heated flow class', 'Cold-pressed juice', 'Recovery lounge access'],
      deliverables: '2 stories · tag @venue',
      tags: ['yoga', 'fitness', 'workout', 'wellness'],
      slots: [], availability_slots: 5, availability_seats: 10
    }
  };

  // Display / search order: demo offers first, then browse-only in SPEC §4.3 order.
  data.OFFER_ORDER = ['OFR-DEMO-01', 'OFR-DEMO-02', 'OFR-0016', 'OFR-0008', 'OFR-0054', 'OFR-0019', 'OFR-0055', 'OFR-0006'];

  // The one interactive offer per demo venue (dashboard task card, inbox, calendar).
  data.DEMO_OFFER_FOR_VENUE = { 'VEN-DEMO-SLOT': 'OFR-DEMO-01', 'VEN-DEMO-INBOX': 'OFR-DEMO-02' };

  /* ── Lookups ────────────────────────────────────────────────────────────────────────────── */
  data.offer = function (id) {
    return (typeof id === 'string' && Object.prototype.hasOwnProperty.call(data.OFFERS, id)) ? data.OFFERS[id] : null;
  };

  data.venue = function (id) {
    return (typeof id === 'string' && Object.prototype.hasOwnProperty.call(data.VENUES, id)) ? data.VENUES[id] : null;
  };

  data.categoryBySlug = function (slug) {
    for (var i = 0; i < data.CATEGORIES.length; i++) {
      if (data.CATEGORIES[i].slug === slug) return data.CATEGORIES[i];
    }
    return null;
  };

  data.allOffers = function () {
    var out = [];
    for (var i = 0; i < data.OFFER_ORDER.length; i++) {
      var o = data.OFFERS[data.OFFER_ORDER[i]];
      if (o) out.push(o);
    }
    return out;
  };

  data.offersByCategory = function (slug) {
    return data.allOffers().filter(function (o) { return o.category_slug === slug; });
  };

  data.offersForVenue = function (venue_id) {
    return data.allOffers().filter(function (o) { return o.venue_id === venue_id; });
  };

  data.demoOfferForVenue = function (venue_id) {
    return data.offer(data.DEMO_OFFER_FOR_VENUE[venue_id]) || null;
  };

  data.slotById = function (slot_id) {
    if (typeof slot_id !== 'string') return null;
    var offers = data.allOffers();
    for (var i = 0; i < offers.length; i++) {
      var slots = offers[i].slots || [];
      for (var j = 0; j < slots.length; j++) {
        if (slots[j].slot_id === slot_id) return slots[j];
      }
    }
    return null;
  };

  /* ── Search ─────────────────────────────────────────────────────────────────────────────── */
  // Case-insensitive. Haystack per offer = experience_name + venue_name + category name + tags.
  // An offer matches when the whole (whitespace-normalised) query is a substring of the haystack,
  // OR every query word is. Empty / blank query → []. Results keep allOffers() order (demo first).
  //   'beach club' → Solace Beach Club (venue_name) + Cobalt Cove (tag 'beach club'); Maison Athletic
  //   Club does NOT match because 'beach' is missing → results_returned 2, as in SPEC §7.2.
  function norm(s) {
    return String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function haystack(o) {
    var v = data.venue(o.venue_id);
    var c = data.categoryBySlug(o.category_slug);
    var parts = [o.experience_name, v ? v.venue_name : '', c ? c.name : ''].concat(o.tags || []);
    return norm(parts.join(' | '));
  }

  data.searchOffers = function (q) {
    var query = norm(q);
    if (!query) return [];
    var words = query.split(' ');
    return data.allOffers().filter(function (o) {
      var h = haystack(o);
      if (h.indexOf(query) !== -1) return true;
      for (var i = 0; i < words.length; i++) {
        if (h.indexOf(words[i]) === -1) return false;
      }
      return true;
    });
  };

  /* ── Dates & labels ─────────────────────────────────────────────────────────────────────── */
  data.weekdayIndex = function (name) {
    var idx = data.WEEKDAYS.indexOf(String(name || ''));
    if (idx !== -1) return idx;
    idx = data.WEEKDAYS_SHORT.indexOf(String(name || '').slice(0, 3));
    return idx;
  };

  // Next occurrence of `weekday` strictly after `from` (default: today, local time). If `from` is
  // already that weekday the result is +7 days. Returns a Date at local midnight.
  data.nextDateForWeekday = function (weekday, from) {
    var target = data.weekdayIndex(weekday);
    if (target < 0) target = 6; // unknown → Saturday (never throws; data is fixed anyway)
    var base = (from instanceof Date && !isNaN(from)) ? from : new Date();
    var today = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    var delta = (target - today.getDay() + 7) % 7;
    if (delta === 0) delta = 7;
    return new Date(today.getFullYear(), today.getMonth(), today.getDate() + delta);
  };

  // Date of the slot's next occurrence, with the slot's clock time set (local).
  data.slotDate = function (slot, from) {
    var d = data.nextDateForWeekday(slot && slot.weekday, from);
    var m = /^(\d{1,2}):(\d{2})$/.exec(slot && slot.time ? slot.time : '');
    if (m) d.setHours(parseInt(m[1], 10), parseInt(m[2], 10), 0, 0);
    return d;
  };

  // 'Sat 14:00'
  data.slotLabel = function (slot) {
    var idx = data.weekdayIndex(slot && slot.weekday);
    var short = idx >= 0 ? data.WEEKDAYS_SHORT[idx] : String(slot && slot.weekday || '').slice(0, 3);
    return short + ' ' + (slot && slot.time ? slot.time : '');
  };

  // 'Saturday 4 Oct · 14:00' (U+00B7 middle dot with spaces; day of month not zero-padded)
  data.slotLabelLong = function (slot, from) {
    var d = data.slotDate(slot, from);
    var idx = data.weekdayIndex(slot && slot.weekday);
    var full = idx >= 0 ? data.WEEKDAYS[idx] : data.WEEKDAYS[d.getDay()];
    return full + ' ' + d.getDate() + ' ' + data.MONTHS_SHORT[d.getMonth()] + ' · ' + (slot && slot.time ? slot.time : '');
  };

  // 900 → '900'; 2500 → '2,500'; 120.5 → '120.5'
  data.fmtNumber = function (n) {
    var num = Number(n);
    if (!isFinite(num)) num = 0;
    var neg = num < 0;
    num = Math.abs(num);
    var whole = Math.floor(num);
    var frac = Math.round((num - whole) * 100) / 100;
    var s = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    if (frac > 0) s += String(frac).slice(1); // '.5' / '.25'
    return (neg ? '-' : '') + s;
  };

  // fmtAED(900) → 'AED 900'; fmtAED(2500) → 'AED 2,500'
  data.fmtAED = function (n) {
    return TSS.config.CURRENCY + ' ' + data.fmtNumber(n);
  };

  // creditsLabel(offer) → '2 credits per guest' / '1 credit per guest'
  data.creditsLabel = function (offer) {
    var c = offer && typeof offer.credits_per_guest === 'number' ? offer.credits_per_guest : 1;
    return c + (c === 1 ? ' credit' : ' credits') + ' per guest';
  };
})();
