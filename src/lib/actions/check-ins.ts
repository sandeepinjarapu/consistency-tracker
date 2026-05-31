"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { todayIn } from "@/lib/dates";
import { isBackfillable } from "@/lib/heatmap-backfill";

export type SkipReason = "travel" | "illness" | "mood" | "other";

export type CheckIn = {
  id: string;
  goal_id: string;
  date: string;
  status: "done" | "skipped";
  skip_reason: SkipReason | null;
  note: string | null;
  created_at: string; // UTC timestamptz — when this check-in was logged
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
 * Server-side guard for backfill edits: confirms ownership AND that `date`
 * falls within the allowed backfill window (eligible weekday, within the
 * goal's lifetime, current ISO week + 2-day grace) computed in the user's
 * timezone. Mirrors the client-side `isBackfillable` so the heatmap UI and
 * the server agree — the UI only offers eligible cells, this enforces it.
 */
async function assertBackfillable(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  goalId: string,
  date: string
): Promise<void> {
  const [{ data: goal, error: goalErr }, { data: profile }] = await Promise.all([
    supabase
      .from("goals")
      .select("user_id, target_days, created_at")
      .eq("id", goalId)
      .single(),
    supabase.from("profiles").select("timezone").eq("id", userId).single(),
  ]);
  if (goalErr || !goal) throw new Error("Goal not found");
  if (goal.user_id !== userId) {
    throw new Error("You can only check in on your own goals");
  }
  const eligible = isBackfillable(date, {
    goalStartDate: (goal.created_at as string).slice(0, 10),
    today: todayIn(profile?.timezone ?? "UTC"),
    targetDays: goal.target_days as number[],
  });
  if (!eligible) {
    throw new Error("That day is outside the editable window");
  }
}

/**
 * Backfill a "done" check-in for a past day via the heatmap. Unlike markDone
 * (which the Today card uses for the current day), this enforces the backfill
 * date window server-side, not just in the UI.
 */
export async function backfillCheckIn(
  goalId: string,
  date: string
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  await assertBackfillable(supabase, user.id, goalId, date);

  const { error } = await supabase
    .from("check_ins")
    .upsert(
      { goal_id: goalId, user_id: user.id, date, status: "done", skip_reason: null },
      { onConflict: "goal_id,date" }
    );
  if (error) throw error;
  revalidatePath("/consistencytracker", "layout");
}

/** Clear a check-in for a past day via the heatmap (same window guard). */
export async function clearBackfillCheckIn(
  goalId: string,
  date: string
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  await assertBackfillable(supabase, user.id, goalId, date);

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
