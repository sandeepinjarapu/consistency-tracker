import { buildHeatmapCells, computeStats, computeWeeklyMet } from "./stats";
import { isoWeekStart } from "./dates";
import type { HeatmapCell } from "@/components/heatmap";

const MONTH_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * First-of-month on or after a date. Used to clamp the history window to
 * months that are *fully* covered by the fetched check-ins — never show a
 * month that would render under-filled because its early days weren't loaded.
 */
function firstFullMonthOnOrAfter(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (d === 1) return `${y}-${pad(m)}-01`;
  let ny = y;
  let nm = m + 1;
  if (nm > 12) { nm = 1; ny++; }
  return `${ny}-${pad(nm)}-01`;
}

export type Level = 0 | 1 | 2 | 3 | 4;

export type MonthData = {
  year: number;
  month: number; // 1–12
  label: string; // "June 2026"
  cells: HeatmapCell[];
  /**
   * 0–4 intensity, using the same thresholds as buildAggregateCells'
   * LEVEL_COLORS. Derived from the existing completion concepts — never a
   * new metric. `null` means "no completed period to score yet".
   */
  level: Level | null;
};

/** Same thresholds as LEVEL_COLORS / buildAggregateCells in stats.ts. */
function levelFromRate(r: number): Level {
  if (r <= 0) return 0;
  if (r < 0.34) return 1;
  if (r < 0.67) return 2;
  if (r < 1.0) return 3;
  return 4;
}

/** All [year, month] pairs from start to today, newest first. */
export function buildMonthList(
  start: string,
  today: string
): Array<[number, number]> {
  const [sy, sm] = start.split("-").map(Number);
  const [ty, tm] = today.split("-").map(Number);
  const months: Array<[number, number]> = [];
  let y = ty, m = tm;
  while (y > sy || (y === sy && m >= sm)) {
    months.push([y, m]);
    m--;
    if (m === 0) { m = 12; y--; }
  }
  return months; // newest first
}

/**
 * Specific-day month intensity. Days belong unambiguously to a calendar
 * month, so we reuse computeStats over the clamped month range directly —
 * its completionRate = done / (done + skipped + missed).
 */
function specificDayLevel(
  y: number,
  m: number,
  checkIns: Array<{ date: string; status: "done" | "skipped" }>,
  goalStartDate: string,
  targetDays: number[],
  today: string
): Level | null {
  const firstStr = `${y}-${pad(m)}-01`;
  const lastStr = `${y}-${pad(m)}-${pad(daysInMonth(y, m))}`;
  const rangeStart = firstStr < goalStartDate ? goalStartDate : firstStr;
  const rangeEnd = lastStr > today ? today : lastStr;
  if (rangeStart > rangeEnd) return null;

  const stats = computeStats({
    startDate: rangeStart,
    endDate: rangeEnd,
    targetDays,
    checkIns,
  });
  // No scheduled, resolved days in this slice → nothing to score.
  if (stats.doneCount + stats.skippedCount + stats.missedCount === 0) return null;
  return levelFromRate(stats.completionRate);
}

/**
 * Frequency (count-goal) month intensity.
 *
 * ISO weeks don't slice cleanly into calendar months, so we attribute each
 * week to the month of its Monday (isoWeekStart) and score the month as
 * weeksMet / weeksElapsed over the weeks that *start* in it — the same
 * met/elapsed definition computeWeeklyCountStats uses.
 *
 * Crucially, `weeks` is computed once over the whole goal with endDate=today,
 * so the only "current" (in-progress) week is the one containing today. A
 * historical month's final week is a completed week here, never wrongly
 * excluded as "current".
 */
function frequencyLevel(
  y: number,
  m: number,
  weeks: ReturnType<typeof computeWeeklyMet>,
  currentWeekStart: string
): Level | null {
  let elapsed = 0;
  let met = 0;
  for (const w of weeks) {
    if (w.partial || w.weekStart === currentWeekStart) continue; // grace weeks
    const [wy, wm] = w.weekStart.split("-").map(Number);
    if (wy !== y || wm !== m) continue;
    elapsed++;
    if (w.met) met++;
  }
  if (elapsed === 0) return null;
  return levelFromRate(met / elapsed);
}

/**
 * Build per-month data for the resolution-levels history view. All scoring
 * delegates to computeStats / computeWeeklyMet — no new completion or
 * intensity concepts.
 *
 * - Recent months (up to 2) are returned newest-first for the calendar grids.
 * - "Older history" (everything past month 2) is returned only when the goal
 *   spans more than 2 distinct calendar months.
 * - The window is clamped to `historyStart` (the earliest fetched check-in
 *   date): months before the first *fully fetched* month are dropped so we
 *   never render a month as empty just because its data wasn't loaded.
 */
export function buildMonthHistory({
  checkIns,
  goalStartDate,
  targetDays,
  weeklyTarget,
  today,
  historyStart,
}: {
  checkIns: Array<{ date: string; status: "done" | "skipped" }>;
  goalStartDate: string;
  targetDays: number[];
  weeklyTarget: number | null | undefined;
  today: string;
  /** Earliest date the caller fetched check-ins for. */
  historyStart: string;
}): { recentMonths: MonthData[]; olderMonths: MonthData[] } {
  // Clamp the goal's own start up to the first fully-fetched month, so older
  // months never render under-filled (or empty) from un-fetched data.
  const windowFloor = firstFullMonthOnOrAfter(historyStart);
  const effectiveStart =
    goalStartDate > windowFloor ? goalStartDate : windowFloor;

  const monthList = buildMonthList(effectiveStart, today);

  const isCount = weeklyTarget != null;
  const weeks = isCount
    ? computeWeeklyMet({
        startDate: goalStartDate,
        endDate: today,
        targetDays,
        checkIns,
        weeklyTarget,
      })
    : [];
  const currentWeekStart = isoWeekStart(today);

  const allData: MonthData[] = monthList.map(([y, m]) => {
    const firstStr = `${y}-${pad(m)}-01`;
    const lastStr = `${y}-${pad(m)}-${pad(daysInMonth(y, m))}`;

    const cells = buildHeatmapCells({
      startDate: firstStr,
      endDate: lastStr,
      targetDays,
      checkIns,
      goalStartDate,
      todayStr: today,
      weeklyTarget,
    });

    const level = isCount
      ? frequencyLevel(y, m, weeks, currentWeekStart)
      : specificDayLevel(y, m, checkIns, goalStartDate, targetDays, today);

    return { year: y, month: m, label: `${MONTH_FULL[m - 1]} ${y}`, cells, level };
  });

  const hasOlder = allData.length > 2;
  return {
    recentMonths: allData.slice(0, Math.min(2, allData.length)),
    olderMonths: hasOlder ? allData.slice(2) : [],
  };
}
