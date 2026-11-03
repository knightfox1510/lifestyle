"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Field, Notice, Select, Textarea, cx } from "@/components/ui";
import { useToast } from "@/components/toaster";
import { COACH_GOALS, COACH_GOAL_LABEL, factLines, type CoachFacts, type CoachGoal } from "@/modules/coach/facts";
import type { CoachResult } from "@/lib/ai/coach-schema";
import { applyCoachPlan, deleteCoachReport } from "./actions";

export type CoachReport = {
  id: string | null;
  created_at: string;
  goal: CoachGoal;
  question: string | null;
  period_days: number;
  included: string[];
  facts: CoachFacts;
  result: CoachResult;
  applied_at: string | null;
};

const AREA_ICON: Record<string, string> = { food: "🍽️", body: "⚖️", sleep: "😴", activity: "🚶", training: "🏋️", heart: "❤️", supplements: "🧴", medicines: "💊", labs: "🧪", stress: "🧘", other: "✨" };
const IMPACT: Record<string, { label: string; tone: "accent" | "warn" | "danger" }> = { positive: { label: "Going well", tone: "accent" }, watch: { label: "Watch", tone: "warn" }, concern: { label: "Needs attention", tone: "danger" } };
const MEAL_LABEL: Record<string, string> = { breakfast: "Breakfast", lunch: "Lunch", snack: "Snack", dinner: "Dinner" };

type Prefs = { goal: CoachGoal; days: number; include: string[] };

