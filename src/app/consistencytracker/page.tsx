import Link from "next/link";
import { cache, Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getCurrentProfile } from "@/lib/supabase/current-user";
import { todayIn, dayOfWeekIn, addDays, isoWeekStart, hourIn, DAY_START_HOUR, dateInTimezone } from "@/lib/dates";
import { selectLastNightGoals } from "@/lib/last-night";
import { computeStats } from "@/lib/stats";
import { UNCATEGORIZED_COLOR } from "@/lib/colors";
import { computeTodayBanner } from "@/lib/today-banner";
import { computeGoalRowState, type GoalRowState } from "@/lib/today-goal-row";
import TodayGoalCard from "@/components/today-goal-card";
import LogExtra from "@/components/log-extra";
import Skeleton from "@/components/skeleton";
import type { CheckIn } from "@/lib/actions/check-ins";

type GoalRow = {
  id: string;
  name: string;
  description: string | null;
  target_days: number[];
  weekly_target: number | null;
  created_at: string;
  category: { name: string | null; color: string | null } | null;
};

// Active goals are needed by both the Today and Year sections. cache() dedupes
// the query across both Suspense boundaries within the same request.
const getActiveGoals = cache(async (): Promise<GoalRow[]> => {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("goals")
    .select(
      "id, name, description, target_days, weekly_target, created_at, category:categories(name, color)"
    )
    .eq("user_id", user.id)
    .eq("active", true)
    .order("created_at", { ascending: true });
  return (data ?? []).map((g) => ({
    ...g,
    category: Array.isArray(g.category) ? g.category[0] ?? null : g.category,
  })) as GoalRow[];
});

export default function TodayView() {
  return (
    <section className="space-y-12">
      <Suspense fallback={<TodaySkeleton />}>
        <TodaySection />
      </Suspense>
      <Suspense fallback={<AllGoalsSkeleton />}>
        <AllGoalsSection />
      </Suspense>
    </section>
  );
}

