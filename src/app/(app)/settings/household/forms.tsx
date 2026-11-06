"use client";

import { useActionState } from "react";
import { Select, Badge, Field, Input } from "@/components/ui";
import { ActionMessage, SubmitButton } from "@/components/form-status";
import { removeGeminiKey, renameHousehold, saveAiLimit, saveAiModel, saveGeminiKey, testAi } from "../actions";

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
  model,
}: {
  isOwner: boolean;
  hasCustomKey: boolean;
  limit: number;
  usedToday: number;
  model: "standard" | "best";
}) {
  const [limitState, limitAction] = useActionState(saveAiLimit, null);
  const [modelState, modelAction] = useActionState(saveAiModel, null);
  const [testState, testAction] = useActionState(async () => testAi(), null);
  const [keyState, keyAction] = useActionState(saveGeminiKey, null);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold">AI (Gemini)</h2>
        <p className="text-sm text-fg-muted">
          {hasCustomKey ? "Using your household's own Gemini key." : "Using the app's shared Gemini key."} {usedToday} of {limit} requests
          used today. <a href="/settings/ai-usage" className="text-accent underline">See which features use the most</a>
        </p>
      </div>
      <form action={testAction} className="flex flex-wrap items-center gap-2">
        <SubmitButton variant="secondary" pendingText="Testing…">Test AI</SubmitButton>
        <ActionMessage state={testState} />
      </form>
      {isOwner ? (
        <>
          <form action={modelAction} className="flex flex-wrap items-end gap-2">
            <Field label="AI model" className="min-w-60 flex-1" hint="If the chosen model is busy, Hearth retries and then falls back to a lighter one automatically.">
              <Select name="ai_model" defaultValue={model}>
                <option value="standard">Standard (Flash): faster, more free requests</option>
                <option value="best">Best (Pro) for health reasoning only (coach, visit summary, medicine checks): about 4× the cost; everything else stays on Flash</option>
              </Select>
            </Field>
            <SubmitButton variant="secondary">Save model</SubmitButton>
            <div className="basis-full">
              <ActionMessage state={modelState} />
            </div>
          </form>
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
              hint="Paste the key from aistudio.google.com/apikey (it starts with AQ. or AIza). We check it with Google, then store it encrypted on the server; it is never sent to browsers."
            >
              <Input name="gemini_key" type="password" autoComplete="off" placeholder="AQ.… or AIza…" />
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
