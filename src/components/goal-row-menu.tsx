"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { archiveGoal, unarchiveGoal, deleteGoal } from "@/lib/actions/goals";
import { tapTargetIcon, tapTargetRow } from "@/lib/ui";

/**
 * Secondary actions for a goal in a quiet overflow menu (⋯ on the goals list,
 * gear on the goal-detail header). Edit and Archive are calm; Delete is a
 * separated, red, destructive action behind a confirm, because it permanently
 * removes the goal and its history.
 */
export default function GoalRowMenu({
  goalId,
  goalName,
  archived,
  trigger = "kebab",
}: {
  goalId: string;
  goalName: string;
  archived: boolean;
  /** "kebab" (⋯, goals list rows) or "gear" (goal-detail header). */
  trigger?: "kebab" | "gear";
}) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  // The menu is portaled to <body> so it escapes the goal row's stacking
  // context; otherwise the next card's icon cluster paints over it. We anchor
  // it to the trigger with fixed coordinates measured on open.
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(
    null
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  function toggleMenu() {
    if (open) {
      setOpen(false);
      return;
    }
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) setMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    // The portaled menu is fixed-positioned to the trigger; if the page scrolls
    // or resizes it would detach, so just close it.
    function onReflow() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onReflow, true);
    window.addEventListener("resize", onReflow);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onReflow, true);
      window.removeEventListener("resize", onReflow);
    };
  }, [open]);

  function handleArchive() {
    startTransition(async () => {
      if (archived) await unarchiveGoal(goalId);
      else await archiveGoal(goalId);
      setOpen(false);
      router.refresh();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteGoal(goalId);
        setConfirmDelete(false);
        // The goal and its history are gone; leave whatever view we're on for
        // the goals list (a no-op refresh there, a navigation from detail).
        router.push("/consistencytracker/goals");
        router.refresh();
      } catch {
        // Stay on the confirm so the user can retry.
      }
    });
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Goal actions"
        onClick={toggleMenu}
        className={`${tapTargetIcon} rounded text-base leading-none text-[color:var(--muted)] hover:bg-gray-100 hover:text-black`}
      >
        {trigger === "gear" ? <GearIcon /> : "⋯"}
      </button>
      {open && menuPos
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{ position: "fixed", top: menuPos.top, right: menuPos.right }}
              className="z-50 w-44 rounded-lg border border-[color:var(--border)] bg-white py-1 shadow-sm"
            >
              <Link
                role="menuitem"
                href={`/consistencytracker/goals/${goalId}/edit`}
                onClick={() => setOpen(false)}
                className={`${tapTargetRow} px-3 text-sm hover:bg-gray-50`}
              >
                Edit
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={handleArchive}
                disabled={pending}
                className={`${tapTargetRow} w-full px-3 text-left text-sm hover:bg-gray-50 disabled:opacity-50`}
              >
                {pending ? "…" : archived ? "Unarchive" : "Archive"}
              </button>
              <div className="my-1 border-t border-[color:var(--border)]" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  setConfirmDelete(true);
                }}
                className={`${tapTargetRow} w-full px-3 text-left text-sm text-red-600 hover:bg-red-50`}
              >
                Delete goal
              </button>
            </div>,
            document.body
          )
        : null}

      {confirmDelete
        ? createPortal(
            <DeleteConfirm
              goalName={goalName}
              pending={pending}
              onConfirm={handleDelete}
              onCancel={() => setConfirmDelete(false)}
            />,
            document.body
          )
        : null}
    </div>
  );
}

function DeleteConfirm({
  goalName,
  pending,
  onConfirm,
  onCancel,
}: {
  goalName: string;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Cancel"
        onClick={onCancel}
        className="absolute inset-0 bg-black/20"
      />
      <div
        role="dialog"
        aria-label="Delete goal"
        className="relative z-10 w-full max-w-sm rounded-t-xl border border-[color:var(--border)] bg-white p-5 shadow-sm sm:rounded-xl"
      >
        <h3 className="text-sm font-semibold">Delete this goal?</h3>
        <p className="mt-2 text-sm text-[color:var(--muted)]">
          This permanently removes{" "}
          <span className="font-medium text-[color:var(--foreground)]">
            {goalName}
          </span>{" "}
          and all its check-in history. This can&rsquo;t be undone.
        </p>
        <div className="mt-4 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] px-3 text-sm text-[color:var(--muted)] hover:text-black"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="min-h-[44px] rounded-md bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {pending ? "Deleting…" : "Delete goal"}
          </button>
        </div>
      </div>
    </div>
  );
}

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
