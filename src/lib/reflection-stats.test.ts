import { describe, it, expect } from "vitest";
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
  type GoalWeekStats,
} from "./reflection-stats";

// Week: Mon 2024-01-15 .. Sun 2024-01-21
const WEEK = { start: "2024-01-15", end: "2024-01-21" };
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const TODAY_AFTER_WEEK = "2024-02-01"; // far in the future so all 7 days are past

function goal(id: string, name: string, createdAt = "2024-01-01T00:00:00Z") {
  return { id, name, target_days: ALL_DAYS, created_at: createdAt };
}

describe("computeWeekStats", () => {
  it("returns empty perGoal when there are no goals", () => {
    const r = computeWeekStats({
      ...WEEK,
      today: TODAY_AFTER_WEEK,
      goals: [],
      checkIns: [],
    });
    expect(r.perGoal).toEqual([]);
    expect(r.done).toBe(0);
    expect(r.missed).toBe(0);
  });

  it("counts done check-ins per goal and in aggregate", () => {
    const r = computeWeekStats({
      ...WEEK,
      today: TODAY_AFTER_WEEK,
      goals: [goal("g1", "Writing"), goal("g2", "Gym")],
      checkIns: [
        { goal_id: "g1", date: "2024-01-15", status: "done", skip_reason: null, note: null },
        { goal_id: "g1", date: "2024-01-16", status: "done", skip_reason: null, note: null },
        { goal_id: "g2", date: "2024-01-15", status: "skipped", skip_reason: "travel", note: null },
      ],
    });
    expect(r.done).toBe(2);
    expect(r.skipped).toBe(1);
    expect(r.missed).toBe(5 + 6); // g1: 5 missed, g2: 6 missed
    const g1 = r.perGoal.find((g) => g.goalId === "g1")!;
    expect(g1.done).toBe(2);
    expect(g1.missed).toBe(5);
    expect(g1.targetCount).toBe(7);
    const g2 = r.perGoal.find((g) => g.goalId === "g2")!;
    expect(g2.skipped).toBe(1);
    expect(g2.skipReasons).toEqual({ travel: 1 });
  });

  it("dailyStatus is length 7 in Mon..Sun order", () => {
    const r = computeWeekStats({
      ...WEEK,
      today: TODAY_AFTER_WEEK,
      goals: [goal("g1", "Writing")],
      checkIns: [
        { goal_id: "g1", date: "2024-01-15", status: "done", skip_reason: null, note: null }, // Mon
        { goal_id: "g1", date: "2024-01-17", status: "skipped", skip_reason: "mood", note: null }, // Wed
      ],
    });
    const g1 = r.perGoal[0];
    expect(g1.dailyStatus).toHaveLength(7);
    expect(g1.dailyStatus[0]).toBe("done"); // Mon
    expect(g1.dailyStatus[1]).toBe("missed"); // Tue
    expect(g1.dailyStatus[2]).toBe("skipped"); // Wed
    expect(g1.dailyStatus[3]).toBe("missed"); // Thu
    expect(g1.dailyStatus[6]).toBe("missed"); // Sun
  });

  it("marks days before goal creation as before-goal (not missed)", () => {
    const r = computeWeekStats({
      ...WEEK,
      today: TODAY_AFTER_WEEK,
      // Goal created mid-week on Wednesday 2024-01-17
      goals: [goal("g1", "Writing", "2024-01-17T00:00:00Z")],
      checkIns: [],
    });
    const g1 = r.perGoal[0];
    expect(g1.dailyStatus[0]).toBe("before-goal"); // Mon
    expect(g1.dailyStatus[1]).toBe("before-goal"); // Tue
    expect(g1.dailyStatus[2]).toBe("missed"); // Wed (goal exists, target day, no check-in)
    expect(g1.dailyStatus[6]).toBe("missed"); // Sun
    expect(g1.missed).toBe(5); // Wed..Sun
    expect(g1.targetCount).toBe(5); // only Wed..Sun count
  });

  it("today and beyond are future (not missed)", () => {
    const r = computeWeekStats({
      ...WEEK,
      today: "2024-01-17", // Wed
      goals: [goal("g1", "Writing")],
      checkIns: [
        { goal_id: "g1", date: "2024-01-15", status: "done", skip_reason: null, note: null },
        // Tue (Jan 16) missing → missed
        // Wed (Jan 17) = today, no check-in → future (pending)
      ],
    });
    const g1 = r.perGoal[0];
    expect(g1.dailyStatus[0]).toBe("done");
    expect(g1.dailyStatus[1]).toBe("missed");
    expect(g1.dailyStatus[2]).toBe("future"); // today
    expect(g1.dailyStatus[3]).toBe("future"); // Thu
    expect(g1.missed).toBe(1); // only Tue
    expect(g1.targetCount).toBe(3); // Mon (done), Tue (missed), Wed (today-pending)
  });

  it("non-target days are no-target, not missed", () => {
    const r = computeWeekStats({
      ...WEEK,
      today: TODAY_AFTER_WEEK,
      goals: [{ id: "g1", name: "Weekday writing", target_days: [1, 2, 3, 4, 5], created_at: "2024-01-01T00:00:00Z" }],
      checkIns: [],
    });
    const g1 = r.perGoal[0];
    // Mon-Fri (idx 0..4) are missed; Sat-Sun (idx 5,6) are no-target
    expect(g1.dailyStatus[0]).toBe("missed");
    expect(g1.dailyStatus[5]).toBe("no-target");
    expect(g1.dailyStatus[6]).toBe("no-target");
    expect(g1.missed).toBe(5);
    expect(g1.targetCount).toBe(5);
  });

  it("collects notes per goal and aggregates them with goal names", () => {
    const r = computeWeekStats({
      ...WEEK,
      today: TODAY_AFTER_WEEK,
      goals: [goal("g1", "Writing"), goal("g2", "Gym")],
      checkIns: [
        { goal_id: "g1", date: "2024-01-15", status: "done", skip_reason: null, note: "morning flow" },
        { goal_id: "g2", date: "2024-01-16", status: "skipped", skip_reason: "mood", note: "exhausted" },
      ],
    });
    expect(r.notes).toHaveLength(2);
    expect(r.notes[0].goalName).toBe("Writing");
    expect(r.notes[1].goalName).toBe("Gym");
  });

  it("count goals: completion is done/weekly_target and gaps aren't missed", () => {
    const r = computeWeekStats({
      ...WEEK,
      today: TODAY_AFTER_WEEK,
      goals: [
        {
          id: "g1",
          name: "Workouts",
          target_days: [1, 2, 3, 4, 5], // weekday eligible window
          created_at: "2024-01-01T00:00:00Z",
          weekly_target: 3,
        },
      ],
      checkIns: [
        { goal_id: "g1", date: "2024-01-15", status: "done", skip_reason: null, note: null }, // Mon
        { goal_id: "g1", date: "2024-01-16", status: "done", skip_reason: null, note: null }, // Tue
      ],
    });
    const g1 = r.perGoal[0];
    expect(g1.done).toBe(2);
    expect(g1.missed).toBe(0); // count goal — no per-day misses
    expect(g1.targetCount).toBe(3); // the weekly quota, not the day count
    expect(g1.completion).toBeCloseTo(2 / 3, 5);
    expect(g1.dailyStatus[0]).toBe("done"); // Mon
    expect(g1.dailyStatus[1]).toBe("done"); // Tue
    expect(g1.dailyStatus[2]).toBe("no-target"); // Wed — eligible but not done → neutral
    expect(g1.dailyStatus.includes("missed")).toBe(false);
  });

  it("count goals: completion caps at 1 when the quota is exceeded", () => {
    const r = computeWeekStats({
      ...WEEK,
      today: TODAY_AFTER_WEEK,
      goals: [
        {
          id: "g1",
          name: "Steps",
          target_days: ALL_DAYS,
          created_at: "2024-01-01T00:00:00Z",
          weekly_target: 2,
        },
      ],
      checkIns: [
        { goal_id: "g1", date: "2024-01-15", status: "done", skip_reason: null, note: null },
        { goal_id: "g1", date: "2024-01-16", status: "done", skip_reason: null, note: null },
        { goal_id: "g1", date: "2024-01-17", status: "done", skip_reason: null, note: null },
      ],
    });
    expect(r.perGoal[0].done).toBe(3);
    expect(r.perGoal[0].completion).toBe(1); // capped
  });
});