// Greeting + today's check-in cards. Fetches only the current week's check-ins
// (small) so it paints without waiting on the full-year aggregate.
async function TodaySection() {
  const [profile, goals] = await Promise.all([
    getCurrentProfile(),
    getActiveGoals(),
  ]);

  const timezone = profile?.timezone ?? "UTC";
  const today = todayIn(timezone);
  const dow = dayOfWeekIn(timezone);
  const hour = hourIn(timezone);
  const firstName = profile?.display_name?.split(" ")[0];

  if (goals.length === 0) {
    return (
      <div>
        <Header timezone={timezone} firstName={firstName} />
        <div className="border border-dashed border-[color:var(--border)] rounded-lg p-10 text-center">
          <p className="text-sm mb-4">
            Start with one small promise you want evidence for.
          </p>
          <Link
            href="/consistencytracker/goals/new"
            className="inline-block bg-black text-white text-sm rounded-md px-4 py-2 hover:bg-gray-800"
          >
            Create your first goal
          </Link>
          <p className="text-xs text-[color:var(--muted)] mt-4">
            Check in daily, reflect once a week. Everything starts private.
          </p>
        </div>
      </div>
    );
  }

  const goalsToday = goals.filter((g) => g.target_days.includes(dow));
  const goalIds = goals.map((g) => g.id);
  const weekStart = isoWeekStart(today);
  const prevWeekStart = addDays(weekStart, -7);

  // Fetch the last two ISO weeks of check-ins (this week powers the today
  // summary + count-goal pace; both weeks feed the contextual banner gate),
  // the reflections for those two weeks, and the single most-recent check-in
  // (the drop-off anchor) — all independent, so run them together.
  const supabase = await createClient();
  const [
    { data: twoWeekRaw },
    { data: reflectionRows },
    { data: lastCheckInRows },
  ] = await Promise.all([
    supabase
      .from("check_ins")
      .select("id, goal_id, date, status, skip_reason, note, created_at")
      .in("goal_id", goalIds)
      .gte("date", prevWeekStart)
      .lte("date", today),
    supabase
      .from("weekly_reflections")
      .select("week_start_date")
      .in("week_start_date", [prevWeekStart, weekStart]),
    supabase
      .from("check_ins")
      .select("date")
      .in("goal_id", goalIds)
      .order("date", { ascending: false })
      .limit(1),
  ]);

  const twoWeekCheckIns = (twoWeekRaw ?? []) as Array<
    CheckIn & { goal_id: string }
  >;
  const weekCheckIns = twoWeekCheckIns.filter((c) => c.date >= weekStart);

  // Night owls: between midnight and DAY_START_HOUR, surface yesterday's
  // still-open tasks so a late log is a normal check-in, not a backfill. Only
  // shown in that window, so daytime users never see it.
  const yesterday = addDays(today, -1);
  const yesterdayDow = (dow + 6) % 7;
  // During the night-owl window (12 AM – DAY_START_HOUR), "Log something extra"
  // should use the same logical day as "Still open from last night" — yesterday —
  // so an extra at 2 AM lands on the day the user is mentally still in, not the
  // calendar midnight rollover. extraDow determines which goals are off-schedule
  // for the extra list; extraDate is the date written to the database.
  const isNightOwl = hour < DAY_START_HOUR;
  const extraDate = isNightOwl ? yesterday : today;
  const extraDow = isNightOwl ? yesterdayDow : dow;
  const loggedYesterday = new Set(
    twoWeekCheckIns.filter((c) => c.date === yesterday).map((c) => c.goal_id)
  );
  const lastNightGoals = selectLastNightGoals({
    goals,
    hour,
    yesterday,
    yesterdayDow,
    loggedYesterday,
    timezone,
  });

  // Contextual banner: reflect-on-the-week (gated on activity + day) or a
  // gentle drop-off nudge after a ≥2-week lapse. See computeTodayBanner.
  const reflectedWeeks = new Set(
    (reflectionRows ?? []).map((r) => r.week_start_date)
  );
  const lastCheckInDate = lastCheckInRows?.[0]?.date ?? null;
  const earliestGoalDate = goals.reduce(
    (min, g) => {
      const d = dateInTimezone(g.created_at, timezone);
      return d < min ? d : min;
    },
    today
  );
  const banner = computeTodayBanner({
    dow,
    today,
    currentWeekHasCheckIn: weekCheckIns.length > 0,
    lastWeekHasCheckIn: twoWeekCheckIns.some((c) => c.date < weekStart),
    currentWeekReflected: reflectedWeeks.has(weekStart),
    lastWeekReflected: reflectedWeeks.has(prevWeekStart),
    anchorDate: lastCheckInDate ?? earliestGoalDate,
  });

  const todayCheckIns = weekCheckIns.filter((c) => c.date === today);
  const checkInByGoal = new Map(todayCheckIns.map((c) => [c.goal_id, c]));

  // Goals not scheduled on the extra logical day (yesterday during 12–5 AM,
  // today otherwise), offered as one-tap "log something extra". The status
  // lookup uses the same extraDate so an already-logged extra shows correctly.
  const extraCheckInByGoal = new Map(
    twoWeekCheckIns.filter((c) => c.date === extraDate).map((c) => [c.goal_id, c])
  );
  const offTodayGoals = goals
    .filter((g) => !g.target_days.includes(extraDow))
    .map((g) => ({
      id: g.id,
      name: g.name,
      categoryColor: g.category?.color ?? UNCATEGORIZED_COLOR,
      status: (extraCheckInByGoal.get(g.id)?.status ?? null) as
        | "done"
        | "skipped"
        | null,
    }));

  // Header progress counts SCHEDULED goals only — extras are evidence, never
  // part of "done of scheduled". Extras logged today are surfaced separately so
  // the two never share a denominator.
  const todayGoalIds = new Set(goalsToday.map((g) => g.id));
  const scheduledToday = todayCheckIns.filter((c) => todayGoalIds.has(c.goal_id));
  const doneCount = scheduledToday.filter((c) => c.status === "done").length;
  const skippedCount = scheduledToday.filter((c) => c.status === "skipped").length;
  const remaining = goalsToday.length - doneCount - skippedCount;
  const extraToday = offTodayGoals.filter((g) => g.status === "done").length;
  // During the night-owl window the extras belong to yesterday, so the header
  // says "from last night" to match the logical day — not "extra" against today.
  const extraSuffix =
    extraToday > 0
      ? isNightOwl
        ? ` · ${extraToday} extra from last night`
        : ` · ${extraToday} extra`
      : "";

  // doneThisWeek (for count-goal pace) only depends on the current week.
  const paceByGoal = new Map<string, number>();
  for (const g of goalsToday) {
    if (g.weekly_target == null) continue;
    const stats = computeStats({
      startDate: dateInTimezone(g.created_at, timezone),
      endDate: today,
      targetDays: g.target_days,
      checkIns: weekCheckIns
        .filter((c) => c.goal_id === g.id)
        .map((c) => ({ date: c.date, status: c.status })),
      weeklyTarget: g.weekly_target,
    });
    paceByGoal.set(g.id, stats.doneThisWeek ?? 0);
  }

  return (
    <div>
      <Header
        timezone={timezone}
        firstName={firstName}
        summary={
          goalsToday.length > 0
            ? `${doneCount} of ${goalsToday.length} done${
                skippedCount > 0 ? `, ${skippedCount} skipped` : ""
              }${remaining > 0 ? `, ${remaining} left` : ""}${extraSuffix}`
            : extraToday > 0
              ? isNightOwl
                ? `Nothing scheduled today · ${extraToday} extra from last night`
                : `Nothing scheduled today · ${extraToday} extra`
              : "Nothing scheduled today."
        }
      />

      {goalsToday.length === 0 ? null : (
        <div className="space-y-2 mt-6">
          {goalsToday.map((g) => {
            const paceLabel =
              g.weekly_target != null
                ? (paceByGoal.get(g.id) ?? 0) >= g.weekly_target
                  ? `✓ ${g.weekly_target} of ${g.weekly_target} this week`
                  : `${paceByGoal.get(g.id) ?? 0} of ${g.weekly_target} this week`
                : undefined;
            return (
              <TodayGoalCard
                key={g.id}
                goalId={g.id}
                name={g.name}
                description={g.description}
                categoryColor={g.category?.color ?? UNCATEGORIZED_COLOR}
                date={today}
                timezone={timezone}
                checkIn={checkInByGoal.get(g.id) ?? null}
                paceLabel={paceLabel}
              />
            );
          })}
        </div>
      )}

      {lastNightGoals.length > 0 ? (
        <div className="mt-8">
          <h2 className="text-xs uppercase tracking-wider text-[color:var(--muted)]">
            Still open from last night
          </h2>
          <p className="mb-3 mt-1 text-xs text-[color:var(--muted)]">
            Up late? You can still log yesterday until 5am.
          </p>
          <div className="space-y-2">
            {lastNightGoals.map((g) => (
              <TodayGoalCard
                key={g.id}
                goalId={g.id}
                name={g.name}
                description={g.description}
                categoryColor={g.category?.color ?? UNCATEGORIZED_COLOR}
                date={yesterday}
                timezone={timezone}
                checkIn={null}
              />
            ))}
          </div>
        </div>
      ) : null}

      <LogExtra goals={offTodayGoals} date={extraDate} nightOwl={isNightOwl} />

      {banner.kind === "reflect" ? (
        <Link
          href="/consistencytracker/reflections"
          className="mt-6 block border border-[color:var(--border)] rounded-lg px-4 py-3 hover:bg-gray-50 transition"
        >
          <p className="text-sm font-medium">
            Reflect on {banner.period === "this" ? "this" : "last"} week →
          </p>
          <p className="text-xs text-[color:var(--muted)] mt-0.5">
            Continue · Stop · Improve. A few sentences keeps the loop honest.
          </p>
        </Link>
      ) : banner.kind === "dropoff" ? (
        <div className="mt-6 border border-[color:var(--border)] rounded-lg px-4 py-3">
          <p className="text-sm font-medium">
            It&rsquo;s been {banner.weeks} weeks since your last check-in.
          </p>
          <p className="text-xs text-[color:var(--muted)] mt-0.5">
            No pressure — pick one goal and begin again. Starting is the whole game.
          </p>
        </div>
      ) : null}
    </div>
  );
}

