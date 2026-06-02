import { addDays, dayOfWeekForDateString, isoWeekStart } from "./dates";
import type { HeatmapCell, CellStatus } from "@/components/heatmap";

type RawCheckIn = { date: string; status: "done" | "skipped" };

// GitHub-style intensity scale (used by aggregate heatmap)
const LEVEL_COLORS = [
  "#ebedf0", // 0 — no goals done
  "#9be9a8", // 1
  "#40c463", // 2
  "#30a14e", // 3
  "#216e39", // 4 — all goals done
];
const NO_TARGET_COLOR = "#f3f4f6"; // very light grey — no goals scheduled this day

export type GoalStats = {
  doneCount: number;
  skippedCount: number;
  missedCount: number;
  currentStreak: number;
  longestStreak: number;
  completionRate: number; // 0..1
  streakUnit: "day" | "week"; // "week" for count goals, "day" otherwise
  // Count-goal only — progress within the current ISO week.
  doneThisWeek?: number;
  weeklyTarget?: number;
};

/**
 * Compute streak + counts for a goal over [startDate, endDate].
 *
 * Streak conventions (a streak measures what you actually did):
 * - Only "done" days count toward and extend the streak
 * - Both "skipped" and "missed" break the streak (skipped is honest
 *   about a non-done day, but it's still not a done day)
 * - Today, if pending (target day with no check-in), is neither counted
 *   nor breaks the current streak — gives you until midnight to mark done
 *
 * Skip-with-reason is still valuable: it surfaces on weekly reflections
 * as context for *why* the streak broke. But it doesn't pad the number.
 */
export function computeStats({
  startDate,
  endDate,
  targetDays,
  checkIns,
  weeklyTarget,
}: {
  startDate: string;
  endDate: string;
  targetDays: number[];
  checkIns: RawCheckIn[];
  weeklyTarget?: number | null;
}): GoalStats {
  if (weeklyTarget != null) {
    return computeWeeklyCountStats({
      startDate,
      endDate,
      targetDays,
      checkIns,
      weeklyTarget,
    });
  }

  const map = new Map(checkIns.map((c) => [c.date, c.status]));

  let doneCount = 0;
  let skippedCount = 0;
  let missedCount = 0;
  let longest = 0;
  let running = 0;

  let cursor = startDate;
  while (cursor <= endDate) {
    const dow = dayOfWeekForDateString(cursor);
    if (targetDays.includes(dow)) {
      const status = map.get(cursor);
      if (status === "done") {
        doneCount++;
        running++;
        if (running > longest) longest = running;
      } else if (status === "skipped") {
        skippedCount++;
        running = 0;
      } else if (cursor !== endDate) {
        missedCount++;
        running = 0;
      }
      // today with no status: pending, neither counts nor resets
    }
    cursor = addDays(cursor, 1);
  }

  // Current streak: walk back from endDate. Only "done" extends it.
  let currentStreak = 0;
  let back = endDate;
  while (back >= startDate) {
    const dow = dayOfWeekForDateString(back);
    if (targetDays.includes(dow)) {
      const status = map.get(back);
      if (status === "done") {
        currentStreak++;
      } else if (back === endDate && status === undefined) {
        // today still pending — don't break, don't count
      } else {
        break;
      }
    }
    back = addDays(back, -1);
  }

  const total = doneCount + skippedCount + missedCount;
  const completionRate = total > 0 ? doneCount / total : 0;

  return {
    doneCount,
    skippedCount,
    missedCount,
    currentStreak,
    longestStreak: longest,
    completionRate,
    streakUnit: "day",
  };
}

export type WeekMet = {
  weekStart: string; // ISO Monday
  done: number; // done check-ins on eligible days that week
  met: boolean; // done >= weeklyTarget
  partial: boolean; // goal didn't exist for the whole week (first stub week)
  current: boolean; // the in-progress week containing endDate
};

/**
 * Per-ISO-week met status for a count goal, oldest → newest. Used by both
 * the weekly stats below and the weekly-met strip on goal pages.
 *
 * A week is "partial" when the goal was created after that week's Monday —
 * it never had a fair shot at the full quota, so callers treat it as grace.
 */
