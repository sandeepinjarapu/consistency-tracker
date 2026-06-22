/**
 * The one-line summary after the date in the Today header.
 *
 * Counts are over REQUIRED goals only — weekly-count goals whose quota was
 * already met before today are reclassified as optional over-quota extras
 * (see classifyGoalForLogicalDay) and must never appear as "left".
 *
 * When nothing is required, two cases differ: if today's goals were all met
 * for the week (`overQuotaCount > 0` — the original "5 of 5 this week / 1 left"
 * bug case), the header acknowledges that warmly rather than reading the same
 * flat "Nothing scheduled" as a genuinely empty day. If nothing targeted today
 * at all, it stays "Nothing scheduled today."
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
  overQuotaCount: number;
  isNightOwl: boolean;
}): string {
  const {
    requiredCount,
    doneCount,
    skippedCount,
    remaining,
    extraToday,
    overQuotaCount,
    isNightOwl,
  } = args;

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

  // Nothing required, but today's goals were already met for the week — name
  // the win instead of the absence.
  if (overQuotaCount > 0) {
    return `You're all caught up for the week${extraSuffix}`;
  }

  if (extraToday > 0) {
    return isNightOwl
      ? `Nothing scheduled today · ${extraToday} extra from late last night`
      : `Nothing scheduled today · ${extraToday} extra`;
  }

  return "Nothing scheduled today.";
}
