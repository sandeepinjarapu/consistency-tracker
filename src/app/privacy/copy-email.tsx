"use client";

import { useState } from "react";

const EMAIL = "privacy@sixthsense.works";

export default function CopyEmail() {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(EMAIL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono text-sm select-all">{EMAIL}</span>
      <button
        type="button"
        onClick={handleCopy}
        className="text-xs text-[color:var(--muted)] underline hover:text-black transition"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </span>
  );
}
