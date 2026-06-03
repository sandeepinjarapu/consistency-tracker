import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  addDays,
  todayIn,
  isoWeekStart,
  formatTime,
  dayOfWeekForDateString,
} from "@/lib/dates";
import { computeWeekStatus, computeWeekSlots } from "@/lib/goal-week-status";
import {
  buildHeatmapCells,
  buildGoalInsight,
  computeStats,
  computeTimePattern,
  computeWeeklyMet,
} from "@/lib/stats";
import { targetDaysLabel } from "@/lib/target-days-label";
import { getCurrentUser, getCurrentProfile } from "@/lib/supabase/current-user";
import { listPartners, listSharesForGoal } from "@/lib/actions/partners";
import { getGoalReactions } from "@/lib/actions/reactions";
import { REACTION_EMOJI, reactionSentence } from "@/lib/reactions";
import { buildGCalUrl } from "@/lib/gcal";
import { safeExternalUrl } from "@/lib/url";
import CalendarReminder from "@/components/calendar-reminder";
import Heatmap from "@/components/heatmap";
import WeekProgress from "@/components/week-progress";
import WeeklyStrip from "@/components/weekly-strip";
import GoalRowActions from "@/components/goal-row-actions";
import ShareToggles from "@/components/share-toggles";
import TimeHistogram from "@/components/time-histogram";
import MarkReactionsSeen from "@/components/mark-reactions-seen";
import Skeleton from "@/components/skeleton";

export default async function GoalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const user = await getCurrentUser();
  if (!user) return null;

  const profile = await getCurrentProfile();
  const timezone = profile?.timezone ?? "UTC";
  const today = todayIn(timezone);

  const { data: goal } = await supabase
    .from("goals")
    .select(
      "id, name, description, motivation, doc_url, target_days, reminder_time, calendar_added_at, weekly_target, active, created_at, user_id, category:categories(name, color)"
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
  const docUrl = safeExternalUrl(goal.doc_url);
  const isCount = goal.weekly_target != null;
  const cadenceLabel = isCount
    ? `${goal.weekly_target}× per week`
    : targetDaysLabel(goal.target_days);
  const streakUnit = isCount ? "weeks" : "days";

  // Date range: past year (stats). The heatmap uses a compact recent window
  // computed inside StatsSection.
  const startDate = addDays(today, -364);
  const goalStartDate = (goal.created_at as string).slice(0, 10);

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
              {category?.name ?? "Uncategorized"} · {cadenceLabel}
            </span>
          </div>
          <h1 className="text-2xl font-light tracking-tight">{goal.name}</h1>
          {goal.description ? (
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              {goal.description}
            </p>
          ) : null}
          {goal.motivation ? (
            <p className="mt-2 max-w-prose text-sm italic text-[color:var(--muted)]">
              “{goal.motivation}”
            </p>
          ) : null}
          <div className="mt-3 flex items-center gap-4 text-xs text-[color:var(--muted)]">
            {docUrl ? (
              <a
                href={docUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-black"
              >
                Reflection doc ↗
              </a>
            ) : null}
            {!isCount ? (
              goal.reminder_time ? (
                <CalendarReminder
                  goalId={goal.id}
                  gcalUrl={buildGCalUrl({
                    name: goal.name,
                    description: goal.description,
                    reminderTime: goal.reminder_time,
                    targetDays: goal.target_days,
                    timezone,
                  })}
                  reminderLabel={formatReminder(goal.reminder_time)}
                  addedAt={goal.calendar_added_at}
                />
              ) : (
                <span>No reminder set · <a href={`/consistencytracker/goals/${goal.id}/edit`} className="underline hover:text-black">add one</a></span>
              )
            ) : null}
          </div>
        </div>
        <GoalRowActions goalId={goal.id} archived={!goal.active} />
      </header>

      {/* Sharing sits high on the page — partner accountability is central to
          the product — but as a light status row, not a heavy module: no
          uppercase section header, just "Shared with … · Manage". */}
      <div className="mb-8 pb-5 border-b border-[color:var(--border)]">
        <Suspense fallback={<Skeleton className="h-5 w-48" />}>
          <SharingSection goalId={goal.id} />
        </Suspense>
      </div>

      <Suspense fallback={<StatsSkeleton isCount={isCount} />}>
        <StatsSection
          goalId={goal.id}
          targetDays={goal.target_days}
          weeklyTarget={goal.weekly_target}
          startDate={startDate}
          goalStartDate={goalStartDate}
          today={today}
          timezone={timezone}
          categoryColor={categoryColor}
          streakUnit={streakUnit}
        />
      </Suspense>
    </section>
  );
}