export function computeWeeklyMet({
  startDate,
  endDate,
  targetDays,
  checkIns,
  weeklyTarget,
}: {
  startDate: string;
  endDate: string;
  targetDays: number[];
  checkIns: RawCheckIn[];
  weeklyTarget: number;
}): WeekMet[] {
  const doneByWeek = new Map<string, number>();
  for (const c of checkIns) {
    if (c.status !== "done") continue;
    if (c.date < startDate || c.date > endDate) continue;
    if (!targetDays.includes(dayOfWeekForDateString(c.date))) continue;
    const ws = isoWeekStart(c.date);
    doneByWeek.set(ws, (doneByWeek.get(ws) ?? 0) + 1);
  }

  const firstWeekStart = isoWeekStart(startDate);
  const currentWeekStart = isoWeekStart(endDate);
  const weeks: WeekMet[] = [];
  for (let ws = firstWeekStart; ws <= currentWeekStart; ws = addDays(ws, 7)) {
    const done = doneByWeek.get(ws) ?? 0;
    weeks.push({
      weekStart: ws,
      done,
      met: done >= weeklyTarget,
      partial: startDate > ws, // created after this week's Monday
      current: ws === currentWeekStart,
    });
  }
  return weeks;
}

/**
 * Count-goal stats: streak + completion measured in ISO weeks instead of
 * days. A week is "met" when done check-ins on eligible days reach
 * weeklyTarget. A met week always extends the streak; a non-met week only
 * breaks it (and counts toward completion) if it's a *full, completed*
 * week — the partial first week and the in-progress current week are grace.
 */
function computeWeeklyCountStats({
  startDate,
  endDate,
  targetDays,
  checkIns,
  weeklyTarget,
}: {
  startDate: string;
  endDate: string;
  targetDays: number[];
  checkIns: RawCheckIn[];
  weeklyTarget: number;
}): GoalStats {
  let doneCount = 0;
  let skippedCount = 0;
  for (const c of checkIns) {
    if (c.date < startDate || c.date > endDate) continue;
    if (!targetDays.includes(dayOfWeekForDateString(c.date))) continue;
    if (c.status === "done") doneCount++;
    else if (c.status === "skipped") skippedCount++;
  }

  const weeks = computeWeeklyMet({
    startDate,
    endDate,
    targetDays,
    checkIns,
    weeklyTarget,
  });

  let running = 0;
  let longestStreak = 0;
  let weeksElapsed = 0;
  let weeksMet = 0;
  for (const w of weeks) {
    const counts = !w.current && !w.partial; // a full, completed week
    if (w.met) {
      running++;
      if (running > longestStreak) longestStreak = running;
    } else if (counts) {
      running = 0;
    }
    if (counts) {
      weeksElapsed++;
      if (w.met) weeksMet++;
    }
  }

  // Current streak: newest → oldest. Met weeks extend it; grace weeks
  // (partial first / in-progress current) are skipped; the first full,
  // completed miss stops it.
  let currentStreak = 0;
  for (let i = weeks.length - 1; i >= 0; i--) {
    const w = weeks[i];
    if (w.met) currentStreak++;
    else if (w.current || w.partial) continue;
    else break;
  }

  const doneThisWeek = weeks[weeks.length - 1]?.done ?? 0;
  const completionRate =
    weeksElapsed > 0
      ? weeksMet / weeksElapsed
      : Math.min(doneThisWeek / weeklyTarget, 1);

  return {
    doneCount,
    skippedCount,
    missedCount: 0,
    currentStreak,
    longestStreak,
    completionRate,
    streakUnit: "week",
    doneThisWeek,
    weeklyTarget,
  };
}

/**
 * Build aggregate heatmap cells across multiple goals. Each cell's intensity
 * reflects the fraction of goals done that day.
 */
export function buildAggregateCells({
  startDate,
  endDate,
  todayStr,
  goals,
  checkIns,
}: {
  startDate: string;
  endDate: string;
  todayStr: string;
  goals: Array<{
    id: string;
    target_days: number[];
    created_at: string;
    weekly_target?: number | null;
  }>;
  checkIns: Array<{ goal_id: string; date: string; status: "done" | "skipped" }>;
}): HeatmapCell[] {
  const doneByDate = new Map<string, number>();
  const doneByGoalDate = new Set<string>();
  for (const ci of checkIns) {
    if (ci.status === "done") {
      doneByDate.set(ci.date, (doneByDate.get(ci.date) ?? 0) + 1);
      doneByGoalDate.add(`${ci.goal_id}:${ci.date}`);
    }
  }

  const goalStarts = goals.map((g) => ({
    ...g,
    startDate: g.created_at.slice(0, 10),
  }));

  const cells: HeatmapCell[] = [];
  let cursor = startDate;
  while (cursor <= endDate) {
    const dow = dayOfWeekForDateString(cursor);
    // Specific-day goals count toward a day's denominator on their target
    // days. Count goals have no mandatory day, so they only count on days
    // they were actually done — they never drag a day toward "missed".
    const targetCount = goalStarts.reduce((n, g) => {
      if (cursor < g.startDate) return n;
      if (g.weekly_target != null) {
        return doneByGoalDate.has(`${g.id}:${cursor}`) ? n + 1 : n;
      }
      return g.target_days.includes(dow) ? n + 1 : n;
    }, 0);
    const done = doneByDate.get(cursor) ?? 0;

    let color: string;
    let tooltip: string;
    if (cursor > todayStr || targetCount === 0) {
      color = NO_TARGET_COLOR;
      tooltip = `${formatDate(cursor)} · No goals scheduled`;
    } else {
      const ratio = targetCount > 0 ? done / targetCount : 0;
      const level =
        ratio === 0 ? 0 :
        ratio < 0.34 ? 1 :
        ratio < 0.67 ? 2 :
        ratio < 1 ? 3 : 4;
      color = LEVEL_COLORS[level];
      tooltip =
        cursor === todayStr && done === 0
          ? `${formatDate(cursor)} · ${done} of ${targetCount} done — keep going`
          : `${formatDate(cursor)} · ${done} of ${targetCount} done`;
    }
    cells.push({ date: cursor, status: "empty", color, tooltip });
    cursor = addDays(cursor, 1);
  }
  return cells;
}

