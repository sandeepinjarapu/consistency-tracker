# Goal Detail Redesign — Behavioral Spec

Status: **implemented in PR #99.** This is the design record for that change.

This specifies the redesigned owner goal-detail page (`/consistencytracker/goals/[id]`).
It does not change the partner view, the goals list, or the edit page (except that
the goal **description** is now edited there and no longer shown on detail).

## Legend (so scope and trust are explicit)

- **[KEEP]** server action / computation used as-is, no change.
- **[RELOCATE]** existing UI/logic moved to a new spot, behavior unchanged.
- **[RESTYLE]** same data, new visual treatment.
- **[NEW]** genuinely new UI or client logic to build.

Guiding philosophy is unchanged (PRODUCT.md / DESIGN.md): calm, evidence not grades,
anti-shame, one category accent per goal, 44px targets, no em dashes in copy.

---

## 1. Page order (top to bottom)

1. Breadcrumb: "← All goals"
2. Identity: category · cadence meta, goal name, gear overflow
3. Two columns: **Why** (left) · **Connections** (right)
4. Reaction line (full width, only when a reaction exists)
5. Divider
6. This week: headline + ring, note, the week grid, all-time line, "View full history"
7. Divider
8. (Frequency only) Week by week bars
9. Divider
10. Pattern: insight sentence + time-of-day histogram

---

## 2. Identity

- **Meta line:** category dot + `Category · cadence`. Cadence is `targetDaysLabel`
  for specific-day, `N× per week` for frequency. The **reminder time is NOT here**
  (it lives in Connections). [RESTYLE]
- **Name:** the goal name, `font-light` H1. [KEEP]
- **Description:** removed from this page. It is edited on the edit page and still
  shows on the Today card. [RELOCATE — remove from detail]
- **Gear overflow** (top-right): Edit goal, Archive/Unarchive. Reserved for future
  Pause/Stop (out of scope now). Replaces the current inline `Edit · Archive` text
  (`GoalRowActions`). Reuse the `GoalRowMenu` pattern from the goals list. [RESTYLE,
  actions KEEP: `archiveGoal`/`unarchiveGoal`]

---

## 3. Why (left column)

- The `motivation` text, clamped to ~2–3 lines with a tap **"more"** to expand.
  Implementation is a JS truncate-and-toggle, not CSS `line-clamp` (which hides the
  affordance). [NEW client behavior; data KEEP]
- **Empty (no motivation):** an invitation in the form's own voice, e.g.
  "When this gets hard, what should it remind you of?" + an "Add a reason" link to
  the edit page. [NEW empty state]

---

## 4. Connections (right column)

A short stack, each field shown only when real, in this order:

1. **Sharing status** (always): "Shared with {names}" or "Private". The whole line
   is a control: tapping it opens the **share sheet** (section 6). A lock glyph marks
   Private; a people glyph marks shared. [RESTYLE of `ShareToggles` resting state;
   the names come from `listSharesForGoal` + partner names]
2. **Reflection doc** (only if `doc_url` set): "Reflection doc ↗", opens in a new
   tab via `safeExternalUrl`. [RELOCATE from the current meta row]
3. **Reminder** (specific-day only, only if `reminder_time` set): the existing
   `CalendarReminder`, unchanged: "Reminder 7:00am · Add to Google Calendar ↗"
   flips to "Added 7:00am to your calendar ✓ · Add again" after a click
   (`markCalendarAdded`; it records a click, not a sync, hence "Add again").
   [RELOCATE, logic KEEP]
   - If no reminder set: nothing here (set it in edit). The current "No reminder set ·
     add one" prompt is dropped from this column.

Frequency goals never show a reminder (they have none).

---

## 5. Reaction line (appreciation)

- A **full-width line under the two-column zone**, shown only when at least one
  partner reaction exists. Separated by a faint hairline. [NEW placement]
- Shows the full `reactionSentence` per reactor/kind summary, e.g. "Richa has been
  proud of this for 3 weeks, latest this week." (no longer truncated). Multiple
  reactors stack as multiple lines. [KEEP `getGoalReactions` + `buildReactionSummaries`
  + `reactionSentence`]
- **Unseen** reactions carry the blue dot; visiting the page marks them seen
  (`MarkReactionsSeen`), after which the line settles to muted. [KEEP]

