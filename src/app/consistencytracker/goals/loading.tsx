import Link from "next/link";
import Skeleton from "@/components/skeleton";

// Goals list skeleton: real title + add button, pulsing category groups.
export default function Loading() {
  return (
    <section className="space-y-8" aria-busy>
      <span className="sr-only">Loading…</span>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-light tracking-tight">Goals</h1>
        <Link
          href="/consistencytracker/goals/new"
          className="bg-black text-white text-sm rounded-md px-4 py-2 hover:bg-gray-800"
        >
          + Add goal
        </Link>
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
