"use client";

import { useState } from "react";

/**
 * The "In your own words" list of per-day check-in notes for a week. Long weeks
 * become a wall of text that pushes the grid and writing prompt below the fold,
 * so we show the first few and let the reader expand the rest in place.
 */
const COLLAPSED_COUNT = 3;

export default function ReflectionNotes({
  notes,
}: {
  notes: Array<{ note: string; goalName: string; dateLabel: string }>;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = notes.length > COLLAPSED_COUNT;
  const shown = expanded ? notes : notes.slice(0, COLLAPSED_COUNT);

  return (
    <div>
      <ul className="space-y-2 text-sm max-w-prose">
        {shown.map((n, i) => (
          <li key={i}>
            <p className="italic text-[color:var(--muted)]">&ldquo;{n.note}&rdquo;</p>
            <p className="text-[10px] text-[color:var(--muted)] mt-0.5">
              {n.goalName}, {n.dateLabel}
            </p>
          </li>
        ))}
      </ul>
      {hasMore ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((e) => !e)}
          className="mt-1 inline-flex items-center py-1.5 text-xs text-[color:var(--muted)] hover:text-black"
        >
          {expanded ? "less" : "more"}
        </button>
      ) : null}
    </div>
  );
}
