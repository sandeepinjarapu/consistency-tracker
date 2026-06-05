"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { archiveGoal, unarchiveGoal } from "@/lib/actions/goals";
import { tapTargetIcon, tapTargetRow } from "@/lib/ui";

/**
 * Secondary row actions for a goal, collapsed into a quiet "⋯" overflow menu
 * so the card stays calm and the whole card click (open detail) stays primary.
 * Lives above the card's stretched-link overlay (the parent gives it z-10).
 */
export default function GoalRowMenu({
  goalId,
  archived,
  trigger = "kebab",
}: {
  goalId: string;
  archived: boolean;
  /** "kebab" (⋯, goals list rows) or "gear" (goal-detail header). */
  trigger?: "kebab" | "gear";
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Goal actions"
        onClick={() => setOpen((o) => !o)}
        className={`${tapTargetIcon} rounded text-base leading-none text-[color:var(--muted)] hover:bg-gray-100 hover:text-black`}
      >
        {trigger === "gear" ? <GearIcon /> : "⋯"}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-40 rounded-md border border-[color:var(--border)] bg-white py-1 shadow-md"
        >
          <Link
            role="menuitem"
            href={`/consistencytracker/goals/${goalId}/edit`}
            onClick={() => setOpen(false)}
            className={`${tapTargetRow} px-3 text-xs hover:bg-gray-50`}
          >
            Edit
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={handleArchive}
            disabled={pending}
            className={`${tapTargetRow} w-full px-3 text-left text-xs hover:bg-gray-50 disabled:opacity-50`}
          >
            {pending ? "…" : archived ? "Unarchive" : "Archive"}
          </button>
        </div>
      ) : null}
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
