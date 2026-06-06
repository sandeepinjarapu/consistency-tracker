import { buildHeatmapCells, computeStats } from "./stats";
import type { HeatmapCell } from "@/components/heatmap";

const MONTH_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function monthPad(n: number): string {
  return String(n).padStart(2, "0");
}

export type MonthData = {
  year: number;
  month: number; // 1–12
  label: string; // "June 2026"
  cells: HeatmapCell[];
  /**
   * 0–4 intensity level using the same thresholds as buildAggregateCells
   * LEVEL_COLORS (0=0%, 1=<34%, 2=<67%, 3=<100%, 4=100%) applied to
   * computeStats.completionRate — no new completion concept introduced.
   */
  level: 0 | 1 | 2 | 3 | 4;
};

/** All [year, month] pairs from goalStartDate to today, newest first. */
export function buildMonthList(
  goalStartDate: string,
  today: string
): Array<[number, number]> {
  const [sy, sm] = goalStartDate.split("-").map(Number);
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

function monthLevel(
  y: number,
  m: number,
  checkIns: Array<{ date: string; status: "done" | "skipped" }>,
  goalStartDate: string,
  targetDays: number[],
  weeklyTarget: number | null | undefined,
  today: string
): 0 | 1 | 2 | 3 | 4 {
  const firstStr = `${y}-${monthPad(m)}-01`;
  const lastStr = `${y}-${monthPad(m)}-${monthPad(daysInMonth(y, m))}`;
  // Clamp to goal range
  const rangeStart = firstStr < goalStartDate ? goalStartDate : firstStr;
  const rangeEnd = lastStr > today ? today : lastStr;
  if (rangeStart > rangeEnd) return 0;

  // Reuse computeStats — its completionRate is the single authoritative
  // completion concept in this codebase.
  const stats = computeStats({
    startDate: rangeStart,
    endDate: rangeEnd,
    targetDays,
    checkIns,
    weeklyTarget,
  });

  const r = stats.completionRate;
  // Same thresholds as LEVEL_COLORS in stats.ts/buildAggregateCells
  if (r === 0)    return 0;
  if (r < 0.34)   return 1;
  if (r < 0.67)   return 2;
  if (r < 1.0)    return 3;
  return 4;
}

/**
 * Build per-month data for the E history view. All computation delegates to
 * buildHeatmapCells + computeStats — no new completion or intensity concepts.
 *
 * Threshold rule: "Older history" section only appears when the goal spans
 * more than 2 distinct calendar months (months.length > 2).
 */
export function buildMonthHistory({
  checkIns,
  goalStartDate,
  targetDays,
  weeklyTarget,
  today,
}: {
  checkIns: Array<{ date: string; status: "done" | "skipped" }>;
  goalStartDate: string;
  targetDays: number[];
  weeklyTarget: number | null | undefined;
  today: string;
}): { recentMonths: MonthData[]; olderMonths: MonthData[] } {
  const monthList = buildMonthList(goalStartDate, today);

  const allData: MonthData[] = monthList.map(([y, m]) => {
    const firstStr = `${y}-${monthPad(m)}-01`;
    const lastStr = `${y}-${monthPad(m)}-${monthPad(daysInMonth(y, m))}`;

    const cells = buildHeatmapCells({
      startDate: firstStr,
      endDate: lastStr,
      targetDays,
      checkIns,
      goalStartDate,
      todayStr: today,
      weeklyTarget,
    });

    const level = monthLevel(
      y, m, checkIns, goalStartDate, targetDays, weeklyTarget, today
    );

    return { year: y, month: m, label: `${MONTH_FULL[m - 1]} ${y}`, cells, level };
  });

  const hasOlder = allData.length > 2;
  return {
    recentMonths: allData.slice(0, Math.min(2, allData.length)),
    olderMonths: hasOlder ? allData.slice(2) : [],
  };
}
