import type { MonthData } from "@/lib/month-history";
import MonthCalGrid from "./month-cal-grid";
import YearStrip from "./year-strip";

/**
 * Option E "Resolution Levels" history view.
 *
 * - Recent months (up to 2) as full calendar grids, side-by-side.
 *   Current month is on the left (where the eye lands in LTR reading).
 * - Older months as a compact year strip of intensity-coloured blocks.
 *   Only rendered when olderMonths.length > 0 (i.e. goal spans > 2 calendar months).
 *
 * Pure presentational — no client state. Wrap in FullHistory for the
 * toggle behaviour on the goal detail page.
 */
export default function GoalHistoryView({
  recentMonths,
  olderMonths,
  doneColor,
}: {
  recentMonths: MonthData[];
  olderMonths: MonthData[];
  doneColor: string;
}) {
  if (recentMonths.length === 0) return null;

  return (
    <div>
      {/* Recent months — side-by-side calendar grids.
          recentMonths[0] is always the current (newest) month → left column. */}
      <div
        className={
          recentMonths.length === 2
            ? "grid grid-cols-2 gap-4 mb-4"
            : "mb-4"
        }
      >
        {recentMonths.map((m) => (
          <MonthCalGrid
            key={`${m.year}-${m.month}`}
            year={m.year}
            month={m.month}
            cells={m.cells}
            doneColor={doneColor}
          />
        ))}
      </div>

      {/* Older history — year strip, only when data goes back far enough */}
      {olderMonths.length > 0 ? (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[color:var(--muted)] mb-2">
            Older history
          </p>
          <YearStrip months={olderMonths} doneColor={doneColor} />
        </div>
      ) : null}
    </div>
  );
}
