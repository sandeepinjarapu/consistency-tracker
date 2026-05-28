import { describe, it, expect } from "vitest";
import {
  computeWeekStats,
  compareWeeks,
  buildHighlights,
  type WeekStats,
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
});

describe("compareWeeks", () => {
  function ws(done: number, skipped: number, missed: number): WeekStats {
    return { done, skipped, missed, skipReasons: {}, notes: [], perGoal: [] };
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
