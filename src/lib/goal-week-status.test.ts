import { describe, it, expect } from "vitest";
import { computeWeekStatus, type WeekStatusInput } from "./goal-week-status";

const freq: WeekStatusInput = {
  doneThisWeek: 3,
  total: 5,
  isCount: true,
  currentStreak: 0,
  longestStreak: 0,
  streakUnit: "weeks",
  doneCount: 12,
};

const specific: WeekStatusInput = {
  doneThisWeek: 1,
  total: 5,
  isCount: false,
  currentStreak: 0,
  longestStreak: 0,
  streakUnit: "days",
  doneCount: 1,
};

describe("computeWeekStatus — headline + note", () => {
  it("frequency, partial week: counts toward the target", () => {
    const s = computeWeekStatus(freq);
    expect(s.headline).toBe("3 of 5");
    expect(s.note).toBe("2 more to go this week.");
  });

  it("frequency, target met", () => {
    expect(computeWeekStatus({ ...freq, doneThisWeek: 5 }).note).toBe(
      "Target met for this week."
    );
  });

  it("frequency, nothing yet", () => {
    expect(computeWeekStatus({ ...freq, doneThisWeek: 0 }).note).toBe(
      "Nothing logged yet this week."
    );
  });

  it("specific-day, partial week", () => {
    const s = computeWeekStatus(specific);
    expect(s.headline).toBe("1 of 5");
    expect(s.note).toBe("1 done so far this week.");
  });

  it("specific-day, all scheduled days done", () => {
    expect(computeWeekStatus({ ...specific, doneThisWeek: 5 }).note).toBe(
      "Every scheduled day done this week."
    );
  });
});

describe("computeWeekStatus — demoted streak line", () => {
  it("frequency with no streak explains when one begins", () => {
    expect(computeWeekStatus(freq).secondary).toBe(
      "12 done in total · weekly streak begins after a full week"
    );
  });

  it("frequency with a running week streak", () => {
    expect(computeWeekStatus({ ...freq, currentStreak: 2 }).secondary).toBe(
      "12 done in total · 2-week streak"
    );
  });

  it("specific-day running streak shows best when higher", () => {
    expect(
      computeWeekStatus({ ...specific, currentStreak: 3, longestStreak: 7 })
        .secondary
    ).toBe("1 done in total · 3-day streak · best 7");
  });

  it("specific-day with no current streak but past history", () => {
    expect(
      computeWeekStatus({ ...specific, currentStreak: 0, longestStreak: 4 })
        .secondary
    ).toBe("1 done in total · best 4-day streak");
  });

  it("specific-day with no streak history at all", () => {
    expect(computeWeekStatus(specific).secondary).toBe(
      "1 done in total · no streak yet"
    );
  });
});
