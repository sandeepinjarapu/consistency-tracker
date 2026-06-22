import { describe, expect, it } from "vitest";
import { buildTodayModel, type TodayModelCheckIn, type TodayModelGoal } from "./today-model";

const baseGoal = {
  name: "Goal",
  target_days: [0, 1, 2, 3, 4, 5, 6],
  weekly_target: null,
  created_at: "2024-01-01T00:00:00Z",
  category: { color: "#22c55e" },
};

function goal(overrides: Partial<TodayModelGoal> & { id: string }): TodayModelGoal {
  return { ...baseGoal, ...overrides };
}

function done(goalId: string, date: string): TodayModelCheckIn {
  return { goal_id: goalId, date, status: "done" };
}

function skipped(goalId: string, date: string): TodayModelCheckIn {
  return { goal_id: goalId, date, status: "skipped" };
}

function model(args: {
  goals: TodayModelGoal[];
  checkIns?: TodayModelCheckIn[];
  today?: string;
  dow?: number;
  hour?: number;
}) {
  return buildTodayModel({
    goals: args.goals,
    checkIns: args.checkIns ?? [],
    today: args.today ?? "2024-01-18",
    dow: args.dow ?? 4,
    hour: args.hour ?? 12,
    timezone: "UTC",
  });
}

describe("buildTodayModel", () => {
  it("keeps an under-quota weekly goal required and counted in the header", () => {
    const g = goal({ id: "weekly", weekly_target: 3 });
    const m = model({
      goals: [g],
      checkIns: [done("weekly", "2024-01-15"), done("weekly", "2024-01-16")],
    });

    expect(m.requiredGoals.map((x) => x.id)).toEqual(["weekly"]);
    expect(m.extraGoals).toEqual([]);
    expect(m.summary).toBe("0 of 1 done, 1 left");
  });

  it("moves a quota-met weekly goal to an over-quota extra chip during daytime", () => {
    const g = goal({ id: "weekly", weekly_target: 3 });
    const m = model({
      goals: [g],
      checkIns: [
        done("weekly", "2024-01-15"),
        done("weekly", "2024-01-16"),
        done("weekly", "2024-01-17"),
      ],
    });

    expect(m.requiredGoals).toEqual([]);
    expect(m.extraGoals).toMatchObject([
      { id: "weekly", status: null, kind: "over_quota" },
    ]);
    expect(m.summary).toBe("You're all caught up for the week");
  });

  it("regression: a daytime surplus check-in (5/5 → 6th) stays a done over-quota chip, not a required card", () => {
    // Quota of 3 already met Mon/Tue/Wed, then a 4th (surplus) logged today via
    // the over-quota chip. On refresh it must NOT flip into a required "1 of 1
    // done" card (which would inflate the header denominator) — it stays an
    // optional, done, removable chip. Requiredness is the day's ENTRY state.
    const g = goal({ id: "weekly", weekly_target: 3 });
    const m = model({
      goals: [g],
      checkIns: [
        done("weekly", "2024-01-15"),
        done("weekly", "2024-01-16"),
        done("weekly", "2024-01-17"),
        done("weekly", "2024-01-18"),
      ],
    });

    expect(m.requiredGoals).toEqual([]);
    expect(m.extraGoals).toMatchObject([
      { id: "weekly", status: "done", kind: "over_quota" },
    ]);
    expect(m.summary).toBe("You're all caught up for the week · 1 extra");
  });

  it("keeps a goal visible as required when today's check-in completes the quota", () => {
    const g = goal({ id: "weekly", weekly_target: 3 });
    const m = model({
      goals: [g],
      checkIns: [
        done("weekly", "2024-01-15"),
        done("weekly", "2024-01-16"),
        done("weekly", "2024-01-18"),
      ],
    });

    expect(m.requiredGoals.map((x) => x.id)).toEqual(["weekly"]);
    expect(m.extraGoals).toEqual([]);
    expect(m.summary).toBe("1 of 1 done");
  });

  it("keeps off-target extras separate from required goals", () => {
    const scheduled = goal({ id: "scheduled", target_days: [4] });
    const offTarget = goal({ id: "off", target_days: [1] });
    const m = model({
      goals: [scheduled, offTarget],
      checkIns: [done("off", "2024-01-18")],
    });

    expect(m.requiredGoals.map((x) => x.id)).toEqual(["scheduled"]);
    expect(m.extraGoals).toMatchObject([
      { id: "off", status: "done", kind: "off_target" },
    ]);
    expect(m.summary).toBe("0 of 1 done, 1 left · 1 extra");
  });

  it("moves night-owl quota-met yesterday goals to last-night over-quota chips", () => {
    const g = goal({ id: "weekly", weekly_target: 3 });
    const m = model({
      goals: [g],
      today: "2024-01-19",
      dow: 5,
      hour: 2,
      checkIns: [
        done("weekly", "2024-01-15"),
        done("weekly", "2024-01-16"),
        done("weekly", "2024-01-17"),
      ],
    });

    expect(m.lastNightRequiredGoals).toEqual([]);
    expect(m.extraDate).toBe("2024-01-18");
    expect(m.extraGoals).toMatchObject([
      { id: "weekly", status: null, kind: "over_quota" },
    ]);
    expect(m.summary).toBe("Nothing scheduled today.");
  });

  it("counts a done night-owl over-quota chip as extra from late last night", () => {
    const g = goal({ id: "weekly", weekly_target: 3 });
    const m = model({
      goals: [g],
      today: "2024-01-19",
      dow: 5,
      hour: 2,
      checkIns: [
        done("weekly", "2024-01-15"),
        done("weekly", "2024-01-16"),
        done("weekly", "2024-01-17"),
        done("weekly", "2024-01-18"),
      ],
    });

    expect(m.extraGoals).toMatchObject([
      { id: "weekly", status: "done", kind: "over_quota" },
    ]);
    expect(m.summary).toBe("Nothing scheduled today · 1 extra from late last night");
  });

  it("uses yesterday's ISO week for Monday pre-dawn night-owl quota", () => {
    const g = goal({ id: "weekly", weekly_target: 3 });
    const m = model({
      goals: [g],
      today: "2024-01-22",
      dow: 1,
      hour: 2,
      checkIns: [
        done("weekly", "2024-01-15"),
        done("weekly", "2024-01-17"),
        done("weekly", "2024-01-19"),
      ],
    });

    expect(m.lastNightRequiredGoals).toEqual([]);
    expect(m.extraDate).toBe("2024-01-21");
    expect(m.extraGoals).toMatchObject([{ id: "weekly", kind: "over_quota" }]);
  });

  it("hides skipped night-owl over-quota extras from the chip row", () => {
    const g = goal({ id: "weekly", weekly_target: 3 });
    const m = model({
      goals: [g],
      today: "2024-01-19",
      dow: 5,
      hour: 2,
      checkIns: [
        done("weekly", "2024-01-15"),
        done("weekly", "2024-01-16"),
        done("weekly", "2024-01-17"),
        skipped("weekly", "2024-01-18"),
      ],
    });

    expect(m.requiredGoals).toEqual([]);
    expect(m.extraGoals).toEqual([]);
    expect(m.summary).toBe("Nothing scheduled today.");
  });
});
