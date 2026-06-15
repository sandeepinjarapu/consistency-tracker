import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendWeeklySummary } from "@/lib/email";
import { addDays, isoWeekStart, todayIn } from "@/lib/dates";
import { partnerSummaryPairs } from "@/lib/partner-pairs";
import {
  computeWeeklyGoalStats,
  totalTarget,
  type SummaryGoal,
} from "@/lib/weekly-summary";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Weekly partner-summary cron. Runs Monday 02:30 UTC (see vercel.json),
 * summarizing the prior, fully-complete Mon–Sun week.
 *
 * For every accepted partnership (A ↔ B), for each direction (A is owner,
 * B is viewer), gather the goals A has shared with B, compute A's stats
 * on those goals for the past Mon–Sun week, and email B one summary.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabase = createServiceClient();

  // Cron runs Monday 02:30 UTC (≈ 8 AM IST Monday). At that point the
  // PREVIOUS Mon-Sun week is fully complete. Summarize that, never the
  // current in-progress week — otherwise Sunday-targeting goals would
  // show as missed before Sunday is over.
  const todayUtc = todayIn("UTC");
  const thisWeekMon = isoWeekStart(todayUtc);
  const summaryWeekStart = addDays(thisWeekMon, -7); // previous Monday
  const summaryWeekEnd = addDays(summaryWeekStart, 6); // previous Sunday

  // Accepted partnerships → deduped (viewer, owner) pairs.
  const { data: invites } = await supabase
    .from("partner_invites")
    .select("inviter_id, accepted_by")
    .not("accepted_at", "is", null);
  const pairs = partnerSummaryPairs(invites ?? []);

  // Pull every active goal + this week's check-ins. Self-summaries go to all
  // goal owners; partner summaries cover the shared subset.
  const [goalsRes, checkInsRes] = await Promise.all([
    supabase
      .from("goals")
      .select("id, user_id, name, target_days, weekly_target, created_at")
      .eq("active", true),
    supabase
      .from("check_ins")
      .select("goal_id, date, status")
      .gte("date", summaryWeekStart)
      .lte("date", summaryWeekEnd),
  ]);
  const goals = goalsRes.data ?? [];
  const checkIns = checkInsRes.data ?? [];

  const goalOwnerIds = [...new Set(goals.map((g) => g.user_id))];
  if (goalOwnerIds.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, pairs: pairs.length });
  }

  // Shares only matter for owners who have a partner.
  const partnerOwnerIds = [...new Set(pairs.map((p) => p.ownerId))];
  const [sharesRes, reflectionsRes] = await Promise.all([
    partnerOwnerIds.length > 0
      ? supabase
          .from("shares")
          .select("owner_id, viewer_id, goal_id")
          .in("owner_id", partnerOwnerIds)
      : Promise.resolve({ data: [] as { owner_id: string; viewer_id: string; goal_id: string }[] }),
    // Fetch all reflections for the summary week across every goal owner.
    // Self-summary uses any reflection; partner-summary is filtered to
    // visibility='partner' in code so the DB query stays simple.
    supabase
      .from("weekly_reflections")
      .select("user_id, continue_text, stop_text, improve_text, notes, visibility")
      .eq("week_start_date", summaryWeekStart)
      .in("user_id", goalOwnerIds),
  ]);
  const shares = sharesRes.data ?? [];
  const allReflections = reflectionsRes.data ?? [];
  // Self-summary: owner sees their own reflection regardless of visibility.
  const selfReflectionByOwner = new Map(
    allReflections.map((r) => [
      r.user_id,
      { continueText: r.continue_text, stopText: r.stop_text, improveText: r.improve_text, notes: r.notes },
    ])
  );
  // Partner-summary: only reflections explicitly shared with partners.
  const partnerReflectionByOwner = new Map(
    allReflections
      .filter((r) => r.visibility === "partner")
      .map((r) => [
        r.user_id,
        { continueText: r.continue_text, stopText: r.stop_text, improveText: r.improve_text, notes: r.notes },
      ])
  );

  // Resolve emails + names for everyone we might email or name.
  const allUserIds = [
    ...new Set([...goalOwnerIds, ...pairs.flatMap((p) => [p.viewerId, p.ownerId])]),
  ];
  const [usersRes, profilesRes] = await Promise.all([
    supabase.auth.admin.listUsers({ perPage: 1000 }),
    supabase.from("profiles").select("id, display_name").in("id", allUserIds),
  ]);
  const emailById = new Map(
    (usersRes.data?.users ?? [])
      .filter((u) => allUserIds.includes(u.id) && !!u.email)
      .map((u) => [u.id, u.email as string])
  );
  const nameById = new Map(
    (profilesRes.data ?? []).map((p) => [p.id, p.display_name ?? "Someone"])
  );

  const goalById = new Map(goals.map((g) => [g.id, g]));
  const goalsByOwner = new Map<string, SummaryGoal[]>();
  for (const g of goals) {
    const list = goalsByOwner.get(g.user_id) ?? [];
    list.push(g);
    goalsByOwner.set(g.user_id, list);
  }

  const weekLabel = formatRange(summaryWeekStart, summaryWeekEnd);
  let sent = 0;
  let failed = 0;
  const results: Array<{ key: string; ok: boolean; attempts: number; error?: string }> = [];

  // 1. Self-summary: every owner gets a summary of all their active goals,
  //    whether or not they've shared anything.
  for (const ownerId of goalOwnerIds) {
    const to = emailById.get(ownerId);
    if (!to) continue;
    const stats = computeWeeklyGoalStats(
      goalsByOwner.get(ownerId) ?? [],
      checkIns,
      summaryWeekStart,
      summaryWeekEnd
    );
    if (totalTarget(stats) === 0) continue;
    const r = await sendWithRetry(() =>
      sendWeeklySummary({
        to,
        ownerName: nameById.get(ownerId) ?? "Someone",
        ownerId,
        weekLabel,
        goals: stats,
        reflection: selfReflectionByOwner.get(ownerId),
        self: true,
      })
    );
    results.push({ key: `self:${ownerId}`, ...r });
    if (r.ok) sent++; else failed++;
    await sleep(1000);
  }

  // 2. Partner summary: each partner gets the owner's shared subset, with the
  //    owner CC'd so both share the same view.
  for (const pair of pairs) {
    const to = emailById.get(pair.viewerId);
    if (!to) continue;

    const sharedGoalIds = shares
      .filter((s) => s.owner_id === pair.ownerId && s.viewer_id === pair.viewerId)
      .map((s) => s.goal_id);
    if (sharedGoalIds.length === 0) continue;

    const sharedGoals = sharedGoalIds
      .map((id) => goalById.get(id))
      .filter((g): g is NonNullable<typeof g> => !!g);
    if (sharedGoals.length === 0) continue;

    const stats = computeWeeklyGoalStats(
      sharedGoals,
      checkIns,
      summaryWeekStart,
      summaryWeekEnd
    );
    if (totalTarget(stats) === 0) continue;

    const ownerEmail = emailById.get(pair.ownerId);
    const r = await sendWithRetry(() =>
      sendWeeklySummary({
        to,
        cc: ownerEmail && ownerEmail !== to ? ownerEmail : undefined,
        ownerName: nameById.get(pair.ownerId) ?? "Someone",
        ownerId: pair.ownerId,
        weekLabel,
        goals: stats,
        reflection: partnerReflectionByOwner.get(pair.ownerId),
      })
    );
    results.push({ key: `partner:${pair.viewerId}<-${pair.ownerId}`, ...r });
    if (r.ok) sent++; else failed++;
    await sleep(1000);
  }

  return NextResponse.json({
    ok: failed === 0,
    sent,
    failed,
    pairs: pairs.length,
    week: `${summaryWeekStart} → ${summaryWeekEnd}`,
    results,
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a send fn up to maxAttempts times, backing off on 429s.
 * Non-rate-limit errors are not retried — they indicate a content or
 * config problem that won't resolve on its own.
 */
async function sendWithRetry(
  fn: () => Promise<{ ok: boolean; error?: string }>,
  maxAttempts = 3
): Promise<{ ok: boolean; error?: string; attempts: number }> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await fn();
    if (result.ok) return { ok: true, attempts: attempt };
    const isRateLimit =
      result.error?.includes("rate_limit_exceeded") ||
      result.error?.includes("429") ||
      result.error?.toLowerCase().includes("too many requests");
    if (!isRateLimit || attempt === maxAttempts) {
      return { ok: false, error: result.error, attempts: attempt };
    }
    // Exponential backoff: 2s on first retry, 4s on second.
    await sleep(2000 * attempt);
  }
  return { ok: false, error: "max retries exceeded", attempts: maxAttempts };
}

function formatRange(start: string, end: string): string {
  const s = parseDate(start);
  const e = parseDate(end);
  const month = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  if (s.getUTCMonth() === e.getUTCMonth()) {
    return `${month(s)} ${s.getUTCDate()}–${e.getUTCDate()}, ${e.getUTCFullYear()}`;
  }
  return `${month(s)} ${s.getUTCDate()} – ${month(e)} ${e.getUTCDate()}, ${e.getUTCFullYear()}`;
}
function parseDate(d: string): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}
