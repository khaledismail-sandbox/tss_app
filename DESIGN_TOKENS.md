# The Secret Society demo — design system

Dark-only design tokens for the 390×844 phone-frame recreation of the TSS iOS app. The CSS
custom properties live in `css/tokens.css`; this document is the human-readable record of where
every value came from and what was decided where the four measurement lenses (colour, geometry,
typography, components) disagreed.

Coordinates in this document are full-size image pixels `(x, y)` in the reference PNGs.
Conversion: **2.611 image px = 1 CSS px** (see Method).

---

## 1. Sources

Reference folder: `/Users/khaledismail/Desktop/tss-demo-design-reference/` — App Store marketing
screenshots, 1242×2687 px, an iPhone 14 Pro mockup on a black art-deco background. The app UI is
inside the phone screen (x 108→1133, top y 702; bottom cut off by the image edge).

| File | Screen | Used for |
|---|---|---|
| `appstore-6.5.1.png` | Explore home hero (tilted) | header pill, bell badge, filter band, hero headline — estimates only |
| `appstore-6.5.1-1.png` | Blogger profile (tilted) | tab bar, active-tab glow, segmented control, stat cards, donut — estimates + colour profile |
| `appstore-6.5.3.png` | Explore "Upcoming Events in Dubai" | hero scrim, chips + count badge, date pills, date-strip panel, calendar pill, gradient text, event card, heart button |
| `appstore-6.5.4.png` | My Events (invites) | large title, stat tiles, divider, chips, toggle bar, invite cards, Decline/Accept, meta text |
| `appstore-6.5.5.png` | Venue-manager dashboard | name pill, icon buttons, task card, teal tag, Start Swiping, venue row, 3×2 tiles, Create tile |
| `appstore-6.5.6.png` | Swipe-to-invite | back button, solid teal tag, card stack, X / ✓ buttons |
| `appstore-6.5.7.png` | Establishments | hero, sort button, segmented control, venue cards, red tag, tag chips, secondary/disabled buttons, FAB |
| `appstore-6.5.8.png` | To Review | back header + count badge, 3-segment control, list rows, check badge, gradient link + underline |
| `website-home.png` | the-secret-society.com (Wix) | website-only tokens (bg, nav, accent #7a4cf8); app screenshots take priority |

Half-size previews (`…-half.png`) were used for visual sanity checks only; all numbers come from the
full-size files.

## 2. Method

* **Starting point:** `/Users/khaledismail/Desktop/tss-demo-design-reference/extract_colours.py`
  (Pillow: median-cut dominant colours, region means, luminance, half-size previews). It established
  "dark UI, near-black canvas, one violet accent" and produced the first hypotheses.
* **Colour lens** (`scratchpad/measure/colour/01…09_*.py`, `lib.py`): flat fills = mode of a 13×13
  box with spread; text = glyph-core histogram (pixels ranked by distance from the local background,
  top 3–15 % kept, quantised mode + brightest); gradients = ≥7 evenly spaced 5×5 box means along
  rows/columns/diagonals + radial samples; borders = per-pixel scans across the edge.
* **Geometry lens** (`scratchpad/measure/geometry/scan.py`, `bbox.py`, `shape.py`): colour runs along
  rows/columns, bright/near-colour bounding boxes, rounded-rect extents with a corner-radius fit
  `r = u + d + √(2ud)` on the arc pixels.
* **Typography lens** (`scratchpad/measure/typography/*.py`, `*.mjs`): 51 glyph crops, cap-height and
  stem measurements, 32 Google families calibrated on canvas with Playwright (cap ratio, x/cap,
  stem/cap per weight, word widths), like-for-like proof render
  (`proof_pjs_vs_reference.png`).
* **Components lens** (`scratchpad/measure/components/measure.py`, `colours.py`, `textcolours.py`,
  `sheet.html`): component inventory, icon-set comparison renders, hypothesis sheet.
* **Synthesis checks** (`scratchpad/measure/synth/verify.py`, `verify2.py`, `verify3.py`): re-measured
  every disputed value — screen bounds, tab-bar top on five screens, bottom-strip colour census, card
  corner fits, stem-core text colours at top-1 %/2 %, chip/pill/icon-button ring ink.
* **Critic pass** (`scratchpad/measure/critic/*.py`, re-run in `scratchpad/measure/apply/verify_corrections.py`):
  independent refutation attempt on every token — coverage-sum heights/strokes, flood-fill bboxes,
  50 %-edge least-squares corner fits. Everything held except the eleven items listed under
  "Corrections applied" at the end of §3.

**Scale.** The full-bleed heroes in 6.5.3 and 6.5.7 start at x = 108 (`#625042` after `#000000` bezel)
and end at x = 1133 → 1026 px for the 393 pt screen → **2.611 px per pt**. The demo frame is 390 px
wide (0.8 % narrower) so the same CSS values are used. Cross-check: the status-bar "9:41" digits are
31 px = 11.9 pt, exactly SF Pro 17 pt semibold. The components lens measured 2.76 px/pt because it
took the bezel (x 79…1165) as the screen; its pt values are therefore 5.7 % too small and were
rescaled or replaced by the geometry lens's numbers.

## 3. Decisions where the lenses disagreed

| Topic | Options | Decision & evidence |
|---|---|---|
| Scale | 2.611 (geometry, typography) vs 2.76 (components) | **2.611** — verified hero x 108→1133 |
| Side gutter | 24 (geometry) vs 32 (components) | **24 / content 342** — card left edges at 53–66 px from x = 108 (6.5.4 x 164, 6.5.5 x 174, 6.5.8 x 161) |
| Card radius | 30 (geometry fit 79–81 px) vs 20 (components) | **30** — synth fits: invite card 85.6/86.6 px, task card 81.6 px, To Review row 68 px → 26–33 CSS px, median 30 |
| Icon button / button height | 50 / 42 (geometry) vs 48 / 40 (components) | **50 / 42** — same 132 / 110 px, correct scale |
| Segmented radii | 18 container / 14 pill (geometry) vs 16 / 12 | **18 / 13** (container 46 px; pill 30–35 px on the 50 %-coverage edge — the earlier 36–39 px fit included anti-aliased rows; pill inset 16 px = 6) |
| Tab bar ground | #03031b (colour) vs #06041e (components) | **#03031b** — dominant colour of the bottom strip on all five straight shots (census 9.7k–19.7k px each) |
| Tab bar height | 84 (geometry est.) vs 88 (components est.) | **104** — bar top measured at y 2645–2664 on 6.5.3/4/5/7/8 → 746 pt down an 852 pt screen → ≈105 pt; scaled to the 844 frame = 104 (70 content + 34 home area) |
| Brand gradient | 3-stop #f59896→#e84ee6→#a842f8 (colour) vs 2-stop #f5909e→#b445f4 | **3-stop, 90deg** — measured centre #e84ee6 vs #cf6cc7 predicted by a 2-stop blend; quarter points match within 4/255; columns flat (≤8/255) so horizontal, not 135deg |
| Action gradient | #8c4bde→#3332d6 (colour, extrapolated to edges) vs #8248db→#3a34d6 | **#8c4bde→#3332d6**, angle by aspect (70deg buttons, 84deg tall pill) — light corner bottom-left on every element |
| Badges / dots | action gradient (colour) vs solid #6e42da | **gradient** (24-badge 180°→0° #7d47dc→#3d35d7), at 78deg so the bottom row is ≈9/255 brighter like the buttons; the solid fallback `--color-accent` is the gradient's sRGB midpoint **#603eda** (dot/badge centres #5b3dd9–#5f3eda) — #6e42da was the 33 % point |
| Meta text | #766f94 (colour core) vs #686281 (components mean) | **#766f94** — synth top-1 % stem-core means #716b8c (6.5.4), #716b8c (6.5.5), #777193 (6.5.7 "Brand :"); brightest #7c7498. #686281 is the mean including anti-aliased edge pixels |
| Secondary greys | white-alpha ladder (colour) vs fixed hexes (components) | **white-alpha** — See All #9f9f9f (.62), Last updated #969696 (.59), Influencer #b6b5b9 (.70 on card), Check-in #8e8c91 (.50), Interest Shown #78767c (.42), address #a19fa4 (.60) |
| Chip ring | 1 px .30 (colour) / 1 px .22 (geometry) / 1.5 pt .30 (components) | **1 px rgba(255,255,255,.30)** — peak #515151, total ink .88 alpha·px ≈ 1 pt at .34; name pill peak #4e4e4e ink 1.68 → 2 px at .30; icon-button ring peak #1b1b1b ink .54 over 6 px → 2 px at .10 |
| Chip fill | outlined (colour) vs #343434 fill (hypothesis) | **transparent** — chip interior (560,1500) = #010101 |
| Segmented container | #221f28 (hypothesis) vs #18151e | **#18151e** (6.5.7 (900,1184), 6.5.8 (300,1100)) |
| Secondary button | #302d35 (hypothesis) vs #23202b | **#23202b** (Decline (410,2092), More Details (260,1828)) |
| Active tab | #7345dc (colour) vs #7a4cf8 (components/web) | **#7345dc**; #7a4cf8 kept as `--color-accent-web` |
| Inactive tab | .35 white (colour) vs #6b6878 | **rgba(255,255,255,.35)** (#545459–#6a6a6a on the tilted bar) |
| Tab glow radius | 43–45 pt (colour) / 64 (geometry) / 72 (components) | **52 px radius (104 px box), peak .50** — colour profile peaks #33227e ≈ 50 % of #7345dc and reaches the bar colour at ≈130 px |
| Dashboard icon squares | #f45e5f/#469baf/#43ab88/#c473f6 (colour) vs #e85c5c/#40889b/#3d9377/#b068dd | **colour lens** (flat 13×13 modes, spread 0) |
| Tag backgrounds | teal #20272d / red #3a2029 (colour) vs #20262c / #391f28 | **colour lens** (±1/255 apart; expressed as status colour at .13/.15 over the card) |
| Heart button / FAB / switch / date pill | 48 / 62 / 51×31 / 70×102 (geometry) vs 54 / 64 / 48×28 / 68×98 | **geometry** (125 / 162 / 135×80 / 185×267 px) |
| Font | Plus Jakarta Sans (typography) vs "SF-Pro-like, use Inter" (components aside) | **Plus Jakarta Sans** — see §5 |
| Type sizes | typography (cap-height derived) vs components (larger, scale error) | **typography** |
| Tag / tag-chip height | 24 (geometry, 61 px outer ring) vs 22 | **23** — coverage-sum heights between letters: teal tag 59.2–59.8 px, red tag 60.2–60.3, solid teal 60.0–60.1 ⇒ 22.7–23.1 CSS (24 would be 62.7 px); the outlined chip's outer ring 61 px = 23.4 |

**Corrections applied after the critic pass** (each verified against the PNGs before the change):

| Token | Was | Now | Evidence |
|---|---|---|---|
| `--size-calendar-pill-w` | 137 | **147** | 6.5.3 pill #23202b spans x 430..813 = 384 px = 147 CSS at mid-height, centre x = 622 = screen centre; rows 16 px from the top/bottom edges give 358–360 px = 137 because they cut the rounded ends (a chord, not the width). Height 93 px = 36 holds |
| `--radius-tabbar-top` | — (bar described as a flat strip) | **40** | 6.5.4 straight edge y = 2664; canvas→navy inset from x = 108 / 1133 is 28.3/27.6 CSS at 2.3 CSS below the edge, 23.0/22.2 at 3.8, 19.9/19.1 at 5.4, 17.2/16.9 at 6.9, 14.9/14.6 at 8.4 — a circle r = 40 predicts 26.6/22.9/20.0/17.6/15.4. 6.5.7 (edge 2651): 25.7 at 3.4 (r40 → 23.8), 11.1 at 13.4 (r40 → 10.1). Pixels outside the arc are glow-tinted canvas (#0d0713…#0f0917), not bezel |
| `--size-tag-h` | 24 | **23** | see the row above |
| `--type-tag-chip-upper` | (tag chips shared `--type-tag-upper` 9) | **600 8.5px/1** (superseded in round 2 → 7.5, §16; round 3 → 8 with pad 12, §17) | half-max stem heights 6.5.7 BAR 'B' x = 426 and BEACH CAFE 'E' x = 561: 16–16.5 px = 6.1–6.3 CSS cap ⇒ 8.2–8.5 px; status tags stay a size up (UNDER REVIEW 'N' 18.3 px ⇒ 9.4, OPEN FOR SWIPE 'P' 17.8 ⇒ 9.2) |
| `--radius-segment` | 14 | **13** | 50 %-edge least-squares fits: 6.5.7 ESTABLISHMENTS pill TL/TR/BL/BR 30.0/31.9/30.0/31.9 px = 11.5–12.2 CSS; 6.5.8 CHECKED OUT 32.5–34.2 px = 12.4–13.1 CSS; mean ≈12.5 → 13 |
| `--icon-stroke-back` | back arrow used `--icon-stroke-heavy` 2 (= 2.33 CSS at the 28 box) | **1.6** | coverage-sum shaft thickness 6.5.8 cols x 200–216: 4.30 px = 1.65 CSS; 6.5.6 4.09 px = 1.57 — same weight as the header glyphs (search 1.53–1.60, bell 1.73–1.76). Only the FAB plus is heavier (5.6–6.2 px = 2.1–2.4 CSS) |
| stroke scaling (`--icon-vector-effect`) | stroke-width in viewBox units, so a 16-box icon rendered 1.0 CSS | **non-scaling-stroke**, strokes in CSS px | 6.5.7 map-pin left wall 5.16 px = 1.98 CSS; 6.5.5 refresh arc wall 4.16 px = 1.59 CSS; 6.5.3 heart 1.70, layout-toggle 1.46 — small icons keep the large icons' weight |
| `--icon-size-layout-toggle` / `--icon-size-refresh` | 24 / 16 boxes (glyphs ≈20 / 12 CSS) | **17 / 12** (round 3: 15 / 12 — the 17 box ignored the 1.6 stroke, §17) | 6.5.3 layout-toggle glyph bbox (982,1356)–(1016,1391) = 35×36 px = 13.4×13.8 CSS (`server` spans 20/24 of its box ⇒ 17 box); 6.5.5 refresh glyph (360,1078)–(383,1102) = 24×25 px = 9.2×9.6 CSS. The pin is fine at 16: 31×37 px = 11.9×14.2 CSS |
| `--icon-size` (header buttons) | 24 | **26** | 6.5.5 search glyph 53 px = 20.3 CSS wide (Lucide `search` spans 18/24 ⇒ 19.5 at 26); 6.5.4 bell 46×54 px = 17.6×20.7 CSS (Lucide bell 16×20 ⇒ 17.3×21.7 at 26 — the path actually spans 17.5×20 and the 1.75 stroke sits on top, so round 3 moved the bell to its own 22 box `--icon-size-bell`, §17) |
| `--color-accent` / `--color-field-focus` | #6e42da | **#603eda** | sRGB midpoint of #8c4bde→#3332d6; measured dot/badge centres 6.5.4 (344,1100) #5f3eda, (574,1104) #5c3dda, 6.5.8 (577,906) #5b3dd9 |
| `--gradient-badge` | 90deg | **78deg** | 6.5.8 "24" badge row y = 906: #6d42dc / #5b3dd9 / #4838d8 at x 564/577/590; row y = 942: #7745dc / #643fda / #503bd8 — bottom ≈9/255 brighter at every x, the buttons' bottom-left light corner |

Borderline values that were checked and **kept**: body/button/chip 13 (caps 24.0–25.4 px ⇒ 12.3–13.0),
toggle bar 64 (164 px = 62.8), FAB 62 (63), avatar 40 (39), tab bar 104 (99–108 across shots).

## 4. Palette

All hexes are flat-fill modes (spread 0 unless noted) or stem-core text estimates.

### Canvas & surfaces

| Token | Value | Sampled at |
|---|---|---|
| `--color-bg` | `#010101` | 6.5.4 (600,1380) (140,1800) (600,2210); 6.5.5 (600,1280) (600,1860); 6.5.7 (600,2090); 6.5.8 (600,1000); 6.5.3 (600,2000); 6.5.6 (600,1140) |
| `--color-bg-tabbar` | `#03031b` | bottom strip y ≥ 2650 on 6.5.3/4/5/7/8 (census); 6.5.1-1 (460,2300) |
| `--color-surface` | `#18151e` | 6.5.4 (900,1900) (430,1140); 6.5.5 (260,1660); 6.5.7 (900,1700) (900,1184); 6.5.8 (900,1470) (300,1100); 6.5.3 (200,1540) |
| `--color-surface-elevated` | `#23202b` (= white .05 over surface) | 6.5.4 Decline (410,2092); 6.5.7 More Details (260,1828); 6.5.3 calendar pill (450,1908) |
| `--color-surface-pressed` | `#2f2c35` (= white .10 over surface) | 6.5.5 neutral icon square (538,2488); 6.5.1-1 inner divider (300,2023); 6.5.7 tag-chip ring peak |
| `--color-surface-disabled` | `#1e1b26` | 6.5.7 "Show Event List" (300,1972) |
| `--gradient-surface-section` | transparent → rgba(24,21,30,.75) | 6.5.3 col x = 150: #010101@1650 → #120f16@1910, hard edge @1920 |
| `--color-marketing-bg` | `#060606` | outside the phone (mockup only) |

### Borders

| Token | Value | Sampled at |
|---|---|---|
| `--color-border` | `rgba(255,255,255,.10)` (#1a1a1a on bg, #2f2c35 on card) | 6.5.4 bell ring y = 966 x 931–934 #1b1b1b; 6.5.5 search x 773–776; 6.5.8 back x 137–140; dividers 6.5.4 x = 600 y 1387–1390 #1a1a1a; 6.5.7 BAR chip ring #312e37 |
| `--color-border-strong` | `rgba(255,255,255,.30)` (#4e4e4e) | 6.5.5 pill y = 938 x 172–175 #4e4e4e; 6.5.3 Filters chip x = 172 #555354; 6.5.4 Filters chip x = 165 #515151; layout-toggle 6.5.3 x = 929 #575654 |
| `--border-w-hairline` / `--border-w-ring` | 1 px / 2 px | chip ink .88 alpha·px; pill ink 1.68; icon-button ink .54 over 6 px |

### Text

| Token | Value | Sampled at |
|---|---|---|
| `--color-text-primary` | `#ffffff` | "My Events", "Hot Yoga Class", "Peabeach", "Decline", chip labels — all mode #f8f8f8 |
| `--color-text-meta` | `#766f94` (lavender grey) | 6.5.4 "25 May 2023 • 8:00 AM • 2 Hrs" (380,1956,850,1992); 6.5.5 meta (390,1502,840,1536); 6.5.7 "Brand :" (390,1504,476,1536); tile arrows ↗ #756f91 |
| `--color-text-secondary-strong` | `rgba(255,255,255,.70)` | 6.5.8 "Influencer" (368,1390,516,1424) #b6b5b9 |
| `--color-text-segment-inactive` | `rgba(255,255,255,.62)` | "CHECKED IN", "NO SHOW", "BRANDS", "PROFILE HEALTH" #a8a7ab |
| `--color-text-secondary` | `rgba(255,255,255,.60)` | 6.5.5 "Last updated :" #969696, "See All" #9f9f9f; 6.5.6 "20:00 mins left" #989898; 6.5.7 address #a19fa4 |
| `--color-text-tertiary` | `rgba(255,255,255,.50)` | 6.5.5 "The Secret Society Resort" #858585; 6.5.1-1 "Blogger" #848484; 6.5.8 "Check in …" #8e8c91; pin icon #8c8a8f |
| `--color-text-muted` | `rgba(255,255,255,.42)` | 6.5.3 "Thu"/"Sat" #757279; 6.5.4 "Interest Shown" #78767c; 6.5.1-1 "Followers" #7a787e; 6.5.6 "3 / 400" #707070 |
| `--color-text-disabled` | `rgba(255,255,255,.21)` | 6.5.7 "Show Event List" label #4d4a53 |
| `--color-text-tab-inactive` | `rgba(255,255,255,.35)` | 6.5.1-1 "Explore" #545459, "My Events" #6a6a6a, inactive icon #5b5b5d |
| `--color-text-tab-active` | `#ffffff` | 6.5.1-1 "Profile" brightest #fefefe (the .90 came from an anti-aliased core mean #e9e7f0; round 2) |
| `--color-text-secondary-hex` / `-tertiary-hex` / `-muted-hex` | `#999999` / `#808080` / `#6b6b6b` | the .60 / .50 / .42 tones flattened onto the canvas, for icon strokes only — overlapping sub-paths of a white-alpha stroke compound to ≈.84 (6.5.5 refresh glyph is a flat #969696, brightest #a2a2a2; round 2) |
| `--color-text-on-accent` | `#ffffff` | "Requests", "ESTABLISHMENTS", "Accept", badge digits, "OPEN FOR SWIPE" (solid) |

### Accent & status

| Token | Value | Sampled at |
|---|---|---|
| `--color-accent` | `#603eda` (= `--gradient-action-mid`, the action gradient's sRGB midpoint; also `--color-field-focus`) | centre of stat-tile dots 6.5.4 (344,1100) #5f3eda, (574,1104) #5c3dda; 6.5.8 "24" badge (577,906) #5b3dd9. Solid stand-in only — the real elements are gradients. (Was #6e42da, the 33 % point, which renders lighter/pinker than the gradient average.) |
| `--color-accent-tab` | `#7345dc` | 6.5.1-1 active Profile icon col x = 716 y 2368–2374 |
| `--color-accent-web` | `#7a4cf8` | website-home.png CTA (1062,46), nav "Home", hairline (100,353) |
| `--color-success` | `#4ecb70` | 6.5.8 check badge (306,1436) (292,1420) |
| `--color-danger` / `--color-danger-text` | `#f45e5f` / `#fb6162` | 6.5.5 "Under Review" square (224,2174); 6.5.7 "UNDER REVIEW" text core #fd6161 |
| `--color-info` | `#469baf` | 6.5.5 "Upcoming Events" square (538,2174) |
| `--color-green` | `#43ab88` | 6.5.5 "Open for swipe" square (852,2174); 6.5.6 filled tag (496,880); 6.5.5 tag text #45ae8b |
| `--color-purple` | `#c473f6` | 6.5.5 "Happening now" square (224,2488) |
| `--color-icon-square-neutral` | `#2f2c35` | 6.5.5 "Past Events" square (538,2488) |
| `--color-tag-teal-bg` / `-text` | `#20272d` (= green .13 over card) / `#43ab88` | 6.5.5 (398,1373) (642,1373); text (410,1354,630,1392) |
| `--color-tag-teal-solid-bg` | `#43ab88`, white text | 6.5.6 header tag (496,880) (736,880) |
| `--color-tag-red-bg` / `-text` | `#3a2029` (= red .15 over card) / `#fb6162` | 6.5.7 (796,1458) (1016,1458); text (810,1436,1000,1480) |
| `--color-check-badge-ring` | `#18151e`, 1–2 px | 6.5.8 col x = 306 y 1396–1398 |
| `--color-heart-button-bg` / `-icon` | `#ffffff` / `#000000` | 6.5.3 (930,2244) (954,2200); glyph (932,2222,976,2266) |
| `--color-avatar-circle` / `-glyph` | `#1e1d3c` / `#6e7feb` | 6.5.5 briefcase circle (220,910), row y = 936 x 200–296 |
| `--color-chart-legend-2` | `#5438b3` | 6.5.1-1 legend dot row y = 2198 x 554–574 |

### Website-only (lower priority than the app)

`--color-web-bg #000000` (640,300) · `--color-web-nav-bg #08070c` (30,44) · `--color-web-text #eaeaea` ·
`--color-accent-web #7a4cf8`. The Wix CSS values #0d0c14 / #8f8f8f / #5a587c do not appear in the
screenshot and are not used by the app.

## 5. Gradients

| Token | CSS | Evidence |
|---|---|---|
| `--gradient-brand` | `linear-gradient(90deg, #f59896 0%, #e84ee6 50%, #a842f8 100%)` | 6.5.4 "82" tile row y = 1115 x 180→340: #f48ca2 … **#e74ee5** … #b143f6; 6.5.7 ESTABLISHMENTS row y = 1190 x 200→600; FAB r = 60 at 180°/270°/90°/0°: #f488a7 / #e84ee5 / #ed50e3 / #bb45f3 (top = bottom ⇒ horizontal); Create-tile 1 pt border #fa9e95 / #f854f7 / #ab42f9. Columns vary ≤ 8/255 over the element height ⇒ 90deg. |
| `--gradient-text` | same as brand, `-webkit-background-clip: text; color: transparent` | "45 Events found" #fb95a3 → #c848f3; "Add Review" #f582b0 → #c146ee with a 1 pt gradient underline (col x = 930 y 1376–1378 #f754eb); "Dubai"; "influencers" |
| `--gradient-action` | `linear-gradient(70deg, #8c4bde 0%, #3332d6 100%)` | 6.5.4 Accept row y = 2055 x 700→950: #7f47dc … **#5b3dd9** (= sRGB midpoint ⇒ 2-stop) … #3633d7; bottom-left corner brighter (#884add) ⇒ light corner bottom-left; 6.5.5 Start Swiping #8147dc→#3532d6; toggle track #7745dc→#3b33cf; ✓ button #7043da→#4436d7 |
| `--gradient-action-wide` / `-toggle` / `-tall` | 62deg / 74deg / 84deg | vertical:horizontal change ratio scales with aspect (0.62 on 3.5:1, 0.40 on 2.6:1, 0.10 on the 0.68:1 date pill) ⇒ Figma-style relative angle ≈ 15 % rise |
| `--gradient-badge` | action gradient, **78deg** (bottom-left light corner, the buttons' ≈15 % relative rise on a ~1.1:1 box) | 6.5.8 "24" badge 180°→0° #7d47dc→#3d35d7; top row y = 906 #6d42dc→#4838d8 vs bottom row y = 942 #7745dc→#503bd8 (bottom ≈9/255 brighter); 6.5.3 Filters "2" #7544db→#4236d7; 6.5.1 bell "30" #7e46db→#4137d8; stat-tile dots #8448e2→#4337d9 |
| `--gradient-accent-deep` | `linear-gradient(70deg, #5f36ac 0%, #2f29a7 100%)` | 6.5.5 Create-tile icon square (841–909, 2462–2530): top row y = 2482 #5f36ac → #2f29a7 (= action × 0.75), bottom row y = 2524 #663aae → #372daa — bottom-left ≈7–18/255 brighter, the action gradient's light corner, so the same 70deg as the buttons (was 90deg; round 2) |
| `--gradient-filter-panel` | `linear-gradient(70deg, #8c4bde 0%, #3332d6 100%)` — **opaque** action gradient | 6.5.1 panel-only pixels between / around the tiles: (788,2100) #6f42db, (837,2142) #6f42da, (986,2113) #7152de, (1235,2065) #4a38d8 — these sit exactly on #8c4bde→#3332d6; the tiles read #8e5ae0 / #7954df / #6951dd = panel + white ≈.07 (`--color-filter-tile` .06 kept). At α .85 over the dark hero the panel rendered #673bbc → #332db7 (25–30/255 too dark, right third indigo); round 2 |
| `--scrim-hero-bottom` | `rgba(1,1,1,0) 45% → .55 70% → .92 88% → #010101 100%` | 6.5.3 col x = 140 y 800→1340: #8e6b43@1060 → #331807@1240 → #010101@1300; 6.5.7 col x = 1110: #937a9a@1000 → #020617@1160 |
| `--scrim-hero-top` | `rgba(0,0,0,.45) 0% → 0 20%` | 6.5.3 col x = 1110: sky brightens downward #1b1f2b@800 → #49484d@940 (low confidence) |
| `--glow-tab` | `radial-gradient(circle, rgba(115,69,220,.50) 0%, transparent 100%)` on a 104 px box | 6.5.1-1 col x = 716: #100b33@2284 … #33227e@2392 … #302076@2416; row y = 2320: #090623 → #1f1553 → #050521; spills 20–25 pt above the bar on every screen (6.5.4 #2e1f3f@2662 → bar @2668) |

## 6. Typography

**Chosen Google Font: Plus Jakarta Sans** (weights 400/500/600/700).

Why: every diagnostic letterform in the crops matches — double-storey `a` with a straight stem
("Peabeach", "Class"), single-storey `g` with an open hook ("Upcoming"), straight `y` tail with a
flat cut ("My", "Category"), **slanted top-left cut on `t`** ("Events", "Society" — SF Pro, Inter,
DM Sans, Manrope and Instrument all have flat tops), `1` with a flag and no foot, closed `4`, `M`
with vertical sides, `G` with a bar, flat-cut `C`/`e` terminals. Quantitatively, "My Events"
width/cap = 6.27 measured vs PJS 6.25 (Manrope 6.46, Inter 6.61, Figtree 6.50, SF 6.50); the
like-for-like proof render reproduces cap heights 73/25/19 px exactly and word widths within
±3 % (proof: `scratchpad/measure/typography/proof_pjs_vs_reference.png`). Confidence ≈ 85 % that
PJS is the best free stand-in; the real face is probably a commercial Aeonik-class grotesque.

Runner-ups (in order): Figtree (flatter `t`, narrower `M`), Albert Sans (splayed `M`, looser),
Instrument Sans (flat `t`), Manrope (too wide). Rejected: Poppins / Outfit / Urbanist / Lexend
(single-storey `a`), Inter / DM Sans / Geist (neutral, flat `t`), Sora / Syne / Work Sans (too
wide). **SF Pro is only the status bar and the marketing captions; Syne is the website's heading
face and appears nowhere in the app UI.**

Loading: `<link rel="preconnect" href="https://fonts.googleapis.com">`,
`<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`, then
`https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap`.
Fallback stack: `"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "SF Pro Display",
"Segoe UI", Roboto, Helvetica, Arial, sans-serif`; `-webkit-font-smoothing: antialiased`.

Size formula: PJS cap height = 0.75 em (0.745 measured in headless Chromium) ⇒
`font-size = cap_px / (2.611 × 0.75) = cap_px / 1.958`.
Weights from stem/cap against PJS (400 .107 · 500 .133 · 600 .160 · 700 .187).

### Type scale

| Role (token) | Sample | cap px | CSS | Weight | LH | Tracking |
|---|---|---|---|---|---|---|
| display-xl | "My Events" (6.5.4) | 73 | 37 | 600 | 1.15 | −0.01em |
| display | "Upcoming / Events in Dubai" (6.5.3; baseline pitch 105 px = 40) | 65 | 33 | 600 | 1.2 | −0.01em |
| display-sm | "The Secret Society Resort ⌄" (6.5.7) / "Events at Peabeach" (6.5.5, 500) | 48–49 | 25 | 600 / 500 | 1.2 | 0 |
| title | "To Review" (6.5.8); swipe-card name (6.5.6, 600) | 37–38 | 19 | 500 / 600 | 1.2 | 0 |
| h2 | "Your Tasks" (6.5.5) | 36 | 18 | 500 | 1.2 | 0 |
| list-title | "Romain Fourel" (6.5.8); "Peabeach" (6.5.7, 600) | 33 | 17 | 500 / 600 | 1.25 | 0 |
| count | "45 Events found" (gradient) | 32 | 16 | 500 | 1.2 | 0 |
| card-title | "Hot Yoga Class"; "Hi, Omar" pill; toggle labels (500) | 29 | 15 | 600 | 1.3 | 0 |
| section-link | "See All ↗" | 27 | 14 | 500 | 1.2 | 0 |
| body | "Brand : The Secret Society Resort", tile labels (2-line pitch 44 px = 17) | 24–25 | 13 | 500 | 1.3 | 0 |
| button | "Decline", "Accept" | 24.5–25 | 13 | 600 | 1.2 | 0 |
| chip | "Filters", "Sort by", "Location", "Date", "Category" (caps 24–25 px ⇒ 12.3–13.0; text runs 6.5.3/6.5.4 Filters 34.1, Sort by 41.7, Location 48.6, Date 26.4, Category 54.0 CSS — PJS is 12–18 % wider at equal cap height, so 12 is the compromise; round 2) | 24–25 | 12 | 600 | 1.2 | 0 |
| meta | "25 May 2023 • 8:00 AM • 2 Hrs", "Influencer", "Last updated", "3 / 400" | 24 | 12 | 400 | 1.3 | 0 |
| link | "Add Review" (gradient text + 1 px gradient underline, offset 6) | 24.5 | 12 | 500 | 1.2 | 0 |
| meta-sm | "Check in 10:21 PM out 11:24 PM"; rating labels (digits 700) | 21 | 11 | 400 | 1.3 | 0 |
| badge | "24", "2", "30" (6.5.8 "24" digits 11.9×8.0 CSS at 50 %, 6.5.3 "2" cap 7.7 ⇒ 10.3–10.7px — kept at 11 in round 2; only the disc sizes / padding changed) | 20–21 | 11 | 600 | 1 | 0 |
| tab-label | "Explore / My Events / Profile" (est.) | ≈22 | 11 | 500 | 1.2 | 0 |
| stat-label | "Requests", "To confirm" (6.5.4 'T' caps 20–21 px, word boxes To confirm 131×21, To review 117×21, To visit 78×21, Requests 108×25; PJS 500 at 10.5 renders 134×21 / 120×20 / 86×20 / 120×25 — 10 was a cap short, 11 is 8–15 % too wide; round 3) | 20–21 | 10.5 | 500 | 1.2 | 0 |
| label-upper | "ESTABLISHMENTS" (6.5.7, 2-up) | 20 | 10 | 600 | 1 | +0.02em, uppercase |
| label-upper-3up | "CHECKED IN", "CHECKED OUT", "NO SHOW" (6.5.8 3-up control only: word boxes 172×21 / 203×22 px vs PJS 600 at 10.5 168×21 / 202×21, at 10 160×20 / 192×20; `--fs-label-upper-3up` on `.seg.is-3up`; round 3) | 21–22 | 10.5 | 600 | 1 | +0.02em, uppercase |
| tag-upper | "UNDER REVIEW", "OPEN FOR SWIPE" (status tags; 'N'/'D' 18.3 px, 'P' 17.8–18.2; 50 %-threshold word boxes 6.5.7 UNDER REVIEW 73.2×6.9 CSS, 6.5.5 OPEN FOR SWIPE 81.2×6.9, 6.5.6 solid 81.2×6.9 — at 9 the tile rendered 3–7 % narrower and 3–5 % shorter, at 10 the labels overshoot ⇒ 9.5; round 2) | 17.8–18.3 | 9.5 | 600 | 1 | +0.02em, uppercase |
| tag-chip-upper | "BAR", "BEACH CAFE", "RESTAURANT" (outlined tag chips; 6.5.7 text ink BAR 41×16 px, BEACH CAFE 134×17, cap 6.1 CSS ⇒ 8.2; the ring-to-ring chip widths re-measure at mid-height as 110 / 203 px = 42.1 / 77.7 CSS, not the 37.5 / 73.1 that drove round 2's 7.5 — PJS 600 at 8 with pad 12 renders 112 / 202 px rings and 41×16 / 133×16 text; round 3) | 16–17 | 8 | 600 | 1 | +0.02em, uppercase |
| caption-upper | "20 MINS LEFT" (6.5.5 word box 64.0×7.3 CSS; round 2) | 17–19 | 9.5 | 700 | 1 | +0.04em, uppercase |
| stat-number / date-digit | "82", "28" (baseline→label 54 px = 21) | 41 | 21 | 600 | 1 | 0 |
| date-month / date-day | "May" / "Thu" (baselines 63 / 52 px apart) | 29 / 24 | 15 / 12 | 500 / 400 | 1.2 | 0 |
| big-stat (est.) | "28K" (6.5.1-1) | — | 36 | 600 | 1 | 0 |
| hero-headline (est.) | "unveiling / influencers / extravaganza" (6.5.1) | — | 30 | 600 | 1.15 | −0.01em |
| status-bar | "9:41" | 31 (digit) | 17 | 600 | 1 | system font |

Measured baseline pitches (CSS px): card title→meta 22.6; name→role 21.8; role→check-in 24.1; venue
caption→title 33.7; task tag→title 34.9, title→meta 21.8, meta→"20 MINS LEFT" 26.

Where the logo would sit, render "The Secret Society" as plain text in `--type-display-sm` — not
Syne, not a wordmark.

## 7. Spacing

Scale `4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 56` (`--space-1…14`). Semantic tokens and evidence:

| Token | CSS | Measured |
|---|---|---|
| `--gutter` / `--content-w` | 24 / 342 | 63–66 px on Explore, Dashboard, Establishments (My Events pasted 6 px left, To Review 15 pt left inset — normalised) |
| `--space-card-pad` | 16 | thumb→card edge 43–44 px on every card |
| `--space-thumb-text-gap` | 16 | 45–48 px |
| `--space-list-gap` | 16 | 36 / 45 / 44 px (My Events / To Review / Establishments) |
| `--space-grid-gap` | 20 | 54–55 px (dashboard 3×2) |
| `--space-tile-gap` | 15 | 38–39 px (stat tiles, date pills) |
| `--space-carousel-peek` | 12 | 33 px |
| `--space-button-gap` / `-wide` | 8 / 12 | 22 px (Decline/Accept) / 34 px (More Details/Managers) |
| `--space-chip-gap` | 7 | 6.5.4 y = 1480: Location→Date 17 px, Date→Category 18 px = 6.5–6.9 CSS (round 2; the earlier 16 / 23 / 22 px mixed ring-to-ring and ink-to-ink runs) |
| `--gutter-review-left` | 15 | 6.5.8 rows and 3-up segmented span x 147–1071 = 354 CSS on the 393 pt screen (15 left / 24 right) — To Review only (`.section.is-review`); every other screen keeps 24 / 342 (6.5.7 venue card 342.8) |
| `--space-header-icon-gap` | 12 | 32 px |
| `--space-title-to-content` | 24 | 69 px ("Your Tasks" → card) |
| `--space-section` | 32 | 80–85 px (tiles→divider, chips→date pills, seg→card) |
| `--space-block` | 24 | 66–67 px (chips→toggle bar, toggle bar→card, "45 Events"→card) |
| `--space-title-meta-gap` | 8 | 26 px |
| `--space-row-to-buttons` | 17 | 46 px — 6.5.4 card 1: meta glyph bottom y 1992 → Accept top y 2038 (the earlier "12 / 30 px" measured from the meta line box on a card pasted at a different offset; fix pass round 1) |
| `--space-swipe-stack-top` / `--space-swipe-card-to-counter` | 36 / 56 | 96 / 152 px |

Vertical anchors (pt from screen top, 14 Pro; subtract 7 for the 844 frame): My Events header
75–126, tiles 147–232, divider 263, chips 278–318, toggle bar 344–406, card 1 432–570, card 2 584.
Explore: search 55–105, title 139–204, chips 236–278, date pills 310–412, panel bottom 465,
calendar pill 444–480, "45 Events" 508–520, card 546. Dashboard: pill 63–117, last-updated
143–155, "Your Tasks" 189–202, task card 229–433, venue row 465–524, tiles 545–644 / 666+.
Establishments: sort 57–107, title 129–153, seg 174–230, card 1 262–524. To Review: back 59–111,
seg 140–198, row 1 216–318, row 2 335. Swipe: back 57–108, card 205–633, counter 691–700,
button centres 756.

## 8. Radii

| Token | CSS | Fitted radius (image px) | Elements |
|---|---|---|---|
| `--radius-xs` | 7 | 17–19 | dashboard icon squares |
| `--radius-sm` / `--radius-button` | 12 | 32–34 | Accept, Decline, Start Swiping, More Details, Show Event List |
| `--radius-segment` | 13 | 30–35 (50 %-coverage edge; 6.5.7 ESTABLISHMENTS 30.0–31.9, 6.5.8 CHECKED OUT 32.5–34.2) | selected segment pill |
| `--radius-md` / `--radius-tile` / `--radius-segmented` / `--radius-toggle-bar` | 17 (round 3; was 18) | 43.4–45.3 (6.5.4 stat tiles 44.1–44.4, toggle bar 43.4–43.7, 6.5.8 3-up segmented container 44.8 — the same corner-inset code reads a rendered r16 as 42.2 px, r17 as 43.3, r18 as 46.6 at 2.611 px/CSS, so the fitted radius is 17.0–17.4) | My Events stat tiles, toggle bar, segmented container |
| `--radius-date-pill` | 20 | 53 | date pills |
| `--radius-lg` / `--radius-tile-dashboard` | 22 | 56 | dashboard 100 px tiles, Create tile |
| `--radius-xl` / `--radius-card` | 30 | 79–86 (task card 81.6, invite 85.6/86.6, To Review row 68) | invite, To Review, venue, task, event cards |
| `--radius-tabbar-top` | 40 | ≈104 (insets from the screen edge at 2.3/3.8/5.4/6.9/8.4 CSS below the straight edge: 28/23/20/17/15 CSS on 6.5.4; 6.5.7 agrees within 1–2 CSS) | tab bar top-left / top-right corners (`border-radius: 40px 40px 0 0`) |
| `--radius-panel-bottom` | 44 | ≈117 | Explore date-strip panel bottom corners |
| `--radius-pill` | 999 | — | chips, tags, badges, name pill, toggle track, calendar pill, thumbs, avatars, icon buttons, FAB |
| `--radius-swipe-card` (est.) | 30 | — | swipe profile cards |
| `--radius-filter-panel` / `--radius-filter-tile` (est.) | 24 / 20 | tilted shot | Explore-home filter band |
| `--radius-sheet` (est.) | 30 (= `--radius-card`) | unseen — every measured card fits r30–31 (6.5.8 row 31.1, 6.5.5 task card 30.8, 6.5.7 venue card 31.6), so the sheet joins the card system rather than sitting tighter at 28 (round 2, convention) | bottom sheets |
| `--radius-field` (est.) | 16 | unseen | form fields |

## 9. Elevation

* Cards, tiles, chips, buttons, segmented controls, badges, heart button: **flat** (surface meets
  #010101 with a clean 1–2 px anti-alias, no border, no shadow).
* `--shadow-fab: 0 12px 28px rgba(190,80,230,.35)` — pixels under the FAB #37284c on #18151e, still
  #2a2335 35 px below, tint visible ≥ 90 px below and ≥ 25 px to the side (6.5.7).
* `--shadow-swipe-check: 0 0 40px 8px rgba(110,66,218,.45)` — halo #2c1948 extends ≈ 49 px past the
  ✓ button (6.5.6); the X button has only a faint 4 px halo (`--shadow-swipe-x`).
* `--glow-tab` — radial violet behind the active tab icon, 104 px box, peak ≈ #33227e, unclipped so
  it tints 20–25 pt of content above the bar.
* Hero photos end in `--scrim-hero-bottom`; the Explore date strip sits on
  `--gradient-surface-section` with `--radius-panel-bottom` corners.

## 10. Iconography

**Set: Lucide** (ISC) — 24×24 grid, round caps and joins, `fill="none"`, `stroke="currentColor"`.
Rendered at `stroke-width` **1.6** (measured glyph strokes 4.0–5.2 px = 1.53–1.98 CSS px; Lucide's
default 2 is too heavy, Feather heavier still, Heroicons too geometric, Phosphor's chevrons/sort differ,
Tabler's sort arrow is on the wrong side). Shape matches: `arrow-down-wide-narrow` = the sort glyph,
`server` = the layout toggle, `bell` has the flared lip + clapper, `search` big circle / short
handle, `map-pin` with inner dot, `calendar` with hanging pins.

**Strokes are CSS pixels, not viewBox units.** The reference keeps one stroke weight from the ⌀50
header buttons down to the 16 px map-pin (search 1.53–1.60, bell 1.73–1.76, back arrow 1.57–1.64,
refresh 1.59, heart 1.70, pin 1.98 CSS), whereas a viewBox stroke shrinks with the box (1.5 units on
a 16 box = 1.0 CSS). Every sprite path therefore carries `vector-effect="non-scaling-stroke"` (or the
stylesheet sets `.icon * { vector-effect: var(--icon-vector-effect) }`), and the stroke ladder is read
as CSS px: `--icon-stroke` 1.6 default · `--icon-stroke-bold` 1.75 (heart, bell) · `--icon-stroke-heavy`
2 (FAB plus, measured 2.1–2.4; map-pin 1.98) · `--icon-stroke-back` 1.6 (the back arrow is **not**
heavy — 2 units at its 28 box rendered 2.33 CSS, 45 % over the measured 1.6) · `--icon-stroke-badge`
2.5 (check inside the ⌀16 badge, measured ≈2.35; under viewBox scaling it used to render 1.46).

Two custom glyphs in Lucide grammar (source in
`scratchpad/measure/components/sheet.html`):

* `sliders` (Filters; redrawn in round 3 to the 6.5.3 glyph — three rows 13.5 / 13 px apart with a ring knob
  left / right / left (ring outer ⌀ 11–12 px = 4.5 CSS, hollow), 19 / 19 / 18 px lines 1.5 CSS thick, a 3–4 px gap
  between knob and line, whole glyph 34×38 px = 13.0×14.6 CSS): rings r 2.1 at (6, 4.8) / (18, 12) / (6, 19.2),
  lines 8 / 8 / 7.4 units, rows 7.2 apart — at the 17 box the ink is 13.0×14.8 CSS —
  `<circle cx="6" cy="4.8" r="2.1"/><path d="M12 4.8h8"/><path d="M4 12h8"/><circle cx="18" cy="12" r="2.1"/><circle cx="6" cy="19.2" r="2.1"/><path d="M12.6 19.2h7.4"/>`
* `zap-square` (Explore tab): `<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M12.5 7.5 9.5 12.5h4l-2 4"/>`

Sizes are SVG boxes (Lucide glyphs fill ≈ 20/24 of the box):

| Token | Box | Visible glyph | Use |
|---|---|---|---|
| `--icon-size` | 26 | ≈ 21 (search spans 18/24 ⇒ 19.5 + 1.6 stroke = 21.1; measured 20.3) | inside ⌀50 circular buttons (search, sort, menu), header pill chevron |
| `--icon-size-bell` | 22 (round 3; was the 26 box) | 17.8×20.1 (Lucide `bell` spans 17.5×20/24 ⇒ 16.0×18.3 + 1.75; measured 17.6×20.3 on 6.5.5, 18.0×20.7 on 6.5.4 — at 26 it drew 20.7×23.4) | bell inside the ⌀50 button (`.icon-btn .icon-bell`) |
| `--icon-size-avatar-glyph` | 27 (round 3; was 20 / 22) | 22.5×20.3 briefcase, 18×20.3 user-round (filled, no stroke; 6.5.5 briefcase 22.6×20.7 CSS = 57 % of the ⌀38.3 disc) | filled silhouette in the "Hi, name" pill's ⌀40 avatar disc (`.header-pill-avatar .icon`) |
| `--icon-size-layout-toggle` | 15 (round 3; was 17) | 14.1 (`server` spans 20/24 ⇒ 12.5 + 1.6; measured 13.8 square on 6.5.3 — the 17 box drew 15.8) | layout-toggle button on Explore — a 55×42 stadium (`--size-layout-toggle-w/h`, `.icon-btn.is-pill`), not a ⌀50 circle |
| `--icon-size-back` | 28 | ≈ 16 (measured 16.5) | back arrow, stroke `--icon-stroke-back` 1.6 |
| `--icon-size-chip` | 17 (round 3; was 20) | sort 14.4×12.9 (spans 18×16/24; measured 13.8×12.6), sliders 13.0×14.8 (custom glyph; measured 13.0×14.6) | chip leading icon (sliders, sort) |
| `--icon-size-inline` | 16 | ≈ 13 (pin 11.9×14.2) | map-pin before text, stroke 2 (wall 1.98) |
| `--icon-size-refresh` | 12 | ≈ 9.5 (measured 9.2×9.6) | refresh-cw before "Last updated" |
| `--icon-size-tile-arrow` | 18 (round 3; was 22) | 9.25 (`arrow-up-right` spans 10/24 ⇒ 7.5 + 1.75; measured 8.8×9.2 — the 22 box drew 10.9, its "glyph ≈9" note had counted the path without the stroke) | ↗ on dashboard tiles, stroke 1.75, colour `--color-text-meta`, box at `--dash-tile-arrow-top` 14 / `--dash-tile-arrow-right` 10 ⇒ ink 18.4 / 14.4 from the tile edges (6.5.5: 18.8 / 14.2) |
| `--icon-size-arrow` | 19 (round 3; was a hard-coded 14) | 9.5 (7.9 + 1.6; measured 9.6×9.2 = 0.85 × the "S" cap) | ↗ after "See All" (`.section-link .icon`), gap `--space-2` so the ink sits ≈12.5 from the text (measured 12.3) |
| `--icon-size-tab` | 26 (est.) | ≈ 22 | tab bar, stroke 1.5; active = same silhouette filled `--color-accent-tab` |
| `--icon-size-heart` | 17 | ≈ 16×14 ink (6.5.3 disc (890,2178)–(1014,2306) = ⌀47.9; dark bbox (934,2225)–(972,2262) = 39×38 px = 14.9×14.6 CSS, 31 % of the disc; Lucide's heart spans 20×17.3/24 so the earlier 22 box drew 18×16 of path plus stroke) | Explore heart, stroke 1.75 (measured 1.70), #000 |
| `--icon-size-fab` | 24 | 14 | FAB plus, stroke 2 |
| `--icon-size-swipe-x` / `-check` | 24 / 28 | — | X / ✓ buttons, stroke 1.75–2 |
| `--icon-size-check-badge` | 14 | 9 | check inside the ⌀16 badge, stroke 2.5 CSS px (non-scaling) |
| `--icon-size-filter-tile` | 24 | — | calendar / map-pin / star in the filter band |

Name map: search · bell · chevron-down · arrow-left · menu · pencil · sliders (custom) ·
arrow-down-wide-narrow · server · calendar · map-pin · star · heart · zap-square (custom) ·
calendar-check · user-round · briefcase · users · arrow-up-right · refresh-cw · check · x · plus ·
qr-code · ticket · clock · camera · log-out · layout-grid · inbox. Ship one inline
`<svg><symbol id="…">` sprite (or inject it from `js/icons.js`) with `vector-effect="non-scaling-stroke"`
on every path/circle/rect, and reference with `<use href="#name">`.

## 11. Component specs (condensed)

All sizes in CSS px in the 390×844 frame; tokens in `css/tokens.css`.

* **Circular icon button** — ⌀50, 2 px ring `--color-border`, transparent fill, 26 px Lucide glyph
  white (`--icon-size`, the bell at `--icon-size-bell` 22 and the pill's filled silhouette at `--icon-size-avatar-glyph`
  27 — round 3; the Explore layout toggle is the 55×42 stadium variant `.icon-btn.is-pill` with
  `server` at 17 px, its height bound to `--size-chip-h` so it always matches the chips beside it, plus a
  44 px `::before` hit area); notification badge ⌀17 disc (`--size-icon-button-badge`; action gradient,
  11/600 white, 3 px side padding `--badge-sm-pad-x` so "30" is ≈19×17 — 6.5.3 "2" 16.9, 6.5.1 "30" ≈15×15
  foreshortened) at top-right. Over photos the ring
  is the same white .10 (6.5.3 #3f414a → #52525a). Pressed: fill white .10.
* **"Hi, name" pill** — h54, full pill, 2 px ring `--color-border-strong`, transparent fill; ⌀40
  avatar circle `--color-avatar-circle` inset 7 with a `--color-avatar-glyph` user/briefcase glyph drawn as a
  **filled silhouette** (`fill: currentColor; stroke: none` — 6.5.5 (220,910) and 6.5.1-1 show solid shapes,
  not outlines; same treatment as the active tab icon);
  12 gap; "Hi, Omar" `--type-greeting`; optional chevron-down; 18 right padding.
* **Large-title header** — `--type-display-xl` at the gutter, ⌀50 bell right-aligned; row top 68.
* **Back header** — ⌀50 back button (arrow-left 28 box, stroke `--icon-stroke-back` 1.6) at the gutter, `--type-title`
  12 to the right, optional h20 count badge (action gradient, 11/600, pad-x 4 ⇒ "24" ≈20×20, a near-circle —
  6.5.8 bbox 21.4×19.2 with digits 11.9×8.0) 8 after the title.
* **Hero header** — full-bleed abstract art 260–276 tall with `--scrim-hero-bottom`; ⌀50 button
  top-right inset 20; `--type-display` white bottom-aligned into the scrim, proper noun in
  `--gradient-text` + chevron-down. The word itself only runs pink → magenta (6.5.3 "Dubai" x 560–800:
  #e57ca2 → #e661c3 → #e655d2 → #df4cd8 → #d34ae3, ≈0–65 % of the brand gradient; the chevron after it
  continues #e065b6 → #b743dc), so `.hero-title .accent-text` / `.t-hero .accent-text` / `.accent-text.is-hero`
  draw the gradient at `background-size: var(--gradient-text-hero-span) 100%` (160 %) from the left.
  "45 Events found" and "Add Review" do span the full gradient and stay on the default.
* **Primary button** — h42 r12, `--gradient-action`, `--type-button` white, pad-x 22; Accept w108,
  Start Swiping w145. **Secondary** — same box, `--color-surface-elevated`, white label; pressed
  `--color-surface-pressed`. **Disabled** — `--color-surface-disabled`, `--color-text-disabled`.
  Two-up rows: gap 8 (Decline | Accept) or 12 (More Details | Managers); the invite-card row is
  left-aligned to the text column and ends 40 before the card's right edge.
* **Gradient text link** — `--type-link`, `--gradient-text` clipped to text, 1 px gradient underline
  6 below.
* **Section link** — "See All" `--type-section-link` `--color-text-secondary` + the 14 px `arrow-up-right`
  SVG (never a text "↗" — U+2197 is not in the PJS Latin subset and falls back to the system font); the
  arrow takes `--color-text-secondary-hex` so its overlapping corner does not compound.
* **Filter chip** — h42 pill (6.5.3 ring y 1319–1428 = 42.1 CSS, same rows as the layout toggle; My Events
  chips on 6.5.4 are 40.2 — within a row chips and toggle always match, so the Explore value is the token),
  1 px `--color-border-strong`, transparent, pad-x 18 (6.5.4 ring→text 47 px = 18.0 both sides), `--type-chip`
  (12/600) white; leading 17 px icon (`--icon-size-chip`, round 3) + 7 gap; trailing ⌀17 count badge (`--size-chip-badge`; 6.5.3 "2" 16.9).
  Layout-toggle: 55 × `--size-chip-h` pill (`--size-layout-toggle-w/h`, `.icon-btn.is-pill`; 6.5.3 ring x
  928–1070 = 144 px, y 1319–1428 = 111 px, rows ±43 px from centre 100–104 px wide ⇒ stadium) with `server`
  at `--icon-size-layout-toggle` 15, sharing the chips' top edge and height. Row scrolls horizontally from the
  gutter, gap 7 (`--space-chip-gap`; 6.5.4 17–18 px), unclipped right. Reference chip widths (ring to ring):
  Filters+badge 116.4, Sort by 102.6, Location 85.0, Date 62.4, Category 88.8 CSS; PJS renders the same
  labels 12–18 % wider at equal cap height, so the tile lands 3–8 px wide on these — a font-metric residual,
  not a geometry error (see §16).
* **Tag chip** (BAR, BEACH CAFE) — h23 pill, 1 px `--color-tag-chip-outline`, pad-x 12 (round 3: 6.5.7 ring-to-ring
  at mid-height BAR x 389–498 = 110 px = 42.1 CSS, BEACH CAFE 510–712 = 203 px = 77.7; the round-2 "ring 395 → text
  423 = 10.7" was read where the pill's arc had already curved in), `--type-tag-chip-upper` (8/600) white, gap 8;
  PJS renders the chips 112 / 202 px (42.9 / 77.4 CSS) with text ink 41×16 / 133×16 vs the reference 41×16 / 134×17.
* **Status tag** — h23 pill, pad-x 10, `--type-tag-upper` (9.5/600); teal `--color-tag-teal-bg`/`-text`,
  red `--color-tag-red-bg`/`-text`; solid header variant `--color-tag-teal-solid-bg` + white.
* **Count badge / dot** — h20 near-circle (min-width 20, pad-x 4 `--count-badge-pad-x`) or ⌀8 dot,
  `--gradient-badge`; dot sits on the tile's 45° corner point (−4,+4 from the bounding corner).
* **Segmented control** — h56 r17 `--color-surface` (round 3 fit, §17), padding 6 / 4 with a 4 px margin on each segment so
  the selected pill is inset 8 from the container's sides and ≈8 narrower than its segment (6.5.7 pill
  157–159 CSS in the 342 container, left inset 7.3, right edge 5.4 short of the midline; 6.5.8 3-up pill ≈4
  inside each third); equal segments; labels `--type-label-upper` `--color-text-segment-inactive`; selected
  h44 r13 `--gradient-brand`, white. 2- and 3-segment variants; the 3-up To Review control carries `.is-3up`, whose
  labels are `--fs-label-upper-3up` 10.5 (6.5.8 CHECKED IN / OUT boxes 172×21 / 203×22 px vs the 2-up control's 20 px caps).
* **Toggle bar** — h64 r17 `--color-surface` (round 3 fit), centred: active label `--type-toggle-label` white ·
  16 · switch 51×31 (`--gradient-toggle-track`, ⌀23 white knob inset 4) · 16 · inactive label
  `--color-text-muted`.
* **Date pill strip** — pills 70×102 r20 `--color-surface`, gap 15; digit `--type-date-digit`,
  month `--type-date-month` 8 below the digit, weekday `--type-date-day` `--color-text-muted` 4 below the
  month; the centred stack carries `padding-top: var(--date-pill-stack-bias)` 4 so it sits 2 below centre
  (6.5.3 pill 1 cap tops 23.0 / 52.1 / 73.9; rendered 23.6 / 53.1 / 73.3); selected
  `--gradient-action-tall`, weekday white .43. Strip sits on `--gradient-surface-section` ending 53
  below the pills with r44 bottom corners; "Show full Calendar" h36 w147 `--color-surface-elevated`
  straddles that edge with its centre 5 above it (`--calendar-pill-lift`; 6.5.3 pill (429,1861)–(814,1954)
  vs the panel edge y 1920 ⇒ 23 CSS above / 13 below); it is a full stadium (fitted corner 18.6 ≈ h/2), and so
  is the generic `.btn-sm` (r `--radius-pill`, pad-x 16); "45 Events found" `--type-count` gradient text 32 below.
* **My Events stat tiles** — 72×84 r17 (round 3 fit), 4-up gap 15; count `--type-stat-number` and label
  `--type-stat-label` (10.5/500, round 3), **both white** (`--color-text-primary` — 6.5.4 "To confirm" / "To review" / "To vist"
  glyph cores #f6f6f6 / #f5f4f5 / #f1f1f2, identical to the digits; the .70 grey belongs only to
  "Influencer"), 14 apart (`--space-stat-gap`; cap tops 21.1 / 55.5); first tile `--gradient-brand`;
  ⌀8 dot top-right. 1 px divider 32 below.
* **"Last updated" line** — `refresh-cw` at `--icon-size-refresh` 12 (glyph ≈9.5, stroke
  `--color-text-secondary-hex` #999999 — opaque, so the two arrowhead sub-paths cannot compound to a bright
  spot; 6.5.5 glyph is a flat #969696) + 6 gap + `--type-meta` `--color-text-secondary`.
* **Dashboard tiles** — 100×100 r22 `--color-surface`, padding 14; 26 px r7 status-coloured square
  (count 12/600 white) top-left, 9 px ↗ `--color-text-meta` top-right (18 box `--icon-size-tile-arrow` at
  `--dash-tile-arrow-top` 14 / `--dash-tile-arrow-right` 10 ⇒ ink 18.4 from the top, 14.4 from the right; 6.5.5 tile 1
  glyph (373,2174)–(395,2197) = 8.8×9.2 CSS at 18.8 / 14.2), `--type-body` label two lines bottom-left; 3×2, gap 20. **Create tile** — 1 px `--gradient-brand` border
  (`background: linear-gradient(#010101,#010101) padding-box, var(--gradient-brand) border-box`),
  square `--gradient-accent-deep` (70deg, light corner bottom-left like every action-gradient element) with a plus.
* **Invite card** — 342×138 r30, padding 16 all round; ⌀50 thumb at the padding; `--type-card-title` 5
  below the padding (`--space-invite-title-top`); `--type-meta` `--color-text-meta` with " • " separators
  6 below (`--space-invite-title-meta`); 17 to the button row (`--space-row-to-buttons`). 6.5.4 card 1
  (164,1830)–(1067,2191): thumb 17.2–67.8, title cap 25.7, meta cap 50.2, buttons 79.3–121.8, bottom inset
  16.5 ⇒ 16 + 5 + 19.5 + 6 + 15.6 + 17 + 42 + 16 = 137 inside the 138 min-height.
* **Task card** (carousel) — 314×204 r30 (fixed height), padding 16, peek 12; ⌀50 thumb; teal tag → title
  11 (`--space-task-tag-title`) → meta 5 (`--space-task-title-meta`) → "20 MINS LEFT" `--type-caption-upper`
  15 (`--space-task-meta-caption`) → button 32. 6.5.5 card (174,1300)–(993,1832): tag 16.5–39.9, title cap
  54.8, meta cap 78.5, caption cap 106.5, button 146.3–188.3 ⇒ 16 + 23 + 11 + 19.5 + 5 + 15.6 + 15 + 9 + 32 + 42
  + 16 = 204.
* **Venue row** — ⌀58 thumb; `--type-meta` `--color-text-tertiary` caption; `--type-display-sm-light`.
* **Venue card** — 342×262 r30, padding 16; ⌀50 thumb; `--type-list-title-strong`; red tag top-right;
  "Brand : value" (`--color-text-meta` label, white value); tag chips 16 below; pin + address
  `--color-text-secondary` 20 below; two-up secondary h42 gap 12; full-width disabled 12 below.
* **To Review row** — 102 tall r30, padding 16, `width: 100%` of a column that on this screen alone has a
  15 left gutter (`.section.is-review`, `--gutter-review-left`; 6.5.8 rows and the 3-up segmented span
  x 147–1071 = 354 CSS on the 393 pt screen ⇒ 351 in the 390 frame; other screens stay 342 / 24); ⌀50 avatar
  **top-aligned** with the padding (6.5.8 row 1
  avatar rows 1311–1441 ⇒ top 17.2, bottom inset 34) with ⌀16 check badge at 4–5 o'clock (+18.5,
  +16.5 from centre); text column 3 below the padding (`--space-list-body-top`): name `--type-list-title`,
  role `--type-body` `--color-text-secondary-strong` 5 below (`--space-list-title-sub`), check-in
  `--type-meta-sm` `--color-text-tertiary` 9 below (`--space-list-sub-meta`) — cap tops 23.7 / 48.6 / 74.3
  (rendered 23.25 / 48.5 / 73.9); gradient link right, inset 20, 8 below the padding
  (`--space-list-action-top`) so its baseline sits on the name's (link cap top 26.0, underline 41.7–42.9).
* **Event image card** — 342 wide r30, art 256 tall (4:3 assumed) with ⌀48 white heart inset 20.
* **Swipe stack** — card 320×428 r30, art fills, 80 px name panel (`--type-title-strong`, ratings
  `--type-rating-digits` + `--type-meta-sm` muted); two back cards peek 10 each, rotated ±2–3°;
  counter `--type-meta` muted 56 below; ⌀62 X (`--gradient-brand`) and ⌀88 ✓ (`--gradient-action`,
  `--shadow-swipe-check`), centres 124 apart, centred, ≈96 above the frame bottom.
* **Explore-home filter band** — panel r24 `--gradient-filter-panel` (the opaque action gradient — 6.5.1
  panel pixels #6f42db … #4a38d8 sit exactly on #8c4bde→#3332d6), padding 12; three tiles
  108×96 r20 `--color-filter-tile` (white .06; reference tiles = panel + ≈.07), gap 16, 24 px glyph top-left,
  `--type-body` label bottom-left.
* **Tab bar** — h104 (70 content + 34 home area) `--color-bg-tabbar`, top corners r40
  (`--radius-tabbar-top`; `border-radius: 40px 40px 0 0`, the canvas shows through outside the arc),
  no top border; 3 items; icon
  26 + label `--type-tab-label` 6 below; inactive `--color-text-tab-inactive`; active icon filled
  `--color-accent-tab`, label `--color-text-tab-active` (pure white), `--glow-tab` 104 px behind the icon —
  `.tab` is `isolation: isolate` and the glow pseudo-element sits at z -1, so it paints under the label
  instead of tinting it lavender; ⌀8
  notification dot at the My Events icon's top-right; home indicator 134×5 r3 white 8 from the bottom.
  Blogger: Explore (zap-square) · My Events (calendar-check) · Profile (user-round).

## 12. Boundaries applied

* **No logo / wordmark / app icon.** Where the logo would sit, "The Secret Society" is plain text in
  `--type-display-sm` (Plus Jakarta Sans 600).
* **No photography, no traced screenshots.** Every image area is CSS: base `--color-surface`,
  2–3 layered `radial-gradient`s, an optional art-deco line pattern at 6 % white
  (`repeating-linear-gradient(135deg, transparent 0 14px, rgba(255,255,255,.06) 14px 15px)`), a
  top-left highlight `linear-gradient(160deg, rgba(255,255,255,.08), transparent 40%)`, and
  `--scrim-hero-bottom` wherever text sits on it. Saturation high, luminance low.
  * Dining — `radial-gradient(120% 90% at 20% 20%, #d1662f, transparent 55%), radial-gradient(90% 80% at 85% 80%, #6b1f3a, transparent 60%), linear-gradient(135deg, #2a0f1a, #0d0812)` + a blurred warm ellipse.
  * Nightlife — `radial-gradient(70% 60% at 30% 70%, #b445f4, transparent 60%), radial-gradient(60% 60% at 80% 20%, #3a34d6, transparent 55%), radial-gradient(40% 40% at 60% 60%, #f5909e, transparent 60%), #0a0616` + two thin blurred light beams.
  * Beach & pool — `radial-gradient(100% 70% at 50% 100%, #1fa6a0, #0e5f6b 40%, transparent 75%), linear-gradient(180deg, #f29a6b, #c85a6d 30%, #1b2a4d 62%, #0b1730)` + a 12 px horizon glare band.
  * Wellness — `radial-gradient(80% 70% at 70% 30%, #4fb39a, transparent 60%), radial-gradient(90% 70% at 20% 90%, #2d4a5e, transparent 65%), #0d1a1c` + three 1 px concentric rings.
  * Beauty — `radial-gradient(70% 70% at 25% 30%, #f5909e, transparent 60%), radial-gradient(70% 60% at 80% 75%, #b445f4, transparent 60%), linear-gradient(180deg, #2a1420, #120a16)` + a pearlescent sheen.
  * Fitness — `radial-gradient(60% 60% at 80% 20%, #f25e5d, transparent 55%), radial-gradient(80% 60% at 10% 90%, #3a34d6, transparent 60%), #0c0a14` + steep 115deg stripes.
  * Rooftop — `linear-gradient(180deg, #3b2a8a, #7a4cf8 35%, #f5909e 70%, #2a1130)` + 6–8 black rects as a skyline silhouette.
  * Café — `radial-gradient(80% 80% at 30% 70%, #c98a5a, transparent 60%), radial-gradient(60% 60% at 80% 20%, #f5b0a0, transparent 55%), #1a0f10`.
  * Avatars/thumbs use the same recipes at 50–58 px; swipe/profile cards add a large blurred dark
    ellipse in the lower half so they read as portraits without depicting anyone.
* **One icon set** (Lucide + two glyphs drawn in its grammar); no glyphs lifted from the app.
* **Status bar** stays in the system font; everything else Plus Jakarta Sans.

## 13. Known unknowns

Screens and states no public reference shows — the tokens marked (est.) cover them with
system-consistent guesses:

* Welcome / role choice, log in, sign up, OTP — field height 56, r16, border white .08, focus
  `--color-accent`; OTP boxes 48×56 r14.
* Event / offer detail (the bottom of the Explore event card is cut off in every shot — image
  aspect 4:3 assumed; title/meta/venue block below it inferred from the invite-card pattern).
* Apply / book bottom sheet — r30 top (= `--radius-card`; est., every measured card is r30–31), 36×5
  grabber #3a3742 (est., iOS convention), padding 24, scrim black .60, full-width h48 r14 CTA.
* Invite detail, "message from venue" quote card, check-in / QR screen, notifications list, search
  results, filter and sort sheets, calendar (full) view.
* Profile "Profile Health" tab, 28K stat card lower half, linked-account row.
* **Manager tab bar** — never shown; assumed 4 items (Dashboard · Applications · Venues · Profile)
  in the same bar style. Manager Applications inbox, Venues list beyond Establishments, event
  creation / slot picker.
* Exact tab-bar height (105 pt inferred from the bar top on cropped shots; the bar itself is never
  fully visible), tab icon size (26 est.), filter-band radii and alphas (tilted shot), hero-top scrim
  (low confidence), secondary lavender text ±6/255, tab-inactive alpha .30–.40.
* Pressed / focused / loading / empty / error states, toasts, pull-to-refresh, keyboard layouts,
  light mode (none exists), Android, landscape.
* Motion — durations and easings are convention, not measurement.

## 14. Added by the style-tile pass (Gate 1)

No measured value above was changed. `css/tokens.css` gained three commented blocks so that
`css/base.css` and `css/components.css` contain no literal colours or sizes:

* **Phone chrome** (desktop only, outside the app UI): `--radius-phone` 44, `--phone-bezel-w` 10,
  `--color-phone-bezel` #1b1a20, `--color-phone-bezel-edge` white .08, `--shadow-phone`,
  Dynamic-Island pill `--size-island-w/h` 103×33 at `--island-top` 10 (`--color-island` #000; measured in
  round 2 on 6.5.3 / 6.5.7: black run x 487–754 = 268 px, y 727–812 = 86 px, 27 px below the screen top —
  the 125×37 @ 11 first written here was never measured),
  status-bar insets `--statusbar-pad-l` 31 / `--statusbar-pad-r` 16 (6.5.4: "9:41" left edge 82 px,
  battery right edge 41 px), `--color-statusbar` #fff, `--touch-target` 44 (HIG minimum, conv.),
  `--font-mono` (debug pages only).
* **Placement / scrim**: `--check-badge-dx` 18.5 / `--check-badge-dy` 16.5 (badge centre from the
  avatar centre, 6.5.8); `--scrim-card-bottom` (transparent → surface .85) for the media-card image,
  which meets the card body rather than the canvas.
* **Card imagery**: the §12 recipes as complete background stacks `--art-dining … --art-cafe`, plus
  the overlays `--art-highlight`, `--art-lines`, `--art-stripes`, `--art-skyline`, `--art-glare`,
  `--art-rings`, `--art-sheen`, `--art-beams`, `--art-portrait-shadow`. Applied by `.art .art-<name>`
  (+ `.art-lines`, `.art-portrait`) in components.css.

Component class names (components.css): `.btn` (`-primary` `-secondary` `-ghost` `-sm` `-lg`
`-block`, `:disabled`, `.w-accept` `.w-start`, `.btn-row`), `.icon-btn` (+ `.icon-btn-badge`),
`.heart-btn`, `.fab`, `.swipe-btn.is-x/.is-check`, `.link-gradient`, `.section-link`, `.chip`
(+ `.chip-badge`, `.is-active`), `.tag` / `.tag-teal` / `.tag-red` / `.tag-teal-solid`, `.badge`,
`.badge-dot`, `.seg > .seg-item.is-active`, `.toggle` (+ `.is-right` `.is-off`), `.toggle-bar`,
`.date-panel > .date-strip > .date-pill.is-selected`, `.calendar-pill`, `.stat-row > .stat-tile.gradient`,
`.dash-grid > .dash-tile` (+ `.dash-tile-icon.is-red/.is-teal/.is-green/.is-purple/.is-neutral/.is-accent`,
`.dash-tile-arrow`, `.is-create`), `.card`, `.invite-card`, `.task-card`, `.list-row` (+ `.avatar`,
`.check-badge`), `.media-card`, `.hero` (+ `.hero-scrim` `.hero-title` `.accent-text`), `.filter-panel`,
`.tabbar > .tab.is-active` (+ `.tab-icon` `.tab-dot`), `.sheet-backdrop` + `.sheet` (+ `.field`,
`.stepper`), `.header` / `.header-pill`, `.divider`. Icons: `<i data-icon="bell" data-size="26"
data-stroke="bold">` placeholders mounted by `js/icons.js`, or `tssIcon(name, size, stroke)`.

## 15. Fix pass round 1 (verified deviations)

Fourteen deviations between the style tile and the reference PNGs were re-measured and fixed. Two
existing token **values** changed (each re-checked on the PNG before the change):

| Token | Was | Now | Evidence |
|---|---|---|---|
| `--space-row-to-buttons` | 12 | **17** | 6.5.4 card 1: meta glyph bottom y 1992 → Accept top y 2038 = 46 px = 17.6 CSS; card total 16 + 5 + 19.5 + 6 + 15.6 + 17 + 42 + 16 = 137 ≤ 138 |
| `--icon-size-heart` | 22 (path 18.3×15.6) | **17** | 6.5.3 heart ink 39×38 px = 14.9×14.6 CSS inside the ⌀47.9 disc (31 %); Lucide `heart` spans 20×17.3 of 24 ⇒ ink ≈ 15.9×14.0 at 17 (a 19 box would draw ≈ 17.6×15.5 with the 1.75 stroke) |

New tokens (all additive, so `components.css` still carries no literal sizes): `--size-layout-toggle-w/h`
55×42 (6.5.3 ring x 928–1070, y 1319–1428; rows ±43 px from centre 100–104 px wide ⇒ stadium),
`--gradient-text-hero-span` 160 % (hero proper noun covers 0–62 % of `--gradient-text`),
`--space-stat-gap` 14, `--space-task-tag-title` 11 / `--space-task-title-meta` 5 / `--space-task-meta-caption`
15, `--space-invite-title-top` 5 / `--space-invite-title-meta` 6, `--space-list-body-top` 3 /
`--space-list-title-sub` 5 / `--space-list-sub-meta` 9 / `--space-list-action-top` 8, `--dash-tile-arrow-top` 12 /
`--dash-tile-arrow-right` 8, `--calendar-pill-lift` 5, `--date-pill-stack-bias` 4.

Rendered check (Playwright DOM probe, `scratchpad/measure/fixer/probe.mjs`, cap top = baseline − 0.75 em):
task card 204 tall, tag 16–39, title 54.75, meta 77.5, caption 106.3, button 146.1–188.1; invite card 138,
thumb 16–66, title 25.75, meta 49.5, buttons 79.1–121.1; To Review row 102, avatar 16–66, name 23.25, role
48.5, check-in 73.9, link 26.0; stat tile number 21.75 / label 56; date pill 23.6 / 53.1 / 73.3; calendar pill
23 above / 13 below the panel edge; ↗ glyph 18.4 from the top, 14.4 from the right; heart ink 15.7×13.7 in the
⌀48 disc; "Dubai" per-column #f3929a → #eb68c7 → #e351da → #d94ae7 (reference ends #d34ae3) while
"45 Events found" still ends #a33fe9. Fonts: Plus Jakarta Sans 400/500/600/700 loaded; no console errors.

Component changes (components.css): `.stat-tile-label` white (was the .70 role grey — 6.5.4 labels measure
#f1–#f8, same as the digits); `.hero-title .accent-text` / `.t-hero .accent-text` / `.accent-text.is-hero`
pink→magenta span; `.icon-btn.is-pill`; `.header-pill-avatar .icon` filled; `.task-card` fixed height 204 with
the measured rhythm; `.invite-card` padding 16 and title/meta offsets; `.list-row` top-aligned avatar with the
measured text-column offsets; `.date-pill-month` 8 below the digit; `.dash-tile-arrow` at 12 / 8;
`.calendar-pill` lifted 5; `.section-link` and `.calendar-pill` gain the 44 px `::before` hit area.
Style tile (debug/style): blogger tab bar is Explore · My Events (calendar-check + dot) · Profile — three
tabs as in 6.5.1-1 (the Search / ticket "Invites" tabs never existed); layout toggle uses `.is-pill`; hearts at
17; the type rows tag "Dubai" / "influencers" with `.is-hero`.

## 16. Fix pass round 2 (verified deviations)

Seventeen deviations were re-measured on the PNGs (`scratchpad/measure/fixer2/recheck.py`, `recheck2.py`)
before anything changed. Token **values** that changed:

| Token | Was | Now | Evidence |
|---|---|---|---|
| `--gradient-filter-panel` | action gradient at α .85 | **opaque** `linear-gradient(70deg, #8c4bde, #3332d6)` | 6.5.1 panel-only pixels (788,2100) #6f42db, (837,2142) #6f42da, (986,2113) #7152de, (1235,2065) #4a38d8 lie exactly on the opaque gradient; the tile rendered #673bbc → #332db7 (25–30/255 dark). `--color-filter-tile` .06 kept (tiles = panel + ≈.07) |
| `--color-text-tab-active` | white .90 | **#ffffff** | 6.5.1-1 active label brightest #fefefe; the lavender #d7d0e6 on the tile was white .90 seen *through* the glow pseudo-element, which painted above the in-flow label |
| `--gradient-accent-deep` | 90deg | **70deg** | 6.5.5 Create square rows y = 2482 #5f36ac → #2f29a7 vs y = 2524 #663aae → #372daa (bottom-left brighter) |
| `--type-tag-upper` / `--type-caption-upper` | 9 | **9.5** | 50 %-threshold word boxes: UNDER REVIEW 73.2×6.9 (6.5.7), OPEN FOR SWIPE 81.2×6.9 (6.5.5) and 81.2×6.9 solid (6.5.6), 20 MINS LEFT 64.0×7.3 (6.5.5) — the tile at 9 was 3–7 % narrower / 3–5 % shorter; 10 px labels matched, so only the 9 px roles moved |
| `--type-chip` | 13 | **12** | caps 24–25 px ⇒ 12.3–13.0; chip text runs (6.5.3 / 6.5.4) Filters 34.1, Sort by 41.7, Location 48.6, Date 26.4, Category 54.0 CSS are 12–18 % narrower than PJS at 13 |
| `--type-tag-chip-upper` | 8.5 | **7.5** | chip widths 6.5.7 BAR 37.5 / BEACH CAFE 73.1 CSS with the measured pad 10.7; the ink caps (6.1 / 6.5 CSS ⇒ 8.1–8.7) argue 8.5 — width was chosen (type lens vs geometry lens; the type lens declined to decide because BAR / RESTAURANT letterforms disagree) |
| `--size-chip-h` | 40 | **42** | 6.5.3 Filters ring y 1319–1428 = 42.1 CSS, the same rows as the layout toggle (6.5.4 My Events chips are 40.2 — the two screens differ, but within a row chips and toggle match, so the Explore value is the token and `--size-layout-toggle-h` is now `var(--size-chip-h)`) |
| `--chip-pad-x` / `--tag-chip-pad-x` / `--space-chip-gap` | 16 / 12 / 8 | **18 / 11 / 7** | 6.5.4 Location ring 429 → text 476 = 18.0 both sides; 6.5.7 BAR ring 395 → text 423 = 10.7; 6.5.4 chip gaps 17–18 px = 6.5–6.9 |
| `--size-icon-button-badge` / `--size-chip-badge` | 18 | **17** | 6.5.3 Filters "2" badge (391,1352)–(434,1395) = 16.9 CSS; 6.5.1 bell "30" ≈15×15 (tilted) |
| `--count-badge-pad-x` | 6 | **4** | 6.5.8 "24" badge (549,899)–(604,948) = 21.4×19.2, digits 11.9×8.0 at 50 % ⇒ ≈4.6 side padding. Digits stay 11/600: cap 7.7–8.0 CSS = 10.3–10.7 px (the "≈9 px" in the badge deviation was inferred from the disc size and is contradicted by the measured caps) |
| `--size-island-w/h`, `--island-top` | 125×37 @ 11 (never measured) | **103×33 @ 10** | 6.5.3 and 6.5.7: black run x 487–754 at y 740/800 = 268 px, y 727–812 at x 620 = 86 px, screen top y 700 ⇒ 27 px |
| `--radius-sheet` / `--size-sheet-grabber-h` (est.) | 28 / 4 | **30 (= card) / 5** | no reference; every measured card fits r30–31, iOS grabber convention 36×5 |

New tokens: `--gutter-review-left` 15 (`.section.is-review`), `--color-text-secondary-hex` #999999 /
`-tertiary-hex` #808080 / `-muted-hex` #6b6b6b (icon strokes in grey text — see §4), `--badge-sm-pad-x` 2
(⌀17 badges), `--fs-chip` 12.

Component changes (components.css / base.css): `.tab { isolation: isolate }` + glow pseudo at `z-index: -1`
(label above the glow); `.seg` padding 6 / 4 with `.seg-item { margin: 0 4px }` (pill inset 8, ≈8 narrower
than its segment); `.btn-sm` full stadium, pad-x 16 (decoupled from `--chip-pad-x`); `.icon-btn.is-pill::before`
44 px hit area; `.icon-btn-badge` / `.chip-badge` pad `--badge-sm-pad-x`; `.c-secondary/.c-tertiary/.c-muted .icon`
and `.section-link .icon` opaque greys; `.section.is-review`. Style tile: the `--type-section-link` sample uses
the SVG arrow (U+2197 fell back to the system font); §07 renders inside `.section.is-review`; swatch and
labels updated.

Rendered check (`scratchpad/measure/fixer2/probe.mjs` + `pixels.py`, dpr 3): fonts PJS 400/500/600/700
loaded, no console / page / request errors, 0 missing icons, 0 interactive elements under 44 px. Filter panel
top edge #7e47dd → #5f3eda → #3733d6, gap between tiles #6941db (reference #6f42db at ≈32 %), tile centre
#7f50de; active tab label brightest #ffffff on both bars; refresh glyph brightest #999999 (reference #a2a2a2,
flat); Create square top #5032ab → #342aa8, bottom #5b35ac → #4c31aa; island 103×33 @ 10; badges "30" 18.6×17,
"2" 17×17, "24" 21.6×20 (colours #7946dc / #593dda / #4336d7 vs reference #7043db / #5a3dd9 / #4436d7); chips
and toggle all 42 tall, top delta 0, toggle hit area 44; segmented 2-up pill 159 inset 8 (right edge 4 short of
the midline; reference 5.4), 3-up pill 103.3 (reference 103.4); `.btn-sm` 147×36 r999; To Review rows 351
wide, 15 / 24; sheet r30, grabber 36×5; status-tag text UNDER REVIEW 72.9 (ref 73.2), OPEN FOR SWIPE 83.3
(ref 81.2), caption 66.2 (ref 64.0).

**Known residual (font metrics, not geometry):** chip widths render Filters+badge 124.5 (ref 116.4), Sort by
106.8 (102.6), Location 89.0 (85.0), Date 65.7 (62.4), Category 93.0 (88.8) and tag chips BAR 39.7 (37.5),
BEACH CAFE 72.7 (73.1). With the measured pad 18 the excess is the label: Plus Jakarta Sans 600 is 12–18 %
wider than the app's face at equal cap height (e.g. "Location" 52.8 vs 48.6 CSS at 12 px). Matching the widths
would need 11 px chip text (cap 13 % under the measured 24–25 px) or a tighter pad than the measured 18; 12 px
was kept so cap height and padding stay true and the row reads ≈4 px wide per chip.

## 17. Fix pass round 3 (verified deviations)

Sixteen deviations were re-measured on the PNGs (`scratchpad/measure/fixer3/verify.py`, `radii.py`, `kasa.py`,
`sliders.py`) and — because two of them turned on which measurement method is trusted — calibrated by rendering
the candidate values at the reference scale (Playwright, `deviceScaleFactor` 2.611; `calib.html`, `calib.mjs`,
`calib_measure.py`) and running the identical measurement code on the render and the reference. Token **values**
that changed:

| Token | Was | Now | Evidence |
|---|---|---|---|
| `--type-tag-chip-upper` / `--fs-tag-chip-upper` | 7.5 | **8** | 6.5.7 text ink BAR 41×16 px, BEACH CAFE 134×17 (cap 6.13 CSS ⇒ 8.2); PJS 600 at 8 renders 41×16 / 133×16. The round-2 chip widths 37.5 / 73.1 CSS do not reproduce: ring-to-ring at mid-height (y 1607) BAR x 389–498 = 110 px = 42.1, BEACH CAFE 510–712 = 203 px = 77.7 |
| `--tag-chip-pad-x` | 11 | **12** | with 8 px text, pad 12 renders the rings 112 / 202 px vs the reference 110 / 203 (pad 11: 108 / 198) |
| `--type-stat-label` / `--fs-stat-label` | 10 | **10.5** | 6.5.4 'T' caps 20–21 px, word boxes To confirm 131×21, To review 117×21, To visit 78×21, Requests 108×25 (>215 on the gradient tile); PJS 500 renders at 10: 128×20 / 115×19 / 82×19 / 113×24 (caps 19), at 10.5: 134×21 / 120×20 / 86×20 / 120×25 (caps 20), at 11: 141×22 / 126×21 / 90×21 / 126×27 (caps 21, 8–15 % too wide). The deviation asked for 11; 10.5 is the fitted value |
| `--radius-md` / `--radius-tile` / `--radius-toggle-bar` / `--radius-segmented` | 18 | **17** | corner-inset fits (50 % threshold, rows 3–25 below the top edge): 6.5.4 stat tiles 2/3/4 44.1–44.4 px, toggle bar 43.4–43.7, 6.5.8 3-up segmented container 44.8 (sub-pixel); the same code on a render at 2.611 px/CSS reads r16 = 42.2, r17 = 43.3, r18 = 46.6, r22 = 56.0, r30 = 78.1 ⇒ fitted 17.0–17.4. The deviation's 16 (41.5–42.7 px) and the original 18 (46 px) were both method artefacts; the invite card (78.7 vs r30 = 78.1) confirms the calibration. `--radius-segmented` was re-fitted on 6.5.8 (clean canvas) since the 6.5.7 container sits over the hero fade |
| `--icon-size-layout-toggle` | 17 | **15** | `server` spans 20/24 ⇒ 12.5 + 1.6 stroke = 14.1 CSS; 6.5.3 glyph (981,1356)–(1016,1391) = 13.8 square (the 17 box drew 15.8) |
| `--icon-size-chip` | 20 | **17** | 6.5.3 sliders ink (218,1356)–(251,1393) = 13.0×14.6, sort glyph 13.8×12.6; at 17 the sort glyph is 14.4×12.9 and the redrawn sliders 13.0×14.8 |
| `--icon-size-tile-arrow` | 22 | **18** | `arrow-up-right` spans 10/24 ⇒ 7.5 + 1.75 = 9.25; 6.5.5 tile 1 (373,2174)–(395,2197) = 8.8×9.2 (the 22 box drew 10.9 — its comment had counted the path only) |
| `--dash-tile-arrow-top` / `--dash-tile-arrow-right` | 12 / 8 | **14 / 10** | keeps the ink at 18.4 / 14.4 from the tile edges with the smaller box (6.5.5: 18.8 / 14.2) |

New tokens: `--icon-size-bell` 22 (Lucide `bell` spans 17.5×20/24 ⇒ 16.0×18.3 + 1.75 = 17.8×20.1; 6.5.5 (980,910)–(1025,962)
= 17.6×20.3, 6.5.4 (974,939)–(1020,992) = 18.0×20.7 — the 26 box drew 20.7×23.4), `--icon-size-avatar-glyph` 27
(6.5.5 briefcase (215,910)–(273,963) = 22.6×20.7 CSS in the ⌀38.3 disc = 57 %; the filled briefcase spans 20×18/24 ⇒
22.5×20.3 at 27, the 20 box drew a 16.7 blob), `--icon-size-arrow` 19 (6.5.5 "See All ↗" arrow (1034,1058)–(1201,1224)
= 9.6×9.2 = 0.85 × the "S" cap; 7.9 + 1.6 = 9.5), `--fs-label-upper-3up` 10.5 (6.5.8 CHECKED IN 172×21 / CHECKED OUT
203×22 px vs PJS 600 at 10.5 168×21 / 202×21; at 10 160×20 / 192×20; at 11 176×22 / 210×22 — the 2-up
ESTABLISHMENTS | BRANDS control on 6.5.7 stays at 10, caps 20 px, width ratio 0.99).

Component changes (components.css): `.header-pill-avatar .icon` 27 box; `.icon-btn .icon-bell` 22 box; `.section-link`
gap 8 with a 19 px arrow (ink ≈12.5 from the text; measured 12.3); `.link-gradient::after` at `bottom: -4px` (rule ≈6
CSS below the baseline; 6.5.8 glyph bottom 1355 → rule 1376–1378 = 6.5; the rule's colour was left alone — the
reference reads ≤15/255 brighter along its length, consistent with marketing-image sharpening); `.btn-sm` and
`.calendar-pill` at 12/500 (6.5.3 "Show full Calendar" ink 271×24 px, 'S' cap 24 = the chips' cap; PJS 500 at 12
renders 275×24, at 13 298×26); `.seg.is-3up .seg-item` 10.5; `.card-kv` / `.card-kv .k` (key in `--color-text-meta`,
value white, one 13 px run — 6.5.7 "Brand :" core #767093); `.scroll-x > .filter-panel { flex: none }`; `.sep` (meta-line
separator: the bullet U+2022 inside `<span class="sep">` at `--meta-sep-scale` .55 em, `vertical-align: middle`, margin
`--meta-sep-gap` 3.5). The reference separators are 6×6 px = 2.3 CSS, centred 0.6–0.9 CSS below the cap centre with
4.6–5.0 CSS clear each side (6.5.4 (380,1950)–(860,2000); 6.5.5 (388,1498)–(846,1544)); the bare bullet rendered a
3.8 CSS blob and the deviation's first suggestion, the middle dot U+00B7, only 1.15 CSS in Plus Jakarta Sans (measured
at 2.611 px/CSS), so the scaled bullet was used: it renders 2.30 CSS, centre +1.05, gaps 4.9. icons.js:
`sliders` redrawn to the 6.5.3 glyph (§10 — knobs left / right / left, rings r 2.1, rows 7.2 apart; the old glyph
had the knobs at x 8 / 16 / 10 with lines on both sides). Style tile (debug/style): all 23 meta separators → `<span class="sep">•</span>`; avatar
glyphs 27, bells 22, See-All arrows 19 (placeholders and the `--type-section-link` type row), chip icons 17, `server`
15, tile arrows 18; the 3-up control carries `.is-3up`; the `--type-body` type row shows the two-tone "Brand :" line;
the Explore-home filter band is `<div class="scroll-x mt-6"><div class="filter-panel">…</div></div>` — the 380-wide
panel starts at the 24 gutter and runs off the 390 frame (6.5.1: the band reaches the image edge on rows y
1900–2050 and "Event Typ…" is clipped by the screen, not by a panel corner), instead of a 342 `.scroll-x` panel with
its own rounded right corner 24 px inside the screen.

Rendered check (`scratchpad/measure/fixer3/probe3.mjs`, dpr 3, mirror served on :4403; clips in `scratchpad/fix/round3/`):
fonts PJS 400/500/600/700 loaded, no console / page / request errors, 0 missing icons. Tag chips BAR 42.8 / BEACH CAFE
78.0 CSS (reference 42.1 / 77.7), text 6.0 CSS caps (6.13); stat labels 10.5 — To confirm 51.3×8.0, To review 46.7×8.0,
To visit 33.0×8.0 CSS, first-letter caps 8.0 (reference 50.2×8.0 / 44.8×8.0 / 29.9×8.0, caps 7.7–8.0); stat tiles,
toggle bar and both segmented containers r17; 3-up labels 10.5 / 2-up 10; briefcase silhouette 22.5×20.3 in the ⌀40 disc
(56 %; reference 57 %), user-round 18×20.3; bell ink 18.3×20.1 (reference 17.6–18.0×20.3–20.7), search unchanged 21.1;
"See All" arrow ink 9.5 with 12.7 text→ink (reference 9.6×9.2, 12.3); tile arrow ink 9.25 at 18.4 / 14.4 from the tile
edges (8.8×9.2 at 18.8 / 14.2); chip icons sliders 13.0×15.0 / sort 14.4×12.9 (13.0×14.6 / 13.8×12.6); layout-toggle
glyph 14.1 (13.8); Filters chip 121.5 (was 124.5; reference 116.4 — the remaining 5 is the PJS label width, §16);
"Add Review" rule 1 CSS thick, 5.67 CSS below the glyph bottom (reference 6.13 by the same convention; −5 px would give
6.67); calendar pill and `.btn-sm` 12/500; "Brand :" key #766f94 / value #fff; filter panel x 24 → 404 in the 390 frame
(scrollWidth 428), no inline padding; meta separators 2.33×2.33 CSS, centre +1.0–1.2 below the cap centre, gaps 4.7–5.3
(reference 2.30, +0.6–0.9, 4.6–5.0).
