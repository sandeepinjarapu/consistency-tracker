"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SignOutButton from "@/app/consistencytracker/sign-out-button";

// "Consistency Tracker" on the left is the brand wordmark — it links home as
// a shortcut but is NOT a tab (no active state), the standard pattern
// (GitHub, Linear, Stripe). The dashboard gets its own "Today" tab so every
// destination is represented consistently and the home view can show active.
const ITEMS = [
  { href: "/consistencytracker", label: "Today" },
  { href: "/consistencytracker/goals", label: "Goals" },
  { href: "/consistencytracker/reflections", label: "Reflections" },
  { href: "/consistencytracker/partners", label: "Partners" },
];

export default function TrackerNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center justify-between border-b border-[color:var(--border)] mb-10">
      <div className="flex items-center gap-3">
        <Link
          href="/consistencytracker"
          className="text-sm font-medium tracking-tight pb-4 pr-1"
        >
          Consistency Tracker
        </Link>
        <div className="flex items-center gap-1">
          {ITEMS.map((item) => {
            const active =
              item.href === "/consistencytracker"
                ? pathname === item.href
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="relative pb-4 group"
              >
                {/* Compact rounded hover fill (GitHub-style affordance) */}
                <span
                  className={`block text-sm rounded-md px-3 py-1.5 transition-colors ${
                    active
                      ? "text-black font-medium"
                      : "text-[color:var(--muted)] group-hover:bg-gray-100 group-hover:text-black"
                  }`}
                >
                  {item.label}
                </span>
                {/* Active underline, anchored to the nav's bottom line */}
                {active ? (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-black" />
                ) : null}
              </Link>
            );
          })}
        </div>
      </div>
      <SignOutButton />
    </nav>
  );
}
