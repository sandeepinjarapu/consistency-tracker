"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { addDays, dayOfWeekForDateString } from "@/lib/dates";
import { backfillCheckIn, clearBackfillCheckIn } from "@/lib/actions/check-ins";
import { backfillAction } from "@/lib/heatmap-backfill";
import HeatmapScroller from "./heatmap-scroller";

export type CellStatus = "done" | "skipped" | "missed" | "empty";

export type HeatmapCell = {
  date: string; // YYYY-MM-DD
  status: CellStatus;
  /** Optional override color (used by aggregate heatmap to encode intensity) */
  color?: string;
  /** Optional override tooltip text */
  tooltip?: string;
};

const CELL = 11; // px
const GAP = 3; // px
const COL = CELL + GAP; // 14
const ROW = CELL + GAP;
const LEFT_GUTTER = 28; // for day labels
const TOP_GUTTER = 18; // for month labels

const COLOR: Record<CellStatus, string> = {
  empty: "#f3f4f6",
  missed: "#e5e7eb",
  skipped: "#fde68a",
  done: "#22c55e",
};

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const DAY_LABELS_SHOWN: Record<number, string> = {
  1: "Mon",
  3: "Wed",
  5: "Fri",
};

/**
 * GitHub-style heatmap. Renders a 7×N grid of cells where each column is
 * an ISO week and each row is a day of week (Sunday on top, Saturday on
 * bottom).
 *
 * Pass an array of cells covering whatever date range you want — the
 * component will pad with `empty` cells on the left so the first column
 * starts on a Sunday.
 */
export type HeatmapEditable = {
  goalId: string;
  goalStartDate: string;
  today: string;
  targetDays: number[];
};

export default function Heatmap({
  cells,
  doneColor = COLOR.done,
  hideLegend = false,
  editable,
}: {
  cells: HeatmapCell[];
  doneColor?: string;
  hideLegend?: boolean;
  editable?: HeatmapEditable;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const runBackfill = (cell: HeatmapCell, action: "mark" | "clear") => {
    if (!editable || pending) return;
    startTransition(async () => {
      try {
        if (action === "mark") await backfillCheckIn(editable.goalId, cell.date);
        else await clearBackfillCheckIn(editable.goalId, cell.date);
        router.refresh();
      } catch {
        // ignore — the UI only offers cells inside the window the server enforces
      }
    });
  };

  if (cells.length === 0) {
    return (
      <p className="text-xs text-[color:var(--muted)]">
        No data yet — mark a check-in to see your heatmap fill in.
      </p>
    );
  }

  // Index cells for lookup
  const cellMap = new Map(cells.map((c) => [c.date, c]));

  const firstDate = cells[0].date;
  const lastDate = cells[cells.length - 1].date;

  // Pad start so column 0 begins on Sunday
  const firstDow = dayOfWeekForDateString(firstDate);
  const gridStart = addDays(firstDate, -firstDow);

  // Pad end so the last column ends on Saturday (so columns are uniform)
  const lastDow = dayOfWeekForDateString(lastDate);
  const gridEnd = addDays(lastDate, 6 - lastDow);

  // Build grid columns
  const columns: { weekStart: string; cells: (HeatmapCell | null)[] }[] = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    const weekCells: (HeatmapCell | null)[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(cursor, i);
      if (d < firstDate || d > lastDate) {
        weekCells.push(null); // padding outside our window
      } else {
        weekCells.push(cellMap.get(d) ?? { date: d, status: "empty" });
      }
    }
    columns.push({ weekStart: cursor, cells: weekCells });
    cursor = addDays(cursor, 7);
  }

  // Month labels: place at the column where the month changes
  const monthLabels: { col: number; label: string }[] = [];
  let prevMonth = -1;
  columns.forEach((col, i) => {
    const month = parseInt(col.weekStart.split("-")[1], 10) - 1;
    if (month !== prevMonth) {
      monthLabels.push({ col: i, label: MONTH_LABELS[month] });
      prevMonth = month;
    }
  });

  const width = LEFT_GUTTER + columns.length * COL;
  const height = TOP_GUTTER + 7 * ROW;

  const colorFor = (cell: HeatmapCell) =>
    cell.color ?? (cell.status === "done" ? doneColor : COLOR[cell.status]);

  return (
    <>
      <HeatmapScroller>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Consistency heatmap"
        style={pending ? { opacity: 0.6 } : undefined}
      >
        {/* Month labels */}
        {monthLabels.map((m, i) => {
          // Suppress if too close to the previous one
          if (i > 0 && m.col - monthLabels[i - 1].col < 3) return null;
          return (
            <text
              key={`${m.col}-${m.label}`}
              x={LEFT_GUTTER + m.col * COL}
              y={12}
              fontSize={10}
              fill="#6b7280"
            >
              {m.label}
            </text>
          );
        })}

        {/* Day-of-week labels */}
        {Object.entries(DAY_LABELS_SHOWN).map(([dow, label]) => (
          <text
            key={dow}
            x={0}
            y={TOP_GUTTER + parseInt(dow, 10) * ROW + CELL - 2}
            fontSize={9}
            fill="#9ca3af"
          >
            {label}
          </text>
        ))}

        {/* Cells */}
        {columns.map((col, ci) =>
          col.cells.map((cell, ri) => {
            if (cell === null) return null;
            const x = LEFT_GUTTER + ci * COL;
            const y = TOP_GUTTER + ri * ROW;
            const action = editable
              ? backfillAction(cell, {
                  goalStartDate: editable.goalStartDate,
                  today: editable.today,
                  targetDays: editable.targetDays,
                })
              : null;
            const baseTip = cell.tooltip ?? tooltipFor(cell);
            return (
              <rect
                key={`${ci}-${ri}`}
                x={x}
                y={y}
                width={CELL}
                height={CELL}
                rx={2}
                ry={2}
                fill={colorFor(cell)}
                style={action ? { cursor: "pointer" } : undefined}
                onClick={action ? () => runBackfill(cell, action) : undefined}
              >
                <title>
                  {action
                    ? `${baseTip} — click to ${action === "clear" ? "undo" : "log"}`
                    : baseTip}
                </title>
              </rect>
            );
          })
        )}
      </svg>
      </HeatmapScroller>

      {!hideLegend && (
        <div className="mt-2 flex items-center gap-4 text-[10px] text-[color:var(--muted)]">
          <LegendDot color={COLOR.empty} label="Off-day" />
          <LegendDot color={COLOR.missed} label="Missed" />
          <LegendDot color={COLOR.skipped} label="Skipped" />
          <LegendDot color={doneColor} label="Done" />
        </div>
      )}
    </>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        aria-hidden
        className="inline-block rounded-sm"
        style={{ width: 9, height: 9, background: color }}
      />
      {label}
    </span>
  );
}

function tooltipFor(cell: HeatmapCell): string {
  const date = formatDate(cell.date);
  switch (cell.status) {
    case "done": return `${date} · Done`;
    case "skipped": return `${date} · Skipped`;
    case "missed": return `${date} · Missed`;
    case "empty": return `${date} · Not scheduled`;
  }
}

function formatDate(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
