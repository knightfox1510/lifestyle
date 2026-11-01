"use client";

import { useState } from "react";
import { Button, Card, Notice } from "@/components/ui";

export function ReportTips({ week }: { week: string }) {
  const [data, setData] = useState<{ summary: string; tips: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Card className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">✨ AI review</h2>
        <Button
          size="sm"
          variant="secondary"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            setError(null);
            try {
              const res = await fetch("/api/ai/nutrition-report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ week }) });
              const body = await res.json();
              if (!res.ok) throw new Error(body.error ?? "Failed");
              setData(body);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? "Reviewing…" : data ? "Refresh" : "Review my week"}
        </Button>
      </div>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {data ? (
        <>
          <p className="text-sm">{data.summary}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {data.tips.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </>
      ) : null}
    </Card>
  );
}
