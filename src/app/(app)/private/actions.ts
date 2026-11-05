"use server";

import { z } from "zod";
import { refreshModule } from "@/lib/guards";
import { getSession } from "@/lib/session";
import type { ActionResult } from "@/lib/types";
import { PRIVATE_KINDS } from "@/modules/private-log/meta";

const blank = (v: unknown) => (v === "" || v == null ? null : v);
const entrySchema = z.object({
  kind: z.enum(PRIVATE_KINDS),
  detail: z.preprocess(blank, z.string().trim().max(40).nullable()),
  amount: z.preprocess(blank, z.coerce.number().positive().max(100).nullable()),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.preprocess(blank, z.string().trim().max(500).nullable()),
});

/** Only the owner writes their private log (a partner it's shared with can only look). */
export async function addPrivateEntry(input: z.input<typeof entrySchema>): Promise<ActionResult & { id?: string }> {
  const parsed = entrySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data.kind === "other" && !parsed.data.detail) return { error: "Say what it was." };
  const session = await getSession();
  const { data, error } = await session.supabase
    .from("private_logs")
    .insert({ ...parsed.data, owner_id: session.userId, household_id: session.household.id })
    .select("id")
    .single();
  if (error) return { error: error.code === "42P01" ? "Run the latest database update in Supabase first." : "Couldn't save." };
  refreshModule("/private");
  return { ok: true, id: data.id };
}

export async function deletePrivateEntry(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return { error: "Not found" };
  const session = await getSession();
  const { error } = await session.supabase.from("private_logs").delete().eq("id", id).eq("owner_id", session.userId);
  if (error) return { error: "Couldn't delete." };
  refreshModule("/private");
  return { ok: true };
}

/** Lets the AI coach count drinks (alcohol matters for fat loss and sleep). Nothing else from the log is ever sent. */
export async function setAlcoholForAi(on: boolean): Promise<ActionResult> {
  const session = await getSession();
  const { error } = await session.supabase.from("profiles").update({ ai_include_alcohol: on }).eq("id", session.userId);
  if (error) return { error: "Run the latest database update in Supabase first." };
  refreshModule("/private");
  return { ok: true, message: on ? "The AI coach can now count your drinks." : "Drinks are no longer sent to the AI coach." };
}
