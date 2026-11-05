"use client";

import { useState, useTransition } from "react";
import { PenLine } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { useToast } from "@/components/toaster";
import { useT } from "@/lib/i18n/client";
import { reopenDay, setDayNote } from "@/app/(app)/close/actions";

/** The day's one-line note: shown, and editable by its owner. */
export function DayNote({ date, note, canEdit }: { date: string; note: string | null; canEdit: boolean }) {
  const t = useT();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note ?? "");
  const [pending, start] = useTransition();
  if (editing) {
    return (
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await setDayNote(date, text);
            toast(r.error ?? r.message ?? "Saved.", r.error ? { tone: "error" } : { kind: "save", stamp: false });
            if (!r.error) setEditing(false);
          });
        }}
      >
        <Input value={text} onChange={(e) => setText(e.target.value)} maxLength={280} autoFocus placeholder={t("e.g. travelled, felt unwell, family dinner")} className="!h-9" aria-label={t("Note for the day")} />
        <Button size="sm" type="submit" pending={pending}>{t("Save")}</Button>
      </form>
    );
  }
  if (!note && !canEdit) return null;
  return (
    <button type="button" disabled={!canEdit} onClick={() => setEditing(true)} className="flex w-full items-center gap-2 rounded-xl px-1 py-1 text-left text-[14px] hover:bg-surface-2/60 disabled:hover:bg-transparent">
      <PenLine className="size-4 shrink-0 text-fg-muted" aria-hidden />
      {note ? <span className="min-w-0 flex-1">“{note}”</span> : <span className="text-fg-muted">{t("Add a note for the day")}</span>}
    </button>
  );
}

export function ReopenDayButton({ date }: { date: string }) {
  const t = useT();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="text-[13px] text-fg-muted underline-offset-2 hover:text-fg hover:underline"
      onClick={() =>
        start(async () => {
          const r = await reopenDay(date);
          toast(r.error ?? r.message ?? "Reopened.", r.error ? { tone: "error" } : { kind: "undo" });
        })
      }
    >
      {t("Reopen")}
    </button>
  );
}
