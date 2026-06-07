/**
 * Determines whether the aggregate calendar section should be shown on the
 * Goals list page.
 *
 * Rules:
 * - Show only when there is at least one active goal AND at least one check-in
 *   in the fetched window (nothing to render otherwise).
 * - Unlock threshold: 3+ active goals, OR the engagement path (see
 *   engagementUnlocked below). Once unlocked the flag is persisted in
 *   profiles.calendar_unlocked, so the section stays visible even if goals
 *   later drop below the threshold (as long as at least one active goal remains).
 */
export function shouldShowAggregateCalendar(
  alreadyUnlocked: boolean,
  activeGoalCount: number,
  hasCheckIns: boolean
): boolean {
  const unlocked = alreadyUnlocked || activeGoalCount >= 3;
  return unlocked && hasCheckIns;
}

/**
 * Secondary unlock path for focused single-goal users: show the calendar as
 * "Recent activity" (not "all goals") once they have genuine engagement history.
 *
 * Threshold: exactly 1 active goal, 8+ scored done check-ins spread across
 * at least 3 distinct ISO weeks. Extra check-ins (off-target or over-quota)
 * must not be counted toward the threshold — the caller is responsible for
 * filtering to scored done before passing the counts.
 */
export function engagementUnlocked(
  activeGoalCount: number,
  scoredDoneCount: number,
  scoredDoneWeekCount: number
): boolean {
  return activeGoalCount === 1 && scoredDoneCount >= 8 && scoredDoneWeekCount >= 3;
}
