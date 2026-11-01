"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/form-status";
import { useT } from "@/lib/i18n/client";
import type { ActionResult } from "@/lib/types";
import { DIARY_EVENT_META, DIARY_EVENT_TYPES, type DiaryEventType } from "@/modules/bladder/events";
import { addDiaryEvent } from "./actions";

/** "＋ Add event": surgery, stent removal, a medicine started… */
export function AddDiaryEvent({ ownerId, today }: { ownerId: string; today: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<DiaryEventType>("surgery");
  const [state, action] = useActionState(async (p: ActionResult | null, f: FormData) => {
    const r = await addDiaryEvent(p, f);
    if (r.ok) setOpen(false);
    return r;
  }, null);
  const meta = DIARY_EVENT_META[type];

  if (!open) {
    return (
      <div className="space-y-1">
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          <CalendarPlus className="size-4" aria-hidden /> {t("Add event")}
        </Button>
        {state?.ok ? (
          <p role="status" className="text-sm text-accent">
            {t(state.message ?? "Event added.")}{" "}
            {type === "medicine_started" ? (
              <Link href="/medicines/manage" className="underline">
                {t("Open Medicines")}
              </Link>
            ) : null}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <Card>
      <form action={action} className="space-y-3">
        <h2 className="font-semibold">{t("Add event")}</h2>
        <p className="text-sm text-fg-muted">{t("Surgery, stent removal, a new medicine… They show on the charts so you can see what changed.")}</p>
        <input type="hidden" name="ownerId" value={ownerId} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("What happened")}>
            <Select name="type" value={type} onChange={(e) => setType(e.target.value as DiaryEventType)}>
              {DIARY_EVENT_TYPES.map((k) => (
                <option key={k} value={k}>
                  {t(DIARY_EVENT_META[k].label)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("Date")}>
            <Input type="date" name="date" max={today} defaultValue={today} required />
          </Field>
        </div>
        <Field label={meta.needsTitle ? t("Name") : t("Name (optional)")}>
          <Input name="title" required={meta.needsTitle} maxLength={200} placeholder={meta.placeholder ? t(meta.placeholder) : undefined} />
        </Field>
        <Field label={t("Notes (optional)")}>
          <Textarea name="details" rows={2} maxLength={2000} placeholder={t("e.g. doctor, hospital, dose")} />
        </Field>
        {state?.error ? (
          <p role="alert" className="text-sm text-danger">
            {t(state.error)}
          </p>
        ) : null}
        <div className="flex gap-2">
          <SubmitButton pendingText={t("Saving…")}>{t("Save event")}</SubmitButton>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            {t("Cancel")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
