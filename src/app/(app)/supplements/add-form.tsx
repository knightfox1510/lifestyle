"use client";

import { useActionState } from "react";
import { Card, Field, Input, Select } from "@/components/ui";
import { ActionMessage, SubmitButton } from "@/components/form-status";
import { SUPPLEMENT_TIMINGS } from "@/lib/types";
import { TIMING_LABEL } from "@/modules/supplements/meta";
import { addSupplement } from "./actions";

export function AddSupplementForm({ ownerId }: { ownerId: string }) {
  const [state, action] = useActionState(addSupplement, null);
  return (
    <Card>
      <form action={action} className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-end">
        <input type="hidden" name="ownerId" value={ownerId} />
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
        <SubmitButton>Add</SubmitButton>
        <div className="sm:col-span-5">
          <ActionMessage state={state} />
        </div>
      </form>
    </Card>
  );
}
