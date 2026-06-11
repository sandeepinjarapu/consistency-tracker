import type { WeekRing } from "@/lib/goal-week-rings";

/** Stroke circumference for r=5: 2π×5 ≈ 31.42 */
const CIRC = 31.42;
/**
 * Minimum arc fraction for extra-only partial weeks (completionRate=0 but
 * extraDone>0). Shows a small sliver so the ring is visually distinct from
 * empty — evidence of engagement without scoring it as progress.
 */
const EXTRA_ONLY_ARC = CIRC * 0.15;

/**
 * A row of mini ring indicators — one per completed ISO week — for a goal row
 * in the Goals list. Each ring mirrors the week-completion ring on the goal
 * detail page, shrunk to 28×28 px. Arc length is proportional to completion
 * rate; a small pip at 12 o'clock marks weeks where extras were logged.
 *
 * not-started rings are filtered out so new goals don't show a wall of dashed
 * outlines. Custom CSS hover tooltips are used (not native browser title) for
 * consistent timing across browsers.
 */
export default function GoalWeekRings({
  rings,
  color,
}: {
  rings: WeekRing[];
  /** Category color (hex or CSS color). Used for arc and pip. */
  color: string;
}) {
  // Suppress weeks that predate the goal — no data, no value in showing them.
  const visibleRings = rings.filter((r) => r.state !== "not-started");
  if (visibleRings.length === 0) return null;

  return (
    <div className="flex items-center gap-[8px]" aria-hidden>
      {visibleRings.map((ring) => (
        <span
          key={ring.weekStart}
          className="relative inline-flex shrink-0 group"
        >
          <RingSvg ring={ring} color={color} />
          {/* Custom tooltip — sits above the ring, centered, hidden until hover */}
          <span
            role="tooltip"
            className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap rounded bg-[#0a0a0a] px-2 py-1 text-[11px] leading-none text-white opacity-0 transition-opacity duration-100 group-hover:opacity-100 z-20"
          >
            {ring.tooltip}
          </span>
        </span>
      ))}
    </div>
  );
}

function RingSvg({ ring, color }: { ring: WeekRing; color: string }) {
  // Not-started: dashed outline only (filtered out above, but kept for completeness)
  if (ring.state === "not-started") {
    return (
      <svg width="28" height="28" viewBox="0 0 14 14" aria-hidden>
        <circle cx="7" cy="7" r="5" fill="none" stroke="#e5e5e5" strokeWidth="1.5" strokeDasharray="3 3" />
      </svg>
    );
  }

  // Empty: solid gray outline, no arc
  if (ring.state === "empty") {
    return (
      <svg width="28" height="28" viewBox="0 0 14 14" aria-hidden>
        <circle cx="7" cy="7" r="5" fill="none" stroke="#e5e5e5" strokeWidth="2" />
      </svg>
    );
  }

  // Skipped: gray outline with a small horizontal bar — "was here, didn't go"
  if (ring.state === "skipped") {
    return (
      <svg width="28" height="28" viewBox="0 0 14 14" aria-hidden>
        <circle cx="7" cy="7" r="5" fill="none" stroke="#e5e5e5" strokeWidth="2" />
        <line x1="4.5" y1="7" x2="9.5" y2="7" stroke="#c4c4c4" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  // partial, met, extra — arc proportional to completionRate
  // Extra-only weeks (completionRate=0, extraDone>0) get a minimum arc so the
  // ring is visually distinct from empty.
  const arc =
    ring.completionRate === 0 && ring.extraDone > 0
      ? EXTRA_ONLY_ARC
      : Math.min(ring.completionRate, 1) * CIRC;

  return (
    <svg width="28" height="28" viewBox="0 0 14 14" aria-hidden>
      {/* Track: light tint of the category color */}
      <circle cx="7" cy="7" r="5" fill="none" stroke={color} strokeWidth="2" opacity="0.15" />
      {/* Arc: completion progress */}
      <circle
        cx="7" cy="7" r="5"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeDasharray={`${arc} ${CIRC}`}
        strokeLinecap="round"
        transform="rotate(-90 7 7)"
      />
      {/* Dot inside ring whenever extras were logged */}
      {ring.extraDone > 0 && (
        <circle cx="7" cy="7" r="1.5" fill={color} />
      )}
    </svg>
  );
}
