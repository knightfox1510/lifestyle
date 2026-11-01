"use client";

import { useActionState } from "react";
import { Card, Field, Input, Select } from "@/components/ui";
import { ActionMessage, SubmitButton } from "@/components/form-status";
import { addPantryItem } from "./actions";

export function AddPantryForm() {
  const [state, action] = useActionState(addPantryItem, null);
  return (
    <Card>
      <form action={action} className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-end">
        <Field label="Add item">
          <Input name="name" required maxLength={120} placeholder="Paneer" />
        </Field>
        <Field label="Qty">
          <Input name="quantity" maxLength={40} placeholder="200 g" />
        </Field>
        <Field label="Where">
          <Select name="location" defaultValue="fridge">
            <option value="fridge">Fridge</option>
            <option value="freezer">Freezer</option>
            <option value="pantry">Cupboard</option>
          </Select>
        </Field>
        <Field label="Expires">
          <Input name="expires_on" type="date" />
        </Field>
        <SubmitButton>Add</SubmitButton>
        <div className="sm:col-span-5">
          <ActionMessage state={state} />
        </div>
      </form>
    </Card>
  );
}
