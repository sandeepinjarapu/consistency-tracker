import { describe, it, expect } from "vitest";
import { safeExternalUrl, safeNextPath } from "./url";

describe("safeExternalUrl", () => {
  it("allows http and https", () => {
    expect(safeExternalUrl("http://example.com/doc")).toBe(
      "http://example.com/doc"
    );
    expect(safeExternalUrl("https://docs.google.com/d/abc")).toBe(
      "https://docs.google.com/d/abc"
    );
  });

  it("rejects javascript: and other script schemes", () => {
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("JavaScript:alert(1)")).toBeNull();
    expect(safeExternalUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safeExternalUrl("vbscript:msgbox(1)")).toBeNull();
  });

  it("rejects non-URL / empty input", () => {
    expect(safeExternalUrl("not a url")).toBeNull();
    expect(safeExternalUrl("")).toBeNull();
    expect(safeExternalUrl(null)).toBeNull();
    expect(safeExternalUrl(undefined)).toBeNull();
  });
});

describe("safeNextPath", () => {
  const origin = "https://app.test";

  it("keeps same-origin relative paths", () => {
    expect(safeNextPath("/consistencytracker/goals", origin)).toBe(
      "/consistencytracker/goals"
    );
    expect(safeNextPath("/foo?x=1#h", origin)).toBe("/foo?x=1#h");
  });

  it("falls back for off-origin targets", () => {
    expect(safeNextPath("//evil.com", origin)).toBe("/consistencytracker");
    expect(safeNextPath("https://evil.com/phish", origin)).toBe(
      "/consistencytracker"
    );
    // `@evil.com` resolves to a same-origin path, not a host — so it stays
    // on-origin rather than redirecting away.
    expect(safeNextPath("@evil.com", origin)).toBe("/@evil.com");
  });

  it("keeps same-origin absolute URLs as paths", () => {
    expect(safeNextPath("https://app.test/dashboard", origin)).toBe(
      "/dashboard"
    );
  });

  it("falls back for empty / missing input", () => {
    expect(safeNextPath(null, origin)).toBe("/consistencytracker");
    expect(safeNextPath("", origin)).toBe("/consistencytracker");
    expect(safeNextPath(undefined, origin)).toBe("/consistencytracker");
  });
});
