import { addDays, dayOfWeekForDateString } from "./dates";
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
};

/**
 * Compute streak + counts for a goal over [startDate, endDate].
 *
 * Conventions:
 * - Both "done" and "skipped" preserve a streak (skipped = legitimate reason)
 * - "missed" (target day past with no check-in) breaks a streak
 * - Today, if pending (target day with no check-in), is neither counted as
 *   missed nor breaks the current streak
 */
export function computeStats({
  startDate,
  endDate,
  targetDays,
  checkIns,
}: {
  startDate: string;
  endDate: string;
  targetDays: number[];
  checkIns: RawCheckIn[];
}): GoalStats {
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
        running++;
        if (running > longest) longest = running;
      } else if (cursor !== endDate) {
        missedCount++;
        running = 0;
      }
      // today with no status: pending, ignore
    }
    cursor = addDays(cursor, 1);
  }

  // Current streak: walk back from endDate
  let currentStreak = 0;
  let back = endDate;
  while (back >= startDate) {
    const dow = dayOfWeekForDateString(back);
    if (targetDays.includes(dow)) {
      const status = map.get(back);
      if (status === "done" || status === "skipped") {
        currentStreak++;
      } else if (back !== endDate) {
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
  goals: Array<{ id: string; target_days: number[]; created_at: string }>;
  checkIns: Array<{ goal_id: string; date: string; status: "done" | "skipped" }>;
}): HeatmapCell[] {
  const doneByDate = new Map<string, number>();
  for (const ci of checkIns) {
    if (ci.status === "done") {
      doneByDate.set(ci.date, (doneByDate.get(ci.date) ?? 0) + 1);
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
    const targetCount = goalStarts.reduce(
      (n, g) =>
        cursor >= g.startDate && g.target_days.includes(dow) ? n + 1 : n,
      0
    );
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
 * Build the per-goal heatmap cell array for a date range.
 */
export function buildHeatmapCells({
  startDate,
  endDate,
  targetDays,
  checkIns,
  goalStartDate,
  todayStr,
}: {
  startDate: string;
  endDate: string;
  targetDays: number[];
  checkIns: RawCheckIn[];
  goalStartDate: string;
  todayStr: string;
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
      else status = "missed";
    }
    cells.push({ date: cursor, status });
    cursor = addDays(cursor, 1);
  }
  return cells;
}
