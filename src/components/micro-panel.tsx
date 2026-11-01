import { cx } from "@/components/ui";
import { MICRO_KEYS, NUTRIENT_META, formatNutrient, type NutrientKey, type Nutrients, type Target } from "@/modules/nutrition/nutrients";

/**
 * Micronutrients vs daily targets. Shows coverage (how much of the intake had
 * micronutrient data) so partial data isn't read as a deficiency.
 */
export function MicroPanel({
  totals,
  targets,
  labLinks,
  coverage,
  days = 1,
}: {
  totals: Nutrients;
  targets: Partial<Record<NutrientKey, Target>>;
  labLinks: Map<NutrientKey, { marker: string; value: string; flag: string; date: string }>;
  coverage: { withData: number; total: number };
  days?: number;
}) {
  const keys = ["fiber_g", ...MICRO_KEYS.filter((k) => targets[k])] as NutrientKey[];
  const pct = coverage.total ? Math.round((coverage.withData / coverage.total) * 100) : 0;
  return (
    <div className="space-y-2">
      <p className="text-xs text-fg-muted">
        {days > 1 ? "Daily average. " : ""}Based on {coverage.withData} of {coverage.total} items with full nutrient data ({pct}%).
        {pct < 70 ? " Use the calculator, saved recipes or scanned labels to fill the gaps; AI estimates have no vitamin data." : ""}
      </p>
      <ul className="space-y-1.5">
        {keys.map((k) => {
          const t = targets[k];
          if (!t) return null;
          const v = (totals[k] ?? 0) / days;
          const ratio = t.amount ? v / t.amount : 0;
          const bad = t.kind === "max" ? ratio > 1 : ratio < 0.5;
          const lab = labLinks.get(k);
          return (
            <li key={k} className="text-sm">
              <div className="flex justify-between gap-2">
                <span>
                  {NUTRIENT_META[k].label}
                  {lab ? <span className="ml-1 text-xs text-danger">· blood test {lab.flag} ({lab.marker} {lab.value})</span> : null}
                </span>
                <span className="tabular-nums text-fg-muted">
                  <span className={cx(bad && "text-danger")}>{formatNutrient(k, v)}</span> {t.kind === "max" ? "limit" : "of"} {formatNutrient(k, t.amount)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" title={t.note}>
                <div className={cx("h-full rounded-full", t.kind === "max" ? (ratio > 1 ? "bg-danger" : "bg-series-2") : "bg-series-1")} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-fg-muted">Targets: ICMR-NIN 2020 RDAs for adults (sodium, potassium and saturated fat from WHO). Approximate; follow your doctor&apos;s advice.</p>
    </div>
  );
}
