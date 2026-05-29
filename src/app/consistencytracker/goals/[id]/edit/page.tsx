import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listCategories } from "@/lib/actions/categories";
import { getGoal } from "@/lib/actions/goals";
import { listPartners, listSharesForGoal } from "@/lib/actions/partners";
import GoalForm from "@/components/goal-form";
import ShareToggles from "@/components/share-toggles";

export default async function EditGoalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [goal, categories, partners, sharedWith] = await Promise.all([
    getGoal(id),
    listCategories(),
    listPartners(),
    listSharesForGoal(id),
  ]);
  if (!goal) notFound();

  // Editing is owner-only. If a partner reaches this URL via a shared
  // goal, redirect them to the read-only partner view (mirrors the
  // detail page guard).
  if (goal.user_id !== user.id) {
    redirect(`/consistencytracker/partners/${goal.user_id}`);
  }

  return (
    <section className="max-w-xl">
      <header className="mb-8">
        <h1 className="text-xl font-light tracking-tight">Edit goal</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Your check-ins stay exactly as they were — but changing the days or
          frequency re-scores your past weeks under the new cadence.
        </p>
      </header>
      <GoalForm mode="edit" initial={goal} categories={categories} />

      <div className="mt-12 pt-6 border-t border-[color:var(--border)]">
        <h2 className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-3">
          Sharing
        </h2>
        <ShareToggles
          goalId={goal.id}
          partners={partners.map((p) => ({
            id: p.id,
            display_name: p.display_name,
          }))}
          sharedWith={sharedWith}
        />
      </div>
    </section>
  );
}
