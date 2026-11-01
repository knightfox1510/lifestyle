"use client";

import { useActionState } from "react";
import { Checkbox, Field, Input, Select } from "@/components/ui";
import { ActionMessage, SubmitButton } from "@/components/form-status";
import type { Profile } from "@/lib/types";
import { saveProfile } from "./actions";

const TIMEZONES = ["Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Asia/Tokyo", "Europe/London", "Europe/Berlin", "America/New_York", "America/Los_Angeles", "Australia/Sydney", "UTC"];

export function ProfileSettingsForm({ profile }: { profile: Profile }) {
  const [state, action] = useActionState(saveProfile, null);
  const zones = TIMEZONES.includes(profile.timezone) ? TIMEZONES : [profile.timezone, ...TIMEZONES];
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Display name">
          <Input name="display_name" defaultValue={profile.display_name} required maxLength={60} />
        </Field>
        <Field label="Timezone">
          <Select name="timezone" defaultValue={profile.timezone}>
            {zones.map((z) => (
              <option key={z} value={z}>{z}</option>
            ))}
          </Select>
        </Field>
        <Field label="Units">
          <Select name="units" defaultValue={profile.units}>
            <option value="metric">Metric (kg, cm, ml)</option>
            <option value="imperial">Imperial (lb, in, oz)</option>
          </Select>
        </Field>
      </div>
      <Checkbox
        name="ai_use_medical_history"
        defaultChecked={profile.ai_use_medical_history}
        label="Use my health data in AI suggestions by default"
        hint="Medical history, medicines, supplements, bladder diary, check-ins and habits. You can still override this on each question, and hide individual entries."
      />
      <ActionMessage state={state} />
      <SubmitButton>Save</SubmitButton>
    </form>
  );
}
