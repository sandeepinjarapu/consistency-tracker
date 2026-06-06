import { describe, it, expect } from "vitest";
import { computeWeeklyGoalStats, totalTarget, type SummaryGoal } from "./weekly-summary";

// Week: Mon 2024-01-15 … Sun 2024-01-21. Weekdays = 1..5.
const WEEK_START = "2024-01-15";
const WEEK_END = "2024-01-21";

const goal = (over: Partial<SummaryGoal>): SummaryGoal => ({
  id: "g1",
  name: "Goal",
  target_days: [1, 2, 3, 4, 5],
  weekly_target: null,
  created_at: "2024-01-01T00:00:00Z",
  ...over,
});

describe("computeWeeklyGoalStats", () => {
  it("counts specific-day target days in the window and done check-ins", () => {
    const stats = computeWeeklyGoalStats(
      [goal({ id: "g1" })],
      [
        { goal_id: "g1", date: "2024-01-15", status: "done" },
        { goal_id: "g1", date: "2024-01-16", status: "done" },
        { goal_id: "g1", date: "2024-01-17", status: "skipped" },
      ],
      WEEK_START,
      WEEK_END
    );
    expect(stats).toEqual([{ name: "Goal", done: 2, target: 5, skipped: 1 }]);
  });

  it("only counts target days on/after the goal's start", () => {
    // Goal created Wed 2024-01-17 → only Wed,Thu,Fri count (3 target days).
    const stats = computeWeeklyGoalStats(
      [goal({ created_at: "2024-01-17T00:00:00Z" })],
      [],
      WEEK_START,
      WEEK_END
    );
    expect(stats[0].target).toBe(3);
  });

  it("scores count goals by weekly_target and eligible done days", () => {
    const stats = computeWeeklyGoalStats(
      [goal({ weekly_target: 3, target_days: [0, 1, 2, 3, 4, 5, 6] })],
      [
        { goal_id: "g1", date: "2024-01-15", status: "done" },
        { goal_id: "g1", date: "2024-01-20", status: "done" },
      ],
      WEEK_START,
      WEEK_END
    );
    expect(stats).toEqual([{ name: "Goal", done: 2, target: 3, skipped: 0 }]);
  });

  it("caps an over-quota count goal at target (3/3, never 4/3)", () => {
    const stats = computeWeeklyGoalStats(
      [goal({ weekly_target: 3, target_days: [0, 1, 2, 3, 4, 5, 6] })],
      [
        { goal_id: "g1", date: "2024-01-15", status: "done" },
        { goal_id: "g1", date: "2024-01-16", status: "done" },
        { goal_id: "g1", date: "2024-01-17", status: "done" },
        { goal_id: "g1", date: "2024-01-18", status: "done" },
      ],
      WEEK_START,
      WEEK_END
    );
    expect(stats).toEqual([{ name: "Goal", done: 3, target: 3, skipped: 0 }]);
  });

  it("excludes an off-target day from a specific-day goal's scored count", () => {
    // Weekday goal; Saturday 01-20 is off-target and must not pad the count.
    const stats = computeWeeklyGoalStats(
      [goal({ id: "g1" })],
      [
        { goal_id: "g1", date: "2024-01-15", status: "done" },
        { goal_id: "g1", date: "2024-01-16", status: "done" },
        { goal_id: "g1", date: "2024-01-20", status: "done" },
      ],
      WEEK_START,
      WEEK_END
    );
    expect(stats).toEqual([{ name: "Goal", done: 2, target: 5, skipped: 0 }]);
  });

  it("skips a count goal created after the week started", () => {
    const stats = computeWeeklyGoalStats(
      [goal({ weekly_target: 3, created_at: "2024-01-18T00:00:00Z" })],
      [],
      WEEK_START,
      WEEK_END
    );
    expect(stats).toEqual([]);
  });

  it("totalTarget sums targets", () => {
    const stats = computeWeeklyGoalStats(
      [goal({ id: "g1" }), goal({ id: "g2", weekly_target: 2, target_days: [0, 6] })],
      [],
      WEEK_START,
      WEEK_END
    );
    expect(totalTarget(stats)).toBe(7);
  });
});
