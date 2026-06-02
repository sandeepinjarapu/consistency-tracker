import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { listCategories } from "@/lib/actions/categories";
import { listGoalShares } from "@/lib/actions/partners";
import { listGoalsWithUnseenReactions } from "@/lib/actions/reactions";
import { targetDaysLabel } from "@/lib/target-days-label";
import GoalRowActions from "@/components/goal-row-actions";

type GoalRow = {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  target_days: number[];
  active: boolean;
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
    .select("id, name, description, category_id, target_days, active")
    .eq("user_id", user.id)
    .eq("active", !showArchived)
    .order("created_at", { ascending: true });

  const goalsByCategory = new Map<string | null, GoalRow[]>();
  for (const g of (goals ?? []) as GoalRow[]) {
    const key = g.category_id ?? null;
    if (!goalsByCategory.has(key)) goalsByCategory.set(key, []);
    goalsByCategory.get(key)!.push(g);
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
            className="flex items-center justify-between px-4 py-3"
          >
            <div className="min-w-0 pr-4">
              <span className="inline-flex items-center gap-1.5">
                <Link
                  href={`/consistencytracker/goals/${g.id}`}
                  className="text-sm font-medium hover:underline"
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
            <GoalRowActions goalId={g.id} archived={archived} />
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
