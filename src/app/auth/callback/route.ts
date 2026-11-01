import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { EMAIL_OTP_TYPES, safeNext } from "@/lib/auth-next";

const failed = (origin: string) =>
  NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("That link didn't work in this browser. Enter the 6-digit code from the email instead.")}`, 303);

/**
 * GET: Google sign-in (?code=). Email links (?token_hash=) are sent to the
 * confirm page instead of being used here, because email security scanners
 * open links automatically and would use up the one-time link.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const code = searchParams.get("code");
  if (searchParams.get("token_hash")) {
    const url = new URL("/auth/confirm", origin);
    searchParams.forEach((v, k) => url.searchParams.set(k, v));
    return NextResponse.redirect(url);
  }
  if (!code) return failed(origin);
  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return error ? failed(origin) : NextResponse.redirect(`${origin}${next}`);
}

/**
 * POST from the confirm page's button: verifies the email link's token hash.
 * Works in any browser (no PKCE cookie needed).
 */
export async function POST(request: NextRequest) {
  const { origin } = request.nextUrl;
  const form = await request.formData();
  const tokenHash = String(form.get("token_hash") ?? "");
  const type = String(form.get("type") ?? "email");
  const next = safeNext(String(form.get("next") ?? "/"));
  if (!tokenHash || !(EMAIL_OTP_TYPES as readonly string[]).includes(type)) return failed(origin);
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType });
  return error ? failed(origin) : NextResponse.redirect(`${origin}${next}`, 303);
}
