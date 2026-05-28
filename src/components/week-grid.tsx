import type { GoalWeekStats, GoalDayStatus } from "@/lib/reflection-stats";

/**
 * Mini per-goal × day-of-week grid for a single ISO week (Mon..Sun).
 * Each cell shows the status (done/skipped/missed/etc) as a small colored
 * square — same visual vocabulary as the year heatmap, week-scaled.
 */
export default function WeekGrid({ perGoal }: { perGoal: GoalWeekStats[] }) {
  if (perGoal.length === 0) return null;

  return (
    <div className="space-y-1">
      {/* Day-of-week header */}
      <div className="grid grid-cols-[1fr_repeat(7,minmax(0,1.25rem))] gap-1 mb-1">
        <div />
        {DAY_HEADERS.map((d, i) => (
          <div
            key={i}
            className="text-[10px] text-center text-[color:var(--muted)]"
          >
            {d}
          </div>
        ))}
      </div>

      {/* One row per goal */}
      {perGoal.map((g) => (
        <div
          key={g.goalId}
          className="grid grid-cols-[1fr_repeat(7,minmax(0,1.25rem))] gap-1 items-center"
        >
          <div className="text-xs truncate pr-2" title={g.goalName}>
            {g.goalName}
          </div>
          {g.dailyStatus.map((s, i) => (
            <div
              key={i}
              className="h-4 rounded-sm"
              style={{ background: statusColor(s) }}
              title={`${DAY_TITLES[i]} · ${statusLabel(s)}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

const DAY_HEADERS = ["M", "T", "W", "T", "F", "S", "S"];
const DAY_TITLES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function statusColor(s: GoalDayStatus): string {
  switch (s) {
    case "done":
      return "#22c55e"; // green-500
    case "skipped":
      return "#f59e0b"; // amber-500
    case "missed":
      return "#fca5a5"; // red-300, softer than full red
    case "future":
    case "no-target":
    case "before-goal":
    default:
      return "#f3f4f6"; // very light grey — same as heatmap no-target
  }
}

function statusLabel(s: GoalDayStatus): string {
  switch (s) {
    case "done":
      return "Done";
    case "skipped":
      return "Skipped";
    case "missed":
      return "Missed";
    case "no-target":
      return "Not scheduled";
    case "before-goal":
      return "Before goal";
    case "future":
      return "Not yet";
  }
}
