import { daysBetween } from "@/lib/dates";

// The single contextual banner under the Today cards. It is intentionally
// mutually-exclusive: at most one of these ever shows, and most of the time
// nothing does. The goal is calm self-accountability, not nagging.
export type TodayBanner =
  | { kind: "reflect"; period: "this" | "last" }
  | { kind: "dropoff"; weeks: number }
  | { kind: "none" };

export type TodayBannerInput = {
  /** 0=Sun .. 6=Sat, in the user's timezone */
  dow: number;
  today: string;
  /** ≥1 check-in in the current ISO week (Mon→today) */
  currentWeekHasCheckIn: boolean;
  /** ≥1 check-in in the previous ISO week */
  lastWeekHasCheckIn: boolean;
  currentWeekReflected: boolean;
  lastWeekReflected: boolean;
  /**
   * The day to measure a lapse from: the most recent check-in across all
   * goals, or — if they have never checked in — the earliest goal's creation
   * date. So a brand-new account never trips the drop-off message.
   */
  anchorDate: string;
};

/**
 * Decide which (if any) contextual banner to show beneath the Today cards.
 *
 * Reflection prompt — only for a week that has activity and isn't reflected:
 *   • Sat/Sun: reflect on the week that's closing ("this week").
 *   • Mon/Tue: a 2-day grace into the new week — reflect on the week just
 *     finished ("last week"). Mirrors the heatmap-backfill grace window.
 *   • Wed/Thu/Fri: quiet.
 *
 * Drop-off — when there's been no check-in for ≥2 weeks, a single gentle
 * re-engagement line until the next check-in. Reflection takes precedence,
 * but the two are naturally exclusive: recent activity rules out a 2-week gap.
 */
export function computeTodayBanner(i: TodayBannerInput): TodayBanner {
  const isWeekend = i.dow === 6 || i.dow === 0; // Sat or Sun
  const isGrace = i.dow === 1 || i.dow === 2; // Mon or Tue

  if (isWeekend) {
    if (i.currentWeekHasCheckIn && !i.currentWeekReflected) {
      return { kind: "reflect", period: "this" };
    }
  } else if (isGrace) {
    if (i.lastWeekHasCheckIn && !i.lastWeekReflected) {
      return { kind: "reflect", period: "last" };
    }
  }

  const gap = daysBetween(i.anchorDate, i.today);
  if (gap >= 14) {
    return { kind: "dropoff", weeks: Math.floor(gap / 7) };
  }

  return { kind: "none" };
}
