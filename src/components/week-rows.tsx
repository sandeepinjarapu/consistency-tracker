"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { backfillCheckIn, clearBackfillCheckIn } from "@/lib/actions/check-ins";
import type { GridWeek, GridCell, GridCellState } from "@/lib/week-rows";

const WEEKDAY = ["M", "T", "W", "T", "F", "S", "S"];
const DOW_NAME = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * The goal-detail record AND editor: one row per ISO week, Monday on the left.
 * The current week is interactive — editable cells look like controls (a check
 * you can undo, today's accent ring, a dashed "open" well you can fill); locked
 * history cells are flat paint. The editable set is whatever the server allows
 * (it re-checks via `backfillCheckIn`/`clearBackfillCheckIn`), so a tap that
 * shouldn't land simply reverts.
 *
 * Logging is one tap; removing a logged day asks first (a soft confirm), so a
 * mis-tap never silently deletes a check-in.
 */
export default function WeekRows({
  goalId,
  today,
  weeks,
  isCount,
  doneColor,
}: {
  goalId: string;
  today: string;
  weeks: GridWeek[];
  isCount: boolean;
  doneColor: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [override, setOverride] = useState<Record<string, "done" | "empty">>({});
  const [confirm, setConfirm] = useState<string | null>(null);

  function effective(cell: GridCell): GridCell {
    const ov = override[cell.date];
    if (ov === "done") return { ...cell, state: "done", editable: true };
    if (ov === "empty")
      return {
        ...cell,
        state: cell.date === today ? "today" : "open",
        editable: true,
      };
    return cell;
  }

  function log(date: string) {
    if (pending) return;
    setOverride((o) => ({ ...o, [date]: "done" }));
    startTransition(async () => {
      try {
        await backfillCheckIn(goalId, date);
        router.refresh();
      } catch {
        setOverride((o) => {
          const n = { ...o };
          delete n[date];
          return n;
        });
      }
    });
  }

  function remove(date: string) {
    setConfirm(null);
    if (pending) return;
    setOverride((o) => ({ ...o, [date]: "empty" }));
    startTransition(async () => {
      try {
        await clearBackfillCheckIn(goalId, date);
        router.refresh();
      } catch {
        setOverride((o) => {
          const n = { ...o };
          delete n[date];
          return n;
        });
      }
    });
  }

  function onCell(cell: GridCell) {
    if (!cell.editable) return;
    if (cell.state === "done" || cell.state === "skipped") setConfirm(cell.date);
    else log(cell.date);
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-max">
        {/* weekday header */}
        <div className="flex gap-1.5 pl-[68px] mb-2">
          {WEEKDAY.map((d, i) => (
            <span
              key={i}
              className="w-9 text-center text-[10px] text-[color:var(--muted)]"
            >
              {d}
            </span>
          ))}
        </div>

        {weeks.map((week) => (
          <div
            key={week.weekStart}
            className={`flex items-center ${
              week.isCurrent ? "rounded-xl py-2 -mx-1.5 px-1.5 my-0.5" : "py-0.5"
            }`}
            style={week.isCurrent ? { background: washOf(doneColor) } : undefined}
          >
            <span
              className={`w-[68px] shrink-0 text-xs ${
                week.isCurrent
                  ? "font-semibold text-[color:var(--foreground)]"
                  : "text-[color:var(--muted)]"
              }`}
            >
              {week.label}
            </span>
            <div className="flex gap-1.5">
              {week.cells.map((raw, i) => {
                const cell = effective(raw);
                return (
                  <Cell
                    key={cell.date}
                    cell={cell}
                    dowName={DOW_NAME[i]}
                    isCount={isCount}
                    doneColor={doneColor}
                    confirming={confirm === cell.date}
                    onClick={() => onCell(cell)}
                    onConfirmRemove={() => remove(cell.date)}
                    onCancel={() => setConfirm(null)}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Cell({
  cell,
  dowName,
  isCount,
  doneColor,
  confirming,
  onClick,
  onConfirmRemove,
  onCancel,
}: {
  cell: GridCell;
  dowName: string;
  isCount: boolean;
  doneColor: string;
  confirming: boolean;
  onClick: () => void;
  onConfirmRemove: () => void;
  onCancel: () => void;
}) {
  const base = "w-9 h-9 rounded-[10px] grid place-items-center shrink-0 relative";
  const aria = `${dowName} ${formatDate(cell.date)}: ${LABEL[cell.state]}`;

  // Locked (non-editable) cells are flat paint, not controls.
  if (!cell.editable) {
    return (
      <span className={base} style={lockedStyle(cell.state, doneColor)} aria-label={aria}>
        {cell.state === "rest" ? (
          <span className="w-1 h-1 rounded-full bg-[#e6e6e6]" />
        ) : null}
      </span>
    );
  }

  return (
    <span className="relative">
      <button
        type="button"
        onClick={onClick}
        aria-label={aria}
        className={`${base} ${
          cell.state === "open" ? "hover:border-black" : ""
        } transition`}
        style={editableStyle(cell.state, isCount, doneColor)}
      >
        {cell.state === "done" ? <Check /> : null}
        {cell.state === "skipped" ? null : null}
        {cell.state === "today" ? (
          <span
            className="w-[7px] h-[7px] rounded-full"
            style={{ background: doneColor }}
          />
        ) : null}
        {cell.state === "open" ? (
          <span className="text-[15px] leading-none text-[#aab1ba]">+</span>
        ) : null}
      </button>

      {confirming ? (
        <>
          <button
            type="button"
            aria-label="Cancel"
            onClick={onCancel}
            className="fixed inset-0 z-20 cursor-default"
          />
          <div className="absolute left-1/2 top-full z-30 mt-1.5 w-40 -translate-x-1/2 rounded-lg border border-[color:var(--border)] bg-white p-2.5 shadow-md">
            <p className="text-[11px] text-[color:var(--muted)] mb-2">
              Remove this check-in?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onConfirmRemove}
                className="flex-1 h-8 rounded-md bg-black text-white text-xs hover:bg-gray-800"
              >
                Remove
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 h-8 rounded-md border border-[color:var(--border)] text-xs text-[color:var(--muted)] hover:text-black hover:border-black"
              >
                Keep
              </button>
            </div>
          </div>
        </>
      ) : null}
    </span>
  );
}

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

const LABEL: Record<GridCellState, string> = {
  done: "done",
  skipped: "skipped",
  today: "today, not logged",
  open: "open to log",
  missed: "missed",
  upcoming: "upcoming",
  rest: "rest day",
};

function editableStyle(
  state: GridCellState,
  isCount: boolean,
  doneColor: string
): React.CSSProperties {
  switch (state) {
    case "done":
      return { background: doneColor, boxShadow: "0 1px 2px rgba(16,80,40,.22)" };
    case "skipped":
      return { background: "#fde68a" };
    case "today":
      return {
        background: "#fff",
        boxShadow: `inset 0 0 0 2px ${doneColor}, 0 0 0 4px ${washOf(doneColor)}`,
      };
    case "open":
    default:
      // Specific-day: a passed scheduled day reads "was due, still open" (soft
      // grey). Frequency: nothing was owed, so it's a plain neutral well.
      return {
        background: isCount ? "#fff" : "#f4f5f6",
        boxShadow: "inset 0 1px 2px rgba(0,0,0,.05)",
        border: "1.5px dashed #c3c9d0",
      };
  }
}

function lockedStyle(state: GridCellState, doneColor: string): React.CSSProperties {
  switch (state) {
    case "done":
      return { background: doneColor, opacity: 0.92 };
    case "skipped":
      return { background: "#fde68a" };
    case "missed":
      return { background: "#e5e7eb" };
    case "upcoming":
      return { background: "#fff", border: "1px solid #eef0f2" };
    case "rest":
    default:
      return { background: "transparent" };
  }
}

// A faint wash of the category accent for the live-week band and today's ring.
function washOf(color: string): string {
  return `color-mix(in srgb, ${color} 8%, white)`;
}

function formatDate(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
