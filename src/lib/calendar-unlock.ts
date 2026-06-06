/**
 * Determines whether the aggregate calendar section should be shown on the
 * Goals list page.
 *
 * Rules:
 * - Show only when there is at least one active goal AND at least one check-in
 *   in the fetched window (nothing to render otherwise).
 * - Unlock threshold: 3+ active goals. Once unlocked the flag is persisted in
 *   profiles.calendar_unlocked, so the section stays visible even if goals
 *   later drop below 3 (as long as at least one active goal remains).
 */
export function shouldShowAggregateCalendar(
  alreadyUnlocked: boolean,
  activeGoalCount: number,
  hasCheckIns: boolean
): boolean {
  const unlocked = alreadyUnlocked || activeGoalCount >= 3;
  return unlocked && hasCheckIns;
}
