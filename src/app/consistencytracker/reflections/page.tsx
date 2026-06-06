import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getCurrentProfile } from "@/lib/supabase/current-user";
import { addDays, todayIn, isoWeekStart, dateInTimezone } from "@/lib/dates";
import { listReflections } from "@/lib/actions/reflections";
import {
  computeWeekStats,
  compareWeeks,
  buildHighlights,
  buildWeeklyNarrative,
  reflectionCompletionRate,
  weekHasScoreableTarget,
  type WeekStats,
  type WeekTrend,
  type Highlights,
} from "@/lib/reflection-stats";
import { listPartners, listPendingInvites } from "@/lib/actions/partners";
import ReflectionEditor, {
  type PartnerState,
} from "@/components/reflection-editor";
import WeekGrid from "@/components/week-grid";
import ReflectionNotes from "@/components/reflection-notes";

// Weeks shown by default and per "Show earlier weeks" step. The visible
// window grows via the ?weeks= search param so each request stays bounded.
const WEEKS_STEP = 12;
const WEEKS_MAX = 520; // ~10 years, a safety ceiling on the query window

type ReflectionRow = {
  id: string;
  week_start_date: string;
  continue_text: string | null;
  stop_text: string | null;
  improve_text: string | null;
  notes: string | null;
  visibility: "private" | "partner";
  updated_at: string;
};

export default async function ReflectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ weeks?: string }>;
}) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return null;

  const { weeks: weeksParam } = await searchParams;
  const parsed = Number.parseInt(weeksParam ?? "", 10);
  const weeksToShow = Math.min(
    Number.isFinite(parsed) && parsed > 0 ? parsed : WEEKS_STEP,
    WEEKS_MAX
  );

  const profile = await getCurrentProfile();
  const timezone = profile?.timezone ?? "UTC";
  const today = todayIn(timezone);
  const currentWeekStart = isoWeekStart(today);
  // Pull one extra week before earliest so we can compute trend for the
  // earliest displayed week.
  const earliestWeekStart = addDays(currentWeekStart, -weeksToShow * 7);
  const latestWindow = addDays(currentWeekStart, 6);

  // All active + archived goals (so historical weeks compute correctly)
  const { data: allGoals } = await supabase
    .from("goals")
    .select("id, name, target_days, created_at, weekly_target, motivation")
    .eq("user_id", user.id);
  const goals = (allGoals ?? []) as Array<{
    id: string;
    name: string;
    target_days: number[];
    created_at: string;
    weekly_target: number | null;
    motivation: string | null;
  }>;
  // The goal's "why this matters", looked up when a goal is the week's hardest —
  // so reflection can meet you with your own reason, not just a number.
  const motivationByGoal = new Map(goals.map((g) => [g.id, g.motivation]));

  // Check-ins across the window (extra week included for trend comparison)
  const { data: ciRaw } = await supabase
    .from("check_ins")
    .select("goal_id, date, status, skip_reason, note")
    .eq("user_id", user.id)
    .gte("date", earliestWeekStart)
    .lte("date", latestWindow);
  const checkIns = (ciRaw ?? []) as Array<{
    goal_id: string;
    date: string;
    status: "done" | "skipped";
    skip_reason: string | null;
    note: string | null;
  }>;

  const reflections = await listReflections();
  const reflectionByWeek = new Map(reflections.map((r) => [r.week_start_date, r]));

  // Whether the reflection visibility toggle should offer "Partner". Sharing is
  // only meaningful once a partner has accepted; before that we keep reflections
  // private and explain that sharing unlocks after partner setup.
  const [partners, pendingInvites] = await Promise.all([
    listPartners(),
    listPendingInvites(),
  ]);
  const partnerState: PartnerState =
    partners.length > 0
      ? "accepted"
      : pendingInvites.length > 0
        ? "pending"
        : "none";

  // Build week list — compute one extra week (oldest) just for trend comparison
  type Week = {
    start: string;
    end: string;
    stats: WeekStats;
  };
  // A goal's start date must be compared in the user's timezone, not the raw
  // UTC slice, so a goal created after local midnight isn't counted a day early.
  const localGoals = goals.map((g) => ({
    ...g,
    created_at: dateInTimezone(g.created_at, timezone),
  }));
  const weeks: Week[] = [];
  for (let i = 0; i <= weeksToShow; i++) {
    const start = addDays(currentWeekStart, -i * 7);
    const end = addDays(start, 6);
    const stats = computeWeekStats({
      start,
      end,
      today,
      goals: localGoals,
      checkIns,
    });
    weeks.push({ start, end, stats });
  }

  // Is there history older than the current window? Show "earlier weeks" only
  // if a goal was created — or a reflection written — before it. Uses
  // already-fetched data (no extra query).
  const oldestGoalStart = localGoals.reduce<string | null>(
    (min, g) => {
      const d = g.created_at.slice(0, 10);
      return min === null || d < min ? d : min;
    },
    null
  );
  const oldestReflectionWeek = reflections.length
    ? reflections[reflections.length - 1].week_start_date
    : null;
  const hasOlder =
    weeksToShow < WEEKS_MAX &&
    ((oldestGoalStart !== null && oldestGoalStart < earliestWeekStart) ||
      (oldestReflectionWeek !== null && oldestReflectionWeek < earliestWeekStart));

  // The current week leads as a "here's your week" hero; completed weeks
  // collapse into a quiet, expandable list below (skipping empty ones).
  const visibleWeeks = weeks.slice(0, weeksToShow);
  const currentWeek = visibleWeeks[0] ?? null;
  const statsByWeekStart = new Map(weeks.map((w) => [w.start, w.stats]));
  const pastWeeks = visibleWeeks.slice(1).filter((w) => {
    const active = w.stats.done + w.stats.skipped + w.stats.missed > 0;
    // Also surface weeks with a scoreable target but no day-level activity —
    // e.g. a count goal you didn't touch all week is worth reflecting on, even
    // though it logs no done/skipped/missed days.
    return active || weekHasScoreableTarget(w.stats) || reflectionByWeek.has(w.start);
  });

  return (
    <section>
      <header className="mb-10">
        <h1 className="text-xl font-light tracking-tight">Weekly reflections</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Look back, write briefly, move forward. A few sentences each week beats a long entry once a month.
        </p>
      </header>

      {currentWeek ? (
        <CurrentWeekHero
          start={currentWeek.start}
          end={currentWeek.end}
          stats={currentWeek.stats}
          highlights={buildHighlights(currentWeek.stats)}
          reflection={reflectionByWeek.get(currentWeek.start) ?? null}
          motivationByGoal={motivationByGoal}
          partnerState={partnerState}
        />
      ) : null}

      {pastWeeks.length > 0 ? (
        <div className="mt-12">
          <h2 className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-3">
            Earlier weeks
          </h2>
          <div>
            {pastWeeks.map((w) => {
              const prior = statsByWeekStart.get(addDays(w.start, -7)) ?? null;
              return (
                <PastWeek
                  key={w.start}
                  start={w.start}
                  end={w.end}
                  stats={w.stats}
                  trend={compareWeeks(w.stats, prior)}
                  highlights={buildHighlights(w.stats)}
                  reflection={reflectionByWeek.get(w.start) ?? null}
                  motivationByGoal={motivationByGoal}
                  partnerState={partnerState}
                />
              );
            })}
          </div>
        </div>
      ) : null}

      {hasOlder ? (
        <div className="mt-10 text-center">
          <Link
            href={`?weeks=${weeksToShow + WEEKS_STEP}`}
            className="text-sm underline text-[color:var(--muted)] hover:text-black"
          >
            Show earlier weeks
          </Link>
        </div>
      ) : null}
    </section>
  );
}

