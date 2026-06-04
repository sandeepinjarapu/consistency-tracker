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

const WEEKDAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** A single editable day in the "Catch up" list, ready to render. */
export type CatchUpDay = {
  date: string; // YYYY-MM-DD
  label: string; // "Today" or a weekday abbr ("Tue")
  dateLabel: string; // "Jun 4"
  status: "done" | "skipped" | "empty"; // "empty" = not logged
  action: "mark" | "clear"; // never null — only editable days are returned
};

/**
 * The days the owner can still log or correct, newest first — the data behind
 * the "Catch up" editor on the goal detail page. Exactly the days the heatmap
 * used to make clickable (same `isBackfillable` window: this ISO week plus the
 * 2-day grace), but surfaced as an explicit, finger-friendly list instead of a
 * tiny tap target. Pure so it can be unit-tested independent of rendering.
 */
export function recentEditableDays(opts: {
  goalStartDate: string;
  today: string;
  targetDays: number[];
  /** Logged statuses keyed by ISO date; absent date = not logged. */
  statusByDate: Record<string, "done" | "skipped">;
}): CatchUpDay[] {
  const { goalStartDate, today, targetDays, statusByDate } = opts;
  const window: BackfillWindow = { goalStartDate, today, targetDays };
  const out: CatchUpDay[] = [];
  // Walk back from today; the window is at most a week, so this is bounded.
  // Stop once we step before the goal start (nothing earlier can be editable).
  for (let i = 0; i >= -9; i--) {
    const date = addDays(today, i);
    if (date < goalStartDate) break;
    if (!isBackfillable(date, window)) continue;
    const logged = statusByDate[date] as "done" | "skipped" | undefined;
    const dow = dayOfWeekForDateString(date);
    const [, m, d] = date.split("-");
    out.push({
      date,
      label: date === today ? "Today" : WEEKDAY_ABBR[dow],
      dateLabel: `${MONTH_ABBR[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`,
      status: logged ?? "empty",
      action: logged === undefined ? "mark" : "clear",
    });
  }
  return out;
}
