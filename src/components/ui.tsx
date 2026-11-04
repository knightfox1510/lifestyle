import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/** Surfaces: a quiet tonal card. `interactive` adds hover/press feedback for tappable cards. */
export function Card({ className, interactive, ...props }: ComponentProps<"section"> & { interactive?: boolean }) {
  return (
    <section
      className={cx(
        "rounded-[20px] bg-surface p-4 shadow-[0_0_0_1px_var(--border)] sm:p-5",
        interactive && "pressable cursor-pointer hover:bg-surface-2/60",
        className,
      )}
      {...props}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("skeleton rounded-2xl", className)} />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cx("size-4 animate-spin", className)} fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.03em]">{title}</h1>
        {subtitle ? <p className="mt-1.5 max-w-prose text-sm text-fg-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

type Variant = "primary" | "accent" | "secondary" | "soft" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-fg text-bg hover:opacity-90",
  accent: "bg-accent text-accent-fg hover:opacity-90",
  secondary: "bg-surface-2 text-fg hover:bg-border/70",
  soft: "bg-accent-soft text-accent hover:opacity-90",
  ghost: "text-fg hover:bg-surface-2",
  danger: "bg-danger-soft text-danger hover:opacity-90",
};

export function buttonClass(variant: Variant = "primary", size: "sm" | "md" = "md") {
  return cx(
    "pressable inline-flex select-none items-center justify-center gap-1.5 rounded-full font-medium disabled:pointer-events-none disabled:opacity-50",
    size === "sm" ? "h-9 px-3.5 text-sm" : "h-11 px-5 text-[15px]",
    variants[variant],
  );
}

/** `pending` shows a spinner and blocks double taps while an action runs. */
export function Button({
  variant = "primary",
  size = "md",
  className,
  pending,
  children,
  disabled,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: "sm" | "md"; pending?: boolean }) {
  return (
    <button className={cx(buttonClass(variant, size), className)} disabled={disabled || pending} aria-busy={pending || undefined} {...props}>
      {pending ? <Spinner /> : null}
      {children}
    </button>
  );
}

const fieldBase =
  "w-full rounded-xl border-0 bg-surface-2 px-3.5 py-2 text-fg shadow-[inset_0_0_0_1px_var(--border)] placeholder:text-fg-muted/70 focus:outline-none focus:ring-2 focus:ring-accent/50";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(fieldBase, "h-11", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(fieldBase, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(fieldBase, "min-h-20", className)} {...props} />;
}

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block space-y-1.5", className)}>
      <span className="text-[13px] font-medium text-fg-muted">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-fg-muted">{hint}</span> : null}
    </label>
  );
}

export function Checkbox({ label, hint, ...props }: ComponentProps<"input"> & { label: ReactNode; hint?: ReactNode }) {
  return (
    <label className="flex items-start gap-2.5 text-sm">
      <input type="checkbox" className="mt-0.5 size-4 accent-[var(--accent)]" {...props} />
      <span>
        {label}
        {hint ? <span className="block text-xs text-fg-muted">{hint}</span> : null}
      </span>
    </label>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "danger" | "warn" }) {
  const tones = {
    neutral: "bg-surface-2 text-fg-muted",
    accent: "bg-accent-soft text-accent",
    danger: "bg-danger-soft text-danger",
    warn: "bg-warn-soft text-fg",
  };
  return <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", tones[tone])}>{children}</span>;
}

export function Notice({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "danger" | "accent" }) {
  const tones = { neutral: "bg-surface-2", danger: "bg-danger-soft text-danger", accent: "bg-accent-soft" };
  return <div className={cx("rounded-2xl px-4 py-3 text-sm", tones[tone])}>{children}</div>;
}

/** A soft illustration for empty screens: layered rings around a sparkle, in the theme's colours. */
function EmptyArt() {
  return (
    <svg width="96" height="72" viewBox="0 0 96 72" fill="none" aria-hidden className="mb-1">
      <ellipse cx="48" cy="62" rx="30" ry="5" fill="var(--fg)" opacity=".06" />
      <circle cx="48" cy="34" r="26" fill="var(--accent-soft)" style={{ animation: "pop .5s ease-out both" }} />
      <circle cx="48" cy="34" r="17" fill="var(--surface)" stroke="var(--accent)" strokeOpacity=".35" strokeWidth="1.5" strokeDasharray="3 4" />
      <path d="M48 24v20M38 34h20" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "fx-twinkle .7s .15s ease-out both", transformOrigin: "48px 34px" }} />
      <circle cx="76" cy="14" r="3" fill="var(--sun)" style={{ animation: "fx-twinkle .6s .3s ease-out both", transformOrigin: "76px 14px" }} />
      <circle cx="20" cy="20" r="2" fill="var(--cat-water)" style={{ animation: "fx-twinkle .6s .4s ease-out both", transformOrigin: "20px 20px" }} />
      <circle cx="80" cy="46" r="2" fill="var(--cat-food)" style={{ animation: "fx-twinkle .6s .5s ease-out both", transformOrigin: "80px 46px" }} />
    </svg>
  );
}

export function EmptyState({ title, children, icon, action }: { title: string; children?: ReactNode; icon?: ReactNode; /** One clear next step, e.g. { href: "/food", label: "Log breakfast" }. */ action?: { href: string; label: string } }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[20px] bg-surface-2/60 px-6 py-9 text-center [animation:fade-in_.3s_ease-out]">
      {icon ? <div className="mb-1 grid size-12 place-items-center rounded-2xl bg-surface text-fg-muted shadow-[0_0_0_1px_var(--border)]">{icon}</div> : <EmptyArt />}
      <p className="text-[17px] font-semibold tracking-tight">{title}</p>
      {children ? <div className="max-w-sm text-sm text-fg-muted">{children}</div> : null}
      {action ? (
        <Link href={action.href} className={cx(buttonClass("primary", "sm"), "mt-2")}>{action.label}</Link>
      ) : null}
    </div>
  );
}

/** A titled group on a page, styled like Today's sections: small caps title, optional link on the right. */
export function Section({ title, action, children, className }: { title: string; action?: { href: string; label: string }; children: ReactNode; className?: string }) {
  return (
    <section className={cx("space-y-2.5", className)}>
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-[13px] font-medium uppercase tracking-[0.08em] text-fg-muted">{title}</h2>
        {action ? <Link href={action.href} className="text-[13px] text-fg-muted hover:text-fg">{action.label}</Link> : null}
      </div>
      {children}
    </section>
  );
}

/** A number tile with a tinted icon badge (Wearables, Body…). */
export function StatTile({ label, value, icon, tint = "var(--accent)", hint }: { label: string; value: ReactNode; icon?: ReactNode; tint?: string; hint?: ReactNode }) {
  return (
    <div className="rounded-[20px] bg-surface p-3.5 shadow-[0_0_0_1px_var(--border)]">
      <div className="flex items-center gap-2">
        {icon ? <span className="grid size-7 place-items-center rounded-lg [&_svg]:size-4" style={{ background: `color-mix(in oklab, ${tint} 16%, var(--surface))`, color: `color-mix(in oklab, ${tint} 78%, var(--fg))` }} aria-hidden>{icon}</span> : null}
        <p className="min-w-0 text-xs leading-tight text-fg-muted">{label}</p>
      </div>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {hint ? <p className="text-[11px] text-fg-muted">{hint}</p> : null}
    </div>
  );
}
