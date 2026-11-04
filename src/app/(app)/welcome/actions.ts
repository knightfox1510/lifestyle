"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";

/** Marks the welcome steps done (or skipped), so Today stops offering them. */
export async function finishWelcome() {
  const session = await getSession();
  await session.supabase.from("profiles").update({ welcome_done_at: new Date().toISOString() }).eq("id", session.userId);
  revalidatePath("/", "layout");
}
