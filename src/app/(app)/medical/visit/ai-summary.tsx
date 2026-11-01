"use client";

import { useState } from "react";
import { Button, Card, Notice } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

type Result = { summary: string; changes: string[]; questions: string[] };

/** Optional AI overview at the top of the visit summary (prints with the page). */
export function AiVisitSummary({ subjectId, days, reason }: { subjectId: string; days: number; reason: string }) {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/visit-summary", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subjectId, days, reason }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed");
      setResult(body as Result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!result) {
    return (
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Button size="sm" variant="secondary" onClick={run} disabled={loading}>{loading ? t("Writing…") : `✨ ${t("Add an AI overview")}`}</Button>
        <span className="text-xs text-fg-muted">{t("A short summary, what changed and questions to ask. Uses your health data.")}</span>
        {error ? <Notice tone="danger">{error}</Notice> : null}
      </div>
    );
  }
  return (
    <Card className="space-y-2 break-inside-avoid print:border-0 print:p-0">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">✨ {t("Overview")}</h3>
        <button className="text-xs text-fg-muted underline print:hidden" onClick={() => setResult(null)}>{t("Remove")}</button>
      </div>
      <p className="text-sm">{result.summary}</p>
      {result.changes.length ? (
        <div>
          <p className="text-sm font-medium">{t("What changed")}</p>
          <ul className="ml-5 list-disc text-sm">{result.changes.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </div>
      ) : null}
      {result.questions.length ? (
        <div>
          <p className="text-sm font-medium">{t("Questions to ask")}</p>
          <ul className="ml-5 list-disc text-sm">{result.questions.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </div>
      ) : null}
      <p className="text-[11px] text-fg-muted">{t("AI-written from your records; check it before sharing.")}</p>
    </Card>
  );
}
