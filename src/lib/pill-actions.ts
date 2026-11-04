"use server";

import { z } from "zod";
import { errorMessage, refreshModule, requireWrite } from "@/lib/guards";
import { PILL_COLORS, PILL_SHAPES } from "@/modules/medicines/look";
import type { ActionResult } from "@/lib/types";

const schema = z.object({
  kind: z.enum(["medicine", "supplement"]),
  id: z.uuid(),
  ownerId: z.uuid(),
  shape: z.enum(PILL_SHAPES).nullable(),
  color: z.enum(PILL_COLORS).nullable(),
});

/** Saves how a medicine or supplement looks (shape and colour). */
export async function setPillLook(input: unknown): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Pick a shape and colour." };
  const { kind, id, ownerId, shape, color } = parsed.data;
  try {
    const session = await requireWrite(kind === "medicine" ? "medicines" : "supplements", ownerId);
    const { error } = await session.supabase.from(kind === "medicine" ? "medicines" : "supplements").update({ pill_shape: shape, pill_color: color }).eq("id", id).eq("owner_id", ownerId);
    if (error) return { error: error.code === "42703" ? "Run the latest database update in Supabase first." : "Couldn't save the look." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule(kind === "medicine" ? "/medicines" : "/supplements");
  return { ok: true, message: "Look saved." };
}
