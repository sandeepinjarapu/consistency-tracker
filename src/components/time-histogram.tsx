"use client";

import { DAY_START_HOUR } from "@/lib/dates";
import { HoverTip, useHoverTip } from "./tooltip";

// Five parts of day, matching partOfDay() in stats.ts so the bars line up with
// the "You usually do this in the afternoon" insight sentence. The Late night
// edge is the shared DAY_START_HOUR (so the rollover and the bucket can't
// drift). Ordered as a day reads, with the small-hours bucket last (it's the
// tail of the night, not the start of the morning).
const PARTS: { label: string; from: number; to: number }[] = [
  { label: "Morning", from: DAY_START_HOUR, to: 11 },
  { label: "Afternoon", from: 12, to: 16 },
  { label: "Evening", from: 17, to: 20 },
  { label: "Night", from: 21, to: 23 },
  { label: "Late night", from: 0, to: DAY_START_HOUR - 1 },
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
          const unit = count === 1 ? "check-in" : "check-ins";
          const tip = p.label === "Late night"
            ? `${count} ${unit} late into the night`
            : `${count} ${unit} in the ${p.label.toLowerCase()}`;
          return (
            <div
              key={p.label}
              className="flex-1 rounded-t-sm"
              style={{
                height: count > 0 ? `${Math.max(heightPct, 8)}%` : "2px",
                background: count > 0 ? color : "var(--border)",
                opacity: count > 0 ? 0.85 : 0.4,
              }}
              {...bind(tip)}
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
