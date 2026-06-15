import { describe, it, expect, vi, beforeEach } from "vitest";
import type { WeeklyGoalStat, ReflectionSummary } from "./email";

// Control the Resend send mock per-test.
const mockSend = vi.fn();
vi.mock("resend", () => ({
  Resend: vi.fn(() => ({ emails: { send: mockSend } })),
}));

// Import after mock is in place.
import { sendWeeklySummary, weeklyHtml, weeklyText } from "./email";

const goals: WeeklyGoalStat[] = [
  { name: "Running", done: 3, target: 5, skipped: 1, extra: 0 },
];

const reflection: ReflectionSummary = {
  continueText: "Morning runs felt great",
  stopText: "Skipping the warm-up",
  improveText: "Lay out clothes the night before",
  notes: "Felt stronger by Thursday",
};

const baseArgs = {
  ownerName: "Arjun",
  ownerId: "u1",
  weekLabel: "Jun 9–15",
  goals,
};

// ── weeklyHtml content tests ─────────────────────────────────────────────────

describe("weeklyHtml — reflection section", () => {
  it("includes 'In their own words' heading in partner email when reflection present", () => {
    const html = weeklyHtml({ ...baseArgs, reflection, self: false });
    expect(html).toContain("In their own words");
  });

  it("includes 'Your reflection' heading in self email when reflection present", () => {
    const html = weeklyHtml({ ...baseArgs, reflection, self: true });
    expect(html).toContain("Your reflection");
    expect(html).not.toContain("In their own words");
  });

  it("renders all four non-empty fields", () => {
    const html = weeklyHtml({ ...baseArgs, reflection, self: false });
    expect(html).toContain("Keep");
    expect(html).toContain("Morning runs felt great");
    expect(html).toContain("Let go");
    expect(html).toContain("Skipping the warm-up");
    expect(html).toContain("Try next");
    expect(html).toContain("Lay out clothes the night before");
    expect(html).toContain("Notes");
    expect(html).toContain("Felt stronger by Thursday");
  });

  it("omits null fields", () => {
    const partial: ReflectionSummary = { continueText: "Great week", stopText: null, improveText: null, notes: null };
    const html = weeklyHtml({ ...baseArgs, reflection: partial, self: false });
    expect(html).toContain("Great week");
    expect(html).not.toContain("Let go");
    expect(html).not.toContain("Try next");
    expect(html).not.toContain("Notes");
  });

  it("omits blank (whitespace-only) fields", () => {
    const partial: ReflectionSummary = { continueText: "  ", stopText: "Let go text", improveText: "", notes: null };
    const html = weeklyHtml({ ...baseArgs, reflection: partial, self: false });
    expect(html).not.toContain("Keep");
    expect(html).toContain("Let go text");
  });

  it("omits the reflection section entirely when reflection is undefined", () => {
    const html = weeklyHtml({ ...baseArgs, self: false });
    expect(html).not.toContain("In their own words");
    expect(html).not.toContain("Your reflection");
  });

  it("omits the reflection section when all fields are null", () => {
    const empty: ReflectionSummary = { continueText: null, stopText: null, improveText: null, notes: null };
    const html = weeklyHtml({ ...baseArgs, reflection: empty, self: false });
    expect(html).not.toContain("In their own words");
  });

  it("escapes HTML special characters in reflection text", () => {
    const xss: ReflectionSummary = { continueText: '<script>alert("xss")</script>', stopText: null, improveText: null, notes: null };
    const html = weeklyHtml({ ...baseArgs, reflection: xss, self: false });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

// ── weeklyText content tests ─────────────────────────────────────────────────

describe("weeklyText — reflection section", () => {
  it("includes 'In their own words' in partner email when reflection present", () => {
    const text = weeklyText({ ...baseArgs, reflection, self: false });
    expect(text).toContain("In their own words:");
  });

  it("includes 'Your reflection' in self email when reflection present", () => {
    const text = weeklyText({ ...baseArgs, reflection, self: true });
    expect(text).toContain("Your reflection:");
    expect(text).not.toContain("In their own words:");
  });

  it("renders all non-empty fields with labels", () => {
    const text = weeklyText({ ...baseArgs, reflection, self: false });
    expect(text).toContain("Keep\nMorning runs felt great");
    expect(text).toContain("Let go\nSkipping the warm-up");
    expect(text).toContain("Try next\nLay out clothes the night before");
    expect(text).toContain("Notes\nFelt stronger by Thursday");
  });

  it("omits the section when reflection is undefined", () => {
    const text = weeklyText({ ...baseArgs, self: false });
    expect(text).not.toContain("In their own words:");
    expect(text).not.toContain("---");
  });
});

// ── sendWeeklySummary — Resend error handling ────────────────────────────────

describe("sendWeeklySummary — Resend SDK v4 error handling", () => {
  beforeEach(() => mockSend.mockReset());

  it("returns ok:true when Resend returns { data, error: null }", async () => {
    mockSend.mockResolvedValueOnce({ data: { id: "msg_1" }, error: null });
    const result = await sendWeeklySummary({ ...baseArgs, to: "a@b.com", self: true });
    expect(result.ok).toBe(true);
  });

  it("returns ok:false when Resend returns { error } instead of throwing", async () => {
    mockSend.mockResolvedValueOnce({
      data: null,
      error: { name: "rate_limit_exceeded", message: "Too Many Requests" },
    });
    const result = await sendWeeklySummary({ ...baseArgs, to: "a@b.com", self: true });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("rate_limit_exceeded");
  });

  it("returns ok:false and surfaces the error name+message", async () => {
    mockSend.mockResolvedValueOnce({
      data: null,
      error: { name: "missing_required_field", message: "to is required" },
    });
    const result = await sendWeeklySummary({ ...baseArgs, to: "a@b.com", self: true });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("missing_required_field: to is required");
  });

  it("returns ok:true without calling Resend when goals array is empty", async () => {
    const result = await sendWeeklySummary({ ...baseArgs, to: "a@b.com", goals: [], self: true });
    expect(result.ok).toBe(true);
    expect(mockSend).not.toHaveBeenCalled();
  });
});
