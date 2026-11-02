"use client";

import { useState } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Plus, type LucideIcon } from "lucide-react";
import { cx } from "@/components/ui";
import { Logo } from "@/components/logo";
import { MODULE_ICONS, NAV_ICONS } from "@/components/icons";
import { QuickLogSheet, type QuickLogConfig } from "@/components/quick-log-sheet";

/** `match`: other path prefixes that count as this tab (e.g. Health stays lit inside Medicines). */
export type NavItem = { href: string; label: string; icon: string; match?: readonly string[] };
export type NavGroup = { title: string | null; items: NavItem[] };

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
}

function iconFor(key: string): LucideIcon {
  return (NAV_ICONS as Record<string, LucideIcon>)[key] ?? MODULE_ICONS[key] ?? NAV_ICONS.activity;
}

/**
 * Rendered inside each Link: while that navigation is pending it shows a
 * pulse under the icon and a progress bar across the top of the screen,
 * so a tap never feels dead (pages are server-rendered).
 */
function PendingHint({ variant }: { variant: "tab" | "side" }) {
  const { pending } = useLinkStatus();
  return (
    <>
      <span
        aria-hidden
        className={cx(
          "pointer-events-none absolute rounded-full bg-accent transition-opacity duration-150",
          variant === "tab" ? "-bottom-0.5 left-1/2 h-[3px] w-5 -translate-x-1/2" : "right-3 top-1/2 size-1.5 -translate-y-1/2",
          pending ? "animate-pulse opacity-100" : "opacity-0",
        )}
      />
      {pending ? (
        <span aria-hidden className="fixed inset-x-0 top-0 z-50 h-[3px] origin-left bg-accent [animation:progress_2.5s_ease-out_forwards]" />
      ) : null}
      {pending ? <span className="sr-only" role="status">Loading</span> : null}
    </>
  );
}

export function AppNav({
  groups,
  tabs,
  householdName,
  quickLog,
  logLabel,
}: {
  groups: NavGroup[];
  tabs: NavItem[];
  householdName: string;
  quickLog: QuickLogConfig;
  logLabel: string;
}) {
  const path = usePathname();
  // Optimistic highlight: the tapped item lights up immediately, then the real path takes over.
  const [clicked, setClicked] = useState<{ href: string; from: string } | null>(null);
  const activeHref = (href: string, match?: readonly string[]) =>
    clicked && clicked.from === path ? clicked.href === href : isActive(path, href) || Boolean(match?.some((m) => isActive(path, m)));
  const [sheetOpen, setSheetOpen] = useState(false);
  const left = tabs.slice(0, 2);
  const right = tabs.slice(2);

  const tab = (item: NavItem) => {
    const Icon = iconFor(item.icon);
    const on = activeHref(item.href, item.match);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setClicked({ href: item.href, from: path })}
        aria-current={on ? "page" : undefined}
        className={cx("pressable relative flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium", on ? "text-fg" : "text-fg-muted")}
      >
        <Icon className="size-[22px]" strokeWidth={on ? 2.1 : 1.75} aria-hidden />
        <span className="max-w-full truncate px-1">{item.label}</span>
        <PendingHint variant="tab" />
      </Link>
    );
  };

  return (
    <>
      <aside className="print:!hidden sticky top-0 hidden h-dvh flex-col gap-0.5 overflow-y-auto border-r border-border bg-bg px-3 py-5 md:flex">
        <div className="mb-5 px-2">
          <Logo size="sm" tagline={householdName} />
        </div>
        <button
          onClick={() => setSheetOpen(true)}
          className="pressable mb-4 flex h-11 items-center justify-center gap-2 rounded-full bg-accent text-[15px] font-medium text-accent-fg"
        >
          <Plus className="size-5" aria-hidden /> {logLabel}
        </button>
        {groups.map((g, gi) => (
          <div key={gi} className="mb-3">
            {g.title ? <p className="mb-1 px-3 text-[11px] font-medium uppercase tracking-[0.08em] text-fg-muted">{g.title}</p> : null}
            {g.items.map((item) => {
              const Icon = iconFor(item.icon);
              const on = activeHref(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setClicked({ href: item.href, from: path })}
                  aria-current={on ? "page" : undefined}
                  className={cx(
                    "pressable relative flex items-center gap-3 rounded-xl px-3 py-2 text-[14px]",
                    on ? "bg-surface-2 font-medium text-fg" : "text-fg-muted hover:bg-surface-2/60 hover:text-fg",
                  )}
                >
                  <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
                  {item.label}
                  <PendingHint variant="side" />
                </Link>
              );
            })}
          </div>
        ))}
      </aside>

      <nav
        aria-label="Main"
        className="print:!hidden fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+10px)] z-30 grid h-16 grid-cols-5 rounded-[22px] bg-bg/80 shadow-[0_0_0_1px_var(--border),0_12px_32px_-12px_rgb(0_0_0/0.25)] backdrop-blur-xl md:hidden"
      >
        {left.map(tab)}
        <div className="grid place-items-center">
          <button
            onClick={() => setSheetOpen(true)}
            aria-label={logLabel}
            className="pressable grid size-12 place-items-center rounded-2xl bg-accent text-accent-fg shadow-[0_8px_20px_-8px_var(--accent)]"
          >
            <Plus className="size-6" strokeWidth={2.25} aria-hidden />
          </button>
        </div>
        {right.map(tab)}
      </nav>

      <QuickLogSheet open={sheetOpen} onClose={() => setSheetOpen(false)} config={quickLog} />
    </>
  );
}
