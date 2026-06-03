import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getCurrentProfile } from "@/lib/supabase/current-user";
import { listCategories } from "@/lib/actions/categories";
import { listGoalShares } from "@/lib/actions/partners";
import { listGoalsWithUnseenReactions } from "@/lib/actions/reactions";
import { targetDaysLabel } from "@/lib/target-days-label";
import { buildAggregateCells } from "@/lib/stats";
import { todayIn, addDays } from "@/lib/dates";
import GoalRowActions from "@/components/goal-row-actions";
import Heatmap from "@/components/heatmap";

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

  // All-goals heatmap summary (active view only). A compact recent window —
  // the last ~12 weeks, trimmed so it never starts before the first goal — so
  // it fits without horizontal scrolling and stays legible for newcomers. It
  // appears only once there's a check-in to show, so a brand-new user isn't
  // greeted by an empty grid they can't yet read.
  let heatmapCells: Awaited<ReturnType<typeof buildAggregateCells>> | null = null;
  if (!showArchived && (goals ?? []).length > 0) {
    const activeGoals = goals as GoalRow[];
    const profile = await getCurrentProfile();
    const today = todayIn(profile?.timezone ?? "UTC");
    const earliest = activeGoals.reduce(
      (min, g) => {
        const d = g.created_at.slice(0, 10);
        return d < min ? d : min;
      },
      today
    );
    const twelveWeeksAgo = addDays(today, -83);
    const rangeStart = earliest > twelveWeeksAgo ? earliest : twelveWeeksAgo;

    const { data: ciRaw } = await supabase
      .from("check_ins")
      .select("goal_id, date, status")
      .in(
        "goal_id",
        activeGoals.map((g) => g.id)
      )
      .gte("date", rangeStart)
      .lte("date", today);
    const checkIns = (ciRaw ?? []) as Array<{
      goal_id: string;
      date: string;
      status: "done" | "skipped";
    }>;

    if (checkIns.length > 0) {
      heatmapCells = buildAggregateCells({
        startDate: rangeStart,
        endDate: today,
        todayStr: today,
        goals: activeGoals.map((g) => ({
          id: g.id,
          target_days: g.target_days,
          created_at: g.created_at,
          weekly_target: g.weekly_target,
        })),
        checkIns,
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
            className="bg-black text-white text-sm rounded-md px-4 py-2 hover:bg-gray-800"
          >
            + Add goal
          </Link>
        )}
      </header>

      {heatmapCells ? (
        <div className="mb-10">
          <h2 className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-1">
            Recent activity — all goals
          </h2>
          <p className="text-xs text-[color:var(--muted)] mb-3">
            Each square is a day. The greener it is, the more you did.
          </p>
          <Heatmap cells={heatmapCells} hideLegend />
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
              />
            );
          })}
          {(goalsByCategory.get(null) ?? []).length > 0 && (
            <CategoryGroup
              name="Uncategorized"
              color="#9ca3af"
              goals={goalsByCategory.get(null) ?? []}
              archived={showArchived}
              shares={goalShares}
              newReactionGoals={newReactionGoals}
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

function shareLabel(names: string[] | undefined): string | null {
  if (!names || names.length === 0) return null;
  if (names.length === 1) return `Shared with ${names[0]}`;
  return `Shared with ${names[0]} +${names.length - 1}`;
}

function CategoryGroup({
  name,
  color,
  goals,
  archived,
  shares,
  newReactionGoals,
}: {
  name: string;
  color: string;
  goals: GoalRow[];
  archived: boolean;
  shares: Record<string, string[]>;
  newReactionGoals: Set<string>;
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
        {goals.map((g) => (
          <li
            key={g.id}
            className="relative flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            <div className="min-w-0 pr-4">
              <span className="inline-flex items-center gap-1.5">
                {/* Stretched link: the ::after overlay makes the whole row
                    open the goal, while the actions below sit on a higher
                    layer and stay independently clickable. */}
                <Link
                  href={`/consistencytracker/goals/${g.id}`}
                  className="text-sm font-medium hover:underline after:absolute after:inset-0 after:content-['']"
                >
                  {g.name}
                </Link>
                {newReactionGoals.has(g.id) ? (
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full bg-blue-600"
                    title="New reaction from a partner"
                    aria-label="New reaction from a partner"
                  />
                ) : null}
              </span>
              <p className="text-xs text-[color:var(--muted)] mt-0.5">
                {targetDaysLabel(g.target_days)}
                {g.description ? ` · ${g.description}` : ""}
              </p>
              {shareLabel(shares[g.id]) ? (
                <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-[color:var(--muted)]">
                  <span aria-hidden>↗</span>
                  {shareLabel(shares[g.id])}
                </p>
              ) : null}
            </div>
            <div className="relative z-10 shrink-0">
              <GoalRowActions goalId={g.id} archived={archived} />
            </div>
          </li>
        ))}
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
        No goals yet. Pick one small habit to start with — you can always add more.
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
