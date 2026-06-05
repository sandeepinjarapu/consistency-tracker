import { DAY_START_HOUR, dateInTimezone } from "@/lib/dates";

/**
 * The goals to surface in the Today page's "Still open from last night"
 * section. Only between midnight and DAY_START_HOUR (the logical-day rollover):
 * a late log then is a normal check-in for yesterday, not a backfill, so
 * daytime users never see it.
 *
 * A goal qualifies when yesterday was one of its target days, it already
 * existed yesterday (so we never offer a check-in for before the goal was
 * created), and it wasn't already logged or skipped. Pure, so the eligibility
 * rule is unit-tested independent of the page.
 */
export function selectLastNightGoals<
  G extends { id: string; target_days: number[]; created_at: string }
>(opts: {
  goals: G[];
  /** Current hour in the user's timezone (0–23). */
  hour: number;
  /** Yesterday's date, YYYY-MM-DD. */
  yesterday: string;
  /** Yesterday's weekday, 0 (Sun) – 6 (Sat). */
  yesterdayDow: number;
  /** Goal ids already logged or skipped for yesterday. */
  loggedYesterday: Set<string>;
  /** The user's IANA timezone, for resolving each goal's local start date. */
  timezone: string;
}): G[] {
  if (opts.hour >= DAY_START_HOUR) return [];
  return opts.goals.filter(
    (g) =>
      g.target_days.includes(opts.yesterdayDow) &&
      dateInTimezone(g.created_at, opts.timezone) <= opts.yesterday &&
      !opts.loggedYesterday.has(g.id)
  );
}