describe("reflectionCompletionRate", () => {
  const ALL = [0, 1, 2, 3, 4, 5, 6];

  it("specific-day goal: unchanged (done over eligible days)", () => {
    // 2 done, 1 skipped, 4 missed → target 7, done 2 → 2/7 (same as the old
    // done/(done+skipped+missed) for specific goals).
    const stats = computeWeekStats({
      ...WEEK,
      today: TODAY_AFTER_WEEK,
      goals: [goal("g1", "Writing")],
      checkIns: [
        { goal_id: "g1", date: "2024-01-15", status: "done", skip_reason: null, note: null },
        { goal_id: "g1", date: "2024-01-16", status: "done", skip_reason: null, note: null },
        { goal_id: "g1", date: "2024-01-17", status: "skipped", skip_reason: "x", note: null },
      ],
    });
    expect(reflectionCompletionRate(stats)).toBeCloseTo(2 / 7, 5);
  });

  it("count goal: extra skips do NOT lower completion (the fix)", () => {
    const stats = computeWeekStats({
      ...WEEK,
      today: TODAY_AFTER_WEEK,
      goals: [
        { id: "c1", name: "Gym", target_days: ALL, created_at: "2024-01-01T00:00:00Z", weekly_target: 3 },
      ],
      checkIns: [
        { goal_id: "c1", date: "2024-01-15", status: "done", skip_reason: null, note: null },
        { goal_id: "c1", date: "2024-01-16", status: "done", skip_reason: null, note: null },
        { goal_id: "c1", date: "2024-01-17", status: "skipped", skip_reason: "rest", note: null },
        { goal_id: "c1", date: "2024-01-18", status: "skipped", skip_reason: "rest", note: null },
      ],
    });
    // done 2, skipped 2, target = weekly_target 3 → min(2,3)/3 = 2/3.
    // Old done/(done+skipped+missed) would have been 2/4 = 0.5.
    expect(reflectionCompletionRate(stats)).toBeCloseTo(2 / 3, 5);
  });

  it("count goal: caps at 1 when the quota is exceeded", () => {
    const stats = computeWeekStats({
      ...WEEK,
      today: TODAY_AFTER_WEEK,
      goals: [
        { id: "c1", name: "Water", target_days: ALL, created_at: "2024-01-01T00:00:00Z", weekly_target: 2 },
      ],
      checkIns: [
        { goal_id: "c1", date: "2024-01-15", status: "done", skip_reason: null, note: null },
        { goal_id: "c1", date: "2024-01-16", status: "done", skip_reason: null, note: null },
        { goal_id: "c1", date: "2024-01-17", status: "done", skip_reason: null, note: null },
      ],
    });
    expect(reflectionCompletionRate(stats)).toBe(1);
  });

  it("mixed goals: target-weighted across goals", () => {
    const stats = computeWeekStats({
      ...WEEK,
      today: TODAY_AFTER_WEEK,
      goals: [
        goal("g1", "Writing"), // specific, 7 eligible days
        { id: "c1", name: "Gym", target_days: ALL, created_at: "2024-01-01T00:00:00Z", weekly_target: 3 },
      ],
      checkIns: [
        { goal_id: "g1", date: "2024-01-15", status: "done", skip_reason: null, note: null }, // 1 of 7
        { goal_id: "c1", date: "2024-01-15", status: "done", skip_reason: null, note: null },
        { goal_id: "c1", date: "2024-01-16", status: "done", skip_reason: null, note: null },
        { goal_id: "c1", date: "2024-01-17", status: "done", skip_reason: null, note: null }, // 3 of 3
      ],
    });
    // sum(min(done,target)) = 1 + 3 = 4; sum(target) = 7 + 3 = 10 → 0.4
    expect(reflectionCompletionRate(stats)).toBeCloseTo(0.4, 5);
  });

  it("returns 0 when there are no eligible targets", () => {
    expect(
      reflectionCompletionRate({
        done: 0,
        skipped: 0,
        missed: 0,
        skipReasons: {},
        notes: [],
        perGoal: [],
      })
    ).toBe(0);
  });

  it("excludes a count goal's partial first week (grace)", () => {
    const stats = computeWeekStats({
      ...WEEK,
      today: TODAY_AFTER_WEEK,
      goals: [
        // created Thursday of this week → it never had a full week for its quota
        { id: "c1", name: "Gym", target_days: ALL, created_at: "2024-01-18T00:00:00Z", weekly_target: 5 },
      ],
      checkIns: [
        { goal_id: "c1", date: "2024-01-18", status: "done", skip_reason: null, note: null },
        { goal_id: "c1", date: "2024-01-19", status: "done", skip_reason: null, note: null },
      ],
    });
    // The only goal is a partial-first count week → excluded → denominator 0.
    expect(reflectionCompletionRate(stats)).toBe(0);
  });

  it("a partial-first count goal doesn't drag a week with a full goal", () => {
    const allDone = ["15", "16", "17", "18", "19", "20", "21"].map((d) => ({
      goal_id: "g1",
      date: `2024-01-${d}`,
      status: "done" as const,
      skip_reason: null,
      note: null,
    }));
    const stats = computeWeekStats({
      ...WEEK,
      today: TODAY_AFTER_WEEK,
      goals: [
        goal("g1", "Writing"), // full specific goal, done every day → 7/7
        { id: "c1", name: "Gym", target_days: ALL, created_at: "2024-01-18T00:00:00Z", weekly_target: 5 },
      ],
      checkIns: [
        ...allDone,
        { goal_id: "c1", date: "2024-01-19", status: "done", skip_reason: null, note: null },
      ],
    });
    // g1 = 7/7; c1 partial → excluded. Aggregate stays 1.0.
    expect(reflectionCompletionRate(stats)).toBe(1);
  });
});

