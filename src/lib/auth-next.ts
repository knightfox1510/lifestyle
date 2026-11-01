/** A same-site path to go to after sign-in; anything else becomes "/" (no open redirects). */
export function safeNext(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  try {
    const u = new URL(raw, "http://x");
    return u.host === "x" ? `${u.pathname}${u.search}` : "/";
  } catch {
    return "/";
  }
}

export const EMAIL_OTP_TYPES = ["email", "magiclink", "signup", "invite", "recovery", "email_change"] as const;
