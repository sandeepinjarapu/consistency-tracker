"use client";

import { useState, useTransition } from "react";
import { upsertReflection, type Reflection } from "@/lib/actions/reflections";

export default function ReflectionEditor({
  weekStartDate,
  initial,
  continueHint = "What worked this week — keep doing it.",
  improveHint = "Small change for next week.",
}: {
  weekStartDate: string;
  initial: Reflection | null;
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
  const [visibility, setVisibility] = useState<"private" | "partner">(
    initial?.visibility ?? "private"
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
        label="Continue"
        hint={continueHint}
        value={continueText}
        onChange={setContinueText}
        placeholder="Morning writing right after coffee felt focused…"
      />
      <Prompt
        label="Stop"
        hint="What got in the way — cut it."
        value={stopText}
        onChange={setStopText}
        placeholder="Scrolling Twitter before bed killed sleep…"
      />
      <Prompt
        label="Improve"
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
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[color:var(--muted)]">Visibility:</span>
          <button
            type="button"
            onClick={() => setVisibility("private")}
            className={`px-3 py-1 rounded-full border transition ${
              visibility === "private"
                ? "border-black bg-black text-white"
                : "border-[color:var(--border)] text-[color:var(--muted)] hover:border-black"
            }`}
          >
            Private
          </button>
          <button
            type="button"
            onClick={() => setVisibility("partner")}
            className={`px-3 py-1 rounded-full border transition ${
              visibility === "partner"
                ? "border-black bg-black text-white"
                : "border-[color:var(--border)] text-[color:var(--muted)] hover:border-black"
            }`}
          >
            Partner
          </button>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          {savedAt ? (
            <span className="text-xs text-[color:var(--muted)]">Saved · {savedAt}</span>
          ) : null}
          {error ? <span className="text-xs text-red-600">{error}</span> : null}
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="bg-black text-white text-sm rounded-md px-4 py-2 hover:bg-gray-800 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save reflection"}
          </button>
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
      <div className="flex items-baseline justify-between mb-1">
        <label className="text-xs font-medium uppercase tracking-wider">
          {label}
        </label>
        <span className="text-[10px] text-[color:var(--muted)]">{hint}</span>
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
