import { getSession } from "@/lib/session";
import { Badge, Card, buttonClass } from "@/components/ui";
import type { Medicine } from "@/lib/types";
import { DAY_LETTERS, doseLabel, refillInfo } from "@/modules/medicines/logic";
import { formatDate } from "@/modules/medical/meta";
import { MedicineForm } from "./medicine-form";
import { restockMedicine, setMedicineActive } from "../actions";
import { shortDate, todayIn } from "@/lib/dates";
import { DeleteMedicineButton } from "./delete-button";

export const metadata = { title: "Manage medicines" };

export default async function ManageMedicinesPage({ searchParams }: PageProps<"/medicines/manage">) {
  const session = await getSession();
  const ownerId = session.subject.user_id;
  const canWrite = session.accessTo("medicines", ownerId) === "write";
  const isOwner = ownerId === session.userId;
  const { edit } = await searchParams;
  const today = todayIn(session.profile.timezone);

  const { data } = await session.supabase
    .from("medicines")
    .select("*")
    .eq("owner_id", ownerId)
    .order("active", { ascending: false })
    .order("name");
  const meds = (data ?? []) as Medicine[];
  const editing = typeof edit === "string" ? meds.find((m) => m.id === edit) : undefined;

  return (
    <div className="space-y-4">
      {canWrite ? (
        <MedicineForm
          key={editing?.id ?? "new"}
          ownerId={ownerId}
          medicine={editing}
          today={today}
          timelineAvailable={session.isModuleEnabled("medical_records")}
        />
      ) : null}

      <ul className="space-y-3">
        {meds.map((m) => {
          const r = refillInfo(m);
          return (
            <li key={m.id}>
              <Card className={m.active ? "" : "opacity-70"}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {m.name} {m.strength ? <span className="text-fg-muted">{m.strength}</span> : null}
                    </p>
                    <p className="text-xs text-fg-muted">
                      {doseLabel(m)} · {m.times.length ? m.times.join(", ") : "as needed"}
                      {m.days_of_week ? ` · ${m.days_of_week.map((d) => DAY_LETTERS[d]).join(" ")}` : ""}
                      {m.end_date ? ` · until ${formatDate(m.end_date)}` : ""}
                    </p>
                    {m.reason || m.prescribed_by ? (
                      <p className="text-xs text-fg-muted">{[m.reason && `For ${m.reason}`, m.prescribed_by && `Dr: ${m.prescribed_by}`].filter(Boolean).join(" · ")}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {!m.active ? <Badge>stopped</Badge> : m.start_date > today ? <Badge tone="accent">starts {shortDate(m.start_date)}</Badge> : m.end_date && m.end_date < today ? <Badge>ended</Badge> : null}
                    {r ? <Badge tone={r.low ? "danger" : "neutral"}>{r.stock} in stock{r.daysLeft !== null ? ` · ~${r.daysLeft}d` : ""}</Badge> : null}
                    {!m.include_in_ai ? <Badge>hidden from AI</Badge> : null}
                  </div>
                </div>
                {canWrite ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <a href={`/medicines/manage?edit=${m.id}`} className={buttonClass("secondary", "sm")}>Edit</a>
                    {m.stock_count !== null ? (
                      <form action={restockMedicine.bind(null, m.id, ownerId)} className="flex items-center gap-1">
                        <input name="amount" type="number" min={1} max={10000} placeholder="+qty" aria-label="Restock quantity" className="h-8 w-20 rounded-lg border border-border bg-surface px-2 text-sm" />
                        <button className={buttonClass("ghost", "sm")}>Restock</button>
                      </form>
                    ) : null}
                    <form action={setMedicineActive.bind(null, m.id, ownerId, !m.active)}>
                      <button className={buttonClass("ghost", "sm")}>{m.active ? "Stop" : "Resume"}</button>
                    </form>
                    {isOwner || m.created_by === session.userId ? <DeleteMedicineButton id={m.id} ownerId={ownerId} name={m.name} /> : null}
                  </div>
                ) : null}
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
