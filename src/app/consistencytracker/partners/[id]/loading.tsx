import Link from "next/link";
import Skeleton from "@/components/skeleton";

// Partner detail skeleton: real back link, pulsing header and heatmaps.
export default function Loading() {
  return (
    <section className="space-y-10" aria-busy>
      <span className="sr-only">Loading…</span>
      <Link
        href="/consistencytracker/partners"
        className="text-xs text-[color:var(--muted)] hover:text-black"
      >
        ← All partners
      </Link>
      <header className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-gray-200 shrink-0" />
        <div>
          <Skeleton className="h-6 w-36" />
          <Skeleton className="mt-1 h-3 w-24" />
        </div>
      </header>
      <div className="space-y-8">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    </section>
  );
}
