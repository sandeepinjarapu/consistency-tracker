"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  backfillCheckIn,
  clearBackfillCheckIn,
  markExtraDone,
  removeExtra,
} from "@/lib/actions/check-ins";
import type { GridWeek, GridCell, GridCellState } from "@/lib/week-rows";

const WEEKDAY = ["M", "T", "W", "T", "F", "S", "S"];
const DOW_NAME = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * The goal-detail record AND editor: one row per ISO week, Monday on the left.
 * The current week is interactive — editable cells look like controls (a check
 * you can undo, today's accent ring, a dashed "open" well you can fill); locked
 * history cells are flat paint. The editable set is whatever the server allows.
 *
 * Marking is one tap; removing a check-in asks first via an inline confirm
 * below the grid. A date tooltip shows on hover (desktop) and on tapping a
 * read-only cell (mobile) — editable cells keep tap-to-mark. The tooltip is
 * rendered at the component root, outside the horizontal-scroll wrapper, so it
 * is never clipped.
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
  const [confirm, setConfirm] = useState<GridCell | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (tipTimer.current) clearTimeout(tipTimer.current);
  }, []);

  function showTip(text: string, el: HTMLElement, sticky: boolean) {
    const root = rootRef.current;
    if (!root) return;
    const r = el.getBoundingClientRect();
    const rr = root.getBoundingClientRect();
    if (tipTimer.current) clearTimeout(tipTimer.current);
    setTip({ x: r.left - rr.left + r.width / 2, y: r.top - rr.top, text });
    // On a tap (no mouseleave to dismiss it), fade it after a moment.
    if (sticky) tipTimer.current = setTimeout(() => setTip(null), 2500);
  }
  function hideTip() {
    if (tipTimer.current) {
      clearTimeout(tipTimer.current);
      tipTimer.current = null;
    }
    setTip(null);
  }

  function effective(cell: GridCell): GridCell {
    const ov = override[cell.date];
    if (ov === "done")
      return { ...cell, state: cell.extra ? "extra" : "done", editable: true };
    if (ov === "empty") {
      if (cell.extra) return { ...cell, state: "extra-open", editable: true };
      return { ...cell, state: cell.date === today ? "today" : "open", editable: true };
    }
    return cell;
  }

  function log(cell: GridCell) {
    if (pending) return;
    const { date, extra } = cell;
    setOverride((o) => ({ ...o, [date]: "done" }));
    startTransition(async () => {
      try {
        await (extra ? markExtraDone(goalId, date) : backfillCheckIn(goalId, date));
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

  function remove(cell: GridCell) {
    setConfirm(null);
    if (pending) return;
    const { date, extra } = cell;
    setOverride((o) => ({ ...o, [date]: "empty" }));
    startTransition(async () => {
      try {
        await (extra ? removeExtra(goalId, date) : clearBackfillCheckIn(goalId, date));
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
    hideTip();
    if (!cell.editable) return;
    if (cell.state === "done" || cell.state === "skipped" || cell.state === "extra")
      setConfirm(cell);
    else log(cell);
  }

  return (
    <div ref={rootRef} className="relative">
      {/* Content-width, left-aligned. Scrolls horizontally only if the week
          can't fit (small phones), with the scrollbar hidden. */}
      <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="w-fit py-1">
          <div className="flex items-center gap-1.5 px-2">
            <span className="w-16 shrink-0" />
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
              className="flex items-center gap-1.5 rounded-xl px-2 py-1.5"
              style={week.isCurrent ? { background: washOf(doneColor) } : undefined}
            >
              <span className="w-16 shrink-0 leading-tight">
                <span
                  className={`block text-xs ${
                    week.isCurrent
                      ? "font-semibold text-[color:var(--foreground)]"
                      : "text-[color:var(--muted)]"
                  }`}
                >
                  {week.label}
                </span>
                <span className="block text-[10px] text-[color:var(--muted)]">
                  {week.dateRange}
                </span>
              </span>
              {week.cells.map((raw, i) => {
                const cell = effective(raw);
                const text = `${DOW_NAME[i]}, ${formatDate(cell.date)} · ${TIP_STATUS[cell.state]}`;
                return (
                  <Cell
                    key={cell.date}
                    cell={cell}
                    dowName={DOW_NAME[i]}
                    isCount={isCount}
                    doneColor={doneColor}
                    onEnter={(el) => showTip(text, el, false)}
                    onLeave={hideTip}
                    onAction={() => onCell(cell)}
                    onTapTip={(el) => showTip(text, el, true)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {tip ? (
        <span
          role="tooltip"
          className="pointer-events-none absolute z-40 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-[#0a0a0a] px-2 py-1 text-[11px] leading-none text-white"
          style={{ left: tip.x, top: tip.y - 8 }}
        >
          {tip.text}
          <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-[#0a0a0a]" />
        </span>
      ) : null}

      {confirm ? (
        <div className="mt-2 flex flex-wrap items-center gap-2.5 text-xs">
          <span className="text-[color:var(--muted)]">
            Remove the {confirm.extra ? "extra " : ""}check-in for{" "}
            {formatDate(confirm.date)}?
          </span>
          <button
            type="button"
            onClick={() => remove(confirm)}
            disabled={pending}
            className="min-h-[44px] rounded-md bg-black px-4 text-white hover:bg-gray-800 disabled:opacity-50"
          >
            Remove
          </button>
          <button
            type="button"
            onClick={() => setConfirm(null)}
            className="min-h-[44px] rounded-md border border-[color:var(--border)] px-4 text-[color:var(--muted)] hover:border-black hover:text-black"
          >
            Keep
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Cell({
  cell,
  dowName,
  isCount,
  doneColor,
  onEnter,
  onLeave,
  onAction,
  onTapTip,
}: {
  cell: GridCell;
  dowName: string;
  isCount: boolean;
  doneColor: string;
  onEnter: (el: HTMLElement) => void;
  onLeave: () => void;
  onAction: () => void;
  onTapTip: (el: HTMLElement) => void;
}) {
  const base = "w-9 h-9 rounded-[10px] grid place-items-center shrink-0 relative";
  const aria = `${dowName} ${formatDate(cell.date)}: ${LABEL[cell.state]}`;

  if (!cell.editable) {
    return (
      <span
        className={base}
        style={lockedStyle(cell.state, doneColor)}
        aria-label={aria}
        onMouseEnter={(e) => onEnter(e.currentTarget)}
        onMouseLeave={onLeave}
        onClick={(e) => onTapTip(e.currentTarget)}
      >
        {cell.state === "rest" ? (
          <span className="w-1 h-1 rounded-full bg-[#e6e6e6]" />
        ) : null}
        {cell.state === "extra" ? <Check color={doneColor} /> : null}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onAction}
      onMouseEnter={(e) => onEnter(e.currentTarget)}
      onMouseLeave={onLeave}
      aria-label={aria}
      // 36px chip, but the ::before extends the hit area to ~44px (it sits
      // inside the row's px-2, so it never adds scrollable width).
      className={`${base} before:absolute before:-inset-1 before:content-[''] ${
        cell.state === "open" ? "hover:border-black" : ""
      } transition`}
      style={editableStyle(cell.state, isCount, doneColor)}
    >
      {cell.state === "done" ? <Check /> : null}
      {cell.state === "extra" ? <Check color={doneColor} /> : null}
      {cell.state === "today" ? (
        <span className="w-[7px] h-[7px] rounded-full" style={{ background: doneColor }} />
      ) : null}
      {cell.state === "open" ? (
        <span className="text-[15px] leading-none text-[#aab1ba]">+</span>
      ) : null}
      {cell.state === "extra-open" ? (
        <span className="text-[12px] leading-none text-[#c3c9d0]">+</span>
      ) : null}
    </button>
  );
}

function Check({ color = "#fff" }: { color?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

const LABEL: Record<GridCellState, string> = {
  done: "done",
  skipped: "skipped",
  today: "today, not yet done",
  open: "open · tap to mark done",
  missed: "missed",
  upcoming: "upcoming",
  extra: "extra day",
  "extra-open": "off day · tap to add an extra",
  rest: "rest day",
};

// Sentence-case status for the date tooltip, e.g. "Tue, May 19 · Done".
const TIP_STATUS: Record<GridCellState, string> = {
  done: "Done",
  skipped: "Skipped",
  today: "Today",
  open: "Mark done",
  missed: "Missed",
  upcoming: "Upcoming",
  extra: "Extra check-in",
  "extra-open": "Add an extra",
  rest: "Not scheduled",
};

function editableStyle(
  state: GridCellState,
  isCount: boolean,
  doneColor: string
): React.CSSProperties {
  switch (state) {
    case "done":
      return { background: doneColor, boxShadow: "0 1px 2px rgba(16,80,40,.2)" };
    case "skipped":
      return { background: "#fde68a" };
    case "today":
      // Inset ring only (no outer glow, which the scroll wrapper would clip).
      return { background: "#fff", boxShadow: `inset 0 0 0 2px ${doneColor}` };
    case "extra":
      // A logged extra: outlined accent (not a filled scheduled done) — present
      // and warm, but visibly subordinate to a day you promised.
      return { background: washOf(doneColor), boxShadow: `inset 0 0 0 1.5px ${doneColor}` };
    case "extra-open":
      // Off-day invitation: fainter than a scheduled "open" well so the
      // scheduled days stay primary. A quiet dotted outline, no fill.
      return { background: "#fff", border: "1.5px dotted #d8dce1" };
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
    case "extra":
      // Locked extra: the same outlined accent as its editable form, so a logged
      // extra reads identically whether or not it's still inside the window.
      return { background: washOf(doneColor), boxShadow: `inset 0 0 0 1.5px ${doneColor}` };
    case "missed":
      return { background: "#e5e7eb" };
    case "upcoming":
      return { background: "#fff", border: "1px solid #eef0f2" };
    case "rest":
    default:
      return { background: "transparent" };
  }
}

// A faint wash of the category accent for the live-week band.
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
