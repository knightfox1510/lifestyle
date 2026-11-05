import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ModuleIcon } from "@/components/icons";
import { cx } from "@/components/ui";

export type HubItem = { href: string; iconKey: string; name: string; status?: string | null; alert?: boolean; /** A number worth a bubble on the icon (doses left, items expiring). */ count?: number };

/** Each feature's colour, for its icon badge. */
const TINT: Record<string, string> = {
  medicines: "var(--cat-meds)", supplements: "var(--cat-meds)", checkin: "var(--cat-check)", habits: "var(--cat-check)",
  bladder_diary: "var(--cat-water)", pelvic_floor: "var(--cat-water)", cycle: "var(--danger)", private_log: "var(--cat-meds)",
  body_recomp: "var(--accent)", fitness: "var(--sun)", wearables: "var(--danger)", medical_records: "var(--accent)",
  food_diary: "var(--cat-food)", groceries: "var(--cat-food)", pantry: "var(--cat-food)", recipes: "var(--cat-food)", dining: "var(--cat-food)",
  child: "var(--sun)", maintenance: "var(--fg-muted)", documents: "var(--cat-water)", subscriptions: "var(--accent)", occasions: "var(--danger)", travel: "var(--cat-water)", watchlist: "var(--cat-meds)",
};

/** Big tappable tiles with a live one-line status (used by the Health and Me hubs). */
export function HubGrid({ title, items }: { title?: string; items: HubItem[] }) {
  if (!items.length) return null;
  return (
    <section className="space-y-2.5">
      {title ? <h2 className="px-1 text-[13px] font-medium uppercase tracking-[0.08em] text-fg-muted">{title}</h2> : null}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {items.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className="pressable group flex min-h-[112px] flex-col justify-between rounded-[20px] bg-surface p-4 shadow-[0_0_0_1px_var(--border)] hover:bg-surface-2/50"
          >
            <div className="flex items-start justify-between">
              <span className="relative grid size-10 place-items-center rounded-2xl" style={{ background: `color-mix(in oklab, ${TINT[i.iconKey] ?? "var(--fg-muted)"} 16%, var(--surface))`, color: `color-mix(in oklab, ${TINT[i.iconKey] ?? "var(--fg)"} 78%, var(--fg))` }}>
                <ModuleIcon moduleKey={i.iconKey} />
                {i.count ? (
                  <span className={cx("absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-semibold tabular-nums ring-2 ring-surface [animation:pop_.4s_ease-out]", i.alert ? "bg-danger text-white" : "bg-fg text-bg")}>
                    {i.count > 99 ? "99+" : i.count}
                  </span>
                ) : null}
              </span>
              <ChevronRight className="size-4 text-fg-muted opacity-0 transition group-hover:opacity-100" aria-hidden />
            </div>
            <div>
              <p className="text-[15px] font-medium leading-tight">{i.name}</p>
              {i.status ? <p className={cx("mt-0.5 line-clamp-2 text-[13px]", i.alert ? "font-medium text-danger" : "text-fg-muted")}>{i.status}</p> : null}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Plain list rows for settings-style links. */
export function HubList({ title, items }: { title?: string; items: { href: string; name: string; hint?: string; /** A small tinted icon badge, e.g. <Bell />. */ icon?: React.ReactNode; tint?: string }[] }) {
  return (
    <section className="space-y-2.5">
      {title ? <h2 className="px-1 text-[13px] font-medium uppercase tracking-[0.08em] text-fg-muted">{title}</h2> : null}
      <div className="divide-y divide-border overflow-hidden rounded-[20px] bg-surface shadow-[0_0_0_1px_var(--border)]">
        {items.map((i) => (
          <Link key={i.href} href={i.href} className="pressable flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-surface-2/50">
            {i.icon ? (
              <span className="grid size-9 shrink-0 place-items-center rounded-xl [&_svg]:size-[18px]" style={{ background: `color-mix(in oklab, ${i.tint ?? "var(--accent)"} 16%, var(--surface))`, color: `color-mix(in oklab, ${i.tint ?? "var(--accent)"} 78%, var(--fg))` }} aria-hidden>
                {i.icon}
              </span>
            ) : null}
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium">{i.name}</span>
              {i.hint ? <span className="block truncate text-[13px] text-fg-muted">{i.hint}</span> : null}
            </span>
            <ChevronRight className="size-4 shrink-0 text-fg-muted" aria-hidden />
          </Link>
        ))}
      </div>
    </section>
  );
}
