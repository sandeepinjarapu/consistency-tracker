import { addDays, dayOfWeekForDateString, isoWeekStart } from "./dates";
import { isBackfillable, isExtraLoggable } from "./heatmap-backfill";

/**
 * The "Week Rows" model behind the goal-detail record: one row per ISO week
 * (Mon..Sun), each day a cell with a state and an `editable` flag. The current
 * week is interactive (log / undo); past weeks are read-only history. This is
 * the replacement for the inline heatmap on a single goal, where a day grid is
 * legible and a year heatmap is overkill.
 *
 * `editable` is exactly `isBackfillable` (current ISO week + 2-day grace,
 * intersected with the goal's days), the same window the server enforces, so
 * the affordance and the action can never disagree.
 *
 * Pure, so it can be unit-tested independent of rendering.
 */
export type GridCellState =
  | "done" // logged done
  | "skipped" // logged skip
  | "today" // today, scheduled, not logged
  | "open" // a past scheduled day still inside the editable window
  | "missed" // a past scheduled day that has locked (specific-day history only)
  | "upcoming" // a future scheduled day
  | "extra" // a logged done on an off-target (unscheduled) day — evidence, unscored
  | "extra-open" // an off-target current-week day you can log an extra on
  | "rest"; // not a scheduled day (or before the goal existed)

export type GridCell = {
  date: string; // YYYY-MM-DD
  state: GridCellState;
  editable: boolean;
  /**
   * True for off-target cells (`extra`, `extra-open`, and a stray off-target
   * skip): these log/remove via the extra server actions, not the scheduled
   * backfill ones. Lets the editor route the right action without re-deriving.
   */
  extra: boolean;
};

export type GridWeek = {
  weekStart: string; // ISO Monday
  label: string; // "This week" | "Last week" | "May 19"
  dateRange: string; // "May 12–18" (Mon..Sun)
  isCurrent: boolean;
  cells: GridCell[]; // exactly 7, Monday..Sunday
};

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function weekLabel(weekStart: string, currentWeekStart: string): string {
  if (weekStart === currentWeekStart) return "This week";
  if (weekStart === addDays(currentWeekStart, -7)) return "Last week";
  const [, m, d] = weekStart.split("-");
  return `${MONTH_ABBR[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`;
}

/** The Mon..Sun span of a week as "May 12–18" (or "Apr 28 – May 4"). */
export function weekDateRange(weekStart: string): string {
  const weekEnd = addDays(weekStart, 6);
  const [, sm, sd] = weekStart.split("-");
  const [, em, ed] = weekEnd.split("-");
  const start = `${MONTH_ABBR[parseInt(sm, 10) - 1]} ${parseInt(sd, 10)}`;
  if (sm === em) return `${start}–${parseInt(ed, 10)}`;
  return `${start} – ${MONTH_ABBR[parseInt(em, 10) - 1]} ${parseInt(ed, 10)}`;
}

export function buildWeekRows(opts: {
  goalStartDate: string;
  today: string;
  targetDays: number[];
  /** Logged statuses keyed by ISO date; absent = not logged. */
  statusByDate: Record<string, "done" | "skipped">;
  /** Total weeks to include, newest first (current week counts as one). */
  weeksToShow: number;
  /**
   * Frequency goals have no per-day "missed" state ("any day counts"), so a
   * locked unlogged eligible day reads as a neutral rest cell, not a miss.
   */
  isCount?: boolean;
}): GridWeek[] {
  const {
    goalStartDate,
    today,
    targetDays,
    statusByDate,
    weeksToShow,
    isCount = false,
  } = opts;
  const currentWeekStart = isoWeekStart(today);
  const goalWeekStart = isoWeekStart(goalStartDate);
  const window = { goalStartDate, today, targetDays };

  const rows: GridWeek[] = [];
  for (let w = 0; w < weeksToShow; w++) {
    const weekStart = addDays(currentWeekStart, -7 * w);
    // Stop once the whole week predates the goal — nothing to show before it.
    if (weekStart < goalWeekStart) break;
    const isCurrentWeek = weekStart === currentWeekStart;

    const cells: GridCell[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(weekStart, i);
      const dow = dayOfWeekForDateString(date);
      const scheduled = targetDays.includes(dow);
      const status = statusByDate[date]; // "done" | "skipped" | undefined

      if (date < goalStartDate) {
        cells.push({ date, state: "rest", editable: false, extra: false });
        continue;
      }

      if (scheduled) {
        const editable = isBackfillable(date, window);
        let state: GridCellState;
        if (status === "done") state = "done";
        else if (status === "skipped") state = "skipped";
        else if (date === today) state = "today";
        else if (date > today) state = "upcoming";
        else if (editable) state = "open";
        else state = isCount ? "rest" : "missed";
        cells.push({ date, state, editable, extra: false });
        continue;
      }

      // Off-target weekday (on/after goal start). A done here is an extra
      // (evidence, never scored); an empty current-week day can take one; a
      // stray skip — only ever left by later narrowing the cadence — is
      // removable while still in window, else hidden as a rest cell.
      const extraEditable = isExtraLoggable(date, window);
      if (status === "done") {
        cells.push({ date, state: "extra", editable: extraEditable, extra: true });
      } else if (status === "skipped") {
        cells.push(
          extraEditable
            ? { date, state: "skipped", editable: true, extra: true }
            : { date, state: "rest", editable: false, extra: false }
        );
      } else if (isCurrentWeek && extraEditable) {
        cells.push({ date, state: "extra-open", editable: true, extra: true });
      } else {
        cells.push({ date, state: "rest", editable: false, extra: false });
      }
    }

    rows.push({
      weekStart,
      label: weekLabel(weekStart, currentWeekStart),
      dateRange: weekDateRange(weekStart),
      isCurrent: weekStart === currentWeekStart,
      cells,
    });
  }
  return rows;
}
