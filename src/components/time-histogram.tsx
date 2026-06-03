"use client";

import { HoverTip, useHoverTip } from "./tooltip";

// Four parts of day, matching partOfDay() in stats.ts so the bars line up with
// the "You usually do this in the afternoon" insight sentence.
const PARTS: { label: string; from: number; to: number }[] = [
  { label: "Late night", from: 0, to: 4 },
  { label: "Morning", from: 5, to: 11 },
  { label: "Afternoon", from: 12, to: 16 },
  { label: "Evening", from: 17, to: 20 },
  { label: "Night", from: 21, to: 23 },
];

/**
 * When-you-check-in summary, bucketed into four parts of day. Compact and
 * label-led (no 24-bar clutter or "11a" notation) so it reads at a glance.
 * Callers gate on having enough check-ins before rendering this.
 */
export default function TimeHistogram({
  hourly,
  color,
}: {
  hourly: number[]; // length 24
  color: string;
}) {
  const { tip, bind } = useHoverTip();

  const counts = PARTS.map((p) => {
    let sum = 0;
    for (let h = p.from; h <= p.to; h++) sum += hourly[h] ?? 0;
    return sum;
  });
  const max = Math.max(...counts);

  return (
    <div>
      <div className="flex items-end gap-3 h-16">
        {PARTS.map((p, i) => {
          const count = counts[i];
          const heightPct = max > 0 ? (count / max) * 100 : 0;
          return (
            <div
              key={p.label}
              className="flex-1 rounded-t-sm"
              style={{
                height: count > 0 ? `${Math.max(heightPct, 8)}%` : "2px",
                background: count > 0 ? color : "var(--border)",
                opacity: count > 0 ? 0.85 : 0.4,
              }}
              {...bind(`${p.label} · ${count}`)}
            />
          );
        })}
      </div>
      <HoverTip tip={tip} />
      <div className="flex gap-3 mt-1.5 text-[10px] text-[color:var(--muted)]">
        {PARTS.map((p) => (
          <span key={p.label} className="flex-1 text-center">
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}
