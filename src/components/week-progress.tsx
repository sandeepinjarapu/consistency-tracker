import type { WeekSlot } from "@/lib/goal-week-status";

/**
 * The at-a-glance "this week" row that sits under the headline. Specific-day
 * goals show labeled weekday slots; frequency goals show anonymous target
 * slots. Purely presentational — slot computation lives in goal-week-status.
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
  return (
    <div className="flex gap-1.5">
      {slots.map((slot, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <span
            aria-hidden
            className="h-6 w-6 rounded"
            style={slotStyle(slot, doneColor)}
          />
          {labeled ? (
            <span className="text-[10px] text-[color:var(--muted)]">
              {slot.label}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function slotStyle(
  slot: WeekSlot,
  doneColor: string
): React.CSSProperties {
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
