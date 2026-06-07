import { addDays, dayOfWeekForDateString } from "./dates";

/**
 * Per-day status for a goal in a given week, used by the WeekGrid visual.
 *  - done / skipped / missed: derived from check-ins (or absence of one)
 *  - no-target: this day-of-week isn't in the goal's target_days
 *  - before-goal: the day is before the goal was created
 *  - future: the day hasn't happened yet (today is treated as future too —
 *    it's still pending, not missed)
 */
export type GoalDayStatus =
  | "done"
  | "skipped"
  | "missed"
  | "extra" // an off-target done — evidence of showing up, never scored
  | "no-target"
  | "before-goal"
  | "future";

export type GoalWeekStats = {
  goalId: string;
  goalName: string;
  targetCount: number; // target days that actually fell within (createdAt..end) this week
  done: number;
  skipped: number;
  missed: number;
  // Off-target done check-ins this week — evidence of showing up, never scored.
  // Excluded from completion; used only to widen the "you showed up N times"
  // narrative count.
  extraDone: number;
  completion: number; // done / targetCount, 0..1 (0 if no targets this week)
  // A count goal's *first* week, when the goal was created after that week's
  // Monday: it never had a full week to hit its quota, so it's grace — excluded
  // from completion scoring (its check-ins still show as evidence). Specific
  // goals don't need this: their targetCount already only counts eligible days
  // on/after creation. Absent/false means "score normally".
  partial?: boolean;
  skipReasons: Record<string, number>;
  notes: Array<{ date: string; note: string }>;
  dailyStatus: GoalDayStatus[]; // length 7, indexed Mon..Sun
};

export type WeekStats = {
  done: number;
  skipped: number;
  missed: number;
  extraDone: number; // off-target dones across goals — evidence, never scored
  skipReasons: Record<string, number>;
  notes: Array<{ date: string; goalName: string; note: string }>;
  perGoal: GoalWeekStats[];
};

export type WeekTrend = {
  hasPrior: boolean;
  completionDelta: number | null; // percentage points, current minus prior
  doneDelta: number | null; // count diff
  skipDelta: number | null; // count diff
};

type CheckInRow = {
  goal_id: string;
  date: string;
  status: "done" | "skipped";
  skip_reason: string | null;
  note: string | null;
};

type GoalRow = {
  id: string;
  name: string;
  target_days: number[];
  created_at: string;
  weekly_target?: number | null;
};

/**
 * Build the full WeekStats for one ISO week (Mon..Sun). Today-pending days
 * count as "future" (not missed). Goals not yet created are skipped entirely.
 */
