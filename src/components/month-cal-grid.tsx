import type { HeatmapCell } from "./heatmap";

const MONTH_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DOW_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

/** Monday-indexed day of week (Mon=0 … Sun=6) for a YYYY-MM-DD string. */
function monDow(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun
  return jsDay === 0 ? 6 : jsDay - 1;
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * One month rendered as a 7-column calendar grid (Mon–Sun).
 * Handles both per-goal cells (status-coloured) and aggregate cells
 * (override colour via cell.color, same pattern as heatmap.tsx).
 */
export default function MonthCalGrid({
  year,
  month,
  cells,
  doneColor,
  today,
}: {
  year: number;
  month: number;
  cells: HeatmapCell[];
  doneColor: string;
  /** YYYY-MM-DD today string. When provided, future days render as near-invisible
   *  so they're clearly distinct from past empty/non-scheduled cells. */
  today?: string;
}) {
  const cellMap = new Map(cells.map((c) => [c.date, c]));
  const totalDays = daysInMonth(year, month);
  const firstStr = `${year}-${pad(month)}-01`;
  const startOffset = monDow(firstStr); // leading empty cells

  // Build rows (weeks), padding start and end to fill 7 columns
  const slots: Array<number | null> = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  // Pad to a full row at the end
  while (slots.length % 7 !== 0) slots.push(null);

  const rows: Array<Array<number | null>> = [];
  for (let i = 0; i < slots.length; i += 7) rows.push(slots.slice(i, i + 7));

  return (
    <div>
      <p className="text-xs font-medium text-[color:var(--foreground)] mb-2">
        {MONTH_FULL[month - 1]} {year}
      </p>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 gap-[3px] mb-[3px]">
        {DOW_LABELS.map((label, i) => (
          <div
            key={i}
            className="text-center text-[9px] text-[color:var(--muted)] select-none"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Week rows */}
      {rows.map((row, ri) => (
        <div key={ri} className="grid grid-cols-7 gap-[3px] mb-[3px]">
          {row.map((day, ci) => {
            if (day === null) return <div key={ci} />;

            const dateStr = `${year}-${pad(month)}-${pad(day)}`;
            const hc = cellMap.get(dateStr);
            const status = hc?.status ?? "empty";
            const isFuture = today != null && dateStr > today;

            // Future cells are near-invisible — they occupy grid space but
            // clearly haven't happened yet (distinct from "empty past" cells).
            // color override (aggregate cells) → status color → empty/future
            const bg = isFuture
              ? "transparent"
              : hc?.color ??
                (status === "done"
                  ? doneColor
                  : status === "skipped"
                    ? "#fde68a"
                    : status === "missed"
                      ? "#e5e7eb"
                      : "#f3f4f6");

            const textColor = isFuture
              ? "#d1d5db"
              : status === "done" && !hc?.color
                ? "rgba(255,255,255,0.85)"
                : status === "skipped"
                  ? "#78716c"
                  : "#bbb";

            return (
              <div
                key={ci}
                className="rounded-[3px] flex items-center justify-center"
                style={{
                  aspectRatio: "1",
                  background: bg,
                  fontSize: 8,
                  color: textColor,
                  fontVariantNumeric: "tabular-nums",
                }}
                title={hc?.tooltip ?? dateStr}
                aria-label={`${dateStr}: ${isFuture ? "future" : status}`}
              >
                {day}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
