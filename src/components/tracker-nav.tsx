"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SignOutButton from "@/app/consistencytracker/sign-out-button";

const ITEMS = [
  { href: "/consistencytracker", label: "Today" },
  { href: "/consistencytracker/goals", label: "Goals" },
  { href: "/consistencytracker/reflections", label: "Reflections" },
  { href: "/consistencytracker/partners", label: "Partners" },
];

export default function TrackerNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center justify-between border-b border-[color:var(--border)] pb-4 mb-10">
      <div className="flex items-center gap-6">
        <Link
          href="/consistencytracker"
          className="text-sm font-medium tracking-tight"
        >
          Consistency Tracker
        </Link>
        <div className="flex items-center gap-4">
          {ITEMS.map((item) => {
            const active =
              item.href === "/consistencytracker"
                ? pathname === item.href
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm transition ${
                  active
                    ? "text-black"
                    : "text-[color:var(--muted)] hover:text-black"
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
