"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";
import { activeAreaHref } from "@/modules/areas";

/** Shortcut row to related features (shown above a feature's title). */
export function AreaNav({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  const active = activeAreaHref(path, items);
  return (
    <nav aria-label="Related" className="print:hidden -mx-4 mb-3 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={active === i.href ? "page" : undefined}
          className={cx(
            "pressable whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-medium",
            active === i.href ? "bg-accent-soft text-accent" : "text-fg-muted hover:bg-surface-2 hover:text-fg",
          )}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
