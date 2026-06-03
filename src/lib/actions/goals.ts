"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { safeExternalUrl } from "@/lib/url";

export type Goal = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  motivation: string | null; // "Why this matters" — meaning behind the goal
  doc_url: string | null;
  category_id: string | null;
  target_days: number[];
  reminder_time: string | null; // "HH:MM:SS" from Postgres TIME
  calendar_added_at: string | null; // when the owner last exported to GCal
  weekly_target: number | null; // null = specific-day goal; N = "N times per week"
  active: boolean;
  archived_at: string | null;
  created_at: string;
};

export type GoalInput = {
  name: string;
  description?: string;
  motivation?: string;
  doc_url?: string;
  category_id?: string | null;
  target_days: number[];
  reminder_time?: string | null; // "HH:MM" — null/empty means no reminder
  weekly_target?: number | null; // null = specific-day; N = "N times per week"
};

function validate(input: GoalInput): void {
  const name = input.name.trim();
  if (!name) throw new Error("Goal name required");
  if (name.length > 120) throw new Error("Goal name too long");
  if (input.motivation && input.motivation.length > 400) {
    throw new Error("Why this matters is too long");
  }
  if (!Array.isArray(input.target_days) || input.target_days.length === 0) {
    throw new Error("Pick at least one target day");
  }
  for (const d of input.target_days) {
    if (!Number.isInteger(d) || d < 0 || d > 6) {
      throw new Error("Invalid target day");
    }
  }
  if (input.doc_url && !safeExternalUrl(input.doc_url)) {
    throw new Error("Doc URL must be a valid http(s) URL");
  }
  if (input.reminder_time && !/^\d{2}:\d{2}$/.test(input.reminder_time)) {
    throw new Error("Reminder time must be in HH:MM format");
  }
  if (input.weekly_target != null) {
    if (!Number.isInteger(input.weekly_target) || input.weekly_target < 1) {
      throw new Error("Weekly target must be a positive whole number");
    }
    if (input.weekly_target > input.target_days.length) {
      throw new Error("Weekly target can't exceed the number of eligible days");
    }
  }
}

const GOAL_COLUMNS =
  "id, user_id, name, description, motivation, doc_url, category_id, target_days, reminder_time, calendar_added_at, weekly_target, active, archived_at, created_at";

export async function getGoal(id: string): Promise<Goal | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goals")
    .select(GOAL_COLUMNS)
    .eq("id", id)
    .single();
  if (error) return null;
  return data;
}

export async function createGoal(input: GoalInput): Promise<Goal> {
  validate(input);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("goals")
    .insert({
      user_id: user.id,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      motivation: input.motivation?.trim() || null,
      doc_url: input.doc_url?.trim() || null,
      category_id: input.category_id || null,
      target_days: input.target_days,
      reminder_time: input.reminder_time || null,
      weekly_target: input.weekly_target ?? null,
    })
    .select(GOAL_COLUMNS)
    .single();

  if (error) throw error;
  revalidatePath("/consistencytracker", "layout");
  return data;
}

export async function updateGoal(
  id: string,
  input: GoalInput
): Promise<void> {
  validate(input);
  const supabase = await createClient();
  const { error } = await supabase
    .from("goals")
    .update({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      motivation: input.motivation?.trim() || null,
      doc_url: input.doc_url?.trim() || null,
      category_id: input.category_id || null,
      target_days: input.target_days,
      reminder_time: input.reminder_time || null,
      weekly_target: input.weekly_target ?? null,
    })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/consistencytracker", "layout");
}

export async function archiveGoal(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("goals")
    .update({ active: false, archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/consistencytracker", "layout");
}

// Record that the owner clicked "Add to Google Calendar". RLS scopes the
// update to the owner. This is a one-time export marker, not calendar sync.
export async function markCalendarAdded(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("goals")
    .update({ calendar_added_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/consistencytracker", "layout");
}

export async function unarchiveGoal(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("goals")
    .update({ active: true, archived_at: null })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/consistencytracker", "layout");
}

