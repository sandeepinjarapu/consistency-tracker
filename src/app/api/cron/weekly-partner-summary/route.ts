import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendWeeklySummary, type WeeklyGoalStat } from "@/lib/email";
import { addDays, dayOfWeekForDateString, isoWeekStart, todayIn } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Weekly partner-summary cron. Runs Sundays end-of-day UTC.
 *
 * For every accepted partnership (A ↔ B), for each direction (A is owner,
 * B is viewer), gather the goals A has shared with B, compute A's stats
 * on those goals for the past Mon–Sun week, and email B one summary.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabase = createServiceClient();

  // Determine the "last full week" in UTC: Mon-Sun ending yesterday-ish.
  // We run on Sunday at 14:00 UTC; the most recent completed Mon-Sun is
  // the week whose Monday is 6 days before today.
  const todayUtc = todayIn("UTC");
  const thisWeekMon = isoWeekStart(todayUtc);
  // Week to summarize: the one that just finished (Mon of last week to Sun)
  // If cron fires on Sunday, today is in current week, so summarize current week (Mon-Sun)
  const dow = dayOfWeekForDateString(todayUtc);
  const weekStart = dow === 0 ? addDays(thisWeekMon, -7) : thisWeekMon;
  // Actually: when run on Sunday, the current week's Mon..Sun is the one
  // ending today. Better to just summarize Mon..Sun containing today.
  const summaryWeekStart = thisWeekMon;
  const summaryWeekEnd = addDays(summaryWeekStart, 6);

  // Pull all accepted partnerships
  const { data: invites } = await supabase
    .from("partner_invites")
    .select("inviter_id, accepted_by")
    .not("accepted_at", "is", null);

  // Build (viewer, owner) pairs from both directions of each partnership
  type Pair = { viewerId: string; ownerId: string };
  const pairs: Pair[] = [];
  for (const inv of invites ?? []) {
    if (!inv.accepted_by) continue;
    pairs.push({ viewerId: inv.accepted_by, ownerId: inv.inviter_id });
    pairs.push({ viewerId: inv.inviter_id, ownerId: inv.accepted_by });
  }

  if (pairs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, pairs: 0 });
  }

  // Resolve emails (auth.users) and profile names + tz
  const allUserIds = [
    ...new Set(pairs.flatMap((p) => [p.viewerId, p.ownerId])),
  ];
  const [usersRes, profilesRes] = await Promise.all([
    supabase.auth.admin.listUsers({ perPage: 1000 }),
    supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", allUserIds),
  ]);
  const emailById = new Map(
    (usersRes.data?.users ?? [])
      .filter((u) => allUserIds.includes(u.id) && !!u.email)
      .map((u) => [u.id, u.email as string])
  );
  const nameById = new Map(
    (profilesRes.data ?? []).map((p) => [p.id, p.display_name ?? "Someone"])
  );

  // Pull all shares + relevant goals + check-ins in the week
  const ownerIds = [...new Set(pairs.map((p) => p.ownerId))];
  const [sharesRes, goalsRes, checkInsRes] = await Promise.all([
    supabase
      .from("shares")
      .select("owner_id, viewer_id, goal_id")
      .in("owner_id", ownerIds),
    supabase
      .from("goals")
      .select("id, user_id, name, target_days, created_at, active")
      .in("user_id", ownerIds),
    supabase
      .from("check_ins")
      .select("goal_id, date, status")
      .gte("date", summaryWeekStart)
      .lte("date", summaryWeekEnd),
  ]);

  const shares = sharesRes.data ?? [];
  const goals = goalsRes.data ?? [];
  const checkIns = checkInsRes.data ?? [];

  const goalById = new Map(goals.map((g) => [g.id, g]));

  let sent = 0;
  const errors: string[] = [];

  for (const pair of pairs) {
    const to = emailById.get(pair.viewerId);
    if (!to) continue;

    // Goals from this owner shared with this viewer
    const sharedGoalIds = shares
      .filter(
        (s) =>
          s.owner_id === pair.ownerId && s.viewer_id === pair.viewerId
      )
      .map((s) => s.goal_id);

    if (sharedGoalIds.length === 0) continue;

    const sharedGoals = sharedGoalIds
      .map((id) => goalById.get(id))
      .filter((g): g is NonNullable<typeof g> => !!g && g.active);

    if (sharedGoals.length === 0) continue;

    // Per-goal stats for the week
    const stats: WeeklyGoalStat[] = sharedGoals.map((g) => {
      const goalStart = g.created_at.slice(0, 10);
      // Target days in the window, accounting for goal start
      let target = 0;
      let cursor = summaryWeekStart;
      while (cursor <= summaryWeekEnd) {
        if (cursor >= goalStart) {
          const dow = dayOfWeekForDateString(cursor);
          if (g.target_days.includes(dow)) target++;
        }
        cursor = addDays(cursor, 1);
      }
      const goalCheckIns = checkIns.filter(
        (c) =>
          c.goal_id === g.id &&
          c.date >= summaryWeekStart &&
          c.date <= summaryWeekEnd
      );
      const done = goalCheckIns.filter((c) => c.status === "done").length;
      const skipped = goalCheckIns.filter((c) => c.status === "skipped").length;
      return { name: g.name, done, target, skipped };
    });

    // Skip the email if there's nothing meaningful (no target days at all)
    const totalTarget = stats.reduce((s, g) => s + g.target, 0);
    if (totalTarget === 0) continue;

    const result = await sendWeeklySummary({
      to,
      ownerName: nameById.get(pair.ownerId) ?? "Someone",
      ownerId: pair.ownerId,
      weekLabel: formatRange(summaryWeekStart, summaryWeekEnd),
      goals: stats,
    });

    if (result.ok) sent++;
    else errors.push(`${pair.viewerId}<-${pair.ownerId}: ${result.error}`);
  }

  return NextResponse.json({
    ok: true,
    sent,
    pairs: pairs.length,
    week: `${summaryWeekStart} → ${summaryWeekEnd}`,
    errors: errors.length > 0 ? errors : undefined,
  });
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
