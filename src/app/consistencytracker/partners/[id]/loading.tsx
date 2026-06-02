import Link from "next/link";
import Skeleton from "@/components/skeleton";

// Partner detail skeleton: real back link, pulsing header and heatmaps.
export default function Loading() {
  return (
    <section aria-busy>
      <span className="sr-only">Loading…</span>
      <Link
        href="/consistencytracker/partners"
        className="text-xs text-[color:var(--muted)] hover:text-black"
      >
        ← All partners
      </Link>
      <div className="mt-4 mb-8">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>
      <div className="space-y-8">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    </section>
  );
}
