"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getUser } from "@/lib/session";
import { MODULES } from "@/modules/registry";
import type { ActionResult } from "@/lib/types";

const createSchema = z.object({
  displayName: z.string().trim().min(1, "Tell us your name").max(60),
  householdName: z.string().trim().min(1, "Name your household").max(80),
});

export async function createHouseholdAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = createSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { supabase, userId } = await getUser();

  await supabase.from("profiles").update({ display_name: parsed.data.displayName }).eq("id", userId);
  const { data: hid, error } = await supabase.rpc("create_household", { household_name: parsed.data.householdName });
  if (error || !hid) return { error: "Couldn't create the household. Please try again." };

  // Apply the features picked during setup (defaults are on if the picker wasn't shown).
  const picked = new Set(form.getAll("modules").map(String));
  if (form.get("picker") === "1") {
    await supabase.from("household_modules").upsert(
      MODULES.filter((m) => m.status === "available").map((m) => ({ household_id: hid, module_key: m.key, enabled: picked.has(m.key) })),
      { onConflict: "household_id,module_key" },
    );
  }
  redirect("/");
}

const joinSchema = z.object({
  displayName: z.string().trim().min(1, "Tell us your name").max(60),
  code: z.string().trim().regex(/^[A-Za-z0-9]{8}$/, "Invite codes are 8 letters/numbers"),
});

export async function joinHouseholdAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = joinSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { supabase, userId } = await getUser();

  await supabase.from("profiles").update({ display_name: parsed.data.displayName }).eq("id", userId);
  const { error } = await supabase.rpc("accept_invite", { invite_code: parsed.data.code });
  if (error) {
    const msg = error.message.includes("expired")
      ? "That invite has expired. Ask for a new one."
      : error.message.includes("used")
        ? "That invite was already used."
        : "Invite code not found.";
    return { error: msg };
  }
  redirect("/");
}
