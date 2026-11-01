import Link from "next/link";
import { getSession } from "@/lib/session";
import { Badge, Card, EmptyState, cx } from "@/components/ui";
import { CATEGORY_META, formatDate, formatRange } from "@/modules/medical/meta";
import { MEDICAL_CATEGORIES, type MedicalCategory, type MedicalEvent } from "@/lib/types";
import { AddEventForm } from "./add-event-form";
import { deleteMedicalEvent, endMedicalEvent, setEventIncludeInAi } from "./actions";

export const metadata = { title: "Medical timeline" };

export default async function MedicalTimelinePage({ searchParams }: PageProps<"/medical">) {
  const session = await getSession();
  const ownerId = session.subject.user_id;
  const canWrite = session.accessTo("medical_records", ownerId) === "write";
  const isOwner = ownerId === session.userId;
  const { category } = await searchParams;
  const filter = MEDICAL_CATEGORIES.includes(category as MedicalCategory) ? (category as MedicalCategory) : null;

  const { data } = await session.supabase
    .from("medical_events")
    .select("*")
    .eq("owner_id", ownerId)
    .order("start_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);
  const all = (data ?? []) as MedicalEvent[];
  const events = filter ? all.filter((e) => e.category === filter) : all;
  const byId = new Map(all.map((e) => [e.id, e]));

  const today = new Date().toISOString().slice(0, 10);
  const allergies = all.filter((e) => e.category === "allergy");
  const conditions = all.filter((e) => e.category === "condition" && (e.ongoing || !e.end_date));
  const currentMeds = all.filter((e) => e.category === "medication" && (e.ongoing || (e.end_date ?? "") >= today));
  const relatable = all.filter((e) => ["illness", "condition", "symptom", "injury", "surgery"].includes(e.category)).slice(0, 50);

  const byYear = new Map<string, MedicalEvent[]>();
  for (const e of events) {
    const y = e.start_date.slice(0, 4);
    byYear.set(y, [...(byYear.get(y) ?? []), e]);
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard title="Allergies" tone="danger" items={allergies.map((e) => e.title)} empty="None recorded" />
        <SummaryCard title="Ongoing conditions" items={conditions.map((e) => e.title)} empty="None recorded" />
        <SummaryCard
          title="Current medicines"
          items={currentMeds.map((e) => [e.title, e.dosage, e.frequency].filter(Boolean).join(" · "))}
          empty="None recorded"
        />
      </div>

      {canWrite ? (
        <AddEventForm
          ownerId={ownerId}
          relatable={relatable.map((e) => ({ id: e.id, label: `${e.title} (${formatDate(e.start_date)})` }))}
        />
      ) : null}

      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        <FilterChip href="/medical" active={!filter} label="All" />
        {MEDICAL_CATEGORIES.map((c) => (
          <FilterChip
            key={c}
            href={`/medical?category=${c}`}
            active={filter === c}
            label={`${CATEGORY_META[c].icon} ${CATEGORY_META[c].label}`}
          />
        ))}
      </div>

      {events.length === 0 ? (
        <EmptyState title={filter ? "Nothing in this category yet" : "No entries yet"}>
          Add past surgeries, a recent cold, medicines you took, or upload hospital papers and let AI fill the timeline.
        </EmptyState>
      ) : (
        [...byYear.entries()].map(([year, items]) => (
          <section key={year}>
            <h2 className="mb-2 text-sm font-semibold text-fg-muted">{year}</h2>
            <ol className="relative space-y-3 border-l border-border pl-5">
              {items.map((e) => (
                <li key={e.id} className="relative">
                  <span
                    aria-hidden
                    className="absolute -left-[31px] top-3 flex size-5 items-center justify-center rounded-full bg-surface text-xs ring-1 ring-border"
                  >
                    {CATEGORY_META[e.category].icon}
                  </span>
                  <Card className="!p-3.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">{e.title}</p>
                        <p className="text-xs text-fg-muted">
                          {CATEGORY_META[e.category].label} · {formatRange(e.start_date, e.end_date, e.ongoing)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {e.severity ? <Badge tone={e.severity === "severe" ? "danger" : "warn"}>{e.severity}</Badge> : null}
                        {e.ongoing ? <Badge tone="accent">ongoing</Badge> : null}
                        {e.source === "ai_extracted" ? <Badge>from papers</Badge> : null}
                        {!e.include_in_ai ? <Badge>hidden from AI</Badge> : null}
                      </div>
                    </div>
                    {e.dosage || e.frequency ? (
                      <p className="mt-2 text-sm">💊 {[e.dosage, e.frequency].filter(Boolean).join(" · ")}</p>
                    ) : null}
                    {e.related_event_id && byId.get(e.related_event_id) ? (
                      <p className="mt-1 text-sm text-fg-muted">For: {byId.get(e.related_event_id)!.title}</p>
                    ) : null}
                    {e.details ? <p className="mt-2 whitespace-pre-line text-sm text-fg-muted">{e.details}</p> : null}
                    {e.document_id ? (
                      <Link href={`/medical/documents#${e.document_id}`} className="mt-2 inline-block text-xs text-accent underline">
                        Source document
                      </Link>
                    ) : null}
                    {canWrite ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <form action={setEventIncludeInAi.bind(null, e.id, ownerId, !e.include_in_ai)}>
                          <button className="rounded-lg px-2 py-1 text-xs text-fg-muted hover:bg-surface-2">
                            {e.include_in_ai ? "Hide from AI" : "Use in AI"}
                          </button>
                        </form>
                        {e.ongoing ? (
                          <form action={endMedicalEvent.bind(null, e.id, ownerId)}>
                            <button className="rounded-lg px-2 py-1 text-xs text-fg-muted hover:bg-surface-2">Mark ended today</button>
                          </form>
                        ) : null}
                        {isOwner ? (
                          <form action={deleteMedicalEvent.bind(null, e.id)}>
                            <button className="rounded-lg px-2 py-1 text-xs text-danger hover:bg-danger-soft">Delete</button>
                          </form>
                        ) : null}
                      </div>
                    ) : null}
                  </Card>
                </li>
              ))}
            </ol>
          </section>
        ))
      )}
    </div>
  );
}

function SummaryCard({ title, items, empty, tone }: { title: string; items: string[]; empty: string; tone?: "danger" }) {
  return (
    <Card className={cx("!p-3.5", tone === "danger" && items.length > 0 && "border-danger/40")}>
      <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{title}</p>
      {items.length ? (
        <ul className="mt-1.5 space-y-0.5 text-sm">
          {items.slice(0, 6).map((t, i) => (
            <li key={i} className="truncate">{t}</li>
          ))}
          {items.length > 6 ? <li className="text-xs text-fg-muted">+{items.length - 6} more</li> : null}
        </ul>
      ) : (
        <p className="mt-1.5 text-sm text-fg-muted">{empty}</p>
      )}
    </Card>
  );
}

function FilterChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cx(
        "whitespace-nowrap rounded-full border px-3 py-1 text-xs",
        active ? "border-accent bg-accent-soft font-medium text-accent" : "border-border text-fg-muted hover:bg-surface-2",
      )}
    >
      {label}
    </Link>
  );
}
