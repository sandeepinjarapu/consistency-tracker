import type { WeekMet } from "@/lib/stats";

/**
 * Compact per-week history for a count goal: one vertical bar per ISO week,
 * filled in proportion to that week's done/target. A met week is full and
 * solid; an unmet week is dimmed. Gives the week-based streak a visual home
 * (the day heatmap can't, since its columns are Sun–Sat, not Mon–Sun weeks).
 */
export default function WeeklyStrip({
  weeks,
  weeklyTarget,
  doneColor = "#22c55e",
  max = 12,
}: {
  weeks: WeekMet[];
  weeklyTarget: number;
  doneColor?: string;
  max?: number;
}) {
  const shown = weeks.slice(-max);
  if (shown.length === 0) return null;

  return (
    <div>
      <div
        className="flex items-end gap-1"
        role="img"
        aria-label="Weekly target history"
      >
        {shown.map((w) => {
          const pct = Math.min(w.done / weeklyTarget, 1);
          const state = w.met
            ? "met"
            : w.current
              ? "this week"
              : w.partial
                ? "partial week"
                : "missed";
          return (
            <span
              key={w.weekStart}
              title={`Week of ${formatWeek(w.weekStart)} · ${w.done}/${weeklyTarget} · ${state}`}
              className="relative h-7 w-3.5 rounded-sm overflow-hidden bg-[color:var(--border)]"
            >
              <span
                className="absolute inset-x-0 bottom-0 rounded-sm"
                style={{
                  // Show at least a sliver when there's any progress.
                  height: `${w.done > 0 ? Math.max(pct * 100, 12) : 0}%`,
                  background: doneColor,
                  opacity: w.met ? 1 : 0.45,
                }}
              />
            </span>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] text-[color:var(--muted)]">
        Each bar is a week — a full bar means you hit {weeklyTarget}× that week.
      </p>
    </div>
  );
}

function formatWeek(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
