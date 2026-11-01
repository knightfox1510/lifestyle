import "server-only";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";

/** For server actions: module must be on and the caller must have write access to the owner's data. */
export async function requireWrite(moduleKey: string, ownerId: string) {
  const session = await getSession();
  if (!session.isModuleEnabled(moduleKey)) throw new Error("This feature is turned off for your household");
  if (session.accessTo(moduleKey, ownerId) !== "write") throw new Error("You don't have permission to change this");
  return session;
}

export async function requireModule(moduleKey: string) {
  const session = await getSession();
  if (!session.isModuleEnabled(moduleKey)) throw new Error("This feature is turned off for your household");
  return session;
}

export function refreshModule(path: string) {
  revalidatePath(path, "layout");
  revalidatePath("/");
}

export function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : "Something went wrong";
}
