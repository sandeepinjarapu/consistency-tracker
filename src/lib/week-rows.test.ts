import { describe, it, expect } from "vitest";
import { buildWeekRows } from "./week-rows";
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

  it("treats a non-scheduled weekday as a rest cell", () => {
    const weekdays = [1, 2, 3, 4, 5]; // Mon..Fri (Sun=0, Sat=6 excluded)
    const rows = buildWeekRows({
      goalStartDate: "2026-01-01",
      today,
      targetDays: weekdays,
      statusByDate: {},
      weeksToShow: 1,
    });
    const sat = addDays(weekStart, 5); // sixth column is Saturday
    const cell = rows[0].cells.find((c) => c.date === sat)!;
    expect(cell.state).toBe("rest");
    expect(cell.editable).toBe(false);
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
});
