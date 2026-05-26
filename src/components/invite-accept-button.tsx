"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptInvite } from "@/lib/actions/partners";

const REASONS: Record<string, string> = {
  not_signed_in: "Sign in first",
  not_found: "This invite doesn't exist or has been revoked.",
  expired: "This invite has expired. Ask for a new one.",
  already_accepted: "This invite has already been accepted.",
  cannot_self_accept: "You can't accept your own invite.",
  update_failed: "Something went wrong. Try again.",
};

export default function InviteAcceptButton({ token }: { token: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAccept() {
    setError(null);
    startTransition(async () => {
      const result = await acceptInvite(token);
      if (result.ok) {
        router.replace(`/consistencytracker/partners/${result.partnerId}`);
        router.refresh();
      } else {
        setError(REASONS[result.reason] ?? "Couldn't accept invite.");
      }
    });
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleAccept}
        disabled={pending}
        className="w-full bg-black text-white text-sm rounded-md py-3 hover:bg-gray-800 disabled:opacity-50"
      >
        {pending ? "Accepting…" : "Accept invite"}
      </button>
      {error ? <p className="text-xs text-red-600 text-center">{error}</p> : null}
    </div>
  );
}
