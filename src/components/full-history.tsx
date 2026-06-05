"use client";

import { useState } from "react";
import Heatmap, { type HeatmapCell } from "./heatmap";

/**
 * The full-history heatmap, opt-in behind a link. The recent weeks (Week Rows)
 * are the default record; the dense year heatmap is here for people attached to
 * a long-kept goal, without making everyone parse it up front.
 */
export default function FullHistory({
  cells,
  doneColor,
  schedule,
}: {
  cells: HeatmapCell[];
  doneColor: string;
  schedule: { goalStartDate: string; today: string; targetDays: number[] };
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 inline-flex items-center gap-1.5 text-xs text-[color:var(--muted)] hover:text-black"
      >
        View full history
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
    );
  }

  return (
    <div className="mt-4">
      <p className="mb-2 text-xs text-[color:var(--muted)]">
        Each square is a day, from the start of this goal.
      </p>
      <Heatmap cells={cells} doneColor={doneColor} schedule={schedule} />
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="mt-2 text-xs text-[color:var(--muted)] hover:text-black"
      >
        Hide
      </button>
    </div>
  );
}