// The heavy part: a year of check-ins + stats/heatmap/histogram computation.
// Streams in behind the header, which paints on the fast goal lookup.
async function StatsSection({
  goalId,
  targetDays,
  weeklyTarget,
  startDate,
  goalStartDate,
  today,
  timezone,
  categoryColor,
  streakUnit,
}: {
  goalId: string;
  targetDays: number[];
  weeklyTarget: number | null;
  startDate: string;
  goalStartDate: string;
  today: string;
  timezone: string;
  categoryColor: string;
  streakUnit: string;
}) {
  const supabase = await createClient();
  const { data: checkInsRaw } = await supabase
    .from("check_ins")
    .select("date, status, created_at")
    .eq("goal_id", goalId)
    .gte("date", startDate)
    .lte("date", today)
    .order("date", { ascending: true });

  const checkIns = (checkInsRaw ?? []) as Array<{
    date: string;
    status: "done" | "skipped";
    created_at: string;
  }>;

  const timePattern = computeTimePattern({
    entries: checkIns
      .filter((c) => c.status === "done")
      .map((c) => ({ createdAt: c.created_at, date: c.date })),
    timezone,
  });

  // Compact recent window (~12 weeks, trimmed so it never starts before the
  // goal) so the heatmap stays legible and doesn't auto-scroll a full year.
  // Stats below still span `startDate` (the year), so all-time numbers are
  // unaffected.
  const twelveWeeksAgo = addDays(today, -83);
  const heatmapStart =
    goalStartDate > twelveWeeksAgo ? goalStartDate : twelveWeeksAgo;

  const cells = buildHeatmapCells({
    startDate: heatmapStart,
    endDate: today,
    targetDays,
    checkIns,
    goalStartDate,
    todayStr: today,
    weeklyTarget,
  });

  const clampStart = goalStartDate > startDate ? goalStartDate : startDate;
  const stats = computeStats({
    startDate: clampStart,
    endDate: today,
    targetDays,
    checkIns,
    weeklyTarget,
  });

  const weeklyMet =
    weeklyTarget != null
      ? computeWeeklyMet({
          startDate: clampStart,
          endDate: today,
          targetDays,
          checkIns,
          weeklyTarget,
        })
      : [];

  const insight = buildGoalInsight({
    typical: timePattern.typical,
    timedTotal: timePattern.total,
    currentStreak: stats.currentStreak,
    streakUnit,
    doneCount: stats.doneCount,
  });

  // "Where am I this week?" — the page's primary status. For count goals the
  // denominator is the weekly target; for specific-day goals it's the number
  // of scheduled days in the current ISO week.
  const weekStart = isoWeekStart(today);
  const doneDatesThisWeek = checkIns
    .filter((c) => c.status === "done" && c.date >= weekStart && c.date <= today)
    .map((c) => c.date);
  const doneThisWeek = doneDatesThisWeek.length;
  let total = weeklyTarget ?? 0;
  if (weeklyTarget == null) {
    for (let d = 0; d < 7; d++) {
      if (targetDays.includes(dayOfWeekForDateString(addDays(weekStart, d)))) {
        total++;
      }
    }
  }
  const weekStatus = computeWeekStatus({
    doneThisWeek,
    total,
    isCount: weeklyTarget != null,
    currentStreak: stats.currentStreak,
    longestStreak: stats.longestStreak,
    streakUnit,
    doneCount: stats.doneCount,
  });
  const weekSlots = computeWeekSlots({
    isCount: weeklyTarget != null,
    weekStart,
    today,
    targetDays,
    doneDates: doneDatesThisWeek,
    weeklyTarget: weeklyTarget ?? 0,
    doneThisWeek,
  });

  return (
    <>
      <div className="mb-8">
        <p className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-1">
          This week
        </p>
        <p className="text-3xl font-light tracking-tight">
          {weekStatus.headline}
        </p>
        <p className="mt-1 text-sm">{weekStatus.note}</p>
        <div className="mt-3">
          <WeekProgress slots={weekSlots} doneColor={categoryColor} />
        </div>
        <p className="mt-3 text-xs text-[color:var(--muted)]">
          {weekStatus.secondary}
        </p>
      </div>

      <div className="mb-10">
        <h3 className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-2">
          Recent activity
        </h3>
        <p className="text-xs text-[color:var(--muted)] mb-2">
          Each square is a day. Click one to log or undo a check-in — this week, or up to 2 days into the next.
        </p>
        <Heatmap
          cells={cells}
          doneColor={categoryColor}
          editable={{
            goalId,
            goalStartDate,
            today,
            targetDays,
          }}
        />
      </div>

      {/* Week-by-week trend sits in the history zone, after the daily heatmap —
          not next to the "X of 5" headline, which already covers this week. */}
      {weeklyTarget != null ? (
        <div className="mb-10">
          <h3 className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-3">
            Week by week
          </h3>
          <WeeklyStrip
            weeks={weeklyMet}
            weeklyTarget={weeklyTarget}
            doneColor={categoryColor}
          />
        </div>
      ) : null}

      {/* Pattern — what the app has noticed. Comes last (status → proof →
          pattern), and the insight sentence narrates the time-of-day chart. */}
      {insight ? (
        <p className="text-sm leading-relaxed mb-6">{insight}</p>
      ) : null}
      {timePattern.total >= 4 ? (
        <div>
          <h3 className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-3">
            Time of day
          </h3>
          <TimeHistogram hourly={timePattern.hourly} color={categoryColor} />
        </div>
      ) : null}
    </>
  );
}

