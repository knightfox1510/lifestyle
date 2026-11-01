"use client";

import { useState } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Spinner, cx } from "@/components/ui";

function Pending() {
  const { pending } = useLinkStatus();
  return pending ? <Spinner className="-mr-1 size-3.5" /> : null;
}

/** Section tabs inside a feature; the tapped tab highlights instantly and shows a spinner while loading. */
export function SubNav({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  const [clicked, setClicked] = useState<{ href: string; from: string } | null>(null);
  return (
    <nav className="print:hidden -mx-4 mb-6 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0">
      {items.map((item) => {
        const active = clicked && clicked.from === path ? clicked.href === item.href : path === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setClicked({ href: item.href, from: path })}
            aria-current={active ? "page" : undefined}
            className={cx(
              "pressable inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-[14px]",
              active ? "bg-fg font-medium text-bg" : "bg-surface-2 text-fg-muted hover:text-fg",
            )}
          >
            {item.label}
            <Pending />
          </Link>
        );
      })}
    </nav>
  );
}
