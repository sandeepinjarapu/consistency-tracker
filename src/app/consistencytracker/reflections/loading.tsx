import Skeleton from "@/components/skeleton";

// Reflections skeleton: real title + subtitle, pulsing editor and cards.
export default function Loading() {
  return (
    <section aria-busy>
      <span className="sr-only">Loading…</span>
      <header className="mb-10">
        <h1 className="text-xl font-light tracking-tight">Weekly reflections</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Look back, write briefly, move forward. A few sentences each week beats a long entry once a month.
        </p>
      </header>
      <div className="space-y-10">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </section>
  );
}
