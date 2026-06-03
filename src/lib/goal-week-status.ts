/**
 * The goal-detail page's primary status: "where am I this week?" — not an
 * all-time dashboard. For frequency (count) goals the unit is progress toward
 * the weekly target; for specific-day goals it's how many scheduled days this
 * week are logged. Streak is deliberately demoted to a secondary line, because
 * leading with "0 weeks" is deflating and a weekly streak is only meaningful
 * after a full completed week.
 */
export type WeekStatusInput = {
  doneThisWeek: number;
  /** weekly_target for count goals; scheduled days this ISO week otherwise. */
  total: number;
  isCount: boolean;
  currentStreak: number;
  longestStreak: number;
  /** "days" | "weeks" (plural). */
  streakUnit: string;
  doneCount: number;
};

export type WeekStatus = {
  headline: string; // "1 of 5"
  note: string; // humane subtext
  secondary: string; // demoted streak + all-time total
};

export function computeWeekStatus(i: WeekStatusInput): WeekStatus {
  const headline = `${i.doneThisWeek} of ${i.total}`;

  let note: string;
  if (i.total > 0 && i.doneThisWeek >= i.total) {
    note = i.isCount
      ? "Target met for this week."
      : "Every scheduled day done this week.";
  } else if (i.doneThisWeek === 0) {
    note = "Nothing logged yet this week.";
  } else {
    note = i.isCount
      ? `${i.total - i.doneThisWeek} more to go this week.`
      : `${i.doneThisWeek} done so far this week.`;
  }

  const sing = i.streakUnit.replace(/s$/, "");
  let streakLine: string;
  if (i.currentStreak > 0) {
    streakLine = `${i.currentStreak}-${sing} streak`;
    if (!i.isCount && i.longestStreak > i.currentStreak) {
      streakLine += ` · best ${i.longestStreak}`;
    }
  } else if (i.isCount) {
    streakLine = "weekly streak begins after a full week";
  } else if (i.longestStreak > 0) {
    streakLine = `best ${i.longestStreak}-${sing} streak`;
  } else {
    streakLine = "no streak yet";
  }

  const secondary = `${i.doneCount} done in total · ${streakLine}`;
  return { headline, note, secondary };
}
