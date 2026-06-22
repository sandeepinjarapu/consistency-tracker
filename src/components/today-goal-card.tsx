"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  markDone,
  markSkipped,
  unmark,
  updateCheckInNote,
  updateCheckInEffort,
  type CheckIn,
  type SkipReason,
  type EffortTexture,
} from "@/lib/actions/check-ins";
import { formatCheckInTime } from "@/lib/dates";
import { nextEffort } from "@/lib/effort-texture";
import { tapTarget, tapTargetRow } from "@/lib/ui";

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
  lateCheckIn = false,
}: {
  goalId: string;
  name: string;
  description: string | null;
  categoryColor: string;
  date: string;
  timezone: string;
  checkIn: CheckIn | null;
  paceLabel?: string;
  lateCheckIn?: boolean;
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

  // Late check-in cards deliberately never refresh or revalidate in-session
  // (the card must survive while a note is being written), so useOptimistic is
  // the wrong tool for them: it reverts to the `checkIn` prop the instant the
  // transition ends, and that prop never catches up without a refresh. Late
  // cards therefore own durable local state instead. Only a reload or
  // navigation reconciles them with the server (which filters logged goals out
  // of the "Still open from last night" list). `current` is the single source
  // the render reads, picked per mode.
  const [localCheckIn, setLocalCheckIn] = useState<CheckIn | null>(checkIn);
  const current = lateCheckIn ? localCheckIn : optimistic;

  function optimisticRow(
    status: "done" | "skipped",
    reason: SkipReason | null
  ): CheckIn {
    return {
      id: current?.id ?? "optimistic",
      goal_id: goalId,
      date,
      status,
      skip_reason: reason,
      note: current?.note ?? null,
      effort_texture: current?.effort_texture ?? null,
      created_at: new Date().toISOString(),
    };
  }

  // Toggle an effort-texture chip on a done check-in. Tapping the active chip
  // clears it; tapping the other replaces it. Owner-private, never scored —
  // it only annotates how fully the day went. No-op if not a done row.
  function setEffort(tapped: EffortTexture) {
    if (!current || current.status !== "done") return;
    const value = nextEffort(current.effort_texture, tapped);
    run(() => updateCheckInEffort(goalId, date, value, lateCheckIn), {
      ...current,
      effort_texture: value,
    });
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
    if (lateCheckIn) {
      // Durable local state, no refresh and no server revalidation (the action
      // is called with skipRevalidate=true). The card stays put so a note can
      // be written; it only leaves the list on reload/navigation.
      const prev = localCheckIn;
      setLocalCheckIn(next);
      startTransition(async () => {
        try {
          await fn();
        } catch {
          setLocalCheckIn(prev);
        }
      });
      return;
    }
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
      // Saving the note completes the late check-in's job, so let the server
      // reconcile: the now-logged goal drops out of the night-owl list and the
      // card leaves. Same path for regular cards (the prop catches up).
      router.refresh();
    });
  }

  function cancelNote() {
    setNoteDraft(current?.note ?? "");
    setEditingNote(false);
  }

  const isChecked = current !== null;

  // Calm per-state tint so cards are scannable at a glance, not just by
  // reading the status text. Pending stays neutral; done/skipped get a soft
  // wash. No "missed" state here — today can't be missed yet.
  const stateTint =
    current?.status === "done"
      ? "border-green-200 bg-green-50/60"
      : current?.status === "skipped"
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
            {current?.status === "done" ? (
              <>
                <span className="text-xs">
                  <span className="text-green-700 font-medium">✓ Done</span>
                  <span className="text-[color:var(--muted)] ml-1">
                    · {formatCheckInTime(current.created_at, timezone)}
                  </span>
                </span>
                <button
                  onClick={() => run(() => unmark(goalId, date, lateCheckIn), null)}
                  disabled={pending}
                  className={`${tapTarget} px-2 text-xs text-[color:var(--muted)] hover:text-black disabled:opacity-50`}
                >
                  Undo
                </button>
              </>
            ) : current?.status === "skipped" ? (
              <>
                <span className="text-xs">
                  <span className="text-amber-700 font-medium">
                    ⏭ Skipped
                    {current.skip_reason ? ` · ${REASON_LABELS[current.skip_reason]}` : ""}
                  </span>
                  <span className="text-[color:var(--muted)] ml-1">
                    · {formatCheckInTime(current.created_at, timezone)}
                  </span>
                </span>
                <button
                  onClick={() => run(() => unmark(goalId, date, lateCheckIn), null)}
                  disabled={pending}
                  className={`${tapTarget} px-2 text-xs text-[color:var(--muted)] hover:text-black disabled:opacity-50`}
                >
                  Undo
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => run(() => markDone(goalId, date, lateCheckIn), optimisticRow("done", null))}
                  disabled={pending}
                  className={`${tapTarget} text-xs font-medium bg-black text-white rounded-md px-4 hover:bg-gray-800 disabled:opacity-50`}
                >
                  Mark done
                </button>
                <div className="relative" ref={skipMenuRef}>
                  <button
                    onClick={() => setShowSkipMenu((s) => !s)}
                    disabled={pending}
                    className={`${tapTarget} text-sm text-[color:var(--muted)] hover:text-black px-3 rounded-lg border border-[color:var(--border)] disabled:opacity-50`}
                  >
                    Skip ▾
                  </button>
                  {showSkipMenu ? (
                    <div className="absolute right-0 top-full mt-1 z-10 bg-white border border-[color:var(--border)] rounded-lg shadow-sm py-1 w-40">
                      {(Object.keys(REASON_LABELS) as SkipReason[]).map((r) => (
                        <button
                          key={r}
                          onClick={() => run(() => markSkipped(goalId, date, r, lateCheckIn), optimisticRow("skipped", r))}
                          className={`${tapTargetRow} w-full text-left text-sm px-3 hover:bg-gray-50`}
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
            {current?.status === "done" ? (
              <div className="mb-2">
                <p className="text-[11px] text-[color:var(--muted)] mb-1">
                  How did it go? <span className="opacity-70">(optional)</span>
                </p>
                <div className="flex items-center gap-1.5">
                {(["flow", "light"] as const).map((t) => {
                  const selected = current?.effort_texture === t;
                  return (
                    <button
                      key={t}
                      onClick={() => setEffort(t)}
                      disabled={pending}
                      aria-pressed={selected}
                      className={`${tapTarget} text-xs rounded-full px-3 border transition-colors disabled:opacity-50 ${
                        selected
                          ? "border-black bg-black text-white"
                          : "border-[color:var(--border)] text-[color:var(--muted)] hover:text-black hover:border-black"
                      }`}
                    >
                      {t === "flow" ? "In flow" : "Light effort"}
                    </button>
                  );
                })}
                </div>
              </div>
            ) : null}
            {editingNote ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  type="text"
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value.slice(0, 100))}
                  placeholder="A note for your weekly reflection…"
                  maxLength={100}
                  className="flex-1 min-h-[44px] text-xs border border-[color:var(--border)] rounded-md px-3 focus:outline-none focus:border-black"
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
                  className={`${tapTarget} px-2 text-xs text-black hover:underline disabled:opacity-50`}
                >
                  Save
                </button>
                <button
                  onClick={cancelNote}
                  className={`${tapTarget} px-2 text-xs text-[color:var(--muted)] hover:text-black`}
                >
                  Cancel
                </button>
              </div>
            ) : current?.note ? (
              <button
                onClick={() => setEditingNote(true)}
                className="min-h-[44px] inline-flex items-center text-xs text-[color:var(--muted)] italic hover:text-black text-left"
              >
                “{current.note}” <span className="not-italic">· edit</span>
              </button>
            ) : (
              <button
                onClick={() => setEditingNote(true)}
                className={`${tapTarget} text-xs text-[color:var(--muted)] hover:text-black`}
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
