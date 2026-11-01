import { getSession } from "@/lib/session";
import { Card, EmptyState, buttonClass } from "@/components/ui";
import type { FitnessClass } from "@/lib/types";
import { DAY_LETTERS } from "@/modules/medicines/logic";
import { KIND_META } from "@/modules/fitness/meta";
import { ClassForm } from "../client";
import { deleteClass, setClassActive } from "../actions";

export const metadata = { title: "Class schedule" };

export default async function ClassesPage() {
  const session = await getSession();
  const ownerId = session.subject.user_id;
  const canWrite = session.accessTo("fitness", ownerId) === "write";
  const { data } = await session.supabase.from("fitness_classes").select("*").eq("owner_id", ownerId).order("start_time");
  const classes = (data ?? []) as FitnessClass[];

  return (
    <div className="space-y-4">
      {canWrite ? (
        <Card>
          <h2 className="mb-3 font-semibold">Add a recurring class</h2>
          <ClassForm ownerId={ownerId} />
        </Card>
      ) : null}
      {classes.length === 0 ? (
        <EmptyState title="No classes yet" />
      ) : (
        <ul className="space-y-2">
          {classes.map((c) => (
            <li key={c.id}>
              <Card className={c.active ? "" : "opacity-60"}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{KIND_META[c.kind].icon} {c.name}</p>
                    <p className="text-xs text-fg-muted">
                      {c.days_of_week.map((d) => DAY_LETTERS[d]).join(" ")} · {c.start_time} · {c.duration_minutes} min
                      {c.location ? ` · ${c.location}` : ""}
                      {c.instructor ? ` · ${c.instructor}` : ""}
                      {c.remind_minutes_before != null ? ` · reminder ${c.remind_minutes_before} min before` : ""}
                    </p>
                  </div>
                  {canWrite ? (
                    <div className="flex gap-1">
                      <form action={setClassActive.bind(null, c.id, ownerId, !c.active)}>
                        <button className={buttonClass("ghost", "sm")}>{c.active ? "Pause" : "Resume"}</button>
                      </form>
                      {ownerId === session.userId ? (
                        <form action={deleteClass.bind(null, c.id)}>
                          <button className={buttonClass("danger", "sm")}>Delete</button>
                        </form>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {canWrite ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-fg-muted">Edit</summary>
                    <div className="mt-3">
                      <ClassForm ownerId={ownerId} cls={c} />
                    </div>
                  </details>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
