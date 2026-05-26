import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendShareDigest } from "@/lib/email";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Daily share-digest cron. Vercel hits this once a day (see vercel.json).
 *
 * For each share row with notified_at IS NULL:
 *   - Group by viewer + owner
 *   - Send one digest email per (viewer, owner) pair listing all the
 *     newly-shared goal names
 *   - Mark those rows notified_at = now()
 */
export async function GET(request: Request) {
  // Vercel sends Authorization: Bearer <CRON_SECRET> for scheduled crons.
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: pending, error } = await supabase
    .from("shares")
    .select("id, owner_id, viewer_id, goal_id")
    .is("notified_at", null);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (!pending || pending.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, batches: 0 });
  }

  // Need viewer emails + owner display names + goal names
  const viewerIds = [...new Set(pending.map((r) => r.viewer_id))];
  const ownerIds = [...new Set(pending.map((r) => r.owner_id))];
  const goalIds = [...new Set(pending.map((r) => r.goal_id))];

  const [viewersRes, ownersRes, goalsRes] = await Promise.all([
    // auth.users has the email; we get it via the admin API
    supabase.auth.admin.listUsers({ perPage: 1000 }),
    supabase.from("profiles").select("id, display_name").in("id", ownerIds),
    supabase.from("goals").select("id, name").in("id", goalIds),
  ]);

  const allUsers = viewersRes.data?.users ?? [];
  const emailByUserId = new Map(
    allUsers
      .filter((u) => viewerIds.includes(u.id) && !!u.email)
      .map((u) => [u.id, u.email as string])
  );
  const ownerNameById = new Map(
    (ownersRes.data ?? []).map((p) => [p.id, p.display_name ?? "Someone"])
  );
  const goalNameById = new Map(
    (goalsRes.data ?? []).map((g) => [g.id, g.name])
  );

  // Group: (viewer_id, owner_id) -> share[]
  type Key = string;
  const groups = new Map<Key, { viewerId: string; ownerId: string; shareIds: string[]; goalIds: string[] }>();
  for (const s of pending) {
    const key = `${s.viewer_id}::${s.owner_id}`;
    if (!groups.has(key)) {
      groups.set(key, {
        viewerId: s.viewer_id,
        ownerId: s.owner_id,
        shareIds: [],
        goalIds: [],
      });
    }
    const g = groups.get(key)!;
    g.shareIds.push(s.id);
    g.goalIds.push(s.goal_id);
  }

  let sent = 0;
  const failures: string[] = [];
  const successShareIds: string[] = [];

  for (const g of groups.values()) {
    const to = emailByUserId.get(g.viewerId);
    if (!to) {
      failures.push(`no-email:${g.viewerId}`);
      continue;
    }
    const ownerName = ownerNameById.get(g.ownerId) ?? "Someone";
    const goalNames = g.goalIds
      .map((id) => goalNameById.get(id))
      .filter((n): n is string => !!n);

    const result = await sendShareDigest({
      to,
      ownerName,
      ownerId: g.ownerId,
      goalNames,
    });

    if (result.ok) {
      sent++;
      successShareIds.push(...g.shareIds);
    } else {
      failures.push(`${g.viewerId}::${g.ownerId}: ${result.error ?? "unknown"}`);
    }
  }

  // Mark successfully-sent batches as notified
  if (successShareIds.length > 0) {
    await supabase
      .from("shares")
      .update({ notified_at: new Date().toISOString() })
      .in("id", successShareIds);
  }

  return NextResponse.json({
    ok: true,
    sent,
    batches: groups.size,
    pending: pending.length,
    failures: failures.length > 0 ? failures : undefined,
  });
}
