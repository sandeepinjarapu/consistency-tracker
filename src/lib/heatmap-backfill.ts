import { addDays, dayOfWeekForDateString, isoWeekStart } from "./dates";

export type BackfillAction = "mark" | "clear" | null;

export type BackfillWindow = {
  goalStartDate: string;
  today: string;
  targetDays: number[];
};

/**
 * Whether a given day may be edited (logged or cleared) via backfill.
 *
 * A day is editable only when it is:
 *  - on or after the goal's start, on or before today (never future),
 *  - an eligible weekday for the goal (dow in targetDays — same rule for
 *    specific and count goals; no off-window "bonus" credit), and
 *  - inside the editable time window: the current ISO week (Mon→today) plus
 *    a 2-day grace into the previous week, i.e.
 *      date >= min(isoWeekStart(today), addDays(today, -2)).
 *    So the whole current week stays editable through Sunday, and after the
 *    week rolls over you can still fix the prior Sat on Mon and the prior
 *    Sun on Tue, but the previous week locks from Wednesday.
 *
 * Shared by the heatmap UI (affordance) and the backfill server actions
 * (authoritative enforcement) so the two always agree.
 */
export function isBackfillable(
  date: string,
  { goalStartDate, today, targetDays }: BackfillWindow
): boolean {
  if (date > today) return false; // future
  if (date < goalStartDate) return false; // before the goal existed
  if (!targetDays.includes(dayOfWeekForDateString(date))) return false; // off-window

  // ISO date strings compare chronologically, so min() is a string min.
  const weekStart = isoWeekStart(today);
  const twoDaysAgo = addDays(today, -2);
  const lowerBound = weekStart < twoDaysAgo ? weekStart : twoDaysAgo;
  return date >= lowerBound; // inside the editable window
}

/**
 * Decide what clicking a heatmap day should do, or `null` if the day is
 * locked. "clear" if a check-in already exists (done/skipped), else "mark".
 */
export function backfillAction(
  cell: { date: string; status: "done" | "skipped" | "missed" | "empty" },
  opts: BackfillWindow
): BackfillAction {
  if (!isBackfillable(cell.date, opts)) return null;
  return cell.status === "done" || cell.status === "skipped" ? "clear" : "mark";
}
