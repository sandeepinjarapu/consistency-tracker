# Extra check-ins — spec

Status: **engineering contract, ready for implementation.** All product levers
are settled (the off-day logging surfaces in §8 are confirmed: both goal-detail
cells and a Today affordance).

## 1. Why

Two moments the tracker is currently silent — or worse, dismissive — about:

- **Specific-day goal, you show up on an unscheduled day.** Run on a Tuesday
  when your goal is Mon / Wed / Fri. Today the app refuses the check-in: the
  day isn't tappable and any tampered request is rejected server-side.
- **Frequency goal, you exceed the count.** A 4th session in a "3× a week"
  week reads as a flat `4 of 3`, with no warmth.

The product's stance is "evidence of showing up, not grades," and "a missed day
is never a failure." The mirror image must be true too: doing *more* than you
promised should feel good, not be invisible or read like an error. This is
grace **on both ends** — catch up when you fall behind, feel seen when you go
beyond.

## 2. Two kinds of extra (do not conflate)

There is no new kind of check-in. A check-in is still one `done` row per
`(goal, date)` (unique constraint). "Extra" is **derived** from a row's date
against the goal's *current* cadence, and there are two distinct shapes:

| Kind | Definition | Identification | Applies to |
|---|---|---|---|
| **Off-target** | done on a weekday **not** in `target_days` | **per-date** — the date itself is extra | specific-day **and** frequency |
| **Over-quota** | eligible-day done **beyond** `weekly_target` in its ISO week | **per-week count**, never a specific date | frequency only |

Why over-quota is a *count*, not a tagged date: if a 3× goal is done Mon / Tue /
Wed / Thu, asking "which one is the extra?" is meaningless and breaks under undo
(remove Tuesday and the "extra" has to migrate). So eligible-day dones are all
ordinary `done` cells; the surplus is a week-level annotation (`+1 extra`).

**One row per day.** The schema allows a single check-in per `(goal, date)`, so
an extra is an extra *day* of showing up, never a second session on the same
day. V1 does not add multiple same-day check-ins.

## 3. Metric vocabulary (the contract that prevents leaks)

Defined per goal, per ISO week. These names go in the code and in
`docs/metrics-glossary.md` so every surface speaks the same language.

