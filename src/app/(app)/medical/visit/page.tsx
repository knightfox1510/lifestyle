import Link from "next/link";
import { getSession } from "@/lib/session";
import { Card, Field, Input, Select, cx } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { loadVisitData, VISIT_PERIODS } from "@/lib/visit-summary";
import { refLabel, valueLabel } from "@/modules/medical/labs";
import { CATEGORY_META } from "@/modules/medical/meta";
import { PrintButton } from "@/app/(app)/bladder/report/print-button";
import { AiVisitSummary } from "./ai-summary";
import { PillIcon } from "@/components/pill-icon";
import { ColumnChart, LineChart } from "@/components/charts";
import { addDays, lastNDays, localDate, shortDate, startOfLocalDayIso, todayIn } from "@/lib/dates";

export const metadata = { title: "Doctor visit summary" };

export default async function VisitSummaryPage({ searchParams }: PageProps<"/medical/visit">) {
  const session = await getSession();
  const t = await getT(session);
  const sp = await searchParams;
  const days = VISIT_PERIODS.includes(Number(sp.days) as (typeof VISIT_PERIODS)[number]) ? Number(sp.days) : 90;
  const reason = typeof sp.reason === "string" ? sp.reason.slice(0, 200) : "";
  const subject = session.subject;
  // Which sections to include (all unless some are unticked).
  type VisitSection = "medicines" | "labs" | "vitals" | "bladder" | "food" | "wellbeing";
  const picked = typeof sp.inc === "string" ? sp.inc.split(",") : Array.isArray(sp.inc) ? sp.inc : null;
  const inc = (k: VisitSection) => !picked || picked.includes(k);
  const tz = session.profile.timezone;
  const today = todayIn(tz);
  const from = addDays(today, -(days - 1));
  const can = (m: string) => session.isModuleEnabled(m) && session.accessTo(m, subject.user_id) !== "none";
  const [v, weightRows, leakRows, foodRows] = await Promise.all([
    loadVisitData(session, subject.user_id, days),
    inc("vitals") && can("body_recomp") ? session.supabase.from("body_metrics").select("measured_at, weight_kg").eq("owner_id", subject.user_id).not("weight_kg", "is", null).gte("measured_at", startOfLocalDayIso(from)).order("measured_at") : Promise.resolve({ data: [] }),
    inc("bladder") && can("bladder_diary") ? session.supabase.from("bladder_events").select("occurred_at, kind").eq("owner_id", subject.user_id).gte("occurred_at", startOfLocalDayIso(from)) : Promise.resolve({ data: [] }),
    inc("food") && can("food_diary") ? session.supabase.from("food_entries").select("eaten_at, calories, protein_g, fiber_g").eq("owner_id", subject.user_id).gte("eaten_at", startOfLocalDayIso(from)).limit(5000) : Promise.resolve({ data: [] }),
  ]);
  const weights = [...new Map(((weightRows.data ?? []) as { measured_at: string; weight_kg: number }[]).map((w) => [localDate(w.measured_at, tz), Number(w.weight_kg)])).entries()].map(([d, kg]) => ({ date: d, value: kg, label: shortDate(d) }));
  const leakDays = lastNDays(today, Math.min(days, 60));
  const leaksBy = new Map<string, number>();
  const loggedBladder = new Set<string>();
  for (const e of (leakRows.data ?? []) as { occurred_at: string; kind: string }[]) {
    const d = localDate(e.occurred_at, tz);
    loggedBladder.add(d);
    if (e.kind === "leak") leaksBy.set(d, (leaksBy.get(d) ?? 0) + 1);
  }
  const foodBy = new Map<string, { kcal: number; protein: number; fiber: number }>();
  for (const f of (foodRows.data ?? []) as { eaten_at: string; calories: number | null; protein_g: number | null; fiber_g: number | null }[]) {
    const d = localDate(f.eaten_at, tz);
    const x = foodBy.get(d) ?? { kcal: 0, protein: 0, fiber: 0 };
    x.kcal += Number(f.calories ?? 0);
    x.protein += Number(f.protein_g ?? 0);
    x.fiber += Number(f.fiber_g ?? 0);
    foodBy.set(d, x);
  }
  const fullFood = [...foodBy.values()].filter((x) => x.kcal >= 800);
  const avgOf = (k: "kcal" | "protein" | "fiber") => (fullFood.length ? Math.round(fullFood.reduce((a, x) => a + x[k], 0) / fullFood.length) : null);
  const locale = `${session.profile.language ?? "en"}-IN`;
  const date = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

  return (
    <div className="space-y-4">
      <form className="flex flex-wrap items-end gap-2 print:hidden">
        <Field label={t("Period")} className="w-36">
          <Select name="days" defaultValue={String(days)}>
            {VISIT_PERIODS.map((p) => (
              <option key={p} value={p}>{t("Last {n} days", { n: p })}</option>
            ))}
          </Select>
        </Field>
        <Field label={t("Reason for the visit (optional)")} className="min-w-48 flex-1">
          <Input name="reason" defaultValue={reason} placeholder={t("e.g. follow-up for thyroid, frequent urination")} maxLength={200} />
        </Field>
        <fieldset className="w-full">
          <legend className="mb-1 text-xs font-medium text-fg-muted">{t("Include")}</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {([["medicines", t("Medicines")], ["labs", t("Blood work & tests")], ["vitals", t("Vitals & weight")], ["bladder", t("Bladder diary")], ["food", t("Food & nutrition")], ["wellbeing", t("Sleep, mood & activity")]] as const).map(([k, label]) => (
              <label key={k} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" name="inc" value={k} defaultChecked={inc(k)} className="size-4 accent-[var(--accent)]" /> {label}
              </label>
            ))}
          </div>
        </fieldset>
        <button className="h-10 rounded-xl border border-border px-3 text-sm hover:bg-surface-2">{t("Update")}</button>
        <PrintButton />
      </form>
      <p className="text-xs text-fg-muted print:hidden">{t("A one-page summary to show or send your doctor. Use “Print / Save PDF” and choose “Save as PDF” to share it on WhatsApp or email.")}</p>

      <article className="space-y-4 print:space-y-3 print:text-[12px]">
        <header className="rounded-2xl border border-border bg-surface p-4 print:border-0 print:p-0">
          <h2 className="text-lg font-semibold">{t("Health summary")} · {v.person}</h2>
          <p className="text-sm text-fg-muted">
            {[v.age != null ? t("{n} years", { n: v.age }) : null, v.profile?.sex ? t(v.profile.sex) : null, v.profile?.blood_group ? `${t("Blood group")} ${v.profile.blood_group}` : null, v.profile?.height_cm ? `${v.profile.height_cm} cm` : null].filter(Boolean).join(" · ")}
          </p>
          <p className="text-xs text-fg-muted">{t("Period")}: {date(v.from)} – {date(v.today)}{reason ? ` · ${t("Reason")}: ${reason}` : ""}</p>
        </header>

        <AiVisitSummary subjectId={subject.user_id} days={days} reason={reason} />

        <Section title={`⚠️ ${t("Allergies")}`}>
          {v.allergies.length ? <p className="text-sm font-medium text-danger">{v.allergies.map((a) => a.title + (a.details ? ` (${a.details})` : "")).join("; ")}</p> : <p className="text-sm text-fg-muted">{t("None recorded")}</p>}
        </Section>

        {v.conditions.length ? (
          <Section title={t("Conditions")}>
            <ul className="text-sm">
              {v.conditions.map((c) => (
                <li key={c.id}>• {c.title}{c.ongoing ? ` (${t("ongoing")})` : ""} <span className="text-fg-muted">— {t("since")} {date(c.start_date)}</span></li>
              ))}
            </ul>
          </Section>
        ) : null}

        {inc("medicines") ? <Section title={`💊 ${t("Current medicines")}`}>
          {v.medicines.length || v.supplements.length ? (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-fg-muted">
                <tr>
                  <th className="py-1 pr-2 font-normal">{t("Medicine")}</th>
                  <th className="py-1 pr-2 font-normal">{t("Dose & time")}</th>
                  <th className="py-1 pr-2 font-normal">{t("For")}</th>
                  <th className="py-1 font-normal">{t("Taken")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {v.medicines.map(({ m, label, adherence }) => (
                  <tr key={m.id}>
                    <td className="py-1 pr-2 font-medium"><span className="inline-flex items-center gap-1.5"><PillIcon shape={(m as { pill_shape?: string | null }).pill_shape} color={(m as { pill_color?: string | null }).pill_color} size={20} />{m.name} {m.strength}</span></td>
                    <td className="py-1 pr-2">{label}{m.times.length ? ` · ${m.times.join(", ")}` : ""}</td>
                    <td className="py-1 pr-2">{m.reason ?? "—"}{m.prescribed_by ? ` (${m.prescribed_by})` : ""}</td>
                    <td className={cx("py-1", adherence != null && adherence < 80 && "text-danger")}>{adherence != null ? `${adherence}%` : "—"}</td>
                  </tr>
                ))}
                {v.supplements.map((s) => (
                  <tr key={s.id}>
                    <td className="py-1 pr-2">{s.name}</td>
                    <td className="py-1 pr-2">{s.dose ?? ""}</td>
                    <td className="py-1 pr-2 text-fg-muted">{t("supplement")}</td>
                    <td className="py-1">—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-fg-muted">{t("None recorded")}</p>
          )}
          {v.flags.length ? (
            <div className="mt-2 rounded-xl bg-danger-soft p-2 text-sm">
              <p className="font-medium">{t("Medicine checks to discuss")}</p>
              <ul>
                {v.flags.map((f) => (
                  <li key={f.id}>• {f.title}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </Section> : null}

        {v.timeline.length ? (
          <Section title={`🩺 ${t("Health events in this period")}`}>
            <ul className="space-y-1 text-sm">
              {v.timeline.map((e) => (
                <li key={e.id}>
                  <span className="text-fg-muted">{date(e.start_date)}</span> {CATEGORY_META[e.category]?.icon} <strong>{e.title}</strong>
                  {e.severity ? ` (${t(e.severity)})` : ""}
                  {e.details ? <span className="text-fg-muted"> — {e.details.slice(0, 160)}</span> : null}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {inc("labs") && (v.labsInPeriod.length || v.olderAbnormal.length) ? (
          <Section title={`🧪 ${t("Blood work & tests")}`}>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                {[...v.labsInPeriod.slice(0, 40), ...v.olderAbnormal].map((l) => (
                  <tr key={l.id} className={l.test_date < v.from ? "text-fg-muted" : ""}>
                    <td className="py-1 pr-2 text-xs">{date(l.test_date)}</td>
                    <td className="py-1 pr-2">{l.marker}</td>
                    <td className={cx("py-1 pr-2 font-medium", l.flag && l.flag !== "normal" && "text-danger")}>
                      {valueLabel(l)} {l.flag && l.flag !== "normal" ? `(${t(l.flag)})` : ""}
                    </td>
                    <td className="py-1 text-xs text-fg-muted">{refLabel(l)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {v.olderAbnormal.length ? <p className="mt-1 text-xs text-fg-muted">{t("Greyed rows: abnormal results from earlier in the year.")}</p> : null}
          </Section>
        ) : null}

        {inc("vitals") && (v.vitals.weight || v.vitals.bpLatest || v.vitals.glucoseLatest) ? (
          <Section title={`📈 ${t("Vitals")}`}>
            <ul className="grid gap-1 text-sm sm:grid-cols-2">
              {v.vitals.weight ? <li>{t("Weight")}: <strong>{v.vitals.weight} kg</strong>{v.vitals.weightChange != null ? ` (${v.vitals.weightChange > 0 ? "+" : ""}${v.vitals.weightChange} kg)` : ""}{v.vitals.bmi ? ` · BMI ${v.vitals.bmi}` : ""}</li> : null}
              {v.vitals.bpLatest ? <li>{t("Blood pressure")}: <strong>{v.vitals.bpLatest}</strong>{v.vitals.bpAverage ? ` (${t("average")} ${v.vitals.bpAverage}, ${v.vitals.bpReadings} ${t("readings")})` : ""}</li> : null}
              {v.vitals.glucoseLatest ? <li>{t("Blood glucose")}: <strong>{v.vitals.glucoseLatest} mg/dL</strong></li> : null}
              {v.vitals.restingHr ? <li>{t("Resting heart rate")}: {v.vitals.restingHr}</li> : null}
            </ul>
            {weights.length >= 3 ? <div className="pt-2"><LineChart title={t("Weight")} points={weights} unit=" kg" height={120} /></div> : null}
          </Section>
        ) : null}

        {inc("bladder") && v.bladder ? (
          <Section title={`💧 ${t("Bladder diary")}`}>
            <p className="text-sm">
              {t("Per day over {n} logged days:", { n: v.bladder.days })} <strong>{v.bladder.voids}</strong> {t("bathroom visits")} ({v.bladder.nightVoids} {t("at night")}), <strong>{v.bladder.leaks}</strong> {t("leaks")}, <strong>{v.bladder.urges}</strong> {t("urgency episodes")}, {v.bladder.fluidMl} ml {t("fluids")}.
            </p>
            {v.bladder.triggers.length ? <p className="text-sm text-fg-muted">{t("Common leak triggers")}: {v.bladder.triggers.map((x) => `${t(x.label)} ×${x.value}`).join(", ")}</p> : null}
            {loggedBladder.size >= 5 ? (
              <div className="pt-2">
                <ColumnChart title={t("Leaks per day")} subtitle={t("Last {n} days", { n: leakDays.length })} height={90} data={leakDays.map((d) => ({ key: d, label: shortDate(d), value: leaksBy.get(d) ?? 0, tooltip: `${shortDate(d)}: ${loggedBladder.has(d) ? `${leaksBy.get(d) ?? 0} leaks` : "not logged"}` }))} />
              </div>
            ) : null}
            <Link href="/bladder/report" className="text-xs text-accent underline print:hidden">{t("Full bladder diary report")}</Link>
          </Section>
        ) : null}

        {inc("food") && fullFood.length >= 3 ? (
          <Section title={`🍽️ ${t("Food & nutrition")}`}>
            <p className="text-sm">
              {t("Average over {n} fully logged days:", { n: fullFood.length })} <strong>{avgOf("kcal")?.toLocaleString(locale)} kcal</strong> · {t("Protein")} {avgOf("protein")} g · {t("Fibre")} {avgOf("fiber")} g
            </p>
          </Section>
        ) : null}

        {inc("wellbeing") && (v.wellbeing.sleepHours || v.wellbeing.mood || v.wellbeing.steps) ? (
          <Section title={`🌙 ${t("Sleep, mood & activity")}`}>
            <p className="text-sm">
              {[v.wellbeing.sleepHours ? `${t("Sleep")} ${v.wellbeing.sleepHours} h` : null, v.wellbeing.mood ? `${t("Mood")} ${v.wellbeing.mood}/5` : null, v.wellbeing.energy ? `${t("Energy")} ${v.wellbeing.energy}/5` : null, v.wellbeing.stress ? `${t("Stress")} ${v.wellbeing.stress}/5` : null, v.wellbeing.steps ? `${v.wellbeing.steps.toLocaleString(locale)} ${t("steps/day")}` : null].filter(Boolean).join(" · ")}
            </p>
          </Section>
        ) : null}

        <Section title={`📝 ${t("My questions and notes")}`}>
          <textarea className="min-h-24 w-full rounded-xl border border-border bg-transparent p-2 text-sm print:border-0" placeholder={t("Type anything you want to remember to ask…")} />
        </Section>
        <p className="text-[11px] text-fg-muted">{t("Prepared with Hearth from the patient's own records. Not a medical document; please verify with original reports.")}</p>
      </article>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="space-y-1.5 break-inside-avoid print:border-0 print:p-0 print:shadow-none">
      <h3 className="font-semibold">{title}</h3>
      {children}
    </Card>
  );
}
