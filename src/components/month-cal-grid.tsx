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
  trimBefore,
}: {
  year: number;
  month: number;
  cells: HeatmapCell[];
  doneColor: string;
  /** YYYY-MM-DD today string. When provided, future days render as near-invisible
   *  and trailing all-future rows are trimmed from the grid. */
  today?: string;
  /** YYYY-MM-DD. Rows where every day falls before this date are omitted.
   *  Use to strip leading weeks before a goal started. */
  trimBefore?: string;
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

  // Trim trailing rows that are entirely in the future (all days > today).
  if (today) {
    while (rows.length > 0) {
      const last = rows[rows.length - 1];
      const days = last.filter((d) => d !== null) as number[];
      if (days.length > 0 && `${year}-${pad(month)}-${pad(days[0])}` > today) {
        rows.pop();
      } else break;
    }
  }

  // Trim leading rows that are entirely before the goal start date.
  if (trimBefore) {
    while (rows.length > 0) {
      const first = rows[0];
      const days = first.filter((d) => d !== null) as number[];
      if (
        days.length > 0 &&
        `${year}-${pad(month)}-${pad(days[days.length - 1])}` < trimBefore
      ) {
        rows.shift();
      } else break;
    }
  }

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
            // Days before the goal started are also "not applicable" — same
            // visual treatment as future days so they don't look like misses.
            const isPreStart = trimBefore != null && dateStr < trimBefore;
            const isNA = isFuture || isPreStart;

            // color override (aggregate cells) → status color → empty/NA.
            // "extra" (off-target done) is a light tint of the accent: clearly
            // evidence, visibly lighter than a solid scored "done".
            const bg = isNA
              ? "transparent"
              : hc?.color ??
                (status === "done"
                  ? doneColor
                  : status === "extra"
                    ? `color-mix(in srgb, ${doneColor} 30%, white)`
                    : status === "skipped"
                      ? "#fde68a"
                      : status === "missed"
                        ? "#e5e7eb"
                        : "#f3f4f6");

            const textColor = isNA
              ? "#d1d5db"
              : status === "done" && !hc?.color
                ? "rgba(255,255,255,0.85)"
                : status === "skipped" || status === "extra"
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
                title={isNA ? dateStr : (hc?.tooltip ?? dateStr)}
                aria-label={
                  isNA
                    ? `${dateStr}: ${isFuture ? "future" : "not-started"}`
                    : (hc?.tooltip ?? `${dateStr}: ${status}`)
                }
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
