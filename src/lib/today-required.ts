import { dayOfWeekForDateString } from "@/lib/dates";

/**
 * Shared logical-day requiredness for a single goal — used by BOTH the daytime
 * Today list and the night-owl "Still open from last night" list, so the quota
 * rule lives in exactly one place. (PR #145 fixed only the daytime path; the
 * night-owl path kept its own weekday-only rule and so re-grew the same "demand
 * a quota-met goal" bug. This is the de-duplication.)
 *
 * "Logical day" is whichever day the surface is prompting for: today for the
 * daytime list, yesterday for the 12–5 AM night-owl list.
 *
 * Specific-day goals (`weeklyTarget == null`) are required whenever the logical
 * day is a target day. Weekly-count goals ("N×/week, any day") store every
 * weekday in `target_days`, so requiredness keys on the quota, not the weekday:
 *
 * - required — quota still has room (`scoredDoneBeforeDay < weeklyTarget`), OR a
 *   check-in already landed on the logical day (`hasCheckInOnDay`) so a card
 *   that *completed* the quota that day stays visible rather than vanishing.
 * - over_quota — quota was already met *before* the logical day and the day is
 *   still open: optional, never an obligation.
 * - not_applicable — the logical day isn't a target weekday for this goal.
 *
 * `scoredDoneBeforeDay` must count only done check-ins on eligible weekdays,
 * within the logical day's OWN ISO week, strictly before the logical day — see
 * `scoredDoneBefore`. The "own ISO week" part matters at the Monday-pre-dawn
 * boundary, where yesterday (Sunday) belongs to the previous ISO week.
 */
export type LogicalDayClass = "required" | "over_quota" | "not_applicable";

export function classifyGoalForLogicalDay(args: {
  weeklyTarget: number | null;
  inTargetDay: boolean;
  hasCheckInOnDay: boolean;
  scoredDoneBeforeDay: number;
}): LogicalDayClass {
  const { weeklyTarget, inTargetDay, hasCheckInOnDay, scoredDoneBeforeDay } = args;

  if (!inTargetDay) return "not_applicable";
  if (weeklyTarget == null) return "required";
  if (hasCheckInOnDay || scoredDoneBeforeDay < weeklyTarget) return "required";
  return "over_quota";
}

/**
 * Count done check-ins that score toward a goal's weekly quota strictly before
 * `beforeDate`, scoped to the ISO week starting `weekStart`. Only done rows on
 * eligible weekdays (those in `targetDays`) count. Pass the ISO week start of
 * the LOGICAL day (`isoWeekStart(today)` for daytime, `isoWeekStart(yesterday)`
 * for night-owl) so the Monday-pre-dawn case counts Sunday's week, not the new
 * one.
 */
export function scoredDoneBefore(
  checkIns: { goal_id: string; date: string; status: string }[],
  goalId: string,
  beforeDate: string,
  weekStart: string,
  targetDays: number[]
): number {
  return checkIns.filter(
    (c) =>
      c.goal_id === goalId &&
      c.status === "done" &&
      c.date >= weekStart &&
      c.date < beforeDate &&
      targetDays.includes(dayOfWeekForDateString(c.date))
  ).length;
}
