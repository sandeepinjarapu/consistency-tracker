"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setGoalShared } from "@/lib/actions/partners";

type Partner = { id: string; display_name: string | null };

export default function ShareToggles({
  goalId,
  partners,
  sharedWith,
}: {
  goalId: string;
  partners: Partner[];
  sharedWith: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [local, setLocal] = useState(() => new Set(sharedWith));

  function toggle(partnerId: string) {
    const currentlyShared = local.has(partnerId);
    const next = new Set(local);
    if (currentlyShared) next.delete(partnerId);
    else next.add(partnerId);
    setLocal(next);

    startTransition(async () => {
      try {
        await setGoalShared(goalId, partnerId, !currentlyShared);
        router.refresh();
      } catch {
        // Revert optimistic update on failure
        setLocal(local);
      }
    });
  }

  if (partners.length === 0) {
    return (
      <p className="text-xs text-[color:var(--muted)]">
        No partners yet.{" "}
        <Link
          href="/consistencytracker/partners"
          className="underline hover:text-black"
        >
          Invite someone
        </Link>{" "}
        to share this goal with them.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {partners.map((p) => {
        const shared = local.has(p.id);
        return (
          <label
            key={p.id}
            className="flex items-center gap-2 text-sm cursor-pointer hover:text-black text-[color:var(--muted)]"
          >
            <input
              type="checkbox"
              checked={shared}
              onChange={() => toggle(p.id)}
              disabled={pending}
              className="rounded border-[color:var(--border)]"
            />
            <span className={shared ? "text-black" : ""}>
              {p.display_name ?? "Partner"}
            </span>
          </label>
        );
      })}
    </div>
  );
}
