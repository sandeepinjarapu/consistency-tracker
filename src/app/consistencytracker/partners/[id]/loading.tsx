import Link from "next/link";
import Skeleton from "@/components/skeleton";

// Partner detail skeleton — structure mirrors the real page so the transition
// has minimal layout shift. One goal block (the most common case) with a
// realistic header, reaction area, and two-month calendar placeholder.
export default function Loading() {
  return (
    <section className="space-y-10" aria-busy aria-label="Loading partner page">
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

      {/* One goal block */}
      <div className="space-y-12">
        <div>
          {/* Goal meta: category pill + title + stats */}
          <div className="mb-3">
            <Skeleton className="h-3 w-40 mb-2" />
            <Skeleton className="h-6 w-56" />
            <Skeleton className="mt-2 h-3 w-32" />
          </div>

          {/* Reactions area */}
          <div className="mt-4 space-y-3">
            <Skeleton className="h-3 w-28" />
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-20 rounded-full" />
                <Skeleton className="h-8 w-20 rounded-full" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-20 rounded-full" />
                <Skeleton className="h-8 w-20 rounded-full" />
              </div>
            </div>
          </div>

          {/* Two-month calendar placeholder */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-[620px]">
            <Skeleton className="h-[220px] w-full" />
            <Skeleton className="h-[220px] w-full" />
          </div>
        </div>
      </div>
    </section>
  );
}
