import { addDays, dayOfWeekForDateString } from "./dates";

/**
 * Whether a date's weekday falls outside the goal's eligible window
 * (`target_days`). A `done` on such a date is an "off-target extra" — an extra
 * day of showing up that is deliberately never scored. The single per-date test
 * shared by every surface that distinguishes scored check-ins from extras.
 */
export function isExtraDate(date: string, targetDays: number[]): boolean {
  return !targetDays.includes(dayOfWeekForDateString(date));
}

/**
 * The scored-vs-extra split for one ISO week of a single goal — the metric
 * vocabulary defined in docs/extra-check-ins-spec.md. Extras are *seen, not
 * scored*: any caller's headline, streak, completion %, or quota must use
 * `scoredDone` / `targetCount`, never `totalDone`.
 */
export type WeekExtras = {
  targetCount: number; // what was promised this week
  scoredDone: number; // done that counts toward the promise
  extraOffTarget: number; // done on non-eligible weekdays (identifiable per-date)
  extraOverQuota: number; // frequency only: eligible done beyond weekly_target
  extraDone: number; // extraOffTarget + extraOverQuota
  totalDone: number; // scoredDone + extraDone (every done that week)
  completionRate: number; // scoredDone / targetCount, capped at 1
};

/**
 * Split one ISO week's `done` check-ins into scored vs extra for a single goal.
 *
 * Specific-day goal (`weeklyTarget == null`):
 *   targetCount = eligible (scheduled, on/after start) days in the week
 *   scoredDone  = done on eligible days
 *   extra       = done on non-eligible days (off-target; no over-quota concept)
 *
 * Frequency goal (`weeklyTarget != null`):
 *   targetCount    = weeklyTarget
 *   scoredDone     = min(eligibleDone, weeklyTarget)
 *   extraOverQuota = max(0, eligibleDone − weeklyTarget)  // a weekly count,
 *                    never a tagged date
 *   extraOffTarget = done on non-eligible weekdays
 *
 * Pure. One row per (goal, date) is guaranteed by the schema, so `doneDates`
 * are distinct. "Extra-ness" is derived from the goal's *current* cadence, so a
 * cadence edit re-derives it for free (no stored flag to go stale).
 */
export function classifyWeek({
  weekStart,
  goalStartDate,
  targetDays,
  weeklyTarget,
  doneDates,
}: {
  weekStart: string; // ISO Monday
  goalStartDate: string; // goal creation date in the owner's timezone
  targetDays: number[];
  weeklyTarget: number | null;
  doneDates: string[]; // ISO dates with a `done` check-in this week
}): WeekExtras {
  const weekEnd = addDays(weekStart, 6);

  let eligibleDone = 0;
  let extraOffTarget = 0;
  for (const d of doneDates) {
    if (d < weekStart || d > weekEnd) continue;
    if (d < goalStartDate) continue; // before the goal existed
    if (isExtraDate(d, targetDays)) extraOffTarget++;
    else eligibleDone++;
  }

  let targetCount: number;
  let scoredDone: number;
  let extraOverQuota: number;
  if (weeklyTarget != null) {
    targetCount = weeklyTarget;
    scoredDone = Math.min(eligibleDone, weeklyTarget);
    extraOverQuota = Math.max(0, eligibleDone - weeklyTarget);
  } else {
    let t = 0;
    let cursor = weekStart;
    for (let i = 0; i < 7; i++) {
      if (cursor >= goalStartDate && targetDays.includes(dayOfWeekForDateString(cursor))) {
        t++;
      }
      cursor = addDays(cursor, 1);
    }
    targetCount = t;
    scoredDone = eligibleDone; // one done per eligible day, so always ≤ targetCount
    extraOverQuota = 0;
  }

  const extraDone = extraOffTarget + extraOverQuota;
  const totalDone = scoredDone + extraDone;
  const completionRate =
    targetCount > 0 ? Math.min(scoredDone / targetCount, 1) : 0;

  return {
    targetCount,
    scoredDone,
    extraOffTarget,
    extraOverQuota,
    extraDone,
    totalDone,
    completionRate,
  };
}
