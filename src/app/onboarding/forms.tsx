"use client";

import { useActionState, useState } from "react";
import { Card, Field, Input, cx } from "@/components/ui";
import { ActionMessage, SubmitButton } from "@/components/form-status";
import { createHouseholdAction, joinHouseholdAction } from "./actions";

type ModuleOption = { key: string; name: string; icon: string; group: string; defaultOn: boolean };

export function OnboardingForms({ defaultName, defaultCode, modules }: { defaultName: string; defaultCode: string; modules: ModuleOption[] }) {
  const [tab, setTab] = useState<"create" | "join">(defaultCode ? "join" : "create");
  const [createState, createAction] = useActionState(createHouseholdAction, null);
  const [joinState, joinAction] = useActionState(joinHouseholdAction, null);

  return (
    <Card className="space-y-4">
      <div role="tablist" className="grid grid-cols-2 rounded-xl bg-surface-2 p-1 text-sm">
        {(["create", "join"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cx("h-9 rounded-lg font-medium", tab === t ? "bg-surface shadow-sm" : "text-fg-muted")}
          >
            {t === "create" ? "Create household" : "I have an invite"}
          </button>
        ))}
      </div>

      {tab === "create" ? (
        <form action={createAction} className="space-y-3">
          <Field label="Your name">
            <Input name="displayName" defaultValue={defaultName} required maxLength={60} />
          </Field>
          <Field label="Household name" hint="e.g. “Home” or “Gaurav & Karishma”">
            <Input name="householdName" required maxLength={80} placeholder="Home" />
          </Field>
          <input type="hidden" name="picker" value="1" />
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">What do you want to track? <span className="font-normal text-fg-muted">(change any time in Settings)</span></legend>
            {[...new Set(modules.map((m) => m.group))].map((g) => (
              <div key={g}>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">{g}</p>
                <div className="flex flex-wrap gap-1.5">
                  {modules.filter((m) => m.group === g).map((m) => (
                    <label key={m.key} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
                      <input type="checkbox" name="modules" value={m.key} defaultChecked={m.defaultOn} className="sr-only" />
                      <span aria-hidden>{m.icon}</span> {m.name}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </fieldset>
          <ActionMessage state={createState} />
          <SubmitButton className="w-full" pendingText="Creating…">Create household</SubmitButton>
        </form>
      ) : (
        <form action={joinAction} className="space-y-3">
          <Field label="Your name">
            <Input name="displayName" defaultValue={defaultName} required maxLength={60} />
          </Field>
          <Field label="Invite code" hint="Your partner can create one in Settings → Household.">
            <Input name="code" defaultValue={defaultCode} required maxLength={8} className="uppercase tracking-widest" />
          </Field>
          <ActionMessage state={joinState} />
          <SubmitButton className="w-full" pendingText="Joining…">Join household</SubmitButton>
        </form>
      )}
    </Card>
  );
}
