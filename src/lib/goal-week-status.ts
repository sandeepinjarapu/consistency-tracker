import { addDays, dayOfWeekForDateString } from "@/lib/dates";

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
    // A blank week shouldn't read as failure. If there's earlier history this
    // is a fresh start; for a brand-new goal it's a gentle invitation.
    note =
      i.doneCount > 0
        ? "Fresh week — earlier check-ins still count."
        : "Nothing logged yet — today's a good place to start.";
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

  const secondary =
    i.doneCount === 0
      ? "No check-ins yet — your history starts here."
      : `${i.doneCount} done in total · ${streakLine}`;
  return { headline, note, secondary };
}

const WEEKDAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * A small at-a-glance progress row for "this week". For specific-day goals each
 * slot is a scheduled weekday (labeled), filled as it's logged; for frequency
 * goals it's N anonymous slots (= weekly target), filled left-to-right by the
 * number done so far. Pure so it can be unit-tested independent of rendering.
 */
export type WeekSlot = {
  /** Weekday abbreviation for specific-day goals; null for count slots. */
  label: string | null;
  state: "done" | "today" | "upcoming" | "missed" | "empty";
};

export type WeekSlotsInput = {
  isCount: boolean;
  weekStart: string; // ISO Monday of the current week
  today: string;
  // Specific-day goals:
  targetDays: number[];
  doneDates: string[]; // ISO dates done this week
  // Count goals:
  weeklyTarget: number;
  doneThisWeek: number;
};

export function computeWeekSlots(i: WeekSlotsInput): WeekSlot[] {
  if (i.isCount) {
    const filled = Math.min(i.doneThisWeek, i.weeklyTarget);
    return Array.from({ length: i.weeklyTarget }, (_, idx) => ({
      label: null,
      state: idx < filled ? "done" : "empty",
    }));
  }

  const done = new Set(i.doneDates);
  const slots: WeekSlot[] = [];
  for (let d = 0; d < 7; d++) {
    const date = addDays(i.weekStart, d);
    const weekday = dayOfWeekForDateString(date);
    if (!i.targetDays.includes(weekday)) continue;
    let state: WeekSlot["state"];
    if (done.has(date)) state = "done";
    else if (date === i.today) state = "today";
    else if (date < i.today) state = "missed";
    else state = "upcoming";
    slots.push({ label: WEEKDAY_ABBR[weekday], state });
  }
  return slots;
}
