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
      shows quota progress (a **progress ring** + count-aware "This week" rows);
      past frequency weeks use **quota rows**.
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

## 4. This week + history (goal detail)

- [ ] The **This week** rows show the current week plus recent weeks (Monday on
      the left); the current week is editable, past weeks are read-only.
- [ ] **Tap** an open day in the current week → it flips to Done; the headline,
      progress ring, streak, and history update.
- [ ] **Tap** a done day → an inline **Remove / Keep** confirm appears;
      **Remove** clears the check-in.
- [ ] A day outside the editable window (older than this week + 2-day grace)
      offers no **Mark / Remove** and cannot change history (a read-only cell may
      still show its date tooltip).
- [ ] The **calendar history** (recent month grids + older year strip) is
      **read-only** (no click-to-edit).

## 5. Reflections

- [ ] Current week shows the narrative headline + "In your own words" (your
      check-in notes) + the week grid.
- [ ] Write Keep / Let go / Try next / Notes → **Save reflection** → "Saved ·
      time".
- [ ] Tap **· Private** suffix next to Save → flips to **· [partner name]** (1
      partner) or **· [A] & [B]** (2) or **· N partners** (3+); a 2-second
      inline confirmation appears (`[Name] will see this reflection · save to
      apply`). Tap again → flips back to **· Private** (muted, no confirmation).
      Only appears when a partner is accepted; a muted explanation sentence shows
      otherwise.
- [ ] A past week row expands in place; a finished, scoreable week shows a
      completion %.

## 6. Partners (needs account B)

- [ ] **A invites B**: Partners → enter B's email → Send invite. A pending
      invite row appears with Copy link / Revoke.
- [ ] **B accepts** via the invite link → B sees A under "Your partners".
- [ ] **A shares a goal**: goal detail → tap the **Private / Shared with…**
      status → toggle B in the share sheet → close the sheet. The status line
      updates and the sheet stays on-brand.
- [ ] **B opens A's partner page**: sees A's name, avatar, the shared goal, its
      history, the goal's **category name + color** (not "Uncategorized"), and
      "N-day streak · M check-ins" (no %).
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
- [ ] Mobile width: tap targets, day-of-week toggles, and the "This week" rows
      all read cleanly.
- [ ] If a separate **demo** Supabase project exists, the latest migration
      (currently `0016_categories_partner_read.sql`) has been applied there too.
