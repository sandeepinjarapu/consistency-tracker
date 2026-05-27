import { createClient } from "@/lib/supabase/server";
import { addDays, todayIn, isoWeekStart, dayOfWeekForDateString } from "@/lib/dates";
import { listReflections } from "@/lib/actions/reflections";
import ReflectionEditor from "@/components/reflection-editor";

const WEEKS_TO_SHOW = 12;

type WeekStats = {
  done: number;
  skipped: number;
  missed: number;
  skipReasons: Record<string, number>;
  notes: Array<{ date: string; goalName: string; note: string }>;
};

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

export default async function ReflectionsPage() {
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
  const currentWeekStart = isoWeekStart(today);
  const earliestWeekStart = addDays(currentWeekStart, -(WEEKS_TO_SHOW - 1) * 7);
  const earliestWindow = earliestWeekStart;
  const latestWindow = addDays(currentWeekStart, 6);

  // All active + archived goals (so historical weeks compute correctly)
  const { data: allGoals } = await supabase
    .from("goals")
    .select("id, name, target_days, created_at");
  const goals = (allGoals ?? []) as Array<{
    id: string;
    name: string;
    target_days: number[];
    created_at: string;
  }>;
  const goalById = new Map(goals.map((g) => [g.id, g]));

  // Check-ins across the window
  const { data: ciRaw } = await supabase
    .from("check_ins")
    .select("goal_id, date, status, skip_reason, note")
    .gte("date", earliestWindow)
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

  // Build week list
  const weeks: Array<{ start: string; end: string; isCurrent: boolean; stats: WeekStats }> = [];
  for (let i = 0; i < WEEKS_TO_SHOW; i++) {
    const start = addDays(currentWeekStart, -i * 7);
    const end = addDays(start, 6);
    const stats = computeWeekStats({ start, end, today, goals, checkIns, goalById });
    weeks.push({ start, end, isCurrent: i === 0, stats });
  }

  return (
    <section>
      <header className="mb-10">
        <h1 className="text-xl font-light tracking-tight">Weekly reflections</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Look back, write briefly, move forward. A few sentences each week beats a long entry once a month.
        </p>
      </header>

      <div className="space-y-10">
        {weeks.map((w) => {
          const reflection = reflectionByWeek.get(w.start) ?? null;
          const hasAnyActivity = w.stats.done + w.stats.skipped + w.stats.missed > 0;
          if (!w.isCurrent && !hasAnyActivity && !reflection) return null;
          return (
            <WeekCard
              key={w.start}
              start={w.start}
              end={w.end}
              isCurrent={w.isCurrent}
              stats={w.stats}
              reflection={reflection}
            />
          );
        })}
      </div>
    </section>
  );
}

function WeekCard({
  start,
  end,
  isCurrent,
  stats,
  reflection,
}: {
  start: string;
  end: string;
  isCurrent: boolean;
  stats: WeekStats;
  reflection: ReflectionRow | null;
}) {
  const total = stats.done + stats.skipped + stats.missed;
  const completion = total > 0 ? Math.round((stats.done / total) * 100) : 0;

  return (
    <article className="border border-[color:var(--border)] rounded-lg p-6">
      <header className="flex items-baseline justify-between mb-1 gap-4 flex-wrap">
        <h2 className="text-lg font-medium">
          {formatRange(start, end)}
          {isCurrent ? (
            <span className="ml-2 text-xs text-[color:var(--muted)] font-normal">· this week (in progress)</span>
          ) : null}
        </h2>
      </header>

      <p className="text-xs text-[color:var(--muted)] mb-6">
        {total === 0 ? (
          <>No check-ins recorded.</>
        ) : (
          <>
            {stats.done} done · {stats.skipped} skipped
            {stats.skipped > 0 ? ` (${formatReasons(stats.skipReasons)})` : ""} · {stats.missed} missed · {completion}% completion
          </>
        )}
      </p>

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

function computeWeekStats({
  start,
  end,
  today,
  goals,
  checkIns,
  goalById,
}: {
  start: string;
  end: string;
  today: string;
  goals: Array<{ id: string; target_days: number[]; created_at: string }>;
  checkIns: Array<{
    goal_id: string;
    date: string;
    status: "done" | "skipped";
    skip_reason: string | null;
    note: string | null;
  }>;
  goalById: Map<string, { name: string }>;
}): WeekStats {
  const out: WeekStats = { done: 0, skipped: 0, missed: 0, skipReasons: {}, notes: [] };

  // Filter check-ins to this week
  const inWeek = checkIns.filter((c) => c.date >= start && c.date <= end);
  for (const ci of inWeek) {
    if (ci.status === "done") out.done++;
    else if (ci.status === "skipped") {
      out.skipped++;
      const reason = ci.skip_reason ?? "other";
      out.skipReasons[reason] = (out.skipReasons[reason] ?? 0) + 1;
    }
    if (ci.note) {
      const goalName = goalById.get(ci.goal_id)?.name ?? "Goal";
      out.notes.push({ date: ci.date, goalName, note: ci.note });
    }
  }

  // Missed = target days in past that have no check-in
  const checkInKeys = new Set(inWeek.map((c) => `${c.goal_id}:${c.date}`));
  let cursor = start;
  while (cursor <= end && cursor <= today) {
    const dow = dayOfWeekForDateString(cursor);
    for (const g of goals) {
      const goalStart = g.created_at.slice(0, 10);
      if (cursor < goalStart) continue;
      if (cursor === today) continue; // today is still pending
      if (!g.target_days.includes(dow)) continue;
      if (!checkInKeys.has(`${g.id}:${cursor}`)) out.missed++;
    }
    cursor = addDays(cursor, 1);
  }

  // Sort notes by date
  out.notes.sort((a, b) => (a.date < b.date ? -1 : 1));
  return out;
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

