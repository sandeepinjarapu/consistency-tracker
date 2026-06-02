import { describe, it, expect } from "vitest";
import {
  buildReactionSummaries,
  reactionSentence,
  type ReactionRow,
} from "./reactions";

const row = (
  kind: "saw" | "proud",
  weekStart: string,
  reactorId = "richa",
  reactorName = "Richa"
): ReactionRow => ({ reactorId, reactorName, kind, weekStart });

describe("buildReactionSummaries", () => {
  it("returns empty for no rows", () => {
    expect(buildReactionSummaries([])).toEqual([]);
  });

  it("counts distinct weeks per reactor+kind and tracks the latest", () => {
    const out = buildReactionSummaries([
      row("proud", "2026-05-04"),
      row("proud", "2026-05-18"),
      row("proud", "2026-05-11"),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: "proud", weeks: 3, latestWeek: "2026-05-18" });
  });

  it("keeps different kinds separate", () => {
    const out = buildReactionSummaries([
      row("proud", "2026-05-18"),
      row("saw", "2026-05-18"),
      row("saw", "2026-05-11"),
    ]);
    const proud = out.find((s) => s.kind === "proud")!;
    const saw = out.find((s) => s.kind === "saw")!;
    expect(proud.weeks).toBe(1);
    expect(saw.weeks).toBe(2);
  });

  it("keeps different reactors separate even with the same name fallback", () => {
    const out = buildReactionSummaries([
      row("proud", "2026-05-18", "a", "A"),
      row("proud", "2026-05-18", "b", "B"),
    ]);
    expect(out).toHaveLength(2);
  });

  it("sorts most-recent first, then by week count", () => {
    const out = buildReactionSummaries([
      row("saw", "2026-05-04", "a", "A"), // older
      row("proud", "2026-05-18", "b", "B"), // newest
    ]);
    expect(out[0].kind).toBe("proud");
    expect(out[1].kind).toBe("saw");
  });
});

describe("reactionSentence", () => {
  const current = "2026-05-25";

  it("phrases a proud streak with 'this week' when latest is the current week", () => {
    expect(
      reactionSentence(
        { kind: "proud", reactorName: "Richa", weeks: 3, latestWeek: "2026-05-25" },
        current
      )
    ).toBe("Richa has been proud of this for 3 weeks, latest this week.");
  });

  it("uses a dated 'week of' when the latest is older", () => {
    expect(
      reactionSentence(
        { kind: "proud", reactorName: "Richa", weeks: 2, latestWeek: "2026-05-18" },
        current
      )
    ).toBe("Richa has been proud of this for 2 weeks, latest week of May 18.");
  });

  it("singularizes a single week", () => {
    expect(
      reactionSentence(
        { kind: "saw", reactorName: "Richa", weeks: 1, latestWeek: "2026-05-25" },
        current
      )
    ).toBe("Richa has noticed this for 1 week, latest this week.");
  });
});
