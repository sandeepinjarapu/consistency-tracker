import type { MonthData } from "@/lib/month-history";
import MonthCalGrid from "./month-cal-grid";
import YearStrip from "./year-strip";

/**
 * Option E "Resolution Levels" history view.
 *
 * - Recent months (up to 2) as full calendar grids, side-by-side on >=sm.
 *   Current month is on the left (where the eye lands in LTR reading).
 * - Older months as a compact year strip of intensity-coloured blocks.
 *   Only rendered when olderMonths.length > 0 (goal spans > 2 calendar months).
 *
 * Pure presentational — no client state. Wrap in FullHistory for the
 * toggle behaviour on the goal detail page.
 */
export default function GoalHistoryView({
  recentMonths,
  olderMonths,
  doneColor,
  isCount,
}: {
  recentMonths: MonthData[];
  olderMonths: MonthData[];
  doneColor: string;
  /** Frequency goals never mark a day "missed", so the legend drops it. */
  isCount: boolean;
}) {
  if (recentMonths.length === 0) return null;

  return (
    <div>
      {/* Recent months — calendar grids. recentMonths[0] is the current
          (newest) month → left column. Stacks on narrow screens. */}
      <div
        className={
          recentMonths.length === 2
            ? "grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3"
            : "mb-3"
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

      <Legend doneColor={doneColor} isCount={isCount} />

      {/* Older history — year strip, only when data goes back far enough */}
      {olderMonths.length > 0 ? (
        <div className="mt-5">
          <p className="text-[10px] uppercase tracking-wider text-[color:var(--muted)] mb-2">
            Older history
          </p>
          <YearStrip months={olderMonths} doneColor={doneColor} />
        </div>
      ) : null}
    </div>
  );
}

function Legend({ doneColor, isCount }: { doneColor: string; isCount: boolean }) {
  const items: Array<{ label: string; color: string }> = [
    { label: "Done", color: doneColor },
    { label: "Skipped", color: "#fde68a" },
  ];
  // Specific-day goals can leave a scheduled day unlogged ("missed"); a gap on
  // a frequency goal isn't a miss, so that swatch would be misleading.
  if (!isCount) items.push({ label: "Missed", color: "#e5e7eb" });

  return (
    <div className="flex items-center gap-3 text-[10px] text-[color:var(--muted)]">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1">
          <span
            className="inline-block rounded-[2px]"
            style={{ width: 9, height: 9, background: it.color }}
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}
