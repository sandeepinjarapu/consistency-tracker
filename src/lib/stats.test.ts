import { describe, it, expect } from "vitest";
import {
  computeStats,
  buildHeatmapCells,
  buildAggregateCells,
  buildGoalInsight,
  computeTimePattern,
  computeWeeklyMet,
} from "./stats";

// Date range used across most tests: Mon 2024-01-15 .. Sun 2024-01-21
// (a full week). Target days are all 7 days unless noted.
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

describe("computeStats — streak math", () => {
  it("returns zeros for empty range", () => {
    const s = computeStats({
      startDate: "2024-01-15",
      endDate: "2024-01-21",
      targetDays: ALL_DAYS,
      checkIns: [],
    });
    expect(s.doneCount).toBe(0);
    expect(s.skippedCount).toBe(0);
    // Last day of range is treated as "today pending" — only the 6 prior
    // target days count as missed.
    expect(s.missedCount).toBe(6);
    expect(s.currentStreak).toBe(0);
    expect(s.longestStreak).toBe(0);
  });

  it("counts a clean week of done days as a 7-day streak", () => {
    const checkIns = [
      { date: "2024-01-15", status: "done" as const },
      { date: "2024-01-16", status: "done" as const },
      { date: "2024-01-17", status: "done" as const },
      { date: "2024-01-18", status: "done" as const },
      { date: "2024-01-19", status: "done" as const },
      { date: "2024-01-20", status: "done" as const },
      { date: "2024-01-21", status: "done" as const },
    ];
    const s = computeStats({
      startDate: "2024-01-15",
      endDate: "2024-01-21",
      targetDays: ALL_DAYS,
      checkIns,
    });
    expect(s.doneCount).toBe(7);
    expect(s.currentStreak).toBe(7);
    expect(s.longestStreak).toBe(7);
    expect(s.completionRate).toBe(1);
  });

  it("skipped days break the current streak (regression: streak=done-only)", () => {
    // Done Mon-Wed, skipped Thu, done Fri-Sat, done Sun.
    // Longest streak from Fri-Sun = 3; current streak from Sun-back = 3.
    const checkIns = [
      { date: "2024-01-15", status: "done" as const },
      { date: "2024-01-16", status: "done" as const },
      { date: "2024-01-17", status: "done" as const },
      { date: "2024-01-18", status: "skipped" as const },
      { date: "2024-01-19", status: "done" as const },
      { date: "2024-01-20", status: "done" as const },
      { date: "2024-01-21", status: "done" as const },
    ];
    const s = computeStats({
      startDate: "2024-01-15",
      endDate: "2024-01-21",
      targetDays: ALL_DAYS,
      checkIns,
    });
    expect(s.doneCount).toBe(6);
    expect(s.skippedCount).toBe(1);
    expect(s.longestStreak).toBe(3); // Fri-Sun (Mon-Wed was also 3)
    expect(s.currentStreak).toBe(3); // walking back from Sun
  });

  it("missed days also break the current streak", () => {
    // Done Mon-Wed, nothing Thu (missed), done Fri-Sun.
    const checkIns = [
      { date: "2024-01-15", status: "done" as const },
      { date: "2024-01-16", status: "done" as const },
      { date: "2024-01-17", status: "done" as const },
      // 2024-01-18 missing → missed
      { date: "2024-01-19", status: "done" as const },
      { date: "2024-01-20", status: "done" as const },
      { date: "2024-01-21", status: "done" as const },
    ];
    const s = computeStats({
      startDate: "2024-01-15",
      endDate: "2024-01-21",
      targetDays: ALL_DAYS,
      checkIns,
    });
    expect(s.missedCount).toBe(1);
    expect(s.currentStreak).toBe(3);
    expect(s.longestStreak).toBe(3);
  });

  it("today-pending (no check-in on endDate) doesn't count as missed or break the streak", () => {
    // Done Mon-Sat, today (Sun) is pending — no check-in row.
    const checkIns = [
      { date: "2024-01-15", status: "done" as const },
      { date: "2024-01-16", status: "done" as const },
      { date: "2024-01-17", status: "done" as const },
      { date: "2024-01-18", status: "done" as const },
      { date: "2024-01-19", status: "done" as const },
      { date: "2024-01-20", status: "done" as const },
      // 2024-01-21 (endDate) missing — but it's today, so pending
    ];
    const s = computeStats({
      startDate: "2024-01-15",
      endDate: "2024-01-21",
      targetDays: ALL_DAYS,
      checkIns,
    });
    expect(s.doneCount).toBe(6);
    expect(s.missedCount).toBe(0); // today is pending, not missed
    expect(s.currentStreak).toBe(6); // 6-day streak still intact
  });

  it("skipping prior days adds to skipped count but doesn't pad streak", () => {
    // 7 skipped days, no done days.
    const checkIns = ALL_DAYS.map((_, i) => ({
      date: `2024-01-${String(15 + i).padStart(2, "0")}`,
      status: "skipped" as const,
    }));
    const s = computeStats({
      startDate: "2024-01-15",
      endDate: "2024-01-21",
      targetDays: ALL_DAYS,
      checkIns,
    });
    expect(s.skippedCount).toBe(7);
    expect(s.doneCount).toBe(0);
    expect(s.currentStreak).toBe(0);
    expect(s.longestStreak).toBe(0);
  });

  it("non-target days are ignored entirely", () => {
    // Mon-Fri only target. Done Mon-Fri; weekend doesn't matter.
    const checkIns = [
      { date: "2024-01-15", status: "done" as const }, // Mon
      { date: "2024-01-16", status: "done" as const },
      { date: "2024-01-17", status: "done" as const },
      { date: "2024-01-18", status: "done" as const },
      { date: "2024-01-19", status: "done" as const }, // Fri
    ];
    const s = computeStats({
      startDate: "2024-01-15",
      endDate: "2024-01-21", // Sun
      targetDays: [1, 2, 3, 4, 5], // weekdays
      checkIns,
    });
    expect(s.doneCount).toBe(5);
    expect(s.missedCount).toBe(0);
    expect(s.completionRate).toBe(1);
    expect(s.currentStreak).toBe(5);
  });
});

