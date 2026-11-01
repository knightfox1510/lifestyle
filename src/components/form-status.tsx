"use client";

import { useFormStatus } from "react-dom";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui";
import type { ActionResult } from "@/lib/types";

export function SubmitButton({ children, pendingText, ...props }: ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" pending={pending} {...props}>
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}

export function ActionMessage({ state }: { state: ActionResult | null | undefined }) {
  if (!state) return null;
  if (state.error) return <p role="alert" className="text-sm text-danger">{state.error}</p>;
  if (state.message) return <p role="status" className="text-sm text-accent">{state.message}</p>;
  return null;
}
