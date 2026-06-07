import { describe, it, expect } from "vitest";
import { shouldShowAggregateCalendar, engagementUnlocked } from "./calendar-unlock";

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

describe("engagementUnlocked", () => {
  it("unlocks with exactly 1 goal, 8+ scored done, 3+ weeks", () => {
    expect(engagementUnlocked(1, 8, 3)).toBe(true);
    expect(engagementUnlocked(1, 20, 10)).toBe(true);
  });

  it("does not unlock for 2+ active goals", () => {
    expect(engagementUnlocked(2, 8, 3)).toBe(false);
    expect(engagementUnlocked(3, 8, 3)).toBe(false);
  });

  it("does not unlock under the scored done threshold", () => {
    expect(engagementUnlocked(1, 7, 3)).toBe(false);
    expect(engagementUnlocked(1, 0, 0)).toBe(false);
  });

  it("does not unlock under the week-count threshold", () => {
    expect(engagementUnlocked(1, 8, 2)).toBe(false);
    expect(engagementUnlocked(1, 20, 1)).toBe(false);
  });

  it("requires all three conditions simultaneously", () => {
    // Correct goal count and check-in count but only 2 weeks
    expect(engagementUnlocked(1, 8, 2)).toBe(false);
    // Correct goal count and week count but only 7 check-ins
    expect(engagementUnlocked(1, 7, 3)).toBe(false);
  });

  // Regression: 2-goal users must not unlock via engagement; they need either a
  // persisted flag or the 3-goal primary path. This is a deliberate product
  // choice: two goals is not "one focused goal" and not a true aggregate view.
  it("does not unlock for 2 goals even with strong engagement history", () => {
    expect(engagementUnlocked(2, 50, 20)).toBe(false);
  });

  // Regression: frequency over-quota extras must not push the scored count over
  // the threshold. The caller (page.tsx) is responsible for using classifyWeek
  // instead of isExtraDate alone, but the pure function itself must enforce that
  // a caller passing inflated counts still fails the threshold.
  // Example: 2x/week goal, 4 eligible dones/week × 3 weeks = 12 raw eligible,
  // but only 6 scored (min(4, 2) × 3). If caller correctly passes 6 scored,
  // it does not unlock (6 < 8).
  it("does not unlock when only 6 scored dones are passed (over-quota scenario)", () => {
    expect(engagementUnlocked(1, 6, 3)).toBe(false);
  });
});