function formatDate(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Aggregate time-of-day pattern from check-ins. Returns:
 *  - typical: median time as { hour, minute } (null if nothing counted)
 *  - hourly: 24-element array of counts per local hour
 *  - total: number of check-ins counted
 *
 * Only check-ins logged **live** — where the row's `createdAt` falls on the
 * same local day as the activity `date` — are counted. A backfill (logged on
 * a later day) or an undo-then-recheck on a different day carries a
 * `createdAt` that reflects when the row was written, not when the habit was
 * done, so it would distort "typical time"; those are skipped.
 *
 * Median is computed on minutes-since-local-midnight. Robust to outliers,
 * and doesn't try to handle the midnight discontinuity (a habit you do at
 * 11:50pm vs 12:10am will skew, but that's a rare case for typical users).
 */
export function computeTimePattern({
  entries,
  timezone,
}: {
  entries: { createdAt: string; date: string }[];
  timezone: string;
}): {
  typical: { hour: number; minute: number } | null;
  hourly: number[];
  total: number;
} {
  const hourly = new Array(24).fill(0);
  const minutes: number[] = [];
  for (const { createdAt, date } of entries) {
    // Skip non-live check-ins (backfills, later re-checks) — see doc above.
    const localDate = new Date(createdAt).toLocaleDateString("en-CA", {
      timeZone: timezone,
    });
    if (localDate !== date) continue;

    const local = new Date(createdAt).toLocaleString("en-CA", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    // en-CA with hour12:false renders midnight as "24:30" in some engines
    // instead of "00:30". Normalize 24 → 0 so it lands in hourly[0]
    // (otherwise the array gets a hidden 25th slot and the typical-time
    // card renders 12:xxam as 12:xxpm).
    const [hRaw, m] = local.split(":").map(Number);
    const h = hRaw === 24 ? 0 : hRaw;
    if (Number.isFinite(h) && Number.isFinite(m) && h >= 0 && h <= 23) {
      hourly[h]++;
      minutes.push(h * 60 + m);
    }
  }
  if (minutes.length === 0) {
    return { typical: null, hourly, total: 0 };
  }
  minutes.sort((a, b) => a - b);
  const median = minutes[Math.floor(minutes.length / 2)];
  return {
    typical: { hour: Math.floor(median / 60), minute: median % 60 },
    hourly,
    total: minutes.length,
  };
}

/**
 * Build the per-goal heatmap cell array for a date range.
 */
export function buildHeatmapCells({
  startDate,
  endDate,
  targetDays,
  checkIns,
  goalStartDate,
  todayStr,
  weeklyTarget,
}: {
  startDate: string;
  endDate: string;
  targetDays: number[];
  checkIns: RawCheckIn[];
  goalStartDate: string;
  todayStr: string;
  weeklyTarget?: number | null;
}): HeatmapCell[] {
  const map = new Map(checkIns.map((c) => [c.date, c.status]));
  const cells: HeatmapCell[] = [];
  let cursor = startDate;
  while (cursor <= endDate) {
    const dow = dayOfWeekForDateString(cursor);
    let status: CellStatus;
    if (cursor > todayStr || cursor < goalStartDate || !targetDays.includes(dow)) {
      status = "empty";
    } else {
      const ci = map.get(cursor);
      if (ci === "done") status = "done";
      else if (ci === "skipped") status = "skipped";
      else if (cursor === todayStr) status = "empty"; // today pending
      else if (weeklyTarget != null) status = "empty"; // count goal: a gap isn't a miss
      else status = "missed";
    }
    cells.push({ date: cursor, status });
    cursor = addDays(cursor, 1);
  }
  return cells;
}
