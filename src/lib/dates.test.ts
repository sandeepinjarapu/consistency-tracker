import { describe, it, expect } from "vitest";
import {
  todayIn,
  dayOfWeekIn,
  goalTargetsDay,
  isoWeekStart,
  addDays,
  dateRange,
  dayOfWeekForDateString,
} from "./dates";

describe("todayIn", () => {
  // Reference: 2024-01-15 22:00 UTC (Monday 10 PM UTC)
  // In IST (UTC+5:30) that's Jan 16 03:30 — the day rolls over.
  // In LA (UTC-8) it's Jan 15 14:00 — same day.
  const ref = new Date("2024-01-15T22:00:00Z");

  it("returns YYYY-MM-DD in UTC", () => {
    expect(todayIn("UTC", ref)).toBe("2024-01-15");
  });

  it("rolls forward in eastward timezones past local midnight", () => {
    expect(todayIn("Asia/Kolkata", ref)).toBe("2024-01-16");
  });

  it("stays on the same day in westward timezones", () => {
    expect(todayIn("America/Los_Angeles", ref)).toBe("2024-01-15");
  });
});

describe("dayOfWeekIn", () => {
  // 2024-01-15 12:00 UTC = Monday everywhere normal
  const monNoonUtc = new Date("2024-01-15T12:00:00Z");

  it("returns 1 for Monday in UTC", () => {
    expect(dayOfWeekIn("UTC", monNoonUtc)).toBe(1);
  });

  it("can roll to Tuesday in eastward timezones past local midnight", () => {
    // 2024-01-15 21:00 UTC = Jan 16 02:30 in IST = Tuesday
    const lateMon = new Date("2024-01-15T21:00:00Z");
    expect(dayOfWeekIn("Asia/Kolkata", lateMon)).toBe(2);
  });

  it("uses Sunday=0..Saturday=6", () => {
    const sun = new Date("2024-01-14T12:00:00Z"); // Sunday
    const sat = new Date("2024-01-20T12:00:00Z"); // Saturday
    expect(dayOfWeekIn("UTC", sun)).toBe(0);
    expect(dayOfWeekIn("UTC", sat)).toBe(6);
  });
});

describe("goalTargetsDay", () => {
  const monday = new Date("2024-01-15T12:00:00Z");
  it("true when day-of-week is in target_days", () => {
    expect(goalTargetsDay([1, 3, 5], "UTC", monday)).toBe(true);
  });
  it("false otherwise", () => {
    expect(goalTargetsDay([0, 6], "UTC", monday)).toBe(false);
  });
});

describe("isoWeekStart", () => {
  it("returns the same date for a Monday", () => {
    expect(isoWeekStart("2024-01-15")).toBe("2024-01-15"); // Mon
  });
  it("returns the prior Monday for a Sunday", () => {
    expect(isoWeekStart("2024-01-14")).toBe("2024-01-08"); // Sun → prior Mon
  });
  it("returns the prior Monday for a Wednesday", () => {
    expect(isoWeekStart("2024-01-17")).toBe("2024-01-15"); // Wed → that week's Mon
  });
  it("crosses a year boundary correctly", () => {
    // 2025-01-01 is a Wednesday; its week starts Mon 2024-12-30
    expect(isoWeekStart("2025-01-01")).toBe("2024-12-30");
  });
});

describe("addDays", () => {
  it("adds and subtracts days", () => {
    expect(addDays("2024-01-15", 1)).toBe("2024-01-16");
    expect(addDays("2024-01-15", -1)).toBe("2024-01-14");
    expect(addDays("2024-01-15", 0)).toBe("2024-01-15");
  });
  it("crosses month boundaries", () => {
    expect(addDays("2024-01-31", 1)).toBe("2024-02-01");
    expect(addDays("2024-03-01", -1)).toBe("2024-02-29"); // leap year
  });
  it("crosses year boundaries", () => {
    expect(addDays("2024-12-31", 1)).toBe("2025-01-01");
    expect(addDays("2025-01-01", -1)).toBe("2024-12-31");
  });
});

describe("dateRange", () => {
  it("returns a single-element array when start === end", () => {
    expect(dateRange("2024-01-15", "2024-01-15")).toEqual(["2024-01-15"]);
  });
  it("returns inclusive range", () => {
    expect(dateRange("2024-01-15", "2024-01-17")).toEqual([
      "2024-01-15",
      "2024-01-16",
      "2024-01-17",
    ]);
  });
  it("returns empty when end < start", () => {
    expect(dateRange("2024-01-17", "2024-01-15")).toEqual([]);
  });
});

describe("dayOfWeekForDateString", () => {
  it("returns correct day-of-week index", () => {
    expect(dayOfWeekForDateString("2024-01-14")).toBe(0); // Sun
    expect(dayOfWeekForDateString("2024-01-15")).toBe(1); // Mon
    expect(dayOfWeekForDateString("2024-01-20")).toBe(6); // Sat
  });
});
