"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type Reflection = {
  id: string;
  week_start_date: string;
  continue_text: string | null;
  stop_text: string | null;
  improve_text: string | null;
  notes: string | null;
  visibility: "private" | "partner";
  updated_at: string;
};

export type ReflectionInput = {
  weekStartDate: string; // YYYY-MM-DD, must be a Monday
  continueText?: string;
  stopText?: string;
  improveText?: string;
  notes?: string;
  visibility?: "private" | "partner";
};

const COLS =
  "id, week_start_date, continue_text, stop_text, improve_text, notes, visibility, updated_at";

export async function listReflections(): Promise<Reflection[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("weekly_reflections")
    .select(COLS)
    .order("week_start_date", { ascending: false });
  return (data ?? []) as Reflection[];
}

export async function getReflection(weekStartDate: string): Promise<Reflection | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("weekly_reflections")
    .select(COLS)
    .eq("week_start_date", weekStartDate)
    .maybeSingle();
  return (data ?? null) as Reflection | null;
}

export async function upsertReflection(input: ReflectionInput): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.weekStartDate)) {
    throw new Error("Invalid week start");
  }

  const payload = {
    user_id: user.id,
    week_start_date: input.weekStartDate,
    continue_text: input.continueText?.trim() || null,
    stop_text: input.stopText?.trim() || null,
    improve_text: input.improveText?.trim() || null,
    notes: input.notes?.trim() || null,
    visibility: input.visibility ?? "private",
  };

  // If everything is empty AND no row yet, skip. If row exists, leave it
  // (user can delete explicitly later).
  const allEmpty =
    !payload.continue_text &&
    !payload.stop_text &&
    !payload.improve_text &&
    !payload.notes;
  if (allEmpty) {
    // Delete row if exists so empty reflections don't pollute the list
    await supabase
      .from("weekly_reflections")
      .delete()
      .eq("user_id", user.id)
      .eq("week_start_date", input.weekStartDate);
  } else {
    const { error } = await supabase
      .from("weekly_reflections")
      .upsert(payload, { onConflict: "user_id,week_start_date" });
    if (error) throw error;
  }

  revalidatePath("/consistencytracker/reflections");
  revalidatePath("/consistencytracker", "layout");
}
