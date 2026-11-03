"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Notice } from "@/components/ui";
import { createIngestToken, finishHealthConnectImport, saveHealthConnectChunk } from "./actions";
import { readExportInBrowser } from "./read-export";

export type SyncStatus = { last_run_at: string | null; last_status: string | null; last_message: string | null; last_day: string | null; days_imported: number } | null;

/** The Google Apps Script that runs in the person's own Google account every morning. */
function appsScript(origin: string, token: string) {
  return `// Hearth: daily Health Connect import.
// Finds the newest Health Connect export (.zip) in your Google Drive and
// sends it to Hearth once a day. Runs in your own Google account.
const HEARTH = "${origin}";
const TOKEN = "${token}";
const NAME_CONTAINS = "Health Connect"; // change if your export file is named differently

function syncHealthConnect() {
  const files = DriveApp.searchFiles('title contains "' + NAME_CONTAINS + '" and trashed = false');
  let newest = null;
  while (files.hasNext()) {
    const f = files.next();
    if (!/\\.zip$/i.test(f.getName())) continue;
    if (!newest || f.getLastUpdated() > newest.getLastUpdated()) newest = f;
  }
  if (!newest) { console.log("No Health Connect export found in Drive."); return; }
  // Only the file's id and a short-lived Google token are sent, not the file
  // (exports are too big for Apps Script). Hearth reads just the part it needs
  // from Drive with that token; the token expires within an hour.
  const res = UrlFetchApp.fetch(HEARTH + "/api/ingest/health-connect/process", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + TOKEN },
    payload: JSON.stringify({
      fileId: newest.getId(),
      name: newest.getName(),
      modified: newest.getLastUpdated().toISOString(),
      accessToken: ScriptApp.getOAuthToken(),
    }),
    muteHttpExceptions: true,
  });
  console.log(res.getResponseCode() + " " + res.getContentText());
}

// Run this once: it imports now and sets up the daily run (around 9 am).
function setup() {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("syncHealthConnect").timeBased().everyDays(1).atHour(9).create();
  syncHealthConnect();
}
`;
}

export function HealthConnectSync({ origin, status, tz }: { origin: string; status: SyncStatus; tz: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ tone: "accent" | "danger"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [script, setScript] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  async function upload(file: File) {
    setMsg(null);
    setBusy("Reading the export on this device…");
    try {
      // Let the label repaint before the (blocking) read starts.
      await new Promise((r) => setTimeout(r, 50));
      const summary = await readExportInBrowser(file, tz);
      const lastWeigh = [...new Map(summary.weights.map((w) => [w.day, w])).values()];
      let days = 0;
      let weights = 0;
      for (let i = 0; i < Math.max(summary.days.length, 1); i += 400) {
        setBusy(`Saving days ${i + 1}–${Math.min(i + 400, summary.days.length)} of ${summary.days.length}…`);
        const r = await saveHealthConnectChunk({ days: summary.days.slice(i, i + 400), weights: i === 0 ? lastWeigh.slice(-2000) : [], found: summary.found, missing: summary.missing });
        if (r.error) throw new Error(r.error);
        days += r.days ?? 0;
        weights += r.weights ?? 0;
      }
      const r = await finishHealthConnectImport({ file: file.name, days, weights, firstDay: summary.days[0]?.day ?? null, lastDay: summary.days.at(-1)?.day ?? null, found: summary.found });
      setMsg(r.error ? { tone: "danger", text: `${r.error} Tables in the file: ${summary.tables.slice(0, 15).join(", ") || "none"}.` } : { tone: "accent", text: r.message ?? "Imported." });
      router.refresh();
    } catch (e) {
      const m = (e as Error).message;
      setMsg({ tone: "danger", text: /memory|allocation|Array buffer/i.test(m) ? "This device ran out of memory reading the export. Use the daily Google Drive sync below, or try on a computer." : m });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {status?.last_run_at ? (
        <Notice tone={status.last_status === "error" ? "danger" : "accent"}>
          Last import {new Date(status.last_run_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}: {status.last_message}
          {status.last_day ? ` Latest day: ${status.last_day}.` : ""}
        </Notice>
      ) : null}

      <div className="space-y-2">
        <p className="text-sm font-medium">Import an export now</p>
        <p className="text-xs text-fg-muted">Pick the .zip (or the .db inside it) from Health Connect → Export data. It&apos;s read on this device and only the daily totals are saved: steps, sleep (with deep sleep), heart rate, resting heart rate, HRV, calories, workouts and weight. Big exports need a lot of memory, so a computer works best.</p>
        <label className="pressable inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2">
          📦 {busy ?? "Choose export file"}
          <input type="file" accept=".zip,.db,application/zip" className="sr-only" disabled={Boolean(busy)} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} />
        </label>
        {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Every day, automatically from Google Drive</p>
        <ol className="list-decimal space-y-1 pl-5 text-xs text-fg-muted">
          <li>On your phone, keep Health Connect&apos;s scheduled export to Google Drive switched on (daily).</li>
          <li>Tap <strong>Make my sync script</strong> below and copy it.</li>
          <li>Open <a href="https://script.google.com/home/projects/create" target="_blank" rel="noopener noreferrer" className="text-accent underline">script.google.com → New project</a> (same Google account as the Drive), delete what&apos;s there and paste.</li>
          <li>Choose the <strong>setup</strong> function and press ▶ Run. Allow access to Drive when asked (&quot;Google hasn&apos;t verified this app&quot; → Advanced → Go to project; it&apos;s your own script).</li>
          <li>Done: it imports now and then every morning around 9. Big exports take a few minutes; the result shows here (refresh the page).</li>
          <li>Already set it up before? Paste the new script over the old one and run <strong>setup</strong> again: the old one uploaded the whole file, which stops working past 50 MB.</li>
        </ol>
        <Button
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await createIngestToken("Health Connect (Google Drive)");
              if (!r.token) return setMsg({ tone: "danger", text: r.error ?? "Couldn't create a token." });
              setScript(appsScript(origin, r.token));
              setCopied(false);
            })
          }
        >
          {pending ? "…" : script ? "Make a new script (new token)" : "Make my sync script"}
        </Button>
        {script ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => { void navigator.clipboard.writeText(script); setCopied(true); }}>{copied ? "✓ Copied" : "Copy script"}</Button>
              <span className="text-xs text-fg-muted">It contains a private token: don&apos;t share it. Revoke it below any time.</span>
            </div>
            <pre className="max-h-64 overflow-auto rounded-xl bg-surface-2 p-3 text-[11px] leading-snug">{script}</pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}
