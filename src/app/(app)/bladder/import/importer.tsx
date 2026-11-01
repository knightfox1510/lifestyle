"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Button, Card, Field, Input, Select, Textarea, cx } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import { shortDate, zonedIso } from "@/lib/dates";
import { AMOUNT_LABEL, TRIGGER_LABEL } from "@/modules/bladder/meta";
import { parseWhatsAppLeaks, type LeakAmount, type ParsedLeak, type SkippedLine } from "@/modules/bladder/whatsapp";
import { importBladderEvents, type ImportResult } from "../actions";

type Row = ParsedLeak & { id: number; on: boolean };
const AMOUNTS: LeakAmount[] = ["drops", "small", "large"];

/** Paste a WhatsApp leak log, check the preview, import. Parsing happens in the browser. */
export function WhatsAppImporter({ ownerId, ownerName, isSelf, tz, today }: { ownerId: string; ownerName: string; isSelf: boolean; tz: string; today: string }) {
  const t = useT();
  const thisYear = Number(today.slice(0, 4));
  const [chat, setChat] = useState("");
  const [year, setYear] = useState(thisYear);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [skipped, setSkipped] = useState<SkippedLine[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, start] = useTransition();

  function preview() {
    const r = parseWhatsAppLeaks(chat, { today, tz, year, ownerName: ownerName.split(" ")[0] });
    setRows(r.rows.map((x, i) => ({ ...x, id: i, on: true })));
    setSkipped(r.skipped.filter((s) => s.reason !== "Not a chat message line"));
    setResult(null);
  }

  const edit = (id: number, patch: Partial<Row>) =>
    setRows((rs) =>
      rs!.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, ...patch };
        if (patch.time) next.at = zonedIso(next.date, patch.time, tz);
        return next;
      }),
    );

  const days = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const r of rows ?? []) m.set(r.date, [...(m.get(r.date) ?? []), r]);
    return [...m.entries()];
  }, [rows]);
  const chosen = (rows ?? []).filter((r) => r.on);

  function runImport() {
    start(async () => {
      const r = await importBladderEvents(
        ownerId,
        chosen.map((x) => ({ at: x.at, amount: x.amount, triggers: x.triggers, notes: x.notes })),
      );
      setResult(r);
      if (r.ok) setRows(null);
    });
  }

  return (
    <div className="space-y-4">
      {result?.ok ? (
        <Card className="space-y-2">
          <p className="font-semibold">
            {t("Imported {n} leaks", { n: result.added ?? 0 })}
            {result.from && result.to ? ` · ${shortDate(result.from.slice(0, 10))} – ${shortDate(result.to.slice(0, 10))}` : ""}
          </p>
          {result.existing ? <p className="text-sm text-fg-muted">{t("{n} were already in the diary and were skipped.", { n: result.existing })}</p> : null}
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/bladder/trends?days=30" className="font-medium text-accent underline">{t("See the trends")}</Link>
            <Link href="/bladder" className="text-fg-muted underline">{t("Add surgery or medicine dates")}</Link>
          </div>
        </Card>
      ) : null}

      <Card className="space-y-3">
        <h2 className="font-semibold">{t("Import leaks from WhatsApp")}</h2>
        <p className="text-sm text-fg-muted">
          {t("Paste messages like “[07/10, 21:42] Name: Leak”. Times, counts (“2 times”), “less leak”, “a lot”, cough, sneeze, yoga, washroom and night leaks are understood.")}
        </p>
        {!isSelf ? <p className="text-sm">{t("Adding to {person}'s diary. Your own messages count as leaks you noted for them.", { person: ownerName })}</p> : null}
        <Field label={t("Chat")}>
          <Textarea value={chat} onChange={(e) => setChat(e.target.value)} rows={8} placeholder="[07/10, 21:42] …: Leak" className="font-mono text-[13px]" />
        </Field>
        <div className="flex flex-wrap items-end gap-3">
          <Field label={t("Year (if the dates don't have one)")}>
            <Select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {[thisYear, thisYear - 1, thisYear - 2].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </Select>
          </Field>
          <Button variant="secondary" onClick={preview} disabled={!chat.trim()}>
            {t("Preview")}
          </Button>
        </div>
        <p className="text-xs text-fg-muted">{t("Nothing is saved until you press Import.")}</p>
      </Card>

      {rows ? (
        rows.length === 0 ? (
          <Card><p className="text-sm">{t("No leaks found in that text.")}</p></Card>
        ) : (
          <Card className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{t("{n} leaks on {d} days", { n: chosen.length, d: days.length })}</p>
              <Button onClick={runImport} pending={pending} disabled={!chosen.length}>
                {t("Import {n}", { n: chosen.length })}
              </Button>
            </div>
            {result?.error ? <p role="alert" className="text-sm text-danger">{t(result.error)}</p> : null}
            <div className="space-y-2">
              {days.map(([date, list]) => {
                const on = list.filter((r) => r.on);
                return (
                  <details key={date} className="rounded-xl border border-border">
                    <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="font-medium">{shortDate(date)}</span>
                      <span className="text-fg-muted">
                        {t("{n} leaks", { n: on.length })}
                        {AMOUNTS.map((a) => {
                          const c = on.filter((r) => r.amount === a).length;
                          return c ? ` · ${c} ${t(AMOUNT_LABEL[a]).toLowerCase()}` : "";
                        }).join("")}
                      </span>
                    </summary>
                    <ul className="divide-y divide-border border-t border-border">
                      {list.map((r) => (
                        <li key={r.id} className={cx("flex flex-wrap items-center gap-2 px-3 py-2 text-sm", !r.on && "opacity-50")}>
                          <input type="checkbox" checked={r.on} onChange={(e) => edit(r.id, { on: e.target.checked })} aria-label={t("Include")} className="size-4 accent-[var(--accent)]" />
                          <Input type="time" value={r.time} onChange={(e) => e.target.value && edit(r.id, { time: e.target.value })} className="!h-8 !w-28 !px-2" aria-label={t("Time")} />
                          <Select value={r.amount} onChange={(e) => edit(r.id, { amount: e.target.value as LeakAmount })} className="!h-8 !w-28 !px-2" aria-label={t("Amount")}>
                            {AMOUNTS.map((a) => (
                              <option key={a} value={a}>{t(AMOUNT_LABEL[a])}</option>
                            ))}
                          </Select>
                          {r.triggers.map((x) => (
                            <span key={x} className="rounded-full bg-surface-2 px-2 py-0.5 text-xs">{t(TRIGGER_LABEL[x])}</span>
                          ))}
                          <span className="min-w-0 flex-1 truncate text-fg-muted" title={r.notes}>“{r.text}”</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                );
              })}
            </div>
            {skipped.length ? (
              <details className="text-sm">
                <summary className="cursor-pointer text-fg-muted">{t("{n} lines skipped", { n: skipped.length })}</summary>
                <ul className="mt-2 space-y-1">
                  {skipped.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="shrink-0 text-fg-muted">{t(s.reason)}:</span>
                      <span className="truncate">{s.line}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </Card>
        )
      ) : null}
    </div>
  );
}