// The current week as a "here's your week" hero: a human narrative leads,
// then the shared body (your words, the why behind the hardest goal, the
// quiet numbers, the grid, and the prompt). No box — it's the moment, not a
// list item.
function CurrentWeekHero({
  start,
  end,
  stats,
  highlights,
  reflection,
  motivationByGoal,
  partnerState,
}: {
  start: string;
  end: string;
  stats: WeekStats;
  highlights: Highlights;
  reflection: ReflectionRow | null;
  motivationByGoal: Map<string, string | null>;
  partnerState: PartnerState;
}) {
  const narrative = buildWeeklyNarrative(stats, null, highlights);
  return (
    <section>
      <p className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-2">
        This week · {formatRange(start, end)} · in progress
      </p>
      <p className="text-2xl font-light tracking-tight leading-snug mb-6 max-w-prose">
        {narrative ??
          "Log a few check-ins this week, then this becomes your read on what helped and what got in the way."}
      </p>
      <WeekDetailBody
        weekStart={start}
        stats={stats}
        highlights={highlights}
        reflection={reflection}
        motivationByGoal={motivationByGoal}
        partnerState={partnerState}
        inProgress
      />
    </section>
  );
}

// A completed week, collapsed to a summary row that expands in place. Uses a
// native <details> so it stays server-rendered (no client state).
function PastWeek({
  start,
  end,
  stats,
  trend,
  highlights,
  reflection,
  motivationByGoal,
  partnerState,
}: {
  start: string;
  end: string;
  stats: WeekStats;
  trend: WeekTrend | null;
  highlights: Highlights;
  reflection: ReflectionRow | null;
  motivationByGoal: Map<string, string | null>;
  partnerState: PartnerState;
}) {
  const total = stats.done + stats.skipped + stats.missed;
  const scoreable = weekHasScoreableTarget(stats);
  const completion = Math.round(reflectionCompletionRate(stats) * 100);
  const hasReflection = Boolean(
    reflection &&
      (reflection.continue_text ||
        reflection.stop_text ||
        reflection.improve_text ||
        reflection.notes)
  );
  const narrative = buildWeeklyNarrative(stats, trend, highlights);
  return (
    <details className="group border-b border-[color:var(--border)]">
      <summary className="flex items-center justify-between gap-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden py-3 hover:text-black">
        <span className="text-sm font-medium">
          {formatRange(start, end)}
          {hasReflection ? (
            <span className="ml-2 text-xs font-normal text-[color:var(--muted)]">
              · reflected
            </span>
          ) : null}
        </span>
        <span className="flex items-center gap-2 text-xs text-[color:var(--muted)] tabular-nums">
          <span>
            {scoreable
              ? `${stats.done} done · ${completion}%`
              : total > 0
                ? `${stats.done} done`
                : "no activity"}
          </span>
          <span aria-hidden className="transition-transform group-open:rotate-180">
            ▾
          </span>
        </span>
      </summary>
      <div className="pb-6 pt-1">
        {narrative ? (
          <p className="text-base mb-4 leading-relaxed">{narrative}</p>
        ) : null}
        <WeekDetailBody
          weekStart={start}
          stats={stats}
          highlights={highlights}
          reflection={reflection}
          motivationByGoal={motivationByGoal}
          partnerState={partnerState}
          inProgress={false}
        />
      </div>
    </details>
  );
}

