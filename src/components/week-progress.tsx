import type { WeekSlot } from "@/lib/goal-week-status";

/**
 * The at-a-glance "this week" row under the headline. Deliberately NOT a grid
 * of squares — squares are the heatmap's language (long-term evidence), and
 * reusing them here made three different concepts (this week's quota, editable
 * recent days, lifetime record) look like the same object. So shape follows
 * job:
 *   - frequency goals → a segmented quota rail ("2 of 5" worth of progress),
 *   - specific-day goals → labeled weekday chips (this week's schedule), where
 *     the chip itself carries the state (done / today / missed / upcoming) so
 *     the signal is legible without a tiny dot.
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
    const done = slots.filter((s) => s.state === "done").length;
    return (
      <div
        className="flex gap-1"
        role="img"
        aria-label={`This week: ${done} of ${slots.length} done`}
      >
        {slots.map((slot, i) => (
          <span
            key={i}
            aria-hidden
            className="h-2 flex-1 rounded-full"
            style={{
              background: slot.state === "done" ? doneColor : "var(--border)",
            }}
          />
        ))}
      </div>
    );
  }

  // Specific-day goals: weekday chips, so it reads as "this week's schedule"
  // (which days are done / today / missed / still upcoming).
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="This week's schedule">
      {slots.map((slot, i) => (
        <span
          key={i}
          aria-label={`${slot.label}: ${STATE_WORD[slot.state]}`}
          className="text-[11px] font-medium rounded-md px-2 py-1"
          style={chipStyle(slot, doneColor)}
        >
          {slot.label}
        </span>
      ))}
    </div>
  );
}

const STATE_WORD: Record<WeekSlot["state"], string> = {
  done: "done",
  today: "today",
  missed: "missed",
  upcoming: "upcoming",
  empty: "upcoming",
};

// The chip's appearance is the signal — done fills with the category color,
// today gets a colored ring, missed reads as a quiet filled gray, upcoming is a
// faint outline. No separate dot.
function chipStyle(slot: WeekSlot, doneColor: string): React.CSSProperties {
  switch (slot.state) {
    case "done":
      return { background: doneColor, color: "#ffffff" };
    case "today":
      return {
        boxShadow: `inset 0 0 0 1.5px ${doneColor}`,
        color: doneColor,
      };
    case "missed":
      return { background: "#f3f4f6", color: "var(--muted)" };
    case "upcoming":
    case "empty":
    default:
      return {
        boxShadow: "inset 0 0 0 1px var(--border)",
        color: "var(--muted)",
      };
  }
}
