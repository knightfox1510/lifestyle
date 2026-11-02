"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button, Card, Checkbox, Field, Input, Select, Textarea, cx } from "@/components/ui";
import { ActionMessage, SubmitButton } from "@/components/form-status";
import { MEDICINE_FORMS, type Medicine } from "@/lib/types";
import { DAY_LETTERS } from "@/modules/medicines/logic";
import { saveMedicine } from "../actions";
import { MedicineLookupButtons, MedicineNutrientFields } from "./medicine-lookup";

const PRESETS: Record<string, string[]> = {
  "Once a day": ["08:00"],
  "Twice a day": ["08:00", "20:00"],
  "Three times": ["08:00", "14:00", "20:00"],
  "At bedtime": ["22:00"],
  "As needed": [],
};

export function MedicineForm({
  ownerId,
  medicine,
  today,
  timelineAvailable,
}: {
  ownerId: string;
  medicine?: Medicine;
  today: string;
  timelineAvailable: boolean;
}) {
  const [open, setOpen] = useState(Boolean(medicine));
  const [times, setTimes] = useState<string[]>(medicine?.times ?? ["08:00"]);
  const [days, setDays] = useState<number[]>(medicine?.days_of_week ?? [0, 1, 2, 3, 4, 5, 6]);
  const [name, setName] = useState(medicine?.name ?? "");
  const [strength, setStrength] = useState(medicine?.strength ?? "");
  const [form, setForm] = useState<string>(medicine?.form ?? "tablet");
  const [unit, setUnit] = useState(medicine?.dose_unit ?? "tablet");
  const [ingredients, setIngredients] = useState(medicine?.ingredients ?? "");
  const [nutrients, setNutrients] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(medicine?.nutrients ?? {}).map(([k, v]) => [k, String(v)])));
  const nutrientJson = JSON.stringify(Object.fromEntries(Object.entries(nutrients).map(([k, v]) => [k, Number(v)]).filter(([, v]) => Number.isFinite(v as number) && (v as number) > 0)));
  const [state, action] = useActionState(async (prev: Awaited<ReturnType<typeof saveMedicine>> | null, form: FormData) => {
    const res = await saveMedicine(prev, form);
    if (res.ok && !medicine) {
      setTimes(["08:00"]);
      setDays([0, 1, 2, 3, 4, 5, 6]);
      setName("");
      setStrength("");
      setForm("tablet");
      setUnit("tablet");
      setIngredients("");
      setNutrients({});
    }
    return res;
  }, null);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full rounded-2xl border border-dashed border-border px-4 py-3 text-left text-sm text-fg-muted hover:bg-surface">
        + Add a medicine or course
      </button>
    );
  }

  return (
    <Card>
      <form action={action} className="space-y-3">
        <input type="hidden" name="ownerId" value={ownerId} />
        <input type="hidden" name="id" value={medicine?.id ?? ""} />
        {times.map((t, i) => (
          <input key={i} type="hidden" name="times" value={t} />
        ))}
        {days.map((d) => (
          <input key={d} type="hidden" name="days_of_week" value={d} />
        ))}
        <input type="hidden" name="nutrients" value={nutrientJson} />
        <h2 className="font-semibold">{medicine ? `Edit ${medicine.name}` : "New medicine"}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Name" className="sm:col-span-2">
            <Input name="name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Solifenacin" />
          </Field>
          <Field label="Strength">
            <Input name="strength" maxLength={60} value={strength} onChange={(e) => setStrength(e.target.value)} placeholder="5 mg" />
          </Field>
          <MedicineLookupButtons
            name={name}
            strength={strength}
            onResult={(info) => {
              if (info.name && !name.trim()) setName(info.name);
              if (info.strength && !strength.trim()) setStrength(info.strength);
              if (info.form) setForm(info.form);
              if (info.unit) setUnit(info.unit);
              if (info.ingredients) setIngredients(info.ingredients);
              setNutrients(Object.fromEntries(Object.entries(info.per_unit).filter(([, v]) => v != null && v > 0).map(([k, v]) => [k, String(v)])));
            }}
          />
          <Field label="Contains (composition)" className="sm:col-span-3">
            <Input name="ingredients" maxLength={400} value={ingredients} onChange={(e) => setIngredients(e.target.value)} placeholder="e.g. Calcium carbonate 1250 mg + Vitamin D3 250 IU" />
          </Field>
          <Field label="Form">
            <Select name="form" value={form} onChange={(e) => setForm(e.target.value)}>
              {MEDICINE_FORMS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </Select>
          </Field>
          <Field label="Dose">
            <Input name="dose_amount" type="number" min={0.25} step={0.25} required defaultValue={medicine?.dose_amount ?? 1} />
          </Field>
          <Field label="Unit">
            <Input name="dose_unit" required maxLength={20} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="tablet / ml / puff" />
          </Field>
        </div>

        <MedicineNutrientFields values={nutrients} unit={unit} onChange={setNutrients} />

        <div className="space-y-2">
          <span className="text-sm font-medium">When</span>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(PRESETS).map(([label, preset]) => (
              <button
                key={label}
                type="button"
                onClick={() => setTimes(preset)}
                className={cx(
                  "rounded-full px-3 py-1 text-xs",
                  JSON.stringify(preset) === JSON.stringify(times) ? "bg-accent-soft font-medium text-accent" : "bg-surface-2 text-fg-muted",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {times.map((t, i) => (
              <span key={i} className="flex items-center gap-1">
                <Input
                  type="time"
                  value={t}
                  aria-label={`Dose time ${i + 1}`}
                  className="w-32"
                  onChange={(e) => setTimes(times.map((x, j) => (j === i ? e.target.value : x)))}
                />
                <button type="button" aria-label="Remove time" className="px-1 text-fg-muted hover:text-danger" onClick={() => setTimes(times.filter((_, j) => j !== i))}>
                  ×
                </button>
              </span>
            ))}
            {times.length < 8 ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => setTimes([...times, "12:00"])}>
                + time
              </Button>
            ) : null}
            {times.length === 0 ? <span className="text-xs text-fg-muted">Taken as needed (no schedule)</span> : null}
          </div>
          {times.length ? (
            <div className="flex gap-1" role="group" aria-label="Days">
              {DAY_LETTERS.map((l, d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={days.includes(d)}
                  onClick={() => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])}
                  className={cx("size-8 rounded-full text-xs", days.includes(d) ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg-muted")}
                >
                  {l}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Start">
            <Input type="date" name="start_date" required defaultValue={medicine?.start_date ?? today} />
          </Field>
          <Field label="End (leave empty if ongoing)">
            <Input type="date" name="end_date" defaultValue={medicine?.end_date ?? ""} />
          </Field>
          <Field label="Pills / units in stock" hint="Goes down automatically when you mark a dose taken.">
            <Input type="number" name="stock_count" min={0} step="any" defaultValue={medicine?.stock_count ?? ""} />
          </Field>
          <Field label="Warn me at">
            <Input type="number" name="refill_threshold" min={0} step="any" defaultValue={medicine?.refill_threshold ?? ""} placeholder="e.g. 7" />
          </Field>
          <Field label="Taken for">
            <Input name="reason" maxLength={200} defaultValue={medicine?.reason ?? ""} placeholder="e.g. overactive bladder" />
          </Field>
          <Field label="Prescribed by">
            <Input name="prescribed_by" maxLength={120} defaultValue={medicine?.prescribed_by ?? ""} />
          </Field>
        </div>
        <Field label="Instructions">
          <Textarea name="instructions" maxLength={300} defaultValue={medicine?.instructions ?? ""} placeholder="After food, with water…" className="min-h-14" />
        </Field>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Checkbox name="include_in_ai" defaultChecked={medicine?.include_in_ai ?? true} label="Use in AI suggestions" />
          {!medicine && timelineAvailable ? <Checkbox name="add_to_timeline" defaultChecked label="Also add to medical timeline" /> : null}
        </div>
        <ActionMessage state={state} />
        <div className="flex gap-2">
          <SubmitButton>{medicine ? "Save" : "Add medicine"}</SubmitButton>
          {medicine ? (
            <Link href="/medicines/manage" className="rounded-xl px-4 py-2 text-sm text-fg-muted hover:bg-surface-2">Cancel</Link>
          ) : (
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Close</Button>
          )}
        </div>
      </form>
    </Card>
  );
}
