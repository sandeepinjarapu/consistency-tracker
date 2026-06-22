import { DAY_START_HOUR, dateInTimezone } from "@/lib/dates";
import { classifyGoalForLogicalDay, scoredDoneBefore } from "@/lib/today-required";

/**
 * The goals to surface in the Today page's "Still open from last night"
 * section. Only between midnight and DAY_START_HOUR (the logical-day rollover):
 * a late log then is a normal check-in for yesterday, not a backfill, so
 * daytime users never see it.
 *
 * A goal qualifies when yesterday was one of its target days, it already
 * existed yesterday (so we never offer a check-in for before the goal was
 * created), it wasn't already logged or skipped, AND — for weekly-count goals —
 * its weekly quota was not already met before yesterday. That last condition
 * routes through the SAME `classifyGoalForLogicalDay` the daytime list uses, so
 * a quota-met "any day" goal is no more a late-night obligation than it is a
 * daytime one. Over-quota goals simply drop from this list (no night-owl
 * over-quota chips, by current product decision); off-target extras for
 * yesterday still flow through the separate "Did anything else last night?"
 * affordance. Pure, so the eligibility rule is unit-tested independent of the
 * page.
 */
export function selectLastNightGoals<
  G extends {
    id: string;
    target_days: number[];
    created_at: string;
    weekly_target: number | null;
  }
>(opts: {
  goals: G[];
  /** Current hour in the user's timezone (0–23). */
  hour: number;
  /** Yesterday's date, YYYY-MM-DD. */
  yesterday: string;
  /** Yesterday's weekday, 0 (Sun) – 6 (Sat). */
  yesterdayDow: number;
  /**
   * ISO week start (YYYY-MM-DD) of YESTERDAY, not today. At Monday pre-dawn,
   * yesterday (Sunday) belongs to the previous ISO week, so the quota must be
   * counted against that week.
   */
  yesterdayWeekStart: string;
  /** Goal ids already logged or skipped for yesterday. */
  loggedYesterday: Set<string>;
  /**
   * Check-ins covering at least yesterday's ISO week (extra weeks are harmless;
   * `scoredDoneBefore` scopes by `yesterdayWeekStart`). Used to count quota
   * progress before yesterday for weekly-count goals.
   */
  weekCheckIns: { goal_id: string; date: string; status: string }[];
  /** The user's IANA timezone, for resolving each goal's local start date. */
  timezone: string;
}): G[] {
  if (opts.hour >= DAY_START_HOUR) return [];
  return opts.goals.filter((g) => {
    if (!g.target_days.includes(opts.yesterdayDow)) return false;
    if (dateInTimezone(g.created_at, opts.timezone) > opts.yesterday) return false;
    if (opts.loggedYesterday.has(g.id)) return false;
    // Not logged yesterday (excluded above), so hasCheckInOnDay is false here.
    const cls = classifyGoalForLogicalDay({
      weeklyTarget: g.weekly_target,
      inTargetDay: true,
      hasCheckInOnDay: false,
      scoredDoneBeforeDay: scoredDoneBefore(
        opts.weekCheckIns,
        g.id,
        opts.yesterday,
        opts.yesterdayWeekStart,
        g.target_days
      ),
    });
    return cls === "required";
  });
}
