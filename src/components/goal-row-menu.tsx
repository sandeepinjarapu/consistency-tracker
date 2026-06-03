"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { archiveGoal, unarchiveGoal } from "@/lib/actions/goals";

/**
 * Secondary row actions for a goal, collapsed into a quiet "⋯" overflow menu
 * so the card stays calm and the whole card click (open detail) stays primary.
 * Lives above the card's stretched-link overlay (the parent gives it z-10).
 */
export default function GoalRowMenu({
  goalId,
  archived,
}: {
  goalId: string;
  archived: boolean;
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
        className="rounded px-1.5 py-1 text-base leading-none text-[color:var(--muted)] hover:bg-gray-100 hover:text-black"
      >
        ⋯
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-32 rounded-md border border-[color:var(--border)] bg-white py-1 shadow-md"
        >
          <Link
            role="menuitem"
            href={`/consistencytracker/goals/${goalId}/edit`}
            onClick={() => setOpen(false)}
            className="block px-3 py-1.5 text-xs hover:bg-gray-50"
          >
            Edit
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={handleArchive}
            disabled={pending}
            className="block w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 disabled:opacity-50"
          >
            {pending ? "…" : archived ? "Unarchive" : "Archive"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
