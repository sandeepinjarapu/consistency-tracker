import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getCurrentProfile } from "@/lib/supabase/current-user";
import { listCategories } from "@/lib/actions/categories";
import { listGoalShares } from "@/lib/actions/partners";
import { listGoalsWithUnseenReactions } from "@/lib/actions/reactions";
import { targetDaysLabel } from "@/lib/target-days-label";
import { buildAggregateCells } from "@/lib/stats";
import { buildMonthList } from "@/lib/month-history";
import { shouldShowAggregateCalendar, engagementUnlocked } from "@/lib/calendar-unlock";
import { classifyWeek } from "@/lib/extra-check-ins";
import { UNCATEGORIZED_COLOR } from "@/lib/colors";
import { todayIn, addDays, dateInTimezone, isoWeekStart } from "@/lib/dates";
import GoalRowMenu from "@/components/goal-row-menu";
import GoalWeekRings from "@/components/goal-week-rings";
import MonthCalGrid from "@/components/month-cal-grid";
import { buildWeekRings, type WeekRing } from "@/lib/goal-week-rings";

type GoalRow = {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  target_days: number[];
  active: boolean;
  created_at: string;
  weekly_target: number | null;
};

export default async function GoalsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const sp = await searchParams;
  const showArchived = sp.archived === "1";

  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return null;

  const [categories, goalShares, goalsWithNewReactions] = await Promise.all([
    listCategories(),
    showArchived ? Promise.resolve({}) : listGoalShares(),
    showArchived ? Promise.resolve<string[]>([]) : listGoalsWithUnseenReactions(),
  ]);
  const newReactionGoals = new Set(goalsWithNewReactions);

  const { data: goals } = await supabase
    .from("goals")
    .select(
      "id, name, description, category_id, target_days, active, created_at, weekly_target"
    )
    .eq("user_id", user.id)
    .eq("active", !showArchived)
    .order("created_at", { ascending: true });

  const goalsByCategory = new Map<string | null, GoalRow[]>();
  for (const g of (goals ?? []) as GoalRow[]) {
    const key = g.category_id ?? null;
    if (!goalsByCategory.has(key)) goalsByCategory.set(key, []);
    goalsByCategory.get(key)!.push(g);
  }

  // All-goals calendar summary (active view only): recent 2 calendar months
  // as aggregate grids. Shown once the user has 3+ active goals. Once unlocked
  // the flag is persisted in profiles.calendar_unlocked so the section stays
  // visible even if goals later drop below 3 (requires check-ins to render).
  type AggregateMonth = { year: number; month: number; cells: Awaited<ReturnType<typeof buildAggregateCells>> };
  let aggregateMonths: AggregateMonth[] | null = null;
  let aggregateToday: string | undefined;
  let aggregateTrimBefore: string | undefined;
  const ringsByGoal = new Map<string, WeekRing[]>();
  if (!showArchived && (goals ?? []).length > 0) {
    const activeGoals = goals as GoalRow[];
    const [profile, { data: profileFlags }] = await Promise.all([
      getCurrentProfile(),
      supabase
        .from("profiles")
        .select("calendar_unlocked")
        .eq("id", user.id)
        .single(),
    ]);
    const timezone = profile?.timezone ?? "UTC";
    const today = todayIn(timezone);
    aggregateToday = today;
    const twelveWeeksAgo = addDays(today, -83);
    // Will be tightened below once we know the earliest goal start date.
    aggregateTrimBefore = twelveWeeksAgo;

    const goalsForAggregate = activeGoals.map((g) => ({
      id: g.id,
      target_days: g.target_days,
      created_at: dateInTimezone(g.created_at, timezone),
      weekly_target: g.weekly_target,
    }));

    const { data: ciRaw } = await supabase
      .from("check_ins")
      .select("goal_id, date, status")
      .in("goal_id", activeGoals.map((g) => g.id))
      .gte("date", twelveWeeksAgo)
      .lte("date", today);
    const checkIns = (ciRaw ?? []) as Array<{
      goal_id: string;
      date: string;
      status: "done" | "skipped";
    }>;

    // Build per-goal done and skip date maps once; used for week rings and
    // the engagement-unlock calculation below.
    const doneDatesByGoal = new Map<string, string[]>();
    const skipDatesByGoal = new Map<string, string[]>();
    for (const ci of checkIns) {
      if (ci.status === "done") {
        const arr = doneDatesByGoal.get(ci.goal_id);
        if (arr) arr.push(ci.date);
        else doneDatesByGoal.set(ci.goal_id, [ci.date]);
      } else if (ci.status === "skipped") {
        const arr = skipDatesByGoal.get(ci.goal_id);
        if (arr) arr.push(ci.date);
        else skipDatesByGoal.set(ci.goal_id, [ci.date]);
      }
    }

    // Week rings: 6 completed ISO weeks per active goal row.
    for (const g of activeGoals) {
      ringsByGoal.set(
        g.id,
        buildWeekRings({
          goalStartDate: dateInTimezone(g.created_at, timezone),
          targetDays: g.target_days,
          weeklyTarget: g.weekly_target,
          doneDates: doneDatesByGoal.get(g.id) ?? [],
          skipDates: skipDatesByGoal.get(g.id) ?? [],
          today,
        })
      );
    }

    // Primary unlock: 3+ active goals.
    // Engagement unlock: exactly 1 active goal with 8+ scored done check-ins
    // across 3+ distinct ISO weeks. classifyWeek is used (not isExtraDate alone)
    // so frequency over-quota extras are excluded from the scored count, not just
    // off-target extras. Extra check-ins must never be the reason it unlocks.
    const alreadyUnlocked = profileFlags?.calendar_unlocked ?? false;

    let freshUnlock = activeGoals.length >= 3;
    if (!freshUnlock && activeGoals.length === 1) {
      const goal = goalsForAggregate[0];
      const doneDates = doneDatesByGoal.get(goal.id) ?? [];

      // Group done dates by ISO week then run classifyWeek for each so both
      // off-target AND over-quota extras are stripped from the scored count.
      const byWeek = new Map<string, string[]>();
      for (const d of doneDates) {
        const ws = isoWeekStart(d);
        const arr = byWeek.get(ws);
        if (arr) arr.push(d);
        else byWeek.set(ws, [d]);
      }

      let totalScoredDone = 0;
      let scoredWeeks = 0;
      for (const [ws, dates] of byWeek) {
        const { scoredDone } = classifyWeek({
          weekStart: ws,
          goalStartDate: goal.created_at,
          targetDays: goal.target_days,
          weeklyTarget: goal.weekly_target,
          doneDates: dates,
        });
        if (scoredDone > 0) scoredWeeks++;
        totalScoredDone += scoredDone;
      }

      freshUnlock = engagementUnlocked(1, totalScoredDone, scoredWeeks);
    }

    // unlockedNow combines the persisted flag and the current-render unlock so
    // the calendar is visible on the same render that first qualifies the user.
    const unlockedNow = alreadyUnlocked || freshUnlock;

    // Await the write so the flag is reliably set before the next page load.
    if (freshUnlock && !alreadyUnlocked) {
      await supabase.from("profiles").update({ calendar_unlocked: true }).eq("id", user.id);
    }

    if (shouldShowAggregateCalendar(unlockedNow, activeGoals.length, checkIns.length > 0)) {
      const earliest = goalsForAggregate.reduce(
        (min, g) => (g.created_at < min ? g.created_at : min),
        today
      );
      // Trim to whichever is later: the 12-week fetch boundary or the actual
      // earliest goal start. Rows and cells before this date are invisible.
      aggregateTrimBefore = earliest > twelveWeeksAgo ? earliest : twelveWeeksAgo;

      // Recent 2 calendar months, newest first → will be reversed for display
      const monthList = buildMonthList(earliest, today).slice(0, 2);
      aggregateMonths = monthList.map(([y, m]) => {
        const pad = (n: number) => String(n).padStart(2, "0");
        const firstDay = `${y}-${pad(m)}-01`;
        const lastDay = `${y}-${pad(m)}-${pad(new Date(Date.UTC(y, m, 0)).getUTCDate())}`;
        const rangeStart = firstDay < twelveWeeksAgo ? twelveWeeksAgo : firstDay;
        const rangeEnd = lastDay > today ? today : lastDay;
        return {
          year: y,
          month: m,
          cells: buildAggregateCells({
            startDate: rangeStart,
            endDate: rangeEnd,
            todayStr: today,
            goals: goalsForAggregate,
            checkIns,
          }),
        };
      });
    }
  }

  // Always count archived for the "view archived" link visibility
  const { count: archivedCount } = await supabase
    .from("goals")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("active", false);

  const empty = (goals ?? []).length === 0;

  return (
    <section>
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-light tracking-tight">
            {showArchived ? "Archived goals" : "Goals"}
          </h1>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            {showArchived
              ? "Goals you've paused. Unarchive to bring them back."
              : "Habits you're tracking. Group them under categories."}
          </p>
        </div>
        {!showArchived && (
          <Link
            href="/consistencytracker/goals/new"
            className="shrink-0 whitespace-nowrap bg-black text-white text-sm rounded-md px-4 py-2 hover:bg-gray-800"
          >
            + Add goal
          </Link>
        )}
      </header>

      {aggregateMonths && aggregateMonths.length > 0 ? (
        <div className="mb-10">
          <h2 className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-1">
            {(goals as GoalRow[]).length === 1 ? "Recent activity" : "Recent activity, all goals"}
          </h2>
          <p className="text-xs text-[color:var(--muted)] mb-3">
            {(goals as GoalRow[]).length === 1
              ? "Each square is a day. Darker means more check-ins."
              : "Each square is a day. Darker days mean more goals were checked in."}
          </p>
          <div
            className={
              aggregateMonths.length === 2
                ? "grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-[620px]"
                : "max-w-[300px]"
            }
          >
            {[...aggregateMonths].reverse().map((am) => (
              <MonthCalGrid
                key={`${am.year}-${am.month}`}
                year={am.year}
                month={am.month}
                cells={am.cells}
                doneColor="#216e39"
                today={aggregateToday}
                trimBefore={aggregateTrimBefore}
              />
            ))}
          </div>
        </div>
      ) : null}

      {empty ? (
        <EmptyState showArchived={showArchived} />
      ) : (
        <div className="space-y-8">
          {categories.map((cat) => {
            const items = goalsByCategory.get(cat.id) ?? [];
            if (items.length === 0) return null;
            return (
              <CategoryGroup
                key={cat.id}
                name={cat.name}
                color={cat.color}
                goals={items}
                archived={showArchived}
                shares={goalShares}
                newReactionGoals={newReactionGoals}
                ringsByGoal={ringsByGoal}
              />
            );
          })}
          {(goalsByCategory.get(null) ?? []).length > 0 && (
            <CategoryGroup
              name="Uncategorized"
              color={UNCATEGORIZED_COLOR}
              goals={goalsByCategory.get(null) ?? []}
              archived={showArchived}
              shares={goalShares}
              newReactionGoals={newReactionGoals}
              ringsByGoal={ringsByGoal}
            />
          )}
        </div>
      )}

      {!showArchived && (archivedCount ?? 0) > 0 && (
        <div className="mt-12 pt-6 border-t border-[color:var(--border)]">
          <Link
            href="/consistencytracker/goals?archived=1"
            className="text-xs text-[color:var(--muted)] hover:text-black"
          >
            View {archivedCount} archived goal{archivedCount === 1 ? "" : "s"} →
          </Link>
        </div>
      )}

      {showArchived && (
        <div className="mt-12 pt-6 border-t border-[color:var(--border)]">
          <Link
            href="/consistencytracker/goals"
            className="text-xs text-[color:var(--muted)] hover:text-black"
          >
            ← Back to active goals
          </Link>
        </div>
      )}
    </section>
  );
}