async function SharingSection({ goalId }: { goalId: string }) {
  const [partners, sharedWith, reactions, profile] = await Promise.all([
    listPartners(),
    listSharesForGoal(goalId),
    getGoalReactions(goalId),
    getCurrentProfile(),
  ]);
  const currentWeekStart = isoWeekStart(todayIn(profile?.timezone ?? "UTC"));
  return (
    <>
      <ShareToggles
        goalId={goalId}
        partners={partners.map((p) => ({
          id: p.id,
          display_name: p.display_name,
        }))}
        sharedWith={sharedWith}
      />
      {reactions.length > 0 ? (
        <div className="mt-5">
          {/* Visiting your own goal = acknowledgement; clears the nav badge. */}
          <MarkReactionsSeen goalId={goalId} />
          <ul className="space-y-1 text-xs text-[color:var(--muted)]">
            {reactions.map((r, i) => (
              <li key={i}>
                {REACTION_EMOJI[r.kind]} {reactionSentence(r, currentWeekStart)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

function StatsSkeleton({ isCount }: { isCount: boolean }) {
  return (
    <div aria-busy>
      <span className="sr-only">Loading…</span>
      <div className="mb-8 space-y-2">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-4 w-40" />
      </div>
      <Skeleton className="h-28 w-full" />
      {isCount ? (
        <div className="mt-8">
          <h3 className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-3">
            Week by week
          </h3>
          <Skeleton className="h-8 w-full" />
        </div>
      ) : null}
      <div className="mt-8">
        <h3 className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-3">
          Time of day
        </h3>
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}

// "09:00:00" (Postgres TIME) → "9:00am".
function formatReminder(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return formatTime(h, m);
}
