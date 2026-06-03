import {
  addDays,
  daysBetween,
  isoWeekStart,
  dayOfWeekForDateString,
} from "@/lib/dates";

// A never-started goal stays "Just added" until it's this old, after which it
// becomes a gentle "want to start?" nudge instead of sitting silent.
const NEVER_STARTED_NUDGE_DAYS = 11; // ~1.5 weeks

export type GoalRowState = {
  /** Short right-column label. */
  metric: string;
  /** Optional gentle re-engagement nudge for the left subtitle. */
  nudge: { kind: "resume" | "start"; since: string } | null;
};

export type GoalRowInput = {
  currentStreak: number;
  streakUnit: "day" | "week";
  doneCount: number;
  targetDays: number[];
  weeklyTarget: number | null;
  /** Most recent "done" date (YYYY-MM-DD), or null if never done. */
  lastDone: string | null;
  /** Goal creation date (YYYY-MM-DD). */
  createdAt: string;
  today: string;
};

/**
 * Number of scheduled occurrences between `lastDone` (exclusive) and `today`.
 * Since `lastDone` is the most recent done, every scheduled slot after it is a
 * miss — so this is "how many times the goal came due and was skipped/missed".
 *  - count goals (weekly_target): the target count per fully-elapsed ISO week.
 *  - specific-day goals: the target weekdays falling after lastDone.
 */
function occurrencesSinceLastDone(
  lastDone: string,
  today: string,
  targetDays: number[],
  weeklyTarget: number | null
): number {
  if (weeklyTarget != null) {
    const weeks = Math.floor(
      daysBetween(isoWeekStart(lastDone), isoWeekStart(today)) / 7
    );
    return weeklyTarget * Math.max(0, weeks);
  }
  let count = 0;
  let cursor = addDays(lastDone, 1);
  while (cursor <= today) {
    if (targetDays.includes(dayOfWeekForDateString(cursor))) count++;
    cursor = addDays(cursor, 1);
  }
  return count;
}

/**
 * Decide the Today "All goals" row label + an optional calm nudge.
 *
 * metric: streak → "N done" → "Just added"/"Not started".
 * nudge:
 *   - "resume" once a goal with prior dones has missed a full cycle's worth of
 *     scheduled occurrences since its last done (cycle = weekly_target, else
 *     the number of scheduled weekdays).
 *   - "start" for a never-done goal older than ~1.5 weeks.
 */
export function computeGoalRowState(i: GoalRowInput): GoalRowState {
  const ageDays = daysBetween(i.createdAt.slice(0, 10), i.today);

  if (i.currentStreak > 0) {
    return { metric: `${i.currentStreak} ${i.streakUnit} streak`, nudge: null };
  }

  if (i.doneCount > 0) {
    let nudge: GoalRowState["nudge"] = null;
    if (i.lastDone) {
      const cycle = i.weeklyTarget ?? i.targetDays.length;
      const missed = occurrencesSinceLastDone(
        i.lastDone,
        i.today,
        i.targetDays,
        i.weeklyTarget
      );
      if (cycle > 0 && missed >= cycle) {
        nudge = { kind: "resume", since: i.lastDone };
      }
    }
    return { metric: `${i.doneCount} done`, nudge };
  }

  // Never done.
  if (ageDays >= NEVER_STARTED_NUDGE_DAYS) {
    return {
      metric: "Not started",
      nudge: { kind: "start", since: i.createdAt.slice(0, 10) },
    };
  }
  return { metric: "Just added", nudge: null };
}
