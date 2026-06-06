import { describe, it, expect } from "vitest";
import { buildWeekRows, weekDateRange } from "./week-rows";
import { isoWeekStart, addDays } from "./dates";

// A fixed reference day; the week is derived via the same helper the code uses,
// so the assertions hold regardless of what weekday the literal lands on.
const today = "2026-06-04";
const weekStart = isoWeekStart(today);
const daily = [0, 1, 2, 3, 4, 5, 6];

describe("buildWeekRows", () => {
  it("puts the current week first, labeled and flagged", () => {
    const rows = buildWeekRows({
      goalStartDate: "2026-01-01",
      today,
      targetDays: daily,
      statusByDate: {},
      weeksToShow: 6,
    });
    expect(rows[0].isCurrent).toBe(true);
    expect(rows[0].label).toBe("This week");
    expect(rows[0].weekStart).toBe(weekStart);
    expect(rows[0].cells).toHaveLength(7);
    expect(rows[1].label).toBe("Last week");
  });

  it("marks today as 'today' and editable when unlogged", () => {
    const rows = buildWeekRows({
      goalStartDate: "2026-01-01",
      today,
      targetDays: daily,
      statusByDate: {},
      weeksToShow: 1,
    });
    const cell = rows[0].cells.find((c) => c.date === today)!;
    expect(cell.state).toBe("today");
    expect(cell.editable).toBe(true);
  });

  it("marks a logged day done, a past unlogged day in-window open, a future day upcoming", () => {
    const mon = weekStart; // start of the current week, on or before today
    const rows = buildWeekRows({
      goalStartDate: "2026-01-01",
      today,
      targetDays: daily,
      statusByDate: { [mon]: "done" },
      weeksToShow: 1,
    });
    const cells = rows[0].cells;
    expect(cells.find((c) => c.date === mon)!.state).toBe("done");

    // The day before today (still this week) is past, unlogged, editable.
    const yest = addDays(today, -1);
    if (yest >= weekStart && yest !== mon) {
      const y = cells.find((c) => c.date === yest)!;
      expect(y.state).toBe("open");
      expect(y.editable).toBe(true);
    }

    // The day after today (still this week) is upcoming and not editable.
    const tom = addDays(today, 1);
    if (tom <= addDays(weekStart, 6)) {
      const t = cells.find((c) => c.date === tom)!;
      expect(t.state).toBe("upcoming");
      expect(t.editable).toBe(false);
    }
  });

  it("locks an old unlogged scheduled day as 'missed' (not editable)", () => {
    const rows = buildWeekRows({
      goalStartDate: "2026-01-01",
      today,
      targetDays: daily,
      statusByDate: {},
      weeksToShow: 6,
    });
    // Three weeks back is well beyond the 2-day grace.
    const old = rows[3];
    const missed = old.cells.find((c) => c.state === "missed");
    expect(missed).toBeDefined();
    expect(missed!.editable).toBe(false);
  });

  // today (2026-06-04) is a Thursday. For a Mon/Wed/Fri goal, Tuesday is an
  // off-target day that has already passed this week and is still in window.
  const mwf = [1, 3, 5]; // Mon/Wed/Fri

  it("offers an off-target current-week day (past, in window) as a loggable extra well", () => {
    const rows = buildWeekRows({
      goalStartDate: "2026-01-01",
      today,
      targetDays: mwf,
      statusByDate: {},
      weeksToShow: 1,
    });
    const tue = addDays(weekStart, 1);
    const cell = rows[0].cells.find((c) => c.date === tue)!;
    expect(cell.state).toBe("extra-open");
    expect(cell.editable).toBe(true);
    expect(cell.extra).toBe(true);
  });

  it("does not offer extra wells on future off-target days", () => {
    const rows = buildWeekRows({
      goalStartDate: "2026-01-01",
      today,
      targetDays: mwf,
      statusByDate: {},
      weeksToShow: 1,
    });
    const sat = addDays(weekStart, 5); // future, off-target
    const cell = rows[0].cells.find((c) => c.date === sat)!;
    expect(cell.state).toBe("rest");
    expect(cell.editable).toBe(false);
  });

  it("shows a logged off-target day as an extra; scheduled days stay non-extra", () => {
    const tue = addDays(weekStart, 1);
    const mon = weekStart;
    const rows = buildWeekRows({
      goalStartDate: "2026-01-01",
      today,
      targetDays: mwf,
      statusByDate: { [tue]: "done", [mon]: "done" },
      weeksToShow: 1,
    });
    const tueCell = rows[0].cells.find((c) => c.date === tue)!;
    expect(tueCell.state).toBe("extra");
    expect(tueCell.extra).toBe(true);
    const monCell = rows[0].cells.find((c) => c.date === mon)!;
    expect(monCell.state).toBe("done");
    expect(monCell.extra).toBe(false);
  });

  it("keeps off-target empty days as rest in past weeks (no extra wells in history)", () => {
    const rows = buildWeekRows({
      goalStartDate: "2026-01-01",
      today,
      targetDays: mwf,
      statusByDate: {},
      weeksToShow: 6,
    });
    const pastTue = addDays(rows[3].weekStart, 1); // off-target, past week
    const cell = rows[3].cells.find((c) => c.date === pastTue)!;
    expect(cell.state).toBe("rest");
    expect(cell.editable).toBe(false);
  });

  it("offers last weekend as extra-open during the Monday grace (follows the server window)", () => {
    const monday = isoWeekStart(today); // force today onto a Monday
    const weekdays = [1, 2, 3, 4, 5]; // Sat/Sun off-target
    const rows = buildWeekRows({
      goalStartDate: "2026-01-01",
      today: monday,
      targetDays: weekdays,
      statusByDate: {},
      weeksToShow: 2,
    });
    const lastWeek = rows[1];
    // Last week's Sat (col 5) and Sun (col 6) are off-target but still in grace.
    expect(lastWeek.cells[5].state).toBe("extra-open");
    expect(lastWeek.cells[5].editable).toBe(true);
    expect(lastWeek.cells[6].state).toBe("extra-open");
    expect(lastWeek.cells[6].editable).toBe(true);
  });

  it("shows a single week for frequency goals (weeksToShow=1)", () => {
    const rows = buildWeekRows({
      goalStartDate: "2026-01-01",
      today,
      targetDays: daily,
      statusByDate: {},
      weeksToShow: 1,
    });
    expect(rows).toHaveLength(1);
  });

  it("never shows a week entirely before the goal started", () => {
    const rows = buildWeekRows({
      goalStartDate: weekStart, // goal began this week
      today,
      targetDays: daily,
      statusByDate: {},
      weeksToShow: 6,
    });
    expect(rows).toHaveLength(1);
  });

  it("attaches a date range to every week", () => {
    const rows = buildWeekRows({
      goalStartDate: "2026-01-01",
      today,
      targetDays: daily,
      statusByDate: {},
      weeksToShow: 2,
    });
    expect(rows[0].dateRange).toBe(weekDateRange(rows[0].weekStart));
    expect(rows[0].dateRange).toMatch(/^[A-Z][a-z]{2} \d/);
  });

  it("during grace, last week's tail stays open while locked frequency days read neutral", () => {
    // Force "today" to be a Monday so last week's Sat/Sun are still in grace.
    const monday = isoWeekStart(today);
    const rows = buildWeekRows({
      goalStartDate: "2026-01-01",
      today: monday,
      targetDays: daily,
      statusByDate: {},
      weeksToShow: 2,
      isCount: true,
    });
    const lastWeek = rows[1];
    // Sunday (col 6) and Saturday (col 5) of last week are inside the grace.
    expect(lastWeek.cells[6].state).toBe("open");
    expect(lastWeek.cells[6].editable).toBe(true);
    expect(lastWeek.cells[5].editable).toBe(true);
    // Monday of last week (col 0) is locked + unlogged. For a frequency goal it
    // is a neutral rest cell, never a "miss".
    expect(lastWeek.cells[0].state).toBe("rest");
    expect(lastWeek.cells[0].editable).toBe(false);
  });

  it("a specific-day goal still locks the same day as 'missed'", () => {
    const monday = isoWeekStart(today);
    const rows = buildWeekRows({
      goalStartDate: "2026-01-01",
      today: monday,
      targetDays: daily,
      statusByDate: {},
      weeksToShow: 2,
      // isCount omitted → specific-day
    });
    expect(rows[1].cells[0].state).toBe("missed");
  });
});

describe("weekDateRange", () => {
  it("formats a same-month week as 'May 11–17'", () => {
    expect(weekDateRange("2026-05-11")).toBe("May 11–17");
  });

  it("spans months as 'Apr 27 – May 3'", () => {
    expect(weekDateRange("2026-04-27")).toBe("Apr 27 – May 3");
  });
});
