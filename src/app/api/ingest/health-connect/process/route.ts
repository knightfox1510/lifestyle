import { NextResponse } from "next/server";
import { z } from "zod";
import { ingestUser } from "@/lib/ingest-auth";
import { readHealthConnectExport, saveHealthConnect } from "@/lib/health-connect-import";
import { addDays } from "@/lib/dates";

/** Reading a large export can take a while. */
export const maxDuration = 300;

const body = z.object({ path: z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.zip$/), name: z.string().max(300).optional(), modified: z.iso.datetime({ offset: true }).optional() });

/**
 * Step 2 of the daily Health Connect sync: reads the uploaded export, saves
 * new days (and weigh-ins), deletes the file, and records the result so it
 * shows on the Wearables page.
 */
export async function POST(request: Request) {
  const who = await ingestUser(request);
  if (!who) return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !parsed.data.path.startsWith(`${who.userId}/`)) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { admin, userId, householdId, tz } = who;
  const record = (status: "ok" | "error", message: string, extra: Record<string, unknown> = {}) =>
    admin.from("health_connect_syncs").upsert(
      { user_id: userId, last_run_at: new Date().toISOString(), last_status: status, last_message: message.slice(0, 500), last_file: parsed.data.name ?? null, last_file_modified: parsed.data.modified ?? null, updated_at: new Date().toISOString(), ...extra },
      { onConflict: "user_id" },
    );
  try {
    const file = await admin.storage.from("health-imports").download(parsed.data.path);
    if (file.error || !file.data) throw new Error("The uploaded file wasn't found.");
    const bytes = new Uint8Array(await file.data.arrayBuffer());
    const { data: last } = await admin.from("health_connect_syncs").select("last_day, days_imported").eq("user_id", userId).maybeSingle();
    // Re-read the last few days each time (late syncs from the band), everything on the first run.
    const since = last?.last_day ? addDays(last.last_day, -3) : undefined;
    const summary = await readHealthConnectExport(bytes, tz, since);
    const { data: mods } = await admin.from("household_modules").select("module_key, enabled").eq("household_id", householdId).eq("module_key", "body_recomp").maybeSingle();
    const res = await saveHealthConnect(admin, userId, householdId, summary, { bodyOn: Boolean(mods?.enabled) });
    const message = res.days ? `Imported ${res.days} day${res.days === 1 ? "" : "s"} (${res.found.join(", ") || "nothing recognised"})${res.weights ? ` and ${res.weights} weigh-in${res.weights === 1 ? "" : "s"}` : ""}.` : `No new days. Found: ${res.found.join(", ") || "nothing"}; tables: ${summary.tables.slice(0, 12).join(", ")}`;
    await record("ok", message, { last_day: res.lastDay ?? last?.last_day ?? null, days_imported: (last?.days_imported ?? 0) + res.days });
    return NextResponse.json({ ok: true, ...res, message });
  } catch (e) {
    const message = (e as Error).message || "Import failed.";
    await record("error", message);
    return NextResponse.json({ error: message }, { status: 422 });
  } finally {
    await admin.storage.from("health-imports").remove([parsed.data.path]);
  }
}
