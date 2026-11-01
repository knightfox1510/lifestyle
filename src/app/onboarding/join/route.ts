import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/session";
import { inviteErrorMessage, joinSchema } from "../shared";

/**
 * Join a household with an invite code. A plain POST + redirect (not a server
 * action), so it keeps working even if a new version was deployed while the
 * page was open, and Home loads in a fresh request with the new household.
 */
export async function POST(request: NextRequest) {
  const { origin } = request.nextUrl;
  const form = await request.formData();
  const code = String(form.get("code") ?? "").trim().toUpperCase();
  const back = (error: string) =>
    NextResponse.redirect(`${origin}/onboarding?tab=join&code=${encodeURIComponent(code)}&error=${encodeURIComponent(error)}`, 303);

  const parsed = joinSchema.safeParse({ displayName: form.get("displayName"), code });
  if (!parsed.success) return back(parsed.error.issues[0].message);
  const { supabase, userId } = await getUser();

  await supabase.from("profiles").update({ display_name: parsed.data.displayName }).eq("id", userId);
  const { error } = await supabase.rpc("accept_invite", { invite_code: parsed.data.code });
  if (error) {
    console.error("accept_invite failed", error.message);
    return back(inviteErrorMessage(error.message));
  }
  return NextResponse.redirect(`${origin}/`, 303);
}

/** Opened directly (e.g. after signing in): go to the setup page. */
export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/onboarding", request.nextUrl.origin));
}