export function CoachClient({ storageKey, sources, reports, canApply, person }: { storageKey: string; sources: { key: string; label: string }[]; reports: CoachReport[]; canApply: boolean; person: string | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<Prefs>({ goal: "fat_loss", days: 30, include: sources.map((s) => s.key) });
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<CoachReport | null>(null);
  const [shownId, setShownId] = useState<string | null>(reports[0]?.id ?? null);
  const [showForm, setShowForm] = useState(reports.length === 0);
  const [pending, start] = useTransition();

  // Remember the last choices on this device.
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null") as Prefs | null;
        if (saved && COACH_GOALS.includes(saved.goal) && Array.isArray(saved.include)) setPrefs({ ...saved, include: saved.include.filter((k) => sources.some((s) => s.key === k)) });
      } catch {
        /* ignore */
      }
    }, 0);
    return () => window.clearTimeout(t);
    // Only on first load: later changes are saved as they're made.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);
  const save = (p: Prefs) => {
    setPrefs(p);
    try {
      localStorage.setItem(storageKey, JSON.stringify(p));
    } catch {
      /* ignore */
    }
  };

  const all = fresh && !reports.some((r) => r.id === fresh.id) ? [fresh, ...reports] : reports;
  const shown = all.find((r) => r.id === shownId) ?? (fresh && shownId === fresh.id ? fresh : null) ?? all[0] ?? null;

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/coach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goal: prefs.goal, days: prefs.days, include: prefs.include, question: question.trim() || undefined }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "The coach couldn't answer. Try again.");
      setFresh(body);
      setShownId(body.id);
      setShowForm(false);
      setQuestion("");
      if (body.saveError) toast(body.saveError, { tone: "error" });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold">✨ AI coach{person ? ` for ${person}` : ""}</h2>
            <p className="text-xs text-fg-muted">Insights and a plan from your own food, body, sleep, wearables, workouts, medicines and more. You choose what it sees.</p>
          </div>
          {!showForm ? (
            <Button size="sm" variant="secondary" onClick={() => setShowForm(true)}>New review</Button>
          ) : null}
        </div>

        {showForm ? (
          <div className="space-y-3">
            <div>
              <p className="mb-1.5 text-sm font-medium">Goal</p>
              <div className="flex flex-wrap gap-1.5">
                {COACH_GOALS.map((g) => (
                  <button key={g} type="button" onClick={() => save({ ...prefs, goal: g })} className={cx("rounded-full border px-3 py-1.5 text-sm", prefs.goal === g ? "border-accent bg-accent-soft font-medium" : "border-border hover:bg-surface-2")} aria-pressed={prefs.goal === g}>
                    {COACH_GOAL_LABEL[g]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Include</p>
                <button type="button" className="text-xs text-accent" onClick={() => save({ ...prefs, include: prefs.include.length === sources.length ? [] : sources.map((s) => s.key) })}>
                  {prefs.include.length === sources.length ? "None" : "All"}
                </button>
              </div>
              {sources.length ? (
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {sources.map((s) => (
                    <label key={s.key} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                      <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={prefs.include.includes(s.key)} onChange={(e) => save({ ...prefs, include: e.target.checked ? [...prefs.include, s.key] : prefs.include.filter((k) => k !== s.key) })} />
                      {s.label}
                    </label>
                  ))}
                </div>
              ) : (
                <Notice>No data is available to include yet.</Notice>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
              <Field label="Look back">
                <Select value={prefs.days} onChange={(e) => save({ ...prefs, days: Number(e.target.value) })}>
                  {[14, 30, 60, 90].map((d) => (
                    <option key={d} value={d}>Last {d} days</option>
                  ))}
                </Select>
              </Field>
              <Field label="Anything specific? (optional)">
                <Textarea value={question} maxLength={600} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. Give me the best plan to lose 6 kg of fat by March without losing muscle" className="min-h-11" />
              </Field>
            </div>

            {error ? <Notice tone="danger">{error}</Notice> : null}
            <div className="flex flex-wrap items-center gap-2">
              <Button disabled={loading || !prefs.include.length} onClick={() => void run()}>{loading ? "Reviewing your data…" : "Get my insights & plan"}</Button>
              {all.length ? <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button> : null}
              {loading ? <span className="text-xs text-fg-muted">This can take up to a minute.</span> : null}
            </div>
            <p className="text-[11px] text-fg-muted">General guidance from AI, not medical advice. Check big changes, and anything about medicines, with your doctor.</p>
          </div>
        ) : null}
      </Card>

      {shown ? (
        <ReportView
          report={shown}
          canApply={canApply}
          pending={pending}
          onApply={() =>
            shown.id &&
            start(async () => {
              const r = await applyCoachPlan(shown.id!);
              toast(r.error ?? r.message ?? "Saved.", r.error ? { tone: "error" } : undefined);
              if (!r.error) router.refresh();
            })
          }
          onDelete={() =>
            shown.id &&
            confirm("Delete this report?") &&
            start(async () => {
              const r = await deleteCoachReport(shown.id!);
              toast(r.error ?? r.message ?? "Deleted.", r.error ? { tone: "error" } : undefined);
              setFresh(null);
              setShownId(null);
              router.refresh();
            })
          }
        />
      ) : null}

      {all.length > 1 ? (
        <Card>
          <h2 className="mb-2 text-sm font-semibold">Earlier reviews</h2>
          <ul className="divide-y divide-border">
            {all.map((r) => (
              <li key={r.id ?? r.created_at}>
                <button type="button" onClick={() => setShownId(r.id)} className={cx("flex w-full items-start justify-between gap-3 py-2 text-left text-sm", r.id === shown?.id && "font-medium")}>
                  <span className="min-w-0">
                    <span className="block truncate">{r.result.headline}</span>
                    <span className="text-xs text-fg-muted">{COACH_GOAL_LABEL[r.goal] ?? r.goal} · last {r.period_days} days{r.result.plan.calories_kcal ? ` · ${r.result.plan.calories_kcal} kcal` : ""}{r.facts.weight ? ` · ${r.facts.weight.latest} kg` : ""}</span>
                  </span>
                  <span className="shrink-0 text-xs text-fg-muted">{new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function Target({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  if (value == null) return null;
  return (
    <div className="rounded-xl bg-surface-2/60 px-3 py-2">
      <p className="text-[11px] text-fg-muted">{label}</p>
      <p className="font-semibold tabular-nums">
        {value.toLocaleString("en-IN")}
        <span className="text-xs font-normal text-fg-muted"> {unit}</span>
      </p>
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <Card>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </Card>
  );
}

function ReportView({ report, canApply, pending, onApply, onDelete }: { report: CoachReport; canApply: boolean; pending: boolean; onApply: () => void; onDelete: () => void }) {
  const r = report.result;
  const p = r.plan;
  const [done, setDone] = useState<number[]>([]);
  const rate = p.expected_kg_per_week;
  return (
    <div className="space-y-4">
      <Card className="space-y-2">
        <p className="text-xs text-fg-muted">
          {new Date(report.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · {COACH_GOAL_LABEL[report.goal] ?? report.goal} · last {report.period_days} days
        </p>
        <p className="text-lg font-semibold leading-snug">{r.headline}</p>
        {report.question ? <p className="text-sm text-fg-muted">You asked: “{report.question}”</p> : null}
        <p className="text-sm">{r.summary}</p>
      </Card>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Your plan</h3>
          {canApply && p.calories_kcal && report.id ? (
            <Button size="sm" disabled={pending} onClick={onApply}>{report.applied_at ? "✓ Using these targets (apply again)" : "Use these targets"}</Button>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Target label="Calories / day" value={p.calories_kcal} unit="kcal" />
          <Target label="Protein" value={p.protein_g} unit="g" />
          <Target label="Carbs" value={p.carbs_g} unit="g" />
          <Target label="Fat" value={p.fat_g} unit="g" />
          <Target label="Fibre" value={p.fiber_g} unit="g" />
          <Target label="Steps / day" value={p.steps_per_day} unit="" />
          <Target label="Sleep" value={p.sleep_hours} unit="h" />
          <Target label="Workouts / week" value={p.workouts_per_week} unit="" />
        </div>
        <p className="text-sm">
          {rate != null ? <strong>{rate === 0 ? "Expect to hold your weight." : `Expect about ${rate > 0 ? "+" : ""}${rate} kg a week. `}</strong> : null}
          {p.rationale}
        </p>
        <p className="text-xs text-fg-muted">Review again in about {p.review_in_days} days.{canApply ? " “Use these targets” copies calories and macros into Food → Goals." : ""}</p>
      </Card>

      {r.insights.length ? (
        <Card>
          <h3 className="mb-2 text-sm font-semibold">Insights</h3>
          <ul className="space-y-3">
            {r.insights.map((x, i) => (
              <li key={i} className="flex gap-2.5">
                <span aria-hidden className="text-lg leading-6">{AREA_ICON[x.area] ?? "✨"}</span>
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm">
                    <Badge tone={IMPACT[x.impact]?.tone ?? "neutral"}>{IMPACT[x.impact]?.label ?? x.impact}</Badge> {x.finding}
                  </p>
                  <p className="text-xs text-fg-muted">{x.evidence}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {r.this_week.length ? (
        <Card>
          <h3 className="mb-2 text-sm font-semibold">This week</h3>
          <ul className="space-y-2">
            {r.this_week.map((a, i) => (
              <li key={i}>
                <label className="flex items-start gap-2.5 text-sm">
                  <input type="checkbox" className="mt-0.5 size-4 accent-[var(--accent)]" checked={done.includes(i)} onChange={(e) => setDone(e.target.checked ? [...done, i] : done.filter((d) => d !== i))} />
                  <span className={cx(done.includes(i) && "text-fg-muted line-through")}>
                    <span aria-hidden>{AREA_ICON[a.area] ?? "✨"} </span>
                    <strong className="font-medium">{a.action}</strong>
                    <span className="block text-xs text-fg-muted">{a.why}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {r.sample_day.length ? (
        <Card>
          <h3 className="mb-2 text-sm font-semibold">A day that fits</h3>
          <ul className="space-y-1.5 text-sm">
            {r.sample_day.map((m, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span>
                  <span className="text-fg-muted">{MEAL_LABEL[m.meal] ?? m.meal}: </span>
                  {m.idea}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-fg-muted">{[m.kcal != null ? `${m.kcal} kcal` : null, m.protein_g != null ? `${m.protein_g} g P` : null].filter(Boolean).join(" · ")}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <List title="🏋️ Training" items={r.training} />
        <List title="😴 Recovery & sleep" items={r.recovery} />
      </div>
      {r.cautions.length ? (
        <Notice tone="danger">
          <p className="mb-1 font-medium">Check with your doctor</p>
          <ul className="list-disc space-y-1 pl-5">
            {r.cautions.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </Notice>
      ) : null}
      <List title="📝 To make the next review better" items={r.data_gaps} />

      <Card>
        <details>
          <summary className="cursor-pointer text-sm font-semibold">What the coach saw</summary>
          <ul className="mt-2 space-y-1 text-xs text-fg-muted">
            {factLines(report.facts).map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-fg-muted">Included: {report.included.join(", ") || "nothing"}. Medicines, supplements and medical history were sent as text when included.</p>
        </details>
        {report.id ? (
          <div className="mt-3">
            <Button size="sm" variant="ghost" disabled={pending} onClick={onDelete}>Delete this report</Button>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
