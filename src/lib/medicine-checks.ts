import "server-only";

import type { AppSession } from "@/lib/session";
import type { Medicine, Supplement } from "@/lib/types";
import { checkMedicines, unrecognised, type CheckMed } from "@/modules/medicines/checks";
import { getT } from "@/lib/i18n/server";

/** Loads a person's active medicines, supplements and recorded allergies, and runs the rule checks. */
export async function medicineChecksFor(session: AppSession, ownerId: string) {
  const canMeds = session.isModuleEnabled("medicines") && session.accessTo("medicines", ownerId) !== "none";
  const canSupps = session.isModuleEnabled("supplements") && session.accessTo("supplements", ownerId) !== "none";
  const canMedical = session.isModuleEnabled("medical_records") && session.accessTo("medical_records", ownerId) !== "none";
  const [{ data: meds }, { data: supps }, { data: allergies }] = await Promise.all([
    canMeds ? session.supabase.from("medicines").select("*").eq("owner_id", ownerId).eq("active", true) : Promise.resolve({ data: [] }),
    canSupps ? session.supabase.from("supplements").select("*").eq("owner_id", ownerId).eq("active", true) : Promise.resolve({ data: [] }),
    canMedical ? session.supabase.from("medical_events").select("title, details").eq("owner_id", ownerId).eq("category", "allergy") : Promise.resolve({ data: [] }),
  ]);
  const list: CheckMed[] = [
    ...((meds ?? []) as Medicine[]).map((m) => ({ name: m.name, strength: m.strength, dose_amount: m.dose_amount, times: m.times, kind: "medicine" as const })),
    ...((supps ?? []) as Supplement[]).map((s) => ({ name: s.name, strength: s.dose, times: [], kind: "supplement" as const })),
  ];
  const allergyList = ((allergies ?? []) as { title: string; details: string | null }[]).map((a) => `${a.title}${a.details ? ` (${a.details})` : ""}`);
  const t = await getT(session);
  return {
    list,
    allergies: allergyList,
    findings: checkMedicines(list, { allergies: allergyList, bladder: session.isModuleEnabled("bladder_diary"), t }),
    unknown: unrecognised(list),
  };
}
