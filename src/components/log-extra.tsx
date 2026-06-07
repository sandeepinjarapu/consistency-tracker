"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { markExtraDone, removeExtra } from "@/lib/actions/check-ins";

export type ExtraGoal = {
  id: string;
  name: string;
  categoryColor: string;
  /** Today's check-in for this off-schedule goal: a logged extra, a stray skip
   *  (left by a cadence edit), or none. */
  status: "done" | "skipped" | null;
};

/**
 * A quiet "did anything else today?" affordance for the Today loop: the goals
 * that aren't scheduled on the logical day, offered as one-tap extra check-ins
 * (done-only — an extra is evidence, never scored, and there is no extra-skip).
 *
 * Layout: 2-column pill grid, max 2 rows (4 chips). When there are more than 4
 * goals the 4th slot becomes "+N more"; tapping it reveals all remaining chips
 * at the same half-width size (never stretched to full row).
 *
 * Optimistic: each chip tracks its own pendingId so tapping one never freezes
 * the others during the server round-trip.
 *
 * During the night-owl window (12 AM – 5 AM), `nightOwl` is true and `date` is
 * yesterday — matching the "Still open from last night" logical day.
 */

// Max chips before the "+N more" slot kicks in.
const MAX_VISIBLE = 4;

export default function LogExtra({
  goals,
  date,
  nightOwl = false,
}: {
  goals: ExtraGoal[];
  date: string;
  nightOwl?: boolean;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<Record<string, "done" | "skipped" | null>>(
    () => Object.fromEntries(goals.map((g) => [g.id, g.status]))
  );

  if (goals.length === 0) return null;

  const hasOverflow = !expanded && goals.length > MAX_VISIBLE;
  // Collapsed: first 3 goal chips + "+N more" in the 4th slot.
  // Expanded: all goal chips (odd count sits at half-width, not stretched).
  const visible = hasOverflow ? goals.slice(0, MAX_VISIBLE - 1) : goals;
  const overflowCount = goals.length - (MAX_VISIBLE - 1);

  async function toggle(id: string) {
    if (pendingIds.has(id)) return;
    const prev = status[id] ?? null;
    const next = prev ? null : "done";
    setStatus((s) => ({ ...s, [id]: next }));
    setPendingIds((s) => new Set(s).add(id));
    try {
      await (next === "done" ? markExtraDone(id, date) : removeExtra(id, date));
      router.refresh();
    } catch {
      setStatus((s) => ({ ...s, [id]: prev }));
    } finally {
      setPendingIds((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  }

  return (
    <div className="mt-8">
      <p className="text-xs text-[color:var(--muted)] mb-2">
        {nightOwl ? "Did anything else last night?" : "Did anything else today?"}
      </p>

      <div className="grid grid-cols-2 gap-2">
        {visible.map((g) => {
          const st = status[g.id] ?? null;
          const isDone = st === "done";
          const isSkip = st === "skipped";
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => toggle(g.id)}
              disabled={pendingIds.has(g.id)}
              aria-pressed={isDone}
              aria-label={
                isDone
                  ? `Remove extra check-in for ${g.name}`
                  : isSkip
                    ? `Remove skipped check-in for ${g.name}`
                    : `Add extra check-in for ${g.name}`
              }
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-3 py-1 text-sm transition disabled:opacity-50
                ${isDone
                  ? "border-[color:var(--border)] bg-gray-50"
                  : "border-[color:var(--border)] bg-white hover:bg-gray-50"
                }`}
            >
              {isDone ? (
                <span aria-hidden className="text-xs shrink-0" style={{ color: g.categoryColor }}>✓</span>
              ) : (
                <span aria-hidden className="w-2 h-2 rounded-full shrink-0" style={{ background: isSkip ? undefined : g.categoryColor }} />
              )}
              <span
                className={`min-w-0 truncate${
                  isDone
                    ? " line-through text-[color:var(--muted)]"
                    : isSkip
                      ? " text-[color:var(--muted)]"
                      : ""
                }`}
              >
                {g.name}
              </span>
            </button>
          );
        })}

        {hasOverflow && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-dashed border-[color:var(--border)] px-3 py-1 text-sm text-[color:var(--muted)] hover:bg-gray-50 transition"
          >
            +{overflowCount} more
          </button>
        )}
      </div>

      {nightOwl && (
        <p className="mt-2 text-xs text-[color:var(--muted)]">
          Logs to yesterday — same day as the rest of your night.
        </p>
      )}
    </div>
  );
}
