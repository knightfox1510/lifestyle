"use client";

import { useActionState, useState } from "react";
import { Input, cx } from "@/components/ui";
import { ActionMessage, SubmitButton } from "@/components/form-status";
import { addMedicalEvent } from "@/app/(app)/medical/actions";

const QUICK = [
  { category: "illness", label: "🤒 Illness", placeholder: "Cold, fever, stomach bug…" },
  { category: "symptom", label: "🌡️ Symptom", placeholder: "Headache, back pain…" },
  { category: "medication", label: "💊 Medicine", placeholder: "Crocin 650, 1 tablet" },
] as const;

export function QuickHealthLog({ ownerId }: { ownerId: string }) {
  const [kind, setKind] = useState<(typeof QUICK)[number]>(QUICK[0]);
  const [state, action] = useActionState(addMedicalEvent, null);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="ownerId" value={ownerId} />
      <input type="hidden" name="category" value={kind.category} />
      <input type="hidden" name="start_date" value={today} />
      <input type="hidden" name="include_in_ai" value="on" />
      {kind.category !== "medication" ? <input type="hidden" name="ongoing" value="on" /> : null}
      <div className="flex gap-1.5">
        {QUICK.map((q) => (
          <button
            type="button"
            key={q.category}
            onClick={() => setKind(q)}
            className={cx(
              "rounded-full px-2.5 py-1 text-xs",
              kind.category === q.category ? "bg-accent-soft font-medium text-accent" : "bg-surface-2 text-fg-muted",
            )}
          >
            {q.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Input name="title" required maxLength={200} placeholder={kind.placeholder} aria-label="What" />
        <SubmitButton pendingText="…">Log</SubmitButton>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}
