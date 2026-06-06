import { describe, it, expect } from "vitest";
import { shouldShowAggregateCalendar } from "./calendar-unlock";

describe("shouldShowAggregateCalendar", () => {
  it("hides when there are no check-ins regardless of goal count", () => {
    expect(shouldShowAggregateCalendar(false, 5, false)).toBe(false);
    expect(shouldShowAggregateCalendar(true, 5, false)).toBe(false);
  });

  it("hides when under threshold and not previously unlocked", () => {
    expect(shouldShowAggregateCalendar(false, 0, true)).toBe(false);
    expect(shouldShowAggregateCalendar(false, 1, true)).toBe(false);
    expect(shouldShowAggregateCalendar(false, 2, true)).toBe(false);
  });

  it("shows at exactly the 3-goal threshold", () => {
    expect(shouldShowAggregateCalendar(false, 3, true)).toBe(true);
  });

  it("shows when previously unlocked even if goals drop below threshold", () => {
    expect(shouldShowAggregateCalendar(true, 1, true)).toBe(true);
    expect(shouldShowAggregateCalendar(true, 2, true)).toBe(true);
  });

  it("shows when previously unlocked with many goals", () => {
    expect(shouldShowAggregateCalendar(true, 10, true)).toBe(true);
  });
});
