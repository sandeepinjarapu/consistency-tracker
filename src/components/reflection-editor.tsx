"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { upsertReflection, type Reflection } from "@/lib/actions/reflections";
import { tapTarget } from "@/lib/ui";

// Whether sharing a reflection with a partner is meaningful yet. The Partner
// visibility pill only makes sense once an invite is accepted; before that it
// is a trust smell ("Partner? which partner? is something shared already?").
export type PartnerState = "none" | "pending" | "accepted";

export default function ReflectionEditor({
  weekStartDate,
  initial,
  partnerState,
  continueHint = "What clicked this week?",
  improveHint = "One small change for next week?",
}: {
  weekStartDate: string;
  initial: Reflection | null;
  partnerState: PartnerState;
  // Optionally anchored to the week's strongest/weakest goal so the prompt
  // responds to what actually happened rather than being a blank template.
  continueHint?: string;
  improveHint?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [continueText, setContinueText] = useState(initial?.continue_text ?? "");
  const [stopText, setStopText] = useState(initial?.stop_text ?? "");
  const [improveText, setImproveText] = useState(initial?.improve_text ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  // Without an accepted partner there is no one to share with, so the
  // reflection stays private regardless of any stale stored value.
  const [visibility, setVisibility] = useState<"private" | "partner">(
    partnerState === "accepted" ? initial?.visibility ?? "private" : "private"
  );

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await upsertReflection({
          weekStartDate,
          continueText,
          stopText,
          improveText,
          notes,
          visibility,
        });
        setSavedAt(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
        // No router.refresh(): the editor's own state already shows the saved
        // text, and nothing else on the reflections page derives from
        // reflection content (week stats come from check-ins). upsertReflection
        // already revalidatePath()s the dashboard banner for cross-page sync.
        // A refresh here would re-fetch a year of check-ins + recompute every
        // week for no visible change.
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save reflection");
      }
    });
  }

  return (
    <div className="space-y-4">
      <Prompt
        label="Keep"
        hint={continueHint}
        value={continueText}
        onChange={setContinueText}
        placeholder="Morning writing right after coffee felt focused…"
      />
      <Prompt
        label="Let go"
        hint="What got in the way this week?"
        value={stopText}
        onChange={setStopText}
        placeholder="Scrolling before bed killed sleep…"
      />
      <Prompt
        label="Try next"
        hint={improveHint}
        value={improveText}
        onChange={setImproveText}
        placeholder="Pack gym bag the night before…"
      />
      <Prompt
        label="Notes"
        hint="Anything else worth remembering."
        value={notes}
        onChange={setNotes}
        rows={3}
        placeholder=""
      />

      <div className="flex items-center justify-between pt-2 gap-4 flex-wrap">
        {/* No accepted partner: state plainly that it's private, say when sharing unlocks. */}
        {partnerState !== "accepted" && (
          <p className="text-xs text-[color:var(--muted)] max-w-prose">
            <span className="text-black">Private.</span>{" "}
            {partnerState === "pending" ? (
              "Reflections can be shared after a partner accepts your invite."
            ) : (
              <>
                Add a partner to share reflections later.{" "}
                <Link
                  href="/consistencytracker/partners"
                  className="underline hover:text-black"
                >
                  Invite someone
                </Link>
                .
              </>
            )}
          </p>
        )}

        <div className="flex items-center gap-3 ml-auto">
          {savedAt ? (
            <span className="text-xs text-[color:var(--muted)]">Saved · {savedAt}</span>
          ) : null}
          {error ? <span className="text-xs text-red-600">{error}</span> : null}
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className={`${tapTarget} bg-black text-white text-sm rounded-md px-4 hover:bg-gray-800 disabled:opacity-50`}
          >
            {pending ? "Saving…" : "Save reflection"}
          </button>
          {/* Accepted partner: quiet tappable suffix that flips visibility inline. */}
          {partnerState === "accepted" && (
            <button
              type="button"
              onClick={() =>
                setVisibility((v) => (v === "private" ? "partner" : "private"))
              }
              aria-pressed={visibility === "partner"}
              aria-label={
                visibility === "private"
                  ? "Reflection visibility: private. Tap to share with partner."
                  : "Reflection visibility: shared with partner. Tap to make private."
              }
              className={`${tapTarget} px-2 rounded-md text-xs text-[color:var(--muted)] hover:text-black hover:bg-gray-50 transition-colors`}
            >
              · {visibility === "private" ? "Private" : "Shared with partner"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Prompt({
  label,
  hint,
  value,
  onChange,
  placeholder,
  rows = 2,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div>
      {/* Stacked, not a justify-between row: the Reflections page passes a
          full-sentence hint that otherwise collides with the label on mobile. */}
      <div className="mb-1">
        <label className="block text-xs font-medium uppercase tracking-wider">
          {label}
        </label>
        <span className="block text-[10px] text-[color:var(--muted)] mt-0.5">
          {hint}
        </span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full border border-[color:var(--border)] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-black resize-none"
      />
    </div>
  );
}
