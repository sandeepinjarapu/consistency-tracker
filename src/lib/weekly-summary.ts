import { addDays, dayOfWeekForDateString } from "./dates";
import type { WeeklyGoalStat } from "./email";

export type SummaryGoal = {
  id: string;
  name: string;
  target_days: number[];
  weekly_target: number | null;
  created_at: string; // ISO timestamptz
};

export type SummaryCheckIn = {
  goal_id: string;
  date: string; // YYYY-MM-DD
  status: string; // "done" | "skipped"
};

/**
 * Compute per-goal weekly stats for a Mon–Sun window. Shared by the partner
 * summary (a shared subset of an owner's goals) and the owner's own
 * self-summary (all of their active goals).
 *
 * A count goal created after the week started didn't have a full week, so it's
 * skipped this time — it appears next week once it has one. For specific-day
 * goals the target only counts target days on/after the goal's start.
 */
export function computeWeeklyGoalStats(
  goals: SummaryGoal[],
  checkIns: SummaryCheckIn[],
  weekStart: string,
  weekEnd: string
): WeeklyGoalStat[] {
  const eligible = goals.filter(
    (g) =>
      !(g.weekly_target != null && g.created_at.slice(0, 10) > weekStart)
  );

  return eligible.map((g) => {
    const goalStart = g.created_at.slice(0, 10);
    const goalCheckIns = checkIns.filter(
      (c) => c.goal_id === g.id && c.date >= weekStart && c.date <= weekEnd
    );
    const skipped = goalCheckIns.filter((c) => c.status === "skipped").length;

    // Count goals: target is the weekly quota, and only done check-ins on
    // eligible days count toward it.
    if (g.weekly_target != null) {
      const done = goalCheckIns.filter(
        (c) =>
          c.status === "done" &&
          g.target_days.includes(dayOfWeekForDateString(c.date))
      ).length;
      return { name: g.name, done, target: g.weekly_target, skipped };
    }

    // Specific-day goals: target is the number of target days in the window
    // on/after the goal's start.
    let target = 0;
    let cursor = weekStart;
    while (cursor <= weekEnd) {
      if (cursor >= goalStart && g.target_days.includes(dayOfWeekForDateString(cursor))) {
        target++;
      }
      cursor = addDays(cursor, 1);
    }
    const done = goalCheckIns.filter((c) => c.status === "done").length;
    return { name: g.name, done, target, skipped };
  });
}

/** Total target across stats — used to decide if a summary is worth sending. */
export function totalTarget(stats: WeeklyGoalStat[]): number {
  return stats.reduce((s, g) => s + g.target, 0);
}
