"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { generateDigestNow } from "./actions";

export function GenerateButton() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-2">
      {error ? <span className="text-sm text-danger">{error}</span> : null}
      <Button size="sm" disabled={pending} onClick={() => start(async () => { const r = await generateDigestNow(); setError(r.error ?? null); })}>
        {pending ? "Writing…" : "✨ Generate this week's"}
      </Button>
    </div>
  );
}
