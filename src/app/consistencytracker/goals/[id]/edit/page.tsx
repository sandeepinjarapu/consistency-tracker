import { notFound } from "next/navigation";
import { listCategories } from "@/lib/actions/categories";
import { getGoal } from "@/lib/actions/goals";
import GoalForm from "@/components/goal-form";

export default async function EditGoalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [goal, categories] = await Promise.all([
    getGoal(id),
    listCategories(),
  ]);
  if (!goal) notFound();

  return (
    <section className="max-w-xl">
      <header className="mb-8">
        <h1 className="text-xl font-light tracking-tight">Edit goal</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Changes apply going forward. Past check-ins stay as they were.
        </p>
      </header>
      <GoalForm mode="edit" initial={goal} categories={categories} />
    </section>
  );
}
