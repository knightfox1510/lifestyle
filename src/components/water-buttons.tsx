"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { logWater } from "@/lib/water-actions";

/** One-tap water logging for yourself. */
export function WaterButtons({ amounts = [250, 500] }: { amounts?: number[] }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        {amounts.map((ml) => (
          <Button
            key={ml}
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await logWater(ml);
                setMsg(r.error ?? r.message ?? null);
              })
            }
          >
            💧 +{ml} ml
          </Button>
        ))}
      </div>
      {msg ? <p className="text-xs text-fg-muted" role="status">{msg}</p> : null}
    </div>
  );
}
