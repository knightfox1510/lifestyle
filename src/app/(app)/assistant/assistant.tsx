"use client";

import { useState } from "react";
import { Button, Card, Checkbox, Field, Notice, Select, Textarea } from "@/components/ui";

type Person = { id: string; name: string };

const SUGGESTIONS = [
  "Suggest a high-protein vegetarian dinner under 600 kcal.",
  "I have a cold. What should I eat and avoid at the gym this week?",
  "Plan a gentle 20-minute yoga routine for today.",
];

export function Assistant({
  people,
  defaultSubject,
  defaultUseMedical,
  defaultPrompt,
}: {
  people: Person[];
  defaultSubject: string;
  defaultUseMedical: boolean;
  defaultPrompt: string;
}) {
  const [subjectId, setSubjectId] = useState(people.some((p) => p.id === defaultSubject) ? defaultSubject : people[0]?.id);
  const [useMedical, setUseMedical] = useState(defaultUseMedical);
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [answer, setAnswer] = useState<{ text: string; usedMedical: boolean } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function call(previewOnly: boolean) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt || "preview", subjectId, useMedicalHistory: useMedical, previewOnly }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Request failed");
      if (previewOnly) setPreview(body.context);
      else setAnswer({ text: body.answer, usedMedical: body.usedMedical });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (prompt.trim()) call(false);
          }}
        >
          {people.length > 1 ? (
            <Field label="Suggestions for">
              <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field label="Your question">
            <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={4000} placeholder="Ask anything about food, fitness or routines…" />
          </Field>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" onClick={() => setPrompt(s)} className="rounded-full bg-surface-2 px-3 py-1 text-xs text-fg-muted hover:text-fg">
                {s}
              </button>
            ))}
          </div>
          {(
            <Checkbox
              checked={useMedical}
              onChange={(e) => setUseMedical(e.target.checked)}
              label="Use my health data for this question"
              hint="Medical history, medicines, supplements, diaries and check-ins. Override for this question only; change the default in Settings or hide single entries."
            />
          )}
          {error ? <Notice tone="danger">{error}</Notice> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={loading || !prompt.trim()}>{loading ? "Thinking…" : "Ask"}</Button>
            <Button type="button" variant="ghost" disabled={loading} onClick={() => call(true)}>
              What will AI see?
            </Button>
          </div>
        </form>
      </Card>

      {preview !== null ? (
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">Context sent with your question</p>
            <button className="text-xs text-fg-muted hover:text-fg" onClick={() => setPreview(null)}>Close</button>
          </div>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-surface-2 p-3 text-xs">{preview}</pre>
        </Card>
      ) : null}

      {answer ? (
        <Card>
          <p className="mb-2 text-xs text-fg-muted">
            {answer.usedMedical ? "✓ Considered health data" : "Health data not used"}
          </p>
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{answer.text}</div>
        </Card>
      ) : null}
    </div>
  );
}
