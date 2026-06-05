import Link from "next/link";
import Skeleton from "@/components/skeleton";

// Goal detail skeleton: mirrors the real layout (identity, the why/connections
// columns, and the "this week" headline + ring) so the page doesn't jump when
// it streams in.
export default function Loading() {
  return (
    <section aria-busy>
      <span className="sr-only">Loading…</span>
      <Link
        href="/consistencytracker/goals"
        className="text-xs text-[color:var(--muted)] hover:text-black"
      >
        ← All goals
      </Link>

      <div className="mt-4 mb-5">
        <Skeleton className="h-3 w-40 mb-2" />
        <Skeleton className="h-7 w-56" />
      </div>

      <div className="flex gap-5">
        <div className="flex-[1.2] space-y-2">
          <Skeleton className="h-4 w-full max-w-prose" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="flex-1 space-y-2 border-l border-[color:var(--border)] pl-5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>

      <div className="my-6 border-t border-[color:var(--border)]" />

      <Skeleton className="h-3 w-16 mb-2" />
      <div className="mb-5 flex items-center gap-5">
        <div className="space-y-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-3 w-40" />
        </div>
        <Skeleton className="h-[54px] w-[54px] rounded-full" />
      </div>
      <Skeleton className="h-10 w-72" />
    </section>
  );
}
