# Metrics glossary (internal)

Several surfaces show a "completion"-like number. They intentionally answer
**different questions**, so don't compare them directly or "unify" them without
reading this first. Each has one source of truth.

| Name | Source of truth | Scope / window | Formula | Surfaces |
|------|-----------------|----------------|---------|----------|
| **goalCompletionRate** | `computeStats` → `GoalStats.completionRate` (`stats.ts`) | one goal, ~1 year (or goal lifetime) | specific: `done/(done+skipped+missed)`; count: `weeksMet/weeksElapsed` (full weeks only) | Dashboard, Goal detail, Partner |
| **reflectionCompletionRate** | `reflectionCompletionRate(stats)` (`reflection-stats.ts`) | all goals, **one ISO week** | `sum(min(done, target)) / sum(target)`, target = each goal's `targetCount` (count goal target = weekly quota) | Reflections (completed weeks only) |
| **thisWeekProgress** | `computeWeekStatus` (`goal-week-status.ts`) | one goal, **current week** | headline `done of total` (total = scheduled days this week / weekly quota; includes upcoming days) | Goal detail hero |
| **weeklySummaryTarget** | `computeWeeklyGoalStats` (`weekly-summary.ts`) | one goal, one Mon–Sun | raw `done / target / skipped` (specific target = eligible days; count target = weekly quota) | Weekly email |

## Rules of thumb

- **Skips and count goals.** A count goal is scored against its weekly *quota*,
  so extra skipped days must NOT enter the denominator. `goalCompletionRate`
  (weeks-met) and `reflectionCompletionRate` (`min(done, quota)/quota`) both
  honor this. The old Reflections `done/(done+skipped+missed)` did not — that
  was the bug fixed alongside this doc.
- **The in-progress week shows no completion %.** A mid-week grade ("40% on
  Wednesday") reads as a verdict before the week is over. The current-week
  Reflections hero shows evidence of showing up (done / skipped / missed) and a
  narrative instead. Only completed weeks get `reflectionCompletionRate`.
- **`thisWeekProgress` is a progress fraction, not completion.** Its `total`
  includes upcoming days, so never relabel "X of Y" as "Y%".
- **Pending today / future days** are excluded from every denominator above.
- Any new "how's it going" number should reuse one of these, or be added here
  with its own name and scope. Golden assertions live in
  `src/lib/metrics-consistency.test.ts`.
