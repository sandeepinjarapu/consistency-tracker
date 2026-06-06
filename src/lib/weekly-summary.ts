import { classifyWeek, isExtraDate } from "./extra-check-ins";
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
    // Only on-target skips on/after the goal's start count. An off-target skip
    // can only be left behind by narrowing the cadence later; like an off-target
    // done it is never shown as extra and never counted (it isn't a skipped
    // extra — extras are done-only).
    const skipped = goalCheckIns.filter(
      (c) =>
        c.status === "skipped" &&
        c.date >= goalStart &&
        !isExtraDate(c.date, g.target_days)
    ).length;

    // The email is a scoring surface, so `done` is the scored count, capped at
    // target: a frequency over-quota week reports 3/3, not 4/3, and (once
    // extras exist) an off-target day never pads a specific-day goal's count.
    const doneDates = goalCheckIns
      .filter((c) => c.status === "done")
      .map((c) => c.date);
    const { scoredDone, targetCount } = classifyWeek({
      weekStart,
      goalStartDate: goalStart,
      targetDays: g.target_days,
      weeklyTarget: g.weekly_target,
      doneDates,
    });
    return { name: g.name, done: scoredDone, target: targetCount, skipped };
  });
}

/** Total target across stats — used to decide if a summary is worth sending. */
export function totalTarget(stats: WeeklyGoalStat[]): number {
  return stats.reduce((s, g) => s + g.target, 0);
}
