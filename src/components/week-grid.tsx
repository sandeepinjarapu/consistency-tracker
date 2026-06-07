"use client";

import type { GoalWeekStats, GoalDayStatus } from "@/lib/reflection-stats";
import { addDays } from "@/lib/dates";
import { HoverTip, useHoverTip } from "./tooltip";

/**
 * Mini per-goal × day-of-week grid for a single ISO week (Mon..Sun).
 * Each cell shows the status (done/skipped/missed/etc) as a small colored
 * square — same visual vocabulary as the year heatmap, week-scaled.
 */
export default function WeekGrid({
  perGoal,
  weekStart,
}: {
  perGoal: GoalWeekStats[];
  /** ISO week start (Monday, YYYY-MM-DD). When provided, tooltips include the date. */
  weekStart?: string;
}) {
  const { tip, bind } = useHoverTip();
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
          <div className="text-xs truncate pr-2" {...bind(g.goalName)}>
            {g.goalName}
          </div>
          {g.dailyStatus.map((s, i) => (
            <div
              key={i}
              className="h-4 rounded-sm"
              style={{ background: statusColor(s) }}
              {...bind(dayTooltip(i, s, weekStart))}
            />
          ))}
        </div>
      ))}
      <HoverTip tip={tip} />
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
    case "extra":
      return "#bbf7d0"; // light green — evidence, lighter than a scored done
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

function dayTooltip(dayIndex: number, s: GoalDayStatus, weekStart?: string): string {
  const label = statusLabel(s);
  if (!weekStart) return `${DAY_TITLES[dayIndex]} · ${label}`;
  const date = addDays(weekStart, dayIndex);
  const [y, m, d] = date.split("-").map(Number);
  const dateStr = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  return `${dateStr} · ${label}`;
}

function statusLabel(s: GoalDayStatus): string {
  switch (s) {
    case "done":
      return "Done";
    case "extra":
      return "Extra";
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