describe("weekHasScoreableTarget", () => {
  const ALL = [0, 1, 2, 3, 4, 5, 6];

  it("true for a count goal with zero check-ins across a full week", () => {
    const stats = computeWeekStats({
      ...WEEK,
      today: TODAY_AFTER_WEEK,
      goals: [
        { id: "c1", name: "Gym", target_days: ALL, created_at: "2024-01-01T00:00:00Z", weekly_target: 5 },
      ],
      checkIns: [],
    });
    // No day-level activity, but an unmet weekly quota is worth surfacing.
    expect(stats.done + stats.skipped + stats.missed).toBe(0);
    expect(weekHasScoreableTarget(stats)).toBe(true);
  });

  it("false when the only goal is a count goal's partial first week", () => {
    const stats = computeWeekStats({
      ...WEEK,
      today: TODAY_AFTER_WEEK,
      goals: [
        { id: "c1", name: "Gym", target_days: ALL, created_at: "2024-01-18T00:00:00Z", weekly_target: 5 },
      ],
      checkIns: [],
    });
    expect(weekHasScoreableTarget(stats)).toBe(false);
  });

  it("true for a normal specific-day week", () => {
    const stats = computeWeekStats({
      ...WEEK,
      today: TODAY_AFTER_WEEK,
      goals: [goal("g1", "Writing")],
      checkIns: [],
    });
    expect(weekHasScoreableTarget(stats)).toBe(true);
  });

  it("false when there are no goals", () => {
    const stats = computeWeekStats({ ...WEEK, today: TODAY_AFTER_WEEK, goals: [], checkIns: [] });
    expect(weekHasScoreableTarget(stats)).toBe(false);
  });
});

