"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSecret } from "@/lib/crypto";
import { generate } from "@/lib/ai/gemini";
import { MODULE_BY_KEY } from "@/modules/registry";
import { cookies } from "next/headers";
import { LANGS, LANG_COOKIE } from "@/lib/i18n/core";
import type { ActionResult } from "@/lib/types";

function refreshAll() {
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------- profile ----

const profileSchema = z.object({
  display_name: z.string().trim().min(1, "Name is required").max(60),
  timezone: z.string().refine((tz) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Unknown timezone"),
  units: z.enum(["metric", "imperial"]),
  language: z.enum(LANGS),
  home_view: z.enum(["arc", "bars", "tiles"]),
  ai_use_medical_history: z.boolean(),
});

export async function saveProfile(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const raw = Object.fromEntries(form);
  const parsed = profileSchema.safeParse({ ...raw, ai_use_medical_history: raw.ai_use_medical_history === "on" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const session = await getSession();
  const { error } = await session.supabase.from("profiles").update(parsed.data).eq("id", session.userId);
  if (error) return { error: "Couldn't save." };
  // Remembered on this device too, so sign-in pages use the same language.
  (await cookies()).set(LANG_COOKIE, parsed.data.language, { path: "/", maxAge: 60 * 60 * 24 * 400, sameSite: "lax" });
  refreshAll();
  return { ok: true, message: "Saved." };
}

// -------------------------------------------------------------- household ----

export async function renameHousehold(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const name = z.string().trim().min(1).max(80).safeParse(form.get("name"));
  if (!name.success) return { error: "Enter a name (max 80 characters)." };
  const session = await getSession();
  if (session.me.role !== "owner") return { error: "Only the household owner can rename it." };
  await session.supabase.from("households").update({ name: name.data }).eq("id", session.household.id);
  refreshAll();
  return { ok: true, message: "Renamed." };
}

export async function createInvite(): Promise<ActionResult & { code?: string }> {
  const session = await getSession();
  const { data, error } = await session.supabase.rpc("create_invite", { hid: session.household.id });
  if (error) return { error: "Couldn't create an invite." };
  revalidatePath("/settings/household");
  return { ok: true, code: data as string };
}

export async function revokeInvite(inviteId: string) {
  const session = await getSession();
  await session.supabase.from("invites").delete().eq("id", inviteId).eq("household_id", session.household.id);
  revalidatePath("/settings/household");
}

export async function removeMember(userId: string) {
  const session = await getSession();
  if (session.me.role !== "owner" || userId === session.userId) return;
  // Revoke shares in both directions before removing.
  await session.supabase.from("module_shares").delete().eq("owner_id", session.userId).eq("grantee_id", userId);
  await session.supabase.from("household_members").delete().eq("household_id", session.household.id).eq("user_id", userId);
  refreshAll();
}

export async function leaveHousehold() {
  const session = await getSession();
  await session.supabase.rpc("leave_household", { hid: session.household.id });
  refreshAll();
  redirect("/onboarding");
}

export async function setModuleEnabled(moduleKey: string, enabled: boolean) {
  const def = MODULE_BY_KEY[moduleKey];
  if (!def || def.status !== "available") return;
  const session = await getSession();
  await session.supabase
    .from("household_modules")
    .upsert({ household_id: session.household.id, module_key: moduleKey, enabled }, { onConflict: "household_id,module_key" });
  refreshAll();
}

// --------------------------------------------------------------------- AI ----

export async function saveAiModel(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const model = z.enum(["standard", "best"]).safeParse(form.get("ai_model"));
  if (!model.success) return { error: "Pick a model." };
  const session = await getSession();
  if (session.me.role !== "owner") return { error: "Only the household owner can change this." };
  const { error } = await session.supabase.from("households").update({ ai_model: model.data }).eq("id", session.household.id);
  if (error) return { error: "Couldn't save. If you set up Hearth before November 2026, run update-existing-database.sql in Supabase first." };
  refreshAll();
  return { ok: true, message: "Saved." };
}

/** Sends one tiny request through the same path as every AI feature and reports what happened. */
export async function testAi(): Promise<ActionResult> {
  const session = await getSession();
  const started = Date.now();
  try {
    const res = await generate(session, { contents: "Reply with the single word OK.", config: { temperature: 0, maxOutputTokens: 16 } });
    return { ok: true, message: `Working: ${res.modelUsed} answered in ${((Date.now() - started) / 1000).toFixed(1)} s.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "The AI test failed." };
  }
}

export async function saveAiLimit(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const limit = z.coerce.number().int().min(0).max(1000).safeParse(form.get("ai_daily_limit"));
  if (!limit.success) return { error: "Enter a number between 0 and 1000." };
  const session = await getSession();
  if (session.me.role !== "owner") return { error: "Only the household owner can change this." };
  await session.supabase.from("households").update({ ai_daily_limit: limit.data }).eq("id", session.household.id);
  refreshAll();
  return { ok: true, message: "Saved." };
}

/** Stores the household's own Gemini key, encrypted. Owner only. */
export async function saveGeminiKey(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const key = z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_\-]{20,200}$/, "That doesn't look like a Gemini API key.")
    .safeParse(form.get("gemini_key"));
  if (!key.success) return { error: key.error.issues[0].message };
  const session = await getSession();
  if (session.me.role !== "owner") return { error: "Only the household owner can change the AI key." };

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("household_secrets").upsert({
      household_id: session.household.id,
      gemini_key_ciphertext: encryptSecret(key.data),
      gemini_key_last4: key.data.slice(-4),
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    await admin.from("households").update({ has_custom_ai_key: true }).eq("id", session.household.id);
  } catch (e) {
    console.error("save gemini key failed", e);
    return { error: "Couldn't store the key. Check the server's encryption settings." };
  }
  refreshAll();
  return { ok: true, message: "Key saved. Your household now uses its own Gemini key." };
}

export async function removeGeminiKey() {
  const session = await getSession();
  if (session.me.role !== "owner") return;
  const admin = createAdminClient();
  await admin.from("household_secrets").delete().eq("household_id", session.household.id);
  await admin.from("households").update({ has_custom_ai_key: false }).eq("id", session.household.id);
  refreshAll();
}

// ---------------------------------------------------------------- sharing ----

export async function setShare(granteeId: string, moduleKey: string, level: "none" | "read" | "write") {
  const def = MODULE_BY_KEY[moduleKey];
  if (!def || def.scope === "household") return;
  const session = await getSession();
  if (!session.members.some((m) => m.user_id === granteeId) || granteeId === session.userId) return;

  if (level === "none") {
    await session.supabase
      .from("module_shares")
      .delete()
      .eq("owner_id", session.userId)
      .eq("grantee_id", granteeId)
      .eq("module_key", moduleKey);
  } else {
    await session.supabase
      .from("module_shares")
      .upsert(
        { owner_id: session.userId, grantee_id: granteeId, module_key: moduleKey, level },
        { onConflict: "owner_id,grantee_id,module_key" },
      );
  }
  refreshAll();
}

export async function switchHousehold(hid: string) {
  const session = await getSession();
  const { error } = await session.supabase.rpc("switch_household", { hid });
  if (!error) {
    refreshAll();
    redirect("/");
  }
}