// Tooltip text for the share icon: up to 3 names, then "and N others".
function shareTitle(names: string[] | undefined): string | null {
  if (!names || names.length === 0) return null;
  if (names.length <= 3) return `Shared with ${names.join(", ")}`;
  const rest = names.length - 3;
  return `Shared with ${names.slice(0, 3).join(", ")} and ${rest} other${
    rest === 1 ? "" : "s"
  }`;
}

// Small "people" glyph marking a shared goal; the partner name(s) are revealed
// on hover via the wrapping element's title.
function ShareIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="9" cy="7" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M16 5a3 3 0 0 1 0 6" />
      <path d="M21 20c0-2.3-1.4-4.3-3.5-5.2" />
    </svg>
  );
}

function CategoryGroup({
  name,
  color,
  goals,
  archived,
  shares,
  newReactionGoals,
  ringsByGoal,
}: {
  name: string;
  color: string;
  goals: GoalRow[];
  archived: boolean;
  shares: Record<string, string[]>;
  newReactionGoals: Set<string>;
  ringsByGoal: Map<string, WeekRing[]>;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span
          aria-hidden
          className="w-2 h-2 rounded-full"
          style={{ background: color }}
        />
        <h2 className="text-xs uppercase tracking-wider text-[color:var(--muted)]">
          {name}
        </h2>
      </div>
      <ul className="border border-[color:var(--border)] rounded-lg divide-y divide-[color:var(--border)]">
        {goals.map((g) => {
          const shareNames = shares[g.id] ?? [];
          const share = shareTitle(shareNames);
          return (
          <li
            key={g.id}
            className="relative flex items-start justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            <div className="min-w-0 pr-4 pt-0.5">
              {/* Stretched link: the ::after overlay makes the whole row open
                  the goal, while the right-side cluster sits on a higher layer
                  and stays independently hoverable/clickable. */}
              <Link
                href={`/consistencytracker/goals/${g.id}`}
                className="text-sm font-medium hover:underline after:absolute after:inset-0 after:content-['']"
              >
                {g.name}
              </Link>
              {/* Line 2: cadence */}
              <div className="mt-0.5">
                <span className="text-xs text-[color:var(--muted)] whitespace-nowrap">
                  {targetDaysLabel(g.target_days)}
                </span>
              </div>
              {/* Line 3: description, wraps to 2 lines then clips */}
              {g.description ? (
                <p className="text-xs text-[color:var(--muted)] mt-1 line-clamp-2">
                  {g.description}
                </p>
              ) : null}
            </div>
            {/* Right column: week rings top-right (scannable across all cards),
                actions below. flex-col keeps the ring row anchored to the top
                of the card regardless of how tall the left column grows. */}
            <div className="relative z-10 flex shrink-0 flex-col items-end gap-2">
              {ringsByGoal.has(g.id) && (
                <GoalWeekRings rings={ringsByGoal.get(g.id)!} color={color} />
              )}
              <div className="flex items-center gap-2">
                {newReactionGoals.has(g.id) ? (
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full bg-blue-600"
                    title="New reaction from a partner"
                    aria-label="New reaction from a partner"
                  />
                ) : null}
                {share ? (
                  <span
                    className="group relative inline-flex items-center gap-0.5 text-[color:var(--muted)]"
                    aria-label={share}
                  >
                    <ShareIcon />
                    {shareNames.length > 1 ? (
                      <span className="text-[10px] leading-none">
                        {shareNames.length}
                      </span>
                    ) : null}
                    {/* Custom tooltip: native title has a ~500ms browser delay;
                        this shows in ~100ms on hover. Anchored right (the icon is
                        near the row's right edge) and wraps so it stays on-screen. */}
                    <span
                      role="tooltip"
                      className="pointer-events-none absolute right-0 top-full z-20 mt-1 w-max max-w-[12rem] rounded bg-[#0a0a0a] px-2 py-1 text-left text-[11px] leading-snug text-white opacity-0 transition-opacity duration-100 group-hover:opacity-100"
                    >
                      {share}
                    </span>
                  </span>
                ) : null}
                <GoalRowMenu goalId={g.id} goalName={g.name} archived={archived} />
              </div>
            </div>
          </li>
          );
        })}
      </ul>
    </div>
  );
}

function EmptyState({ showArchived }: { showArchived: boolean }) {
  if (showArchived) {
    return (
      <div className="border border-dashed border-[color:var(--border)] rounded-lg p-10 text-center">
        <p className="text-sm text-[color:var(--muted)]">No archived goals.</p>
      </div>
    );
  }
  return (
    <div className="border border-dashed border-[color:var(--border)] rounded-lg p-10 text-center">
      <p className="text-sm text-[color:var(--muted)] mb-4">
        No goals yet. Pick one small habit to start with. You can always add more.
      </p>
      <Link
        href="/consistencytracker/goals/new"
        className="inline-block bg-black text-white text-sm rounded-md px-4 py-2 hover:bg-gray-800"
      >
        Create your first goal
      </Link>
    </div>
  );
}
