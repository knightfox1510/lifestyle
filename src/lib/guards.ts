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

type DbError = { code?: string; message?: string } | null | undefined;

/** The database hasn't had the latest update yet (a column the app now writes is missing). */
export function isMissingColumn(error: DbError) {
  return Boolean(error && (error.code === "PGRST204" || error.code === "42703" || /column .* does not exist|could not find the .* column/i.test(error.message ?? "")));
}

/** A clear message for a failed save, instead of a generic "Couldn't save". */
export function dbErrorMessage(error: DbError, fallback: string) {
  if (!error) return fallback;
  if (isMissingColumn(error)) return "Your database needs the latest update: run supabase/setup/update-existing-database.sql in the Supabase SQL Editor.";
  if (error.code === "42501") return "You don't have permission to change this (check Settings → Sharing).";
  if (error.code === "23514") return `${fallback} One of the values is out of range.`;
  if (error.code === "23505") return `${fallback} It already exists.`;
  return fallback;
}
