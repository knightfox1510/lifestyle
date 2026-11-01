"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";
import { Logo } from "@/components/logo";

export type NavItem = { href: string; label: string; icon: string };

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
}

export function AppNav({ items, mobileItems, householdName }: { items: NavItem[]; mobileItems: NavItem[]; householdName: string }) {
  const path = usePathname();
  const mobile = mobileItems;

  return (
    <>
      <aside className="print:!hidden sticky top-0 hidden h-dvh flex-col gap-1 border-r border-border bg-surface px-3 py-5 md:flex">
        <div className="mb-4 px-2">
          <Logo size="sm" tagline={householdName} />
        </div>
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cx(
              "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm",
              isActive(path, item.href) ? "bg-accent-soft font-medium text-accent" : "text-fg-muted hover:bg-surface-2",
            )}
          >
            <span aria-hidden>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </aside>

      <nav
        className="print:!hidden fixed inset-x-0 bottom-0 z-30 grid border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        style={{ gridTemplateColumns: `repeat(${mobile.length}, minmax(0, 1fr))` }}
      >
        {mobile.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cx(
              "flex flex-col items-center gap-0.5 py-2 text-[11px]",
              isActive(path, item.href) ? "font-semibold text-accent" : "text-fg-muted",
            )}
          >
            <span aria-hidden className="text-lg leading-none">{item.icon}</span>
            <span className="max-w-full truncate px-1">{item.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
