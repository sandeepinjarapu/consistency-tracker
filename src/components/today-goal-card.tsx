"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  markDone,
  markSkipped,
  unmark,
  updateCheckInNote,
  type CheckIn,
  type SkipReason,
} from "@/lib/actions/check-ins";
import { formatCheckInTime } from "@/lib/dates";

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
  timezone,
  checkIn,
  paceLabel,
}: {
  goalId: string;
  name: string;
  description: string | null;
  categoryColor: string;
  date: string;
  timezone: string;
  checkIn: CheckIn | null;
  paceLabel?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showSkipMenu, setShowSkipMenu] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(checkIn?.note ?? "");
  const [savingNote, startNoteTransition] = useTransition();
  const skipMenuRef = useRef<HTMLDivElement>(null);

  // Reflect the action in the UI immediately; reconciles to the server prop
  // when the background router.refresh() lands (and reverts on failure).
  const [optimistic, setOptimistic] = useOptimistic(checkIn);

  function optimisticRow(
    status: "done" | "skipped",
    reason: SkipReason | null
  ): CheckIn {
    return {
      id: checkIn?.id ?? "optimistic",
      goal_id: goalId,
      date,
      status,
      skip_reason: reason,
      note: checkIn?.note ?? null,
      created_at: new Date().toISOString(),
    };
  }

  // Close the Skip dropdown on outside click or Escape
  useEffect(() => {
    if (!showSkipMenu) return;
    function onPointerDown(e: MouseEvent | TouchEvent) {
      const target = e.target as Node | null;
      if (skipMenuRef.current && target && !skipMenuRef.current.contains(target)) {
        setShowSkipMenu(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setShowSkipMenu(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showSkipMenu]);

  function run(fn: () => Promise<void>, next: CheckIn | null) {
    setShowSkipMenu(false);
    startTransition(async () => {
      setOptimistic(next);
      try {
        await fn();
        router.refresh();
      } catch {
        // swallow — RLS errors shouldn't occur for own goals. On failure we
        // skip the refresh, so the optimistic value reverts to the prop.
      }
    });
  }

  function saveNote() {
    startNoteTransition(async () => {
      await updateCheckInNote(goalId, date, noteDraft);
      setEditingNote(false);
      router.refresh();
    });
  }

  function cancelNote() {
    setNoteDraft(checkIn?.note ?? "");
    setEditingNote(false);
  }

  const isChecked = optimistic !== null;

  // Calm per-state tint so cards are scannable at a glance, not just by
  // reading the status text. Pending stays neutral; done/skipped get a soft
  // wash. No "missed" state here — today can't be missed yet.
  const stateTint =
    optimistic?.status === "done"
      ? "border-green-200 bg-green-50/60"
      : optimistic?.status === "skipped"
        ? "border-amber-200 bg-amber-50/60"
        : "border-[color:var(--border)]";

  return (
    <div className={`flex gap-4 border rounded-lg px-4 py-3 transition-colors ${stateTint}`}>
      <span
        aria-hidden
        className="w-1 self-stretch rounded-full shrink-0"
        style={{ background: categoryColor }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{name}</p>
            {description ? (
              <p className="text-xs text-[color:var(--muted)] mt-0.5 truncate">
                {description}
              </p>
            ) : null}
            {paceLabel ? (
              <p className="text-[11px] text-[color:var(--muted)] mt-1 tabular-nums">
                {paceLabel}
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-2 shrink-0 relative">
            {optimistic?.status === "done" ? (
              <>
                <span className="text-xs">
                  <span className="text-green-700 font-medium">✓ Done</span>
                  <span className="text-[color:var(--muted)] ml-1">
                    · {formatCheckInTime(optimistic.created_at, timezone)}
                  </span>
                </span>
                <button
                  onClick={() => run(() => unmark(goalId, date), null)}
                  disabled={pending}
                  className="text-xs text-[color:var(--muted)] hover:text-black disabled:opacity-50"
                >
                  Undo
                </button>
              </>
            ) : optimistic?.status === "skipped" ? (
              <>
                <span className="text-xs">
                  <span className="text-amber-700 font-medium">
                    ⏭ Skipped
                    {optimistic.skip_reason ? ` · ${REASON_LABELS[optimistic.skip_reason]}` : ""}
                  </span>
                  <span className="text-[color:var(--muted)] ml-1">
                    · {formatCheckInTime(optimistic.created_at, timezone)}
                  </span>
                </span>
                <button
                  onClick={() => run(() => unmark(goalId, date), null)}
                  disabled={pending}
                  className="text-xs text-[color:var(--muted)] hover:text-black disabled:opacity-50"
                >
                  Undo
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => run(() => markDone(goalId, date), optimisticRow("done", null))}
                  disabled={pending}
                  className="text-xs border border-[color:var(--border)] rounded-md px-3 py-1.5 hover:border-black hover:bg-gray-50 disabled:opacity-50"
                >
                  Mark done
                </button>
                <div className="relative" ref={skipMenuRef}>
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
                          onClick={() => run(() => markSkipped(goalId, date, r), optimisticRow("skipped", r))}
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

        {isChecked ? (
          <div className="mt-2">
            {editingNote ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  type="text"
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value.slice(0, 100))}
                  placeholder="A note for your weekly reflection…"
                  maxLength={100}
                  className="flex-1 text-xs border border-[color:var(--border)] rounded-md px-2 py-1.5 focus:outline-none focus:border-black"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveNote();
                    if (e.key === "Escape") cancelNote();
                  }}
                />
                <span className="text-[10px] text-[color:var(--muted)] tabular-nums">
                  {noteDraft.length}/100
                </span>
                <button
                  onClick={saveNote}
                  disabled={savingNote}
                  className="text-xs text-black hover:underline disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  onClick={cancelNote}
                  className="text-xs text-[color:var(--muted)] hover:text-black"
                >
                  Cancel
                </button>
              </div>
            ) : checkIn?.note ? (
              <button
                onClick={() => setEditingNote(true)}
                className="text-xs text-[color:var(--muted)] italic hover:text-black text-left"
              >
                “{checkIn.note}” <span className="not-italic">· edit</span>
              </button>
            ) : (
              <button
                onClick={() => setEditingNote(true)}
                className="text-xs text-[color:var(--muted)] hover:text-black"
              >
                + Add note
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
