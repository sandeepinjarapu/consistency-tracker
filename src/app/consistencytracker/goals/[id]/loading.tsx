import Skeleton from "@/components/skeleton";

// Goal detail skeleton: back link, header, 5 stat tiles, heatmap, histogram.
export default function Loading() {
  return (
    <section aria-busy>
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-3 w-20" />
      <div className="mt-4 mb-8">
        <Skeleton className="h-3 w-40 mb-2" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-10">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
      <Skeleton className="h-28 w-full" />
      <div className="mt-8">
        <Skeleton className="h-3 w-24 mb-3" />
        <Skeleton className="h-12 w-full" />
      </div>
    </section>
  );
}
