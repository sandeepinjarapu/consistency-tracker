import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SignOutButton from "./sign-out-button";

export default async function TrackerHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", user.id)
    .single();

  return (
    <main className="min-h-screen max-w-3xl mx-auto px-6 py-12">
      <header className="flex items-center justify-between mb-12">
        <div>
          <h1 className="text-xl font-light tracking-tight">Consistency Tracker</h1>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Welcome back, {profile?.display_name ?? user.email}.
          </p>
        </div>
        <SignOutButton />
      </header>

      <section className="border border-[color:var(--border)] rounded-lg p-6">
        <p className="text-sm text-[color:var(--muted)]">
          Phase 1 deployed — auth works. Goals, check-ins, and heatmaps come in phase 2.
        </p>
      </section>
    </main>
  );
}
