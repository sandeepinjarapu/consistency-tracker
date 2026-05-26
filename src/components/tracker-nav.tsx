"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SignOutButton from "@/app/consistencytracker/sign-out-button";

const ITEMS = [
  { href: "/consistencytracker", label: "Today" },
  { href: "/consistencytracker/goals", label: "Goals" },
  { href: "/consistencytracker/reflections", label: "Reflections" },
  { href: "/consistencytracker/partners", label: "Partners", badgeKey: "partners" as const },
];

export default function TrackerNav({
  badges,
}: {
  badges?: { partners?: number };
}) {
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
            const badgeCount =
              "badgeKey" in item && item.badgeKey
                ? badges?.[item.badgeKey] ?? 0
                : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm transition inline-flex items-center gap-1.5 ${
                  active
                    ? "text-black"
                    : "text-[color:var(--muted)] hover:text-black"
                }`}
              >
                {item.label}
                {badgeCount > 0 ? (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-black text-white text-[10px] font-medium leading-none">
                    {badgeCount}
                  </span>
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
