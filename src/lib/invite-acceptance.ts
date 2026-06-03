/**
 * Decides whether a partner invite can be accepted. Pure so the rules can be
 * unit-tested away from the DB/session. The invite token is a 192-bit random
 * bearer string, but possession alone shouldn't be enough: we also bind
 * acceptance to the invited email. A signed-in user whose email differs from
 * the invitee's must explicitly confirm ("Accept anyway") — this keeps the
 * cross-email case working (invited at work, signed in with Google) while
 * stopping a leaked link from being claimed silently by the wrong account.
 */
export type InviteForAcceptance = {
  inviter_id: string;
  invitee_email: string;
  accepted_at: string | null;
  expires_at: string;
};

export type AcceptanceContext = {
  /** The looked-up invite, or null when the token matched nothing. */
  invite: InviteForAcceptance | null;
  userId: string;
  userEmail: string | null;
  /** True once the user has acknowledged an email mismatch. */
  confirmedMismatch: boolean;
  now: Date;
};

export type AcceptanceReason =
  | "not_found"
  | "already_accepted"
  | "expired"
  | "cannot_self_accept"
  | "email_mismatch";

export type AcceptanceDecision =
  | { ok: true }
  | { ok: false; reason: AcceptanceReason; invitedEmail?: string };

function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export function evaluateInviteAcceptance(
  c: AcceptanceContext
): AcceptanceDecision {
  if (!c.invite) return { ok: false, reason: "not_found" };
  if (c.invite.accepted_at) return { ok: false, reason: "already_accepted" };
  if (new Date(c.invite.expires_at) < c.now) {
    return { ok: false, reason: "expired" };
  }
  if (c.invite.inviter_id === c.userId) {
    return { ok: false, reason: "cannot_self_accept" };
  }
  if (
    !c.confirmedMismatch &&
    normalizeEmail(c.userEmail) !== normalizeEmail(c.invite.invitee_email)
  ) {
    return {
      ok: false,
      reason: "email_mismatch",
      invitedEmail: c.invite.invitee_email,
    };
  }
  return { ok: true };
}