describe("compareWeeks", () => {
  // Model a single specific-day goal so reflectionCompletionRate (which reads
  // perGoal) sees a target == done+skipped+missed, matching real usage where
  // the page always passes a populated perGoal.
  function ws(done: number, skipped: number, missed: number): WeekStats {
    const targetCount = done + skipped + missed;
    return {
      done,
      skipped,
      missed,
      skipReasons: {},
      notes: [],
      perGoal: [
        {
          goalId: "g",
          goalName: "G",
          targetCount,
          done,
          skipped,
          missed,
          completion: targetCount > 0 ? done / targetCount : 0,
          skipReasons: {},
          notes: [],
          dailyStatus: [],
        },
      ],
    };
  }

  it("returns hasPrior=false when no prior", () => {
    const t = compareWeeks(ws(5, 0, 2), null);
    expect(t.hasPrior).toBe(false);
    expect(t.completionDelta).toBeNull();
  });

  it("returns hasPrior=false when prior had no activity", () => {
    const t = compareWeeks(ws(5, 0, 2), ws(0, 0, 0));
    expect(t.hasPrior).toBe(false);
  });

  it("computes positive completion delta when current is better", () => {
    // Prior: 3/10 = 30%, Current: 7/10 = 70%, delta +40 pts
    const t = compareWeeks(ws(7, 0, 3), ws(3, 0, 7));
    expect(t.hasPrior).toBe(true);
    expect(t.completionDelta).toBe(40);
    expect(t.doneDelta).toBe(4);
  });

  it("computes negative completion delta when current is worse", () => {
    const t = compareWeeks(ws(2, 0, 8), ws(7, 0, 3));
    expect(t.completionDelta).toBe(-50);
    expect(t.doneDelta).toBe(-5);
  });

  it("reports skip delta", () => {
    const t = compareWeeks(ws(5, 2, 0), ws(5, 0, 2));
    expect(t.skipDelta).toBe(2);
  });

  it("a zero-check-in count week is a comparable 0% baseline (recovery shows a step up)", () => {
    const countGoal = {
      id: "c1",
      name: "Gym",
      target_days: [0, 1, 2, 3, 4, 5, 6],
      created_at: "2024-01-01T00:00:00Z",
      weekly_target: 5,
    };
    // Prior week (Jan 8–14): full target, zero check-ins → scoreable, 0%.
    const prior = computeWeekStats({
      start: "2024-01-08",
      end: "2024-01-14",
      today: TODAY_AFTER_WEEK,
      goals: [countGoal],
      checkIns: [],
    });
    // Current week (Jan 15–21): 3 of 5 → 60%.
    const current = computeWeekStats({
      start: "2024-01-15",
      end: "2024-01-21",
      today: TODAY_AFTER_WEEK,
      goals: [countGoal],
      checkIns: [
        { goal_id: "c1", date: "2024-01-15", status: "done", skip_reason: null, note: null },
        { goal_id: "c1", date: "2024-01-16", status: "done", skip_reason: null, note: null },
        { goal_id: "c1", date: "2024-01-17", status: "done", skip_reason: null, note: null },
      ],
    });
    const t = compareWeeks(current, prior);
    expect(t.hasPrior).toBe(true);
    expect(t.completionDelta).toBe(60); // 60% − 0%
  });

  it("a partial-first count week is not a comparable baseline", () => {
    const countGoal = {
      id: "c1",
      name: "Gym",
      target_days: [0, 1, 2, 3, 4, 5, 6],
      created_at: "2024-01-10T00:00:00Z", // created mid prior week → grace there
      weekly_target: 5,
    };
    const prior = computeWeekStats({
      start: "2024-01-08",
      end: "2024-01-14",
      today: TODAY_AFTER_WEEK,
      goals: [countGoal],
      checkIns: [
        { goal_id: "c1", date: "2024-01-11", status: "done", skip_reason: null, note: null },
      ],
    });
    const current = computeWeekStats({
      start: "2024-01-15",
      end: "2024-01-21",
      today: TODAY_AFTER_WEEK,
      goals: [countGoal],
      checkIns: [
        { goal_id: "c1", date: "2024-01-15", status: "done", skip_reason: null, note: null },
      ],
    });
    const t = compareWeeks(current, prior);
    expect(t.hasPrior).toBe(false); // prior was grace, not a baseline
  });
});

