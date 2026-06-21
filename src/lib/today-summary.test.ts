import { describe, it, expect } from "vitest";
import { todaySummary } from "./today-summary";

describe("todaySummary", () => {
  it("counts required goals: done / total with remaining", () => {
    expect(
      todaySummary({
        requiredCount: 3,
        doneCount: 1,
        skippedCount: 0,
        remaining: 2,
        extraToday: 0,
        isNightOwl: false,
      })
    ).toBe("1 of 3 done, 2 left");
  });

  it("includes skipped when present", () => {
    expect(
      todaySummary({
        requiredCount: 3,
        doneCount: 1,
        skippedCount: 1,
        remaining: 1,
        extraToday: 0,
        isNightOwl: false,
      })
    ).toBe("1 of 3 done, 1 skipped, 1 left");
  });

  it("the screenshot case: only goal was a quota-met weekly goal → no 'left', not 'scheduled'", () => {
    // requiredCount 0 (the met weekly goal moved to an optional over-quota chip),
    // no off-target extras logged. Must NOT say "1 left".
    expect(
      todaySummary({
        requiredCount: 0,
        doneCount: 0,
        skippedCount: 0,
        remaining: 0,
        extraToday: 0,
        isNightOwl: false,
      })
    ).toBe("Nothing scheduled today.");
  });

  it("no required goals but an off-target extra was logged", () => {
    expect(
      todaySummary({
        requiredCount: 0,
        doneCount: 0,
        skippedCount: 0,
        remaining: 0,
        extraToday: 1,
        isNightOwl: false,
      })
    ).toBe("Nothing scheduled today · 1 extra");
  });

  it("night-owl extras read 'from late last night'", () => {
    expect(
      todaySummary({
        requiredCount: 0,
        doneCount: 0,
        skippedCount: 0,
        remaining: 0,
        extraToday: 2,
        isNightOwl: true,
      })
    ).toBe("Nothing scheduled today · 2 extra from late last night");
  });

  it("all required goals done shows no 'left' tail", () => {
    expect(
      todaySummary({
        requiredCount: 2,
        doneCount: 2,
        skippedCount: 0,
        remaining: 0,
        extraToday: 1,
        isNightOwl: false,
      })
    ).toBe("2 of 2 done · 1 extra");
  });
});
