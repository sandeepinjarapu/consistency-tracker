import Skeleton from "@/components/skeleton";

// Goals list skeleton: header + a couple of category groups of rows.
export default function Loading() {
  return (
    <section className="space-y-8" aria-busy>
      <span className="sr-only">Loading…</span>
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-8 w-24" />
      </div>
      {[0, 1].map((g) => (
        <div key={g}>
          <Skeleton className="h-3 w-32 mb-3" />
          <Skeleton className="h-32 w-full" />
        </div>
      ))}
    </section>
  );
}
