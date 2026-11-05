import { NextResponse, after } from "next/server";
import { z } from "zod";
import { ingestUser } from "@/lib/ingest-auth";
import { driveZip, readHealthConnectZip, saveHealthConnect } from "@/lib/health-connect-import";
import { addDays } from "@/lib/dates";

/** Reading a large export can take a few minutes; it runs after the reply. */
export const maxDuration = 300;

const body = z.object({
  fileId: z.string().regex(/^[\w-]{10,200}$/),
  accessToken: z.string().min(20).max(4096),
  name: z.string().max(300).optional(),
  modified: z.iso.datetime({ offset: true }).optional(),
});

/**
 * The daily Health Connect sync, called by the Google Apps Script in your
 * Drive. The script sends the export's Drive file id and a short-lived
 * Google token (not the file: exports are far bigger than Apps Script can
 * send). Hearth reads only the database out of the zip, straight from Drive,
 * saves new days and weigh-ins, and records the result for the Wearables page.
 */
export async function POST(request: Request) {
  const who = await ingestUser(request);
  if (!who) return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body. Copy the latest sync script from Hearth → Wearables." }, { status: 400 });
  const { admin, userId, householdId, tz } = who;
  const { fileId, accessToken, name, modified } = parsed.data;

  const { data: last } = await admin.from("health_connect_syncs").select("last_file, last_file_modified, last_status, last_day, days_imported").eq("user_id", userId).maybeSingle();
  if (last?.last_status === "ok" && last.last_file === name && modified && last.last_file_modified && Date.parse(last.last_file_modified) >= Date.parse(modified)) {
    return NextResponse.json({ skip: true, message: "Already imported this export." });
  }

  const record = (status: "ok" | "error", message: string, extra: Record<string, unknown> = {}) =>
    admin.from("health_connect_syncs").upsert(
      { user_id: userId, last_run_at: new Date().toISOString(), last_status: status, last_message: message.slice(0, 500), last_file: name ?? null, last_file_modified: modified ?? null, updated_at: new Date().toISOString(), ...extra },
      { onConflict: "user_id" },
    );

  after(async () => {
    try {
      const src = await driveZip(fileId, accessToken);
      // Re-read the last few days each time (late syncs from the band), everything on the first run.
      const since = last?.last_day ? addDays(last.last_day, -3) : undefined;
      const summary = await readHealthConnectZip(src, tz, since);
      const { data: mods } = await admin.from("household_modules").select("module_key, enabled").eq("household_id", householdId).in("module_key", ["body_recomp", "fitness"]);
      const isOn = (k: string) => ((mods ?? []) as { module_key: string; enabled: boolean }[]).some((m) => m.module_key === k && m.enabled);
      const res = await saveHealthConnect(admin, userId, householdId, summary, { bodyOn: isOn("body_recomp"), fitnessOn: isOn("fitness") });
      const message = res.days
        ? `Imported ${res.days} day${res.days === 1 ? "" : "s"} (${res.found.join(", ") || "nothing recognised"})${res.weights ? ` and ${res.weights} weigh-in${res.weights === 1 ? "" : "s"}` : ""}${res.workouts ? `, plus ${res.workouts} workout${res.workouts === 1 ? "" : "s"} for Fitness` : ""}.`
        : `No new days. Found: ${res.found.join(", ") || "nothing"}; tables: ${summary.tables.slice(0, 12).join(", ")}`;
      await record("ok", message, { last_day: res.lastDay ?? last?.last_day ?? null, days_imported: (last?.days_imported ?? 0) + res.days });
    } catch (e) {
      await record("error", (e as Error).message || "Import failed.");
    }
  });

  return NextResponse.json({ started: true, message: "Hearth is reading the export now. The result shows on the Wearables page in a few minutes." }, { status: 202 });
}
