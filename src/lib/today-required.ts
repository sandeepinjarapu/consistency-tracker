/**
 * Today-list classification for a single goal on the logical day.
 *
 * Specific-day goals (`weeklyTarget == null`) are required whenever the day is
 * one of their target days — unchanged behavior.
 *
 * Weekly-count goals ("N times per week, any day") store every weekday in
 * `target_days`, so a naive "today is a target day" rule demands a check-in
 * every single day even after the weekly promise is already met. That produced
 * the contradiction where a goal could read "✓ 5 of 5 this week" and still be
 * counted as "1 left". The fix keys requiredness on the quota, not the weekday:
 *
 * - Required while the quota still has room (`scoredDoneBeforeToday <
 *   weeklyTarget`), OR once today has contributed a check-in (`hasTodayCheckIn`)
 *   — so a card that *completed* the quota today stays visible as done rather
 *   than vanishing the instant it's tapped.
 * - Over-quota once the quota was already met *before* today and today is still
 *   open: not an obligation, but offered as optional extra evidence (a chip in
 *   "Did anything else today?"). Because the day is an eligible weekday, logging
 *   it uses the normal `markDone` path — NOT `markExtraDone`, which is only for
 *   off-target days (see `isExtraLoggable`).
 *
 * `scoredDoneBeforeToday` must count only done check-ins on eligible weekdays
 * (those in `target_days`) strictly before the logical day.
 */
export type TodayClass = "required" | "over_quota" | "not_today";

export function classifyTodayGoal(args: {
  weeklyTarget: number | null;
  inTargetToday: boolean;
  hasTodayCheckIn: boolean;
  scoredDoneBeforeToday: number;
}): TodayClass {
  const { weeklyTarget, inTargetToday, hasTodayCheckIn, scoredDoneBeforeToday } =
    args;

  if (!inTargetToday) return "not_today";
  if (weeklyTarget == null) return "required";
  if (hasTodayCheckIn || scoredDoneBeforeToday < weeklyTarget) return "required";
  return "over_quota";
}
