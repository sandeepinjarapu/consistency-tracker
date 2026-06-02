import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getCurrentProfile } from "@/lib/supabase/current-user";
import { addDays, todayIn, isoWeekStart } from "@/lib/dates";
import { listReflections } from "@/lib/actions/reflections";
import {
  computeWeekStats,
  compareWeeks,
  buildHighlights,
  type WeekStats,
  type WeekTrend,
  type Highlights,
} from "@/lib/reflection-stats";
import ReflectionEditor from "@/components/reflection-editor";
import WeekGrid from "@/components/week-grid";

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
    .select("id, name, target_days, created_at, weekly_target")
    .eq("user_id", user.id);
  const goals = (allGoals ?? []) as Array<{
    id: string;
    name: string;
    target_days: number[];
    created_at: string;
    weekly_target: number | null;
  }>;

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

  // Build week list — compute one extra week (oldest) just for trend comparison
  type Week = {
    start: string;
    end: string;
    isCurrent: boolean;
    stats: WeekStats;
  };
  const weeks: Week[] = [];
  for (let i = 0; i <= weeksToShow; i++) {
    const start = addDays(currentWeekStart, -i * 7);
    const end = addDays(start, 6);
    const stats = computeWeekStats({ start, end, today, goals, checkIns });
    weeks.push({ start, end, isCurrent: i === 0, stats });
  }

  // Is there history older than the current window? Show "earlier weeks" only
  // if a goal was created — or a reflection written — before it. Uses
  // already-fetched data (no extra query).
  const oldestGoalStart = goals.reduce<string | null>(
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

  return (
    <section>
      <header className="mb-10">
        <h1 className="text-xl font-light tracking-tight">Weekly reflections</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Look back, write briefly, move forward. A few sentences each week beats a long entry once a month.
        </p>
      </header>

      <div className="space-y-10">
        {weeks.slice(0, weeksToShow).map((w, idx) => {
          const reflection = reflectionByWeek.get(w.start) ?? null;
          const hasAnyActivity = w.stats.done + w.stats.skipped + w.stats.missed > 0;
          if (!w.isCurrent && !hasAnyActivity && !reflection) return null;

          // Trend vs prior week — only meaningful for completed weeks.
          const prior = weeks[idx + 1]?.stats ?? null;
          const trend = w.isCurrent ? null : compareWeeks(w.stats, prior);

          const highlights = buildHighlights(w.stats);

          return (
            <WeekCard
              key={w.start}
              start={w.start}
              end={w.end}
              isCurrent={w.isCurrent}
              stats={w.stats}
              trend={trend}
              highlights={highlights}
              reflection={reflection}
            />
          );
        })}
      </div>

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

function WeekCard({
  start,
  end,
  isCurrent,
  stats,
  trend,
  highlights,
  reflection,
}: {
  start: string;
  end: string;
  isCurrent: boolean;
  stats: WeekStats;
  trend: WeekTrend | null;
  highlights: Highlights;
  reflection: ReflectionRow | null;
}) {
  const total = stats.done + stats.skipped + stats.missed;
  const completion = total > 0 ? Math.round((stats.done / total) * 100) : 0;
  const highlightText = formatHighlights(highlights);

  return (
    <article className="border border-[color:var(--border)] rounded-lg p-6">
      <header className="flex items-baseline justify-between mb-1 gap-4 flex-wrap">
        <h2 className="text-lg font-medium">
          {formatRange(start, end)}
          {isCurrent ? (
            <span className="ml-2 text-xs text-[color:var(--muted)] font-normal">· this week (in progress)</span>
          ) : null}
        </h2>
        {trend?.hasPrior ? (
          <span className="text-xs text-[color:var(--muted)] tabular-nums">
            {formatTrend(trend)}
          </span>
        ) : null}
      </header>

      <p className="text-xs text-[color:var(--muted)] mb-4">
        {total === 0 ? (
          <>No check-ins recorded.</>
        ) : (
          <>
            {stats.done} done · {stats.skipped} skipped
            {stats.skipped > 0 ? ` (${formatReasons(stats.skipReasons)})` : ""} · {stats.missed} missed · {completion}% completion
          </>
        )}
      </p>

      {highlightText ? (
        <p className="text-sm mb-6 leading-relaxed">{highlightText}</p>
      ) : null}

      {stats.perGoal.length > 0 ? (
        <div className="mb-6">
          <WeekGrid perGoal={stats.perGoal} />
        </div>
      ) : null}

      {stats.notes.length > 0 ? (
        <div className="mb-6">
          <h3 className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-2">
            Notes from check-ins
          </h3>
          <ul className="space-y-1 text-sm">
            {stats.notes.map((n, i) => (
              <li key={i} className="text-[color:var(--muted)]">
                <span className="italic">&ldquo;{n.note}&rdquo;</span> — {n.goalName}, {shortDate(n.date)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ReflectionEditor weekStartDate={start} initial={reflection} />
    </article>
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

function formatTrend(trend: WeekTrend): string {
  const parts: string[] = [];
  if (trend.completionDelta !== null) {
    if (trend.completionDelta > 0) parts.push(`↑ ${trend.completionDelta}% completion`);
    else if (trend.completionDelta < 0) parts.push(`↓ ${Math.abs(trend.completionDelta)}% completion`);
    else parts.push(`= completion`);
  }
  if (trend.doneDelta !== null && trend.doneDelta !== 0) {
    parts.push(`${trend.doneDelta > 0 ? "+" : ""}${trend.doneDelta} done`);
  }
  if (trend.skipDelta !== null && trend.skipDelta !== 0) {
    parts.push(`${trend.skipDelta > 0 ? "+" : ""}${trend.skipDelta} skipped`);
  }
  return parts.length > 0 ? parts.join(" · ") + " vs last week" : "";
}

function formatHighlights(h: Highlights): string | null {
  const REASON_LABELS: Record<string, string> = {
    travel: "mostly travel",
    illness: "mostly illness",
    mood: "mostly mood",
    other: "mostly other",
  };
  const parts: string[] = [];
  if (h.strongest) {
    parts.push(
      `Strongest: ${h.strongest.goalName} (${h.strongest.done}/${h.strongest.targetCount})`
    );
  }
  if (h.weakest) {
    const reason = h.weakestDominantReason
      ? `, ${REASON_LABELS[h.weakestDominantReason] ?? h.weakestDominantReason}`
      : "";
    parts.push(
      `Weakest: ${h.weakest.goalName} (${h.weakest.done}/${h.weakest.targetCount}${reason})`
    );
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}
