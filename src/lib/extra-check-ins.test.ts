import { describe, it, expect } from "vitest";
import { classifyWeek, isExtraDate } from "./extra-check-ins";

// Week: Mon 2024-01-15 … Sun 2024-01-21. Weekdays = 1..5; Sat = 01-20, Sun = 01-21.
const WEEK_START = "2024-01-15";
const WEEKDAYS = [1, 2, 3, 4, 5];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const START = "2024-01-01";

describe("isExtraDate", () => {
  it("is true off the eligible window, false on it", () => {
    expect(isExtraDate("2024-01-20", WEEKDAYS)).toBe(true); // Saturday
    expect(isExtraDate("2024-01-17", WEEKDAYS)).toBe(false); // Wednesday
  });
});

describe("classifyWeek — specific-day goals", () => {
  const base = {
    weekStart: WEEK_START,
    goalStartDate: START,
    targetDays: WEEKDAYS,
    weeklyTarget: null,
  };

  it("scores done on eligible days; no extras", () => {
    const r = classifyWeek({ ...base, doneDates: ["2024-01-15", "2024-01-16", "2024-01-17"] });
    expect(r).toMatchObject({
      targetCount: 5,
      scoredDone: 3,
      extraOffTarget: 0,
      extraOverQuota: 0,
      extraDone: 0,
      totalDone: 3,
    });
    expect(r.completionRate).toBeCloseTo(3 / 5);
  });

  it("treats an unscheduled day as off-target extra, never scored", () => {
    const r = classifyWeek({ ...base, doneDates: ["2024-01-15", "2024-01-16", "2024-01-20"] });
    expect(r).toMatchObject({
      scoredDone: 2, // Sat does not count toward the promise
      extraOffTarget: 1,
      extraOverQuota: 0,
      extraDone: 1,
      totalDone: 3,
    });
    expect(r.completionRate).toBeCloseTo(2 / 5);
  });

  it("counts target days only on/after the goal's start", () => {
    // Goal born Wed 2024-01-17 → Wed, Thu, Fri are the eligible days.
    const r = classifyWeek({ ...base, goalStartDate: "2024-01-17", doneDates: ["2024-01-17"] });
    expect(r.targetCount).toBe(3);
    expect(r.scoredDone).toBe(1);
  });

  it("ignores dones outside the week or before the goal", () => {
    const r = classifyWeek({
      ...base,
      goalStartDate: "2024-01-16",
      doneDates: ["2024-01-08", "2024-01-15", "2024-01-16", "2024-01-22"],
    });
    expect(r.scoredDone).toBe(1); // only 01-16 is in-week and on/after start
    expect(r.totalDone).toBe(1);
  });
});

describe("classifyWeek — frequency goals", () => {
  const base = {
    weekStart: WEEK_START,
    goalStartDate: START,
    targetDays: ALL_DAYS,
    weeklyTarget: 3,
  };

  it("scores below quota", () => {
    const r = classifyWeek({ ...base, doneDates: ["2024-01-15", "2024-01-16"] });
    expect(r).toMatchObject({ targetCount: 3, scoredDone: 2, extraOverQuota: 0, totalDone: 2 });
    expect(r.completionRate).toBeCloseTo(2 / 3);
  });

  it("caps scored at quota and counts the surplus as over-quota extra", () => {
    const r = classifyWeek({
      ...base,
      doneDates: ["2024-01-15", "2024-01-16", "2024-01-17", "2024-01-18"],
    });
    expect(r).toMatchObject({
      targetCount: 3,
      scoredDone: 3, // never 4 of 3
      extraOverQuota: 1,
      extraOffTarget: 0,
      extraDone: 1,
      totalDone: 4,
    });
    expect(r.completionRate).toBe(1);
  });

  it("separates off-target extras from eligible dones", () => {
    // Eligible window is weekdays only; quota 3. Done Mon/Tue/Wed + Sat.
    const r = classifyWeek({
      ...base,
      targetDays: WEEKDAYS,
      doneDates: ["2024-01-15", "2024-01-16", "2024-01-17", "2024-01-20"],
    });
    expect(r).toMatchObject({
      scoredDone: 3,
      extraOverQuota: 0,
      extraOffTarget: 1, // Saturday
      extraDone: 1,
      totalDone: 4,
    });
  });

  it("combines over-quota and off-target extras", () => {
    // Quota 2 on weekdays. Mon/Tue/Wed eligible (1 over quota) + Sat + Sun.
    const r = classifyWeek({
      weekStart: WEEK_START,
      goalStartDate: START,
      targetDays: WEEKDAYS,
      weeklyTarget: 2,
      doneDates: ["2024-01-15", "2024-01-16", "2024-01-17", "2024-01-20", "2024-01-21"],
    });
    expect(r).toMatchObject({
      scoredDone: 2,
      extraOverQuota: 1,
      extraOffTarget: 2,
      extraDone: 3,
      totalDone: 5,
    });
    expect(r.completionRate).toBe(1);
  });
});
