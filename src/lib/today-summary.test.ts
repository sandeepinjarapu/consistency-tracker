import { describe, it, expect } from "vitest";
import { todaySummary } from "./today-summary";

const base = {
  requiredCount: 0,
  doneCount: 0,
  skippedCount: 0,
  remaining: 0,
  extraToday: 0,
  overQuotaCount: 0,
  isNightOwl: false,
};

describe("todaySummary", () => {
  it("counts required goals: done / total with remaining", () => {
    expect(
      todaySummary({ ...base, requiredCount: 3, doneCount: 1, remaining: 2 })
    ).toBe("1 of 3 done, 2 left");
  });

  it("includes skipped when present", () => {
    expect(
      todaySummary({
        ...base,
        requiredCount: 3,
        doneCount: 1,
        skippedCount: 1,
        remaining: 1,
      })
    ).toBe("1 of 3 done, 1 skipped, 1 left");
  });

  it("the screenshot case: only goal was a quota-met weekly goal → warm 'caught up', not 'left'", () => {
    // requiredCount 0 (the met weekly goal moved to an optional over-quota chip),
    // overQuotaCount 1. Must NOT say "1 left", and should name the win.
    expect(todaySummary({ ...base, overQuotaCount: 1 })).toBe(
      "You're all caught up for the week"
    );
  });

  it("caught up AND logged an off-target extra", () => {
    expect(todaySummary({ ...base, overQuotaCount: 1, extraToday: 1 })).toBe(
      "You're all caught up for the week · 1 extra"
    );
  });

  it("genuinely nothing scheduled today (no goals target today, none met)", () => {
    expect(todaySummary({ ...base })).toBe("Nothing scheduled today.");
  });

  it("no required goals but an off-target extra was logged", () => {
    expect(todaySummary({ ...base, extraToday: 1 })).toBe(
      "Nothing scheduled today · 1 extra"
    );
  });

  it("night-owl extras read 'from late last night'", () => {
    expect(
      todaySummary({ ...base, extraToday: 2, isNightOwl: true })
    ).toBe("Nothing scheduled today · 2 extra from late last night");
  });

  it("all required goals done shows no 'left' tail", () => {
    expect(
      todaySummary({ ...base, requiredCount: 2, doneCount: 2, extraToday: 1 })
    ).toBe("2 of 2 done · 1 extra");
  });

  // extraToday now counts over-quota chips too (page.tsx derives it from the
  // full extraGoals list, not just off-target). These pin the copy that a logged
  // over-quota chip surfaces in the header — "seen, not scored".
  it("a daytime over-quota done chip contributes '· 1 extra'", () => {
    // requiredCount 0, the quota-met goal moved to an over-quota chip and was
    // tapped done → counted in extraToday, named alongside the 'caught up' line.
    expect(
      todaySummary({ ...base, overQuotaCount: 1, extraToday: 1 })
    ).toBe("You're all caught up for the week · 1 extra");
  });

  it("a night-owl over-quota done chip reads '· 1 extra from late last night'", () => {
    expect(
      todaySummary({ ...base, extraToday: 1, isNightOwl: true })
    ).toBe("Nothing scheduled today · 1 extra from late last night");
  });
});
