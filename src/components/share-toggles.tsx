"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { setGoalShared } from "@/lib/actions/partners";
import { tapTarget, tapTargetRow } from "@/lib/ui";

type Partner = { id: string; display_name: string | null };

// Up to 3 names, then "and N others" — matches the Goals-list share tooltip.
function summarize(names: string[]): string {
  if (names.length <= 3) return names.join(", ");
  const rest = names.length - 3;
  return `${names.slice(0, 3).join(", ")} and ${rest} other${rest === 1 ? "" : "s"}`;
}

function PeopleIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="9" cy="7" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M16 5a3 3 0 0 1 0 6" />
      <path d="M21 20c0-2.3-1.4-4.3-3.5-5.2" />
    </svg>
  );
}

export default function ShareToggles({
  goalId,
  partners,
  sharedWith,
}: {
  goalId: string;
  partners: Partner[];
  sharedWith: string[];
}) {
  const [pending, startTransition] = useTransition();
  const [local, setLocal] = useState(() => new Set(sharedWith));
  const [editing, setEditing] = useState(false);

  function toggle(partnerId: string) {
    const currentlyShared = local.has(partnerId);
    const next = new Set(local);
    if (currentlyShared) next.delete(partnerId);
    else next.add(partnerId);
    setLocal(next);

    startTransition(async () => {
      try {
        // Local state already reflects the change; setGoalShared
        // revalidates the goal + partner pages for future navigations, so
        // no router.refresh() is needed here (it would re-render the whole
        // heavy goal-detail page and freeze the toggles meanwhile).
        await setGoalShared(goalId, partnerId, !currentlyShared);
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

  const sharedNames = partners
    .filter((p) => local.has(p.id))
    .map((p) => p.display_name ?? "Partner");

  // Resting state: show who it's shared with at a glance; editing is one click
  // away rather than always-on checkboxes.
  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-3">
        <span
          className={`flex items-center gap-2 text-sm ${
            sharedNames.length > 0 ? "text-black" : "text-[color:var(--muted)]"
          }`}
        >
          <PeopleIcon />
          {sharedNames.length === 0
            ? "Private — not shared"
            : `Shared with ${summarize(sharedNames)}`}
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-expanded={false}
          className={`${tapTarget} shrink-0 px-2 text-xs underline text-[color:var(--muted)] hover:text-black`}
        >
          {sharedNames.length === 0 ? "Share" : "Manage"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {partners.map((p) => {
          const shared = local.has(p.id);
          return (
            <label
              key={p.id}
              className={`${tapTargetRow} gap-2 text-sm cursor-pointer hover:text-black text-[color:var(--muted)]`}
            >
              <input
                type="checkbox"
                checked={shared}
                onChange={() => toggle(p.id)}
                disabled={pending}
                className="w-5 h-5 rounded border-[color:var(--border)]"
              />
              <span className={shared ? "text-black" : ""}>
                {p.display_name ?? "Partner"}
              </span>
            </label>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setEditing(false)}
        aria-expanded
        className={`${tapTarget} px-2 text-xs underline text-[color:var(--muted)] hover:text-black`}
      >
        Done
      </button>
    </div>
  );
}