// Shared inner content for the hero and an expanded past week: human content
// first (your own words; the "why" behind the goal that's hardest), then the
// quiet numbers, the grid, and the writing prompt anchored to the week.
function WeekDetailBody({
  weekStart,
  stats,
  highlights,
  reflection,
  motivationByGoal,
  partnerState,
  inProgress,
}: {
  weekStart: string;
  stats: WeekStats;
  highlights: Highlights;
  reflection: ReflectionRow | null;
  motivationByGoal: Map<string, string | null>;
  partnerState: PartnerState;
  // The current week is still open: show evidence of showing up, not a
  // mid-week completion grade (a count goal at 2-of-5 on Wednesday isn't 40%
  // "complete" — the week isn't over).
  inProgress: boolean;
}) {
  const total = stats.done + stats.skipped + stats.missed;
  const scoreable = weekHasScoreableTarget(stats);
  const completion = Math.round(reflectionCompletionRate(stats) * 100);
  const { strongest, weakest } = highlights;
  const weakestMotivation = weakest
    ? motivationByGoal.get(weakest.goalId) ?? null
    : null;

  return (
    <>
      {weakest && weakestMotivation ? (
        <div className="mb-6 border-l-2 border-[color:var(--border)] pl-4">
          <p className="text-sm">
            <span className="font-medium">{weakest.goalName}</span> has been the
            hard one.
          </p>
          <p className="mt-1 text-sm italic text-[color:var(--muted)]">
            You started it because: &ldquo;{weakestMotivation}&rdquo;
          </p>
        </div>
      ) : null}

      {stats.notes.length > 0 ? (
        <div className="mb-6">
          <h3 className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-2">
            In your own words
          </h3>
          <ReflectionNotes
            notes={stats.notes.map((n) => ({
              note: n.note,
              goalName: n.goalName,
              dateLabel: shortDate(n.date),
            }))}
          />
        </div>
      ) : null}

      <p className="text-xs text-[color:var(--muted)] mb-6">
        {total === 0 ? (
          <>No check-ins recorded.</>
        ) : (
          <>
            {stats.done} done · {stats.skipped} skipped
            {stats.skipped > 0 ? ` (${formatReasons(stats.skipReasons)})` : ""} ·{" "}
            {stats.missed} missed
            {!inProgress && scoreable ? ` · ${completion}% completion` : ""}
          </>
        )}
      </p>

      {stats.perGoal.length > 0 ? (
        <div className="mb-6">
          <WeekGrid perGoal={stats.perGoal} />
        </div>
      ) : null}

      <ReflectionEditor
        weekStartDate={weekStart}
        initial={reflection}
        partnerState={partnerState}
        continueHint={
          strongest
            ? `${strongest.goalName} is working. What's making it click?`
            : undefined
        }
        improveHint={
          weakest
            ? `${weakest.goalName} is the hard one. What would help?`
            : undefined
        }
      />
    </>
  );
}

function formatRange(start: string, end: string): string {
  const s = parseDate(start);
  const e = parseDate(end);
  const sameMonth = s.getUTCMonth() === e.getUTCMonth();
  const month = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  if (sameMonth) {
    return `${month(s)} ${s.getUTCDate()} – ${e.getUTCDate()}, ${e.getUTCFullYear()}`;
  }
  return `${month(s)} ${s.getUTCDate()} – ${month(e)} ${e.getUTCDate()}, ${e.getUTCFullYear()}`;
}

function shortDate(d: string): string {
  return parseDate(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function parseDate(d: string): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

function formatReasons(reasons: Record<string, number>): string {
  const labels: Record<string, string> = {
    travel: "travel",
    illness: "illness",
    mood: "mood",
    other: "other",
  };
  return Object.entries(reasons)
    .map(([r, n]) => `${labels[r] ?? r} × ${n}`)
    .join(", ");
}

