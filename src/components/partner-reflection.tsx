"use client";

import { useState, useRef, useEffect } from "react";
import type { Reflection } from "@/lib/actions/reflections";

/**
 * One partner-visible reflection for a week. Text clamps to 3 lines when the
 * content overflows — pressing "more" reveals everything. The button only
 * renders when the content is actually clamped, so short reflections stay clean.
 */
export default function PartnerReflection({
  reflection,
  weekLabel,
}: {
  reflection: Reflection;
  weekLabel: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Measure after paint to determine whether the content is actually clamped.
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    setOverflows(el.scrollHeight > el.clientHeight + 2); // +2 rounding tolerance
  }, []);

  const lines: Array<{ label: string | null; text: string }> = [];
  if (reflection.continue_text)
    lines.push({ label: "Continuing", text: reflection.continue_text });
  if (reflection.stop_text)
    lines.push({ label: "Stopping", text: reflection.stop_text });
  if (reflection.improve_text)
    lines.push({ label: "Improving", text: reflection.improve_text });
  if (reflection.notes) lines.push({ label: null, text: reflection.notes });
  if (lines.length === 0) return null;

  return (
    <div className="border-l-2 border-[color:var(--border)] pl-4">
      <p className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-2">
        {weekLabel}
      </p>
      <div
        ref={contentRef}
        className={`space-y-2 overflow-hidden ${expanded ? "" : "line-clamp-3"}`}
      >
        {lines.map((l, i) => (
          <p key={i} className="text-sm leading-relaxed">
            {l.label ? (
              <span className="text-[color:var(--muted)]">{l.label}: </span>
            ) : null}
            {l.text}
          </p>
        ))}
      </div>
      {(overflows || expanded) && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((e) => !e)}
          className="mt-2 min-h-[44px] flex items-center text-xs text-[color:var(--muted)] hover:text-black"
        >
          {expanded ? "less" : "more"}
        </button>
      )}
    </div>
  );
}
