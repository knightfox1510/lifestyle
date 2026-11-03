"use client";

import { useActionState, useState } from "react";
import { Card, Field, Input, Select } from "@/components/ui";
import { ActionMessage, SubmitButton } from "@/components/form-status";
import { SUPPLEMENT_TIMINGS } from "@/lib/types";
import { TIMING_LABEL } from "@/modules/supplements/meta";
import { FrequencyPicker, repeatColumns, type FrequencyValue } from "@/components/frequency-picker";
import { addSupplement } from "./actions";

const DAILY: FrequencyValue = { frequency: "daily", days: [0, 1, 2, 3, 4, 5, 6], every: 14 };

export function AddSupplementForm({ ownerId, today }: { ownerId: string; today: string }) {
  const [freq, setFreq] = useState<FrequencyValue>(DAILY);
  const [start, setStart] = useState(today);
  const [state, action] = useActionState(async (prev: Awaited<ReturnType<typeof addSupplement>> | null, form: FormData) => {
    const r = await addSupplement(prev, form);
    if (r.ok) setFreq(DAILY);
    return r;
  }, null);
  const cols = repeatColumns(freq);
  return (
    <Card>
      <form action={action} className="space-y-3">
        <input type="hidden" name="ownerId" value={ownerId} />
        <input type="hidden" name="repeat_every_days" value={cols.repeat_every_days ?? ""} />
        {(cols.days_of_week ?? []).map((d) => (
          <input key={d} type="hidden" name="days_of_week" value={d} />
        ))}
        {freq.frequency !== "daily" ? <input type="hidden" name="schedule_start" value={start} /> : null}
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr]">
          <Field label="Add supplement">
            <Input name="name" required maxLength={120} placeholder="Magnesium Glycinate" />
          </Field>
          <Field label="Dose">
            <Input name="dose" maxLength={60} placeholder="400 mg" />
          </Field>
          <Field label="When">
            <Select name="timing" defaultValue="morning">
              {SUPPLEMENT_TIMINGS.map((t) => (
                <option key={t} value={t}>{TIMING_LABEL[t]}</option>
              ))}
            </Select>
          </Field>
          <Field label="Stock">
            <Input name="stock_count" type="number" min={0} placeholder="optional" />
          </Field>
        </div>
        <div className="space-y-2">
          <span className="text-sm font-medium">How often</span>
          <FrequencyPicker value={freq} onChange={setFreq} startLabel="the first day below" />
          {freq.frequency === "every_n" ? (
            <Field label="First day" className="w-44">
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
          ) : null}
          <p className="text-xs text-fg-muted">Weekly products like D3 60K are set to once a week automatically.</p>
        </div>
        <div className="flex items-center gap-3">
          <SubmitButton>Add</SubmitButton>
          <ActionMessage state={state} />
        </div>
      </form>
    </Card>
  );
}