describe("computeStats — count goals (weekly target)", () => {
  // ISO weeks (Mon start): A = Jan 1–7, B = Jan 8–14, C = Jan 15–21, 2024.
  const weekdays = [1, 2, 3, 4, 5];
  const done = (date: string) => ({ date, status: "done" as const });

  it("reports week-based streak, completion, and doneThisWeek", () => {
    const s = computeStats({
      startDate: "2024-01-01",
      endDate: "2024-01-17", // Wed of week C (in progress)
      targetDays: weekdays,
      weeklyTarget: 3,
      checkIns: [
        done("2024-01-01"), done("2024-01-02"), done("2024-01-03"), // A: met
        done("2024-01-08"), done("2024-01-09"), done("2024-01-10"), // B: met
        done("2024-01-15"), done("2024-01-16"), // C: 2 so far, not yet met
      ],
    });
    expect(s.streakUnit).toBe("week");
    expect(s.doneThisWeek).toBe(2);
    expect(s.weeklyTarget).toBe(3);
    expect(s.completionRate).toBe(1); // completed weeks A,B both met
    expect(s.currentStreak).toBe(2); // in-progress C doesn't break A,B
    expect(s.longestStreak).toBe(2);
  });

  it("current week counts toward the streak once the target is met", () => {
    const s = computeStats({
      startDate: "2024-01-08",
      endDate: "2024-01-17",
      targetDays: weekdays,
      weeklyTarget: 2,
      checkIns: [
        done("2024-01-08"), done("2024-01-09"), // B: met
        done("2024-01-15"), done("2024-01-16"), // C (current): met
      ],
    });
    expect(s.currentStreak).toBe(2); // B + current C
    expect(s.doneThisWeek).toBe(2);
  });

  it("a missed completed week resets the streak", () => {
    const s = computeStats({
      startDate: "2024-01-01",
      endDate: "2024-01-17",
      targetDays: weekdays,
      weeklyTarget: 3,
      checkIns: [
        done("2024-01-01"), done("2024-01-02"), done("2024-01-03"), // A: met
        done("2024-01-08"), // B: only 1 → missed
        done("2024-01-15"), done("2024-01-16"), done("2024-01-17"), // C: met
      ],
    });
    expect(s.currentStreak).toBe(1); // current C met; prior B failed → stop
    expect(s.longestStreak).toBe(1);
    expect(s.completionRate).toBe(0.5); // completed A,B: 1 of 2 met
  });

  it("dones outside the eligible window don't count toward the quota", () => {
    const s = computeStats({
      startDate: "2024-01-15",
      endDate: "2024-01-21", // full week C
      targetDays: weekdays,
      weeklyTarget: 1,
      checkIns: [done("2024-01-20"), done("2024-01-21")], // Sat + Sun, off-window
    });
    expect(s.doneThisWeek).toBe(0);
    expect(s.doneCount).toBe(0);
  });

  it("a partial first week isn't judged against the full quota", () => {
    // Goal created Thu Jan 4 — week A (Jan 1–7) is a partial stub with only
    // 2 done (below target 3). It must not break the streak or drag the rate.
    const s = computeStats({
      startDate: "2024-01-04",
      endDate: "2024-01-17", // Wed of week C (in progress)
      targetDays: ALL_DAYS,
      weeklyTarget: 3,
      checkIns: [
        done("2024-01-04"), done("2024-01-05"), // A: 2 (partial, not met)
        done("2024-01-08"), done("2024-01-09"), done("2024-01-10"), // B: met
        done("2024-01-15"), done("2024-01-16"), done("2024-01-17"), // C: met
      ],
    });
    expect(s.currentStreak).toBe(2); // B + current C; partial A doesn't break
    expect(s.longestStreak).toBe(2);
    expect(s.completionRate).toBe(1); // only full completed week B counts → 1/1
  });

  it("a brand-new count goal reflects current-week progress", () => {
    const s = computeStats({
      startDate: "2024-01-15", // created Monday of the current week
      endDate: "2024-01-17",
      targetDays: ALL_DAYS,
      weeklyTarget: 3,
      checkIns: [done("2024-01-15"), done("2024-01-16")],
    });
    expect(s.doneThisWeek).toBe(2);
    expect(s.currentStreak).toBe(0); // current week not yet met
    expect(s.completionRate).toBeCloseTo(2 / 3, 5); // no completed weeks → this week
  });
});

