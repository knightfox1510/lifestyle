"use client";

import { useActionState } from "react";
import { Field, Input } from "@/components/ui";
import { ActionMessage, SubmitButton } from "@/components/form-status";
import { deleteAccount } from "./actions";

export function DeleteAccountForm() {
  const [state, action] = useActionState(deleteAccount, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <Field label='Type "DELETE" to confirm' className="w-48">
        <Input name="confirm" autoComplete="off" required />
      </Field>
      <SubmitButton variant="danger" pendingText="Deleting…">Delete account</SubmitButton>
      <div className="basis-full"><ActionMessage state={state} /></div>
    </form>
  );
}
