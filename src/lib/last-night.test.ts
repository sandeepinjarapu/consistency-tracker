import { describe, expect, it } from "vitest";
import { selectLastNightGoals } from "./last-night";

// Yesterday is Monday 2024-01-15 (dow 1); "today" would be Tue 2024-01-16.
const YESTERDAY = "2024-01-15";
const YDOW = 1;

type G = { id: string; target_days: number[]; created_at: string };

const goals: G[] = [
  { id: "specific", target_days: [1, 3, 5], created_at: "2024-01-01T12:00:00Z" },
  { id: "count", target_days: [1, 2, 3, 4, 5], created_at: "2024-01-10T08:00:00Z" },
  { id: "not-target", target_days: [2, 4], created_at: "2024-01-01T12:00:00Z" },
  { id: "born-today", target_days: [1], created_at: "2024-01-16T01:00:00Z" },
  { id: "born-yesterday", target_days: [1], created_at: "2024-01-15T23:00:00Z" },
  { id: "already-logged", target_days: [1], created_at: "2024-01-01T12:00:00Z" },
];

function run(hour: number, logged: string[] = []) {
  return selectLastNightGoals({
    goals,
    hour,
    yesterday: YESTERDAY,
    yesterdayDow: YDOW,
    loggedYesterday: new Set(logged),
  }).map((g) => g.id);
}

describe("selectLastNightGoals", () => {
  it("returns nothing once it's 5am or later", () => {
    expect(run(5)).toEqual([]);
    expect(run(10)).toEqual([]);
    expect(run(23)).toEqual([]);
  });

  it("includes specific-day and count goals scheduled yesterday", () => {
    expect(run(2)).toContain("specific");
    expect(run(2)).toContain("count");
  });

  it("excludes goals not scheduled yesterday", () => {
    expect(run(2)).not.toContain("not-target");
  });

  it("excludes a goal that did not exist yesterday", () => {
    expect(run(2)).not.toContain("born-today");
  });

  it("includes a goal created during yesterday (boundary)", () => {
    expect(run(2)).toContain("born-yesterday");
  });

  it("excludes goals already logged or skipped for yesterday", () => {
    expect(run(2, ["already-logged"])).not.toContain("already-logged");
    expect(run(2)).toContain("already-logged"); // included when not yet logged
  });

  it("returns the full eligible set pre-dawn", () => {
    expect(run(2)).toEqual([
      "specific",
      "count",
      "born-yesterday",
      "already-logged",
    ]);
  });
});
