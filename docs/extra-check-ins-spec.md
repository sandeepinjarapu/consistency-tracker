# Extra check-ins — spec (draft)

Status: **draft for review.** Product decisions below are marked
**Proposed** and are not final. No code is written until they're confirmed.

## Why

Two moments the tracker is currently silent — or worse, dismissive — about:

- **Specific-day goal, you show up on an unscheduled day.** Run on a Tuesday
  when your goal is Mon / Wed / Fri. Today the app refuses the check-in: the
  day isn't tappable and any tampered request is rejected server-side.
- **Frequency goal, you exceed the count.** A 4th session in a "3× a week"
  week. The work registers, but it reads as a flat `4 of 3` with no warmth.

The product's stance is "evidence of showing up, not grades," and "a missed day
is never a failure." The mirror image is true too: doing *more* than you
promised should feel good, not be invisible or read like an error. This is
about being graceful to the user **on both ends** — catch up when you fall
behind, and feel seen when you go beyond.

## What "extra" means (precisely)

There is no new kind of check-in. A check-in is still one row per
`(goal, date)` (unique constraint, schema line ~73). An **extra** is an
ordinary `done` check-in whose date is, *relative to the goal's current
cadence*, one of:

1. **Off-window** — the weekday isn't in `target_days` (specific-day goal run
   on an unscheduled day; or frequency goal done outside its eligible window).
2. **Over-quota** — a frequency goal's done count for the ISO week already
   meets `weekly_target`, and this is one more.

"Extra" is therefore **derived, never stored** (see Decision 2).

## The one finding that de-risks this

Every scoring and rendering helper already filters by
`target_days.includes(dayOfWeekForDateString(date))`:

| Helper | File | Effect on an off-window day |
|---|---|---|
| `computeStats` (specific) | `stats.ts` | not counted; streak/rate untouched |
| `computeWeeklyMet` / count stats | `stats.ts` | not counted toward quota |
| `buildHeatmapCells` / `buildWeekRows` | `stats.ts`, `week-rows.ts` | rendered as empty / `rest` |
| `reflection-stats` | `reflection-stats.ts` | `no-target` day, excluded |
| `weekly-summary` (email) | `weekly-summary.ts` | excluded from count goals' tally |
| `isBackfillable` (the gate) | `heatmap-backfill.ts` | **refuses to create it** |

So extras are **excluded from grades by construction.** We do not have to
"protect" streaks and completion from inflation — the default already protects
them. The feature is mostly about *un-hiding* effort the math is designed to
ignore, in a way that adds joy without ever feeding the score.

**Founding principle (Proposed):** an extra check-in **never changes a streak,
completion rate, weekly-met status, or any percentage.** It is celebrated, not
scored. This keeps "the metric calculation" — the part flagged as tricky —
genuinely untouched.

## The seams (where code would change)

Minimal, contained list. Each traces directly to letting an extra be *logged*
and *seen*, with scoring left alone.

1. **`isBackfillable` / `assertBackfillable`** (`heatmap-backfill.ts`,
   `actions/check-ins.ts`) — line 34 (`!targetDays.includes(...) → false`) is
   the gate. It is shared by the UI affordance and the server guard, by
   design. Relaxing it must keep the **time-window** half intact (still current
   ISO week + 2-day grace, never the future, never before the goal existed) and
   only open the **weekday** half — ideally via an explicit "log an extra" path,
   not by making every off-day cell behave like a scheduled one.
2. **`buildWeekRows`** (`week-rows.ts`) — an off-window date currently becomes a
   `rest` cell that ignores `statusByDate` (lines 99–101). A new `extra` cell
   state would let a logged extra appear in the week grid, visually distinct
   from both a scheduled `done` and a neutral `rest`.
3. **Display of over-quota for frequency goals** — `computeWeekStatus` headline
   is `${doneThisWeek} of ${total}` → `4 of 3` today. Decide the treatment
   (Decision 3). The progress ring's behaviour above 100% should be checked.
