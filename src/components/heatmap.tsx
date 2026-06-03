"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
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
  schedule,
}: {
  cells: HeatmapCell[];
  doneColor?: string;
  hideLegend?: boolean;
  editable?: HeatmapEditable;
  // Read-only schedule context for tooltip disambiguation (e.g. the partner
  // view, which renders someone else's goal without click-to-edit). Lets an
  // "empty" cell read "not logged" vs "not scheduled" without making it
  // editable. `editable` already carries the same fields and takes precedence.
  schedule?: { goalStartDate: string; today: string; targetDays: number[] };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Optimistic per-date status overrides so a clicked cell fills/clears
  // instantly; reconciles to the server cells on refresh (reverts on failure).
  const [overrides, addOverride] = useOptimistic(
    {} as Record<string, CellStatus>,
    (state, o: { date: string; status: CellStatus }) => ({
      ...state,
      [o.date]: o.status,
    })
  );

  // Custom tooltip: the native SVG <title> has a long, browser-controlled
  // show-delay. Track the hovered cell and render our own near-instant
  // tooltip instead. ~120ms delay avoids flicker when sweeping across cells.
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(
    null
  );
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showTip = (x: number, y: number, text: string) => {
    if (tipTimer.current) clearTimeout(tipTimer.current);
    tipTimer.current = setTimeout(() => setTip({ x, y, text }), 120);
  };
  const hideTip = () => {
    if (tipTimer.current) clearTimeout(tipTimer.current);
    setTip(null);
  };
  useEffect(() => () => {
    if (tipTimer.current) clearTimeout(tipTimer.current);
  }, []);

  const runBackfill = (cell: HeatmapCell, action: "mark" | "clear") => {
    if (!editable || pending) return;
    startTransition(async () => {
      addOverride({ date: cell.date, status: action === "mark" ? "done" : "empty" });
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
        // overflow visible so the hover tooltip isn't clipped by a narrow grid
        // (e.g. the compact all-goals summary). The enclosing scroller is far
        // wider than a compact grid, so the tooltip simply spills into it.
        style={{ overflow: "visible", ...(pending ? { opacity: 0.6 } : {}) }}
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
          col.cells.map((rawCell, ri) => {
            if (rawCell === null) return null;
            // Apply optimistic override so a clicked cell reflects instantly.
            const override = overrides[rawCell.date];
            const cell =
              override && override !== rawCell.status
                ? { ...rawCell, status: override }
                : rawCell;
            const x = LEFT_GUTTER + ci * COL;
            const y = TOP_GUTTER + ri * ROW;
            const action = editable
              ? backfillAction(cell, {
                  goalStartDate: editable.goalStartDate,
                  today: editable.today,
                  targetDays: editable.targetDays,
                })
              : null;
            const baseTip = cell.tooltip ?? tooltipFor(cell, editable ?? schedule);
            const tipText = action
              ? `${baseTip} — click to ${action === "clear" ? "undo" : "log"}`
              : baseTip;
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
                aria-label={tipText}
                style={action ? { cursor: "pointer" } : undefined}
                onClick={action ? () => runBackfill(cell, action) : undefined}
                onMouseEnter={() => showTip(x, y, tipText)}
                onMouseLeave={hideTip}
              />
            );
          })
        )}

        {tip ? <CellTooltip {...tip} svgWidth={width} /> : null}
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

/**
 * Near-instant SVG tooltip rendered above (or below, near the top rows) the
 * hovered cell. Width is estimated from text length; the box is clamped to
 * stay within the SVG. pointer-events disabled so it never steals hover.
 */
function CellTooltip({
  x,
  y,
  text,
  svgWidth,
}: {
  x: number;
  y: number;
  text: string;
  svgWidth: number;
}) {
  const charW = 6.1;
  const padX = 7;
  const h = 18;
  const w = Math.ceil(text.length * charW) + padX * 2;
  const cx = x + CELL / 2;
  // When the grid is wide enough to hold the tooltip, clamp it inside (no
  // overflow). When it isn't (a compact grid), center on the cell and let it
  // spill right — the SVG uses overflow:visible so it stays readable.
  const rightBound = svgWidth - w - 2;
  const rectX =
    rightBound >= 2
      ? Math.max(2, Math.min(cx - w / 2, rightBound))
      : Math.max(2, cx - w / 2);
  const below = y - (h + 6) < TOP_GUTTER;
  const rectY = below ? y + CELL + 6 : y - h - 6;
  return (
    <g pointerEvents="none">
      <rect x={rectX} y={rectY} width={w} height={h} rx={4} ry={4} fill="#0a0a0a" opacity={0.92} />
      <text
        x={rectX + w / 2}
        y={rectY + 13}
        fontSize={11}
        fill="#ffffff"
        textAnchor="middle"
      >
        {text}
      </text>
    </g>
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

function tooltipFor(
  cell: HeatmapCell,
  ctx?: { goalStartDate: string; today: string; targetDays: number[] }
): string {
  const date = formatDate(cell.date);
  switch (cell.status) {
    case "done": return `${date} · Done`;
    case "skipped": return `${date} · Skipped`;
    case "missed": return `${date} · Missed`;
    case "empty": {
      // "empty" is overloaded: a genuine off-day, a future/pre-goal day, today
      // before it's logged, or a count-goal gap. When the goal's schedule is
      // known (the editable detail view), distinguish a scheduled-but-unlogged
      // day from a day that simply isn't scheduled.
      if (ctx) {
        const dow = dayOfWeekForDateString(cell.date);
        const inRange = cell.date >= ctx.goalStartDate && cell.date <= ctx.today;
        if (inRange && ctx.targetDays.includes(dow)) {
          return cell.date === ctx.today
            ? `${date} · Today — not logged yet`
            : `${date} · Not logged`;
        }
      }
      return `${date} · Not scheduled`;
    }
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
