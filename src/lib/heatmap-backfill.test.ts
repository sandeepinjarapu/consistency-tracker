import { describe, it, expect } from "vitest";
import {
  backfillAction,
  isBackfillable,
  isExtraLoggable,
  recentEditableDays,
} from "./heatmap-backfill";

// Reference calendar (2024): Mon 01-15 … Sun 01-21 is one ISO week;
// the next week is Mon 01-22 … Sun 01-28.
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [1, 2, 3, 4, 5];
const cell = (date: string, status: "done" | "skipped" | "missed" | "empty") => ({
  date,
  status,
});

describe("backfillAction — mark / clear / lock", () => {
  const base = { goalStartDate: "2024-01-01", targetDays: WEEKDAYS };

  it("marks a missed eligible day in the current week", () => {
    expect(
      backfillAction(cell("2024-01-16", "missed"), { ...base, today: "2024-01-19" })
    ).toBe("mark");
  });

  it("clears a day that already has a check-in", () => {
    expect(
      backfillAction(cell("2024-01-16", "done"), { ...base, today: "2024-01-19" })
    ).toBe("clear");
    expect(
      backfillAction(cell("2024-01-16", "skipped"), { ...base, today: "2024-01-19" })
    ).toBe("clear");
  });

  it("locks future days", () => {
    expect(
      backfillAction(cell("2024-01-18", "empty"), {
        ...base,
        targetDays: ALL_DAYS,
        today: "2024-01-17",
      })
    ).toBeNull();
  });

  it("locks days before the goal existed", () => {
    expect(
      backfillAction(cell("2024-01-12", "missed"), {
        goalStartDate: "2024-01-15",
        targetDays: ALL_DAYS,
        today: "2024-01-19",
      })
    ).toBeNull();
  });

  it("locks off-window weekdays (e.g. Saturday for a weekday goal)", () => {
    expect(
      backfillAction(cell("2024-01-20", "empty"), { ...base, today: "2024-01-21" })
    ).toBeNull();
  });

  it("marks a count-goal past gap (status 'empty') on an eligible day", () => {
    expect(
      backfillAction(cell("2024-01-16", "empty"), {
        ...base,
        targetDays: ALL_DAYS,
        today: "2024-01-19",
      })
    ).toBe("mark");
  });
});

describe("backfillAction — editable time window", () => {
  const base = { goalStartDate: "2024-01-01", targetDays: ALL_DAYS };

  it("keeps the whole current week editable through Sunday", () => {
    // On Sunday you can still fix this week's Monday (6 days back).
    expect(
      backfillAction(cell("2024-01-15", "missed"), { ...base, today: "2024-01-21" })
    ).toBe("mark");
  });

  it("allows the prior Saturday on Monday but not on Tuesday", () => {
    expect(
      backfillAction(cell("2024-01-20", "missed"), { ...base, today: "2024-01-22" })
    ).toBe("mark");
    expect(
      backfillAction(cell("2024-01-20", "missed"), { ...base, today: "2024-01-23" })
    ).toBeNull();
  });

  it("allows the prior Sunday on Tuesday but not on Wednesday", () => {
    expect(
      backfillAction(cell("2024-01-21", "missed"), { ...base, today: "2024-01-23" })
    ).toBe("mark");
    expect(
      backfillAction(cell("2024-01-21", "missed"), { ...base, today: "2024-01-24" })
    ).toBeNull();
  });

  it("locks the prior Friday the following Monday", () => {
    expect(
      backfillAction(cell("2024-01-19", "missed"), { ...base, today: "2024-01-22" })
    ).toBeNull();
  });
});

describe("isBackfillable (shared client/server predicate)", () => {
  const base = { goalStartDate: "2024-01-01", targetDays: ALL_DAYS };

  it("is true for an eligible day inside the window", () => {
    expect(isBackfillable("2024-01-16", { ...base, today: "2024-01-19" })).toBe(true);
  });

  it("is false for future, off-window, pre-goal, and out-of-window days", () => {
    expect(isBackfillable("2024-01-20", { ...base, today: "2024-01-19" })).toBe(false); // future
    expect(
      isBackfillable("2024-01-20", { goalStartDate: "2024-01-01", targetDays: WEEKDAYS, today: "2024-01-21" })
    ).toBe(false); // Saturday, off a weekday window
    expect(isBackfillable("2023-12-31", { ...base, today: "2024-01-19" })).toBe(false); // before goal start
    expect(isBackfillable("2024-01-19", { ...base, today: "2024-01-22" })).toBe(false); // prior Fri locked on Mon
  });

  it("honors the 2-day grace into the previous week", () => {
    expect(isBackfillable("2024-01-20", { ...base, today: "2024-01-22" })).toBe(true); // prior Sat on Mon
    expect(isBackfillable("2024-01-20", { ...base, today: "2024-01-23" })).toBe(false); // prior Sat not on Tue
  });
});

