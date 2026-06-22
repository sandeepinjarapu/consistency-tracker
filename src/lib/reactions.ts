// Shared reaction constants/types. Kept out of the "use server" actions file,
// which may only export async functions.

export type ReactionKind = "saw" | "proud";

export const REACTION_LABELS: Record<ReactionKind, string> = {
  saw: "Saw it",
  proud: "Proud",
};

export const REACTION_EMOJI: Record<ReactionKind, string> = {
  saw: "👀",
  proud: "👏",
};

// One reaction occurrence (one kind, one week) from one reactor.
export type ReactionRow = {
  reactorId: string;
  reactorName: string;
  kind: ReactionKind;
  weekStart: string; // YYYY-MM-DD (Monday)
};

// A reactor's standing reaction of a kind, aggregated across weeks.
export type GoalReactionSummary = {
  kind: ReactionKind;
  reactorName: string;
  weeks: number; // distinct weeks reacted
  latestWeek: string; // YYYY-MM-DD (Monday)
};

/**
 * Aggregate raw reaction rows into one summary per (reactor, kind): how many
 * weeks they've reacted and the most recent week. Sorted most-recent first,
 * then by week count. Rows are already unique per week (DB constraint), so
 * each row counts as one week.
 */
export function buildReactionSummaries(
  rows: ReactionRow[]
): GoalReactionSummary[] {
  const groups = new Map<string, GoalReactionSummary>();
  for (const r of rows) {
    const key = `${r.reactorId}:${r.kind}`;
    const existing = groups.get(key);
    if (existing) {
      existing.weeks += 1;
      if (r.weekStart > existing.latestWeek) existing.latestWeek = r.weekStart;
    } else {
      groups.set(key, {
        kind: r.kind,
        reactorName: r.reactorName,
        weeks: 1,
        latestWeek: r.weekStart,
      });
    }
  }
  return Array.from(groups.values()).sort((a, b) =>
    a.latestWeek === b.latestWeek
      ? b.weeks - a.weeks
      : a.latestWeek < b.latestWeek
        ? 1
        : -1
  );
}

function shortWeek(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * A warm, human sentence for a reaction summary, e.g.
 * "Richa was proud of this in 3 separate weeks, most recently this week."
 * `weeks` is the count of distinct weeks reacted, so it is phrased as a count
 * ("in N separate weeks") rather than a span ("for N weeks"), which would read
 * like a continuous streak.
 */
export function reactionSentence(
  s: GoalReactionSummary,
  currentWeekStart: string
): string {
  const latest =
    s.latestWeek >= currentWeekStart
      ? "this week"
      : `the week of ${shortWeek(s.latestWeek)}`;
  const verb = s.kind === "saw" ? "saw this" : "was proud of this";
  return s.weeks === 1
    ? `${s.reactorName} ${verb} ${latest}.`
    : `${s.reactorName} ${verb} in ${s.weeks} separate weeks, most recently ${latest}.`;
}
