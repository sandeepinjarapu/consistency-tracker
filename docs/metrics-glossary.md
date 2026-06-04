# Metrics glossary (internal)

Several surfaces show a "progress"-like number. They intentionally answer
**different questions**, so don't compare them directly or "unify" them without
reading this first. Each has one source of truth.

| Name | Source of truth | Scope / window | Formula | Surfaces |
|------|-----------------|----------------|---------|----------|
| **goalCompletionRate** | `computeStats` → `GoalStats.completionRate` (`stats.ts`) | one goal, ~1 year (or goal lifetime) | specific: `done/(done+skipped+missed)`; count: `weeksMet/weeksElapsed` (full weeks only) | **Not shown as a %.** The function still computes streak / done-count, which the Partner page renders as `N-day streak · M check-ins logged`. |
| **reflectionCompletionRate** | `reflectionCompletionRate(stats)` (`reflection-stats.ts`) | all goals, **one ISO week** | `sum(min(done, target)) / sum(target)`, target = each goal's `targetCount` (count goal target = weekly quota) | Reflections — **completed weeks only** |
| **thisWeekProgress** | `computeWeekStatus` (`goal-week-status.ts`) | one goal, **current week** | headline `done of total` (total = scheduled days this week / weekly quota; **includes upcoming days**) | Goal detail hero |
| **weeklySummaryTarget** | `computeWeeklyGoalStats` (`weekly-summary.ts`) | one goal, one Mon–Sun | raw `done / target` (+ a week-scoped `%`); specific target = eligible days, count target = weekly quota | Weekly email (`3 / 5 this week · 60%`) |

## Rules of thumb

- **No grades where the job is to notice, not score.** The Partner surface and
  the Today/Goals list show streaks and check-in counts, never a completion %.
  Only Reflections (completed weeks) and the weekly email show a percentage,
  and the email's % is explicitly week-scoped.
- **Skips and count goals.** A count goal is scored against its weekly *quota*,
  so extra skipped days must NOT enter the denominator. `goalCompletionRate`
  (weeks-met) and `reflectionCompletionRate` (`min(done, quota)/quota`) both
  honor this.
- **The in-progress week shows no completion %.** A mid-week grade reads as a
  verdict before the week is over. The current-week Reflections hero shows
  evidence of showing up (done / skipped / missed) and a narrative instead.
- **Count goals on the Reflections page:**
  - A count goal with **zero check-ins for a full week** is a *scoreable* week —
    it still surfaces (an unmet quota is worth reflecting on) and counts as 0%.
  - A count goal's **partial first week** (created mid-week) is **grace**:
    excluded from `reflectionCompletionRate` and from "is this week scoreable",
    matching how Goal/Partner stats and the weekly email treat it. Its
    check-ins still show as evidence. See `weekHasScoreableTarget`.
- **`thisWeekProgress` is a progress fraction, not completion.** Its `total`
  deliberately includes upcoming days, so never relabel "X of Y" as "Y%".
- **Pending today / future days** are excluded from the *completion*
  denominators (`goalCompletionRate`, `reflectionCompletionRate`,
  `weeklySummaryTarget`). The only number that counts upcoming days is
  `thisWeekProgress`, by design.
- Any new "how's it going" number should reuse one of these, or be added here
  with its own name and scope. Golden assertions live in
  `src/lib/metrics-consistency.test.ts`.
