"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Field, Input, Notice } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import { safeNext } from "@/lib/auth-next";

/**
 * Email sign-in with two ways in: the link in the email, or the 6-digit code
 * typed here. The code works whichever browser or app opens the email, which
 * is what usually breaks links for a partner opening an invite in WhatsApp.
 */
export function LoginForm() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const [error, setError] = useState<string | null>(params.get("error"));

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const redirectTo = () => {
    const base = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    return `${base}/auth/callback?next=${encodeURIComponent(next)}`;
  };

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirectTo() } });
    setBusy(false);
    if (error) return setError(error.message);
    setStep("code");
    setWait(60);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    if (error) {
      setBusy(false);
      return setError(t("That code didn't work. Check the latest email, or send a new code."));
    }
    router.replace(next);
    router.refresh();
  }

  async function google() {
    setError(null);
    const { error } = await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } });
    if (error) setError(error.message);
  }

  return (
    <Card className="space-y-4">
      {step === "email" ? (
        <form onSubmit={send} className="space-y-3">
          <Field label={t("Email")}>
            <Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </Field>
          <Button type="submit" className="w-full" pending={busy}>
            {t("Email me a sign-in code")}
          </Button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-3">
          <Notice tone="accent">{t("We sent a code and a link to {email}. Type the code here, or tap the link in the email.", { email: email.trim() })}</Notice>
          <Field label={t("Code from the email")}>
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,10}"
              maxLength={10}
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="text-center font-mono text-[22px] tracking-[0.3em]"
            />
          </Field>
          <Button type="submit" className="w-full" pending={busy} disabled={code.length < 6}>
            {t("Sign in")}
          </Button>
          <div className="flex justify-between text-sm">
            <button type="button" className="text-fg-muted underline" onClick={() => { setStep("email"); setCode(""); setError(null); }}>
              {t("Use a different email")}
            </button>
            <button type="button" className="text-fg-muted underline disabled:no-underline disabled:opacity-60" disabled={wait > 0 || busy} onClick={() => send()}>
              {wait > 0 ? t("Resend in {n}s", { n: wait }) : t("Send a new code")}
            </button>
          </div>
        </form>
      )}
      <div className="flex items-center gap-3 text-xs text-fg-muted">
        <span className="h-px flex-1 bg-border" />
        {t("or")}
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button variant="secondary" className="w-full" onClick={google}>
        {t("Continue with Google")}
      </Button>
      {error ? <Notice tone="danger">{error}</Notice> : null}
    </Card>
  );
}
