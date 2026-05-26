// Timezone-aware date helpers. All "today" computations should go through
// these — never use `new Date().toISOString().slice(0,10)` directly, since
// that ignores the user's timezone.

const DAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

/**
 * Returns YYYY-MM-DD for "today" as the user perceives it in their timezone.
 */
export function todayIn(timezone: string, ref: Date = new Date()): string {
  // en-CA locale formats as YYYY-MM-DD, which matches Postgres date format.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ref);
}

/**
 * Day of week (0=Sun..6=Sat) for the given date in the user's timezone.
 */
export function dayOfWeekIn(timezone: string, ref: Date = new Date()): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  }).format(ref);
  return DAY_INDEX[weekday] ?? 0;
}

/**
 * Does a goal with these target_days fire on the given date?
 */
export function goalTargetsDay(
  targetDays: number[],
  timezone: string,
  ref: Date = new Date()
): boolean {
  return targetDays.includes(dayOfWeekIn(timezone, ref));
}

/**
 * Monday of the ISO week that contains the given YYYY-MM-DD.
 */
export function isoWeekStart(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
}

/**
 * YYYY-MM-DD that is N days before/after `dateStr`.
 */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Inclusive range of YYYY-MM-DD strings between start and end.
 */
export function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

/**
 * Day-of-week index (0..6) for a YYYY-MM-DD string. Used by the heatmap
 * and target-day matching for historical dates.
 */
export function dayOfWeekForDateString(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_LABELS_SHORT = ["S", "M", "T", "W", "T", "F", "S"];
