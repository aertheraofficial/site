"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SOCIAL_TABS } from "@/lib/social/tabs";

export function SocialTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Social sections" className="flex flex-wrap gap-2.5">
      {SOCIAL_TABS.map((tab) => {
        // "/admin/social" is the parent of every other tab, so an exact match
        // is the only way it stops looking active on its own children.
        const isActive =
          tab.href === "/admin/social"
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={`inline-flex min-h-11 items-center justify-center rounded-full border px-5 text-[0.76rem] font-semibold uppercase tracking-[0.16em] transition ${
              isActive
                ? "border-[#201d17] bg-[#201d17] text-white"
                : "border-black/8 bg-white text-[#201d17] hover:border-black/20"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
