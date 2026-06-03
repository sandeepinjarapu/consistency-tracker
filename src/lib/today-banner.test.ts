import { describe, it, expect } from "vitest";
import { computeTodayBanner, type TodayBannerInput } from "./today-banner";

// Defaults: a quiet mid-week day with recent activity → nothing shows.
const base: TodayBannerInput = {
  dow: 3, // Wed
  today: "2024-01-17",
  currentWeekHasCheckIn: true,
  lastWeekHasCheckIn: true,
  currentWeekReflected: false,
  lastWeekReflected: false,
  anchorDate: "2024-01-16", // checked in yesterday
};

describe("computeTodayBanner — reflection window", () => {
  it("Saturday with this-week activity → reflect on this week", () => {
    expect(computeTodayBanner({ ...base, dow: 6 })).toEqual({
      kind: "reflect",
      period: "this",
    });
  });

  it("Sunday with this-week activity → reflect on this week", () => {
    expect(computeTodayBanner({ ...base, dow: 0 })).toEqual({
      kind: "reflect",
      period: "this",
    });
  });

  it("Saturday but no this-week activity → no reflect prompt", () => {
    expect(
      computeTodayBanner({ ...base, dow: 6, currentWeekHasCheckIn: false })
    ).toEqual({ kind: "none" });
  });

  it("Saturday but this week already reflected → no reflect prompt", () => {
    expect(
      computeTodayBanner({ ...base, dow: 6, currentWeekReflected: true })
    ).toEqual({ kind: "none" });
  });

  it("Monday with last-week activity → reflect on last week", () => {
    expect(computeTodayBanner({ ...base, dow: 1 })).toEqual({
      kind: "reflect",
      period: "last",
    });
  });

  it("Tuesday with last-week activity → reflect on last week (grace)", () => {
    expect(computeTodayBanner({ ...base, dow: 2 })).toEqual({
      kind: "reflect",
      period: "last",
    });
  });

  it("Tuesday but last week already reflected → no reflect prompt", () => {
    expect(
      computeTodayBanner({ ...base, dow: 2, lastWeekReflected: true })
    ).toEqual({ kind: "none" });
  });

  it("Wednesday is past the grace window → no reflect prompt", () => {
    expect(computeTodayBanner({ ...base, dow: 3 })).toEqual({ kind: "none" });
  });

  it("Friday is before the weekend → no reflect prompt", () => {
    expect(computeTodayBanner({ ...base, dow: 5 })).toEqual({ kind: "none" });
  });
});

describe("computeTodayBanner — drop-off", () => {
  it("no check-in for ≥2 weeks → drop-off with week count", () => {
    // Wed, no recent activity, last anchor 21 days ago
    expect(
      computeTodayBanner({
        ...base,
        currentWeekHasCheckIn: false,
        lastWeekHasCheckIn: false,
        anchorDate: "2023-12-27", // 21 days before 2024-01-17
      })
    ).toEqual({ kind: "dropoff", weeks: 3 });
  });

  it("exactly 13 days is under the threshold → quiet", () => {
    expect(
      computeTodayBanner({
        ...base,
        currentWeekHasCheckIn: false,
        lastWeekHasCheckIn: false,
        anchorDate: "2024-01-04", // 13 days before
      })
    ).toEqual({ kind: "none" });
  });

  it("exactly 14 days trips the threshold → 2 weeks", () => {
    expect(
      computeTodayBanner({
        ...base,
        currentWeekHasCheckIn: false,
        lastWeekHasCheckIn: false,
        anchorDate: "2024-01-03", // 14 days before
      })
    ).toEqual({ kind: "dropoff", weeks: 2 });
  });

  it("brand-new account (anchor=today) never trips drop-off", () => {
    expect(
      computeTodayBanner({
        ...base,
        currentWeekHasCheckIn: false,
        lastWeekHasCheckIn: false,
        anchorDate: "2024-01-17",
      })
    ).toEqual({ kind: "none" });
  });

  it("reflection takes precedence over a (hypothetical) lapse on the weekend", () => {
    // Sat with this-week activity wins even if anchor looks old
    expect(
      computeTodayBanner({ ...base, dow: 6, anchorDate: "2023-12-01" })
    ).toEqual({ kind: "reflect", period: "this" });
  });
});
