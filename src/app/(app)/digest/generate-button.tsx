"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { generateDigestNow } from "./actions";

/** "Update" builds this week's summary from the numbers (free); "Write with AI" uses one AI request. */
export function GenerateButton() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (ai: boolean) => start(async () => { const r = await generateDigestNow(ai); setError(r.error ?? null); });
  return (
    <div className="flex flex-wrap items-center gap-2">
      {error ? <span className="text-sm text-danger">{error}</span> : null}
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(false)}>{pending ? "Writing…" : "Update this week's"}</Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(true)}>✨ Write with AI</Button>
    </div>
  );
}
