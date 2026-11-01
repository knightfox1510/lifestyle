"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

export function SubNav({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="-mx-4 mb-5 flex gap-1 overflow-x-auto px-4 md:mx-0 md:px-0">
      {items.map((item) => {
        const active = path === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cx(
              "whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm",
              active ? "bg-fg text-bg font-medium" : "bg-surface-2 text-fg-muted hover:text-fg",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
