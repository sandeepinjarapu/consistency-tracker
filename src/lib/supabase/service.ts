import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Bypasses RLS — use only in server-side
 * code paths where you've manually validated the operation is safe.
 *
 * Currently used for:
 * - Looking up partner_invites by token (the URL param is secret, so we
 *   trust possession of the token as proof of intent to accept)
 * - The weekly partner-summary cron, which runs without a user session
 * - Marking a viewer's shares seen: the shares table is owner-managed (no RLS
 *   UPDATE path for the viewer), so the write is scoped in code to the
 *   caller's own rows instead
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
