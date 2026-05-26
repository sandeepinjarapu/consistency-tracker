import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Bypasses RLS — use only in server-side
 * code paths where you've manually validated the operation is safe.
 *
 * Currently used for:
 * - Looking up partner_invites by token (the URL param is secret, so we
 *   trust possession of the token as proof of intent to accept)
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
