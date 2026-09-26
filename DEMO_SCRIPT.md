# The Secret Society demo — presenter script

Two roles, two browser windows, one story: the same blogger journey ends differently depending on
how the venue approves. **Slot Planners** (Solace Beach Club) approve into a seat and the blogger
sails through. **Inbox Clearers** (Obsidian Lounge) approve without a seat and the blogger hits
"This slot is full" every single time.

## Setup (2 minutes before the call)

1. Open two **normal** Chrome windows side by side, same Chrome profile (not Incognito — the two
   windows share marketplace state through localStorage).
2. Load the app in both: https://khaledismail-sandbox.github.io/tss-demo/
   (for a silent rehearsal use http://localhost:4322/tss-demo/ — on localhost the app opts out of
   Amplitude and only logs events to the console and to /tss-demo/debug/).
3. Optional attribution: append one of these to the first URL you open in the blogger window and the
   whole blogger session carries it (identify + Offers Feed Viewed):
   `?utm_source=google&utm_medium=cpc&utm_campaign=tss_creator_acquisition_search`,
   `?utm_source=google&utm_medium=organic&utm_campaign=tss_seo_creator_guides`,
   `?utm_source=instagram&utm_medium=social&utm_campaign=tss_ig_creator_invites` (default when absent),
   `?utm_source=tiktok&utm_medium=social&utm_campaign=tss_tiktok_creator_spotlight`,
   `?utm_source=creator_referral&utm_medium=affiliate&utm_campaign=tss_member_get_member`,
   `?utm_source=newsletter&utm_medium=email&utm_campaign=tss_weekly_drops`.
4. If a previous rehearsal left state behind, open https://khaledismail-sandbox.github.io/tss-demo/debug/
   in either window and press **Reset demo** (clears applications, invites, seats and codes for both
   windows). **Clear this window's session** logs the current window out without sending anything.
5. Every blogger rehearsal creates a fresh user: `demo-blogger-sara-MMDD-HHmm` or
   `demo-blogger-omar-MMDD-HHmm` (the ID is shown on the Join screen). Managers are stable:
   `demo-manager-solace` and `demo-manager-obsidian`.

## Run A — Slot Planner (Sara · Solace Beach Club · Daybed Experience) — never shows Slot Full

Blogger window (left)
1. Welcome → **I'm a creator**. `[Amplitude] Page Viewed` on every screen from here on.
2. Join: Sara is pre-selected, sign-up method Email; note the generated demo ID → **Join The Secret
   Society**. Fires the identify (user properties incl. utm_source / utm_medium / utm_campaign) and
   `Account Created`.
3. Explore opens → `Offers Feed Viewed` (is_returning false). Point out the hero, the category chips
   and the Featured cards. Tap **Daybed Experience** → `Offer Viewed` (venue group VEN-DEMO-SLOT,
   slots_available 4, seats_left 16).
4. Tap **Apply** → the apply sheet → `Application Started`. Leave the 124-character pitch and
   1 guest → **Send application** → `Application Submitted` (pitch_length_chars 124). You land on
   Invites with the application "Under review".

Manager window (right)
5. Welcome → **I'm a venue** → Solace Beach Club is pre-selected → **Log in**. Fires the manager
   identify, `setGroup venue = VEN-DEMO-SLOT` and `Logged In`.
6. Dashboard → `Venue Dashboard Viewed` (credits_balance 200). The pending tile already shows Sara's
   application — it arrived live through localStorage, no reload.
7. Tap **Open slot calendar** on the Daybed task card → `Slot Calendar Viewed` (slots_count 4,
   total_capacity 16, applicants_count 1). Tap **Place in seat** on Sara → the slot picker sheet →
   Sat 14:00 is pre-selected → **Approve into Sat 14:00** → `Applicant Approved`
   (approval_source slot_calendar, seat_assigned true, slot_id SL-DEMO-01-1).

Blogger window
8. Invites updates live: the card reads **"Sat 14:00 — seat reserved"**. Tap **View invite** →
   `Invite Opened` (seat_reserved true, slot_id SL-DEMO-01-1). Tap **Accept invite** →
   `Invite Accepted` (slot_time 14:00, slot_weekday Saturday, approval_style slot_calendar).
9. "You're in!" → **View check-in code** → `Check-in Code Shown`. Read the code aloud (TSS-XXXX).

Manager window
10. Tab **Check-in** → type the code → **Confirm** → the confirmation sheet shows 2 credits ·
    AED 240 → **Confirm check-in** → `Guest Checked In` with revenue: productId OFR-DEMO-01,
    price 120, quantity 2, revenue 240, revenueType credits_consumed. The blogger's check-in screen
    flips to "Checked in" live.