export function computeWeekStats({
  start,
  end,
  today,
  goals,
  checkIns,
}: {
  start: string;
  end: string;
  today: string;
  goals: GoalRow[];
  checkIns: CheckInRow[];
}): WeekStats {
  const inWeek = checkIns.filter((c) => c.date >= start && c.date <= end);
  const checkInByKey = new Map(
    inWeek.map((c) => [`${c.goal_id}:${c.date}`, c])
  );

  const perGoal: GoalWeekStats[] = [];
  for (const g of goals) {
    const goalStart = g.created_at.slice(0, 10);
    // Skip goals created after this week ended — they contribute nothing.
    if (goalStart > end) continue;

    // Count goals are scored by a weekly quota, not per-day compliance:
    // a non-done eligible day is neutral (not a miss), and completion is
    // measured against weekly_target rather than the number of target days.
    const weeklyTarget =
      typeof g.weekly_target === "number" ? g.weekly_target : null;
    const isCount = weeklyTarget !== null;

    const dailyStatus: GoalDayStatus[] = [];
    let done = 0;
    let skipped = 0;
    let missed = 0;
    let extraDone = 0;
    let targetCount = 0;
    const skipReasons: Record<string, number> = {};
    const notes: Array<{ date: string; note: string }> = [];

    let cursor = start;
    for (let i = 0; i < 7; i++) {
      const dow = dayOfWeekForDateString(cursor); // 0=Sun..6=Sat
      let status: GoalDayStatus;
      if (cursor > today) {
        status = "future";
      } else if (cursor < goalStart) {
        status = "before-goal";
      } else if (!g.target_days.includes(dow)) {
        // An off-target done is an extra: evidence of showing up, never scored;
        // it shows in the grid as a distinct "extra" cell, not a blank.
        if (checkInByKey.get(`${g.id}:${cursor}`)?.status === "done") {
          status = "extra";
          extraDone++;
        } else {
          status = "no-target";
        }
      } else {
        const ci = checkInByKey.get(`${g.id}:${cursor}`);
        if (ci?.status === "done") {
          status = "done";
          done++;
          if (!isCount) targetCount++;
        } else if (ci?.status === "skipped") {
          status = "skipped";
          skipped++;
          if (!isCount) targetCount++;
          const reason = ci.skip_reason ?? "other";
          skipReasons[reason] = (skipReasons[reason] ?? 0) + 1;
        } else if (cursor === today) {
          // today, no check-in yet — pending, not missed
          status = "future";
          if (!isCount) targetCount++;
        } else if (isCount) {
          // count goal — a non-done eligible day is neutral, not a miss
          status = "no-target";
        } else {
          status = "missed";
          missed++;
          targetCount++;
        }
        if (ci?.note) {
          notes.push({ date: ci.date, note: ci.note });
        }
      }
      dailyStatus.push(status);
      cursor = addDays(cursor, 1);
    }

    // For count goals, cap scored done at weeklyTarget and move over-quota
    // into extraDone. Over-quota is a week-level concept — daily cell states
    // stay as "done" because the order of check-ins is ambiguous under undo.
    if (isCount && weeklyTarget !== null && done > weeklyTarget) {
      extraDone += done - weeklyTarget;
      done = weeklyTarget;
    }

    const effectiveTargetCount =
      weeklyTarget !== null ? weeklyTarget : targetCount;
    const completion =
      weeklyTarget !== null
        ? Math.min(done / weeklyTarget, 1)
        : targetCount > 0
          ? done / targetCount
          : 0;

    perGoal.push({
      goalId: g.id,
      goalName: g.name,
      targetCount: effectiveTargetCount,
      done,
      skipped,
      missed,
      extraDone,
      completion,
      partial: isCount && goalStart > start,
      skipReasons,
      notes,
      dailyStatus,
    });
  }

  // Aggregates
  let aggDone = 0;
  let aggSkipped = 0;
  let aggMissed = 0;
  let aggExtra = 0;
  const aggSkipReasons: Record<string, number> = {};
  const aggNotes: Array<{ date: string; goalName: string; note: string }> = [];
  for (const g of perGoal) {
    aggDone += g.done;
    aggSkipped += g.skipped;
    aggMissed += g.missed;
    aggExtra += g.extraDone;
    for (const [r, n] of Object.entries(g.skipReasons)) {
      aggSkipReasons[r] = (aggSkipReasons[r] ?? 0) + n;
    }
    for (const n of g.notes) {
      aggNotes.push({ date: n.date, goalName: g.goalName, note: n.note });
    }
  }
  aggNotes.sort((a, b) => (a.date < b.date ? -1 : 1));

  return {
    done: aggDone,
    skipped: aggSkipped,
    missed: aggMissed,
    extraDone: aggExtra,
    skipReasons: aggSkipReasons,
    notes: aggNotes,
    perGoal,
  };
}

/**
 * The week's completion rate (0..1) for the Reflections surface, aggregated
 * across goals as sum(min(done, target)) / sum(target).
 *
 * Using each goal's own `targetCount` is what keeps this honest for count
 * goals: their target is the weekly quota, so extra skipped days don't inflate
 * the denominator (the old done/(done+skipped+missed) penalised count goals for
 * skips, which their day-by-day compliance is meant to ignore). For specific-day
 * goals targetCount == done+skipped+missed, so their number is unchanged. min()
 * caps an over-quota count goal at 100%.
 */
export function reflectionCompletionRate(stats: WeekStats): number {
  let done = 0;
  let target = 0;
  for (const g of stats.perGoal) {
    if (g.partial) continue; // count goal's partial first week is grace
    done += Math.min(g.done, g.targetCount);
    target += g.targetCount;
  }
  return target > 0 ? done / target : 0;
}

/**
 * Whether the week has at least one goal whose target should be scored. Drives
 * (a) whether a completed week is worth surfacing on the Reflections page and
 * (b) whether to show a completion %. A count goal with zero check-ins still
 * counts (an unmet quota is a meaningful week to reflect on), but a count
 * goal's partial first week is grace — it doesn't make a week scoreable on its
 * own, though its check-ins still show as evidence.
 */
export function weekHasScoreableTarget(stats: WeekStats): boolean {
  return stats.perGoal.some((g) => g.targetCount > 0 && !g.partial);
}

/**
 * Compute completion-rate / done / skipped deltas vs the prior week.
 * Comparable only when both weeks have a scoreable target (same rule the page
 * uses for visibility and the %). This means a count-goal week with zero
 * check-ins is a real 0% baseline you can step up from — but a partial-first
 * count-goal grace week is never a baseline.
 */
