"use client";

import { useState } from "react";
import { buildMonthHistory } from "@/lib/month-history";
import GoalHistoryView from "./goal-history-view";

/**
 * The full-history view, opt-in behind a single in-place toggle.
 * The recent weeks (WeekRows) remain the default record; this is the
 * calendar month view for people invested in a long-kept goal.
 */
export default function FullHistory({
  checkIns,
  doneColor,
  goalStartDate,
  targetDays,
  weeklyTarget,
  today,
  historyStart,
}: {
  checkIns: Array<{ date: string; status: "done" | "skipped" }>;
  doneColor: string;
  goalStartDate: string;
  targetDays: number[];
  weeklyTarget: number | null | undefined;
  today: string;
  /** Earliest date check-ins were fetched for (clamps older history). */
  historyStart: string;
}) {
  const [open, setOpen] = useState(false);

  const { recentMonths, olderMonths } = buildMonthHistory({
    checkIns,
    goalStartDate,
    targetDays,
    weeklyTarget,
    today,
    historyStart,
  });

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-xs text-[color:var(--muted)] hover:text-black"
      >
        {open ? "Hide history" : "View history"}
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
          <GoalHistoryView
            recentMonths={recentMonths}
            olderMonths={olderMonths}
            doneColor={doneColor}
            isCount={weeklyTarget != null}
            today={today}
          />
        </div>
      ) : null}
    </div>
  );
}
