"use client";

import { useActionState } from "react";
import { Field, Input } from "@/components/ui";
import { ActionMessage, SubmitButton } from "@/components/form-status";
import { useT } from "@/lib/i18n/client";
import { saveSupplementTimes } from "../actions";

export function TimesForm({ rows }: { rows: { key: string; label: string; value: string; placeholder: string; effective: string | null }[] }) {
  const t = useT();
  const [state, action] = useActionState(saveSupplementTimes, null);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((r) => (
          <Field key={r.key} label={r.label} hint={r.placeholder ? t("Default {time}", { time: r.placeholder }) : t("No fixed time unless you set one")}>
            <Input type="time" name={r.key} defaultValue={r.value || r.effective || ""} />
          </Field>
        ))}
      </div>
      <p className="text-xs text-fg-muted">{t("Clear a time to go back to its default.")}</p>
      <div className="flex items-center gap-3">
        <SubmitButton>{t("Save times")}</SubmitButton>
        <ActionMessage state={state} />
      </div>
    </form>
  );
}
