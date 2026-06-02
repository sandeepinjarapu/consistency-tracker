import Skeleton from "@/components/skeleton";

// Reflections skeleton: header, current-week editor, prior-week cards.
export default function Loading() {
  return (
    <section className="space-y-8" aria-busy>
      <span className="sr-only">Loading…</span>
      <div>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <Skeleton className="h-48 w-full" />
      <div className="space-y-4">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </section>
  );
}
