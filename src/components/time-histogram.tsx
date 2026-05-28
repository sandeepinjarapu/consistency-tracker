/**
 * 24-bar histogram of check-in times by hour of day. Each bar's height
 * is its hour's share of the max hour's count. Bottom row shows the
 * 12a / 6a / 12p / 6p anchor labels.
 */
export default function TimeHistogram({
  hourly,
  total,
  color,
}: {
  hourly: number[]; // length 24
  total: number;
  color: string;
}) {
  if (total === 0) {
    return (
      <p className="text-xs text-[color:var(--muted)]">
        No check-ins yet — once you log a few, you&apos;ll see when you typically check in.
      </p>
    );
  }
  const max = Math.max(...hourly);
  return (
    <div>
      <div className="flex items-end gap-0.5 h-12">
        {hourly.map((count, hour) => {
          const heightPct = max > 0 ? (count / max) * 100 : 0;
          return (
            <div
              key={hour}
              className="flex-1 rounded-t-sm"
              style={{
                height: count > 0 ? `${Math.max(heightPct, 6)}%` : "2px",
                background: count > 0 ? color : "var(--border)",
                opacity: count > 0 ? 0.85 : 0.4,
              }}
              title={`${formatHour(hour)} · ${count}`}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-[color:var(--muted)] tabular-nums">
        <span>12a</span>
        <span>6a</span>
        <span>12p</span>
        <span>6p</span>
        <span>12a</span>
      </div>
    </div>
  );
}

function formatHour(h: number): string {
  if (h === 0) return "12a";
  if (h === 12) return "12p";
  return h < 12 ? `${h}a` : `${h - 12}p`;
}
