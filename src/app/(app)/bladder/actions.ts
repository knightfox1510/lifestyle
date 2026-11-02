"use server";

import { z } from "zod";
import { dbErrorMessage, errorMessage, refreshModule, requireWrite } from "@/lib/guards";
import { getSession } from "@/lib/session";
import { BLADDER_KINDS, BLADDER_TRIGGERS, DRINKS, LEAK_AMOUNTS, type ActionResult } from "@/lib/types";
import { DRINK_META } from "@/modules/bladder/meta";
import { DIARY_EVENT_META, DIARY_EVENT_TYPES, diaryEventTitle } from "@/modules/bladder/events";
import { leakKey } from "@/modules/bladder/whatsapp";
import { todayIn, zonedIso } from "@/lib/dates";
import { revalidatePath } from "next/cache";

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

/** Deletes a diary entry: the owner always, or whoever logged it while they have write access. */
export async function deleteBladderEvent(id: string, ownerId: string): Promise<ActionResult> {
  try {
    const session = await requireWrite(MODULE, ownerId);
    const { data, error } = await session.supabase.from("bladder_events").delete().eq("id", id).eq("owner_id", ownerId).select("id");
    if (error || !data?.length) return { error: "Only the person it belongs to, or whoever logged it, can delete this." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/bladder");
  return { ok: true, message: "Deleted." };
}

export async function deleteFluid(id: string, ownerId?: string): Promise<ActionResult> {
  try {
    const session = await (ownerId ? requireWrite(MODULE, ownerId) : getSession());
    const { data, error } = await session.supabase.from("fluid_intake").delete().eq("id", id).eq("owner_id", ownerId ?? session.userId).select("id");
    if (error || !data?.length) return { error: "Only the person it belongs to, or whoever logged it, can delete this." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/bladder");
  return { ok: true, message: "Deleted." };
}

const localWhen = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Pick a time"),
});

/** Turns a local date + time into a timestamp, refusing the future. */
function whenFrom(v: z.infer<typeof localWhen>, tz: string): string | null {
  const iso = zonedIso(v.date, v.time, tz);
  return Date.parse(iso) > Date.now() + 5 * 60_000 ? null : iso;
}

const eventEdit = localWhen.extend({
  kind: z.enum(BLADDER_KINDS),
  amount: z.enum(LEAK_AMOUNTS).nullable(),
  urgency: z.number().int().min(1).max(5).nullable(),
  triggers: z.array(z.enum(BLADDER_TRIGGERS)).max(15),
  pad_changed: z.boolean(),
  notes: z.string().trim().max(1000).nullable(),
});

/** Fix a leak/urge/bathroom entry: its time (and date), type, amount, urgency, triggers and note. */
export async function updateBladderEvent(id: string, ownerId: string, input: unknown): Promise<ActionResult> {
  const parsed = eventEdit.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  const { date, time, ...v } = parsed.data;
  try {
    const session = await requireWrite(MODULE, ownerId);
    const occurred_at = whenFrom({ date, time }, session.profile.timezone);
    if (!occurred_at) return { error: "That time is in the future." };
    const { data, error } = await session.supabase
      .from("bladder_events")
      .update({ ...v, occurred_at, amount: v.kind === "leak" ? v.amount : null, notes: v.notes || null })
      .eq("id", id)
      .eq("owner_id", ownerId)
      .select("id");
    if (error || !data?.length) return { error: dbErrorMessage(error, "Couldn't save the changes.") };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/bladder");
  return { ok: true, message: "Saved." };
}

const fluidEdit = localWhen.extend({
  drink: z.enum(DRINKS),
  volume_ml: z.number().int().min(10, "At least 10 ml").max(3000),
  caffeinated: z.boolean(),
});

/** Fix a drink: time (and date), type, amount and caffeine. */
export async function updateFluid(id: string, ownerId: string, input: unknown): Promise<ActionResult> {
  const parsed = fluidEdit.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  const { date, time, ...v } = parsed.data;
  try {
    const session = await requireWrite(MODULE, ownerId);
    const occurred_at = whenFrom({ date, time }, session.profile.timezone);
    if (!occurred_at) return { error: "That time is in the future." };
    const { data, error } = await session.supabase.from("fluid_intake").update({ ...v, occurred_at }).eq("id", id).eq("owner_id", ownerId).select("id");
    if (error || !data?.length) return { error: dbErrorMessage(error, "Couldn't save the changes.") };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/bladder");
  refreshModule("/food");
  return { ok: true, message: "Saved." };
}

// ------------------------------------------------------------- import ----

const importRow = z.object({
  at: z.iso.datetime({ offset: true }),
  amount: z.enum(LEAK_AMOUNTS),
  triggers: z.array(z.enum(BLADDER_TRIGGERS)).max(15),
  notes: z.string().max(1000),
});

export type ImportResult = { ok?: boolean; error?: string; added?: number; existing?: number; from?: string; to?: string };

/** Adds leaks parsed from a pasted WhatsApp log; rows already in the diary (same minute and note) are skipped. */
export async function importBladderEvents(ownerId: string, input: unknown[]): Promise<ImportResult> {
  const parsed = z.object({ ownerId: z.uuid(), rows: z.array(importRow).min(1, "Nothing to import").max(5000, "Import at most 5,000 rows at a time") }).safeParse({ ownerId, rows: input });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const rows = [...parsed.data.rows].sort((a, b) => a.at.localeCompare(b.at));
  if (new Date(rows.at(-1)!.at).getTime() > Date.now() + 5 * 60_000) return { error: "That time is in the future" };
  try {
    const session = await requireWrite(MODULE, ownerId);
    const from = new Date(new Date(rows[0].at).getTime() - 60_000).toISOString();
    const to = new Date(new Date(rows.at(-1)!.at).getTime() + 60_000).toISOString();
    const existing = new Set<string>();
    for (let page = 0; ; page++) {
      const { data, error } = await session.supabase
        .from("bladder_events")
        .select("occurred_at, notes")
        .eq("owner_id", ownerId)
        .gte("occurred_at", from)
        .lte("occurred_at", to)
        .order("occurred_at")
        .range(page * 1000, page * 1000 + 999);
      if (error) return { error: "Couldn't check the diary." };
      for (const r of data ?? []) existing.add(leakKey({ at: r.occurred_at, notes: r.notes }));
      if ((data ?? []).length < 1000) break;
    }
    const fresh = rows.filter((r) => !existing.has(leakKey(r)));
    const base = { owner_id: ownerId, created_by: session.userId, household_id: session.household.id, kind: "leak" as const };
    for (let i = 0; i < fresh.length; i += 500) {
      const { error } = await session.supabase
        .from("bladder_events")
        .insert(fresh.slice(i, i + 500).map((r) => ({ ...base, occurred_at: r.at, amount: r.amount, triggers: r.triggers, notes: r.notes })));
      if (error) return { error: i ? "Imported part of the log, then failed. Import again to add the rest." : "Couldn't save." };
    }
    refreshModule("/bladder");
    return { ok: true, added: fresh.length, existing: rows.length - fresh.length, from: rows[0].at, to: rows.at(-1)!.at };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

// ------------------------------------------------------------- events ----

const diaryEventSchema = z.object({
  ownerId: z.uuid(),
  type: z.enum(DIARY_EVENT_TYPES),
  title: z.string().trim().max(200).optional().default(""),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  details: z.preprocess(blank, z.string().trim().max(2000).nullable()),
});

/** Surgery, stent removal, a medicine started… saved as a medical event so it also shows in records and visit summaries. */
export async function addDiaryEvent(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = diaryEventSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { ownerId, type, title, date, details } = parsed.data;
  const meta = DIARY_EVENT_META[type];
  if (meta.needsTitle && !title) return { error: type === "medicine_started" || type === "medicine_stopped" ? "Add the medicine name" : "Add a title" };
  try {
    const session = await getSession();
    if (date > todayIn(session.profile.timezone)) return { error: "That date is in the future" };
    if (ownerId !== session.userId && session.accessTo("medical_records", ownerId) !== "write") {
      return { error: "Ask them to share Medical records with edit access (Settings → Sharing) to add events for them." };
    }
    const { error } = await session.supabase.from("medical_events").insert({
      owner_id: ownerId,
      created_by: session.userId,
      household_id: session.household.id,
      category: meta.category,
      title: diaryEventTitle(type, title),
      details,
      start_date: date,
      ongoing: type === "medicine_started",
    });
    if (error) return { error: "Couldn't save the event." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/bladder");
  revalidatePath("/medical", "layout");
  return { ok: true, message: type === "medicine_started" ? "Event added. Add it to Medicines too for reminders." : "Event added." };
}

export async function deleteDiaryEvent(id: string) {
  const session = await getSession();
  await session.supabase.from("medical_events").delete().eq("id", id).eq("owner_id", session.userId);
  refreshModule("/bladder");
  revalidatePath("/medical", "layout");
}
