import { listCategories } from "@/lib/actions/categories";
import GoalForm from "@/components/goal-form";

export default async function NewGoalPage() {
  const categories = await listCategories();

  return (
    <section className="max-w-xl">
      <header className="mb-8">
        <h1 className="text-xl font-light tracking-tight">New goal</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          A small, well-defined habit beats a big vague one.
        </p>
      </header>
      <GoalForm mode="create" categories={categories} />
    </section>
  );
}
