import { DAY_START_HOUR, dateInTimezone } from "@/lib/dates";
import { classifyGoalForLogicalDay, scoredDoneBefore } from "@/lib/today-required";

/**
 * The goals to surface in the Today page's "Still open from last night"
 * section. Only between midnight and DAY_START_HOUR (the logical-day rollover):
 * a late log then is a normal check-in for yesterday, not a backfill, so
 * daytime users never see it.
 *
 * Returns two buckets, both keyed on yesterday and both routed through the SAME
 * `classifyGoalForLogicalDay` the daytime list uses (no duplicated quota logic):
 *
 *   required  — yesterday was a target day, the goal existed yesterday, it
 *               wasn't already logged or skipped, and (for weekly-count goals)
 *               its quota was NOT met before yesterday. These are real
 *               obligations: the "Still open from last night" cards.
 *   overQuota — yesterday was a target day, the goal existed, and its weekly
 *               quota was already met before yesterday. Optional extra evidence,
 *               surfaced as chips under "Did anything else last night?" so that
 *               "extra effort is seen, not scored" holds at night exactly as it
 *               does by day. These are NOT excluded when already logged: a goal
 *               logged done yesterday should still render as a done/removable
 *               chip.
 *
 * Off-target extras for yesterday (goals not scheduled yesterday) are handled by
 * the page, not here. Pure, so the eligibility rule is unit-tested independent
 * of the page.
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
}): { required: G[]; overQuota: G[] } {
  if (opts.hour >= DAY_START_HOUR) return { required: [], overQuota: [] };
  const required: G[] = [];
  const overQuota: G[] = [];
  for (const g of opts.goals) {
    if (!g.target_days.includes(opts.yesterdayDow)) continue;
    if (dateInTimezone(g.created_at, opts.timezone) > opts.yesterday) continue;
    // Requiredness is the entry-state quota only; logged-state is applied per
    // bucket below (over-quota chips surface even when logged; required cards
    // exclude logged goals).
    const cls = classifyGoalForLogicalDay({
      weeklyTarget: g.weekly_target,
      inTargetDay: true,
      scoredDoneBeforeDay: scoredDoneBefore(
        opts.weekCheckIns,
        g.id,
        opts.yesterday,
        opts.yesterdayWeekStart,
        g.target_days
      ),
    });
    if (cls === "over_quota") {
      // Optional evidence — surface even if already logged yesterday so the chip
      // can render as done/removable. The page reads the actual status.
      overQuota.push(g);
    } else if (!opts.loggedYesterday.has(g.id)) {
      // Real obligation, not yet logged or skipped for yesterday.
      required.push(g);
    }
  }
  return { required, overQuota };
}