describe("computeWeeklyMet", () => {
  it("flags partial, completed, and current weeks oldest → newest", () => {
    const weeks = computeWeeklyMet({
      startDate: "2024-01-04", // Thu — week A is a partial stub
      endDate: "2024-01-17", // week C in progress
      targetDays: ALL_DAYS,
      weeklyTarget: 3,
      checkIns: [
        { date: "2024-01-04", status: "done" },
        { date: "2024-01-05", status: "done" }, // A: 2
        { date: "2024-01-08", status: "done" },
        { date: "2024-01-09", status: "done" },
        { date: "2024-01-10", status: "done" }, // B: 3
        { date: "2024-01-15", status: "done" },
        { date: "2024-01-16", status: "done" },
        { date: "2024-01-17", status: "done" }, // C: 3
      ],
    });
    expect(weeks).toHaveLength(3);
    expect(weeks[0]).toMatchObject({ weekStart: "2024-01-01", done: 2, met: false, partial: true, current: false });
    expect(weeks[1]).toMatchObject({ weekStart: "2024-01-08", done: 3, met: true, partial: false, current: false });
    expect(weeks[2]).toMatchObject({ weekStart: "2024-01-15", done: 3, met: true, partial: false, current: true });
  });
});

describe("buildHeatmapCells", () => {
  it("marks cells before goalStartDate as empty", () => {
    const cells = buildHeatmapCells({
      startDate: "2024-01-10",
      endDate: "2024-01-16",
      targetDays: ALL_DAYS,
      checkIns: [],
      goalStartDate: "2024-01-15",
      todayStr: "2024-01-16",
    });
    // First 5 days are before goal start
    expect(cells.slice(0, 5).every((c) => c.status === "empty")).toBe(true);
  });

  it("marks today as empty when no check-in (pending)", () => {
    const cells = buildHeatmapCells({
      startDate: "2024-01-15",
      endDate: "2024-01-15",
      targetDays: ALL_DAYS,
      checkIns: [],
      goalStartDate: "2024-01-15",
      todayStr: "2024-01-15",
    });
    expect(cells).toHaveLength(1);
    expect(cells[0].status).toBe("empty");
  });

  it("marks past target days with no check-in as missed", () => {
    const cells = buildHeatmapCells({
      startDate: "2024-01-15",
      endDate: "2024-01-16",
      targetDays: ALL_DAYS,
      checkIns: [],
      goalStartDate: "2024-01-15",
      todayStr: "2024-01-16",
    });
    expect(cells[0].status).toBe("missed"); // Jan 15 (past)
    expect(cells[1].status).toBe("empty"); // Jan 16 (today, pending)
  });

  it("maps done/skipped check-ins to matching cells", () => {
    const cells = buildHeatmapCells({
      startDate: "2024-01-15",
      endDate: "2024-01-17",
      targetDays: ALL_DAYS,
      checkIns: [
        { date: "2024-01-15", status: "done" },
        { date: "2024-01-16", status: "skipped" },
      ],
      goalStartDate: "2024-01-15",
      todayStr: "2024-01-17",
    });
    expect(cells[0].status).toBe("done");
    expect(cells[1].status).toBe("skipped");
    expect(cells[2].status).toBe("empty"); // today
  });

  it("marks non-target days as empty", () => {
    // Target only Mon (=1). Range includes Sun (Jan 14) and Mon (Jan 15).
    const cells = buildHeatmapCells({
      startDate: "2024-01-14",
      endDate: "2024-01-15",
      targetDays: [1],
      checkIns: [{ date: "2024-01-15", status: "done" }],
      goalStartDate: "2024-01-14",
      todayStr: "2024-01-16",
    });
    expect(cells[0].status).toBe("empty"); // Sun, not a target
    expect(cells[1].status).toBe("done"); // Mon
  });

  it("count goals: a past eligible day with no check-in is empty, not missed", () => {
    const args = {
      startDate: "2024-01-15",
      endDate: "2024-01-17",
      targetDays: ALL_DAYS,
      checkIns: [],
      goalStartDate: "2024-01-15",
      todayStr: "2024-01-17",
    };
    expect(buildHeatmapCells(args)[0].status).toBe("missed"); // specific goal
    expect(buildHeatmapCells({ ...args, weeklyTarget: 3 })[0].status).toBe(
      "empty"
    ); // count goal — a gap isn't a miss
  });

  it("count goals still render done and skipped days", () => {
    const cells = buildHeatmapCells({
      startDate: "2024-01-15",
      endDate: "2024-01-17",
      targetDays: ALL_DAYS,
      checkIns: [
        { date: "2024-01-15", status: "done" },
        { date: "2024-01-16", status: "skipped" },
      ],
      goalStartDate: "2024-01-15",
      todayStr: "2024-01-17",
      weeklyTarget: 2,
    });
    expect(cells[0].status).toBe("done");
    expect(cells[1].status).toBe("skipped");
    expect(cells[2].status).toBe("empty"); // today pending
  });

  it("marks an off-target done as an extra; an off-target skip stays empty", () => {
    // Target Mon only. Jan 13 = Sat, Jan 14 = Sun, Jan 15 = Mon.
    const cells = buildHeatmapCells({
      startDate: "2024-01-13",
      endDate: "2024-01-15",
      targetDays: [1],
      checkIns: [
        { date: "2024-01-13", status: "done" }, // Sat, off-target → extra
        { date: "2024-01-14", status: "skipped" }, // Sun, off-target → hidden
      ],
      goalStartDate: "2024-01-01",
      todayStr: "2024-01-16",
    });
    expect(cells[0].status).toBe("extra");
    expect(cells[1].status).toBe("empty");
    expect(cells[2].status).toBe("missed"); // Mon, scheduled, unlogged, past
  });
});

