"use client";

import { useState, useTransition } from "react";
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
 * Each chip toggles: tap to log an extra, tap again to undo (via removeExtra).
 * A rare stray skip can be removed but is never overwritten.
 *
 * Up to INITIAL_VISIBLE chips are shown by default; a "+N more" chip expands
 * the rest so the section stays compact when many goals are off-schedule.
 *
 * During the night-owl window (12 AM – 5 AM), `nightOwl` is true and `date` is
 * yesterday — matching the "Still open from last night" logical day.
 */

const INITIAL_VISIBLE = 3;

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
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<Record<string, "done" | "skipped" | null>>(
    () => Object.fromEntries(goals.map((g) => [g.id, g.status]))
  );

  if (goals.length === 0) return null;

  const visible = expanded ? goals : goals.slice(0, INITIAL_VISIBLE);
  const hiddenCount = goals.length - INITIAL_VISIBLE;

  function toggle(id: string) {
    if (pending) return;
    const prev = status[id] ?? null;
    const next = prev ? null : "done";
    setStatus((s) => ({ ...s, [id]: next }));
    startTransition(async () => {
      try {
        await (next === "done" ? markExtraDone(id, date) : removeExtra(id, date));
        router.refresh();
      } catch {
        setStatus((s) => ({ ...s, [id]: prev }));
      }
    });
  }

  return (
    <div className="mt-8">
      <p className="text-xs text-[color:var(--muted)] mb-2">
        {nightOwl ? "Did anything else last night?" : "Did anything else today?"}
      </p>
      <div className="flex flex-wrap gap-2">
        {visible.map((g) => {
          const st = status[g.id] ?? null;
          const isDone = st === "done";
          const isSkip = st === "skipped";
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => toggle(g.id)}
              disabled={pending}
              aria-pressed={isDone}
              aria-label={
                isDone
                  ? `Remove extra check-in for ${g.name}`
                  : isSkip
                    ? `Remove skipped check-in for ${g.name}`
                    : `Add extra check-in for ${g.name}`
              }
              className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition disabled:opacity-60
                ${isDone
                  ? "border-[color:var(--border)] bg-gray-50"
                  : "border-[color:var(--border)] hover:bg-gray-50"
                }`}
            >
              {isDone ? (
                <span
                  aria-hidden
                  className="text-xs"
                  style={{ color: g.categoryColor }}
                >
                  ✓
                </span>
              ) : (
                <span
                  aria-hidden
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: isSkip ? undefined : g.categoryColor }}
                />
              )}
              <span
                className={`max-w-[160px] truncate${
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

        {!expanded && hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="inline-flex min-h-[44px] items-center rounded-full border border-dashed border-[color:var(--border)] px-3 py-1 text-sm text-[color:var(--muted)] hover:bg-gray-50 transition"
          >
            +{hiddenCount} more
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
