import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/session";
import { MODULES } from "@/modules/registry";
import { createSchema } from "../shared";

/** Create a household. Plain POST + redirect, like join (safe across deploys). */
export async function POST(request: NextRequest) {
  const { origin } = request.nextUrl;
  const form = await request.formData();
  const back = (error: string) => NextResponse.redirect(`${origin}/onboarding?tab=create&error=${encodeURIComponent(error)}`, 303);

  const parsed = createSchema.safeParse({ displayName: form.get("displayName"), householdName: form.get("householdName") });
  if (!parsed.success) return back(parsed.error.issues[0].message);
  const { supabase, userId } = await getUser();

  await supabase.from("profiles").update({ display_name: parsed.data.displayName }).eq("id", userId);
  const { data: hid, error } = await supabase.rpc("create_household", { household_name: parsed.data.householdName });
  if (error || !hid) {
    console.error("create_household failed", error?.message);
    return back("Couldn't create the household. Please try again.");
  }

  // Apply the features picked during setup.
  if (form.get("picker") === "1") {
    const picked = new Set(form.getAll("modules").map(String));
    await supabase.from("household_modules").upsert(
      MODULES.filter((m) => m.status === "available").map((m) => ({ household_id: hid, module_key: m.key, enabled: picked.has(m.key) })),
      { onConflict: "household_id,module_key" },
    );
  }
  return NextResponse.redirect(`${origin}/`, 303);
}

/** Opened directly (e.g. after signing in): go to the setup page. */
export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/onboarding", request.nextUrl.origin));
}
