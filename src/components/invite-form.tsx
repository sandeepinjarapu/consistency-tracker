"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendInvite } from "@/lib/actions/partners";

export default function InviteForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    url: string;
    emailSent: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setCopied(false);
    startTransition(async () => {
      try {
        const result = await sendInvite(email);
        setSuccess({ url: result.inviteUrl, emailSent: result.emailSent });
        setEmail("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't send invite");
      }
    });
  }

  async function copyUrl() {
    if (!success) return;
    try {
      await navigator.clipboard.writeText(success.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard may be blocked — user can still select manually
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="partner@example.com"
          className="flex-1 border border-[color:var(--border)] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-black"
        />
        <button
          type="submit"
          disabled={pending || !email.trim()}
          className="bg-black text-white text-sm rounded-md px-4 py-2 hover:bg-gray-800 disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send invite"}
        </button>
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      {success ? (
        <div className="border border-[color:var(--border)] rounded-md p-3 bg-gray-50 text-xs space-y-2">
          <p className="font-medium">
            {success.emailSent
              ? "Invite sent — also copyable below."
              : "Invite created. Email couldn't be delivered (Resend sandbox limits) — share the link directly."}
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[10px] bg-white border border-[color:var(--border)] rounded px-2 py-1.5 truncate">
              {success.url}
            </code>
            <button
              type="button"
              onClick={copyUrl}
              className="border border-[color:var(--border)] rounded-md px-3 py-1.5 hover:bg-white"
            >
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        </div>
      ) : null}
    </form>
  );
}
