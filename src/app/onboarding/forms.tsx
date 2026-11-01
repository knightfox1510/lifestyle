"use client";

import { useActionState, useState } from "react";
import { Card, Field, Input, cx } from "@/components/ui";
import { ActionMessage, SubmitButton } from "@/components/form-status";
import { createHouseholdAction, joinHouseholdAction } from "./actions";

export function OnboardingForms({ defaultName, defaultCode }: { defaultName: string; defaultCode: string }) {
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
