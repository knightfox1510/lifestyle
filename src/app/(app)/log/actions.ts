"use server";

import { z } from "zod";
import { refreshModule } from "@/lib/guards";
import { getSession } from "@/lib/session";
import { foodItemSchema, MEALS } from "@/lib/ai/phase2-schemas";
import { BLADDER_TRIGGERS, DRINKS, LEAK_AMOUNTS, type ActionResult } from "@/lib/types";

const at = z.iso.datetime({ offset: true });
const payloadSchema = z.object({
  food: z.array(foodItemSchema.extend({ meal: z.enum(MEALS), at })).max(15),
  drinks: z.array(z.object({ drink: z.enum(DRINKS), volume_ml: z.number().int().min(10).max(3000), caffeinated: z.boolean(), at })).max(15),
  bladder: z.array(z.object({ kind: z.enum(["leak", "urge", "void"]), amount: z.enum(LEAK_AMOUNTS).nullable(), urgency: z.number().int().min(1).max(5).nullable(), triggers: z.array(z.enum(BLADDER_TRIGGERS)).max(6), at })).max(15),
  weight_kg: z.number().min(20).max(350).nullable(),
});

/** Saves confirmed quick-log entries into each module the person can write to. */
export async function saveQuickLog(ownerId: string, payload: unknown): Promise<ActionResult> {
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) return { error: "Some entries are invalid." };
  const session = await getSession();
  const can = (k: string) => session.isModuleEnabled(k) && session.accessTo(k, ownerId) === "write";
  const base = { owner_id: ownerId, created_by: session.userId, household_id: session.household.id };
  const done: string[] = [];
  const skipped: string[] = [];
  const { food, drinks, bladder, weight_kg } = parsed.data;

  if (food.length) {
    if (can("food_diary")) {
      const { error } = await session.supabase.from("food_entries").insert(food.map(({ at: eaten_at, ...f }) => ({ ...base, ...f, eaten_at, source: "ai_estimate" })));
      if (!error) done.push(`${food.length} food`);
    } else skipped.push("food");
  }
  if (drinks.length || bladder.length) {
    if (can("bladder_diary")) {
      if (drinks.length) {
        const { error } = await session.supabase.from("fluid_intake").insert(drinks.map(({ at: occurred_at, ...d }) => ({ ...base, ...d, occurred_at })));
        if (!error) done.push(`${drinks.length} drink${drinks.length === 1 ? "" : "s"}`);
      }
      if (bladder.length) {
        const { error } = await session.supabase.from("bladder_events").insert(bladder.map(({ at: occurred_at, ...b }) => ({ ...base, ...b, amount: b.kind === "leak" ? b.amount : null, occurred_at })));
        if (!error) done.push(`${bladder.length} bladder`);
      }
    } else skipped.push("drinks/bladder");
  }
  if (weight_kg !== null) {
    if (can("body_recomp")) {
      const { error } = await session.supabase.from("body_metrics").insert({ ...base, weight_kg });
      if (!error) done.push("weight");
    } else skipped.push("weight");
  }

  for (const p of ["/food", "/bladder", "/body"]) refreshModule(p);
  if (!done.length) return { error: skipped.length ? `Those features are off or not shared: ${skipped.join(", ")}.` : "Nothing was saved." };
  return { ok: true, message: `Logged ${done.join(", ")}.${skipped.length ? ` Skipped ${skipped.join(", ")} (feature off).` : ""}` };
}
