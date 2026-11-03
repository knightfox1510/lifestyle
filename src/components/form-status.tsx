"use client";

import { useFormStatus } from "react-dom";
import { useEffect, type ComponentProps } from "react";
import { useToast } from "@/components/toaster";
import { Button } from "@/components/ui";
import type { ActionResult } from "@/lib/types";

export function SubmitButton({ children, pendingText, ...props }: ComponentProps<typeof Button> & { pendingText?: string }) {
  const status = useFormStatus();
  // `pending` can also come from the caller (plain form posts that navigate away).
  const pending = status.pending || Boolean(props.pending);
  return (
    <Button type="submit" {...props} pending={pending}>
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}

/**
 * A form's result: shown under the form, and confirmed with a toast (with
 * an animation for the kind of thing saved) so it's clear it went through.
 */
export function ActionMessage({ state, toast: showToast = true }: { state: ActionResult | null | undefined; toast?: boolean }) {
  const { toast } = useToast();
  useEffect(() => {
    if (!showToast || !state) return;
    if (state.error) toast(state.error, { tone: "error" });
    else if (state.message || state.ok) toast(state.message ?? "Saved.");
  }, [state, showToast, toast]);
  if (!state) return null;
  if (state.error) return <p role="alert" className="text-sm text-danger [animation:fx-shake_.4s_ease-in-out]">{state.error}</p>;
  if (state.message) {
    return (
      <p role="status" className="flex items-center gap-1.5 text-sm text-accent [animation:toast-in_.25s_ease-out]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M5 12.5l4.2 4.2L19 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: 24, strokeDashoffset: 24, animation: "fx-draw .45s .05s ease-out forwards" }} />
        </svg>
        {state.message}
      </p>
    );
  }
  return null;
}
