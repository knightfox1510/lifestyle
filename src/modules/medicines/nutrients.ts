/** Vitamins and minerals from medicine doses taken (pure; unit-tested). */

type MedNutrients = { id: string; dose_amount: number; nutrients: Record<string, number> | null };
type TakenDose = { medicine_id: string; scheduled_date: string; status: string };

/** Per day: each taken dose adds the medicine's per-unit nutrients × units per dose (e.g. 2 tablets). */
export function medicineDoseNutrients(meds: MedNutrients[], doses: TakenDose[]): Record<string, Record<string, number>> {
  const byId = new Map(meds.filter((m) => m.nutrients && Object.keys(m.nutrients).length).map((m) => [m.id, m]));
  const out: Record<string, Record<string, number>> = {};
  for (const d of doses) {
    if (d.status !== "taken") continue;
    const m = byId.get(d.medicine_id);
    if (!m) continue;
    const day = (out[d.scheduled_date] ??= {});
    const units = Number(m.dose_amount) > 0 ? Number(m.dose_amount) : 1;
    for (const [k, v] of Object.entries(m.nutrients ?? {})) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) day[k] = Math.round(((day[k] ?? 0) + n * units) * 100) / 100;
    }
  }
  return out;
}
