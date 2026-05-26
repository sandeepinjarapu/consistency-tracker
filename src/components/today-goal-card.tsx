"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  markDone,
  markSkipped,
  unmark,
  type CheckIn,
  type SkipReason,
} from "@/lib/actions/check-ins";

const REASON_LABELS: Record<SkipReason, string> = {
  travel: "Travel",
  illness: "Illness",
  mood: "Bad mood",
  other: "Other",
};

export default function TodayGoalCard({
  goalId,
  name,
  description,
  categoryColor,
  date,
  checkIn,
}: {
  goalId: string;
  name: string;
  description: string | null;
  categoryColor: string;
  date: string;
  checkIn: CheckIn | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showSkipMenu, setShowSkipMenu] = useState(false);

  function run(fn: () => Promise<void>) {
    setShowSkipMenu(false);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch {
        // swallow — RLS errors shouldn't occur for own goals
      }
    });
  }

  return (
    <div className="flex items-center gap-4 border border-[color:var(--border)] rounded-lg px-4 py-3">
      <span
        aria-hidden
        className="w-1 self-stretch rounded-full"
        style={{ background: categoryColor }}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{name}</p>
        {description ? (
          <p className="text-xs text-[color:var(--muted)] mt-0.5 truncate">
            {description}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-2 relative">
        {checkIn?.status === "done" ? (
          <>
            <span className="text-xs text-green-700 font-medium">✓ Done</span>
            <button
              onClick={() => run(() => unmark(goalId, date))}
              disabled={pending}
              className="text-xs text-[color:var(--muted)] hover:text-black disabled:opacity-50"
            >
              Undo
            </button>
          </>
        ) : checkIn?.status === "skipped" ? (
          <>
            <span className="text-xs text-amber-700 font-medium">
              ⏭ Skipped{checkIn.skip_reason ? ` · ${REASON_LABELS[checkIn.skip_reason]}` : ""}
            </span>
            <button
              onClick={() => run(() => unmark(goalId, date))}
              disabled={pending}
              className="text-xs text-[color:var(--muted)] hover:text-black disabled:opacity-50"
            >
              Undo
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => run(() => markDone(goalId, date))}
              disabled={pending}
              className="text-xs border border-[color:var(--border)] rounded-md px-3 py-1.5 hover:border-black hover:bg-gray-50 disabled:opacity-50"
            >
              Mark done
            </button>
            <div className="relative">
              <button
                onClick={() => setShowSkipMenu((s) => !s)}
                disabled={pending}
                className="text-xs text-[color:var(--muted)] hover:text-black px-2 py-1.5 disabled:opacity-50"
              >
                Skip ▾
              </button>
              {showSkipMenu ? (
                <div className="absolute right-0 top-full mt-1 z-10 bg-white border border-[color:var(--border)] rounded-md shadow-sm py-1 w-32">
                  {(Object.keys(REASON_LABELS) as SkipReason[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => run(() => markSkipped(goalId, date, r))}
                      className="block w-full text-left text-xs px-3 py-1.5 hover:bg-gray-50"
                    >
                      {REASON_LABELS[r]}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
