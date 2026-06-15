export type SendResult = { ok: boolean; error?: string };

/**
 * Retry a send function up to maxAttempts times, backing off on 429s.
 * Non-rate-limit errors are not retried — they indicate a content or
 * config problem that won't resolve on its own.
 *
 * sleep is injectable so tests can pass a no-op and run instantly.
 */
export async function sendWithRetry(
  fn: () => Promise<SendResult>,
  maxAttempts = 3,
  sleep: (ms: number) => Promise<void> = defaultSleep
): Promise<{ ok: boolean; error?: string; attempts: number }> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await fn();
    if (result.ok) return { ok: true, attempts: attempt };
    const isRateLimit =
      result.error?.includes("rate_limit_exceeded") ||
      result.error?.includes("429") ||
      result.error?.toLowerCase().includes("too many requests");
    if (!isRateLimit || attempt === maxAttempts) {
      return { ok: false, error: result.error, attempts: attempt };
    }
    await sleep(2000 * attempt);
  }
  return { ok: false, error: "max retries exceeded", attempts: maxAttempts };
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