describe("buildHighlights", () => {
  function gws(name: string, done: number, target: number, skipReasons: Record<string, number> = {}) {
    return {
      goalId: name.toLowerCase(),
      goalName: name,
      done,
      skipped: Object.values(skipReasons).reduce((s, n) => s + n, 0),
      missed: target - done - Object.values(skipReasons).reduce((s, n) => s + n, 0),
      targetCount: target,
      completion: target > 0 ? done / target : 0,
      skipReasons,
      notes: [],
      dailyStatus: [] as never,
    };
  }
  function wsWith(...perGoal: ReturnType<typeof gws>[]): WeekStats {
    return {
      done: perGoal.reduce((s, g) => s + g.done, 0),
      skipped: 0,
      missed: 0,
      skipReasons: {},
      notes: [],
      perGoal,
    };
  }

  it("returns both nulls if no eligible goals (none with target days this week)", () => {
    const h = buildHighlights(wsWith(gws("Writing", 0, 0)));
    expect(h.strongest).toBeNull();
    expect(h.weakest).toBeNull();
  });

  it("with one eligible goal, only strongest is set", () => {
    const h = buildHighlights(wsWith(gws("Writing", 5, 7)));
    expect(h.strongest?.goalName).toBe("Writing");
    expect(h.weakest).toBeNull();
  });

  it("with mixed completions, picks both strongest and weakest", () => {
    const h = buildHighlights(
      wsWith(gws("Writing", 7, 7), gws("Gym", 2, 7))
    );
    expect(h.strongest?.goalName).toBe("Writing");
    expect(h.weakest?.goalName).toBe("Gym");
  });

  it("all at 100% — no weakest", () => {
    const h = buildHighlights(
      wsWith(gws("Writing", 7, 7), gws("Gym", 5, 5))
    );
    expect(h.strongest?.goalName).toBe("Writing");
    expect(h.weakest).toBeNull();
  });

  it("all at 0% — no strongest", () => {
    const h = buildHighlights(
      wsWith(gws("Writing", 0, 7), gws("Gym", 0, 5))
    );
    expect(h.strongest).toBeNull();
    expect(h.weakest).not.toBeNull();
  });

  it("all tied at the same completion — strongest only, no weakest", () => {
    const h = buildHighlights(
      wsWith(gws("Writing", 4, 7), gws("Gym", 4, 7))
    );
    expect(h.strongest).not.toBeNull();
    expect(h.weakest).toBeNull();
  });

  it("names a dominant skip reason if it's >=50% of the weakest goal's skips", () => {
    const h = buildHighlights(
      wsWith(
        gws("Writing", 7, 7),
        gws("Gym", 1, 7, { travel: 3, mood: 1 }) // 4 skipped, travel = 75%
      )
    );
    expect(h.weakestDominantReason).toBe("travel");
  });

  it("doesn't name a reason if no skip dominates", () => {
    const h = buildHighlights(
      wsWith(
        gws("Writing", 7, 7),
        gws("Gym", 1, 7, { travel: 2, mood: 2, illness: 2 }) // even split
      )
    );
    expect(h.weakestDominantReason).toBeNull();
  });
});