- `targetCount` — what was promised. Specific-day: eligible days in the week
  (scheduled, on/after the goal's creation). Frequency: `weekly_target`.
- `eligibleDone` — done on eligible weekdays this week.
- `scoredDone` — done that counts toward the promise.
  Specific-day: `eligibleDone`. Frequency: `min(eligibleDone, weekly_target)`.
- `extraOffTarget` — done on non-eligible weekdays (per-date).
- `extraOverQuota` — frequency only: `max(0, eligibleDone − weekly_target)`.
- `extraDone` = `extraOffTarget + extraOverQuota`.
- `totalDone` = `scoredDone + extraDone` (every done row that week).
- `completionRate` = `scoredDone / targetCount`, capped at 1.
- `evidenceCount` = `totalDone` — the number narrative lines use
  ("you showed up N times").

**Founding principle:** streaks, `completionRate`, weekly-met status, and every
percentage are computed from **scoredDone / targetCount only**. Extras never
move a score. They are *seen, not scored.* This is what keeps "the metric
calculation" — the part flagged as tricky — genuinely untouched: the existing
`computeStats` / `computeWeeklyMet` math stays exactly as it is, because it
already filters by `target_days`.

## 4. One shared classifier (no surface invents "extra")

Add one pure helper in `src/lib/` (unit-tested) that all surfaces consume, so
goal detail, Today, partner, reflection, email, calendar, and tests share a
single definition:

- `isExtraDate(date, { targetDays })` → boolean (weekday ∉ `target_days`). The
  per-date off-target test.
- A week classifier returning the §3 counters for a goal+week given its
  check-ins (`scoredDone`, `extraOffTarget`, `extraOverQuota`, `totalDone`,
  `targetCount`, `completionRate`).

`computeStats` / `computeWeeklyMet` remain the authority for **all-time scored**
metrics and are **unchanged**. The new helper covers the weekly scored-vs-extra
split that the page currently computes ad hoc (e.g. the raw `doneThisWeek` at
`goals/[id]/page.tsx`).

## 5. Server contract (no "skipped extra" can exist)

Do **not** relax `isBackfillable` globally — all five existing mutations share
its guard (`assertBackfillable`), so opening its weekday rule would let
`markSkipped` write a skip on a non-target day, which violates the product rule.

Keep the scheduled path exactly as-is. Add a separate, narrow extra path:

- `isExtraLoggable(date, { goalStartDate, today, targetDays })` — same **time
  window** as `isBackfillable` (≤ today, ≥ goal start, current ISO week + 2-day
  grace) but the **complement** weekday rule (weekday ∉ `target_days`). The
  off-target half of the gate, nothing more.
- `markExtraDone(goalId, date)` — asserts ownership, **active** goal, and
  `isExtraLoggable`. Writes `status: "done"` only. **No skip variant.**
- `removeExtra(goalId, date)` — asserts ownership and that the date currently
  holds an **off-target row** (done *or* skipped) within the window, then
  deletes. (It must not be a back door to delete scheduled check-ins; those keep
  using `unmark`.) Removing a skip is supported so an out-of-cadence skip left
  behind by a cadence edit (below) can be cleaned up; `markExtraDone` still only
  ever *writes* `done`, so no new off-target skip can be created.

Over-quota extras (eligible-day dones beyond the quota) need **no new action** —
they go through the existing `markDone` / `unmark` because the day is already an
eligible weekday. Only their *display* changes.

**Off-target skips after a cadence edit.** A skip can only ever be written on a
scheduled day. But narrowing the cadence later (e.g. Daily → Weekdays) can leave
an old skip on a now-off-target weekday. Such a row is **never shown as extra
and never counted** (every scorer already filters by `target_days`). If it falls
inside the editable window it can be removed via `removeExtra`; otherwise it
simply sits in locked history, ignored.

Net new server surface: one predicate, two actions. The scheduled-day actions
and `isBackfillable` are untouched, so their existing tests stay green.

## 6. Surface-by-surface behavior

| Surface | Scored (promise) | Extra (evidence) |
|---|---|---|
| **Goal headline** (`computeWeekStatus`) | `scoredDone of targetCount` (e.g. `3 of 3`); never overshoots | append `· +N extra` when `extraDone > 0` |
| **Progress ring** | fills to `scoredDone / targetCount`, caps at full | small `+N` beside the ring; ring never overfills |
| **Week rows** (`buildWeekRows`) | scheduled cells as today | off-target done → new **`extra`** cell state (editable iff `isExtraLoggable`); over-quota eligible dones stay ordinary `done` cells (no per-cell tag) |
| **Today** (§8) | scheduled cards unchanged | off-day logging via the §8 affordance; over-quota already works via the existing card (pace caps at `✓ N of N`) |
| **Partner** (evidence surface) | streak from scored | `totalDone check-ins logged · K extra` when `K > 0` — e.g. 3 scored + 1 extra → `4 check-ins logged · 1 extra`; calendar shows extras as evidence |
| **Reflection narrative** | strongest/weakest + % use `scoredDone` / `completionRate` | "you showed up `totalDone` times"; notes may quietly label an extra |
| **Reflection % / highlights** | `scoredDone / targetCount` only — **unchanged** | extras excluded |
| **Weekly email** | report `scoredDone / targetCount`; never `6 / 5` | `· +N extra` shown **deterministically** when `N > 0`; **fix the asymmetry** (specific-day `done` must be the scored count, not raw) |
| **Aggregate calendar** | scheduled adherence drives intensity as today | see the precise rule below |
| **Per-goal calendar / month intensity** | adherence level **unchanged** by extras | extra shown as evidence (distinct mark + tooltip/aria), does not raise the completion/intensity level |
| **Time-of-day** (`computeTimePattern`) | — | live extras already flow in (no `target_days` filter); leave as-is so they count as real behavior |

**Aggregate-calendar intensity rule (V1):**

- A day with any scheduled/scored activity keeps its **existing** intensity
  (extras never raise the level).
- A day with **only** extras renders the **lowest non-zero** evidence level,
  tooltip `1 extra check-in` (plural as needed) — never grey "no goals
  scheduled."
- When a day has both, the tooltip names them separately
  (`2 of 3 done · 1 extra`).

## 7. The weekly-email asymmetry (must fix before extras ship)

In `weekly-summary.ts`, a specific-day goal's `done` is currently a raw count of
done rows with no `target_days` filter, while its `target` counts only scheduled
days. With no extras this is invisible; once extras exist it would print
`6 done / 5 target`. Fix: the email's headline number is `scoredDone` (capped at
`targetCount`); the percent stays target-based; extras are a separate
`+N extra` note, shown **deterministically when `N > 0`**. An evidence-only week
— extras present but no scoreable target — is **not** emailed.

## 8. Off-day logging surfaces (confirmed: both)

Off-day extras have no home in the daily loop: Today only renders goals
scheduled for today. V1 ships **both** entry points:

- **Goal detail.** The "This week" rows make off-day cells loggable: an
  unscheduled weekday inside the window offers **Log** (and, once logged,
  **Remove**), distinct from a scheduled cell. This is the precise, in-context
  place to add or correct an extra.
