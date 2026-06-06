"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markExtraDone } from "@/lib/actions/check-ins";

export type ExtraGoal = {
  id: string;
  name: string;
  categoryColor: string;
  loggedToday: boolean;
};

/**
 * A quiet "log something extra" affordance for the Today loop: the goals that
 * aren't scheduled today, offered as one-tap extra check-ins (done-only — an
 * extra is evidence, never scored, and there is no extra-skip). Collapsed by
 * default so it never competes with the day's actual schedule.
 */
export default function LogExtra({
  goals,
  date,
}: {
  goals: ExtraGoal[];
  date: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [logged, setLogged] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(goals.filter((g) => g.loggedToday).map((g) => [g.id, true]))
  );

  if (goals.length === 0) return null;

  function logExtra(id: string) {
    if (logged[id] || pending) return;
    setLogged((m) => ({ ...m, [id]: true }));
    startTransition(async () => {
      try {
        await markExtraDone(id, date);
        router.refresh();
      } catch {
        setLogged((m) => {
          const n = { ...m };
          delete n[id];
          return n;
        });
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
        + Log something extra
      </button>
    );
  }

  return (
    <div className="mt-8">
      <h2 className="text-xs uppercase tracking-wider text-[color:var(--muted)]">
        Log something extra
      </h2>
      <p className="mb-3 mt-1 text-xs text-[color:var(--muted)]">
        Did one of these today, even though it wasn&rsquo;t scheduled? It counts
        as evidence you showed up, never against a streak.
      </p>
      <ul className="border border-[color:var(--border)] rounded-lg divide-y divide-[color:var(--border)]">
        {goals.map((g) => {
          const isLogged = logged[g.id];
          return (
            <li key={g.id}>
              <button
                type="button"
                onClick={() => logExtra(g.id)}
                disabled={isLogged || pending}
                className="flex w-full min-h-[44px] items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-gray-50 disabled:hover:bg-transparent"
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
                  className="shrink-0 text-xs"
                  style={isLogged ? { color: g.categoryColor } : undefined}
                >
                  {isLogged ? "✓ Extra logged" : "+ Log extra"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
