"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { errorMessage, refreshModule, requireModule } from "@/lib/guards";
import { tripPlanSchema } from "@/lib/ai/phase2-schemas";
import { TRIP_ITEM_KINDS, type ActionResult } from "@/lib/types";
import { BUILTIN_TEMPLATES } from "@/modules/travel/templates";

const blank = (v: unknown) => (v === "" || v == null ? null : v);
const date = z.preprocess(blank, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable());

const tripSchema = z
  .object({
    title: z.string().trim().min(1, "Name the trip").max(120),
    destination: z.preprocess(blank, z.string().trim().max(120).nullable()),
    start_date: date,
    end_date: date,
    status: z.enum(["idea", "planning", "booked", "done"]),
    budget: z.preprocess(blank, z.coerce.number().min(0).max(100_000_000).nullable()),
    currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).catch("INR"),
    notes: z.preprocess(blank, z.string().trim().max(2000).nullable()),
  })
  .refine((v) => !v.start_date || !v.end_date || v.end_date >= v.start_date, { message: "End date is before start date" });

export async function addTrip(_: ActionResult | null, form: FormData): Promise<ActionResult & { id?: string }> {
  const parsed = tripSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const session = await requireModule("travel");
    const { data, error } = await session.supabase.from("trips").insert({ ...parsed.data, household_id: session.household.id, created_by: session.userId }).select("id").single();
    if (error || !data) return { error: "Couldn't add the trip." };
    refreshModule("/travel");
    return { ok: true, id: data.id };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function setTripStatus(id: string, status: "idea" | "planning" | "booked" | "done") {
  const session = await requireModule("travel");
  await session.supabase.from("trips").update({ status }).eq("id", id).eq("household_id", session.household.id);
  refreshModule("/travel");
}

export async function deleteTrip(id: string) {
  const session = await requireModule("travel");
  await session.supabase.from("trips").delete().eq("id", id).eq("household_id", session.household.id);
  refreshModule("/travel");
  redirect("/travel");
}

const itemSchema = z.object({
  tripId: z.uuid(),
  kind: z.enum(TRIP_ITEM_KINDS),
  title: z.string().trim().min(1, "Add a title").max(200),
  day_date: date,
  start_time: z.preprocess(blank, z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable()),
  url: z.preprocess(blank, z.url().max(500).nullable()),
  location: z.preprocess(blank, z.string().trim().max(200).nullable()),
  cost: z.preprocess(blank, z.coerce.number().min(0).max(100_000_000).nullable()),
  notes: z.preprocess(blank, z.string().trim().max(1000).nullable()),
});

export async function addTripItem(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = itemSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { tripId, ...values } = parsed.data;
  try {
    const session = await requireModule("travel");
    const { error } = await session.supabase.from("trip_items").insert({ ...values, trip_id: tripId, household_id: session.household.id, created_by: session.userId });
    if (error) return { error: "Couldn't add." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/travel");
  return { ok: true, message: "Added." };
}

export async function toggleBooked(id: string, booked: boolean) {
  const session = await requireModule("travel");
  await session.supabase.from("trip_items").update({ booked }).eq("id", id).eq("household_id", session.household.id);
  refreshModule("/travel");
}

export async function deleteTripItem(id: string) {
  const session = await requireModule("travel");
  await session.supabase.from("trip_items").delete().eq("id", id).eq("household_id", session.household.id);
  refreshModule("/travel");
}

// ---------------------------------------------------------------- packing --

const packSchema = z.object({
  tripId: z.uuid(),
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().max(40).catch("other"),
  qty: z.coerce.number().int().min(1).max(99).catch(1),
  for_user: z.preprocess(blank, z.uuid().nullable()),
});

export async function addPacking(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = packSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Name the item." };
  const { tripId, ...values } = parsed.data;
  const session = await requireModule("travel");
  const { error } = await session.supabase.from("trip_packing").insert({ ...values, category: values.category || "other", trip_id: tripId, household_id: session.household.id });
  if (error) return { error: "Couldn't add." };
  refreshModule("/travel");
  return { ok: true };
}

export async function togglePacked(id: string, packed: boolean) {
  const session = await requireModule("travel");
  await session.supabase.from("trip_packing").update({ packed }).eq("id", id).eq("household_id", session.household.id);
  refreshModule("/travel");
}

export async function deletePacking(id: string) {
  const session = await requireModule("travel");
  await session.supabase.from("trip_packing").delete().eq("id", id).eq("household_id", session.household.id);
  refreshModule("/travel");
}

/** Adds a template's items to a trip (skipping names already on the list). */
export async function applyTemplate(tripId: string, templateKey: string): Promise<ActionResult> {
  const session = await requireModule("travel");
  let items = BUILTIN_TEMPLATES.find((t) => t.key === templateKey)?.items;
  if (!items) {
    const { data } = await session.supabase.from("packing_templates").select("items").eq("id", templateKey).eq("household_id", session.household.id).maybeSingle();
    items = (data?.items ?? null) as typeof items;
  }
  if (!items?.length) return { error: "Template not found." };
  const { data: existing } = await session.supabase.from("trip_packing").select("name").eq("trip_id", tripId);
  const have = new Set((existing ?? []).map((e: { name: string }) => e.name.toLowerCase()));
  const rows = items
    .filter((i) => !have.has(i.name.toLowerCase()))
    .map((i) => ({ trip_id: tripId, household_id: session.household.id, name: i.name.slice(0, 120), category: (i.category || "other").slice(0, 40), qty: Math.min(99, Math.max(1, i.qty || 1)) }));
  if (rows.length) {
    const { error } = await session.supabase.from("trip_packing").insert(rows);
    if (error) return { error: "Couldn't add the items." };
  }
  refreshModule("/travel");
  return { ok: true, message: `Added ${rows.length} item${rows.length === 1 ? "" : "s"}.` };
}

export async function saveAsTemplate(tripId: string, form: FormData) {
  const name = z.string().trim().min(1).max(80).safeParse(form.get("name"));
  if (!name.success) return;
  const session = await requireModule("travel");
  const { data } = await session.supabase.from("trip_packing").select("name, category, qty").eq("trip_id", tripId).eq("household_id", session.household.id);
  if (!data?.length) return;
  await session.supabase.from("packing_templates").insert({ household_id: session.household.id, name: name.data, items: data });
  refreshModule("/travel");
}

export async function deleteTemplate(id: string) {
  const session = await requireModule("travel");
  await session.supabase.from("packing_templates").delete().eq("id", id).eq("household_id", session.household.id);
  refreshModule("/travel");
}

/** Saves an AI plan's selected parts into the trip. */
export async function importPlan(tripId: string, plan: unknown, parts: { itinerary: boolean; packing: boolean }): Promise<ActionResult> {
  const parsed = tripPlanSchema.safeParse(plan);
  if (!parsed.success) return { error: "Invalid plan." };
  const session = await requireModule("travel");
  const base = { trip_id: tripId, household_id: session.household.id };
  try {
    if (parts.itinerary) {
      const rows = parsed.data.days.flatMap((d) =>
        d.items.map((i) => ({ ...base, created_by: session.userId, day_date: d.date, kind: i.kind, start_time: i.time, title: i.title, location: i.location, notes: i.notes ?? (d.date ? null : d.title) })),
      );
      if (rows.length) {
        const { error } = await session.supabase.from("trip_items").insert(rows);
        if (error) return { error: "Couldn't add the itinerary (check the trip dates)." };
      }
    }
    if (parts.packing && parsed.data.packing.length) {
      const { data: existing } = await session.supabase.from("trip_packing").select("name").eq("trip_id", tripId);
      const have = new Set((existing ?? []).map((e: { name: string }) => e.name.toLowerCase()));
      const rows = parsed.data.packing.filter((p) => !have.has(p.name.toLowerCase())).map((p) => ({ ...base, name: p.name, category: p.category || "other", qty: p.qty }));
      if (rows.length) await session.supabase.from("trip_packing").insert(rows);
    }
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/travel");
  return { ok: true, message: "Added to the trip." };
}
