"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { useToast } from "@/components/toaster";
import type { ActionResult, MedicalEvent } from "@/lib/types";
import { AddEventForm } from "./add-event-form";
import { deleteMedicalEvent } from "./actions";

/** Delete with a confirm step (used for timeline entries and lab results). */
export function ConfirmDelete({ what, onDelete, compact }: { what: string; onDelete: () => Promise<ActionResult>; compact?: boolean }) {
  const { toast } = useToast();
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  if (!confirm) {
    return (
      <button type="button" onClick={() => setConfirm(true)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-danger hover:bg-danger-soft" aria-label={`Delete ${what}`}>
        <Trash2 className="size-3.5" aria-hidden /> {compact ? null : "Delete"}
      </button>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 rounded-lg bg-danger-soft px-2 py-1 text-xs">
      Delete {what}?
      <Button
        size="sm"
        variant="danger"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await onDelete();
            if (r.error) toast(r.error, { tone: "error" });
            else toast(r.message ?? "Deleted.");
            setConfirm(false);
          })
        }
      >
        {pending ? "…" : "Yes, delete"}
      </Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirm(false)}>
        Cancel
      </Button>
    </span>
  );
}

/** Edit / delete for a timeline entry; the edit form opens in place of the card's actions. */
export function EventActions({
  event,
  ownerId,
  relatable,
  canDelete,
  children,
}: {
  event: MedicalEvent;
  ownerId: string;
  relatable: { id: string; label: string }[];
  canDelete: boolean;
  children?: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <div className="mt-3">
        <AddEventForm ownerId={ownerId} relatable={relatable} event={event} onDone={() => setEditing(false)} />
      </div>
    );
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-fg-muted hover:bg-surface-2">
        <Pencil className="size-3.5" aria-hidden /> Edit
      </button>
      {children}
      {canDelete ? <ConfirmDelete what={`“${event.title}”`} onDelete={() => deleteMedicalEvent(event.id, ownerId)} /> : null}
    </div>
  );
}
