"use client";

import { archiveGoal, unarchiveGoal } from "@/lib/actions/goals";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTransition } from "react";

export default function GoalRowActions({
  goalId,
  archived,
}: {
  goalId: string;
  archived: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleArchive() {
    startTransition(async () => {
      if (archived) await unarchiveGoal(goalId);
      else await archiveGoal(goalId);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-3 text-xs">
      <Link
        href={`/consistencytracker/goals/${goalId}/edit`}
        className="text-[color:var(--muted)] hover:text-black"
      >
        Edit
      </Link>
      <button
        type="button"
        onClick={handleArchive}
        disabled={pending}
        className="text-[color:var(--muted)] hover:text-black disabled:opacity-50"
      >
        {pending ? "…" : archived ? "Unarchive" : "Archive"}
      </button>
    </div>
  );
}
