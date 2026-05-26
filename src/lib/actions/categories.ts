"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const PALETTE = [
  "#22c55e", "#3b82f6", "#a855f7", "#ec4899",
  "#f59e0b", "#14b8a6", "#ef4444", "#64748b",
];

/**
 * Defaults seeded for new users (and added to existing users on demand).
 * Order here determines sort_order.
 */
const DEFAULTS: Array<{ name: string; color: string }> = [
  { name: "Improving Skills", color: "#3b82f6" },
  { name: "Project Building", color: "#22c55e" },
  { name: "Health", color: "#14b8a6" },
  { name: "Anti Dopamine", color: "#ef4444" },
  { name: "Picking up New Skills", color: "#a855f7" },
];

export type Category = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
};

export async function listCategories(): Promise<Category[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // First read
  let { data, error } = await supabase
    .from("categories")
    .select("id, name, color, sort_order")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;

  // Seed defaults if completely empty (new user)
  if (!data || data.length === 0) {
    const rows = DEFAULTS.map((d, i) => ({
      user_id: user.id,
      name: d.name,
      color: d.color,
      sort_order: i,
    }));
    const { error: insErr } = await supabase.from("categories").insert(rows);
    if (!insErr) {
      const refetch = await supabase
        .from("categories")
        .select("id, name, color, sort_order")
        .order("sort_order", { ascending: true });
      data = refetch.data ?? [];
    }
  }

  return data ?? [];
}

/**
 * Add any missing default categories for the current user. Idempotent —
 * existing categories with matching names are left alone.
 */
export async function addMissingDefaults(): Promise<number> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data: existing } = await supabase
    .from("categories")
    .select("name, sort_order")
    .eq("user_id", user.id);
  const existingNames = new Set((existing ?? []).map((c) => c.name));
  const maxOrder = (existing ?? []).reduce(
    (m, c) => Math.max(m, c.sort_order),
    -1
  );

  const toInsert = DEFAULTS
    .filter((d) => !existingNames.has(d.name))
    .map((d, i) => ({
      user_id: user.id,
      name: d.name,
      color: d.color,
      sort_order: maxOrder + 1 + i,
    }));

  if (toInsert.length === 0) return 0;
  const { error } = await supabase.from("categories").insert(toInsert);
  if (error) throw error;
  revalidatePath("/consistencytracker", "layout");
  return toInsert.length;
}

export async function createCategory(input: {
  name: string;
  color?: string;
}): Promise<Category> {
  const name = input.name.trim();
  if (!name) throw new Error("Category name required");
  if (name.length > 40) throw new Error("Category name too long");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  // Auto-pick a color based on current category count if not provided
  const { count } = await supabase
    .from("categories")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  const color = input.color ?? PALETTE[(count ?? 0) % PALETTE.length];

  const { data, error } = await supabase
    .from("categories")
    .insert({
      user_id: user.id,
      name,
      color,
      sort_order: count ?? 0,
    })
    .select("id, name, color, sort_order")
    .single();

  if (error) throw error;
  revalidatePath("/consistencytracker", "layout");
  return data;
}

export async function updateCategory(
  id: string,
  patch: Partial<Pick<Category, "name" | "color" | "sort_order">>
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("categories").update(patch).eq("id", id);
  if (error) throw error;
  revalidatePath("/consistencytracker", "layout");
}

export async function deleteCategory(id: string): Promise<void> {
  const supabase = await createClient();
  // Check if any goals still reference this category
  const { count } = await supabase
    .from("goals")
    .select("*", { count: "exact", head: true })
    .eq("category_id", id);
  if ((count ?? 0) > 0) {
    throw new Error("Move or archive this category's goals before deleting it.");
  }
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/consistencytracker", "layout");
}
