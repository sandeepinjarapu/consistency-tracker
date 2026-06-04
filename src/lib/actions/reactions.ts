"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { revalidatePath } from "next/cache";
import { isoWeekStart, todayIn, addDays } from "@/lib/dates";
import {
  buildReactionSummaries,
  type ReactionKind,
  type ReactionRow,
  type GoalReactionSummary,
} from "@/lib/reactions";

/**
 * Toggle a reaction by the current user on a partner's goal. Inserts if it
 * doesn't exist, removes it if it does (so the buttons act like toggles).
 * owner_id is derived from the goal server-side — never trusted from the
 * client — and RLS independently enforces that the goal is shared with you.
 */
export async function toggleReaction(
  goalId: string,
  kind: ReactionKind,
  weekStart?: string
): Promise<{ active: boolean }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");

  const { data: goal } = await supabase
    .from("goals")
    .select("user_id")
    .eq("id", goalId)
    .single();
  if (!goal) throw new Error("Goal not found");
  const ownerId = goal.user_id as string;

  // Reactions are bucketed by ISO week in the owner's timezone (lining up with
  // their reflection weeks) and stay open only for the current and previous
  // week — aligned with the Monday summary email; older weeks are settled.
  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", ownerId)
    .single();
  const currentWeek = isoWeekStart(todayIn(ownerProfile?.timezone ?? "UTC"));
  const previousWeek = addDays(currentWeek, -7);
  const targetWeek = weekStart ?? currentWeek;
  if (targetWeek !== currentWeek && targetWeek !== previousWeek) {
    throw new Error(
      "Reactions are open for the current and previous week only."
    );
  }

  const { data: existing } = await supabase
    .from("reactions")
    .select("id")
    .eq("goal_id", goalId)
    .eq("reactor_id", user.id)
    .eq("kind", kind)
    .eq("week_start_date", targetWeek)
    .maybeSingle();

  let active: boolean;
  if (existing) {
    const { error } = await supabase.from("reactions").delete().eq("id", existing.id);
    if (error) throw error;
    active = false;
  } else {
    const { error } = await supabase.from("reactions").insert({
      goal_id: goalId,
      owner_id: ownerId,
      reactor_id: user.id,
      kind,
      week_start_date: targetWeek,
    });
    if (error && error.code !== "23505") throw error; // ignore double-insert race
    active = true;
  }

  revalidatePath(`/consistencytracker/partners/${ownerId}`);
  revalidatePath(`/consistencytracker/goals/${goalId}`);
  return { active };
}

/**
 * Which reactions the current user has left on a given owner's goals across
 * the given weeks, keyed `${goalId}:${kind}:${weekStart}`. Lets the partner
 * view render each week's buttons in their toggled state.
 */
export async function listMyReactions(
  ownerId: string,
  weekStarts: string[]
): Promise<Record<string, true>> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user || weekStarts.length === 0) return {};
  const { data } = await supabase
    .from("reactions")
    .select("goal_id, kind, week_start_date")
    .eq("owner_id", ownerId)
    .eq("reactor_id", user.id)
    .in("week_start_date", weekStarts);
  const out: Record<string, true> = {};
  for (const r of data ?? [])
    out[`${r.goal_id}:${r.kind}:${r.week_start_date}`] = true;
  return out;
}

/**
 * Reactions on one of the current user's own goals, aggregated per
 * (reactor, kind): how many weeks they've reacted and the most recent week.
 */
export async function getGoalReactions(
  goalId: string
): Promise<GoalReactionSummary[]> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return [];
  const { data } = await supabase
    .from("reactions")
    .select("kind, week_start_date, reactor_id")
    .eq("goal_id", goalId)
    .eq("owner_id", user.id);
  if (!data || data.length === 0) return [];

  const reactorIds = Array.from(new Set(data.map((r) => r.reactor_id)));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", reactorIds);
  const nameById = new Map(
    (profiles ?? []).map((p) => [p.id, p.display_name ?? "A partner"])
  );

  const rows: ReactionRow[] = data.map((r) => ({
    reactorId: r.reactor_id,
    reactorName: nameById.get(r.reactor_id) ?? "A partner",
    kind: r.kind as ReactionKind,
    weekStart: r.week_start_date as string,
  }));
  return buildReactionSummaries(rows);
}

/**
 * IDs of the current user's goals that have at least one unseen reaction —
 * powers the quiet "new reaction" dot on each goal row. Clears per goal via
 * markGoalReactionsSeen when the owner opens the goal.
 */
export async function listGoalsWithUnseenReactions(): Promise<string[]> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return [];
  const { data } = await supabase
    .from("reactions")
    .select("goal_id")
    .eq("owner_id", user.id)
    .is("seen_at", null);
  return Array.from(new Set((data ?? []).map((r) => r.goal_id)));
}

/** Mark the current user's reactions on a goal as seen (clears the dot). */
export async function markGoalReactionsSeen(goalId: string): Promise<void> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return;
  await supabase
    .from("reactions")
    .update({ seen_at: new Date().toISOString() })
    .eq("goal_id", goalId)
    .eq("owner_id", user.id)
    .is("seen_at", null);
  revalidatePath("/consistencytracker", "layout");
}
