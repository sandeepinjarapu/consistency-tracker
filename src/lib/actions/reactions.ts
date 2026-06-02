"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { revalidatePath } from "next/cache";
import type { ReactionKind } from "@/lib/reactions";

export type GoalReaction = {
  kind: ReactionKind;
  reactorName: string;
  createdAt: string;
};

/**
 * Toggle a reaction by the current user on a partner's goal. Inserts if it
 * doesn't exist, removes it if it does (so the buttons act like toggles).
 * owner_id is derived from the goal server-side — never trusted from the
 * client — and RLS independently enforces that the goal is shared with you.
 */
export async function toggleReaction(
  goalId: string,
  kind: ReactionKind
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

  const { data: existing } = await supabase
    .from("reactions")
    .select("id")
    .eq("goal_id", goalId)
    .eq("reactor_id", user.id)
    .eq("kind", kind)
    .maybeSingle();

  let active: boolean;
  if (existing) {
    const { error } = await supabase.from("reactions").delete().eq("id", existing.id);
    if (error) throw error;
    active = false;
  } else {
    const { error } = await supabase
      .from("reactions")
      .insert({ goal_id: goalId, owner_id: ownerId, reactor_id: user.id, kind });
    if (error && error.code !== "23505") throw error; // ignore double-insert race
    active = true;
  }

  revalidatePath(`/consistencytracker/partners/${ownerId}`);
  revalidatePath(`/consistencytracker/goals/${goalId}`);
  return { active };
}

/**
 * Which reactions the current user has left on a given owner's goals, keyed
 * `${goalId}:${kind}`. Lets the partner-view buttons render their toggled
 * state.
 */
export async function listMyReactions(
  ownerId: string
): Promise<Record<string, true>> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return {};
  const { data } = await supabase
    .from("reactions")
    .select("goal_id, kind")
    .eq("owner_id", ownerId)
    .eq("reactor_id", user.id);
  const out: Record<string, true> = {};
  for (const r of data ?? []) out[`${r.goal_id}:${r.kind}`] = true;
  return out;
}

/** Reactions left on one of the current user's own goals, with reactor names. */
export async function getGoalReactions(goalId: string): Promise<GoalReaction[]> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return [];
  const { data } = await supabase
    .from("reactions")
    .select("kind, created_at, reactor_id")
    .eq("goal_id", goalId)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });
  if (!data || data.length === 0) return [];

  const reactorIds = Array.from(new Set(data.map((r) => r.reactor_id)));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", reactorIds);
  const nameById = new Map(
    (profiles ?? []).map((p) => [p.id, p.display_name ?? "A partner"])
  );

  return data.map((r) => ({
    kind: r.kind as ReactionKind,
    reactorName: nameById.get(r.reactor_id) ?? "A partner",
    createdAt: r.created_at as string,
  }));
}

/** Count of unseen reactions across all of the current user's goals. */
export async function countUnseenReactions(): Promise<number> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return 0;
  const { count } = await supabase
    .from("reactions")
    .select("*", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .is("seen_at", null);
  return count ?? 0;
}

/** Mark the current user's reactions on a goal as seen (clears the badge). */
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
