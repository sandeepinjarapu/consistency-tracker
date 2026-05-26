import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isPartner } from "@/lib/actions/partners";
import { addDays, todayIn } from "@/lib/dates";
import { buildHeatmapCells, computeStats } from "@/lib/stats";
import { targetDaysLabel } from "@/lib/target-days-label";
import Heatmap from "@/components/heatmap";

type SharedGoal = {
  id: string;
  name: string;
  description: string | null;
  doc_url: string | null;
  target_days: number[];
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Verify partnership
  const partnered = await isPartner(partnerId);
  if (!partnered) {
    return (
      <section className="max-w-md mx-auto pt-12 text-center space-y-4">
        <h1 className="text-xl font-light tracking-tight">Not your partner</h1>
        <p className="text-sm text-[color:var(--muted)]">
          You can only view tracker data for people who have accepted your invite, or whose invite you've accepted.
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

  // RLS will filter to only goals shared with the current user
  const { data: rawGoals } = await supabase
    .from("goals")
    .select(
      "id, name, description, doc_url, target_days, created_at, category:categories(name, color)"
    )
    .eq("user_id", partnerId)
    .eq("active", true)
    .order("created_at", { ascending: true });

  const goals: SharedGoal[] = (rawGoals ?? []).map((g) => ({
    ...g,
    category: Array.isArray(g.category) ? g.category[0] ?? null : g.category,
  })) as SharedGoal[];

  // Pull check-ins for all shared goals in one query
  let checkInsByGoal = new Map<
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

  return (
    <section className="space-y-10">
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

      {goals.length === 0 ? (
        <div className="border border-dashed border-[color:var(--border)] rounded-lg p-10 text-center">
          <p className="text-sm text-[color:var(--muted)]">
            They haven't shared any goals with you yet. Once they toggle sharing on a goal, it'll appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-12">
          {goals.map((goal) => {
            const checkIns = checkInsByGoal.get(goal.id) ?? [];
            const goalStart = goal.created_at.slice(0, 10);
            const cells = buildHeatmapCells({
              startDate: yearStart,
              endDate: today,
              targetDays: goal.target_days,
              checkIns,
              goalStartDate: goalStart,
              todayStr: today,
            });
            const stats = computeStats({
              startDate: goalStart > yearStart ? goalStart : yearStart,
              endDate: today,
              targetDays: goal.target_days,
              checkIns,
            });
            const color = goal.category?.color ?? "#9ca3af";

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
                      {targetDaysLabel(goal.target_days)}
                    </span>
                  </div>
                  <h2 className="text-lg font-medium">{goal.name}</h2>
                  {goal.description ? (
                    <p className="mt-1 text-sm text-[color:var(--muted)]">
                      {goal.description}
                    </p>
                  ) : null}
                  {goal.doc_url ? (
                    <a
                      href={goal.doc_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-xs underline text-[color:var(--muted)] hover:text-black"
                    >
                      Reflection doc ↗
                    </a>
                  ) : null}
                  <p className="mt-2 text-xs text-[color:var(--muted)]">
                    {stats.currentStreak > 0
                      ? `${stats.currentStreak} day streak · `
                      : ""}
                    {stats.doneCount} done · {Math.round(stats.completionRate * 100)}% completion
                  </p>
                </div>
                <Heatmap cells={cells} doneColor={color} />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
