import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { isPartner } from "@/lib/actions/partners";
import { listMyReactions } from "@/lib/actions/reactions";
import { getPartnerReflections, type Reflection } from "@/lib/actions/reflections";
import { addDays, todayIn, isoWeekStart } from "@/lib/dates";
import { buildHeatmapCells, computeStats, computeWeeklyMet } from "@/lib/stats";
import { notableForWeek } from "@/lib/partner-notable";
import { targetDaysLabel } from "@/lib/target-days-label";
import { safeExternalUrl } from "@/lib/url";
import Heatmap from "@/components/heatmap";
import WeeklyStrip from "@/components/weekly-strip";
import MarkSharesSeen from "@/components/mark-shares-seen";
import ReactionButtons from "@/components/reaction-buttons";

type SharedGoal = {
  id: string;
  name: string;
  description: string | null;
  doc_url: string | null;
  target_days: number[];
  weekly_target: number | null;
  created_at: string;
  category: { name: string | null; color: string | null } | null;
};

export default async function PartnerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: partnerId } = await params;

  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return null;

  // Verify partnership
  const partnered = await isPartner(partnerId);
  if (!partnered) {
    return (
      <section className="max-w-md mx-auto pt-12 text-center space-y-4">
        <h1 className="text-xl font-light tracking-tight">Not your partner</h1>
        <p className="text-sm text-[color:var(--muted)]">
          You can only view tracker data for people who have accepted your invite, or whose invite you&apos;ve accepted.
        </p>
        <Link
          href="/consistencytracker/partners"
          className="text-sm underline hover:text-black"
        >
          Back to partners
        </Link>
      </section>
    );
  }

  // Partner's profile + timezone
  const { data: partnerProfile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, timezone")
    .eq("id", partnerId)
    .single();
  if (!partnerProfile) notFound();

  const partnerTz = partnerProfile.timezone ?? "UTC";
  const today = todayIn(partnerTz);
  const yearStart = addDays(today, -364);
  // The heatmap shows a compact recent window (last ~12 weeks, trimmed to the
  // goal's start); stats below still span the year.
  const twelveWeeksAgo = addDays(today, -83);

  // RLS will filter to only goals shared with the current user
  const { data: rawGoals } = await supabase
    .from("goals")
    .select(
      "id, name, description, doc_url, target_days, weekly_target, created_at, category:categories(name, color)"
    )
    .eq("user_id", partnerId)
    .eq("active", true)
    .order("created_at", { ascending: true });

  const goals: SharedGoal[] = (rawGoals ?? []).map((g) => ({
    ...g,
    category: Array.isArray(g.category) ? g.category[0] ?? null : g.category,
  })) as SharedGoal[];

  // Pull check-ins for all shared goals in one query
  const checkInsByGoal = new Map<
    string,
    Array<{ date: string; status: "done" | "skipped" }>
  >();
  if (goals.length > 0) {
    const { data: ciData } = await supabase
      .from("check_ins")
      .select("goal_id, date, status")
      .in(
        "goal_id",
        goals.map((g) => g.id)
      )
      .gte("date", yearStart)
      .lte("date", today);

    for (const ci of (ciData ?? []) as Array<{
      goal_id: string;
      date: string;
      status: "done" | "skipped";
    }>) {
      if (!checkInsByGoal.has(ci.goal_id)) checkInsByGoal.set(ci.goal_id, []);
      checkInsByGoal.get(ci.goal_id)!.push({ date: ci.date, status: ci.status });
    }
  }

  // Which reactions I've already left on this partner's goals this week
  // (reactions are once per goal per ISO week).
  // Reactions stay open for the current and previous ISO week (aligned with
  // the Monday summary email), so the partner can react to the week that just
  // ended — which is what the email is about.
  const weekStart = isoWeekStart(today);
  const prevWeekStart = addDays(weekStart, -7);
  const recentWeeks = [weekStart, prevWeekStart];
  const myReactions: Record<string, true> =
    goals.length > 0 ? await listMyReactions(partnerId, recentWeeks) : {};

  // Their own words for the recent weeks — only the reflections they chose to
  // make partner-visible (RLS double-checks the share). The most human signal
  // on this page, so it leads.
  const partnerReflections =
    goals.length > 0
      ? await getPartnerReflections(partnerId, recentWeeks)
      : [];

  return (
    <section className="space-y-10">
      <MarkSharesSeen ownerId={partnerId} />
      <Link
        href="/consistencytracker/partners"
        className="text-xs text-[color:var(--muted)] hover:text-black"
      >
        ← All partners
      </Link>

      <header className="flex items-center gap-4">
        {partnerProfile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={partnerProfile.avatar_url}
            alt=""
            className="w-12 h-12 rounded-full"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gray-200" />
        )}
        <div>
          <h1 className="text-xl font-light tracking-tight">
            {partnerProfile.display_name ?? "Partner"}
          </h1>
          <p className="mt-0.5 text-xs text-[color:var(--muted)]">
            {goals.length === 0
              ? "Nothing shared with you yet."
              : `${goals.length} shared goal${goals.length === 1 ? "" : "s"}`}
          </p>
        </div>
      </header>

      {partnerReflections.length > 0 ? (
        <div>
          <h2 className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-3">
            In {partnerProfile.display_name ?? "their"} words
          </h2>
          <div className="space-y-4">
            {partnerReflections.map((r) => (
              <PartnerReflection
                key={r.id}
                reflection={r}
                weekLabel={
                  r.week_start_date === weekStart
                    ? "This week"
                    : r.week_start_date === prevWeekStart
                      ? "Last week"
                      : weekRangeLabel(r.week_start_date)
                }
              />
            ))}
          </div>
        </div>
      ) : null}

      {goals.length === 0 ? (
        <div className="border border-dashed border-[color:var(--border)] rounded-lg p-10 text-center">
          <p className="text-sm text-[color:var(--muted)]">
            They haven&apos;t shared any goals with you yet. Once they toggle sharing on a goal, it&apos;ll appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-12">
          {goals.map((goal) => {
            const checkIns = checkInsByGoal.get(goal.id) ?? [];
            const goalStart = goal.created_at.slice(0, 10);
            const cells = buildHeatmapCells({
              startDate: goalStart > twelveWeeksAgo ? goalStart : twelveWeeksAgo,
              endDate: today,
              targetDays: goal.target_days,
              checkIns,
              goalStartDate: goalStart,
              todayStr: today,
              weeklyTarget: goal.weekly_target,
            });
            const stats = computeStats({
              startDate: goalStart > yearStart ? goalStart : yearStart,
              endDate: today,
              targetDays: goal.target_days,
              checkIns,
              weeklyTarget: goal.weekly_target,
            });
            const color = goal.category?.color ?? "#9ca3af";
            const docUrl = safeExternalUrl(goal.doc_url);
            const cadenceLabel =
              goal.weekly_target != null
                ? `${goal.weekly_target}× per week`
                : targetDaysLabel(goal.target_days);
            const weeklyMet =
              goal.weekly_target != null
                ? computeWeeklyMet({
                    startDate: goalStart > yearStart ? goalStart : yearStart,
                    endDate: today,
                    targetDays: goal.target_days,
                    checkIns,
                    weeklyTarget: goal.weekly_target,
                  })
                : [];

            return (
              <div key={goal.id}>
                <div className="mb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      aria-hidden
                      className="w-2 h-2 rounded-full"
                      style={{ background: color }}
                    />
                    <span className="text-xs uppercase tracking-wider text-[color:var(--muted)]">
                      {goal.category?.name ?? "Uncategorized"} ·{" "}
                      {cadenceLabel}
                    </span>
                  </div>
                  <h2 className="text-lg font-medium">{goal.name}</h2>
                  {goal.description ? (
                    <p className="mt-1 text-sm text-[color:var(--muted)]">
                      {goal.description}
                    </p>
                  ) : null}
                  {docUrl ? (
                    <a
                      href={docUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-xs underline text-[color:var(--muted)] hover:text-black"
                    >
                      Reflection doc ↗
                    </a>
                  ) : null}
                  <p className="mt-2 text-xs text-[color:var(--muted)]">
                    {stats.currentStreak > 0
                      ? `${stats.currentStreak} ${stats.streakUnit} streak · `
                      : ""}
                    {stats.doneCount} {stats.doneCount === 1 ? "check-in" : "check-ins"} logged
                  </p>
                </div>
                {goal.weekly_target != null ? (
                  <div className="mb-4">
                    <WeeklyStrip
                      weeks={weeklyMet}
                      weeklyTarget={goal.weekly_target}
                      doneColor={color}
                    />
                  </div>
                ) : null}
                <p className="text-xs text-[color:var(--muted)] mb-2">
                  Each square is a day.
                </p>
                <Heatmap
                  cells={cells}
                  doneColor={color}
                  schedule={{
                    goalStartDate: goalStart,
                    today,
                    targetDays: goal.target_days,
                  }}
                />
                <div className="mt-4">
                  <p className="text-[10px] uppercase tracking-wider text-[color:var(--muted)] mb-2">
                    Let them know you noticed
                  </p>
                  <div className="space-y-2">
                    {recentWeeks.map((ws, i) => {
                      const notable = notableForWeek(
                        {
                          createdAt: goal.created_at,
                          targetDays: goal.target_days,
                          weeklyTarget: goal.weekly_target,
                        },
                        checkIns,
                        ws,
                        today
                      );
                      return (
                        <div
                          key={ws}
                          className="flex items-center justify-between gap-3 flex-wrap"
                        >
                          <span className="text-xs text-[color:var(--muted)]">
                            {i === 0 ? "This week" : "Last week"}
                            {notable ? (
                              <span className="text-black"> · {notable}</span>
                            ) : null}
                          </span>
                          <ReactionButtons
                            goalId={goal.id}
                            weekStart={ws}
                            initial={{
                              saw: Boolean(myReactions[`${goal.id}:saw:${ws}`]),
                              proud: Boolean(
                                myReactions[`${goal.id}:proud:${ws}`]
                              ),
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// A partner-visible reflection, shown as their words for the week. Only the
// fields they actually filled in appear, each with the same quiet label as the
// reflection editor so the framing carries over.
function PartnerReflection({
  reflection,
  weekLabel,
}: {
  reflection: Reflection;
  weekLabel: string;
}) {
  const lines: Array<{ label: string | null; text: string }> = [];
  if (reflection.continue_text)
    lines.push({ label: "Continuing", text: reflection.continue_text });
  if (reflection.stop_text)
    lines.push({ label: "Stopping", text: reflection.stop_text });
  if (reflection.improve_text)
    lines.push({ label: "Improving", text: reflection.improve_text });
  if (reflection.notes) lines.push({ label: null, text: reflection.notes });
  if (lines.length === 0) return null;

  return (
    <div className="border-l-2 border-[color:var(--border)] pl-4">
      <p className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-2">
        {weekLabel}
      </p>
      <div className="space-y-2">
        {lines.map((l, i) => (
          <p key={i} className="text-sm leading-relaxed">
            {l.label ? (
              <span className="text-[color:var(--muted)]">{l.label}: </span>
            ) : null}
            {l.text}
          </p>
        ))}
      </div>
    </div>
  );
}

// "May 25–31" for a Monday weekStart (collapses the month when it doesn't change).
function weekRangeLabel(weekStart: string): string {
  const end = addDays(weekStart, 6);
  const fmt = (d: string, withMonth: boolean) => {
    const [y, m, day] = d.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-US", {
      month: withMonth ? "short" : undefined,
      day: "numeric",
      timeZone: "UTC",
    });
  };
  const sameMonth = weekStart.slice(0, 7) === end.slice(0, 7);
  return `${fmt(weekStart, true)}–${fmt(end, !sameMonth)}`;
}
