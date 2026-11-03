"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Droplet } from "lucide-react";
import { Button } from "@/components/ui";
import { logWater } from "@/lib/water-actions";
import { undoQuickLog } from "@/lib/quick-actions";
import { useToast } from "@/components/toaster";

/** One-tap water logging for yourself, confirmed by a toast with Undo. */
export function WaterButtons({ amounts = [250, 500], date }: { amounts?: number[]; /** An earlier day to log for (default today). */ date?: string }) {
  const [pending, start] = useTransition();
  const { toast } = useToast();
  const router = useRouter();
  return (
    <div className="flex flex-wrap gap-2">
      {amounts.map((ml) => (
        <Button
          key={ml}
          size="sm"
          variant="soft"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await logWater(ml, date);
              if (r.error) return toast(r.error, { tone: "error" });
              toast(r.message ?? `+${ml} ml`, { undo: r.id ? () => undoQuickLog("water", r.id!).then(() => router.refresh()) : undefined });
            })
          }
        >
          <Droplet className="size-4" aria-hidden /> +{ml} ml
        </Button>
      ))}
    </div>
  );
}