4. **Downstream surfaces** — partner view, reflection narrative, weekly email
   (Decisions 4–6). Note a **latent asymmetry**: in `weekly-summary.ts` a
   *specific-day* goal's `done` is counted with no `target_days` filter (line
   ~66) while its `target` counts only scheduled days, so once extras exist the
   email could read `6 done / 5 target` unless we address it.

## Open decisions

Each is a product call. **Proposed** is a recommendation, not a commitment.

### 1. Name
What we call it in the UI. **Proposed: "Extra"** (quiet, factual). Avoid
"Bonus" — it leans toward points/rewards, which the brand explicitly
anti-references (badges, XP). Consider also a label-free treatment (just a
distinct cell + a tooltip) so we add no vocabulary at all.

### 2. Derived vs stored
**Proposed: derived, no DB column.** "Extra-ness" is a function of a check-in's
date against the goal's *current* `target_days` / `weekly_target`. A stored
`bonus boolean` would go stale the moment a user edits cadence (past weeks
re-score under the new cadence — existing behaviour). Deriving it is both
simpler and correct. This is an engineering call grounded in the re-score rule;
flagging it only so it's on the record.

### 3. Frequency over-quota display
How the 4th done in a 3× week reads. Options: (a) plain `4 of 3`;
(b) `3 of 3 met · +1`; (c) ring fills to complete, with a small "+1" beside it.
**Proposed: (b)/(c)** — the headline lands on "met" (the promise kept), and the
extra is a small, warm addendum, never a number that overshoots the goal.

### 4. Partner visibility
Whether a partner sees your extras. Options: (a) shown, marked as extra;
(b) never shown (extras are private joy only); (c) folded silently into the
"M check-ins logged" tally with no special marker. **Proposed: (a)** — a
partner seeing "they went beyond" is exactly the warm, low-pressure signal the
partner feature exists for. Privacy is unchanged: only already-shared goals
expose anything.

### 5. Reflection narrative
Whether the weekly reflection recap mentions extras. **Proposed: yes, as a
gentle aside** ("plus 2 extra days this week"), with reflection **scoring**
(completion %) left exactly as-is. Notice, don't grade.

### 6. Weekly email wording
Whether the Monday summary counts/mentions extras, and how we resolve the
asymmetry in seam 4. **Proposed:** keep the email a *scoring* surface — report
quota/target as today — but optionally append a short "+N extra" note, and fix
the specific-day `done` tally so the headline number can't exceed target
unexpectedly.

## Out of scope (explicitly not doing)

- No reintroduction of click-to-edit on the calendar history. The history stays
  read-only; extras are logged through the "This week" surface / an explicit
  control, same as ordinary check-ins.
- No new `bonus`/`extra` column or migration (Decision 2).
- No change to streak, completion-rate, or weekly-met math (founding principle).
- No "skipped extra" concept — an extra is a `done`. Skips remain scheduled-day
  only.
- No backfilling extras outside the existing editable time window.

## Success criteria

1. On a Mon/Wed/Fri goal, you can log a Tuesday and see it as a clearly-marked
   **extra**; the streak and completion rate are **unchanged** by it.
2. On a 3× goal, a 4th done reads as "met + extra," not as an error or `4 of 3`.
3. Removing an extra is as easy as removing any current-week check-in.
4. A day outside the editable time window still can't be logged at all
   (extra or otherwise) — the grace window is unchanged.
5. Every existing unit test in `stats.test.ts`, `week-rows.test.ts`,
   `goal-week-status.test.ts`, `reflection-stats.test.ts`,
   `weekly-summary.test.ts`, and `heatmap-backfill.test.ts` still passes;
   new tests cover the extra-derivation and the relaxed gate.
6. Partner / reflection / email behaviour matches Decisions 4–6.

## Suggested phasing

1. **Decisions** (this doc) — confirm 1–6.
2. **Logic + tests** — derive "extra," relax the weekday half of the gate,
   teach `buildWeekRows` an `extra` state. Pure, unit-tested, no UI yet.
3. **Owner UI** — log/remove an extra from the goal page; over-quota treatment.
4. **Surfaces** — partner view, reflection aside, email note (per Decisions).
5. **Docs** — fold the shipped reality back into PRODUCT / DESIGN / smoke /
   metrics-glossary, same as the contract-refresh pass.
