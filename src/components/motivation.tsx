"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setGoalMotivation } from "@/lib/actions/goals";

/**
 * The goal's "why". Displays the saved text clamped to a few lines with a tap
 * to expand. When there's no reason yet, offers a quiet inline editor (rather
 * than a trip to the edit form) so the line you'll come back to is one tap away.
 */
export default function Motivation({
  goalId,
  initial,
}: {
  goalId: string;
  initial: string | null;
}) {
  const router = useRouter();
  const [text, setText] = useState(initial ?? "");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();

  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (el) setClamped(el.scrollHeight > el.clientHeight + 1);
  }, [text, editing]);

  function save() {
    const value = draft.trim();
    if (!value) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      try {
        await setGoalMotivation(goalId, value);
        setText(value);
        setEditing(false);
        router.refresh();
      } catch {
        // Leave the editor open so the text isn't lost.
      }
    });
  }

  if (editing) {
    return (
      <div className="max-w-prose">
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          maxLength={400}
          placeholder="When this gets hard, what should it remind you of?"
          className="w-full resize-none rounded-md border border-[color:var(--border)] px-3 py-2 text-sm focus:border-black focus:outline-none"
        />
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="min-h-[40px] rounded-md bg-black px-4 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="min-h-[40px] px-2 text-xs text-[color:var(--muted)] hover:text-black"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (!text) {
    return (
      <div className="max-w-prose">
        <p className="text-sm leading-relaxed text-[color:var(--muted)]">
          When this gets hard, what should it remind you of?
        </p>
        <button
          type="button"
          onClick={() => {
            setDraft("");
            setEditing(true);
          }}
          className="mt-1 text-xs font-medium underline decoration-[color:var(--border)] hover:decoration-black"
        >
          Add a reason
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-prose">
      <p
        ref={ref}
        className={`text-sm leading-relaxed text-[#374151] ${
          expanded ? "" : "line-clamp-3"
        }`}
      >
        {text}
      </p>
      {clamped || expanded ? (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-1 text-xs font-medium text-[color:var(--muted)] hover:text-black"
        >
          {expanded ? "less" : "more"}
        </button>
      ) : null}
    </div>
  );
}
