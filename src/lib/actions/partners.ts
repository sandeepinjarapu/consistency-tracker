"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { sendInviteEmail } from "@/lib/email";
import { revalidatePath } from "next/cache";

// A goal can be shared with at most this many partners — accountability is
// about a few close people, not an audience. (Non-exported: this is a
// "use server" module, which may only export async functions.)
const MAX_SHARES_PER_GOAL = 10;

export type Partner = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  sharedGoalCount: number; // goals they've shared with me
  lastActive: string | null; // most recent check-in date on those goals (YYYY-MM-DD)
  hasNewShare: boolean; // a goal they shared with me that I haven't seen yet
};

export type PendingInvite = {
  id: string;
  invitee_email: string;
  token: string;
  created_at: string;
  expires_at: string;
  invite_url: string;
};

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/**
 * List the current user's accepted partners. A partnership exists when
 * either side accepted an invite from the other.
 */
export async function listPartners(): Promise<Partner[]> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return [];

  // Two queries: invites I sent that got accepted, and invites sent to me that I accepted
  const [outbound, inbound] = await Promise.all([
    supabase
      .from("partner_invites")
      .select("accepted_by")
      .eq("inviter_id", user.id)
      .not("accepted_at", "is", null),
    supabase
      .from("partner_invites")
      .select("inviter_id")
      .eq("accepted_by", user.id)
      .not("accepted_at", "is", null),
  ]);

  const partnerIds = new Set<string>();
  (outbound.data ?? []).forEach((r) => r.accepted_by && partnerIds.add(r.accepted_by));
  (inbound.data ?? []).forEach((r) => r.inviter_id && partnerIds.add(r.inviter_id));

  if (partnerIds.size === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", Array.from(partnerIds));

  // Goals each partner has shared with me, and the most recent check-in on
  // them — so the partners list can show "N shared · active 2 days ago".
  const { data: myShares } = await supabase
    .from("shares")
    .select("owner_id, goal_id, notified_at")
    .eq("viewer_id", user.id)
    .in("owner_id", Array.from(partnerIds));

  const countByOwner = new Map<string, number>();
  const ownerByGoal = new Map<string, string>();
  const newShareByOwner = new Map<string, boolean>();
  for (const s of myShares ?? []) {
    ownerByGoal.set(s.goal_id, s.owner_id);
    countByOwner.set(s.owner_id, (countByOwner.get(s.owner_id) ?? 0) + 1);
    if (s.notified_at === null) newShareByOwner.set(s.owner_id, true);
  }

  const lastByOwner = new Map<string, string>();
  const sharedGoalIds = Array.from(ownerByGoal.keys());
  if (sharedGoalIds.length > 0) {
    const { data: cis } = await supabase
      .from("check_ins")
      .select("goal_id, date")
      .in("goal_id", sharedGoalIds)
      .order("date", { ascending: false });
    // Rows arrive newest-first, so the first date seen per owner is their max.
    for (const ci of cis ?? []) {
      const owner = ownerByGoal.get(ci.goal_id);
      if (owner && !lastByOwner.has(owner)) lastByOwner.set(owner, ci.date);
    }
  }

  return (profiles ?? []).map((p) => ({
    ...p,
    sharedGoalCount: countByOwner.get(p.id) ?? 0,
    lastActive: lastByOwner.get(p.id) ?? null,
    hasNewShare: newShareByOwner.get(p.id) ?? false,
  })) as Partner[];
}

/**
 * For the current user's own goals, map goal_id → display names of the
 * partners each goal is shared with. Powers the "Shared with X" badge on the
 * goals list. Goals absent from the map are private.
 */
export async function listGoalShares(): Promise<Record<string, string[]>> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return {};

  const { data: shares } = await supabase
    .from("shares")
    .select("goal_id, viewer_id")
    .eq("owner_id", user.id);
  if (!shares || shares.length === 0) return {};

  const viewerIds = Array.from(new Set(shares.map((s) => s.viewer_id)));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", viewerIds);
  const nameById = new Map(
    (profiles ?? []).map((p) => [p.id, p.display_name ?? "a partner"])
  );

  const byGoal: Record<string, string[]> = {};
  for (const s of shares) {
    (byGoal[s.goal_id] ??= []).push(nameById.get(s.viewer_id) ?? "a partner");
  }
  return byGoal;
}

export async function listPendingInvites(): Promise<PendingInvite[]> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return [];

  const { data } = await supabase
    .from("partner_invites")
    .select("id, invitee_email, token, created_at, expires_at")
    .eq("inviter_id", user.id)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  const base = siteUrl();
  return (data ?? []).map((r) => ({
    ...r,
    invite_url: `${base}/consistencytracker/invite/${r.token}`,
  }));
}

export async function sendInvite(
  email: string
): Promise<{ token: string; inviteUrl: string; emailSent: boolean; emailError?: string }> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    throw new Error("Enter a valid email address");
  }

  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");

  // Don't allow inviting yourself
  if (user.email && user.email.toLowerCase() === trimmed) {
    throw new Error("You can't invite yourself");
  }

  // Insert invite (token auto-generated by DB default)
  const { data: invite, error } = await supabase
    .from("partner_invites")
    .insert({ inviter_id: user.id, invitee_email: trimmed })
    .select("id, token")
    .single();
  if (error) throw error;

  // Fetch inviter name for email
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const inviterName = profile?.display_name ?? user.email ?? "Someone";
  const inviteUrl = `${siteUrl()}/consistencytracker/invite/${invite.token}`;

  // Best-effort email
  const result = await sendInviteEmail({
    to: trimmed,
    inviterName,
    inviteUrl,
  });

  revalidatePath("/consistencytracker/partners");
  return {
    token: invite.token,
    inviteUrl,
    emailSent: result.ok,
    emailError: result.error,
  };
}

