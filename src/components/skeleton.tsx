/**
 * Pulsing placeholder block. Used by route-level loading.tsx files so pages
 * paint an instant shell instead of blocking on server data. Tinted with the
 * border token so it reads as a quiet placeholder, not content.
 */
export default function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded bg-[color:var(--border)] ${className}`}
    />
  );
}
