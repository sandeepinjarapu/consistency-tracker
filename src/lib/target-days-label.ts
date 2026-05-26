const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Human-readable summary of target_days. Examples:
 *   [0..6]            → "Daily"
 *   [1..5]            → "Weekdays"
 *   [0,6]             → "Weekends"
 *   [1,3,5]           → "Mon, Wed, Fri"
 */
export function targetDaysLabel(days: number[]): string {
  const sorted = [...days].sort();
  const key = sorted.join(",");
  if (key === "0,1,2,3,4,5,6") return "Daily";
  if (key === "1,2,3,4,5") return "Weekdays";
  if (key === "0,6") return "Weekends";
  return sorted.map((d) => DAY_SHORT[d]).join(", ");
}
