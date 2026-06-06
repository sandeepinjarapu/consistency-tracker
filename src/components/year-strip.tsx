import type { MonthData } from "@/lib/month-history";

const MONTH_SHORT = [
  "J", "F", "M", "A", "M", "J",
  "J", "A", "S", "O", "N", "D",
];

/**
 * Tint a hex color toward white. opacity=1 returns the full color,
 * opacity=0 returns white. Used for intensity levels on month blocks.
 */
function tint(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r * opacity + 255 * (1 - opacity))},${Math.round(g * opacity + 255 * (1 - opacity))},${Math.round(b * opacity + 255 * (1 - opacity))})`;
}

/** Intensity opacities for levels 0–4 */
const LEVEL_OPACITY = [0, 0.18, 0.45, 0.72, 1.0];

/**
 * Year strip: older months as a compact grid, one row per calendar year,
 * 12 labeled blocks (Jan–Dec) coloured by intensity level.
 *
 * Months are expected newest-first (same as buildMonthHistory output).
 */
export default function YearStrip({
  months,
  doneColor,
}: {
  months: MonthData[];
  doneColor: string;
}) {
  if (months.length === 0) return null;

  // Group by year, oldest year first for display
  const byYear = new Map<number, MonthData[]>();
  for (const m of months) {
    if (!byYear.has(m.year)) byYear.set(m.year, []);
    byYear.get(m.year)!.push(m);
  }
  const years = Array.from(byYear.keys()).sort((a, b) => a - b);

  return (
    <div className="space-y-3">
      {years.map((year) => {
        const mds = byYear.get(year)!;
        const mdMap = new Map(mds.map((m) => [m.month, m]));

        return (
          <div key={year}>
            <p className="text-[10px] text-[color:var(--muted)] mb-1.5 select-none">
              {year}
            </p>
            <div className="grid grid-cols-12 gap-[3px]">
              {Array.from({ length: 12 }, (_, i) => {
                const month = i + 1;
                const md = mdMap.get(month);
                const bg = md
                  ? tint(doneColor, LEVEL_OPACITY[md.level])
                  : "#f3f4f6";
                const textColor = md && md.level >= 3 ? "rgba(255,255,255,0.8)" : "#bbb";

                return (
                  <div
                    key={month}
                    className="rounded-[3px] flex items-center justify-center select-none"
                    style={{
                      aspectRatio: "1",
                      background: bg,
                      fontSize: 8,
                      color: textColor,
                    }}
                    title={md ? md.label : undefined}
                    aria-label={md ? md.label : `${year}-${String(month).padStart(2, "0")}`}
                  >
                    {MONTH_SHORT[i]}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