describe("buildAggregateCells", () => {
  it("future dates get the no-target color", () => {
    const cells = buildAggregateCells({
      startDate: "2024-01-15",
      endDate: "2024-01-17",
      todayStr: "2024-01-15",
      goals: [
        { id: "g1", target_days: ALL_DAYS, created_at: "2024-01-15T00:00:00Z" },
      ],
      checkIns: [],
    });
    // Today: 0 of 1 done. Tomorrow + day after: future.
    expect(cells[0].color).not.toBe("#f3f4f6");
    expect(cells[1].color).toBe("#f3f4f6");
    expect(cells[2].color).toBe("#f3f4f6");
  });

  it("dates before any goal was created get the no-target color", () => {
    const cells = buildAggregateCells({
      startDate: "2024-01-10",
      endDate: "2024-01-15",
      todayStr: "2024-01-15",
      goals: [
        { id: "g1", target_days: ALL_DAYS, created_at: "2024-01-15T00:00:00Z" },
      ],
      checkIns: [],
    });
    // First 5 cells: before goal existed → no scheduled goals → grey.
    expect(cells.slice(0, 5).every((c) => c.color === "#f3f4f6")).toBe(true);
  });

  it("ratio of done / target sets the color level", () => {
    // Two goals, both targeting every day, both created before the window.
    // On 2024-01-15: 2 of 2 done (ratio 1.0) → level 4 (#216e39)
    // On 2024-01-16: 1 of 2 done (ratio 0.5) → level 2 (#40c463)
    // On 2024-01-17: 0 of 2 done (ratio 0) → level 0 (#ebedf0)
    const cells = buildAggregateCells({
      startDate: "2024-01-15",
      endDate: "2024-01-17",
      todayStr: "2024-01-17",
      goals: [
        { id: "g1", target_days: ALL_DAYS, created_at: "2024-01-01T00:00:00Z" },
        { id: "g2", target_days: ALL_DAYS, created_at: "2024-01-01T00:00:00Z" },
      ],
      checkIns: [
        { goal_id: "g1", date: "2024-01-15", status: "done" },
        { goal_id: "g2", date: "2024-01-15", status: "done" },
        { goal_id: "g1", date: "2024-01-16", status: "done" },
      ],
    });
    expect(cells[0].color).toBe("#216e39"); // all done
    expect(cells[1].color).toBe("#40c463"); // half done
    expect(cells[2].color).toBe("#ebedf0"); // none done, but goals scheduled
  });

  it("days where no goal targets that weekday show no-target color", () => {
    // Goal targets only Mon (=1). Tue (Jan 16) has no target.
    const cells = buildAggregateCells({
      startDate: "2024-01-15",
      endDate: "2024-01-16",
      todayStr: "2024-01-16",
      goals: [
        { id: "g1", target_days: [1], created_at: "2024-01-01T00:00:00Z" },
      ],
      checkIns: [],
    });
    expect(cells[0].color).toBe("#ebedf0"); // Mon, 0 of 1 done
    expect(cells[1].color).toBe("#f3f4f6"); // Tue, no target
  });

  it("count goals only count toward a day once actually done", () => {
    // g1 = specific daily goal, g2 = count goal (3×/week). On Jan 16 only g1
    // is done; the not-done count goal must not drag the ratio to 1-of-2.
    const cells = buildAggregateCells({
      startDate: "2024-01-16",
      endDate: "2024-01-16",
      todayStr: "2024-01-16",
      goals: [
        { id: "g1", target_days: ALL_DAYS, created_at: "2024-01-01T00:00:00Z" },
        {
          id: "g2",
          target_days: ALL_DAYS,
          created_at: "2024-01-01T00:00:00Z",
          weekly_target: 3,
        },
      ],
      checkIns: [{ goal_id: "g1", date: "2024-01-16", status: "done" }],
    });
    expect(cells[0].color).toBe("#216e39"); // 1 of 1 effective → full intensity
  });

  it("shows a day with only extras at the lowest non-zero level", () => {
    // Goal targets Mon only; Jan 16 = Tue (off-target) but done → extra-only day.
    const cells = buildAggregateCells({
      startDate: "2024-01-16",
      endDate: "2024-01-16",
      todayStr: "2024-01-16",
      goals: [
        { id: "g1", target_days: [1], created_at: "2024-01-01T00:00:00Z" },
      ],
      checkIns: [{ goal_id: "g1", date: "2024-01-16", status: "done" }],
    });
    expect(cells[0].color).toBe("#9be9a8"); // LEVEL_COLORS[1]
    expect(cells[0].tooltip).toContain("1 extra check-in");
  });

  it("keeps scheduled intensity and appends extras when both occur", () => {
    // Jan 15 = Mon. g1 daily done (scored). g2 targets Wed only, done Mon (extra).
    const cells = buildAggregateCells({
      startDate: "2024-01-15",
      endDate: "2024-01-15",
      todayStr: "2024-01-15",
      goals: [
        { id: "g1", target_days: ALL_DAYS, created_at: "2024-01-01T00:00:00Z" },
        { id: "g2", target_days: [3], created_at: "2024-01-01T00:00:00Z" },
      ],
      checkIns: [
        { goal_id: "g1", date: "2024-01-15", status: "done" },
        { goal_id: "g2", date: "2024-01-15", status: "done" }, // off-target extra
      ],
    });
    expect(cells[0].color).toBe("#216e39"); // 1 of 1 scored → full
    expect(cells[0].tooltip).toContain("1 of 1 done");
    expect(cells[0].tooltip).toContain("1 extra");
  });

  it("never lets extras raise the scored ratio", () => {
    // g1 scheduled but NOT done; g2 off-target done. Ratio stays 0 of 1.
    const cells = buildAggregateCells({
      startDate: "2024-01-15",
      endDate: "2024-01-15",
      todayStr: "2024-01-16", // Jan 15 is past, so no "keep going" copy
      goals: [
        { id: "g1", target_days: ALL_DAYS, created_at: "2024-01-01T00:00:00Z" },
        { id: "g2", target_days: [3], created_at: "2024-01-01T00:00:00Z" },
      ],
      checkIns: [{ goal_id: "g2", date: "2024-01-15", status: "done" }],
    });
    expect(cells[0].color).toBe("#ebedf0"); // LEVEL_COLORS[0]: 0 of 1
    expect(cells[0].tooltip).toContain("0 of 1 done");
    expect(cells[0].tooltip).toContain("1 extra");
  });
});

