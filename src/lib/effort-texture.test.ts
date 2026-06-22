import { describe, it, expect } from "vitest";
import { nextEffort } from "./effort-texture";

describe("nextEffort", () => {
  it("sets a texture on a blank done check-in", () => {
    expect(nextEffort(null, "flow")).toBe("flow");
    expect(nextEffort(null, "light")).toBe("light");
  });

  it("clears the texture when the active chip is tapped again", () => {
    expect(nextEffort("flow", "flow")).toBeNull();
    expect(nextEffort("light", "light")).toBeNull();
  });

  it("replaces (never stacks) when the other chip is tapped", () => {
    expect(nextEffort("flow", "light")).toBe("light");
    expect(nextEffort("light", "flow")).toBe("flow");
  });
});
