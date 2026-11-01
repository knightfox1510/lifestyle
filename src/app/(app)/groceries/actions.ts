"use server";

import { z } from "zod";
import { errorMessage, refreshModule, requireModule } from "@/lib/guards";
import { guessCategory } from "@/modules/groceries/meta";
import type { ActionResult } from "@/lib/types";

/** Quick add from the Home widget (the list page itself writes from the browser for offline support). */
export async function quickAddGrocery(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const name = z.string().trim().min(1).max(120).safeParse(form.get("name"));
  if (!name.success) return { error: "Type an item" };
  try {
    const session = await requireModule("groceries");
    const { error } = await session.supabase.from("grocery_items").insert({
      id: crypto.randomUUID(),
      household_id: session.household.id,
      created_by: session.userId,
      name: name.data,
      category: guessCategory(name.data),
    });
    if (error) return { error: "Couldn't add it." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/groceries");
  return { ok: true, message: `Added ${name.data}.` };
}
