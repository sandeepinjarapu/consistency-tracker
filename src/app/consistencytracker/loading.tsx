import Skeleton from "@/components/skeleton";

// Dashboard (Today) skeleton: greeting, today cards, aggregate heatmap, list.
export default function Loading() {
  return (
    <section className="space-y-12" aria-busy>
      <span className="sr-only">Loading…</span>
      <div>
        <Skeleton className="h-6 w-44" />
        <Skeleton className="mt-2 h-4 w-64" />
        <div className="space-y-2 mt-6">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      </div>
      <div>
        <Skeleton className="h-3 w-48 mb-3" />
        <Skeleton className="h-28 w-full" />
      </div>
      <div>
        <Skeleton className="h-3 w-24 mb-3" />
        <Skeleton className="h-40 w-full" />
      </div>
    </section>
  );
}
