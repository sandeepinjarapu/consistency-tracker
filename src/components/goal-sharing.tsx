"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setGoalShared, sendInvite } from "@/lib/actions/partners";
import { tapTarget } from "@/lib/ui";

type Partner = { id: string; display_name: string | null };
type Pending = { id: string; invitee_email: string; invite_url: string };

function summarize(names: string[]): string {
  if (names.length <= 3) return names.join(", ");
  const rest = names.length - 3;
  return `${names.slice(0, 3).join(", ")} and ${rest} other${rest === 1 ? "" : "s"}`;
}

/**
 * The goal's sharing as a single tappable status that opens a share sheet.
 * Resting: "Shared with Richa" or "Private". The sheet composes accepted
 * partners (tap to toggle), pending invites (waiting, with a copy link), and an
 * invite field — so inviting and sharing live in one place instead of the old
 * Manage + checkbox + Done. All actions are the existing server actions.
 */
export default function GoalSharing({
  goalId,
  partners,
  pending,
  sharedWith,
}: {
  goalId: string;
  partners: Partner[];
  pending: Pending[];
  sharedWith: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [shared, setShared] = useState(() => new Set(sharedWith));
  const [busy, startTransition] = useTransition();

  const sharedNames = partners
    .filter((p) => shared.has(p.id))
    .map((p) => p.display_name ?? "Partner");

  function toggle(partnerId: string) {
    const next = new Set(shared);
    const wasShared = next.has(partnerId);
    if (wasShared) next.delete(partnerId);
    else next.add(partnerId);
    setShared(next);
    startTransition(async () => {
      try {
        await setGoalShared(goalId, partnerId, !wasShared);
      } catch {
        setShared((cur) => {
          const revert = new Set(cur);
          if (wasShared) revert.add(partnerId);
          else revert.delete(partnerId);
          return revert;
        });
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={`-mx-1.5 inline-flex max-w-full items-center gap-1.5 rounded-lg px-1.5 py-1 text-sm hover:bg-gray-50 ${
          sharedNames.length > 0 ? "text-[color:var(--foreground)]" : "text-[color:var(--muted)]"
        }`}
      >
        {sharedNames.length > 0 ? <PeopleIcon /> : <LockIcon />}
        <span className="truncate">
          {sharedNames.length > 0 ? `Shared with ${summarize(sharedNames)}` : "Private"}
        </span>
        <span aria-hidden className="text-[color:var(--muted)]">›</span>
      </button>

      {open ? (
        <ShareSheet
          partners={partners}
          pending={pending}
          shared={shared}
          busy={busy}
          onToggle={toggle}
          onInvited={() => router.refresh()}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function ShareSheet({
  partners,
  pending,
  shared,
  busy,
  onToggle,
  onInvited,
  onClose,
}: {
  partners: Partner[];
  pending: Pending[];
  shared: Set<string>;
  busy: boolean;
  onToggle: (id: string) => void;
  onInvited: () => void;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [sending, startSend] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ url: string; emailSent: boolean } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  function copy(url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(url);
      setTimeout(() => setCopied((c) => (c === url ? null : c)), 2000);
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreated(null);
    startSend(async () => {
      try {
        const r = await sendInvite(email);
        setCreated({ url: r.inviteUrl, emailSent: r.emailSent });
        setEmail("");
        onInvited();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't send invite");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/20"
      />
      <div
        role="dialog"
        aria-label="Share this goal"
        className="relative z-10 w-full max-w-sm rounded-t-2xl sm:rounded-2xl border border-[color:var(--border)] bg-white p-5 shadow-md"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-md text-[color:var(--muted)] hover:bg-gray-100 hover:text-black"
        >
          ✕
        </button>
        <h3 className="text-sm font-semibold">Share this goal</h3>
        <p className="mt-1 mb-3 text-xs text-[color:var(--muted)]">
          Only the partners you pick can see it. Private by default, reversible anytime.
        </p>

        {partners.map((p) => {
          const on = shared.has(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onToggle(p.id)}
              disabled={busy}
              className={`${tapTarget} -mx-2 w-full justify-between gap-3 rounded-lg px-2 hover:bg-gray-50 disabled:opacity-60`}
            >
              <span className={`text-sm ${on ? "" : "text-[color:var(--muted)]"}`}>
                {p.display_name ?? "Partner"}
              </span>
              <span
                className="grid h-[22px] w-[22px] place-items-center rounded-full border"
                style={
                  on
                    ? { background: "#22c55e", borderColor: "#22c55e" }
                    : { borderColor: "var(--border)" }
                }
              >
                {on ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                ) : null}
              </span>
            </button>
          );
        })}

        {pending.map((inv) => (
          <div
            key={inv.id}
            className="-mx-2 flex min-h-[44px] items-center justify-between gap-2 rounded-lg px-2"
          >
            <span className="min-w-0 truncate text-sm text-[color:var(--muted)]">
              {inv.invitee_email}
              <span className="block text-[11px]">Waiting to accept</span>
            </span>
            <button
              type="button"
              onClick={() => copy(inv.invite_url)}
              className="shrink-0 rounded-md border border-[color:var(--border)] px-2 py-1 text-[11px] hover:border-black"
            >
              {copied === inv.invite_url ? "Copied" : "Copy link"}
            </button>
          </div>
        ))}

        <form onSubmit={submit} className="mt-3 border-t border-[color:var(--border)] pt-3">
          <div className="flex items-center gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="partner@email.com"
              className="h-10 min-w-0 flex-1 rounded-lg border border-[color:var(--border)] px-3 text-sm focus:border-black focus:outline-none"
            />
            <button
              type="submit"
              disabled={sending || !email.trim()}
              className="h-10 shrink-0 rounded-lg bg-black px-3 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send invite"}
            </button>
          </div>
          {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
          {created ? (
            <div className="mt-2 rounded-md border border-[color:var(--border)] bg-gray-50 p-2.5 text-[11px]">
              <p className="mb-1.5 text-[color:var(--muted)]">
                {created.emailSent
                  ? "Invite sent. You can share this link too."
                  : "Invite created. Email couldn't be delivered, so share this link directly."}
              </p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1 text-[10px] text-[color:var(--muted)] border border-[color:var(--border)]">
                  {created.url}
                </code>
                <button
                  type="button"
                  onClick={() => copy(created.url)}
                  className="shrink-0 rounded-md border border-[color:var(--border)] px-2 py-1 hover:border-black"
                >
                  {copied === created.url ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          ) : null}
        </form>

        <div className="mt-3 flex justify-end border-t border-[color:var(--border)] pt-3">
          <Link
            href="/consistencytracker/partners"
            className="text-xs text-[color:var(--muted)] underline hover:text-black"
          >
            Manage partners
          </Link>
        </div>
      </div>
    </div>
  );
}

function PeopleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="9" cy="7" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M16 5a3 3 0 0 1 0 6" />
      <path d="M21 20c0-2.3-1.4-4.3-3.5-5.2" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
