import { addDays, isoWeekStart } from "./dates";
import { classifyWeek } from "./extra-check-ins";

export type WeekRingState =
  | "not-started" // week ended before the goal existed
  | "empty"       // goal active, no check-ins at all
  | "skipped"     // goal active, only skips recorded (no done, no extras)
  | "partial"     // scoredDone > 0 OR extraDone > 0 (but target not fully met)
  | "met"         // completionRate === 1, no extras
  | "extra";      // completionRate === 1, extraDone > 0

export type WeekRing = {
  weekStart: string;
  state: WeekRingState;
  /** 0–1. Arc length for partial/met/extra rings. */
  completionRate: number;
  /** Non-zero when extraDone > 0; used by the component for min-arc on extra-only weeks. */
  extraDone: number;
  tooltip: string;
};

/** Number of completed ISO weeks shown per goal row. */
export const RING_WEEK_COUNT = 6;

/**
 * Builds the mini-ring data for one goal row in the Goals list.
 *
 * Returns `weekCount` rings, oldest to newest, each representing one
 * completed ISO week (Monday–Sunday) that ended before the current week.
 * The in-progress current week is always excluded.
 *
 * States:
 *   not-started  week ended before goalStartDate
 *   empty        goal was active; no done or skipped check-ins
 *   skipped      only skips recorded; no done or extras (conscious absence)
 *   partial      scoredDone > 0 OR extraDone > 0; target not fully met
 *   met          completionRate === 1, no extras
 *   extra        completionRate === 1, extraDone > 0
 *
 * Pass all `done`-status dates as `doneDates` and all `skipped`-status dates
 * as `skipDates`. Both are needed so skip-only weeks are not misread as empty.
 */
export function buildWeekRings({
  goalStartDate,
  targetDays,
  weeklyTarget,
  doneDates,
  skipDates,
  today,
  weekCount = RING_WEEK_COUNT,
}: {
  goalStartDate: string;
  targetDays: number[];
  weeklyTarget: number | null;
  /** All `done`-status check-in dates for this goal within the fetch window. */
  doneDates: string[];
  /** All `skipped`-status check-in dates for this goal within the fetch window. */
  skipDates: string[];
  /** Today in the user's timezone (YYYY-MM-DD). */
  today: string;
  weekCount?: number;
}): WeekRing[] {
  const currentWeekStart = isoWeekStart(today);
  const rings: WeekRing[] = [];

  for (let i = weekCount; i >= 1; i--) {
    const weekStart = addDays(currentWeekStart, -7 * i);
    const weekEnd = addDays(weekStart, 6);

    // Entire week predates the goal.
    if (weekEnd < goalStartDate) {
      rings.push({
        weekStart,
        state: "not-started",
        completionRate: 0,
        extraDone: 0,
        tooltip: "Before goal started",
      });
      continue;
    }

    const datesThisWeek = doneDates.filter((d) => d >= weekStart && d <= weekEnd);
    const { scoredDone, extraDone, completionRate } = classifyWeek({
      weekStart,
      goalStartDate,
      targetDays,
      weeklyTarget,
      doneDates: datesThisWeek,
    });

    const skipsThisWeek = skipDates.filter((d) => d >= weekStart && d <= weekEnd).length;

    let state: WeekRingState;
    if (completionRate >= 1 && extraDone > 0) {
      state = "extra";
    } else if (completionRate >= 1) {
      state = "met";
    } else if (scoredDone > 0 || extraDone > 0) {
      // Extra-only weeks (scoredDone=0, extraDone>0) are still evidence of
      // engagement and must not look like empty.
      state = "partial";
    } else if (skipsThisWeek > 0) {
      // Conscious recorded absence — not the same as ignoring the goal.
      state = "skipped";
    } else {
      state = "empty";
    }

    rings.push({
      weekStart,
      state,
      completionRate,
      extraDone,
      tooltip: buildTooltip(state, weekStart, scoredDone, extraDone, completionRate),
    });
  }

  return rings;
}

function formatWeekLabel(weekStart: string): string {
  const [y, m, d] = weekStart.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function buildTooltip(
  state: WeekRingState,
  weekStart: string,
  scoredDone: number,
  extraDone: number,
  completionRate: number
): string {
  const label = formatWeekLabel(weekStart);
  const prefix = `Week of ${label}`;
  switch (state) {
    case "not-started":
      return "Before goal started";
    case "empty":
      return `${prefix} · No check-ins`;
    case "skipped":
      return `${prefix} · Skipped`;
    case "met":
      return `${prefix} · Met target`;
    case "extra":
      return `${prefix} · Met target · ${extraDone} extra`;
    case "partial":
      // Extra-only: scoredDone=0 but extraDone>0
      if (scoredDone === 0 && extraDone > 0) {
        return `${prefix} · ${extraDone} extra check-in${extraDone > 1 ? "s" : ""} only`;
      }
      return `${prefix} · ${Math.round(completionRate * 100)}% done`;
  }
}
