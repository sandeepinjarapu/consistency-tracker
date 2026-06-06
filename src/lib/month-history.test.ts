import { describe, it, expect } from "vitest";
import { buildMonthList, buildMonthHistory } from "./month-history";

/**
 * Weekday anchor (shared with metrics-consistency.test.ts):
 *   2024-01-15 is a Monday, so 2024-01-01, 08, 15, 22, 29 are all Mondays.
 * targetDays use the getUTCDay convention (Sun=0 .. Sat=6).
 */

describe("buildMonthList", () => {
  it("returns [year, month] pairs newest-first, inclusive of both ends", () => {
    expect(buildMonthList("2026-03-10", "2026-06-06")).toEqual([
      [2026, 6],
      [2026, 5],
      [2026, 4],
      [2026, 3],
    ]);
  });

  it("collapses a single calendar month to one entry", () => {
    expect(buildMonthList("2026-06-01", "2026-06-06")).toEqual([[2026, 6]]);
  });

  it("crosses a year boundary", () => {
    expect(buildMonthList("2025-11-20", "2026-01-05")).toEqual([
      [2026, 1],
      [2025, 12],
      [2025, 11],
    ]);
  });
});

describe("buildMonthHistory — older-history threshold", () => {
  const base = {
    checkIns: [],
    targetDays: [1, 3, 5], // Mon/Wed/Fri
    weeklyTarget: null,
    historyStart: "2020-01-01", // far back, no clamping
  };

  it("keeps olderMonths empty at exactly 2 calendar months", () => {
    const { recentMonths, olderMonths } = buildMonthHistory({
      ...base,
      goalStartDate: "2026-05-20",
      today: "2026-06-06",
    });
    expect(recentMonths).toHaveLength(2);
    expect(olderMonths).toHaveLength(0);
  });

  it("surfaces olderMonths only past the 2-month boundary", () => {
    const { recentMonths, olderMonths } = buildMonthHistory({
      ...base,
      goalStartDate: "2026-04-20",
      today: "2026-06-06",
    });
    expect(recentMonths.map((m) => m.month)).toEqual([6, 5]); // newest-first
    expect(olderMonths.map((m) => m.month)).toEqual([4]);
  });
});

describe("buildMonthHistory — specific-day intensity", () => {
  it("scores completionRate to the same levels as the aggregate scale", () => {
    // Mondays only. Jan 2024 Mondays: 1, 8, 15, 22, 29. Two done, three missed.
    const { olderMonths } = buildMonthHistory({
      checkIns: [
        { date: "2024-01-01", status: "done" },
        { date: "2024-01-08", status: "done" },
      ],
      goalStartDate: "2024-01-01",
      targetDays: [1],
      weeklyTarget: null,
      today: "2024-03-15",
      historyStart: "2024-01-01",
    });
    const jan = olderMonths.find((m) => m.year === 2024 && m.month === 1);
    // 2/5 = 0.4 → level 2 (>=0.34, <0.67)
    expect(jan?.level).toBe(2);
  });

  it("gives a perfect month level 4 and an empty month level 0", () => {
    const perfect = buildMonthHistory({
      checkIns: [
        { date: "2024-01-01", status: "done" },
        { date: "2024-01-08", status: "done" },
        { date: "2024-01-15", status: "done" },
        { date: "2024-01-22", status: "done" },
        { date: "2024-01-29", status: "done" },
      ],
      goalStartDate: "2024-01-01",
      targetDays: [1],
      weeklyTarget: null,
      today: "2024-03-15",
      historyStart: "2024-01-01",
    });
    expect(
      perfect.olderMonths.find((m) => m.month === 1)?.level
    ).toBe(4);

    const empty = buildMonthHistory({
      checkIns: [],
      goalStartDate: "2024-01-01",
      targetDays: [1],
      weeklyTarget: null,
      today: "2024-03-15",
      historyStart: "2024-01-01",
    });
    expect(empty.olderMonths.find((m) => m.month === 1)?.level).toBe(0);
  });
});

describe("buildMonthHistory — frequency month boundary", () => {
  it("counts a historical month's final straddling week (not excluded as 'current')", () => {
    // weeklyTarget 1, any day counts. January Mondays: 1, 8, 15, 22, 29 → 5
    // weeks attributed to January. Mark the Jan-1 week and the Jan-29 week met;
    // the Jan-29 week is met by a done on Feb 1 (same ISO week, Monday in Jan).
    //   weeksMet = 2, weeksElapsed = 5 → 0.4 → level 2.
    // The old endDate-as-"current" bug would drop the Jan-29 week:
    //   weeksMet = 1, weeksElapsed = 4 → 0.25 → level 1. So level 2 proves the fix.
    const { olderMonths } = buildMonthHistory({
      checkIns: [
        { date: "2024-01-01", status: "done" }, // Jan-1 week
        { date: "2024-02-01", status: "done" }, // Jan-29 week (Thu), met
      ],
      goalStartDate: "2024-01-01",
      targetDays: [0, 1, 2, 3, 4, 5, 6],
      weeklyTarget: 1,
      today: "2024-04-01",
      historyStart: "2024-01-01",
    });
    const jan = olderMonths.find((m) => m.year === 2024 && m.month === 1);
    expect(jan?.level).toBe(2);
  });
});

describe("buildMonthHistory — fetch-window clamp", () => {
  it("never builds months before the first fully-fetched month", () => {
    // Goal is from mid-2023 but check-ins were only fetched from 2024-01-10.
    // First *full* fetched month is 2024-02. Nothing older should appear, and
    // the partially-fetched January must be dropped.
    const { recentMonths, olderMonths } = buildMonthHistory({
      checkIns: [],
      goalStartDate: "2023-06-15",
      targetDays: [1, 3, 5],
      weeklyTarget: null,
      today: "2024-03-05",
      historyStart: "2024-01-10",
    });
    const all = [...recentMonths, ...olderMonths];
    expect(all.map((m) => [m.year, m.month])).toEqual([
      [2024, 3],
      [2024, 2],
    ]);
    expect(olderMonths).toHaveLength(0);
    // No 2023 months, no partially-fetched January.
    expect(all.some((m) => m.year === 2023)).toBe(false);
    expect(all.some((m) => m.month === 1)).toBe(false);
  });

  it("does not round up when historyStart is already a month boundary", () => {
    const { recentMonths } = buildMonthHistory({
      checkIns: [],
      goalStartDate: "2023-06-15",
      targetDays: [1],
      weeklyTarget: null,
      today: "2024-02-20",
      historyStart: "2024-01-01",
    });
    // First full month is January, so January is allowed in view.
    expect(recentMonths.map((m) => [m.year, m.month])).toEqual([
      [2024, 2],
      [2024, 1],
    ]);
  });
});
