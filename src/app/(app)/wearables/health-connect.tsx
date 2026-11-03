"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Notice } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { createIngestToken, importHealthConnectUpload, prepareHealthConnectUpload } from "./actions";

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
  const meta = { name: newest.getName(), modified: newest.getLastUpdated().toISOString() };
  const auth = { Authorization: "Bearer " + TOKEN };
  const step1 = JSON.parse(UrlFetchApp.fetch(HEARTH + "/api/ingest/health-connect/upload-url", {
    method: "post", contentType: "application/json", headers: auth, payload: JSON.stringify(meta), muteHttpExceptions: true,
  }).getContentText());
  if (step1.skip) { console.log(step1.reason); return; }
  if (!step1.url) { console.log("Hearth said: " + JSON.stringify(step1)); return; }
  UrlFetchApp.fetch(step1.url, { method: "put", contentType: "application/zip", payload: newest.getBlob().getBytes(), muteHttpExceptions: true });
  const step2 = UrlFetchApp.fetch(HEARTH + "/api/ingest/health-connect/process", {
    method: "post", contentType: "application/json", headers: auth, payload: JSON.stringify(Object.assign({ path: step1.path }, meta)), muteHttpExceptions: true,
  });
  console.log(step2.getContentText());
}

// Run this once: it imports now and sets up the daily run (around 9 am).
function setup() {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("syncHealthConnect").timeBased().everyDays(1).atHour(9).create();
  syncHealthConnect();
}
`;
}

export function HealthConnectSync({ origin, status }: { origin: string; status: SyncStatus }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ tone: "accent" | "danger"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [script, setScript] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  async function upload(file: File) {
    setMsg(null);
    setBusy("Uploading…");
    try {
      const prep = await prepareHealthConnectUpload();
      if (!prep.path || !prep.token) throw new Error(prep.error ?? "Couldn't prepare the upload.");
      const { error } = await createClient().storage.from("health-imports").uploadToSignedUrl(prep.path, prep.token, file, { contentType: "application/zip" });
      if (error) throw new Error(`Upload failed: ${error.message}`);
      setBusy("Reading the export… (large exports take a minute)");
      const r = await importHealthConnectUpload(prep.path, file.name);
      setMsg(r.error ? { tone: "danger", text: r.error } : { tone: "accent", text: r.message ?? "Imported." });
      router.refresh();
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
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
        <p className="text-xs text-fg-muted">Pick the .zip (or the .db inside it) from Health Connect → Export data. Steps, sleep (with deep sleep), heart rate, resting heart rate, HRV, calories, workouts and weight are read.</p>
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
          <li>Done: it imports now and then every morning around 9. The result shows here.</li>
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