// Helper: an entry logged live (createdAt's UTC date == activity date).
const live = (ts: string) => ({ createdAt: ts, date: ts.slice(0, 10) });

describe("computeTimePattern", () => {
  it("returns null typical and zero counts for empty input", () => {
    const r = computeTimePattern({ entries: [], timezone: "UTC" });
    expect(r.typical).toBeNull();
    expect(r.total).toBe(0);
    expect(r.hourly).toHaveLength(24);
    expect(r.hourly.every((c) => c === 0)).toBe(true);
  });

  it("buckets timestamps into the right hour in the given timezone", () => {
    // 14:23 UTC. In UTC → hour 14. In LA (UTC-8) → hour 6. In IST (+5:30) → hour 19.
    // date 2024-01-15 is the same local day across all three for 14:23 UTC.
    const e = [live("2024-01-15T14:23:00Z")];
    expect(computeTimePattern({ entries: e, timezone: "UTC" }).hourly[14]).toBe(1);
    expect(
      computeTimePattern({ entries: e, timezone: "America/Los_Angeles" }).hourly[6]
    ).toBe(1);
    expect(
      computeTimePattern({ entries: e, timezone: "Asia/Kolkata" }).hourly[19]
    ).toBe(1);
  });

  it("returns the median time as typical, robust to outliers", () => {
    // Three 7:00am check-ins + one 11:00pm outlier. Median = 7:00am.
    const r = computeTimePattern({
      entries: [
        live("2024-01-15T07:00:00Z"),
        live("2024-01-16T07:00:00Z"),
        live("2024-01-17T07:00:00Z"),
        live("2024-01-18T23:00:00Z"),
      ],
      timezone: "UTC",
    });
    expect(r.typical).toEqual({ hour: 7, minute: 0 });
    expect(r.total).toBe(4);
  });

  it("counts every live check-in toward total", () => {
    const r = computeTimePattern({
      entries: [
        live("2024-01-15T09:00:00Z"),
        live("2024-01-15T10:00:00Z"),
        live("2024-01-15T10:30:00Z"),
      ],
      timezone: "UTC",
    });
    expect(r.total).toBe(3);
    expect(r.hourly[9]).toBe(1);
    expect(r.hourly[10]).toBe(2);
  });

  it("ignores backfills (logged on a later day than the activity)", () => {
    // Saturday's run, backfilled Monday morning. createdAt date != activity date.
    const r = computeTimePattern({
      entries: [{ createdAt: "2024-01-22T09:00:00Z", date: "2024-01-20" }],
      timezone: "UTC",
    });
    expect(r.total).toBe(0);
    expect(r.typical).toBeNull();
  });

  it("ignores an undo-then-recheck on a different day, keeps same-day ones", () => {
    const r = computeTimePattern({
      entries: [
        live("2024-01-15T07:00:00Z"), // live, counts
        { createdAt: "2024-01-18T22:00:00Z", date: "2024-01-16" }, // rechecked later, ignored
      ],
      timezone: "UTC",
    });
    expect(r.total).toBe(1);
    expect(r.typical).toEqual({ hour: 7, minute: 0 });
  });

  it("uses the logical (5am) day, timezone-aware, for live vs backfill", () => {
    // 10:00 UTC on the 16th is 5am the 16th in UTC — past the rollover, so a
    // log "for the 15th" reads as a backfill. In LA it's 2am the 16th — before
    // the rollover, still the 15th's logical night — so it counts, late at night.
    const entry = { createdAt: "2024-01-16T10:00:00Z", date: "2024-01-15" };
    expect(computeTimePattern({ entries: [entry], timezone: "UTC" }).total).toBe(0);
    const la = computeTimePattern({
      entries: [entry],
      timezone: "America/Los_Angeles",
    });
    expect(la.total).toBe(1);
    expect(la.hourly[2]).toBe(1);
  });

  // Regression: en-CA with hour12:false renders midnight as "24:30" in
  // some engines instead of "00:30". Without normalization, a midnight
  // check-in would land in hourly[24] (out of bounds → ghost 25th
  // bucket) and the typical-time render would flip 12:xxam → 12:xxpm.
  it("counts a pre-dawn log for the prior day (night owl) as late night", () => {
    // Stretched at 2am, logged for yesterday before sleeping — a real do-time.
    const r = computeTimePattern({
      entries: [{ createdAt: "2024-01-15T02:00:00Z", date: "2024-01-14" }],
      timezone: "UTC",
    });
    expect(r.total).toBe(1);
    expect(r.hourly[2]).toBe(1);
    expect(r.typical).toEqual({ hour: 2, minute: 0 });
  });

  it("still excludes a genuine backfill days later", () => {
    // Logging Sunday's session the following Wednesday evening — not a do-time.
    const r = computeTimePattern({
      entries: [{ createdAt: "2024-01-17T20:00:00Z", date: "2024-01-14" }],
      timezone: "UTC",
    });
    expect(r.total).toBe(0);
  });

  it("excludes a pre-dawn log made for the new calendar day (the tradeoff)", () => {
    // 1am logged for today: before the 5am rollover it belongs to the prior
    // logical day, so it isn't counted toward the new day. Documented tradeoff.
    const r = computeTimePattern({
      entries: [{ createdAt: "2024-01-15T01:00:00Z", date: "2024-01-15" }],
      timezone: "UTC",
    });
    expect(r.total).toBe(0);
  });

  it("buckets midnight (00:xx) as hour 0, not hour 24", () => {
    // Logged just after midnight, for the night that just ended (the prior
    // logical day), so they're live and land in hourly[0].
    const r = computeTimePattern({
      entries: [
        { createdAt: "2024-01-15T00:30:00Z", date: "2024-01-14" },
        { createdAt: "2024-01-16T00:30:00Z", date: "2024-01-15" },
        { createdAt: "2024-01-17T00:30:00Z", date: "2024-01-16" },
      ],
      timezone: "UTC",
    });
    expect(r.hourly).toHaveLength(24);
    expect(r.hourly[0]).toBe(3);
    // Confirm no slot at index 24 leaked in
    expect((r.hourly as Array<number | undefined>)[24]).toBeUndefined();
    expect(r.typical).toEqual({ hour: 0, minute: 30 });
  });
});

