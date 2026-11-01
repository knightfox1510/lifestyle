"use client";

import { useActionState, useState, useTransition } from "react";
import { Button, Card, Field, Input, Notice } from "@/components/ui";
import { ActionMessage, SubmitButton } from "@/components/form-status";
import { parseWearableCsv, type DailyMetric } from "@/modules/wearables/csv";
import { createIngestToken, importRows, saveManualDay } from "./actions";

export function CsvImport() {
  const [preview, setPreview] = useState<{ name: string; kind: string; rows: DailyMetric[] }[]>([]);
  const [msg, setMsg] = useState<{ tone: "accent" | "danger"; text: string } | null>(null);
  const [pending, start] = useTransition();

  async function pick(files: FileList | null) {
    setMsg(null);
    const out: typeof preview = [];
    for (const f of Array.from(files ?? [])) {
      if (f.size > 20 * 1024 * 1024) continue;
      const { rows, kind } = parseWearableCsv(await f.text());
      out.push({ name: f.name, kind, rows });
    }
    setPreview(out);
  }

  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">Import a CSV export</h2>
      <p className="text-sm text-fg-muted">
        In the <strong>Zepp</strong> app: Profile → Settings → Account (or Privacy) → <em>Export data</em>. Unzip it and select the ACTIVITY, SLEEP and HEARTRATE_AUTO CSV files (you can pick several). Any CSV with a <code>date</code> column plus <code>steps</code>, <code>sleep_minutes</code> or <code>resting_hr</code> works too.
      </p>
      <Input type="file" accept=".csv,text/csv" multiple className="h-auto py-2" onChange={(e) => pick(e.target.files)} aria-label="CSV files" />
      {preview.length ? (
        <div className="space-y-2">
          <ul className="text-sm">
            {preview.map((p) => (
              <li key={p.name}>
                {p.rows.length ? "✓" : "✗"} {p.name}: {p.rows.length ? `${p.rows.length} days of ${p.kind} (${p.rows[0].day} → ${p.rows[p.rows.length - 1].day})` : "couldn't read this file"}
              </li>
            ))}
          </ul>
          <Button
            disabled={pending || !preview.some((p) => p.rows.length)}
            onClick={() =>
              start(async () => {
                const results = [];
                for (const p of preview.filter((x) => x.rows.length)) results.push(await importRows(p.rows));
                const err = results.find((r) => r.error);
                setMsg(err ? { tone: "danger", text: err.error! } : { tone: "accent", text: results.map((r) => r.message).join(" ") });
                if (!err) setPreview([]);
              })
            }
          >
            {pending ? "Importing…" : "Import"}
          </Button>
        </div>
      ) : null}
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
    </Card>
  );
}

export function ManualDayForm({ today }: { today: string }) {
  const [state, action] = useActionState(saveManualDay, null);
  return (
    <form action={action} className="grid grid-cols-2 gap-2 sm:grid-cols-6 sm:items-end">
      <Field label="Date"><Input name="day" type="date" defaultValue={today} max={today} required /></Field>
      <Field label="Steps"><Input name="steps" type="number" min={0} /></Field>
      <Field label="Sleep (h)"><Input name="sleep_hours" type="number" step="0.1" min={0} max={24} /></Field>
      <Field label="Resting HR"><Input name="resting_hr" type="number" min={20} max={220} /></Field>
      <Field label="Active min"><Input name="active_minutes" type="number" min={0} /></Field>
      <SubmitButton variant="secondary">Save</SubmitButton>
      <div className="col-span-2 sm:col-span-6"><ActionMessage state={state} /></div>
    </form>
  );
}

export function TokenCreator({ origin }: { origin: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const example = `curl -X POST ${origin}/api/ingest/wearable \\
  -H "Authorization: Bearer ${token ?? "<your token>"}" \\
  -H "Content-Type: application/json" \\
  -d '{"days":[{"date":"2026-11-01","steps":8123,"sleep_minutes":412,"resting_hr":61}]}'`;
  return (
    <div className="space-y-2">
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => { const r = await createIngestToken("Wearable sync"); if (r.token) setToken(r.token); else setError(r.error ?? "Failed"); })}>
        + Create sync token
      </Button>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {token ? (
        <Notice tone="accent">
          Copy this token now. It won&apos;t be shown again:
          <code className="mt-1 block break-all rounded bg-surface px-2 py-1 font-mono text-xs">{token}</code>
        </Notice>
      ) : null}
      <pre className="overflow-x-auto rounded-xl bg-surface-2 p-3 text-xs">{example}</pre>
    </div>
  );
}
