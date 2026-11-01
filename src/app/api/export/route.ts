import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

// Tables holding personal data, by the column that identifies the person.
const PERSONAL: [string, "owner_id" | "user_id"][] = [
  ["medical_profiles", "owner_id"], ["medical_events", "owner_id"], ["medical_documents", "owner_id"], ["lab_results", "owner_id"],
  ["medicines", "owner_id"], ["medicine_doses", "owner_id"], ["supplements", "owner_id"], ["supplement_logs", "owner_id"],
  ["bladder_events", "owner_id"], ["fluid_intake", "owner_id"], ["pelvic_floor_sessions", "owner_id"], ["daily_checkins", "owner_id"],
  ["habits", "owner_id"], ["habit_logs", "owner_id"], ["nutrition_goals", "owner_id"], ["food_entries", "owner_id"],
  ["body_metrics", "owner_id"], ["body_goals", "owner_id"], ["fitness_classes", "owner_id"], ["workout_logs", "owner_id"],
  ["documents", "owner_id"], ["gift_ideas", "owner_id"], ["wearable_daily", "owner_id"],
  ["notification_prefs", "user_id"], ["digests", "user_id"], ["user_widgets", "user_id"], ["module_shares", "owner_id"], ["ai_usage", "user_id"],
];
// Household-shared tables (exported for the active household).
const HOUSEHOLD = [
  "grocery_items", "pantry_items", "recipes", "meal_plan", "dependents", "child_logs", "vaccinations", "growth_records",
  "maintenance_tasks", "maintenance_log", "subscriptions", "watchlist_items", "watch_progress", "dining_places", "dining_dishes",
  "dining_orders", "trips", "trip_items", "trip_packing", "packing_templates", "occasions",
];

/** Downloads everything the signed-in user owns (plus their household's shared lists) as JSON. */
export async function GET() {
  const session = await getSession();
  const db = session.supabase;
  const personal: Record<string, unknown[]> = {};
  const household: Record<string, unknown[]> = {};

  await Promise.all([
    ...PERSONAL.map(async ([table, col]) => {
      const { data } = await db.from(table).select("*").eq(col, session.userId).limit(50000);
      personal[table] = data ?? [];
    }),
    ...HOUSEHOLD.map(async (table) => {
      const { data } = await db.from(table).select("*").eq("household_id", session.household.id).limit(50000);
      household[table] = data ?? [];
    }),
  ]);

  // Uploaded medical files: time-limited links (24 h) instead of embedding the files.
  const docs = (personal.medical_documents ?? []) as { id: string; title: string; storage_path: string }[];
  const files = await Promise.all(
    docs.map(async (d) => {
      const { data } = await db.storage.from("medical-documents").createSignedUrl(d.storage_path, 86400);
      return { id: d.id, title: d.title, download_url_valid_24h: data?.signedUrl ?? null };
    }),
  );

  const body = {
    exported_at: new Date().toISOString(),
    app: "Hearth",
    user: { id: session.userId, email: session.email, profile: session.profile },
    household: { id: session.household.id, name: session.household.name, members: session.members },
    personal,
    household_data: household,
    medical_files: files,
  };
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="hearth-export-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
