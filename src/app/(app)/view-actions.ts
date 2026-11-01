"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { VIEW_COOKIE } from "@/lib/session";

export async function setViewMode(mode: "me" | "partner") {
  const store = await cookies();
  store.set(VIEW_COOKIE, mode === "partner" ? "partner" : "me", {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}
