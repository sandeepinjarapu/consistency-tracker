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
  dateInTimezone,
} from "@/lib/dates";
import { computeWeekStatus } from "@/lib/goal-week-status";
import {
  buildGoalInsight,
  computeStats,
  computeTimePattern,
  computeWeeklyMet,
} from "@/lib/stats";
import { buildWeekRows } from "@/lib/week-rows";
import { classifyWeek } from "@/lib/extra-check-ins";
import { targetDaysLabel } from "@/lib/target-days-label";
import { getCurrentUser, getCurrentProfile } from "@/lib/supabase/current-user";
import { listPartners, listPendingInvites, listSharesForGoal } from "@/lib/actions/partners";
import { getGoalReactions } from "@/lib/actions/reactions";
import { REACTION_EMOJI, reactionSentence } from "@/lib/reactions";
import { buildGCalUrl } from "@/lib/gcal";
import { safeExternalUrl } from "@/lib/url";
import { UNCATEGORIZED_COLOR } from "@/lib/colors";
import CalendarReminder from "@/components/calendar-reminder";
import GoalRowMenu from "@/components/goal-row-menu";
import GoalSharing from "@/components/goal-sharing";
import Motivation from "@/components/motivation";
import ProgressRing from "@/components/progress-ring";
import WeekRows from "@/components/week-rows";
import FullHistory from "@/components/full-history";
import WeekQuotaRows from "@/components/week-quota-rows";
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

  // Owner-only page (with mutate controls). Partners viewing a shared goal go
  // to the read-only partner view.
  if (goal.user_id !== user.id) {
    redirect(`/consistencytracker/partners/${goal.user_id}`);
  }

  const category = Array.isArray(goal.category)
    ? goal.category[0] ?? null
    : goal.category;
  const categoryColor = category?.color ?? UNCATEGORIZED_COLOR;
  const docUrl = safeExternalUrl(goal.doc_url);
  const isCount = goal.weekly_target != null;
  const cadenceLabel = isCount
    ? `${goal.weekly_target}× per week`
    : targetDaysLabel(goal.target_days);
  const streakUnit = isCount ? "weeks" : "days";

  const startDate = addDays(today, -364);
  const goalStartDate = dateInTimezone(goal.created_at as string, timezone);

  // Reminder lives in the Connections column (specific-day goals only). The
  // CalendarReminder keeps its own "Added ✓ · Add again" honesty.
  const reminder =
    !isCount && goal.reminder_time
      ? {
          gcalUrl: buildGCalUrl({
            name: goal.name,
            description: goal.description,
            reminderTime: goal.reminder_time,
            targetDays: goal.target_days,
            timezone,
          }),
          label: formatReminder(goal.reminder_time),
          addedAt: goal.calendar_added_at as string | null,
        }
      : null;

  return (
    <section>
      <Link
        href="/consistencytracker/goals"
        className="text-xs text-[color:var(--muted)] hover:text-black"
      >
        ← All goals
      </Link>

      <header className="mt-4 mb-5 flex items-start justify-between gap-4">
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
        </div>
        <GoalRowMenu goalId={goal.id} goalName={goal.name} archived={!goal.active} trigger="gear" />
      </header>

      {/* Why (left) · Connections (right). The why is the human content; the
          right column is links and controls (sharing, doc, reminder). */}
      <div className="flex gap-5">
        <div className="flex-[1.2] min-w-0">
          <Motivation goalId={goal.id} initial={goal.motivation} />
        </div>
        <div className="flex-1 min-w-0 border-l border-[color:var(--border)] pl-5">
          <Suspense fallback={<Skeleton className="h-5 w-32" />}>
            <ConnectionsColumn goalId={goal.id} docUrl={docUrl} reminder={reminder} />
          </Suspense>
        </div>
      </div>

      {/* Reaction, full width, only when a partner has reacted. */}
      <Suspense fallback={null}>
        <ReactionLine goalId={goal.id} timezone={timezone} />
      </Suspense>

      <div className="my-6 border-t border-[color:var(--border)]" />

      <Suspense fallback={<RecordSkeleton isCount={isCount} />}>
        <RecordSection
          goalId={goal.id}
          isCount={isCount}
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

async function ConnectionsColumn({
  goalId,
  docUrl,
  reminder,
}: {
  goalId: string;
  docUrl: string | null;
  reminder: { gcalUrl: string; label: string; addedAt: string | null } | null;
}) {
  const [partners, pending, sharedWith] = await Promise.all([
    listPartners(),
    listPendingInvites(),
    listSharesForGoal(goalId),
  ]);

  return (
    <div className="flex flex-col gap-2.5">
      <GoalSharing
        goalId={goalId}
        partners={partners.map((p) => ({ id: p.id, display_name: p.display_name }))}
        pending={pending.map((p) => ({
          id: p.id,
          invitee_email: p.invitee_email,
          invite_url: p.invite_url,
        }))}
        sharedWith={sharedWith}
      />
      {docUrl ? (
        <a
          href={docUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-[#374151] hover:text-black"
        >
          <DocIcon />
          Reflection doc <span className="text-[color:var(--muted)]">↗</span>
        </a>
      ) : null}
      {reminder ? (
        <div className="text-xs text-[color:var(--muted)]">
          <CalendarReminder
            goalId={goalId}
            gcalUrl={reminder.gcalUrl}
            reminderLabel={reminder.label}
            addedAt={reminder.addedAt}
          />
        </div>
      ) : null}
    </div>
  );
}

async function ReactionLine({
  goalId,
  timezone,
}: {
  goalId: string;
  timezone: string;
}) {
  const reactions = await getGoalReactions(goalId);
  if (reactions.length === 0) return null;
  const currentWeekStart = isoWeekStart(todayIn(timezone));
  return (
    <div className="mt-4 border-t border-[#f0f0ef] pt-4">
      {/* Visiting your own goal acknowledges the reactions; clears the nav badge. */}
      <MarkReactionsSeen goalId={goalId} />
      <ul className="space-y-1.5">
        {reactions.map((r, i) => (
          <li key={i} className="flex items-start gap-2 text-sm leading-relaxed">
            <span aria-hidden>{REACTION_EMOJI[r.kind]}</span>
            <span>{reactionSentence(r, currentWeekStart)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// The heavy part: a year of check-ins + this-week status, the editable week
// grid, the optional full history, and the time-of-day pattern.
async function RecordSection({
  goalId,
  isCount,
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
  isCount: boolean;
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

  const statusByDate: Record<string, "done" | "skipped"> = {};
  for (const c of checkIns) statusByDate[c.date] = c.status;

  // "Where am I this week?" — the headline reflects scored progress only, so an
  // over-quota frequency week reads "3 of 3", never "4 of 3", and (once extras
  // can be logged) an off-target day never inflates a specific-day headline.
  const weekStart = isoWeekStart(today);
  const weekDoneDates = checkIns
    .filter((c) => c.status === "done" && c.date >= weekStart && c.date <= today)
    .map((c) => c.date);
  const weekClass = classifyWeek({
    weekStart,
    goalStartDate,
    targetDays,
    weeklyTarget,
    doneDates: weekDoneDates,
  });
  const doneThisWeek = weekClass.scoredDone;
  const extraThisWeek = weekClass.extraDone;
  let total = weeklyTarget ?? 0;
  let missedSoFar = 0;
  if (weeklyTarget == null) {
    for (let d = 0; d < 7; d++) {
      const date = addDays(weekStart, d);
      if (!targetDays.includes(dayOfWeekForDateString(date))) continue;
      // Don't count scheduled days from before the goal existed — the grid shows
      // them as rest, so the "X of N" headline must agree (a goal created
      // mid-week shouldn't read "0 of 5").
      if (date < goalStartDate) continue;
      total++;
      if (date < today && statusByDate[date] === undefined) {
        missedSoFar++;
      }
    }
  }

  const clampStart = goalStartDate > startDate ? goalStartDate : startDate;
  const stats = computeStats({
    startDate: clampStart,
    endDate: today,
    targetDays,
    checkIns,
    weeklyTarget,
  });
  const weekStatus = computeWeekStatus({
    doneThisWeek,
    total,
    isCount,
    currentStreak: stats.currentStreak,
    longestStreak: stats.longestStreak,
    streakUnit,
    doneCount: stats.doneCount,
    missedSoFar,
  });

  // The record + editor. Specific-day shows 6 recent weeks. Frequency shows the
  // live week; during the cross-week grace (Mon/Tue) last week still has
  // loggable days, so it stays a tappable grid row too (and drops out of the
  // read-only quota rails below). buildWeekRows is count-aware, so a locked
  // unlogged frequency day reads as a neutral rest cell, never a "miss".
  const builtWeeks = buildWeekRows({
    goalStartDate,
    today,
    targetDays,
    statusByDate,
    weeksToShow: isCount ? 2 : 6,
    isCount,
  });
  const weeks = isCount
    ? builtWeeks.filter((w) => w.isCurrent || w.cells.some((c) => c.editable))
    : builtWeeks;
  const anyEditable = weeks.some((w) => w.cells.some((c) => c.editable));

  // FullHistory receives the raw checkIns and builds its own calendar view.

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

  // Recent weeks for the frequency quota rows: drop any week already shown as a
  // live grid row above (the current week, plus last week while it's still in
  // its grace window), newest first, capped to a recent window.
  const gridWeekStarts = new Set(weeks.map((w) => w.weekStart));
  const pastWeeks = weeklyMet
    .filter((w) => !w.current && !gridWeekStarts.has(w.weekStart))
    .slice(-6)
    .reverse();

  const timePattern = computeTimePattern({
    entries: checkIns
      .filter((c) => c.status === "done")
      .map((c) => ({ createdAt: c.created_at, date: c.date })),
    timezone,
  });
  const insight = buildGoalInsight({
    typical: timePattern.typical,
    timedTotal: timePattern.total,
    currentStreak: stats.currentStreak,
    streakUnit,
    doneCount: stats.doneCount,
  });

  return (
    <>
      <div className="mb-8">
        <p className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-1">
          This week
        </p>
        <div className="flex items-center gap-5">
          <div>
            <p className="text-3xl font-light tracking-tight">
              {weekStatus.headline}
            </p>
            <p className="mt-1 text-sm max-w-[32ch]">{weekStatus.note}</p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <ProgressRing done={doneThisWeek} total={total} color={categoryColor} />
            {extraThisWeek > 0 ? (
              <span
                className="text-[11px] font-medium leading-none"
                style={{ color: categoryColor }}
              >
                +{extraThisWeek} extra
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-5">
          <WeekRows
            goalId={goalId}
            today={today}
            weeks={weeks}
            isCount={isCount}
            doneColor={categoryColor}
          />
        </div>

        {anyEditable ? (
          <p className="mt-2 text-xs text-[color:var(--muted)]">
            {isCount
              ? `Any open day counts toward this week's ${weeklyTarget}. Tap to mark done.`
              : "Tap an open day to mark done, or an off day to add an extra. Tap a done day to undo."}
          </p>
        ) : null}

        <p className="mt-4 text-xs text-[color:var(--muted)]">
          {weekStatus.secondary}
        </p>
      </div>

      {weeklyTarget != null && pastWeeks.length > 0 ? (
        <div className="mb-8">
          <h3 className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-3">
            Recent weeks
          </h3>
          <WeekQuotaRows
            weeks={pastWeeks}
            currentWeekStart={weekStart}
            weeklyTarget={weeklyTarget}
            doneColor={categoryColor}
          />
        </div>
      ) : null}

      <div className="mb-10">
        <FullHistory
          checkIns={checkIns}
          doneColor={categoryColor}
          goalStartDate={goalStartDate}
          targetDays={targetDays}
          weeklyTarget={weeklyTarget}
          today={today}
          historyStart={startDate}
        />
      </div>

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

function RecordSkeleton({ isCount }: { isCount: boolean }) {
  return (
    <div aria-busy>
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-3 w-16 mb-2" />
      <div className="mb-5 flex items-center gap-5">
        <div className="space-y-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-3 w-40" />
        </div>
        <Skeleton className="h-[54px] w-[54px] rounded-full" />
      </div>
      <Skeleton className="h-10 w-72" />
      {isCount ? (
        <div className="mt-8">
          <Skeleton className="h-3 w-24 mb-3" />
          <Skeleton className="h-8 w-full max-w-xs" />
        </div>
      ) : null}
    </div>
  );
}

function DocIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

// "09:00:00" (Postgres TIME) → "9:00am".
function formatReminder(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return formatTime(h, m);
}