describe("buildGoalInsight", () => {
  const noTime = { typical: null, timedTotal: 0 };

  it("returns null with too little history and no streak", () => {
    expect(
      buildGoalInsight({ ...noTime, currentStreak: 0, streakUnit: "days", doneCount: 2 })
    ).toBeNull();
  });

  it("states the typical part of day when there's enough timed history", () => {
    expect(
      buildGoalInsight({
        typical: { hour: 8, minute: 30 },
        timedTotal: 6,
        currentStreak: 0,
        streakUnit: "days",
        doneCount: 6,
      })
    ).toBe("You usually do this in the morning, between 8 and 9am.");
  });

  it("does not state a time pattern with fewer than 4 timed check-ins", () => {
    expect(
      buildGoalInsight({
        typical: { hour: 8, minute: 30 },
        timedTotal: 3,
        currentStreak: 0,
        streakUnit: "days",
        doneCount: 5,
      })
    ).toBeNull();
  });

  it("reports a running streak with a singular unit", () => {
    expect(
      buildGoalInsight({ ...noTime, currentStreak: 5, streakUnit: "days", doneCount: 5 })
    ).toBe("You're on a 5-day run.");
    expect(
      buildGoalInsight({ ...noTime, currentStreak: 3, streakUnit: "weeks", doneCount: 3 })
    ).toBe("You're on a 3-week run.");
  });

  it("shows a streak even when overall done-count is small", () => {
    expect(
      buildGoalInsight({ ...noTime, currentStreak: 2, streakUnit: "days", doneCount: 2 })
    ).toBe("You're on a 2-day run.");
  });

  it("combines time-of-day and streak when both apply", () => {
    expect(
      buildGoalInsight({
        typical: { hour: 2, minute: 10 },
        timedTotal: 8,
        currentStreak: 4,
        streakUnit: "days",
        doneCount: 12,
      })
    ).toBe("You usually do this late at night, between 2 and 3am. You're on a 4-day run.");
  });

  it("does not show a 1-length streak", () => {
    expect(
      buildGoalInsight({ ...noTime, currentStreak: 1, streakUnit: "days", doneCount: 1 })
    ).toBeNull();
  });
});
