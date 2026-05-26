"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { revokeInvite } from "@/lib/actions/partners";

export default function PendingInviteRow({
  id,
  email,
  url,
}: {
  id: string;
  email: string;
  url: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  function handleRevoke() {
    if (!confirm("Revoke this invite? They won't be able to accept it anymore.")) return;
    startTransition(async () => {
      await revokeInvite(id);
      router.refresh();
    });
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <li className="flex items-center justify-between px-4 py-3 gap-3">
      <div className="min-w-0">
        <p className="text-sm">{email}</p>
        <p className="text-xs text-[color:var(--muted)] mt-0.5">Pending</p>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={handleCopy}
          className="text-[color:var(--muted)] hover:text-black"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
        <button
          type="button"
          onClick={handleRevoke}
          disabled={pending}
          className="text-[color:var(--muted)] hover:text-red-600 disabled:opacity-50"
        >
          Revoke
        </button>
      </div>
    </li>
  );
}
