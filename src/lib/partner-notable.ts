import { addDays, dayOfWeekForDateString } from "./dates";

/**
 * A short, gentle "what's notable about this week" tag for a partner's goal —
 * so a reaction lands on a specific effort ("Back to it") rather than being a
 * blanket pat. Pure + tested. Returns null when nothing stands out.
 *
 * Priority is by how much the tag *adds* over the heatmap the partner already
 * sees: a new goal and a comeback aren't obvious from squares alone, so they
 * rank above "they hit it" (which the squares show).
 */
export type NotableGoal = {
  createdAt: string; // goal start (ISO date or timestamp)
  targetDays: number[];
  weeklyTarget: number | null;
};

type CheckIn = { date: string; status: "done" | "skipped" };

export function notableForWeek(
  goal: NotableGoal,
  checkIns: CheckIn[],
  weekStart: string,
  today: string
): string | null {
  const goalStart = goal.createdAt.slice(0, 10);
  const weekEnd = addDays(weekStart, 6);
  const isCount = goal.weeklyTarget != null;

  const doneInWeek = countDone(checkIns, weekStart, weekEnd);
  const donePrevWeek = countDone(
    checkIns,
    addDays(weekStart, -7),
    addDays(weekStart, -1)
  );
  const createdInWeek = goalStart >= weekStart && goalStart <= weekEnd;

  let met = false;
  if (isCount) {
    met = doneInWeek >= (goal.weeklyTarget as number);
  } else if (weekEnd < today) {
    // Specific-day "full week" is only knowable once the week has ended —
    // mid-week, days are still pending, not complete.
    let scheduled = 0;
    for (let d = 0; d < 7; d++) {
      const date = addDays(weekStart, d);
      if (date < goalStart) continue;
      if (goal.targetDays.includes(dayOfWeekForDateString(date))) scheduled++;
    }
    met = scheduled > 0 && doneInWeek >= scheduled;
  }

  if (createdInWeek) return "Just started";
  if (doneInWeek > 0 && donePrevWeek === 0) return "Back to it";
  if (met) return isCount ? "Target met" : "Full week";
  return null;
}

function countDone(checkIns: CheckIn[], start: string, end: string): number {
  return checkIns.filter(
    (c) => c.status === "done" && c.date >= start && c.date <= end
  ).length;
}
