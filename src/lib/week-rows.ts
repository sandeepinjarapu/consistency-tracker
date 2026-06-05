import { addDays, dayOfWeekForDateString, isoWeekStart } from "./dates";
import { isBackfillable } from "./heatmap-backfill";

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
  | "rest"; // not a scheduled day (or before the goal existed)

export type GridCell = {
  date: string; // YYYY-MM-DD
  state: GridCellState;
  editable: boolean;
};

export type GridWeek = {
  weekStart: string; // ISO Monday
  label: string; // "This week" | "Last week" | "May 19"
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

export function buildWeekRows(opts: {
  goalStartDate: string;
  today: string;
  targetDays: number[];
  /** Logged statuses keyed by ISO date; absent = not logged. */
  statusByDate: Record<string, "done" | "skipped">;
  /** Total weeks to include, newest first (current week counts as one). */
  weeksToShow: number;
}): GridWeek[] {
  const { goalStartDate, today, targetDays, statusByDate, weeksToShow } = opts;
  const currentWeekStart = isoWeekStart(today);
  const goalWeekStart = isoWeekStart(goalStartDate);
  const window = { goalStartDate, today, targetDays };

  const rows: GridWeek[] = [];
  for (let w = 0; w < weeksToShow; w++) {
    const weekStart = addDays(currentWeekStart, -7 * w);
    // Stop once the whole week predates the goal — nothing to show before it.
    if (weekStart < goalWeekStart) break;

    const cells: GridCell[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(weekStart, i);
      const dow = dayOfWeekForDateString(date);
      const scheduled = targetDays.includes(dow);
      if (!scheduled || date < goalStartDate) {
        cells.push({ date, state: "rest", editable: false });
        continue;
      }
      const status = statusByDate[date];
      const editable = isBackfillable(date, window);
      let state: GridCellState;
      if (status === "done") state = "done";
      else if (status === "skipped") state = "skipped";
      else if (date === today) state = "today";
      else if (date > today) state = "upcoming";
      else state = editable ? "open" : "missed";
      cells.push({ date, state, editable });
    }

    rows.push({
      weekStart,
      label: weekLabel(weekStart, currentWeekStart),
      isCurrent: weekStart === currentWeekStart,
      cells,
    });
  }
  return rows;
}
