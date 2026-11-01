"use client";

import { useActionState } from "react";
import { Checkbox, Field, Input, Select } from "@/components/ui";
import { ActionMessage, SubmitButton } from "@/components/form-status";
import type { Profile } from "@/lib/types";
import { saveProfile } from "./actions";
import { LANGS, LANG_META } from "@/lib/i18n/core";
import { useT } from "@/lib/i18n/client";

const TIMEZONES = ["Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Asia/Tokyo", "Europe/London", "Europe/Berlin", "America/New_York", "America/Los_Angeles", "Australia/Sydney", "UTC"];

export function ProfileSettingsForm({ profile }: { profile: Profile }) {
  const [state, action] = useActionState(saveProfile, null);
  const t = useT();
  const zones = TIMEZONES.includes(profile.timezone) ? TIMEZONES : [profile.timezone, ...TIMEZONES];
  return (
    <form action={action} className="space-y-3">
      <Field label={t("App language")} hint={t("Menus, reminders and AI replies. Medicine names stay as written.")}>
        <Select name="language" defaultValue={profile.language ?? "en"}>
          {LANGS.map((l) => (
            <option key={l} value={l}>{LANG_META[l].native}{l === "en" ? "" : ` (${LANG_META[l].label})`}</option>
          ))}
        </Select>
      </Field>
      <Field label={t("Home view")} hint={t("How your day looks on Home. Each person can choose their own.")}>
        <Select name="home_view" defaultValue={profile.home_view ?? "arc"}>
          <option value="arc">{t("Day arc (your day as the sun's path)")}</option>
          <option value="bars">{t("Simple bars")}</option>
          <option value="tiles">{t("Tiles")}</option>
        </Select>
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t("Display name")}>
          <Input name="display_name" defaultValue={profile.display_name} required maxLength={60} />
        </Field>
        <Field label={t("Timezone")}>
          <Select name="timezone" defaultValue={profile.timezone}>
            {zones.map((z) => (
              <option key={z} value={z}>{z}</option>
            ))}
          </Select>
        </Field>
        <Field label={t("Units")}>
          <Select name="units" defaultValue={profile.units}>
            <option value="metric">Metric (kg, cm, ml)</option>
            <option value="imperial">Imperial (lb, in, oz)</option>
          </Select>
        </Field>
      </div>
      <Checkbox
        name="ai_use_medical_history"
        defaultChecked={profile.ai_use_medical_history}
        label={t("Use my health data in AI suggestions by default")}
        hint="Medical history, medicines, supplements, bladder diary, check-ins and habits. You can still override this on each question, and hide individual entries."
      />
      <ActionMessage state={state} />
      <SubmitButton>{t("Save")}</SubmitButton>
    </form>
  );
}
