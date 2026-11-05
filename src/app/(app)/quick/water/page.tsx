"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toaster";
import { logWater } from "@/lib/water-actions";
import { runOrQueue } from "@/lib/offline-queue";

/** Home-screen shortcut "+250 ml water": logs it (offline too) and opens Today. */
export default function QuickWater() {
  const router = useRouter();
  const { toast } = useToast();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void (async () => {
      try {
        const r = await runOrQueue({ kind: "water", label: "+250 ml", args: { ml: 250 } }, () => logWater(250));
        if ("queued" in r) toast("+250 ml saved offline. It syncs when you're back online.", { kind: "water" });
        else toast(r.error ?? r.message ?? "+250 ml", r.error ? { tone: "error" } : { kind: "water" });
      } finally {
        router.replace("/");
      }
    })();
  }, [router, toast]);
  return <p className="py-16 text-center text-sm text-fg-muted">💧 Logging 250 ml…</p>;
}
