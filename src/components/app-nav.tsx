"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

export type NavItem = { href: string; label: string; icon: string };

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
}

export function AppNav({ items, householdName }: { items: NavItem[]; householdName: string }) {
  const path = usePathname();
  // Mobile bottom bar shows at most 5 entries; Settings is always last.
  const mobile = items.length > 5 ? [...items.slice(0, 4), items[items.length - 1]] : items;

  return (
    <>
      <aside className="sticky top-0 hidden h-dvh flex-col gap-1 border-r border-border bg-surface px-3 py-5 md:flex">
        <div className="mb-4 flex items-center gap-2 px-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon.svg" alt="" className="size-8" />
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">Hearth</p>
            <p className="truncate text-xs text-fg-muted">{householdName}</p>
          </div>
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
        className="fixed inset-x-0 bottom-0 z-30 grid border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
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
