"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SignOutButton from "@/app/consistencytracker/sign-out-button";

// The "Consistency Tracker" logo on the left IS the home/Today link, so
// we don't repeat Today here. Standard pattern (GitHub, Linear, Notion).
const ITEMS = [
  { href: "/consistencytracker/goals", label: "Goals" },
  { href: "/consistencytracker/reflections", label: "Reflections" },
  { href: "/consistencytracker/partners", label: "Partners" },
];

export default function TrackerNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center justify-between border-b border-[color:var(--border)] mb-10">
      <div className="flex items-center gap-6">
        <Link
          href="/consistencytracker"
          className="text-sm font-medium tracking-tight pb-4"
        >
          Consistency Tracker
        </Link>
        <div className="flex items-center gap-5">
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
                className={`text-sm transition pb-4 -mb-px border-b-2 ${
                  active
                    ? "text-black font-medium border-black"
                    : "text-[color:var(--muted)] border-transparent hover:text-black hover:border-[color:var(--border)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
      <SignOutButton />
    </nav>
  );
}