export async function revokeInvite(inviteId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("partner_invites")
    .delete()
    .eq("id", inviteId);
  if (error) throw error;
  revalidatePath("/consistencytracker/partners");
}

/**
 * Accept an invite by its token. Uses service-role to look up the invite
 * (the token in the URL is the proof of intent — we don't want RLS to
 * block lookup based on who's signed in).
 */
export async function acceptInvite(
  token: string
): Promise<{ ok: true; partnerId: string } | { ok: false; reason: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "not_signed_in" };

  const service = createServiceClient();

  const { data: invite, error: lookupErr } = await service
    .from("partner_invites")
    .select("id, inviter_id, invitee_email, accepted_at, expires_at")
    .eq("token", token)
    .single();

  if (lookupErr || !invite) return { ok: false, reason: "not_found" };
  if (invite.accepted_at) return { ok: false, reason: "already_accepted" };
  if (new Date(invite.expires_at) < new Date()) return { ok: false, reason: "expired" };
  if (invite.inviter_id === user.id) return { ok: false, reason: "cannot_self_accept" };

  // Idempotent: even if these two are already partnered via another
  // accepted invite, we just mark this invite accepted so it clears from
  // pending. listPartners dedupes, so no duplicate state is created.
  const { error: updateErr } = await service
    .from("partner_invites")
    .update({ accepted_at: new Date().toISOString(), accepted_by: user.id })
    .eq("id", invite.id);
  if (updateErr) return { ok: false, reason: "update_failed" };

  revalidatePath("/consistencytracker", "layout");
  return { ok: true, partnerId: invite.inviter_id };
}

/**
 * For a given goal, which partners is it currently shared with?
 */
export async function listSharesForGoal(goalId: string): Promise<string[]> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return [];
  const { data } = await supabase
    .from("shares")
    .select("viewer_id")
    .eq("owner_id", user.id)
    .eq("goal_id", goalId);
  return (data ?? []).map((r) => r.viewer_id);
}

/**
 * Number of share rows the current user (as viewer) hasn't seen yet.
 * Used by the nav badge.
 */
export async function countUnseenShares(): Promise<number> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return 0;
  const { count } = await supabase
    .from("shares")
    .select("*", { count: "exact", head: true })
    .eq("viewer_id", user.id)
    .is("notified_at", null);
  return count ?? 0;
}

/**
 * Mark all shares from a given owner (to the current user as viewer) as
 * seen. Called when the user visits the partner's page.
 */
export async function markSharesSeen(ownerId: string): Promise<void> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return;
  await supabase
    .from("shares")
    .update({ notified_at: new Date().toISOString() })
    .eq("viewer_id", user.id)
    .eq("owner_id", ownerId)
    .is("notified_at", null);
  revalidatePath("/consistencytracker", "layout");
}

/**
 * Whether the given userId is an accepted partner of the current user.
 */
export async function isPartner(partnerId: string): Promise<boolean> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user || user.id === partnerId) return false;

  const [out, inb] = await Promise.all([
    supabase
      .from("partner_invites")
      .select("id")
      .eq("inviter_id", user.id)
      .eq("accepted_by", partnerId)
      .not("accepted_at", "is", null)
      .limit(1),
    supabase
      .from("partner_invites")
      .select("id")
      .eq("inviter_id", partnerId)
      .eq("accepted_by", user.id)
      .not("accepted_at", "is", null)
      .limit(1),
  ]);
  return (out.data?.length ?? 0) > 0 || (inb.data?.length ?? 0) > 0;
}

/**
 * Server-side ownership guard for share mutations. RLS also enforces
 * this (see 0006), but checking here gives a clearer error and avoids
 * a round-trip on tampered clients.
 */
async function assertOwnsGoal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  goalId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("goals")
    .select("user_id")
    .eq("id", goalId)
    .single();
  if (error || !data) throw new Error("Goal not found");
  if (data.user_id !== userId) {
    throw new Error("You can only share your own goals");
  }
}

export async function setGoalShared(
  goalId: string,
  partnerId: string,
  shared: boolean
): Promise<void> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");

  // Server-side guards: you must own the goal AND the recipient must
  // actually be your accepted partner. Either check failing means a
  // tampered client is trying to share something it shouldn't.
  await assertOwnsGoal(supabase, user.id, goalId);
  const partnered = await isPartner(partnerId);
  if (!partnered) throw new Error("Not a partner");

  if (shared) {
    // Enforce the per-goal sharing cap before adding a new viewer.
    const { count } = await supabase
      .from("shares")
      .select("*", { count: "exact", head: true })
      .eq("owner_id", user.id)
      .eq("goal_id", goalId);
    if ((count ?? 0) >= MAX_SHARES_PER_GOAL) {
      throw new Error(
        `You can share a goal with up to ${MAX_SHARES_PER_GOAL} partners.`
      );
    }

    const { error } = await supabase
      .from("shares")
      .insert({ owner_id: user.id, viewer_id: partnerId, goal_id: goalId });
    // Ignore unique-violation (already shared) — Postgres code 23505.
    if (error && error.code !== "23505") throw error;
  } else {
    const { error } = await supabase
      .from("shares")
      .delete()
      .eq("owner_id", user.id)
      .eq("viewer_id", partnerId)
      .eq("goal_id", goalId);
    if (error) throw error;
  }
  revalidatePath(`/consistencytracker/goals/${goalId}`);
  revalidatePath(`/consistencytracker/partners/${partnerId}`);
}
