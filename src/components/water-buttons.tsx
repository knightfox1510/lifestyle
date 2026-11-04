"use client";

import { useTransition } from "react";
import { runOrQueue } from "@/lib/offline-queue";
import { useRouter } from "next/navigation";
import { Droplet } from "lucide-react";
import { Button } from "@/components/ui";
import { logWater } from "@/lib/water-actions";
import { undoQuickLog } from "@/lib/quick-actions";
import { useToast } from "@/components/toaster";

/** One-tap water logging for yourself, confirmed by a toast with Undo. */
export function WaterButtons({ amounts = [250, 500], date, ownerId }: { amounts?: number[]; /** An earlier day to log for (default today). */ date?: string; /** Whose water (default yours). */ ownerId?: string }) {
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
              const r = await runOrQueue({ kind: "water", label: `+${ml} ml`, args: { ml, day: date, ownerId } }, () => logWater(ml, date, ownerId));
              if ("queued" in r) return toast(`+${ml} ml saved offline. It syncs when you're back online.`, { kind: "water" });
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
