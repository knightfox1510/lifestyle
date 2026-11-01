"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Field, Input, Notice } from "@/components/ui";

export function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(params.get("error"));

  const redirectTo = () => {
    const base = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    return `${base}/auth/callback?next=${encodeURIComponent(next.startsWith("/") ? next : "/")}`;
  };

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo() },
    });
    if (error) {
      setError(error.message);
      setStatus("idle");
    } else {
      setStatus("sent");
    }
  }

  async function google() {
    setError(null);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo() },
    });
    if (error) setError(error.message);
  }

  return (
    <Card className="space-y-4">
      {status === "sent" ? (
        <Notice tone="accent">
          Check <strong>{email}</strong> for a sign-in link. You can close this tab.
        </Notice>
      ) : (
        <form onSubmit={sendLink} className="space-y-3">
          <Field label="Email">
            <Input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </Field>
          <Button type="submit" className="w-full" disabled={status === "sending"}>
            {status === "sending" ? "Sending…" : "Email me a sign-in link"}
          </Button>
        </form>
      )}
      <div className="flex items-center gap-3 text-xs text-fg-muted">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button variant="secondary" className="w-full" onClick={google}>
        Continue with Google
      </Button>
      {error ? <Notice tone="danger">{error}</Notice> : null}
    </Card>
  );
}
