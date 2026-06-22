import type { EffortTexture } from "@/lib/actions/check-ins";

export type EffortRow = {
  goal_id: string;
  date: string;
  effort_texture: EffortTexture | null;
};

export type GoalEffortSummary = {
  goalId: string;
  goalName: string;
  flow: number;
  light: number;
};

/**
 * Per-goal counts of effort-texture days within a *single* week (roadmap item
 * 19). Owner-private, never scored — a within-week glance for reflection, not a
 * trend. Deliberately kept off the scoring path (computeWeekStats): effort must
 * never move a metric.
 *
 * Goals with no texture logged that week are omitted, so a blank week stays
 * blank like check-ins. Rows outside [weekStart, weekEnd] are ignored — this
 * function never compares across weeks.
 */
export function buildEffortSummary(
  rows: EffortRow[],
  goalNames: Map<string, string>,
  weekStart: string,
  weekEnd: string
): GoalEffortSummary[] {
  const byGoal = new Map<string, { flow: number; light: number }>();
  for (const r of rows) {
    if (r.effort_texture == null) continue;
    if (r.date < weekStart || r.date > weekEnd) continue;
    const acc = byGoal.get(r.goal_id) ?? { flow: 0, light: 0 };
    if (r.effort_texture === "flow") acc.flow += 1;
    else acc.light += 1;
    byGoal.set(r.goal_id, acc);
  }
  return [...byGoal.entries()]
    .map(([goalId, c]) => ({
      goalId,
      goalName: goalNames.get(goalId) ?? "",
      flow: c.flow,
      light: c.light,
    }))
    .sort((a, b) => a.goalName.localeCompare(b.goalName));
}
