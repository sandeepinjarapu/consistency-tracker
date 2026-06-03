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

export default function InviteAcceptButton({
  token,
  currentEmail,
}: {
  token: string;
  currentEmail?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Set when the invited email differs from the signed-in account — we hold
  // here until the user explicitly confirms.
  const [mismatchEmail, setMismatchEmail] = useState<string | null>(null);

  function accept(confirmMismatch: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await acceptInvite(token, confirmMismatch);
      if (result.ok) {
        router.replace(`/consistencytracker/partners/${result.partnerId}`);
        router.refresh();
      } else if (result.reason === "email_mismatch") {
        setMismatchEmail(result.invitedEmail ?? "another address");
      } else {
        setError(REASONS[result.reason] ?? "Couldn't accept invite.");
      }
    });
  }

  if (mismatchEmail) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[color:var(--muted)] text-center">
          This invite was sent to{" "}
          <span className="font-medium text-black">{mismatchEmail}</span>
          {currentEmail ? (
            <>
              , but you&apos;re signed in as{" "}
              <span className="font-medium text-black">{currentEmail}</span>
            </>
          ) : (
            ", but you're signed in with a different account"
          )}
          . Accept with this account anyway?
        </p>
        <button
          type="button"
          onClick={() => accept(true)}
          disabled={pending}
          className="w-full bg-black text-white text-sm rounded-md py-3 hover:bg-gray-800 disabled:opacity-50"
        >
          {pending ? "Accepting…" : "Accept anyway"}
        </button>
        <button
          type="button"
          onClick={() => setMismatchEmail(null)}
          disabled={pending}
          className="w-full text-sm text-[color:var(--muted)] hover:text-black disabled:opacity-50"
        >
          Cancel
        </button>
        {error ? (
          <p className="text-xs text-red-600 text-center">{error}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => accept(false)}
        disabled={pending}
        className="w-full bg-black text-white text-sm rounded-md py-3 hover:bg-gray-800 disabled:opacity-50"
      >
        {pending ? "Accepting…" : "Accept invite"}
      </button>
      {error ? <p className="text-xs text-red-600 text-center">{error}</p> : null}
    </div>
  );
}
