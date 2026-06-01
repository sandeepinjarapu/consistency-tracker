import { describe, it, expect } from "vitest";
import { partnerSummaryPairs } from "./partner-pairs";

describe("partnerSummaryPairs", () => {
  it("produces both directions for one accepted partnership", () => {
    const pairs = partnerSummaryPairs([
      { inviter_id: "A", accepted_by: "B" },
    ]);
    expect(pairs).toEqual([
      { viewerId: "B", ownerId: "A" },
      { viewerId: "A", ownerId: "B" },
    ]);
  });

  it("de-duplicates when the same partnership was accepted more than once", () => {
    const pairs = partnerSummaryPairs([
      { inviter_id: "A", accepted_by: "B" },
      { inviter_id: "A", accepted_by: "B" }, // duplicate invite row
    ]);
    expect(pairs).toEqual([
      { viewerId: "B", ownerId: "A" },
      { viewerId: "A", ownerId: "B" },
    ]);
  });

  it("skips invites that were never accepted", () => {
    const pairs = partnerSummaryPairs([
      { inviter_id: "A", accepted_by: null },
    ]);
    expect(pairs).toEqual([]);
  });

  it("keeps distinct partnerships separate", () => {
    const pairs = partnerSummaryPairs([
      { inviter_id: "A", accepted_by: "B" },
      { inviter_id: "A", accepted_by: "C" },
    ]);
    expect(pairs).toEqual([
      { viewerId: "B", ownerId: "A" },
      { viewerId: "A", ownerId: "B" },
      { viewerId: "C", ownerId: "A" },
      { viewerId: "A", ownerId: "C" },
    ]);
  });
});
