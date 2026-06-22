import { describe, it, expect } from "vitest";
import { classifyGoalForLogicalDay, scoredDoneBefore } from "./today-required";

describe("classifyGoalForLogicalDay", () => {
  it("weekly goal met (5 of 5) before the day is over-quota, not required", () => {
    expect(
      classifyGoalForLogicalDay({
        weeklyTarget: 5,
        inTargetDay: true,
        scoredDoneBeforeDay: 5,
      })
    ).toBe("over_quota");
  });

  it("weekly goal under quota (4 of 5) is required", () => {
    expect(
      classifyGoalForLogicalDay({
        weeklyTarget: 5,
        inTargetDay: true,
        scoredDoneBeforeDay: 4,
      })
    ).toBe("required");
  });

  it("weekly goal that reaches quota via the day's check-in stays required (entry state 4 of 5)", () => {
    // Walked into the day at 4 of 5, then marked done → now 5 of 5. Must not
    // vanish: classification is the day's ENTRY state (scoredDoneBeforeDay
    // excludes the day's own check-in), so 4 < 5 → required. It renders as done.
    expect(
      classifyGoalForLogicalDay({
        weeklyTarget: 5,
        inTargetDay: true,
        scoredDoneBeforeDay: 4,
      })
    ).toBe("required");
  });

  it("regression: weekly goal ALREADY met before the day stays over-quota even after a surplus check-in", () => {
    // 5 of 5 entering the day, user taps the over-quota chip → a 6th (surplus)
    // check-in lands on the day. On refresh the goal must remain an optional
    // over-quota chip, NOT flip into a required "1 of 1 done" card that inflates
    // the header denominator. scoredDoneBeforeDay (entry state) is still 5
    // because it excludes the day's own check-in.
    expect(
      classifyGoalForLogicalDay({
        weeklyTarget: 5,
        inTargetDay: true,
        scoredDoneBeforeDay: 5,
      })
    ).toBe("over_quota");
  });

  it("specific-day goal on a target day is always required", () => {
    expect(
      classifyGoalForLogicalDay({
        weeklyTarget: null,
        inTargetDay: true,
        scoredDoneBeforeDay: 0,
      })
    ).toBe("required");
  });

  it("any goal off its target weekday is not applicable to the day", () => {
    expect(
      classifyGoalForLogicalDay({
        weeklyTarget: 5,
        inTargetDay: false,
        scoredDoneBeforeDay: 5,
      })
    ).toBe("not_applicable");
    expect(
      classifyGoalForLogicalDay({
        weeklyTarget: null,
        inTargetDay: false,
        scoredDoneBeforeDay: 0,
      })
    ).toBe("not_applicable");
  });
});

describe("scoredDoneBefore", () => {
  const targetDays = [1, 2, 3, 4, 5]; // Mon–Fri

  it("counts done rows on eligible weekdays within the week, before the date", () => {
    const checkIns = [
      { goal_id: "g", date: "2024-01-15", status: "done" }, // Mon
      { goal_id: "g", date: "2024-01-16", status: "done" }, // Tue
      { goal_id: "g", date: "2024-01-17", status: "done" }, // Wed
    ];
    expect(scoredDoneBefore(checkIns, "g", "2024-01-18", "2024-01-15", targetDays)).toBe(
      3
    );
  });

  it("excludes the date itself and anything after it", () => {
    const checkIns = [
      { goal_id: "g", date: "2024-01-15", status: "done" },
      { goal_id: "g", date: "2024-01-18", status: "done" }, // the day itself
      { goal_id: "g", date: "2024-01-19", status: "done" }, // after
    ];
    expect(scoredDoneBefore(checkIns, "g", "2024-01-18", "2024-01-15", targetDays)).toBe(
      1
    );
  });

  it("excludes rows before the week start (prior ISO week)", () => {
    const checkIns = [
      { goal_id: "g", date: "2024-01-12", status: "done" }, // prior week Fri
      { goal_id: "g", date: "2024-01-15", status: "done" }, // this week Mon
    ];
    expect(scoredDoneBefore(checkIns, "g", "2024-01-17", "2024-01-15", targetDays)).toBe(
      1
    );
  });

  it("excludes skipped rows, off-target weekdays, and other goals", () => {
    const checkIns = [
      { goal_id: "g", date: "2024-01-15", status: "skipped" }, // skipped
      { goal_id: "g", date: "2024-01-13", status: "done" }, // Sat, off-target
      { goal_id: "other", date: "2024-01-16", status: "done" }, // other goal
    ];
    expect(scoredDoneBefore(checkIns, "g", "2024-01-18", "2024-01-15", targetDays)).toBe(
      0
    );
  });
});
