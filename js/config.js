/* config.js — The Secret Society demo · TSS.config (ARCHITECTURE §3).
   Plain browser JS, no modules. Every constant the other files read lives here; nothing in this
   file talks to the SDK or the DOM. Keep every key name exactly — analytics.js, state.js and the
   screens read them by name. */
window.TSS = window.TSS || {};

TSS.config = {
  API_KEY: '91a049dfcf02afc23c2aa2d43f1d3748',

  // Experiment: the unified loader's client accepts the analytics key (HTTP 200, no variants while
  // the flag has no deployment). Replace with the client-side deployment key once one is created in
  // Amplitude (Experiment → Deployments → client deployment for this project).
  EXPERIMENT_DEPLOYMENT_KEY: '91a049dfcf02afc23c2aa2d43f1d3748',
  FLAG_KEY: 'slot-full-notice-viewed-reduction',

  BASE: '/tss-demo',
  APP_NAME: 'The Secret Society',
  PROD_DOMAIN: 'khaledismail-sandbox.github.io',
  // localhost / 127.0.0.1 / [::1] → SDK opted out, events only logged (SPEC §2).
  IS_LOCAL: (typeof location !== 'undefined') &&
    /^(localhost|127\.0\.0\.1|\[::1\])$/.test(String(location.hostname || '')),

  // Geo enrichment written on every outgoing event as top-level fields (SPEC §6.3).
  GEO: { country: 'United Arab Emirates', region: 'Dubai', city: 'Dubai', platform: 'Web' },

  CREDIT_PRICE_AED: 120,
  CURRENCY: 'AED',

  // Allowed attribution bundles (SPEC §6.6). referring_domain = new URL(referrer).hostname.
  ATTRIBUTION_BUNDLES: [
    { utm_medium: 'cpc',       utm_source: 'google',           utm_campaign: 'tss_creator_acquisition_search', referrer: 'https://www.google.com/' },
    { utm_medium: 'organic',   utm_source: 'google',           utm_campaign: 'tss_seo_creator_guides',         referrer: 'https://www.google.com/' },
    { utm_medium: 'social',    utm_source: 'instagram',        utm_campaign: 'tss_ig_creator_invites',         referrer: 'https://l.instagram.com/' },
    { utm_medium: 'social',    utm_source: 'tiktok',           utm_campaign: 'tss_tiktok_creator_spotlight',   referrer: 'https://www.tiktok.com/' },
    { utm_medium: 'affiliate', utm_source: 'creator_referral', utm_campaign: 'tss_member_get_member',          referrer: 'https://linktr.ee/' },
    { utm_medium: 'email',     utm_source: 'newsletter',       utm_campaign: 'tss_weekly_drops',               referrer: 'https://mail.google.com/' }
  ],
  // Used when the landing URL carries no utm_source/utm_medium/utm_campaign trio.
  FALLBACK_BUNDLE: { utm_medium: 'social', utm_source: 'instagram', utm_campaign: 'tss_ig_creator_invites', referrer: 'https://l.instagram.com/' },

  // Storage keys. MARKET_KEY is localStorage (shared by both windows); SESSION_KEY and DEBUG_KEY are
  // sessionStorage (per window, like the SDK identity).
  MARKET_KEY: 'tss-demo-marketplace',
  SESSION_KEY: 'tss-demo-session',
  DEBUG_KEY: 'tss-demo-debug',
  DEBUG_LOG_MAX: 60,

  // Blogger personas offered on Join / Log in. user_id = demo-blogger-<persona>-<MMDD-HHmm>.
  PERSONAS: {
    sara: { name: 'Sara', avatar_seed: 1 },
    omar: { name: 'Omar', avatar_seed: 2 }
  },

  // Stable blogger user properties (SPEC §6.6). account_age_days is set per mode by analytics.js.
  BLOGGER_PROFILE: {
    track_record: 'Steady Regulars',
    primary_niche: 'lifestyle',
    follower_band: '10k-25k',
    home_city: 'Dubai',
    device_type: 'ios',
    applications_30d: 0,
    checkins_30d: 0
  },

  // Prefilled "Message to the venue" on the Apply sheet. EXACTLY 124 characters (plain ASCII, so
  // .length === 124 in every runtime) → Application Submitted.pitch_length_chars = 124 when untouched.
  // Verified: node -e "console.log(TSS.config.PITCH_DEFAULT.length)" → 124 (scratchpad/build/foundation-data/test.mjs asserts it).
  PITCH_DEFAULT: 'Lifestyle creator based in Dubai (10k-25k). I\'d love to feature your venue in 4 stories and a reel with the location tagged.'
};
