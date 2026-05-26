"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Persist the user's browser-detected IANA timezone if it differs from
 * what's currently stored. Safe to call repeatedly.
 */
export async function saveTimezone(timezone: string): Promise<void> {
  if (!timezone || typeof timezone !== "string" || timezone.length > 64) {
    return; // ignore garbage input
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .single();

  if (profile && profile.timezone !== timezone) {
    await supabase
      .from("profiles")
      .update({ timezone })
      .eq("id", user.id);
  }
}
