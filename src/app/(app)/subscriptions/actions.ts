"use server";

import { z } from "zod";
import { errorMessage, refreshModule, requireModule } from "@/lib/guards";
import { BILLING_CYCLES, SUB_CATEGORIES, type ActionResult } from "@/lib/types";
import { nextRenewal } from "@/modules/subscriptions/logic";

const blank = (v: unknown) => (v === "" || v == null ? null : v);
const subSchema = z.object({
  name: z.string().trim().min(1, "Name it").max(80),
  category: z.enum(SUB_CATEGORIES),
  cost: z.preprocess(blank, z.coerce.number().min(0).max(10_000_000).nullable()),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).catch("INR"),
  billing_cycle: z.enum(BILLING_CYCLES),
  next_renewal_on: z.preprocess(blank, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()),
  paid_by: z.preprocess(blank, z.uuid().nullable()),
  auto_renew: z.boolean(),
  url: z.preprocess(blank, z.url().max(300).nullable()),
  notes: z.preprocess(blank, z.string().trim().max(300).nullable()),
});

export async function addSubscription(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = subSchema.safeParse({ ...Object.fromEntries(form), auto_renew: form.get("auto_renew") === "on" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const session = await requireModule("subscriptions");
    const { error } = await session.supabase.from("subscriptions").insert({ ...parsed.data, household_id: session.household.id, created_by: session.userId });
    if (error) return { error: "Couldn't save." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refreshModule("/subscriptions");
  return { ok: true, message: "Added." };
}

/** Moves the renewal date forward by one billing cycle. */
export async function markRenewed(id: string) {
  const session = await requireModule("subscriptions");
  const { data } = await session.supabase.from("subscriptions").select("next_renewal_on, billing_cycle").eq("id", id).eq("household_id", session.household.id).single();
  if (!data?.next_renewal_on) return;
  await session.supabase.from("subscriptions").update({ next_renewal_on: nextRenewal(data.next_renewal_on, data.billing_cycle) }).eq("id", id);
  refreshModule("/subscriptions");
}

export async function setSubscriptionActive(id: string, active: boolean) {
  const session = await requireModule("subscriptions");
  await session.supabase.from("subscriptions").update({ active }).eq("id", id).eq("household_id", session.household.id);
  refreshModule("/subscriptions");
}

export async function deleteSubscription(id: string) {
  const session = await requireModule("subscriptions");
  await session.supabase.from("subscriptions").delete().eq("id", id).eq("household_id", session.household.id);
  refreshModule("/subscriptions");
}