// All-goals list with all-time streaks. The familiar "streak" framing lives on
// Today; the GitHub-style heatmap (less legible to new users) now lives on the
// Goals page, where it appears only once there's history to show.
async function AllGoalsSection() {
  const [profile, goals] = await Promise.all([
    getCurrentProfile(),
    getActiveGoals(),
  ]);
  if (goals.length === 0) return null;

  const timezone = profile?.timezone ?? "UTC";
  const today = todayIn(timezone);
  const yearStart = addDays(today, -364);
  const goalIds = goals.map((g) => g.id);

  const supabase = await createClient();
  const { data: yearCheckInsRaw } = await supabase
    .from("check_ins")
    .select("goal_id, date, status")
    .in("goal_id", goalIds)
    .gte("date", yearStart)
    .lte("date", today);

  const yearCheckIns = (yearCheckInsRaw ?? []) as Array<{
    goal_id: string;
    date: string;
    status: "done" | "skipped";
  }>;

  const goalRows = goals.map((g) => {
    const goalCheckIns = yearCheckIns
      .filter((c) => c.goal_id === g.id)
      .map((c) => ({ date: c.date, status: c.status }));
    const stats = computeStats({
      startDate: dateInTimezone(g.created_at, timezone),
      endDate: today,
      targetDays: g.target_days,
      checkIns: goalCheckIns,
      weeklyTarget: g.weekly_target,
    });
    const doneDates = goalCheckIns
      .filter((c) => c.status === "done")
      .map((c) => c.date);
    const lastDone = doneDates.length
      ? doneDates.reduce((a, b) => (a > b ? a : b))
      : null;
    const rowState = computeGoalRowState({
      currentStreak: stats.currentStreak,
      streakUnit: stats.streakUnit,
      doneCount: stats.doneCount,
      targetDays: g.target_days,
      weeklyTarget: g.weekly_target,
      lastDone,
      createdAt: dateInTimezone(g.created_at, timezone),
      today,
    });
    return { goal: g, rowState };
  });

  return (
      <div>
        <h2 className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-3">
          All goals
        </h2>
        <ul className="border border-[color:var(--border)] rounded-lg divide-y divide-[color:var(--border)]">
          {goalRows.map(({ goal, rowState }) => (
            <li key={goal.id}>
              <Link
                href={`/consistencytracker/goals/${goal.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    aria-hidden
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: goal.category?.color ?? UNCATEGORIZED_COLOR }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{goal.name}</p>
                    <p className="text-xs text-[color:var(--muted)] mt-0.5">
                      {goal.category?.name ?? "Uncategorized"}
                      {rowState.nudge ? ` · ${nudgeText(rowState.nudge)}` : ""}
                    </p>
                  </div>
                </div>
                <div className="text-xs text-[color:var(--muted)] shrink-0 ml-4">
                  {rowState.metric}
                  <span className="ml-2">→</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
  );
}

function TodaySkeleton() {
  return (
    <div aria-busy>
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-6 w-44" />
      <Skeleton className="mt-2 h-4 w-64" />
      <div className="space-y-2 mt-6">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    </div>
  );
}

// The heading never changes with data, so render it as real text while only
// the goal rows pulse.
function AllGoalsSkeleton() {
  return (
    <div aria-busy>
      <span className="sr-only">Loading…</span>
      <h2 className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-3">
        All goals
      </h2>
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

function Header({
  timezone,
  firstName,
  summary,
}: {
  timezone: string;
  firstName?: string;
  summary?: string;
}) {
  const prettyDate = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <header className="mb-2">
      <h1 className="text-xl font-light tracking-tight">
        {greeting(timezone)}, {firstName ?? "friend"}.
      </h1>
      <p className="mt-1 text-sm text-[color:var(--muted)]">
        {prettyDate}
        {summary ? ` · ${summary}` : ""}
      </p>
    </header>
  );
}

// Compose the calm re-engagement copy from the row state.
function nudgeText(nudge: NonNullable<GoalRowState["nudge"]>): string {
  const d = shortDate(nudge.since);
  return nudge.kind === "resume"
    ? `last done ${d}, pick it back up?`
    : `added ${d}, want to start?`;
}

function shortDate(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function greeting(timezone: string): string {
  const hour = hourIn(timezone);
  if (hour < DAY_START_HOUR) return "Still up";
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  if (hour < 21) return "Evening";
  return "Night";
}
