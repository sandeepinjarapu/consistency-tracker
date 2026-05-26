"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  markDone,
  markSkipped,
  unmark,
  updateCheckInNote,
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
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(checkIn?.note ?? "");
  const [savingNote, startNoteTransition] = useTransition();

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

  const isChecked = checkIn !== null;

  return (
    <div className="flex gap-4 border border-[color:var(--border)] rounded-lg px-4 py-3">
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
          </div>

          <div className="flex items-center gap-2 shrink-0 relative">
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
                  ⏭ Skipped
                  {checkIn.skip_reason ? ` · ${REASON_LABELS[checkIn.skip_reason]}` : ""}
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
