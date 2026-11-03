"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { Button, Field, Input, Select, Textarea, cx } from "@/components/ui";
import { useToast } from "@/components/toaster";
import type { ActionResult } from "@/lib/types";

export type EditValue = string | number | boolean | null;
export type EditField =
  | { name: string; label: string; type: "text" | "textarea"; maxLength?: number; required?: boolean; wide?: boolean }
  | { name: string; label: string; type: "number"; min?: number; max?: number; step?: number | "any" }
  | { name: string; label: string; type: "date" | "time" | "datetime-local" }
  | { name: string; label: string; type: "select"; options: { value: string; label: string }[]; allowEmpty?: boolean }
  | { name: string; label: string; type: "checkbox" };

/**
 * A pencil that opens the record's fields in place and saves them with the
 * given server action. Used for every logged record that has no editor of
 * its own, so anything you log can be corrected later.
 */
export function EditRecord({
  fields,
  values,
  onSave,
  label = "Edit",
  iconOnly = true,
  className,
}: {
  fields: EditField[];
  values: Record<string, EditValue>;
  onSave: (values: Record<string, EditValue>) => Promise<ActionResult>;
  label?: string;
  iconOnly?: boolean;
  className?: string;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<Record<string, EditValue>>(values);
  const [pending, start] = useTransition();
  const set = (k: string, x: EditValue) => setV({ ...v, [k]: x });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setV(values);
          setOpen(true);
        }}
        className={cx("inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs text-fg-muted hover:bg-surface-2 hover:text-fg", className)}
        aria-label={label}
        title={label}
      >
        <Pencil className="size-3.5" aria-hidden />
        {iconOnly ? null : label}
      </button>
    );
  }

  return (
    <div className={cx("w-full basis-full space-y-2 rounded-xl border border-border bg-surface-2/40 p-3", pending && "opacity-60")}>
      <div className="grid gap-2 sm:grid-cols-2">
        {fields.map((f) => {
          const val = v[f.name];
          if (f.type === "checkbox") {
            return (
              <label key={f.name} className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={Boolean(val)} onChange={(e) => set(f.name, e.target.checked)} />
                {f.label}
              </label>
            );
          }
          return (
            <Field key={f.name} label={f.label} className={f.type === "textarea" || ("wide" in f && f.wide) ? "sm:col-span-2" : undefined}>
              {f.type === "select" ? (
                <Select value={val == null ? "" : String(val)} onChange={(e) => set(f.name, e.target.value || null)}>
                  {f.allowEmpty ? <option value="">–</option> : null}
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              ) : f.type === "textarea" ? (
                <Textarea value={val == null ? "" : String(val)} maxLength={f.maxLength} onChange={(e) => set(f.name, e.target.value)} className="min-h-14" />
              ) : (
                <Input
                  type={f.type}
                  value={val == null ? "" : String(val)}
                  required={"required" in f ? f.required : undefined}
                  maxLength={"maxLength" in f ? f.maxLength : undefined}
                  min={"min" in f ? f.min : undefined}
                  max={"max" in f ? f.max : undefined}
                  step={"step" in f ? f.step : f.type === "number" ? "any" : undefined}
                  onChange={(e) => set(f.name, f.type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)}
                />
              )}
            </Field>
          );
        })}
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await onSave(v);
              if (r.error) toast(r.error, { tone: "error" });
              else {
                toast(r.message ?? "Saved.");
                setOpen(false);
              }
            })
          }
        >
          {pending ? "…" : "Save"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}
