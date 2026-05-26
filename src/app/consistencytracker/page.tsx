import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { todayIn, dayOfWeekIn, addDays } from "@/lib/dates";
import { buildAggregateCells, computeStats } from "@/lib/stats";
import TodayGoalCard from "@/components/today-goal-card";
import Heatmap from "@/components/heatmap";
import type { CheckIn } from "@/lib/actions/check-ins";

type GoalRow = {
  id: string;
  name: string;
  description: string | null;
  target_days: number[];
  created_at: string;
  category: { name: string | null; color: string | null } | null;
};

export default async function TodayView() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone, display_name")
    .eq("id", user.id)
    .single();

  const timezone = profile?.timezone ?? "UTC";
  const today = todayIn(timezone);
  const dow = dayOfWeekIn(timezone);
  const yearStart = addDays(today, -364);

  const { data: rawGoals } = await supabase
    .from("goals")
    .select(
      "id, name, description, target_days, created_at, category:categories(name, color)"
    )
    .eq("active", true)
    .order("created_at", { ascending: true });

  const goals: GoalRow[] = (rawGoals ?? []).map((g) => ({
    ...g,
    category: Array.isArray(g.category) ? g.category[0] ?? null : g.category,
  })) as GoalRow[];

  if (goals.length === 0) {
    return (
      <section>
        <Header timezone={timezone} firstName={profile?.display_name?.split(" ")[0]} />
        <div className="border border-dashed border-[color:var(--border)] rounded-lg p-10 text-center">
          <p className="text-sm text-[color:var(--muted)] mb-4">
            No goals yet. Start with one small habit you can do most days.
          </p>
          <Link
            href="/consistencytracker/goals/new"
            className="inline-block bg-black text-white text-sm rounded-md px-4 py-2 hover:bg-gray-800"
          >
            Create your first goal
          </Link>
        </div>
      </section>
    );
  }

  // Today's goals + check-ins
  const goalsToday = goals.filter((g) => g.target_days.includes(dow));
  const goalIds = goals.map((g) => g.id);

  const { data: yearCheckInsRaw } = await supabase
    .from("check_ins")
    .select("goal_id, date, status, skip_reason, id")
    .in("goal_id", goalIds)
    .gte("date", yearStart)
    .lte("date", today);

  const yearCheckIns = (yearCheckInsRaw ?? []) as Array<
    CheckIn & { goal_id: string }
  >;

  const todayCheckIns = yearCheckIns.filter((c) => c.date === today);
  const checkInByGoal = new Map(todayCheckIns.map((c) => [c.goal_id, c]));

  const doneCount = todayCheckIns.filter((c) => c.status === "done").length;
  const skippedCount = todayCheckIns.filter((c) => c.status === "skipped").length;
  const remaining = goalsToday.length - doneCount - skippedCount;

  // Aggregate heatmap
  const aggregateCells = buildAggregateCells({
    startDate: yearStart,
    endDate: today,
    todayStr: today,
    goals: goals.map((g) => ({
      id: g.id,
      target_days: g.target_days,
      created_at: g.created_at,
    })),
    checkIns: yearCheckIns.map((c) => ({
      goal_id: c.goal_id,
      date: c.date,
      status: c.status,
    })),
  });

  // Per-goal streaks for the goal list
  const goalRows = goals.map((g) => {
    const goalCheckIns = yearCheckIns
      .filter((c) => c.goal_id === g.id)
      .map((c) => ({ date: c.date, status: c.status }));
    const stats = computeStats({
      startDate: g.created_at.slice(0, 10),
      endDate: today,
      targetDays: g.target_days,
      checkIns: goalCheckIns,
    });
    return { goal: g, stats };
  });

  return (
    <section className="space-y-12">
      <div>
        <Header
          timezone={timezone}
          firstName={profile?.display_name?.split(" ")[0]}
          summary={
            goalsToday.length > 0
              ? `${doneCount} of ${goalsToday.length} done${
                  skippedCount > 0 ? `, ${skippedCount} skipped` : ""
                }${remaining > 0 ? `, ${remaining} left` : ""}`
              : "Nothing scheduled today."
          }
        />

        {goalsToday.length === 0 ? null : (
          <div className="space-y-2 mt-6">
            {goalsToday.map((g) => (
              <TodayGoalCard
                key={g.id}
                goalId={g.id}
                name={g.name}
                description={g.description}
                categoryColor={g.category?.color ?? "#9ca3af"}
                date={today}
                checkIn={checkInByGoal.get(g.id) ?? null}
              />
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-3">
          Past year — all goals combined
        </h2>
        <Heatmap cells={aggregateCells} hideLegend />
        <div className="mt-2 flex items-center gap-2 text-[10px] text-[color:var(--muted)]">
          <span>Less</span>
          {["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"].map((c) => (
            <span
              key={c}
              className="inline-block rounded-sm"
              style={{ width: 11, height: 11, background: c }}
            />
          ))}
          <span>More</span>
        </div>
      </div>

      <div>
        <h2 className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-3">
          All goals
        </h2>
        <ul className="border border-[color:var(--border)] rounded-lg divide-y divide-[color:var(--border)]">
          {goalRows.map(({ goal, stats }) => (
            <li key={goal.id}>
              <Link
                href={`/consistencytracker/goals/${goal.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    aria-hidden
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: goal.category?.color ?? "#9ca3af" }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{goal.name}</p>
                    <p className="text-xs text-[color:var(--muted)] mt-0.5">
                      {goal.category?.name ?? "Uncategorized"}
                    </p>
                  </div>
                </div>
                <div className="text-xs text-[color:var(--muted)] shrink-0 ml-4">
                  {stats.currentStreak > 0
                    ? `${stats.currentStreak} day streak`
                    : `${Math.round(stats.completionRate * 100)}% all-time`}
                  <span className="ml-2">→</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
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

function greeting(timezone: string): string {
  const hour = parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    }).format(new Date()),
    10
  );
  if (hour < 5) return "Still up";
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  if (hour < 21) return "Evening";
  return "Night";
}
