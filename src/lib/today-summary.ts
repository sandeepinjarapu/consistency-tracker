/**
 * The one-line summary after the date in the Today header.
 *
 * Counts are over REQUIRED goals only — weekly-count goals whose quota was
 * already met before today are reclassified as optional over-quota extras
 * (see classifyTodayGoal) and must never appear as "left". When the required
 * list is empty (e.g. the only goal is a quota-met weekly goal — the original
 * "5 of 5 this week / 1 left" bug case), the header reads "Nothing scheduled
 * today." rather than inventing pressure.
 *
 * `extraToday` is the count of off-target extras already logged; in the
 * night-owl window those belong to yesterday, so the copy says "last night".
 */
export function todaySummary(args: {
  requiredCount: number;
  doneCount: number;
  skippedCount: number;
  remaining: number;
  extraToday: number;
  isNightOwl: boolean;
}): string {
  const { requiredCount, doneCount, skippedCount, remaining, extraToday, isNightOwl } =
    args;

  const extraSuffix =
    extraToday > 0
      ? isNightOwl
        ? ` · ${extraToday} extra from late last night`
        : ` · ${extraToday} extra`
      : "";

  if (requiredCount > 0) {
    return `${doneCount} of ${requiredCount} done${
      skippedCount > 0 ? `, ${skippedCount} skipped` : ""
    }${remaining > 0 ? `, ${remaining} left` : ""}${extraSuffix}`;
  }

  if (extraToday > 0) {
    return isNightOwl
      ? `Nothing scheduled today · ${extraToday} extra from late last night`
      : `Nothing scheduled today · ${extraToday} extra`;
  }

  return "Nothing scheduled today.";
}
