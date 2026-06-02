import Skeleton from "@/components/skeleton";

// Partners list skeleton: header, invite form, partner rows.
export default function Loading() {
  return (
    <section className="space-y-12" aria-busy>
      <span className="sr-only">Loading…</span>
      <div>
        <Skeleton className="h-6 w-28" />
        <Skeleton className="mt-2 h-4 w-80" />
      </div>
      <div>
        <Skeleton className="h-3 w-28 mb-3" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div>
        <Skeleton className="h-3 w-24 mb-3" />
        <Skeleton className="h-24 w-full" />
      </div>
    </section>
  );
}
