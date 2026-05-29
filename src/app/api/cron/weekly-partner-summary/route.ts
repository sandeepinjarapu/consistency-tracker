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
      .select("id, user_id, name, target_days, weekly_target, created_at, active")
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
      const goalCheckIns = checkIns.filter(
        (c) =>
          c.goal_id === g.id &&
          c.date >= summaryWeekStart &&
          c.date <= summaryWeekEnd
      );
      const skipped = goalCheckIns.filter((c) => c.status === "skipped").length;

      // Count goals: target is the weekly quota, and only done check-ins on
      // eligible days count toward it.
      if (g.weekly_target != null) {
        const done = goalCheckIns.filter(
          (c) =>
            c.status === "done" &&
            g.target_days.includes(dayOfWeekForDateString(c.date))
        ).length;
        return { name: g.name, done, target: g.weekly_target, skipped };
      }

      // Specific-day goals: target is the number of target days in the window.
      let target = 0;
      let cursor = summaryWeekStart;
      while (cursor <= summaryWeekEnd) {
        if (cursor >= goalStart) {
          const dow = dayOfWeekForDateString(cursor);
          if (g.target_days.includes(dow)) target++;
        }
        cursor = addDays(cursor, 1);
      }
      const done = goalCheckIns.filter((c) => c.status === "done").length;
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