---

## 6. Share sheet (opened from the sharing status)

Replaces the current inline `Manage` + checkbox list + `Done`. Bottom sheet on phone,
popover on desktop, anchored to the status line. Closes on tap-away or ✕.

It **composes** (these are not separate screens):

- **Accepted partners** (`listPartners`): one tap-to-toggle row each. Toggling calls
  `setGoalShared(goalId, partnerId, shared)` optimistically, saves on its own. [KEEP action]
- **Pending invites** (`listPendingInvites`): greyed rows, "Waiting to accept", not
  toggleable. Each can offer "Copy link" (the `invite_url`). [KEEP]
- **Invite field:** email input + "Send invite" → `sendInvite(email)`. On success show
  the **copyable invite link**, because email is best-effort (Resend can fail); this
  mirrors today's `InviteForm`. [KEEP action]
- **Footer:** "Manage partners" → `/consistencytracker/partners` for heavier work
  (revoking invites, etc.).

Rules grounded in code:
- You can only share with an **accepted** partner (`setGoalShared` rejects non-partners).
  So an empty list legitimately means "invite first".
- Per-goal cap is **10** partners (`MAX_SHARES_PER_GOAL`); beyond it the toggle is
  blocked with the existing error. [KEEP]

---

## 7. This week (status)

- Eyebrow "This week".
- **Headline** `{doneThisWeek} of {total}` next to a **progress ring**. [headline KEEP;
  ring NEW]
  - `total` = scheduled days this ISO week (specific-day) or `weekly_target` (frequency).
  - Ring fills `doneThisWeek / total` in the category accent on a near-invisible track.
    No percent, no number inside. At completion it closes and shows a quiet check.
    Optional calm ease-out fill on mount. Never red. [NEW]
