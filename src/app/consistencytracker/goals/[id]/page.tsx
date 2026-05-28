import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addDays, todayIn, formatTime } from "@/lib/dates";
import { buildHeatmapCells, computeStats, computeTimePattern } from "@/lib/stats";
import { targetDaysLabel } from "@/lib/target-days-label";
import { listPartners, listSharesForGoal } from "@/lib/actions/partners";
import { buildGCalUrl } from "@/lib/gcal";
import Heatmap from "@/components/heatmap";
import GoalRowActions from "@/components/goal-row-actions";
import ShareToggles from "@/components/share-toggles";
import TimeHistogram from "@/components/time-histogram";

export default async function GoalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single();
  const timezone = profile?.timezone ?? "UTC";
  const today = todayIn(timezone);

  const { data: goal } = await supabase
    .from("goals")
    .select(
      "id, name, description, doc_url, target_days, reminder_time, active, created_at, user_id, category:categories(name, color)"
    )
    .eq("id", id)
    .single();
  if (!goal) notFound();

  // This page is for owners only (with mutate controls). If a partner
  // is viewing because the goal was shared with them, send them to the
  // partner view instead.
  if (goal.user_id !== user.id) {
    redirect(`/consistencytracker/partners/${goal.user_id}`);
  }

  const category = Array.isArray(goal.category)
    ? goal.category[0] ?? null
    : goal.category;
  const categoryColor = category?.color ?? "#9ca3af";

  // Date range: past year
  const startDate = addDays(today, -364);
  const goalStartDate = (goal.created_at as string).slice(0, 10);

  const [{ data: checkInsRaw }, partners, sharedWith] = await Promise.all([
    supabase
      .from("check_ins")
      .select("date, status, created_at")
      .eq("goal_id", id)
      .gte("date", startDate)
      .lte("date", today)
      .order("date", { ascending: true }),
    listPartners(),
    listSharesForGoal(id),
  ]);

  const checkIns = (checkInsRaw ?? []) as Array<{
    date: string;
    status: "done" | "skipped";
    created_at: string;
  }>;

  const timePattern = computeTimePattern({
    timestamps: checkIns
      .filter((c) => c.status === "done")
      .map((c) => c.created_at),
    timezone,
  });

  const cells = buildHeatmapCells({
    startDate,
    endDate: today,
    targetDays: goal.target_days,
    checkIns,
    goalStartDate,
    todayStr: today,
  });

  const stats = computeStats({
    startDate: goalStartDate > startDate ? goalStartDate : startDate,
    endDate: today,
    targetDays: goal.target_days,
    checkIns,
  });

  return (
    <section>
      <Link
        href="/consistencytracker/goals"
        className="text-xs text-[color:var(--muted)] hover:text-black"
      >
        ← All goals
      </Link>

      <header className="mt-4 mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span
              aria-hidden
              className="w-2 h-2 rounded-full"
              style={{ background: categoryColor }}
            />
            <span className="text-xs uppercase tracking-wider text-[color:var(--muted)]">
              {category?.name ?? "Uncategorized"} · {targetDaysLabel(goal.target_days)}
            </span>
          </div>
          <h1 className="text-2xl font-light tracking-tight">{goal.name}</h1>
          {goal.description ? (
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              {goal.description}
            </p>
          ) : null}
          <div className="mt-3 flex items-center gap-4 text-xs text-[color:var(--muted)]">
            {goal.doc_url ? (
              <a
                href={goal.doc_url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-black"
              >
                Reflection doc ↗
              </a>
            ) : null}
            {goal.reminder_time ? (
              <a
                href={buildGCalUrl({
                  name: goal.name,
                  description: goal.description,
                  reminderTime: goal.reminder_time,
                  targetDays: goal.target_days,
                  timezone,
                })}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-black"
              >
                Add to Google Calendar ↗
              </a>
            ) : (
              <span>No reminder set · <a href={`/consistencytracker/goals/${goal.id}/edit`} className="underline hover:text-black">add one</a></span>
            )}
          </div>
        </div>
        <GoalRowActions goalId={goal.id} archived={!goal.active} />
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-10">
        <Stat label="Current streak" value={`${stats.currentStreak}`} unit="days" />
        <Stat label="Longest streak" value={`${stats.longestStreak}`} unit="days" />
        <Stat label="Done" value={`${stats.doneCount}`} unit={`/ ${stats.doneCount + stats.skippedCount + stats.missedCount}`} />
        <Stat label="Completion" value={`${Math.round(stats.completionRate * 100)}%`} unit={stats.skippedCount > 0 ? `(${stats.skippedCount} skipped)` : ""} />
        <Stat
          label="Typical"
          value={
            timePattern.typical
              ? formatTime(timePattern.typical.hour, timePattern.typical.minute)
              : "—"
          }
          unit={timePattern.total > 0 ? "median" : ""}
        />
      </div>

      <Heatmap cells={cells} doneColor={categoryColor} />

      <div className="mt-8">
        <h3 className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-3">
          Time of day
        </h3>
        <TimeHistogram
          hourly={timePattern.hourly}
          total={timePattern.total}
          color={categoryColor}
        />
      </div>

      <div className="mt-12 pt-6 border-t border-[color:var(--border)]">
        <h3 className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-3">
          Sharing
        </h3>
        <ShareToggles
          goalId={goal.id}
          partners={partners.map((p) => ({
            id: p.id,
            display_name: p.display_name,
          }))}
          sharedWith={sharedWith}
        />
      </div>
    </section>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="border border-[color:var(--border)] rounded-lg p-4">
      <p className="text-xs uppercase tracking-wider text-[color:var(--muted)]">
        {label}
      </p>
      <p className="mt-1 text-xl font-light">
        {value}
        {unit ? (
          <span className="ml-1 text-xs text-[color:var(--muted)] font-normal">
            {unit}
          </span>
        ) : null}
      </p>
    </div>
  );
}