describe("isExtraLoggable (off-target half of the gate)", () => {
  // Weekday goal; Sat 01-20 and Sun 01-21 are off-target.
  const base = { goalStartDate: "2024-01-01", targetDays: WEEKDAYS };

  it("is true for an off-target weekday inside the window", () => {
    // Saturday, today = Saturday.
    expect(isExtraLoggable("2024-01-20", { ...base, today: "2024-01-20" })).toBe(true);
  });

  it("is false on a scheduled (target) day — that's the backfill path", () => {
    expect(isExtraLoggable("2024-01-17", { ...base, today: "2024-01-19" })).toBe(false);
  });

  it("is false for future, pre-goal, and out-of-window off-target days", () => {
    expect(isExtraLoggable("2024-01-21", { ...base, today: "2024-01-20" })).toBe(false); // future Sunday
    expect(
      isExtraLoggable("2024-01-20", { goalStartDate: "2024-01-22", targetDays: WEEKDAYS, today: "2024-01-20" })
    ).toBe(false); // before goal start
    expect(isExtraLoggable("2024-01-13", { ...base, today: "2024-01-22" })).toBe(false); // prior Sat locked on Mon
  });

  it("honors the same 2-day grace as backfill", () => {
    // Prior Sunday 01-21 is off-target; loggable on Tue but not Wed.
    expect(isExtraLoggable("2024-01-21", { ...base, today: "2024-01-23" })).toBe(true);
    expect(isExtraLoggable("2024-01-21", { ...base, today: "2024-01-24" })).toBe(false);
  });

  it("is mutually exclusive with isBackfillable (never both)", () => {
    const opts = { ...base, today: "2024-01-20" };
    for (const date of ["2024-01-17", "2024-01-18", "2024-01-19", "2024-01-20"]) {
      expect(isBackfillable(date, opts) && isExtraLoggable(date, opts)).toBe(false);
    }
  });
});

describe("recentEditableDays", () => {
  // today = Fri 2024-01-19; weekday goal. Window is Mon 01-15 → Fri 01-19.
  const base = {
    goalStartDate: "2024-01-01",
    today: "2024-01-19",
    targetDays: WEEKDAYS,
  };

  it("returns the eligible window newest-first with status + action", () => {
    const days = recentEditableDays({
      ...base,
      statusByDate: { "2024-01-16": "done", "2024-01-18": "skipped" },
    });
    expect(days.map((d) => d.date)).toEqual([
      "2024-01-19",
      "2024-01-18",
      "2024-01-17",
      "2024-01-16",
      "2024-01-15",
    ]);
    expect(days[0]).toMatchObject({
      label: "Today",
      dateLabel: "Jan 19",
      status: "empty",
      action: "mark",
    });
    expect(days[1]).toMatchObject({ label: "Thu", status: "skipped", action: "clear" });
    expect(days[3]).toMatchObject({ label: "Tue", status: "done", action: "clear" });
  });

  it("excludes off-window weekdays and days before the goal started", () => {
    const days = recentEditableDays({
      goalStartDate: "2024-01-17", // goal born Wed
      today: "2024-01-19",
      targetDays: WEEKDAYS,
      statusByDate: {},
    });
    expect(days.map((d) => d.date)).toEqual([
      "2024-01-19",
      "2024-01-18",
      "2024-01-17",
    ]);
  });

  it("honors the 2-day grace into the previous week (Monday)", () => {
    // today = Mon 2024-01-22, daily goal. Editable: Mon 22, Sun 21, Sat 20
    // (prior Fri 19 is already locked).
    const days = recentEditableDays({
      goalStartDate: "2024-01-01",
      today: "2024-01-22",
      targetDays: ALL_DAYS,
      statusByDate: {},
    });
    expect(days.map((d) => d.date)).toEqual([
      "2024-01-22",
      "2024-01-21",
      "2024-01-20",
    ]);
  });
});