- **Note:** the humane subtext from `computeWeekStatus.note` (e.g. "Tuesday's still
  open…", "Target met for this week."). [KEEP]
- **All-time line** (quiet, muted), kept here, NOT moved to the header: from
  `computeWeekStatus.secondary` ("27 done in total · best 9-day streak"). [KEEP, stays put]

---

## 8. The week grid (the record AND the editor)

The single most important change. It replaces both `WeekProgress` (read-only this-week)
and `CatchUp` (separate editor): the current week is now editable in place. The daily
heatmap is no longer the inline record (see section 9).

### 8.1 The affordance rule

> Editable cells look like controls. Locked cells are flat paint.

The editable set is **exactly `isBackfillable`** (date ≥ goalStart, ≤ today, weekday ∈
`target_days`, and ≥ `min(isoWeekStart(today), today − 2)`). This is the current ISO
week plus the 2-day grace into last week. [KEEP — same function the server enforces]

### 8.2 Cell states — specific-day goals

| State | Look | Tap |
| --- | --- | --- |
| Done, editable | filled accent chip + **check** | undo (soft confirm) |
| Done, locked (older) | flat accent, no check | none |
| Today, unlogged | accent **ring** | log |
| Scheduled, passed, unlogged, still editable (this week or grace) | grey dashed **well** | log |
| Scheduled, passed, unlogged, locked | flat grey | none |
| Skipped, editable | amber chip (toggle) | undo (soft confirm) |
| Skipped, locked | flat amber | none |
| Upcoming (future scheduled) | faint outline ghost | none |
| Not scheduled (weekday ∉ target_days) | faint rest dot | none |

### 8.3 Cell states — frequency goals

Same vocabulary, with one deliberate difference: **there is no "missed" state.** A
passed, unlogged, eligible day is a **neutral open well** (no grey), because no specific
day was owed (`missedSoFar` is documented as 0 for count goals). Done / today / upcoming
/ not-eligible behave as above. Backfill = tapping the day a session actually happened.
**No date picker** anywhere. [NEW visual; rests on KEEP logic]

### 8.4 Layout

- Weekday header `M T W T F S S`, Monday-left.
- **Live week** sits in a subtle accent-wash band; its editable cells carry the control
  look. Touch target for live cells is ≥ 44px (cell + row padding).
- **Recent weeks** (specific-day) render as read-only rows below, newest first, starting
  no earlier than goal creation. Default cap ~**6 weeks** (tunable); older lives behind
  "View full history".
- Frequency goals show only the live week row here; their history is the week bars
  (section 8.6 / 9).

### 8.5 Interactions

- Tap an open well or today → `backfillCheckIn(goalId, date)`, optimistic fill. [KEEP]
- Tap an editable done/skipped cell → **soft confirm** ("Remove this check-in? Undo"),
  then `clearBackfillCheckIn(goalId, date)`. A mis-tap never silently deletes. [KEEP
  action; soft-confirm is NEW client behavior]
- **Over-target stays open:** even after a frequency target is met, remaining editable
  days are still tappable (logging extra is evidence, not penalized). No week locking.
  [KEEP behavior, explicitly preserved]
- Locked cells are inert; the heatmap-style tooltip is not required here (the row label
  + position carry the date).

### 8.6 What this removes

- `WeekProgress` (chips/rail) — folded into the live grid. [REPLACE]
- `CatchUp` section — folded into the live grid; grace-period days appear as wells in
  last week's row. No standalone "Catch up" header, no footer copy. [REPLACE]

---

## 9. History

- **Specific-day:** the recent week rows (8.4) are the at-a-glance history.
- **Frequency:** "Week by week" bars (`WeeklyStrip`), kept as-is, since the meaningful
  unit is "did I hit my number". [KEEP]
- **"View full history"** (both types): a disclosure that reveals the existing
  `Heatmap` (read-only, the full record). It is no longer shown inline by default; it
  is opt-in so attached long-term users never lose it. [RELOCATE behind disclosure]
- **Month-label fix** on the heatmap: always label the first visible column's month and
  never suppress the most recent month (the current bug drops the current month's label).
  Applies wherever the heatmap renders (incl. the goals-list aggregate). [NEW fix]

---

## 10. Pattern

- The insight sentence (`buildGoalInsight`) + the time-of-day histogram
  (`TimeHistogram`), shown only when there are ≥ 4 timed check-ins. Quiet, last.
  [KEEP, restyled placement]

---

## 11. Empty / edge states

- **Brand-new goal (0 check-ins):** ring at empty; live grid shows today as a well and
  any earlier eligible days this week as wells; no history rows; all-time line reads
  "No check-ins yet — your history starts here" (`computeWeekStatus`). Why column shows
  the invite if no motivation. Connections shows "Private" (tap to share) and the doc/
  reminder only if set. No reaction line.
- **Private, solo, no doc, no reminder:** Connections is just "Private ›". That is a
  live control (opens the share sheet), not dead space.
- **Shared but no reaction yet:** no reaction line; the sharing status alone in
  Connections.
- **Invite pending:** the share sheet shows the pending row; sharing toggles are
  unavailable until acceptance.

---

## 12. Build scope summary

**NEW to build**
- The week grid component (both goal types, the cell-state vocabulary, live vs locked).
- The progress ring.
- The share sheet (composed accepted/pending/invite), opened from the status line.
- The reaction full-width line placement.
- The "more" truncate-and-expand for motivation.
- "View full history" disclosure wrapping the heatmap.
- Soft-confirm on undo.
- The Why empty-state invitation; the gear overflow on this page.
- Heatmap month-label fix.

**KEEP (server actions / computations, untouched)**
- `backfillCheckIn`, `clearBackfillCheckIn`, `setGoalShared`, `sendInvite`,
  `markCalendarAdded`, `archiveGoal`/`unarchiveGoal`.
- `isBackfillable` / `recentEditableDays`, `computeWeekStatus`, `computeWeekSlots`,
  `computeStats`, `buildGoalInsight`, `getGoalReactions` / `reactionSentence`,
  `listPartners` / `listPendingInvites` / `listSharesForGoal`.

**RELOCATE / REMOVE**
- Description → edit-only (removed from detail).
- Reflection doc, reminder → into Connections.
- Reaction → full-width line.
- Heatmap → behind "View full history".
- Edit/Archive → gear overflow.

---

## 13. To confirm during build (knobs, not blockers)

1. Recent-weeks cap before "View full history" (proposed: 6).
2. Ring mount animation: calm fill on, or static. (proposed: calm fill)
3. Soft-confirm UX for undo: inline 2-step vs tiny popover. (proposed: tiny popover)
4. Whether "View full history" reveals inline (expand) or routes to a dedicated view.
   (proposed: inline expand)
