import { describe, it, expect } from "vitest";
import { buildWeekRings } from "./goal-week-rings";

// today = 2024-06-10 (Monday). currentWeekStart = "2024-06-10".
// Completed weeks (oldest → newest):
//   [0] 2024-04-29 – 2024-05-05
//   [1] 2024-05-06 – 2024-05-12
//   [2] 2024-05-13 – 2024-05-19
//   [3] 2024-05-20 – 2024-05-26
//   [4] 2024-05-27 – 2024-06-02
//   [5] 2024-06-03 – 2024-06-09
const TODAY = "2024-06-10";

// Daily specific-day goal, started before the window.
const DAILY: Parameters<typeof buildWeekRings>[0] = {
  goalStartDate: "2024-04-01",
  targetDays: [0, 1, 2, 3, 4, 5, 6],
  weeklyTarget: null,
  doneDates: [],
  skipDates: [],
  today: TODAY,
};

// 3× per week frequency goal.
const FREQ: Parameters<typeof buildWeekRings>[0] = {
  goalStartDate: "2024-04-01",
  targetDays: [0, 1, 2, 3, 4, 5, 6],
  weeklyTarget: 3,
  doneDates: [],
  skipDates: [],
  today: TODAY,
};

// Mon-only goal (targetDays=[1], 0=Sun,1=Mon)
const MON_ONLY: Parameters<typeof buildWeekRings>[0] = {
  goalStartDate: "2024-04-01",
  targetDays: [1],
  weeklyTarget: null,
  doneDates: [],
  skipDates: [],
  today: TODAY,
};

