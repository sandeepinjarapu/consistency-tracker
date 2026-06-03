import { describe, it, expect } from "vitest";
import { notableForWeek, type NotableGoal } from "./partner-notable";

// 2026-05-25 and 2026-06-01 are both Mondays; "today" is Thu 2026-06-04, so
// the 05-25 week has ended and the 06-01 week is in progress.
const today = "2026-06-04";
const lastWeek = "2026-05-25";
const thisWeek = "2026-06-01";

const oldSpecific: NotableGoal = {
  createdAt: "2026-01-01",
  targetDays: [1, 3, 5], // Mon/Wed/Fri
  weeklyTarget: null,
};
const oldCount: NotableGoal = {
  createdAt: "2026-01-01",
  targetDays: [1, 2, 3, 4, 5],
  weeklyTarget: 3,
};

const done = (date: string) => ({ date, status: "done" as const });

describe("notableForWeek", () => {
  it("flags a goal created within the week as just started", () => {
    const goal: NotableGoal = { ...oldSpecific, createdAt: "2026-05-27" };
    expect(notableForWeek(goal, [done("2026-05-27")], lastWeek, today)).toBe(
      "Just started"
    );
  });

  it("'just started' beats 'back to it' for a brand-new goal", () => {
    const goal: NotableGoal = { ...oldSpecific, createdAt: "2026-05-26" };
    // No prior-week activity (would otherwise read as a comeback).
    expect(notableForWeek(goal, [done("2026-05-27")], lastWeek, today)).toBe(
      "Just started"
    );
  });

  it("flags a comeback after an empty previous week", () => {
    // Done this week, nothing the week before, goal isn't new.
    expect(
      notableForWeek(oldSpecific, [done("2026-05-27")], lastWeek, today)
    ).toBe("Back to it");
  });

  it("specific goal: a completed full week reads 'Full week'", () => {
    const checkIns = [
      done("2026-05-20"), // prior week → not a comeback
      done("2026-05-25"), // Mon
      done("2026-05-27"), // Wed
      done("2026-05-29"), // Fri
    ];
    expect(notableForWeek(oldSpecific, checkIns, lastWeek, today)).toBe(
      "Full week"
    );
  });

  it("count goal: hitting the weekly target reads 'Target met' (even mid-week)", () => {
    const checkIns = [
      done("2026-05-26"), // prior week → not a comeback
      done("2026-06-01"),
      done("2026-06-02"),
      done("2026-06-03"),
    ];
    expect(notableForWeek(oldCount, checkIns, thisWeek, today)).toBe(
      "Target met"
    );
  });

  it("specific goal: an in-progress week is never 'Full week' yet", () => {
    const checkIns = [
      done("2026-05-26"), // prior week → not a comeback
      done("2026-06-01"),
      done("2026-06-02"),
    ];
    expect(notableForWeek(oldCount, checkIns, thisWeek, today)).not.toBe(
      "Full week"
    );
    // A weekday specific goal mid-week with partial dones → nothing notable.
    const specific: NotableGoal = {
      createdAt: "2026-01-01",
      targetDays: [1, 2, 3, 4, 5],
      weeklyTarget: null,
    };
    expect(notableForWeek(specific, checkIns, thisWeek, today)).toBeNull();
  });

  it("returns null for an ordinary partial completed week", () => {
    const specific: NotableGoal = {
      createdAt: "2026-01-01",
      targetDays: [1, 2, 3, 4, 5],
      weeklyTarget: null,
    };
    const checkIns = [
      done("2026-05-20"), // prior week → not a comeback
      done("2026-05-25"),
      done("2026-05-27"), // only 2 of 5 scheduled
    ];
    expect(notableForWeek(specific, checkIns, lastWeek, today)).toBeNull();
  });
});
