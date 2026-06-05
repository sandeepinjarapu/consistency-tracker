import type { WeekMet } from "@/lib/stats";
import { weekLabel, weekDateRange } from "@/lib/week-rows";

/**
 * Recent-weeks history for a frequency goal: one labeled row per week, each a
 * small segmented rail filled by that week's sessions, plus the count and a met
 * check. Shares the Week-Rows layout (week label on the left, dates, the same
 * stacked feel) so it reads consistently next to specific-day goals, but uses
 * the quota shape, which is the right one for "any day counts": "did I hit my
 * number" reads at a glance instead of being buried in a day grid.
 *
 * Presentational. The current week is excluded by the caller (the live day grid
 * above already covers it).
 */
export default function WeekQuotaRows({
  weeks,
  currentWeekStart,
  weeklyTarget,
  doneColor,
}: {
  weeks: WeekMet[]; // past weeks, newest first
  currentWeekStart: string;
  weeklyTarget: number;
  doneColor: string;
}) {
  if (weeks.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {weeks.map((w) => {
        const filled = Math.min(w.done, weeklyTarget);
        return (
          <div key={w.weekStart} className="flex items-center gap-3">
            <span className="w-16 shrink-0 leading-tight">
              <span className="block text-xs text-[color:var(--muted)]">
                {weekLabel(w.weekStart, currentWeekStart)}
              </span>
              <span className="block text-[10px] text-[color:var(--muted)]">
                {weekDateRange(w.weekStart)}
              </span>
            </span>
            <div
              className="flex w-28 shrink-0 gap-1"
              role="img"
              aria-label={`${weekLabel(w.weekStart, currentWeekStart)}: ${w.done} of ${weeklyTarget} done${w.met ? ", target met" : ""}`}
            >
              {Array.from({ length: weeklyTarget }).map((_, i) => (
                <span
                  key={i}
                  className="h-2 flex-1 rounded-full"
                  style={{ background: i < filled ? doneColor : "var(--border)" }}
                />
              ))}
            </div>
            <span className="text-xs tabular-nums text-[color:var(--muted)]">
              {w.done} / {weeklyTarget}
              {w.met ? (
                <span className="ml-1" style={{ color: doneColor }} aria-hidden>
                  ✓
                </span>
              ) : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}