11. Optional: blogger **Deliverables** → **Submit deliverables** → `Deliverables Submitted`;
    manager Dashboard → **Rate** on the recent check-in → **Submit rating** → `Collaboration Rated`.
12. Blogger Profile → **Log out** → `session_ended` (deepest_funnel_step_reached 5, converted true).
    Manager Profile → **Log out** → `session_ended` (step 5, converted true).

## Run B — Inbox Clearer (Omar · Obsidian Lounge · VIP Table) — always shows Slot Full

Blogger window
1. Welcome → **I'm a creator** → select **Omar** → **Join The Secret Society**.
2. Explore → tap **VIP Table** → `Offer Viewed` (venue group VEN-DEMO-INBOX, 4 slots, 12 seats).
3. **Apply** → **Send application** → `Application Started`, `Application Submitted`.

Manager window
4. Welcome → **I'm a venue** → select **Obsidian Lounge** → **Log in** → Dashboard.
5. Tab **Applications** → `Applications Inbox Viewed` (applicants_count 1, pending_count 1). This
   is the inbox: chronological, **Approve** / **Decline**, and no seat picker anywhere. Tap
   **Approve** → `Applicant Approved` (approval_source inbox, seat_assigned false, slot_id unassigned).
   (**Approve all** exists for the bulk case → `Bulk Approve Used` + one approval per applicant.)

Blogger window
6. Invites updates live: the card reads **"Pick your slot"**. Tap **View invite** → `Invite Opened`
   (seat_reserved false, slot_id unassigned).
7. Tap **Choose slot** → the slot list. **Saturday 22:00** carries the "Most popular" tag and looks
   available. Tap it → the sheet **"This slot is full"** → `Slot Full Notice Viewed`
   (reason unassigned_seat, slot_requested SL-DEMO-02-1, slots_remaining 2, approval_style inbox).
8. Tap **Close** → `Invite Abandoned` (reason slot_full). Invites now shows the VIP Table invite as
   **"Slot unavailable"**.
9. Profile → **Log out** → `session_ended` (deepest_funnel_step_reached 3, converted false).

Why it always reproduces: for invites approved without a seat, Sat 22:00 and Fri 23:00 are always
full; only Tue 21:00 and Wed 22:00 stay open. Seated invites (Run A) never route to the slot screen.

## The "after" page (treatment for the Inbox Clearer problem)

https://khaledismail-sandbox.github.io/tss-demo/venue/fix/seat-at-approval/ — not linked from the
app and not connected to the experiment. Tap **Approve** on an applicant: the slot picker shows a
live capacity bar per slot with the best open slot pre-selected. **Approve all** spreads applicants
across open slots and sends the overflow to a **Waitlist** instead of a full slot. It fires only
`[Amplitude] Page Viewed`; the buttons animate but send nothing. **Reset** restores the demo state.

## Finding the replays in Amplitude (project "The Secrete Society", id 867815)

1. Replays appear a few minutes after a session ends (log out or close the window).
2. Session Replay → filter by user: `demo-blogger-omar-…` (or the ID shown on the Join screen).
   Sort by most recent. Play from `Invite Opened`; the replay shows the slot list, the tap on
   Saturday 22:00 and the "This slot is full" sheet.
3. From any chart: click `Slot Full Notice Viewed` or `Invite Abandoned` in the event stream and open
   the replay from the event; every event carries `[Amplitude] Session Replay ID`.
4. Group view: the venue group `VEN-DEMO-INBOX` (Obsidian Lounge) collects the blogger events through
   the event-level `venue` group; the manager's own events are attributed through user-level group
   membership set at log in.
5. Session Replay masking is the project default (medium: inputs masked, text visible), sample rate 100%.

## Presence check — /tss-demo/debug/

Shows Analytics, Session Replay (sample rate 1), Engagement and Experiment status, the current
user_id / device_id / session_id / groups, the last 20 events with their validation status (invalid
rows in red) and the marketplace state. The Experiment row reads "no variant returned — flag has no
deployment attached yet" until a deployment is attached to `slot-full-notice-viewed-reduction` in
Amplitude; the app never gates anything on the variant and never sends exposures.

## Troubleshooting

- Both windows must be normal windows of the same Chrome profile; an Incognito window has its own
  localStorage and will not see the other side's approvals.
- The other window did not update: it updates within a second via the `storage` event; if you
  reloaded instead, the state is still correct.
- Two rehearsals inside the same minute reuse the same demo ID suffix; wait a minute or use the other
  persona.
- Stuck state: /tss-demo/debug/ → **Reset demo**, then reload both windows.
- On localhost nothing is sent to Amplitude (by design); use the GitHub Pages URL for the live demo.
