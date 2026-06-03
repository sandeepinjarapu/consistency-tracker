"use client";

import { useOptimistic, useTransition } from "react";
import { toggleReaction } from "@/lib/actions/reactions";
import {
  REACTION_LABELS,
  REACTION_EMOJI as EMOJI,
  type ReactionKind,
} from "@/lib/reactions";

const KINDS: ReactionKind[] = ["saw", "proud"];

/**
 * Two gentle toggle buttons ("Saw it" / "Proud") a viewer can leave on a
 * partner's shared goal for a given week. Optimistic so the toggle feels
 * instant; reconciles to the server prop on the background refresh (reverts on
 * failure).
 */
export default function ReactionButtons({
  goalId,
  weekStart,
  initial,
}: {
  goalId: string;
  weekStart: string;
  initial: Record<ReactionKind, boolean>;
}) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useOptimistic(
    initial,
    (s, kind: ReactionKind) => ({ ...s, [kind]: !s[kind] })
  );

  function toggle(kind: ReactionKind) {
    startTransition(async () => {
      setState(kind);
      try {
        await toggleReaction(goalId, kind, weekStart);
      } catch {
        // best-effort — on failure the optimistic flip reverts to the prop
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {KINDS.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => toggle(k)}
          disabled={pending}
          aria-pressed={state[k]}
          className={`text-xs rounded-full border px-3 py-1 transition disabled:opacity-50 ${
            state[k]
              ? "border-black bg-black text-white"
              : "border-[color:var(--border)] text-[color:var(--muted)] hover:border-black"
          }`}
        >
          {state[k] ? "✓ " : ""}
          {EMOJI[k]} {REACTION_LABELS[k]}
        </button>
      ))}
    </div>
  );
}
