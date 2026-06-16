"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { todayIn, dateInTimezone } from "@/lib/dates";
import { isBackfillable, isExtraLoggable } from "@/lib/heatmap-backfill";

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

export async function markDone(
  goalId: string,
  date: string,
  skipRevalidate = false
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

  if (!skipRevalidate) revalidatePath("/consistencytracker", "layout");
}

export async function markSkipped(
  goalId: string,
  date: string,
  reason: SkipReason,
  skipRevalidate = false
): Promise<void> {
  if (!VALID_REASONS.includes(reason)) {
    throw new Error("Invalid skip reason");
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  await assertBackfillable(supabase, user.id, goalId, date);

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

  if (!skipRevalidate) revalidatePath("/consistencytracker", "layout");
}

export async function unmark(
  goalId: string,
  date: string,
  skipRevalidate = false
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
  if (!skipRevalidate) revalidatePath("/consistencytracker", "layout");
}

/**
 * Server-side guard for backfill edits: confirms ownership AND that `date`
 * falls within the allowed backfill window (eligible weekday, within the
 * goal's lifetime, current ISO week + 2-day grace) computed in the user's
 * timezone. Mirrors the client-side `isBackfillable` so the Catch up editor
 * and the server agree — the editor only offers eligible days, this enforces it.
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
  const timezone = profile?.timezone ?? "UTC";
  const eligible = isBackfillable(date, {
    goalStartDate: dateInTimezone(goal.created_at as string, timezone),
    today: todayIn(timezone),
    targetDays: goal.target_days as number[],
  });
  if (!eligible) {
    throw new Error("That day is outside the editable window");
  }
}

/**
 * Backfill a "done" check-in for a past day via the heatmap / Catch up list.
 * Like the Today-card actions above, it enforces the editable date window
 * server-side (not just in the UI) via the same `assertBackfillable` guard.
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
 * Server-side guard for *extra* (off-target) edits: confirms ownership, that
 * the goal is still active, AND that `date` is off-target but within the
 * editable time window (mirrors `isExtraLoggable`). Separate from
 * `assertBackfillable` so the scheduled path is untouched and a skip can never
 * land on a non-target day.
 */
async function assertExtraLoggable(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  goalId: string,
  date: string
): Promise<void> {
  const [{ data: goal, error: goalErr }, { data: profile }] = await Promise.all([
    supabase
      .from("goals")
      .select("user_id, target_days, created_at, active")
      .eq("id", goalId)
      .single(),
    supabase.from("profiles").select("timezone").eq("id", userId).single(),
  ]);
  if (goalErr || !goal) throw new Error("Goal not found");
  if (goal.user_id !== userId) {
    throw new Error("You can only check in on your own goals");
  }
  if (!goal.active) {
    throw new Error("Can't log an extra on an archived goal");
  }
  const timezone = profile?.timezone ?? "UTC";
  const eligible = isExtraLoggable(date, {
    goalStartDate: dateInTimezone(goal.created_at as string, timezone),
    today: todayIn(timezone),
    targetDays: goal.target_days as number[],
  });
  if (!eligible) {
    throw new Error("That day can't take an extra check-in");
  }
}

/**
 * Log an *extra* "done" on an unscheduled day (a weekday outside the goal's
 * target_days), inside the editable window. Done-only by design: there is no
 * extra-skip, so no "skipped extra" can exist. Over-quota frequency extras
 * (eligible weekday, beyond the count) use the normal `markDone` path instead.
 */
export async function markExtraDone(
  goalId: string,
  date: string
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  await assertExtraLoggable(supabase, user.id, goalId, date);

  const { error } = await supabase
    .from("check_ins")
    .upsert(
      { goal_id: goalId, user_id: user.id, date, status: "done", skip_reason: null },
      { onConflict: "goal_id,date" }
    );
  if (error) throw error;
  revalidatePath("/consistencytracker", "layout");
}

/**
 * Remove an off-target check-in (done or skipped) inside the editable window.
 * The `assertExtraLoggable` guard restricts this to off-target days, so it can
 * never delete a scheduled check-in (those use `unmark`). Supporting skip
 * removal lets an out-of-cadence skip — only ever created by later narrowing a
 * goal's cadence — be cleaned up.
 */
export async function removeExtra(goalId: string, date: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  await assertExtraLoggable(supabase, user.id, goalId, date);

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
  note: string,
  skipRevalidate = false
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
  if (!skipRevalidate) revalidatePath("/consistencytracker", "layout");
}
