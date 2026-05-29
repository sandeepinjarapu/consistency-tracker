import { addDays, dayOfWeekForDateString, isoWeekStart } from "./dates";

export type BackfillAction = "mark" | "clear" | null;

/**
 * Decide what clicking a heatmap day should do when backfilling check-ins,
 * or `null` if that day is locked.
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
 * When editable: "clear" if a check-in already exists (done/skipped),
 * otherwise "mark".
 */
export function backfillAction(
  cell: { date: string; status: "done" | "skipped" | "missed" | "empty" },
  opts: { goalStartDate: string; today: string; targetDays: number[] }
): BackfillAction {
  const { date } = cell;
  const { goalStartDate, today, targetDays } = opts;

  if (date > today) return null; // future
  if (date < goalStartDate) return null; // before the goal existed
  if (!targetDays.includes(dayOfWeekForDateString(date))) return null; // off-window

  // ISO date strings compare chronologically, so min() is a string min.
  const weekStart = isoWeekStart(today);
  const twoDaysAgo = addDays(today, -2);
  const lowerBound = weekStart < twoDaysAgo ? weekStart : twoDaysAgo;
  if (date < lowerBound) return null; // outside the editable window

  return cell.status === "done" || cell.status === "skipped" ? "clear" : "mark";
}
