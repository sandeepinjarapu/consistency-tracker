import type { WeekSlot } from "@/lib/goal-week-status";

/**
 * The at-a-glance "this week" row under the headline. Deliberately NOT a grid
 * of squares — squares are the heatmap's language (long-term evidence), and
 * reusing them here made three different concepts (this week's quota, editable
 * recent days, lifetime record) look like the same object. So shape follows
 * job:
 *   - frequency goals → a segmented quota rail ("2 of 5" worth of progress),
 *   - specific-day goals → labeled weekday markers (this week's schedule).
 * Purely presentational — slot computation lives in goal-week-status.
 */
export default function WeekProgress({
  slots,
  doneColor,
}: {
  slots: WeekSlot[];
  doneColor: string;
}) {
  if (slots.length === 0) return null;
  const labeled = slots.some((s) => s.label != null);

  // Frequency goals: a calm horizontal rail of N segments, filled by progress.
  if (!labeled) {
    return (
      <div className="flex gap-1" aria-hidden>
        {slots.map((slot, i) => (
          <span
            key={i}
            className="h-2 flex-1 rounded-full"
            style={{
              background:
                slot.state === "done" ? doneColor : "var(--border)",
            }}
          />
        ))}
      </div>
    );
  }

  // Specific-day goals: weekday markers, so it reads as "this week's schedule"
  // (which days are done / today / missed / still upcoming) rather than a chart.
  return (
    <div className="flex flex-wrap gap-2">
      {slots.map((slot, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1.5 text-xs"
          style={markerColor(slot, doneColor)}
        >
          <span
            aria-hidden
            className="h-2 w-2 rounded-full"
            style={dotStyle(slot, doneColor)}
          />
          {slot.label}
        </span>
      ))}
    </div>
  );
}

// The label color: muted for upcoming/empty, normal otherwise.
function markerColor(slot: WeekSlot, doneColor: string): React.CSSProperties {
  switch (slot.state) {
    case "done":
      return { color: doneColor };
    case "missed":
    case "upcoming":
    case "empty":
      return { color: "var(--muted)" };
    case "today":
    default:
      return { color: "var(--foreground)", fontWeight: 500 };
  }
}

function dotStyle(slot: WeekSlot, doneColor: string): React.CSSProperties {
  switch (slot.state) {
    case "done":
      return { background: doneColor };
    case "today":
      return { boxShadow: `inset 0 0 0 2px ${doneColor}` };
    case "missed":
      return { background: "#e5e7eb" };
    case "upcoming":
    case "empty":
    default:
      return { boxShadow: "inset 0 0 0 1px var(--border)" };
  }
}
