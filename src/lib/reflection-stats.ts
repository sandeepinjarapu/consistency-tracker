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
  completion: number; // done / targetCount, 0..1 (0 if no targets this week)
  skipReasons: Record<string, number>;
  notes: Array<{ date: string; note: string }>;
  dailyStatus: GoalDayStatus[]; // length 7, indexed Mon..Sun
};

export type WeekStats = {
  done: number;
  skipped: number;
  missed: number;
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
        status = "no-target";
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
      completion,
      skipReasons,
      notes,
      dailyStatus,
    });
  }

  // Aggregates
  let aggDone = 0;
  let aggSkipped = 0;
  let aggMissed = 0;
  const aggSkipReasons: Record<string, number> = {};
  const aggNotes: Array<{ date: string; goalName: string; note: string }> = [];
  for (const g of perGoal) {
    aggDone += g.done;
    aggSkipped += g.skipped;
    aggMissed += g.missed;
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
    skipReasons: aggSkipReasons,
    notes: aggNotes,
    perGoal,
  };
}

/**
 * Compute completion-rate / done / skipped deltas vs the prior week.
 * Returns hasPrior=false if the prior week had no activity at all
 * (comparing to a zero-baseline isn't meaningful).
 */
export function compareWeeks(
  current: WeekStats,
  prior: WeekStats | null
): WeekTrend {
  if (!prior) {
    return {
      hasPrior: false,
      completionDelta: null,
      doneDelta: null,
      skipDelta: null,
    };
  }
  const currentTotal = current.done + current.skipped + current.missed;
  const priorTotal = prior.done + prior.skipped + prior.missed;
  if (priorTotal === 0) {
    return {
      hasPrior: false,
      completionDelta: null,
      doneDelta: null,
      skipDelta: null,
    };
  }
  const currentCompletion = currentTotal > 0 ? current.done / currentTotal : 0;
  const priorCompletion = prior.done / priorTotal;
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
  const eligible = stats.perGoal.filter((g) => g.targetCount > 0);
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
