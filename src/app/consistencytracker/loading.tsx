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
        <h2 className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-3">
          Past year — all goals combined
        </h2>
        <Skeleton className="h-28 w-full" />
        <div className="mt-2 flex items-center gap-2 text-[10px] text-[color:var(--muted)]">
          <span>Less</span>
          {["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"].map((c) => (
            <span
              key={c}
              className="inline-block rounded-sm"
              style={{ width: 11, height: 11, background: c }}
            />
          ))}
          <span>More</span>
        </div>
      </div>
      <div>
        <h2 className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-3">
          All goals
        </h2>
        <Skeleton className="h-40 w-full" />
      </div>
    </section>
  );
}
