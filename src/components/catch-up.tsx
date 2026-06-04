"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { backfillCheckIn, clearBackfillCheckIn } from "@/lib/actions/check-ins";
import type { CatchUpDay } from "@/lib/heatmap-backfill";
import { tapTarget } from "@/lib/ui";

const STATUS_LABEL: Record<"done" | "skipped" | "empty", string> = {
  done: "Done",
  skipped: "Skipped",
  empty: "Not logged",
};

/**
 * "Catch up": the finger-friendly editor for recent days. Replaces the old
 * tap-the-heatmap-cell interaction, which was an 11px target with a hover-only
 * label — unusable on touch and easy to mis-tap. Here each editable day is an
 * explicit 44px+ row with a clear Log / Undo action. The heatmap above is now
 * read-only history; this is where the record gets corrected.
 *
 * `days` comes from `recentEditableDays` (server-computed), so the window and
 * statuses match the heatmap exactly. The whole section is omitted upstream
 * when there's nothing editable.
 */
export default function CatchUp({
  goalId,
  days,
  doneColor,
}: {
  goalId: string;
  days: CatchUpDay[];
  doneColor: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Optimistic status per date so a tapped row flips instantly, reconciling to
  // the server on refresh (reverts on failure).
  const [optimistic, setOptimistic] = useOptimistic(
    {} as Record<string, "done" | "empty">,
    (state, o: { date: string; status: "done" | "empty" }) => ({
      ...state,
      [o.date]: o.status,
    })
  );

  const run = (day: CatchUpDay) => {
    if (pending) return;
    const next = day.action === "mark" ? "done" : "empty";
    startTransition(async () => {
      setOptimistic({ date: day.date, status: next });
      try {
        if (day.action === "mark") await backfillCheckIn(goalId, day.date);
        else await clearBackfillCheckIn(goalId, day.date);
        router.refresh();
      } catch {
        // The list only offers days inside the window the server enforces.
      }
    });
  };

  return (
    <div>
      <h3 className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-2">
        Catch up
      </h3>
      <ul className="max-w-md divide-y divide-[color:var(--border)] border-y border-[color:var(--border)]">
        {days.map((day) => {
          // Apply the optimistic override so the row reflects the tap instantly.
          const status =
            optimistic[day.date] != null
              ? optimistic[day.date] === "done"
                ? "done"
                : "empty"
              : day.status;
          const logged = status === "done" || status === "skipped";
          const action: "mark" | "clear" = logged ? "clear" : "mark";
          return (
            <li
              key={day.date}
              className="flex items-center justify-between gap-3 min-h-[44px] py-2"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium w-12">{day.label}</span>
                <span className="text-xs text-[color:var(--muted)]">
                  {day.dateLabel}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[color:var(--muted)]">
                  {STATUS_LABEL[status]}
                </span>
                <button
                  type="button"
                  onClick={() => run({ ...day, status, action })}
                  disabled={pending}
                  className={`${tapTarget} text-xs rounded-md px-4 border transition disabled:opacity-50 ${
                    action === "mark"
                      ? "text-white border-transparent"
                      : "border-[color:var(--border)] text-[color:var(--muted)] hover:border-black hover:text-black"
                  }`}
                  style={
                    action === "mark" ? { background: doneColor } : undefined
                  }
                >
                  {action === "mark" ? "Log" : "Undo"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 max-w-md text-xs text-[color:var(--muted)]">
        Update any day from this week or the last couple of days. Older days lock in.
      </p>
    </div>
  );
}