export function compareWeeks(
  current: WeekStats,
  prior: WeekStats | null
): WeekTrend {
  if (
    !prior ||
    !weekHasScoreableTarget(current) ||
    !weekHasScoreableTarget(prior)
  ) {
    return {
      hasPrior: false,
      completionDelta: null,
      doneDelta: null,
      skipDelta: null,
    };
  }
  const currentCompletion = reflectionCompletionRate(current);
  const priorCompletion = reflectionCompletionRate(prior);
  return {
    hasPrior: true,
    completionDelta: Math.round((currentCompletion - priorCompletion) * 100),
    doneDelta: current.done - prior.done,
    skipDelta: current.skipped - prior.skipped,
  };
}

export type Highlights = {
  strongest: GoalWeekStats | null;
  weakest: GoalWeekStats | null;
  // If there's a dominant skip reason for the weakest goal (>= 50% of its
  // skips), name it. Otherwise null.
  weakestDominantReason: string | null;
};

/**
 * Pick the strongest and weakest goal for the week. Edge cases:
 *  - Goals with zero targets this week are ignored (would div-by-zero).
 *  - If all eligible goals are at 100%, only strongest is returned.
 *  - If all eligible goals are at 0%, only weakest is returned.
 *  - If there's just one eligible goal, only strongest is returned.
 */
export function buildHighlights(stats: WeekStats): Highlights {
  const eligible = stats.perGoal.filter((g) => g.targetCount > 0 && !g.partial);
  if (eligible.length === 0) {
    return { strongest: null, weakest: null, weakestDominantReason: null };
  }
  const sorted = [...eligible].sort((a, b) => b.completion - a.completion);
  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];

  let strongest: GoalWeekStats | null = top;
  let weakest: GoalWeekStats | null = bottom;

  if (sorted.length === 1) {
    weakest = null;
  } else if (top.completion <= 0) {
    // Everyone at 0% — no "strongest" worth naming
    strongest = null;
  } else if (bottom.completion >= 1) {
    // Everyone at 100% — no "weakest" worth naming
    weakest = null;
  } else if (top.completion === bottom.completion) {
    // Tied in the middle — call out as strongest only
    weakest = null;
  }

  let weakestDominantReason: string | null = null;
  if (weakest && weakest.skipped > 0) {
    const entries = Object.entries(weakest.skipReasons).sort(
      (a, b) => b[1] - a[1]
    );
    if (entries.length > 0 && entries[0][1] / weakest.skipped >= 0.5) {
      weakestDominantReason = entries[0][0];
    }
  }

  return { strongest, weakest, weakestDominantReason };
}

// Phrasing for a dominant skip reason. "other" is intentionally omitted —
// we don't editorialize an unspecified reason.
const NARRATIVE_REASON: Record<string, string> = {
  travel: " — mostly to travel",
  illness: " — mostly to illness",
  mood: " — mostly to low mood",
};

/**
 * A humane, descriptive one-liner summarizing the week from data already
 * computed. Deliberately reflective, never prescriptive: it mirrors what
 * happened ("you showed up 4 times; writing was strongest") and never tells
 * the user what to do next. Returns null when there's nothing to reflect on
 * (no activity) — the card already renders "No check-ins recorded" then.
 */
export function buildWeeklyNarrative(
  stats: WeekStats,
  trend: WeekTrend | null,
  highlights: Highlights
): string | null {
  const total = stats.done + stats.skipped + stats.missed + stats.extraDone;
  if (total === 0) return null;

  const sentences: string[] = [];

  // 1. Showing-up clause. Counts all check-ins, scored plus extra — an extra is
  // still showing up, even though it never moves a score.
  const showedUp = stats.done + stats.extraDone;
  if (showedUp === 0) {
    sentences.push("A quiet week — nothing checked in.");
  } else {
    sentences.push(
      `You showed up ${showedUp} ${showedUp === 1 ? "time" : "times"} this week.`
    );
  }

  // 2. Strongest / weakest clause (descriptive, gentle on the weak one).
  const { strongest, weakest, weakestDominantReason } = highlights;
  if (strongest && weakest) {
    const reason = weakestDominantReason
      ? NARRATIVE_REASON[weakestDominantReason] ?? ""
      : "";
    sentences.push(
      `${strongest.goalName} was strongest; ${weakest.goalName} slipped${reason}.`
    );
  } else if (strongest) {
    sentences.push(`${strongest.goalName} led the week.`);
  }

  // 3. Trend clause — only when there's a comparable prior week.
  if (trend?.hasPrior && trend.completionDelta !== null) {
    if (trend.completionDelta > 0) sentences.push("A step up from last week.");
    else if (trend.completionDelta < 0)
      sentences.push("A quieter week than last.");
    else sentences.push("On par with last week.");
  }

  return sentences.join(" ");
}
