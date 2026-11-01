"use client";

import { useActionState } from "react";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { ActionMessage, SubmitButton } from "@/components/form-status";
import type { MedicalProfile } from "@/lib/types";
import { saveMedicalProfile } from "../actions";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export function ProfileForm({ ownerId, profile, readOnly }: { ownerId: string; profile: MedicalProfile | null; readOnly: boolean }) {
  const [state, action] = useActionState(saveMedicalProfile, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="ownerId" value={ownerId} />
      <fieldset disabled={readOnly} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Date of birth">
            <Input type="date" name="date_of_birth" defaultValue={profile?.date_of_birth ?? ""} />
          </Field>
          <Field label="Sex">
            <Select name="sex" defaultValue={profile?.sex ?? ""}>
              <option value="">Prefer not to say</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </Select>
          </Field>
          <Field label="Blood group">
            <Select name="blood_group" defaultValue={profile?.blood_group ?? ""}>
              <option value="">Unknown</option>
              {BLOOD_GROUPS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </Select>
          </Field>
          <Field label="Height (cm)">
            <Input type="number" name="height_cm" min={30} max={260} step="0.1" defaultValue={profile?.height_cm ?? ""} />
          </Field>
        </div>
        <Field
          label="Anything else AI should know"
          hint="Dietary restrictions, family history, doctor's standing advice (e.g. “avoid heavy lifting until March”)."
        >
          <Textarea name="notes" maxLength={4000} defaultValue={profile?.notes ?? ""} />
        </Field>
        <Checkbox
          name="include_in_ai"
          defaultChecked={profile?.include_in_ai ?? true}
          label="Use this profile in AI suggestions"
          hint="Allergies, conditions and medicines are added on the Timeline tab."
        />
      </fieldset>
      <ActionMessage state={state} />
      {readOnly ? null : <SubmitButton>Save profile</SubmitButton>}
    </form>
  );
}
