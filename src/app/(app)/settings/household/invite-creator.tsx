"use client";

import { useState, useTransition } from "react";
import { Button, Notice } from "@/components/ui";
import { createInvite } from "../actions";

export function InviteCreator() {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const link = code ? `${window.location.origin}/onboarding?code=${code}` : "";

  return (
    <div className="space-y-2">
      <Button
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await createInvite();
            if (res.error) setError(res.error);
            else {
              setCode(res.code ?? null);
              setCopied(false);
            }
          })
        }
      >
        {pending ? "Creating…" : "+ Invite partner"}
      </Button>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {code ? (
        <Notice tone="accent">
          Code <strong className="font-mono tracking-widest">{code}</strong> (valid 7 days, one use). Share the link:
          <span className="mt-1 flex flex-wrap items-center gap-2">
            <code className="break-all text-xs">{link}</code>
            <button
              className="text-xs font-medium underline"
              onClick={async () => {
                try {
                  if (navigator.share) await navigator.share({ title: "Join our household on Hearth", url: link });
                  else {
                    await navigator.clipboard.writeText(link);
                    setCopied(true);
                  }
                } catch {
                  /* share cancelled */
                }
              }}
            >
              {copied ? "Copied" : "Share / copy"}
            </button>
          </span>
        </Notice>
      ) : null}
    </div>
  );
}
