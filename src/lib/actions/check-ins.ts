"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type SkipReason = "travel" | "illness" | "mood" | "other";

export type CheckIn = {
  id: string;
  goal_id: string;
  date: string;
  status: "done" | "skipped";
  skip_reason: SkipReason | null;
  note: string | null;
};

const VALID_REASONS: SkipReason[] = ["travel", "illness", "mood", "other"];

function trimNote(note: string | null | undefined): string | null {
  if (!note) return null;
  const trimmed = note.trim().slice(0, 100);
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Server-side ownership guard for check-in mutations. RLS also enforces
 * this (see 0005), but checking here gives a clearer error and avoids a
 * round-trip on tampered clients.
 */
async function assertOwnsGoal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  goalId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("goals")
    .select("user_id")
    .eq("id", goalId)
    .single();
  if (error || !data) throw new Error("Goal not found");
  if (data.user_id !== userId) {
    throw new Error("You can only check in on your own goals");
  }
}

export async function markDone(goalId: string, date: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  await assertOwnsGoal(supabase, user.id, goalId);

  const { error } = await supabase
    .from("check_ins")
    .upsert(
      {
        goal_id: goalId,
        user_id: user.id,
        date,
        status: "done",
        skip_reason: null,
      },
      { onConflict: "goal_id,date" }
    );
  if (error) throw error;

  revalidatePath("/consistencytracker", "layout");
}

export async function markSkipped(
  goalId: string,
  date: string,
  reason: SkipReason
): Promise<void> {
  if (!VALID_REASONS.includes(reason)) {
    throw new Error("Invalid skip reason");
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  await assertOwnsGoal(supabase, user.id, goalId);

  const { error } = await supabase
    .from("check_ins")
    .upsert(
      {
        goal_id: goalId,
        user_id: user.id,
        date,
        status: "skipped",
        skip_reason: reason,
      },
      { onConflict: "goal_id,date" }
    );
  if (error) throw error;

  revalidatePath("/consistencytracker", "layout");
}

export async function unmark(goalId: string, date: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  await assertOwnsGoal(supabase, user.id, goalId);

  const { error } = await supabase
    .from("check_ins")
    .delete()
    .eq("goal_id", goalId)
    .eq("date", date);
  if (error) throw error;
  revalidatePath("/consistencytracker", "layout");
}

/**
 * Update (or clear) the note on an existing check-in for (goalId, date).
 * Does nothing if no check-in row exists yet — call markDone/markSkipped first.
 */
export async function updateCheckInNote(
  goalId: string,
  date: string,
  note: string
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  await assertOwnsGoal(supabase, user.id, goalId);

  const { error } = await supabase
    .from("check_ins")
    .update({ note: trimNote(note) })
    .eq("goal_id", goalId)
    .eq("date", date);
  if (error) throw error;
  revalidatePath("/consistencytracker", "layout");
}
