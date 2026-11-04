import Link from "next/link";
import { buttonClass } from "@/components/ui";
import type { CheckinFacts } from "@/modules/coach/checkin";
import type { T } from "@/lib/i18n/core";

const near = (a: number, b: number, pct = 0.1) => Math.abs(a - b) <= b * pct;

/** "Coach check-in": shown on Today once a coach plan's review date arrives. */
export function CoachCheckinCard({ facts, t }: { facts: CheckinFacts; t: T }) {
  const rows: { label: string; text: string; ok: boolean | null }[] = [];
  if (facts.kcal) rows.push({ label: t("Calories"), text: `${facts.kcal.actual.toLocaleString("en-IN")} ${t("vs")} ${facts.kcal.planned.toLocaleString("en-IN")} kcal`, ok: near(facts.kcal.actual, facts.kcal.planned) });
  if (facts.protein) rows.push({ label: t("Protein"), text: `${facts.protein.actual} ${t("vs")} ${facts.protein.planned} g`, ok: facts.protein.actual >= facts.protein.planned * 0.9 });
  if (facts.steps) rows.push({ label: t("Steps"), text: `${facts.steps.actual.toLocaleString("en-IN")} ${t("vs")} ${facts.steps.planned.toLocaleString("en-IN")}`, ok: facts.steps.actual >= facts.steps.planned * 0.9 });
  if (facts.weight) rows.push({ label: t("Weight"), text: `${facts.weight.change > 0 ? "+" : ""}${facts.weight.change} kg${facts.weight.expected != null ? ` (${t("plan")} ${facts.weight.expected > 0 ? "+" : ""}${facts.weight.expected})` : ""}`, ok: facts.weight.expected == null ? null : Math.sign(facts.weight.change) === Math.sign(facts.weight.expected) && Math.abs(facts.weight.change) >= Math.abs(facts.weight.expected) * 0.6 });
  return (
    <section className="space-y-3 rounded-[20px] bg-surface p-4 shadow-[0_0_0_1px_var(--border)] [animation:toast-in_.3s_ease-out]">
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-xl bg-accent-soft text-lg" aria-hidden>🧭</span>
        <div className="min-w-0">
          <p className="font-semibold">{t("Coach check-in")}</p>
          <p className="text-[13px] text-fg-muted">{t("{n} days on your plan. Here's how it went.", { n: facts.daysSince })}</p>
        </div>
      </div>
      {rows.length ? (
        <ul className="grid grid-cols-2 gap-2">
          {rows.map((r) => (
            <li key={r.label} className="rounded-xl bg-surface-2/60 px-3 py-2">
              <p className="text-[11px] text-fg-muted">{r.label} {r.ok === true ? <span className="text-accent">✓</span> : r.ok === false ? <span className="text-danger">↓</span> : null}</p>
              <p className="text-[13px] font-medium tabular-nums">{r.text}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-fg-muted">{t("Not much was logged since the plan. Log a few days of food and weigh-ins for a useful review.")}</p>
      )}
      <Link href="/body/coach" className={buttonClass("primary", "sm")}>{t("Review with the coach")}</Link>
    </section>
  );
}
