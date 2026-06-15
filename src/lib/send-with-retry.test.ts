import { describe, it, expect } from "vitest";
import { sendWithRetry } from "./send-with-retry";

const noSleep = () => Promise.resolve();

describe("sendWithRetry", () => {
  it("returns ok:true and attempts:1 on immediate success", async () => {
    const result = await sendWithRetry(() => Promise.resolve({ ok: true }), 3, noSleep);
    expect(result).toEqual({ ok: true, attempts: 1 });
  });

  it("retries on rate_limit_exceeded and succeeds on the second attempt", async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      if (calls === 1) return { ok: false as const, error: "rate_limit_exceeded: Too Many Requests" };
      return { ok: true as const };
    };
    const result = await sendWithRetry(fn, 3, noSleep);
    expect(result).toEqual({ ok: true, attempts: 2 });
    expect(calls).toBe(2);
  });

  it("retries when error contains '429'", async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      if (calls < 3) return { ok: false as const, error: "429 Too Many Requests" };
      return { ok: true as const };
    };
    const result = await sendWithRetry(fn, 3, noSleep);
    expect(result).toEqual({ ok: true, attempts: 3 });
  });

  it("retries when error contains 'too many requests' (case-insensitive)", async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      if (calls === 1) return { ok: false as const, error: "Too Many Requests" };
      return { ok: true as const };
    };
    const result = await sendWithRetry(fn, 3, noSleep);
    expect(result).toEqual({ ok: true, attempts: 2 });
  });

  it("does not retry a non-rate-limit error (403)", async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      return { ok: false as const, error: "403 Forbidden" };
    };
    const result = await sendWithRetry(fn, 3, noSleep);
    expect(result).toEqual({ ok: false, error: "403 Forbidden", attempts: 1 });
    expect(calls).toBe(1);
  });

  it("does not retry an invalid_api_key error", async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      return { ok: false as const, error: "invalid_api_key: Unauthorized" };
    };
    const result = await sendWithRetry(fn, 3, noSleep);
    expect(result.ok).toBe(false);
    expect(result.error).toBe("invalid_api_key: Unauthorized");
    expect(calls).toBe(1);
  });

  it("gives up after maxAttempts and returns the last error", async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      return { ok: false as const, error: "rate_limit_exceeded: Too Many Requests" };
    };
    const result = await sendWithRetry(fn, 3, noSleep);
    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(3);
    expect(calls).toBe(3);
  });

  it("calls sleep with exponential backoff between retries", async () => {
    const delays: number[] = [];
    const sleep = (ms: number) => { delays.push(ms); return Promise.resolve(); };
    let calls = 0;
    const fn = async () => {
      calls++;
      if (calls < 3) return { ok: false as const, error: "rate_limit_exceeded" };
      return { ok: true as const };
    };
    await sendWithRetry(fn, 3, sleep);
    expect(delays).toEqual([2000, 4000]);
  });
});
