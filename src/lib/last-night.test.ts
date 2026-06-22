import { describe, expect, it } from "vitest";
import { selectLastNightGoals } from "./last-night";

// Yesterday is Monday 2024-01-15 (dow 1); "today" would be Tue 2024-01-16.
// Monday 2024-01-15 is itself an ISO week start.
const YESTERDAY = "2024-01-15";
const YDOW = 1;
const YWEEK_START = "2024-01-15";

type G = {
  id: string;
  target_days: number[];
  created_at: string;
  weekly_target: number | null;
};

const goals: G[] = [
  { id: "specific", target_days: [1, 3, 5], created_at: "2024-01-01T12:00:00Z", weekly_target: null },
  { id: "count", target_days: [1, 2, 3, 4, 5], created_at: "2024-01-10T08:00:00Z", weekly_target: null },
  { id: "not-target", target_days: [2, 4], created_at: "2024-01-01T12:00:00Z", weekly_target: null },
  { id: "born-today", target_days: [1], created_at: "2024-01-16T01:00:00Z", weekly_target: null },
  { id: "born-yesterday", target_days: [1], created_at: "2024-01-15T23:00:00Z", weekly_target: null },
  { id: "already-logged", target_days: [1], created_at: "2024-01-01T12:00:00Z", weekly_target: null },
];

function run(hour: number, logged: string[] = [], timezone = "UTC") {
  return selectLastNightGoals({
    goals,
    hour,
    yesterday: YESTERDAY,
    yesterdayDow: YDOW,
    yesterdayWeekStart: YWEEK_START,
    loggedYesterday: new Set(logged),
    weekCheckIns: [],
    timezone,
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

  it("resolves the goal's start date in the user's timezone, not UTC", () => {
    // 2024-01-15T19:45:00Z is Jan 16, 1:15am in Asia/Kolkata (UTC+5:30): the
    // goal was born "today" locally, so it must not be eligible for yesterday.
    const justBorn: G[] = [
      { id: "ist", target_days: [1], created_at: "2024-01-15T19:45:00Z", weekly_target: null },
    ];
    const select = (timezone: string) =>
      selectLastNightGoals({
        goals: justBorn,
        hour: 2,
        yesterday: YESTERDAY,
        yesterdayDow: YDOW,
        yesterdayWeekStart: YWEEK_START,
        loggedYesterday: new Set<string>(),
        weekCheckIns: [],
        timezone,
      }).map((g) => g.id);

    expect(select("Asia/Kolkata")).toEqual([]); // born today, locally
    expect(select("UTC")).toEqual(["ist"]); // still Jan 15 in UTC
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

describe("selectLastNightGoals — weekly-count quota (the night-owl half of the daytime fix)", () => {
  // A 3×/week any-day goal.
  const weekly: G = {
    id: "weekly",
    target_days: [0, 1, 2, 3, 4, 5, 6],
    created_at: "2024-01-01T12:00:00Z",
    weekly_target: 3,
  };

  function runWeekly(opts: {
    yesterday: string;
    yesterdayDow: number;
    yesterdayWeekStart: string;
    weekCheckIns: { goal_id: string; date: string; status: string }[];
  }) {
    return selectLastNightGoals({
      goals: [weekly],
      hour: 2,
      loggedYesterday: new Set<string>(),
      timezone: "UTC",
      ...opts,
    }).map((g) => g.id);
  }

  it("mid-week: quota met earlier in the same week → excluded from last-night", () => {
    // Yesterday Thu 2024-01-18 (dow 4), week start Mon 2024-01-15. Three dones
    // Mon/Tue/Wed meet the 3× quota before Thursday.
    expect(
      runWeekly({
        yesterday: "2024-01-18",
        yesterdayDow: 4,
        yesterdayWeekStart: "2024-01-15",
        weekCheckIns: [
          { goal_id: "weekly", date: "2024-01-15", status: "done" },
          { goal_id: "weekly", date: "2024-01-16", status: "done" },
          { goal_id: "weekly", date: "2024-01-17", status: "done" },
        ],
      })
    ).toEqual([]);
  });

  it("mid-week: quota still under target before yesterday → included", () => {
    // Only two dones before Thursday, target 3 → still required.
    expect(
      runWeekly({
        yesterday: "2024-01-18",
        yesterdayDow: 4,
        yesterdayWeekStart: "2024-01-15",
        weekCheckIns: [
          { goal_id: "weekly", date: "2024-01-15", status: "done" },
          { goal_id: "weekly", date: "2024-01-16", status: "done" },
        ],
      })
    ).toEqual(["weekly"]);
  });

  it("Monday 2am: yesterday is Sunday, quota counts against Sunday's ISO week — not the new week", () => {
    // "Today" is Mon 2024-01-22; yesterday is Sun 2024-01-21, in the ISO week
    // starting Mon 2024-01-15. Three dones that week (before Sun) meet the
    // quota → excluded. A today-keyed count would look at the empty new week
    // and wrongly include it.
    expect(
      runWeekly({
        yesterday: "2024-01-21",
        yesterdayDow: 0,
        yesterdayWeekStart: "2024-01-15",
        weekCheckIns: [
          { goal_id: "weekly", date: "2024-01-15", status: "done" },
          { goal_id: "weekly", date: "2024-01-17", status: "done" },
          { goal_id: "weekly", date: "2024-01-19", status: "done" },
        ],
      })
    ).toEqual([]);
  });

  it("Monday 2am: same Sunday, but dones live in the NEW week only → still required", () => {
    // Guard against counting the wrong week: dones dated in the week starting
    // 2024-01-22 (after Sunday) must not count toward Sunday's quota.
    expect(
      runWeekly({
        yesterday: "2024-01-21",
        yesterdayDow: 0,
        yesterdayWeekStart: "2024-01-15",
        weekCheckIns: [
          { goal_id: "weekly", date: "2024-01-22", status: "done" },
          { goal_id: "weekly", date: "2024-01-23", status: "done" },
          { goal_id: "weekly", date: "2024-01-24", status: "done" },
        ],
      })
    ).toEqual(["weekly"]);
  });

  it("a skip yesterday still excludes the goal (already handled by loggedYesterday)", () => {
    expect(
      selectLastNightGoals({
        goals: [weekly],
        hour: 2,
        yesterday: "2024-01-18",
        yesterdayDow: 4,
        yesterdayWeekStart: "2024-01-15",
        loggedYesterday: new Set(["weekly"]),
        weekCheckIns: [],
        timezone: "UTC",
      }).map((g) => g.id)
    ).toEqual([]);
  });
});
