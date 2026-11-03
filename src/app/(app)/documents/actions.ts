"use server";

import { z } from "zod";
import { errorMessage, refreshModule, requireModule } from "@/lib/guards";
import { getSession } from "@/lib/session";
import { VAULT_DOC_TYPES, type ActionResult } from "@/lib/types";

const blank = (v: unknown) => (v === "" || v == null ? null : v);
const docSchema = z.object({
  id: z.preprocess(blank, z.uuid().nullable()),
  title: z.string().trim().min(1, "Name it").max(120),
  doc_type: z.enum(VAULT_DOC_TYPES),
  scope: z.enum(["personal", "household"]),
  holder: z.preprocess(blank, z.string().trim().max(80).nullable()),
  // Keep only the last 4 characters even if the full number is typed.
  number_last4: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.replace(/[^A-Za-z0-9]/g, "").slice(-4) : null), z.string().regex(/^[A-Za-z0-9]{1,4}$/).nullable()),
  issued_on: z.preprocess(blank, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()),
  expires_on: z.preprocess(blank, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()),
  remind_days_before: z.coerce.number().int().min(0).max(365).catch(60),
  notes: z.preprocess(blank, z.string().trim().max(500).nullable()),
});

export async function saveDocument(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = docSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, ...values } = parsed.data;
  try {
    const session = await requireModule("documents");
    const { error } = id
      ? await session.supabase.from("documents").update(values).eq("id", id)
      : await session.supabase.from("documents").insert({ ...values, owner_id: session.userId, household_id: session.household.id });
    if (error) return { error: "Couldn't save." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/documents");
  return { ok: true, message: "Saved." };
}

export async function deleteDocument(id: string) {
  const session = await getSession();
  await session.supabase.from("documents").delete().eq("id", id);
  refreshModule("/documents");
}

/** Edit a saved document's details (same rules as adding one). */
export async function updateDocument(id: string, input: Record<string, unknown>): Promise<ActionResult> {
  const fd = new FormData();
  fd.set("id", id);
  for (const [k, v] of Object.entries(input)) fd.set(k, v == null ? "" : String(v));
  return saveDocument(null, fd);
}
