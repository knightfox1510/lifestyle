"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CloudOff } from "lucide-react";
import { useToast } from "@/components/toaster";
import { QUEUE_EVENT, flushQueue, readQueue } from "@/lib/offline-queue";

/** Sends taps saved offline when the connection is back, and shows how many are waiting. */
export function OfflineSync() {
  const { toast } = useToast();
  const router = useRouter();
  const [waiting, setWaiting] = useState(0);
  useEffect(() => {
    const count = () => setWaiting(readQueue().length);
    const flush = async () => {
      if (!readQueue().length) return;
      const r = await flushQueue();
      count();
      if (r.sent) {
        toast(`Synced ${r.sent} offline entr${r.sent === 1 ? "y" : "ies"}.`, { kind: "save", stamp: false });
        router.refresh();
      }
      if (r.failed.length) toast(`Couldn't sync: ${r.failed.slice(0, 2).join("; ")}`, { tone: "error" });
    };
    const t = window.setTimeout(() => {
      count();
      void flush();
    }, 0);
    window.addEventListener("online", flush);
    window.addEventListener(QUEUE_EVENT, count);
    const onVisible = () => document.visibilityState === "visible" && void flush();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("online", flush);
      window.removeEventListener(QUEUE_EVENT, count);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [toast, router]);
  if (!waiting) return null;
  return (
    <div className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+8px)] z-50 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-fg px-3 py-1.5 text-[12px] font-medium text-bg shadow-lg [animation:toast-in_.2s_ease-out]" role="status">
      <CloudOff className="size-3.5" aria-hidden /> {waiting} waiting to sync
    </div>
  );
}
