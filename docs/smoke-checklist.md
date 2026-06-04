# Production smoke checklist

A fast manual pass over the core flows after a deploy, and a fuller pass before
letting a new outsider in. Tick the boxes; if anything fails, note it and stop
before sharing wider.

Two accounts make the partner flows real: **A** (owner) and **B** (partner). A
third signed-in account **C** (not a partner of A) is only needed for the RLS
negative check.

## 1. Auth & shell

- [ ] Visit `/consistencytracker` signed out → redirected to `/login`.
- [ ] Sign in with Google → lands on Today.
- [ ] Browser tab title reads **Consistency Tracker** (not "sixthsense").
- [ ] Nav: Today / Goals / Reflections / Partners all load; active tab is
      underlined.

## 2. Goals

- [ ] **Create a specific-day goal**: name + "why this matters" + a category +
      Weekdays. It appears on Goals under its category, and on Today (if
      scheduled today).
- [ ] **Create a frequency goal**: "Times per week", set e.g. 3×. Goal detail
      shows the segmented **quota rail**, not weekday chips.
- [ ] **Edit a goal**: change cadence → save → past weeks re-score under the new
      cadence; check-ins are preserved.
- [ ] **Archive / Unarchive** from the goal `⋯` menu and the detail page.
- [ ] Form sections read Details / How often / Reminder; "Why this matters" sits
      up top.

## 3. Today (the daily loop)

- [ ] **Mark done** → card gets a green wash, shows "✓ Done · time", Undo
      appears.
- [ ] **Skip** → pick a reason → amber wash, "⏭ Skipped · reason".
- [ ] **Undo** clears the check-in.
- [ ] **Add note** on a checked-in goal → saves → re-edit works.
- [ ] Buttons are thumb-sized (≥44px) on a phone.

## 4. Catch up + heatmap (goal detail)

- [ ] Catch up lists today + the recent editable days as dated rows. **Log** a
      past day → row flips to Done, heatmap + streak update.
- [ ] **Undo** a Catch up row clears it.
- [ ] A day outside the window (older than this week + 2-day grace) is **not**
      listed.
- [ ] The heatmap is **read-only** (no click-to-edit); status text reads
      "your record of showing up".

## 5. Reflections

- [ ] Current week shows the narrative headline + "In your own words" (your
      check-in notes) + the week grid.
- [ ] Write Continue / Stop / Improve / Notes → **Save reflection** → "Saved ·
      time".
- [ ] Toggle visibility **Private ↔ Partner** and save.
- [ ] A past week row expands in place; a finished, scoreable week shows a
      completion %.

## 6. Partners (needs account B)

- [ ] **A invites B**: Partners → enter B's email → Send invite. A pending
      invite row appears with Copy link / Revoke.
- [ ] **B accepts** via the invite link → B sees A under "Your partners".
- [ ] **A shares a goal**: goal detail → Manage → check B → the Manage UI looks
      on-brand (no jarring blue checkbox), Done is a real button.
- [ ] **B opens A's partner page**: sees A's name, avatar, the shared goal, its
      heatmap, and "N-day streak · M check-ins logged" (no %).
- [ ] **B reacts** "Saw it" / "Proud" on a recent week → A sees the reaction on
      that goal; the Partners blue "new" dot clears after A visits.
- [ ] A reflection B marked **Partner** shows in A's partner page "In their
      words"; a **Private** one never does.

## 7. RLS / privacy (the outsider gate)

- [ ] **Negative check (account C, not a partner of A)**: C cannot load A's
      partner page and cannot read A's profile. (Spot-check via the app; a
      direct `profiles` select for A's id from C returns nothing.)
- [ ] B (a partner) *can* see A's name/avatar; sharing still requires partner
      status.

## 8. Weekly email (cron)

- [ ] Trigger the weekly summary route (or wait for the Monday 02:30 UTC cron):
      A receives a summary of the prior Mon–Sun week for shared goals, with
      per-goal "done / target this week · %", and the CTA links to the partner
      page.
- [ ] Copy reads "Sent once a week (Mondays)".

## 9. Cross-cutting

- [ ] No console errors on any page (DevTools).
- [ ] Mobile width: tap targets, day-of-week toggles, weekday chips, and the
      Catch up rows all read cleanly.
- [ ] If a separate **demo** Supabase project exists, the latest migration
      (currently `0014_partner_trust_boundary.sql`) has been applied there too.
