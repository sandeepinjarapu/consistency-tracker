"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The goal's "why", clamped to a few lines with a tap to expand, so a long
 * freeform motivation never walls off the top of the page. A real truncate
 * with a toggle, not a bare CSS clamp (which would hide the affordance).
 */
export default function Motivation({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el) setClamped(el.scrollHeight > el.clientHeight + 1);
  }, [text]);

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
