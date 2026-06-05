"use client";

import { useState } from "react";
import Heatmap, { type HeatmapCell } from "./heatmap";

/**
 * The full-history heatmap, opt-in behind a single in-place toggle. The recent
 * weeks (Week Rows) are the default record; this is the dense year view for
 * people attached to a long-kept goal. The toggle stays put and flips its label
 * and chevron, with the heatmap expanding below it.
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

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-xs text-[color:var(--muted)] hover:text-black"
      >
        {open ? "Hide full history" : "View full history"}
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div className="mt-3">
          <p className="mb-2 text-xs text-[color:var(--muted)]">
            Each square is a day, from the start of this goal.
          </p>
          <Heatmap cells={cells} doneColor={doneColor} schedule={schedule} />
        </div>
      ) : null}
    </div>
  );
}
