"use client";

import { useActionState } from "react";
import { Badge, Field, Input } from "@/components/ui";
import { ActionMessage, SubmitButton } from "@/components/form-status";
import { removeGeminiKey, renameHousehold, saveAiLimit, saveGeminiKey } from "../actions";

export function RenameHousehold({ name }: { name: string }) {
  const [state, action] = useActionState(renameHousehold, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <Field label="Household name" className="min-w-48 flex-1">
        <Input name="name" defaultValue={name} required maxLength={80} />
      </Field>
      <SubmitButton variant="secondary">Rename</SubmitButton>
      <div className="basis-full">
        <ActionMessage state={state} />
      </div>
    </form>
  );
}

export function AiSettings({
  isOwner,
  hasCustomKey,
  limit,
  usedToday,
}: {
  isOwner: boolean;
  hasCustomKey: boolean;
  limit: number;
  usedToday: number;
}) {
  const [limitState, limitAction] = useActionState(saveAiLimit, null);
  const [keyState, keyAction] = useActionState(saveGeminiKey, null);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold">AI (Gemini)</h2>
        <p className="text-sm text-fg-muted">
          {hasCustomKey ? "Using your household's own Gemini key." : "Using the app's shared Gemini key."} {usedToday} of {limit} requests
          used today.
        </p>
      </div>
      {isOwner ? (
        <>
          <form action={limitAction} className="flex flex-wrap items-end gap-2">
            <Field label="Daily request limit" className="w-40">
              <Input type="number" name="ai_daily_limit" min={0} max={1000} defaultValue={limit} />
            </Field>
            <SubmitButton variant="secondary">Save limit</SubmitButton>
            <div className="basis-full">
              <ActionMessage state={limitState} />
            </div>
          </form>
          <form action={keyAction} className="space-y-2">
            <Field
              label={hasCustomKey ? "Replace household Gemini key" : "Use your own Gemini key (optional)"}
              hint="Stored encrypted on the server and never sent to browsers. Get one at aistudio.google.com."
            >
              <Input name="gemini_key" type="password" autoComplete="off" placeholder="AIza…" />
            </Field>
            <ActionMessage state={keyState} />
            <div className="flex flex-wrap items-center gap-2">
              <SubmitButton variant="secondary">Save key</SubmitButton>
              {hasCustomKey ? (
                <>
                  <Badge tone="accent">custom key active</Badge>
                  <button formAction={removeGeminiKey} className="text-sm text-danger hover:underline">
                    Remove key
                  </button>
                </>
              ) : null}
            </div>
          </form>
        </>
      ) : (
        <p className="text-xs text-fg-muted">Only the household owner can change AI settings.</p>
      )}
    </div>
  );
}
