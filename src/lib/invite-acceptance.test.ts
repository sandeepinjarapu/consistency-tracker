import { describe, it, expect } from "vitest";
import {
  evaluateInviteAcceptance,
  type AcceptanceContext,
} from "./invite-acceptance";

const now = new Date("2026-06-03T12:00:00Z");

const base: AcceptanceContext = {
  invite: {
    inviter_id: "inviter-1",
    invitee_email: "alice@example.com",
    accepted_at: null,
    expires_at: "2026-06-10T12:00:00Z", // future
  },
  userId: "user-2",
  userEmail: "alice@example.com",
  confirmedMismatch: false,
  now,
};

describe("evaluateInviteAcceptance", () => {
  it("accepts when the invite is valid and emails match", () => {
    expect(evaluateInviteAcceptance(base)).toEqual({ ok: true });
  });

  it("matches emails case- and whitespace-insensitively", () => {
    const r = evaluateInviteAcceptance({
      ...base,
      userEmail: "  ALICE@Example.com ",
    });
    expect(r).toEqual({ ok: true });
  });

  it("reports not_found when the token matched nothing", () => {
    expect(evaluateInviteAcceptance({ ...base, invite: null })).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("reports already_accepted", () => {
    expect(
      evaluateInviteAcceptance({
        ...base,
        invite: { ...base.invite!, accepted_at: "2026-06-02T00:00:00Z" },
      })
    ).toEqual({ ok: false, reason: "already_accepted" });
  });

  it("reports expired", () => {
    expect(
      evaluateInviteAcceptance({
        ...base,
        invite: { ...base.invite!, expires_at: "2026-06-01T00:00:00Z" },
      })
    ).toEqual({ ok: false, reason: "expired" });
  });

  it("blocks accepting your own invite", () => {
    expect(
      evaluateInviteAcceptance({ ...base, userId: "inviter-1" })
    ).toEqual({ ok: false, reason: "cannot_self_accept" });
  });

  it("refuses a mismatched email and surfaces the invited address", () => {
    expect(
      evaluateInviteAcceptance({ ...base, userEmail: "bob@gmail.com" })
    ).toEqual({
      ok: false,
      reason: "email_mismatch",
      invitedEmail: "alice@example.com",
    });
  });

  it("allows a mismatched email once explicitly confirmed", () => {
    expect(
      evaluateInviteAcceptance({
        ...base,
        userEmail: "bob@gmail.com",
        confirmedMismatch: true,
      })
    ).toEqual({ ok: true });
  });

  it("treats a missing user email as a mismatch", () => {
    const r = evaluateInviteAcceptance({ ...base, userEmail: null });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toBe("email_mismatch");
  });

  it("prioritizes expiry over an email mismatch", () => {
    // Even confirming the mismatch shouldn't resurrect an expired invite.
    expect(
      evaluateInviteAcceptance({
        ...base,
        invite: { ...base.invite!, expires_at: "2026-06-01T00:00:00Z" },
        userEmail: "bob@gmail.com",
        confirmedMismatch: true,
      })
    ).toEqual({ ok: false, reason: "expired" });
  });
});
