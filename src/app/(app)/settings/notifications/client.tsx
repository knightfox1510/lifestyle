"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Button, Checkbox, Field, Input, Notice, Select } from "@/components/ui";
import { ActionMessage, SubmitButton } from "@/components/form-status";
import type { NotificationPrefs } from "@/lib/types";
import { removePushSubscription, saveNotificationPrefs, savePushSubscription, sendTestNotification } from "./actions";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type State = "checking" | "unsupported" | "ios-install" | "denied" | "off" | "on";

export function PushToggle({ vapidKey }: { vapidKey: string }) {
  const [state, setState] = useState<State>("checking");
  const [msg, setMsg] = useState<{ tone: "accent" | "danger"; text: string } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
      let next: State;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) next = ios && !standalone ? "ios-install" : "unsupported";
      else if (Notification.permission === "denied") next = "denied";
      else {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        next = sub ? "on" : "off";
      }
      if (!cancelled) setState(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setMsg(null);
    if (!vapidKey) return setMsg({ tone: "danger", text: "Push isn't configured on the server yet (NEXT_PUBLIC_VAPID_PUBLIC_KEY)." });
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setState(permission === "denied" ? "denied" : "off");
      return;
    }
    const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
    await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) });
    const res = await savePushSubscription(sub.toJSON(), navigator.userAgent);
    if (res.error) setMsg({ tone: "danger", text: res.error });
    else {
      setState("on");
      setMsg({ tone: "accent", text: res.message ?? "On." });
    }
  }

  async function disable() {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await removePushSubscription(sub.endpoint);
      await sub.unsubscribe();
    }
    setState("off");
  }

  return (
    <div className="space-y-2">
      {state === "ios-install" ? (
        <Notice>On iPhone/iPad, notifications only work once Hearth is installed: tap Share → Add to Home Screen, open it from the Home Screen, then come back here.</Notice>
      ) : state === "unsupported" ? (
        <Notice>This browser doesn&apos;t support web notifications.</Notice>
      ) : state === "denied" ? (
        <Notice tone="danger">Notifications are blocked for this site. Allow them in your browser or system settings, then reload.</Notice>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {state === "on" ? (
            <>
              <span className="text-sm">✓ Notifications are on for this device.</span>
              <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => {
                const r = await sendTestNotification();
                setMsg(r.error ? { tone: "danger", text: r.error } : { tone: "accent", text: r.message ?? "Sent." });
              })}>Send a test</Button>
              <Button size="sm" variant="ghost" onClick={() => start(disable)}>Turn off</Button>
            </>
          ) : (
            <Button onClick={() => start(enable)} disabled={pending || state === "checking"}>🔔 Turn on notifications</Button>
          )}
        </div>
      )}
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
    </div>
  );
}

export function PrefsForm({ prefs }: { prefs: NotificationPrefs | null }) {
  const [state, action] = useActionState(saveNotificationPrefs, null);
  const p = prefs ?? { medicines: true, fitness: true, expiries: true, renewals: true, maintenance: true, child: true, digest: true, occasions: true, travel: true, daily_hour: 9, quiet_start: null, quiet_end: null };
  const rows: [keyof typeof p, string, string][] = [
    ["medicines", "Medicine doses", "At each scheduled dose time"],
    ["fitness", "Classes & workouts", "Before each scheduled class"],
    ["expiries", "Food expiring", "Daily, for pantry items expiring today or tomorrow"],
    ["renewals", "Documents & subscriptions", "Passports, insurance and IDs from 60 days before expiry; subscriptions 3 days before renewal"],
    ["maintenance", "Home maintenance", "When a task is coming due"],
    ["child", "Child", "Upcoming vaccinations"],
    ["occasions", "Birthdays & anniversaries", "A few days before, and on the day"],
    ["travel", "Trips", "A week and two days before, with what's left to pack"],
    ["digest", "Weekly summary", "Sunday evening AI summary of the week"],
  ];
  return (
    <form action={action} className="space-y-4">
      <h2 className="font-semibold">What to notify me about</h2>
      <div className="space-y-2.5">
        {rows.map(([k, label, hint]) => (
          <Checkbox key={k} name={k} defaultChecked={Boolean(p[k])} label={label} hint={hint} />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Daily reminders at">
          <Select name="daily_hour" defaultValue={String(p.daily_hour)}>
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
            ))}
          </Select>
        </Field>
        <Field label="Quiet from" hint="No non-medicine notifications">
          <Input type="time" name="quiet_start" defaultValue={p.quiet_start?.slice(0, 5) ?? ""} />
        </Field>
        <Field label="Quiet until">
          <Input type="time" name="quiet_end" defaultValue={p.quiet_end?.slice(0, 5) ?? ""} />
        </Field>
      </div>
      <ActionMessage state={state} />
      <SubmitButton>Save</SubmitButton>
    </form>
  );
}