describe("buildWeekRings", () => {
  // ── Basics ─────────────────────────────────────────────────────────────────

  it("returns exactly weekCount rings, oldest first", () => {
    const rings = buildWeekRings(DAILY);
    expect(rings).toHaveLength(6);
    expect(rings[0].weekStart).toBe("2024-04-29");
    expect(rings[5].weekStart).toBe("2024-06-03");
  });

  it("respects weekCount override", () => {
    const rings = buildWeekRings({ ...DAILY, weekCount: 4 });
    expect(rings).toHaveLength(4);
    expect(rings[3].weekStart).toBe("2024-06-03");
  });

  it("never includes the current in-progress week", () => {
    const rings = buildWeekRings(DAILY);
    expect(rings.every((r) => r.weekStart < TODAY)).toBe(true);
  });

  // ── not-started ────────────────────────────────────────────────────────────

  it("marks weeks whose end date is before goalStartDate as not-started", () => {
    const rings = buildWeekRings({ ...DAILY, goalStartDate: "2024-05-20" });
    expect(rings[0].state).toBe("not-started"); // Apr 29–May 5 ends before May 20
    expect(rings[1].state).toBe("not-started"); // May 6–12
    expect(rings[2].state).toBe("not-started"); // May 13–19
    expect(rings[3].state).not.toBe("not-started"); // May 20–26 — goal started
  });

  it("not-started: tooltip is 'Before goal started'", () => {
    const rings = buildWeekRings({ ...DAILY, goalStartDate: "2024-06-01" });
    rings.filter((r) => r.state === "not-started").forEach((r) => {
      expect(r.tooltip).toBe("Before goal started");
    });
  });

  // ── empty ──────────────────────────────────────────────────────────────────

  it("empty when goal is active but no done or skip check-ins", () => {
    const rings = buildWeekRings(DAILY);
    rings.forEach((r) => expect(r.state).toBe("empty"));
  });

  it("empty tooltip contains week date and 'No check-ins'", () => {
    const rings = buildWeekRings(DAILY);
    expect(rings[5].tooltip).toContain("Week of");
    expect(rings[5].tooltip).toContain("No check-ins");
  });

  // ── skipped ────────────────────────────────────────────────────────────────

  it("skipped when only skip check-ins exist that week (no done, no extras)", () => {
    const rings = buildWeekRings({
      ...DAILY,
      skipDates: ["2024-06-03", "2024-06-04"],
    });
    expect(rings[5].state).toBe("skipped");
  });

  it("skipped tooltip contains 'Skipped'", () => {
    const rings = buildWeekRings({ ...DAILY, skipDates: ["2024-06-05"] });
    expect(rings[5].tooltip).toContain("Skipped");
  });

  it("skipped in one week does not affect adjacent weeks", () => {
    const rings = buildWeekRings({ ...DAILY, skipDates: ["2024-06-03"] });
    expect(rings[5].state).toBe("skipped");
    expect(rings[4].state).toBe("empty"); // May 27–Jun 2 untouched
  });

  it("done overrides skip: a week with both done and skip is not skipped", () => {
    const rings = buildWeekRings({
      ...DAILY,
      doneDates: ["2024-06-03"],
      skipDates: ["2024-06-04", "2024-06-05"],
    });
    // 1 of 7 done → partial, not skipped
    expect(rings[5].state).toBe("partial");
  });

  // ── partial ────────────────────────────────────────────────────────────────

  it("partial when some scored done check-ins but target not met", () => {
    const rings = buildWeekRings({ ...DAILY, doneDates: ["2024-06-03", "2024-06-04", "2024-06-05"] });
    const r = rings[5];
    expect(r.state).toBe("partial");
    expect(r.completionRate).toBeCloseTo(3 / 7);
    expect(r.tooltip).toContain("3 check-ins");
  });

  // Regression: extra-only weeks must not appear as empty.
  it("partial (extra-only) when only off-target extras logged (no scored done)", () => {
    // Mon-only goal. Tue Jun 4 is off-target → extraDone=1, scoredDone=0.
    const rings = buildWeekRings({ ...MON_ONLY, doneDates: ["2024-06-04"] });
    const r = rings[5];
    expect(r.state).toBe("partial");
    expect(r.completionRate).toBe(0);
    expect(r.extraDone).toBe(1);
    expect(r.tooltip).toContain("extra");
  });

  it("partial (extra-only) tooltip mentions 'extra check-in' without 'only'", () => {
    const rings = buildWeekRings({ ...MON_ONLY, doneDates: ["2024-06-04"] });
    expect(rings[5].tooltip).toContain("1 extra check-in");
    expect(rings[5].tooltip).not.toContain("only");
  });

  it("partial (extra-only): extraDone=2 gives correct tooltip", () => {
    const rings = buildWeekRings({ ...MON_ONLY, doneDates: ["2024-06-04", "2024-06-05"] });
    expect(rings[5].tooltip).toContain("2 extra check-ins");
    expect(rings[5].tooltip).not.toContain("only");
  });

  it("frequency goal: partial when scoredDone < weeklyTarget", () => {
    const rings = buildWeekRings({ ...FREQ, doneDates: ["2024-06-03"] });
    expect(rings[5].state).toBe("partial");
    expect(rings[5].completionRate).toBeCloseTo(1 / 3);
  });

  // ── met ────────────────────────────────────────────────────────────────────

  it("met when all 7 eligible days done on daily goal", () => {
    const doneDates = ["2024-06-03", "2024-06-04", "2024-06-05", "2024-06-06", "2024-06-07", "2024-06-08", "2024-06-09"];
    const rings = buildWeekRings({ ...DAILY, doneDates });
    expect(rings[5].state).toBe("met");
    expect(rings[5].completionRate).toBe(1);
  });

  it("frequency: met when scoredDone >= weeklyTarget", () => {
    const rings = buildWeekRings({ ...FREQ, doneDates: ["2024-06-03", "2024-06-04", "2024-06-05"] });
    expect(rings[5].state).toBe("met");
  });

  // ── extra ──────────────────────────────────────────────────────────────────

  it("extra when met target AND off-target extras present", () => {
    // Mon-only goal, scored Mon Jun 3 + extra Tue Jun 4
    const rings = buildWeekRings({ ...MON_ONLY, doneDates: ["2024-06-03", "2024-06-04"] });
    expect(rings[5].state).toBe("extra");
    expect(rings[5].tooltip).toContain("1 extra");
  });

  it("frequency: extra when over-quota dones (4 done on 3x/week goal)", () => {
    const rings = buildWeekRings({ ...FREQ, doneDates: ["2024-06-03", "2024-06-04", "2024-06-05", "2024-06-06"] });
    expect(rings[5].state).toBe("extra");
    expect(rings[5].completionRate).toBe(1);
    expect(rings[5].tooltip).toContain("extra");
  });

  it("completionRate never exceeds 1 regardless of how many dones", () => {
    const doneDates = ["2024-06-03", "2024-06-04", "2024-06-05", "2024-06-06", "2024-06-07"];
    const rings = buildWeekRings({ ...FREQ, doneDates });
    rings.forEach((r) => expect(r.completionRate).toBeLessThanOrEqual(1));
  });

  // ── Multi-week isolation ───────────────────────────────────────────────────

  it("only counts check-ins in the correct week boundary", () => {
    // Dones only in rings[2] (May 13–19)
    const doneDates = ["2024-05-13", "2024-05-14", "2024-05-15", "2024-05-16", "2024-05-17", "2024-05-18", "2024-05-19"];
    const rings = buildWeekRings({ ...DAILY, doneDates });
    expect(rings[2].state).toBe("met");
    expect(rings[1].state).toBe("empty"); // May 6–12
    expect(rings[3].state).toBe("empty"); // May 20–26
  });

  it("skip dates in one week do not bleed into adjacent weeks", () => {
    const rings = buildWeekRings({ ...DAILY, skipDates: ["2024-06-03"] });
    expect(rings[5].state).toBe("skipped"); // Jun 3–9
    expect(rings[4].state).toBe("empty");   // May 27–Jun 2
  });
});
