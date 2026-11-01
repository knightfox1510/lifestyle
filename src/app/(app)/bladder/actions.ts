"use server";

import { z } from "zod";
import { errorMessage, refreshModule, requireWrite } from "@/lib/guards";
import { getSession } from "@/lib/session";
import { BLADDER_KINDS, BLADDER_TRIGGERS, DRINKS, LEAK_AMOUNTS, type ActionResult } from "@/lib/types";
import { DRINK_META } from "@/modules/bladder/meta";

const MODULE = "bladder_diary";
const blank = (v: unknown) => (v === "" || v === undefined ? null : v);

const when = z.preprocess(
  (v) => (v === "" || v == null ? new Date().toISOString() : v),
  z.iso.datetime({ offset: true }).refine((v) => new Date(v).getTime() <= Date.now() + 5 * 60_000, "That time is in the future"),
);

const eventSchema = z.object({
  ownerId: z.uuid(),
  occurred_at: when,
  kind: z.enum(BLADDER_KINDS),
  amount: z.preprocess(blank, z.enum(LEAK_AMOUNTS).nullable()),
  urgency: z.preprocess(blank, z.coerce.number().int().min(1).max(5).nullable()),
  triggers: z.array(z.enum(BLADDER_TRIGGERS)).max(15),
  pad_changed: z.boolean(),
  notes: z.preprocess(blank, z.string().trim().max(1000).nullable()),
});

export async function logBladderEvent(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = eventSchema.safeParse({
    ...Object.fromEntries(form),
    triggers: form.getAll("triggers").map(String),
    pad_changed: form.get("pad_changed") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { ownerId, ...values } = parsed.data;
  try {
    const session = await requireWrite(MODULE, ownerId);
    const { error } = await session.supabase.from("bladder_events").insert({
      ...values,
      amount: values.kind === "leak" ? values.amount : null,
      owner_id: ownerId,
      created_by: session.userId,
      household_id: session.household.id,
    });
    if (error) return { error: "Couldn't save." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/bladder");
  return { ok: true, message: "Logged." };
}

const fluidSchema = z.object({
  ownerId: z.uuid(),
  occurred_at: when,
  drink: z.enum(DRINKS),
  volume_ml: z.coerce.number().int().min(10, "At least 10 ml").max(3000),
  caffeinated: z.boolean(),
});

export async function logFluid(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = fluidSchema.safeParse({ ...Object.fromEntries(form), caffeinated: form.get("caffeinated") === "on" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { ownerId, ...values } = parsed.data;
  try {
    const session = await requireWrite(MODULE, ownerId);
    const { error } = await session.supabase
      .from("fluid_intake")
      .insert({ ...values, owner_id: ownerId, created_by: session.userId, household_id: session.household.id });
    if (error) return { error: "Couldn't save." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/bladder");
  return { ok: true, message: "Drink logged." };
}

/** One-tap logging from the Home widget. */
export async function quickLog(ownerId: string, what: "leak" | "urge" | "void" | "water"): Promise<ActionResult> {
  try {
    const session = await requireWrite(MODULE, ownerId);
    const base = { owner_id: ownerId, created_by: session.userId, household_id: session.household.id };
    const { data: row, error } =
      what === "water"
        ? await session.supabase.from("fluid_intake").insert({ ...base, drink: "water", volume_ml: 250, caffeinated: DRINK_META.water.caffeinated }).select("id").single()
        : await session.supabase.from("bladder_events").insert({ ...base, kind: what, amount: what === "leak" ? "small" : null }).select("id").single();
    if (error) return { error: "Couldn't save." };
    refreshModule("/bladder");
    return { ok: true, id: row?.id, message: what === "water" ? "+250 ml water" : "Logged. Add details in the diary." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function deleteBladderEvent(id: string) {
  const session = await getSession();
  await session.supabase.from("bladder_events").delete().eq("id", id).eq("owner_id", session.userId);
  refreshModule("/bladder");
}

export async function deleteFluid(id: string) {
  const session = await getSession();
  await session.supabase.from("fluid_intake").delete().eq("id", id).eq("owner_id", session.userId);
  refreshModule("/bladder");
}
