import { describe, it, expect } from "vitest";
import { classifyTodayGoal } from "./today-required";

describe("classifyTodayGoal", () => {
  it("weekly goal met (5 of 5) before today is not required", () => {
    expect(
      classifyTodayGoal({
        weeklyTarget: 5,
        inTargetToday: true,
        hasTodayCheckIn: false,
        scoredDoneBeforeToday: 5,
      })
    ).toBe("over_quota");
  });

  it("weekly goal under quota (4 of 5) is required", () => {
    expect(
      classifyTodayGoal({
        weeklyTarget: 5,
        inTargetToday: true,
        hasTodayCheckIn: false,
        scoredDoneBeforeToday: 4,
      })
    ).toBe("required");
  });

  it("weekly goal that reached quota via today's check-in stays required (visible as done)", () => {
    // Walked into today at 4 of 5, then marked done → now 5 of 5. The card must
    // not vanish: it contributed to the promise today.
    expect(
      classifyTodayGoal({
        weeklyTarget: 5,
        inTargetToday: true,
        hasTodayCheckIn: true,
        scoredDoneBeforeToday: 4,
      })
    ).toBe("required");
  });

  it("weekly goal already met before today but checked in again today stays required", () => {
    // An over-quota done logged today is still shown in place, not hidden.
    expect(
      classifyTodayGoal({
        weeklyTarget: 5,
        inTargetToday: true,
        hasTodayCheckIn: true,
        scoredDoneBeforeToday: 5,
      })
    ).toBe("required");
  });

  it("specific-day goal on a target day is always required", () => {
    expect(
      classifyTodayGoal({
        weeklyTarget: null,
        inTargetToday: true,
        hasTodayCheckIn: false,
        scoredDoneBeforeToday: 0,
      })
    ).toBe("required");
  });

  it("any goal off its target weekday is not a Today task", () => {
    expect(
      classifyTodayGoal({
        weeklyTarget: 5,
        inTargetToday: false,
        hasTodayCheckIn: false,
        scoredDoneBeforeToday: 5,
      })
    ).toBe("not_today");
    expect(
      classifyTodayGoal({
        weeklyTarget: null,
        inTargetToday: false,
        hasTodayCheckIn: false,
        scoredDoneBeforeToday: 0,
      })
    ).toBe("not_today");
  });
});
