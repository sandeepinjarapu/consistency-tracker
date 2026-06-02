import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * The signed-in user, memoized for the duration of a single server request
 * via React `cache`. The layout, the page, and any read-only actions in the
 * same render share one `auth.getUser()` call instead of each paying a
 * separate round-trip. (Middleware runs in its own pass and is unaffected.)
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * The signed-in user's profile (timezone + display name), memoized per
 * request. Returns null when signed out or no row exists.
 */
export const getCurrentProfile = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("timezone, display_name")
    .eq("id", user.id)
    .single();
  return data ?? null;
});