describe("buildWeeklyNarrative", () => {
  function ws(done: number, skipped: number, missed: number): WeekStats {
    return { done, skipped, missed, skipReasons: {}, notes: [], perGoal: [] };
  }
  function goalStat(name: string): GoalWeekStats {
    return {
      goalId: name.toLowerCase(),
      goalName: name,
      targetCount: 7,
      done: 0,
      skipped: 0,
      missed: 0,
      completion: 0,
      skipReasons: {},
      notes: [],
      dailyStatus: [] as never,
    };
  }
  const noTrend: WeekTrend = {
    hasPrior: false,
    completionDelta: null,
    doneDelta: null,
    skipDelta: null,
  };
  const noHighlights: Highlights = {
    strongest: null,
    weakest: null,
    weakestDominantReason: null,
  };

  it("returns null when there's no activity", () => {
    expect(buildWeeklyNarrative(ws(0, 0, 0), null, noHighlights)).toBeNull();
  });

  it("reports the count of completions (pluralized)", () => {
    expect(buildWeeklyNarrative(ws(4, 0, 1), null, noHighlights)).toBe(
      "You showed up 4 times this week."
    );
    expect(buildWeeklyNarrative(ws(1, 0, 0), null, noHighlights)).toBe(
      "You showed up 1 time this week."
    );
  });

  it("uses a gentle clause when there were no completions", () => {
    expect(buildWeeklyNarrative(ws(0, 1, 2), null, noHighlights)).toBe(
      "A quiet week — no completions logged."
    );
  });

  it("names strongest and weakest descriptively", () => {
    const h: Highlights = {
      strongest: goalStat("Writing"),
      weakest: goalStat("Gym"),
      weakestDominantReason: null,
    };
    expect(buildWeeklyNarrative(ws(5, 1, 1), null, h)).toBe(
      "You showed up 5 times this week. Writing was strongest; Gym slipped."
    );
  });

  it("appends a dominant skip reason for the weak goal", () => {
    const h: Highlights = {
      strongest: goalStat("Writing"),
      weakest: goalStat("Gym"),
      weakestDominantReason: "travel",
    };
    expect(buildWeeklyNarrative(ws(5, 3, 0), null, h)).toBe(
      "You showed up 5 times this week. Writing was strongest; Gym slipped — mostly to travel."
    );
  });

  it("omits the reason phrase for 'other'", () => {
    const h: Highlights = {
      strongest: goalStat("Writing"),
      weakest: goalStat("Gym"),
      weakestDominantReason: "other",
    };
    expect(buildWeeklyNarrative(ws(5, 3, 0), null, h)).toBe(
      "You showed up 5 times this week. Writing was strongest; Gym slipped."
    );
  });

  it("uses a single-goal phrasing when only strongest is set", () => {
    const h: Highlights = {
      strongest: goalStat("Writing"),
      weakest: null,
      weakestDominantReason: null,
    };
    expect(buildWeeklyNarrative(ws(3, 0, 0), null, h)).toBe(
      "You showed up 3 times this week. Writing led the week."
    );
  });

  it("adds a trend clause when a prior week is comparable", () => {
    const up: WeekTrend = { hasPrior: true, completionDelta: 12, doneDelta: 2, skipDelta: 0 };
    const down: WeekTrend = { hasPrior: true, completionDelta: -8, doneDelta: -1, skipDelta: 1 };
    const flat: WeekTrend = { hasPrior: true, completionDelta: 0, doneDelta: 0, skipDelta: 0 };
    expect(buildWeeklyNarrative(ws(4, 0, 0), up, noHighlights)).toBe(
      "You showed up 4 times this week. A step up from last week."
    );
    expect(buildWeeklyNarrative(ws(4, 0, 0), down, noHighlights)).toBe(
      "You showed up 4 times this week. A quieter week than last."
    );
    expect(buildWeeklyNarrative(ws(4, 0, 0), flat, noHighlights)).toBe(
      "You showed up 4 times this week. On par with last week."
    );
  });

  it("ignores trend when there's no comparable prior week", () => {
    expect(buildWeeklyNarrative(ws(2, 0, 0), noTrend, noHighlights)).toBe(
      "You showed up 2 times this week."
    );
  });
});
