import Skeleton from "@/components/skeleton";

// Partners list skeleton: real title + subtitle + section heading, pulsing form/rows.
export default function Loading() {
  return (
    <section className="space-y-12" aria-busy>
      <span className="sr-only">Loading…</span>
      <div>
        <h1 className="text-xl font-light tracking-tight">Partners</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Share specific goals with someone close. They see your consistency, you see theirs.
        </p>
      </div>
      <div>
        <h2 className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-3">
          Invite someone
        </h2>
        <Skeleton className="h-10 w-full" />
      </div>
      <div>
        <Skeleton className="h-3 w-24 mb-3" />
        <Skeleton className="h-24 w-full" />
      </div>
    </section>
  );
}
