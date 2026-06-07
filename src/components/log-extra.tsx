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
 * A quiet "log something extra" affordance for the Today loop: the goals that
 * aren't scheduled on the logical day, offered as one-tap extra check-ins
 * (done-only — an extra is evidence, never scored, and there is no extra-skip).
 * Each row toggles: tap to log an extra, tap again to undo (via removeExtra). A
 * rare stray skip can be removed but is never overwritten. Collapsed by default
 * so it never competes with the day's actual schedule.
 *
 * During the night-owl window (12 AM – 5 AM), `nightOwl` is true and `date` is
 * yesterday — matching the "Still open from last night" logical day. The copy
 * makes this explicit so the user isn't surprised by an extra landing on a
 * different calendar date than they expected.
 */
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
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<Record<string, "done" | "skipped" | null>>(
    () => Object.fromEntries(goals.map((g) => [g.id, g.status]))
  );

  if (goals.length === 0) return null;

  function toggle(id: string) {
    if (pending) return;
    const prev = status[id] ?? null;
    const next = prev ? null : "done"; // empty → log; logged/skip → remove
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

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-8 inline-flex min-h-[44px] items-center text-xs text-[color:var(--muted)] hover:text-black"
      >
        {nightOwl ? "+ Log something extra from last night" : "+ Log something extra"}
      </button>
    );
  }

  return (
    <div className="mt-8">
      <h2 className="text-xs uppercase tracking-wider text-[color:var(--muted)]">
        {nightOwl ? "Log something extra from last night" : "Log something extra"}
      </h2>
      <p className="mb-3 mt-1 text-xs text-[color:var(--muted)]">
        {nightOwl
          ? "Up late? This logs to yesterday — same day as the rest of your night."
          : "Did one of these today, even though it wasn’t scheduled? It counts as evidence you showed up, never against a streak."}
      </p>
      <ul className="border border-[color:var(--border)] rounded-lg divide-y divide-[color:var(--border)]">
        {goals.map((g) => {
          const st = status[g.id] ?? null;
          const label =
            st === "done"
              ? "✓ Extra logged · Undo"
              : st === "skipped"
                ? "Skipped · Remove"
                : "+ Log extra";
          return (
            <li key={g.id}>
              <button
                type="button"
                onClick={() => toggle(g.id)}
                disabled={pending}
                className="flex w-full min-h-[44px] items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-gray-50 disabled:opacity-60"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: g.categoryColor }}
                  />
                  <span className="truncate text-sm">{g.name}</span>
                </span>
                <span
                  className="shrink-0 text-xs text-[color:var(--muted)]"
                  style={st === "done" ? { color: g.categoryColor } : undefined}
                >
                  {label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
