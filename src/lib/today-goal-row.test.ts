import { describe, it, expect } from "vitest";
import { computeGoalRowState, type GoalRowInput } from "./today-goal-row";

const WEEKDAYS = [1, 2, 3, 4, 5];

// Today = Wed 2024-01-17. Base: a healthy weekday goal done recently.
const base: GoalRowInput = {
  currentStreak: 0,
  streakUnit: "day",
  doneCount: 5,
  targetDays: WEEKDAYS,
  weeklyTarget: null,
  lastDone: "2024-01-16", // yesterday
  createdAt: "2024-01-01",
  today: "2024-01-17",
};

describe("computeGoalRowState — metric", () => {
  it("shows the streak when there is one", () => {
    expect(computeGoalRowState({ ...base, currentStreak: 3 }).metric).toBe(
      "3 day streak"
    );
  });

  it("shows the done-count when there's no streak", () => {
    expect(computeGoalRowState(base).metric).toBe("5 done");
  });

  it("'Just added' for a fresh never-done goal", () => {
    const s = computeGoalRowState({
      ...base,
      doneCount: 0,
      lastDone: null,
      createdAt: "2024-01-12", // 5 days old
    });
    expect(s.metric).toBe("Just added");
    expect(s.nudge).toBeNull();
  });

  it("'Not started' for an old never-done goal", () => {
    expect(
      computeGoalRowState({
        ...base,
        doneCount: 0,
        lastDone: null,
        createdAt: "2024-01-04", // 13 days old
      }).metric
    ).toBe("Not started");
  });
});

describe("computeGoalRowState — resume nudge (had momentum, lapsed)", () => {
  it("nudges after a full cycle of missed weekday occurrences", () => {
    // last done Mon 01-08 → weekdays after it through Wed 01-17 = 7 ≥ 5
    const s = computeGoalRowState({ ...base, lastDone: "2024-01-08" });
    expect(s.nudge).toEqual({ kind: "resume", since: "2024-01-08" });
  });

  it("stays quiet before a full cycle is missed", () => {
    // last done Mon 01-15 → weekdays after it = Tue 16, Wed 17 = 2 < 5
    expect(computeGoalRowState({ ...base, lastDone: "2024-01-15" }).nudge).toBeNull();
  });

  it("count goal: nudges once a full week has elapsed since last done", () => {
    const s = computeGoalRowState({
      ...base,
      weeklyTarget: 3,
      targetDays: [],
      lastDone: "2024-01-08", // prior ISO week → 1 week × 3 = 3 ≥ 3
    });
    expect(s.nudge).toEqual({ kind: "resume", since: "2024-01-08" });
  });

  it("count goal: quiet when last done is in the current week", () => {
    expect(
      computeGoalRowState({
        ...base,
        weeklyTarget: 3,
        targetDays: [],
        lastDone: "2024-01-16", // same ISO week as today
      }).nudge
    ).toBeNull();
  });

  it("a current streak suppresses any nudge", () => {
    expect(
      computeGoalRowState({ ...base, currentStreak: 2, lastDone: "2024-01-01" })
        .nudge
    ).toBeNull();
  });
});

describe("computeGoalRowState — start nudge (never done, gone stale)", () => {
  it("nudges a never-done goal older than ~1.5 weeks", () => {
    const s = computeGoalRowState({
      ...base,
      doneCount: 0,
      lastDone: null,
      createdAt: "2024-01-04", // 13 days
    });
    expect(s.nudge).toEqual({ kind: "start", since: "2024-01-04" });
  });

  it("no start nudge while the goal is still fresh", () => {
    expect(
      computeGoalRowState({
        ...base,
        doneCount: 0,
        lastDone: null,
        createdAt: "2024-01-10", // 7 days
      }).nudge
    ).toBeNull();
  });
});
