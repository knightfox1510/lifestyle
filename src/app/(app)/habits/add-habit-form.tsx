"use client";

import { useActionState } from "react";
import { Card, Field, Input, Select } from "@/components/ui";
import { ActionMessage, SubmitButton } from "@/components/form-status";
import { addHabit } from "./actions";

const ICONS = ["✅", "🚶", "💧", "🧘", "🏋️", "📖", "🥗", "😴", "🚭", "☕", "🧴", "📵"];

export function AddHabitForm({ ownerId }: { ownerId: string }) {
  const [state, action] = useActionState(addHabit, null);
  return (
    <Card>
      <form action={action} className="grid gap-3 sm:grid-cols-[5rem_1fr_9rem_auto] sm:items-end">
        <input type="hidden" name="ownerId" value={ownerId} />
        <Field label="Icon">
          <Select name="icon" defaultValue="✅">
            {ICONS.map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </Select>
        </Field>
        <Field label="New habit">
          <Input name="name" required maxLength={80} placeholder="10-minute walk" />
        </Field>
        <Field label="Target">
          <Select name="target_per_week" defaultValue="7">
            {[7, 6, 5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>{n === 7 ? "Every day" : `${n}× a week`}</option>
            ))}
          </Select>
        </Field>
        <SubmitButton>Add</SubmitButton>
        <div className="sm:col-span-4">
          <ActionMessage state={state} />
        </div>
      </form>
    </Card>
  );
}
