"use server";

import { z } from "zod";
import { errorMessage, refreshModule, requireModule } from "@/lib/guards";
import type { ActionResult } from "@/lib/types";

const blank = (v: unknown) => (v === "" || v == null ? null : v);

const occSchema = z.object({
  title: z.string().trim().min(1, "Name it").max(120),
  kind: z.enum(["birthday", "anniversary", "festival", "other"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  year_known: z.boolean(),
  recurring: z.boolean(),
  person: z.preprocess(blank, z.string().trim().max(80).nullable()),
  remind_days_before: z.coerce.number().int().min(0).max(60).catch(7),
  notes: z.preprocess(blank, z.string().trim().max(500).nullable()),
});

export async function addOccasion(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = occSchema.safeParse({ ...Object.fromEntries(form), year_known: form.get("year_known") === "on", recurring: form.get("recurring") === "on" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { date, year_known, ...v } = parsed.data;
  const [y, m, d] = date.split("-").map(Number);
  try {
    const session = await requireModule("occasions");
    const { error } = await session.supabase.from("occasions").insert({
      ...v,
      month: m,
      day: d,
      year: year_known || !v.recurring ? y : null,
      household_id: session.household.id,
      created_by: session.userId,
    });
    if (error) return { error: "Couldn't save." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/occasions");
  return { ok: true, message: "Saved." };
}

export async function deleteOccasion(id: string) {
  const session = await requireModule("occasions");
  await session.supabase.from("occasions").delete().eq("id", id).eq("household_id", session.household.id);
  refreshModule("/occasions");
}

const giftSchema = z.object({
  for_person: z.string().trim().min(1, "For whom?").max(80),
  idea: z.string().trim().min(1, "What's the idea?").max(200),
  occasion_id: z.preprocess(blank, z.uuid().nullable()),
  url: z.preprocess(blank, z.url().max(500).nullable()),
  price: z.preprocess(blank, z.coerce.number().min(0).max(10_000_000).nullable()),
  notes: z.preprocess(blank, z.string().trim().max(300).nullable()),
});

export async function addGift(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = giftSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const session = await requireModule("occasions");
    const { error } = await session.supabase.from("gift_ideas").insert({ ...parsed.data, owner_id: session.userId, household_id: session.household.id });
    if (error) return { error: "Couldn't save." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/occasions");
  return { ok: true, message: "Saved privately." };
}

export async function setGiftStatus(id: string, status: "idea" | "bought" | "given") {
  const session = await requireModule("occasions");
  await session.supabase.from("gift_ideas").update({ status }).eq("id", id).eq("owner_id", session.userId);
  refreshModule("/occasions");
}

export async function deleteGift(id: string) {
  const session = await requireModule("occasions");
  await session.supabase.from("gift_ideas").delete().eq("id", id).eq("owner_id", session.userId);
  refreshModule("/occasions");
}
