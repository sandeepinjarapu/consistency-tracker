import { describe, it, expect } from "vitest";
import { computeWeekStats, reflectionCompletionRate } from "./reflection-stats";
import { computeStats } from "./stats";
import { computeWeeklyGoalStats } from "./weekly-summary";

/**
 * Golden cross-surface fixture. One shared week of data, run through every
 * surface that derives a number from it, so a future change that drifts one
 * surface's semantics fails here loudly.
 *
 * The week is Mon 2024-01-15 .. Sun 2024-01-21, fully in the past.
 * Two goals:
 *   - "Read": specific-day (Mon/Wed/Fri). Mon done, Wed skipped, Fri missed.
 *   - "Gym": count goal, 3×/week. Mon+Tue done, Wed+Thu skipped (2 extra skips
 *     beyond the quota — the case that used to distort Reflections).
 *
 * The surfaces deliberately answer DIFFERENT questions; this test pins down
 * both the agreements and the intended divergences.
 */
const WEEK_START = "2024-01-15";
const WEEK_END = "2024-01-21";
const AFTER_WEEK = "2024-02-01"; // so the week reads as complete
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const READ_DAYS = [1, 3, 5]; // Mon/Wed/Fri

const goals = [
  { id: "read", name: "Read", target_days: READ_DAYS, created_at: "2024-01-01T00:00:00Z" },
  { id: "gym", name: "Gym", target_days: ALL_DAYS, created_at: "2024-01-01T00:00:00Z", weekly_target: 3 },
];

// goal_id-keyed check-ins (Reflections + Email shape)
const checkIns = [
  { goal_id: "read", date: "2024-01-15", status: "done" as const, skip_reason: null, note: null }, // Mon
  { goal_id: "read", date: "2024-01-17", status: "skipped" as const, skip_reason: "tired", note: null }, // Wed
  // Fri 2024-01-19: no check-in → missed
  { goal_id: "gym", date: "2024-01-15", status: "done" as const, skip_reason: null, note: null },
  { goal_id: "gym", date: "2024-01-16", status: "done" as const, skip_reason: null, note: null },
  { goal_id: "gym", date: "2024-01-17", status: "skipped" as const, skip_reason: "rest", note: null },
  { goal_id: "gym", date: "2024-01-18", status: "skipped" as const, skip_reason: "rest", note: null },
];

describe("cross-surface metrics consistency (one shared week)", () => {
  it("Reflections: quota-based completion, skips don't punish the count goal", () => {
    const stats = computeWeekStats({
      start: WEEK_START,
      end: WEEK_END,
      today: AFTER_WEEK,
      goals,
      checkIns,
    });

    const read = stats.perGoal.find((g) => g.goalId === "read")!;
    const gym = stats.perGoal.find((g) => g.goalId === "gym")!;
    // Read: 1 done of 3 eligible days.
    expect(read.done).toBe(1);
    expect(read.completion).toBeCloseTo(1 / 3, 5);
    // Gym: 2 done toward a quota of 3 → 2/3, regardless of the 2 extra skips.
    expect(gym.done).toBe(2);
    expect(gym.skipped).toBe(2);
    expect(gym.completion).toBeCloseTo(2 / 3, 5);

    // Aggregate is target-weighted: (min(1,3) + min(2,3)) / (3 + 3) = 0.5.
    expect(reflectionCompletionRate(stats)).toBeCloseTo(0.5, 5);
  });

  it("Email: scored done / target / on-target skipped per goal (no percentage)", () => {
    const stats = computeWeeklyGoalStats(
      goals.map((g) => ({
        id: g.id,
        name: g.name,
        target_days: g.target_days,
        weekly_target: "weekly_target" in g ? g.weekly_target : null,
        created_at: g.created_at,
      })),
      checkIns.map((c) => ({ goal_id: c.goal_id, date: c.date, status: c.status })),
      WEEK_START,
      WEEK_END
    );

    const read = stats.find((s) => s.name === "Read")!;
    const gym = stats.find((s) => s.name === "Gym")!;
    expect(read).toMatchObject({ done: 1, target: 3, skipped: 1 });
    // Gym target is the weekly quota, not the number of eligible days.
    expect(gym).toMatchObject({ done: 2, target: 3, skipped: 2 });
  });

  it("Partner/Goal (in-week view): per-goal completion agrees with Reflections", () => {
    // A single-week window: the week containing endDate is the in-progress
    // week, so count goals fall back to within-week quota progress — matching
    // the Reflections per-goal number.
    const read = computeStats({
      startDate: WEEK_START,
      endDate: WEEK_END,
      targetDays: READ_DAYS,
      checkIns: [
        { date: "2024-01-15", status: "done" },
        { date: "2024-01-17", status: "skipped" },
      ],
    });
    expect(read.completionRate).toBeCloseTo(1 / 3, 5);

    const gym = computeStats({
      startDate: WEEK_START,
      endDate: WEEK_END,
      targetDays: ALL_DAYS,
      weeklyTarget: 3,
      checkIns: [
        { date: "2024-01-15", status: "done" },
        { date: "2024-01-16", status: "done" },
        { date: "2024-01-17", status: "skipped" },
        { date: "2024-01-18", status: "skipped" },
      ],
    });
    expect(gym.completionRate).toBeCloseTo(2 / 3, 5);
    expect(gym.streakUnit).toBe("week");
  });

  it("Partner/Goal (viewed a week later): count goal switches to weeks-met", () => {
    // INTENTIONAL divergence: once the Gym week is a completed (not current)
    // week, the partner/goal surface scores it as weeks-met / weeks-elapsed.
    // 2 done < the 3× quota → that week wasn't "met" → 0%, even though
    // Reflections reported 2/3 for the same week's within-week progress.
    const gym = computeStats({
      startDate: WEEK_START,
      endDate: "2024-01-28", // the following Sunday → Jan 15 week is now complete
      targetDays: ALL_DAYS,
      weeklyTarget: 3,
      checkIns: [
        { date: "2024-01-15", status: "done" },
        { date: "2024-01-16", status: "done" },
        { date: "2024-01-17", status: "skipped" },
        { date: "2024-01-18", status: "skipped" },
      ],
    });
    expect(gym.completionRate).toBe(0);
  });
});
