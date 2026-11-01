import Link from "next/link";
import { LogoMark } from "@/components/logo";
import { buttonClass } from "@/components/ui";
import { getT } from "@/lib/i18n/server";
import { safeNext } from "@/lib/auth-next";

export const metadata = { title: "Sign in" };

/**
 * Landing page for the email link. Signing in happens only when the button is
 * pressed (a POST), so email scanners that open links can't use it up, and it
 * works in whichever browser the email app opens.
 */
export default async function ConfirmPage({ searchParams }: PageProps<"/auth/confirm">) {
  const sp = await searchParams;
  const t = await getT();
  const tokenHash = typeof sp.token_hash === "string" ? sp.token_hash : "";
  const type = typeof sp.type === "string" ? sp.type : "email";
  const next = safeNext(typeof sp.next === "string" ? sp.next : "/");
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6 text-center">
      <LogoMark className="mx-auto size-16" />
      <div className="space-y-1.5">
        <h1 className="text-[26px] font-semibold tracking-[-0.03em]">{t("One tap to sign in")}</h1>
        <p className="text-sm text-fg-muted">{t("This keeps your link safe from email scanners.")}</p>
      </div>
      {tokenHash ? (
        <form method="post" action="/auth/callback">
          <input type="hidden" name="token_hash" value={tokenHash} />
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="next" value={next} />
          <button className={buttonClass("accent") + " h-12 w-full text-[16px]"}>{t("Sign in to Hearth")}</button>
        </form>
      ) : (
        <p className="text-sm text-danger">{t("This link is incomplete. Go back to the sign-in page and use the 6-digit code from the email.")}</p>
      )}
      <Link href="/login" className="text-sm text-fg-muted underline">{t("Back to sign in")}</Link>
    </main>
  );
}
