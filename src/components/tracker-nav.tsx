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
    <nav className="mb-10">
      {/* Top tier: brand wordmark (stacked, logo-like) + sign out */}
      <div className="flex items-start justify-between">
        <Link
          href="/consistencytracker"
          aria-label="Consistency Tracker — home"
          className="leading-[1.05] tracking-tight"
        >
          <span className="block text-[15px] font-semibold">Consistency</span>
          <span className="block text-[15px] font-semibold">Tracker</span>
        </Link>
        <SignOutButton />
      </div>

      {/* Bottom tier: the tab bar */}
      <div className="mt-5 flex items-center gap-1 border-b border-[color:var(--border)]">
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
              className="relative pb-3 group"
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
              {/* Active underline, anchored to the tab bar's bottom line */}
              {active ? (
                <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-black" />
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
