import { describe, it, expect } from "vitest";
import { buildEffortSummary, type EffortRow } from "./effort-summary";

const names = new Map([
  ["w", "Writing"],
  ["s", "Stretch"],
]);

const row = (
  goal_id: string,
  date: string,
  effort_texture: EffortRow["effort_texture"]
): EffortRow => ({ goal_id, date, effort_texture });

describe("buildEffortSummary", () => {
  it("returns empty when nothing is logged", () => {
    expect(buildEffortSummary([], names, "2026-06-15", "2026-06-21")).toEqual([]);
  });

  it("counts flow and light per goal within the week", () => {
    const out = buildEffortSummary(
      [
        row("w", "2026-06-15", "flow"),
        row("w", "2026-06-17", "light"),
        row("w", "2026-06-19", "flow"),
      ],
      names,
      "2026-06-15",
      "2026-06-21"
    );
    expect(out).toEqual([{ goalId: "w", goalName: "Writing", flow: 2, light: 1 }]);
  });

  it("ignores null texture (blank days) and out-of-week dates", () => {
    const out = buildEffortSummary(
      [
        row("w", "2026-06-17", null), // blank — ignored
        row("w", "2026-06-14", "flow"), // before the week — ignored
        row("w", "2026-06-22", "light"), // after the week — ignored
        row("w", "2026-06-18", "flow"), // in week
      ],
      names,
      "2026-06-15",
      "2026-06-21"
    );
    expect(out).toEqual([{ goalId: "w", goalName: "Writing", flow: 1, light: 0 }]);
  });

  it("omits goals with no texture and sorts the rest by name", () => {
    const out = buildEffortSummary(
      [
        row("s", "2026-06-16", "light"),
        row("w", "2026-06-16", "flow"),
      ],
      names,
      "2026-06-15",
      "2026-06-21"
    );
    expect(out.map((g) => g.goalName)).toEqual(["Stretch", "Writing"]);
  });
});
