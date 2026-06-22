# 0001 — Weekly-quota requiredness is entry-state, not same-day check-in

- Status: **accepted**
- Date: 2026-06-22
- PRs: #145 (original split), #146 (night-owl symmetry), #147 (entry-state fix)

## Decision

A weekly-quota goal ("N×/week, any day") is **required** on a logical day only
if the user **entered** that day under quota — `scoredDoneBeforeDay <
weeklyTarget`, counting done check-ins on eligible weekdays within the logical
day's own ISO week, strictly before that day.

If the quota was already met before the logical day, further `done` check-ins
are **over-quota extras** — optional evidence, never an obligation — even a
check-in logged on that same day.

Requiredness is the day's **entry** state. The day's own check-in is
display/status (renders a card as done, a chip as removable), owned by the
rendering surface, never an input to the requiredness decision.

## Why

Today must not demand an already-fulfilled promise. The product stance is
"evidence of showing up, not grades": extra effort is **seen, not scored**, so
surplus work must stay optional and must not inflate any obligation count.

## Consequences

- `4/5` entering the day + done today → **required, done card** (entry state
  was under quota, so it stays required and renders as completed).
- `5/5` entering the day + done today → **done over-quota chip**, not a
  required card. It must not flip surfaces on refresh.
- Over-quota eligible-day extras write through `markDone` / `unmark`, never
  `markExtraDone` (whose `isExtraLoggable` guard rejects eligible weekdays).
- The Today header denominator counts **required goals only**; over-quota done
  chips contribute to the "· N extra" suffix, not to "X of Y done".
- Night-owl (12–5 AM) applies the same rule keyed on yesterday, with quota
  counted against `isoWeekStart(yesterday)`.

## Superseded shortcut

`classifyGoalForLogicalDay` previously returned `required` whenever a check-in
existed on the logical day (`hasCheckInOnDay`). That conflated "completed the
quota today" with "logged surplus after the quota was already met," so a
tapped over-quota chip flipped into a required "1 of 1 done" card on refresh
and inflated the header denominator. The flag was removed in #147;
`scoredDoneBeforeDay` already excludes the day's own check-in, so a completing
check-in still classifies from its under-quota entry state.

## Tests

- `src/lib/today-required.test.ts` — classifier unit, incl. the surplus →
  `over_quota` regression.
- `src/lib/today-model.test.ts` — model-level state table, incl. the daytime
  surplus → done over-quota chip regression and the night-owl variants.

## Revisit when

Longer cadences (every-N-weeks / monthly / quarterly, roadmap item 9) land:
"quota met for the period" and the `scoredDoneBefore` window must generalize
beyond the ISO week. Re-examine `classifyGoalForLogicalDay` and
`scoredDoneBefore` then.