- **Today affordance.** A quiet section *below* the scheduled cards — "Log
  something extra" — that opens a picker of your other active goals and marks an
  extra `done`. No skip, never above scheduled work. This is what makes the
  feature discoverable in the daily loop.

  **Night-owl alignment:** between 12 AM and 5 AM the page is in the night-owl
  window (same as "Still open from last night"). In that window the extra list
  uses **yesterday** as both the logical day and the database date
  (`extraDate = yesterday`, `extraDow = yesterdayDow`), so a goal not scheduled
  yesterday is the one that appears, and the check-in lands on the day the user
  is mentally still in. Copy shifts accordingly: collapsed button reads "Log
  something extra from last night"; expanded sub-text reads "Up late? This logs
  to yesterday." After 5 AM both revert to the normal calendar-today meaning.

Both write through `markExtraDone` / `removeExtra` (§5), so they share one guard
and one definition. (Over-quota frequency extras need neither surface — they're
already loggable from the existing Today card.)

## 9. Out of scope

- No reintroduction of click-to-edit on the calendar history. History stays
  read-only; extras are logged via "This week" / the §8 affordance.
- No `bonus`/`extra` DB column or migration — fully derived (cadence re-score
  would make a stored flag stale).
- No change to streak, completion-rate, or weekly-met math.
- No "skipped extra" — an extra is always a `done`. Skips stay scheduled-only.
- No per-date tagging of over-quota frequency dones (it's a weekly count).
- No backfilling extras outside the existing editable time window.

## 10. Acceptance criteria

1. A Mon/Wed/Fri goal logged on Tuesday shows as **extra** and does **not**
   change streak or completion rate.
2. A 3×/week goal with 4 eligible-day check-ins reads **target met · +1 extra**,
   never `4 of 3`; the ring shows full, not overfilled.
3. The Today summary never counts extras as scheduled goals completed.
4. The weekly email never shows `6 / 5`; it shows `5 / 5 · +1 extra` whenever
   `extraDone > 0`, and an evidence-only week (no scoreable target) is not sent.
5. A partner sees extras only on **shared** goals; counts read evidence-accurate
   `4 check-ins logged · 1 extra` (3 scored + 1 extra).
6. Reflection % and strongest/weakest are unchanged by extras; the narrative may
   say "you showed up N times" using `totalDone`.
7. The aggregate calendar shows an extra-only day as "showed up"; per-goal month
   intensity / adherence level is unchanged by extras.
8. A non-target day allows **Done** and **Remove** but **never Skip**.
9. A day outside the editable time window can't be logged at all (extra or
   scheduled); the grace window is unchanged.
10. Editing cadence **re-derives** extra status: e.g. specific-day Weekdays →
    Daily turns old weekend extras into ordinary scheduled check-ins; 3× → 5×
    turns prior over-quota into ordinary scored progress.
11. All existing unit tests pass; new tests cover the classifier, the relaxed
    extra gate, and the email fix.

## 11. Edge cases (fold into tests)

- Goal created today on a non-target day: extra loggable today, blocked before
  creation (timezone-correct).
- Archived goal: no extra logging.
- Future date: blocked.
- Frequency quota met, then an earlier eligible done is undone: `extraOverQuota`
  recomputes (it's derived per week).
- Off-target done, then cadence widens to include that weekday: it becomes a
  scored check-in automatically.
- Off-target **skip** left by a narrowing cadence edit: never shown as extra,
  never counted; removable via `removeExtra` if in window; no new off-target
  skip can ever be created.
- One row per `(goal, date)`: a second same-day check-in is not possible; an
  extra is an extra day, not a second session.
- Weekly email for an evidence-only week (extras but no scoreable target): not
  sent.
- Time-of-day pattern counts a live extra (it reflects real behavior).

## 12. Phasing — three PRs

**PR 1 — logic contract (no visual polish).** The shared classifier + tests;
the weekly-email asymmetry fix; the current-week scored/extra split feeding the
headline; `isExtraLoggable` + `markExtraDone` / `removeExtra` with tests. Tests
cover cadence edits (re-derivation, off-target skip cleanup), the
one-row-per-date rule, and the over-quota weekly count. Pure logic and server
actions; UI still renders today's behavior.

**PR 2 — UX.** Week-rows `extra` cell state; the §8 Today affordance;
progress-ring `+N`; partner / reflection / email copy; aggregate + per-goal
calendar evidence treatment.

**PR 3 — docs.** Fold shipped reality into PRODUCT / DESIGN / smoke-checklist,
and add the §3 vocabulary to `docs/metrics-glossary.md`.
