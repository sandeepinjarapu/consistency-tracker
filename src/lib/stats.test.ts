import { describe, it, expect } from "vitest";
import { computeStats, buildHeatmapCells, buildAggregateCells } from "./stats";

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
});
