import { getSession } from "@/lib/session";
import { addDays, lastNDays, shortDate, todayIn } from "@/lib/dates";
import Link from "next/link";
import { Card, buttonClass } from "@/components/ui";
import { DateJump } from "@/components/date-jump";
import { ColumnChart } from "@/components/charts";
import type { DailyCheckin } from "@/lib/types";
import { CheckinForm } from "./checkin-form";
import { SCALES } from "@/modules/checkin/meta";

export const metadata = { title: "Daily check-in" };

export default async function CheckinPage({ searchParams }: PageProps<"/checkin">) {
  const session = await getSession();
  const ownerId = session.subject.user_id;
  const today = todayIn(session.profile.timezone);
  const { date: dParam } = await searchParams;
  // Any earlier day can be filled in or corrected.
  const date = typeof dParam === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dParam) && dParam <= today ? dParam : today;
  const canWrite = session.accessTo("checkin", ownerId) === "write";
  const { data } = await session.supabase
    .from("daily_checkins")
    .select("*")
    .eq("owner_id", ownerId)
    .gte("checkin_date", date < addDays(today, -29) ? date : addDays(today, -29))
    .order("checkin_date");
  const rows = (data ?? []) as DailyCheckin[];
  const byDate = new Map(rows.map((r) => [r.checkin_date, r]));
  const days = lastNDays(today, 30);
  const last14 = days.slice(-14);
  const avg = (k: (typeof SCALES)[number]["field"]) => {
    const vals = rows.map((r) => r[k]).filter((v): v is number => v !== null);
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : "–";
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-3 flex items-center justify-between gap-2">
          <Link href={`/checkin?date=${addDays(date, -1)}`} className={buttonClass("ghost", "sm")}>← {shortDate(addDays(date, -1))}</Link>
          <DateJump date={date} today={today} basePath="/checkin" label={date === today ? "Today" : shortDate(date)} />
          {date < today ? (
            <Link href={date === addDays(today, -1) ? "/checkin" : `/checkin?date=${addDays(date, 1)}`} className={buttonClass("ghost", "sm")}>{shortDate(addDays(date, 1))} →</Link>
          ) : (
            <span className="w-20" />
          )}
        </div>
        <CheckinForm key={date} ownerId={ownerId} date={date} checkin={byDate.get(date) ?? null} canWrite={canWrite} />
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SCALES.map((s) => (
          <Card key={s.field} className="!p-3.5">
            <p className="text-xs text-fg-muted">{s.label} · 30-day avg</p>
            <p className="text-2xl font-semibold tabular-nums">{avg(s.field)}</p>
          </Card>
        ))}
      </div>

      <Card className="overflow-x-auto">
        <h2 className="mb-3 text-sm font-semibold">Last 14 days</h2>
        <table className="w-full min-w-[520px] text-center text-sm tabular-nums">
          <thead>
            <tr className="text-xs text-fg-muted">
              <th className="text-left font-medium" />
              {last14.map((d) => (
                <th key={d} className="font-normal">{shortDate(d).split(" ")[0]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SCALES.map((s) => (
              <tr key={s.field} className="border-t border-border">
                <td className="py-1.5 text-left">{s.label}</td>
                {last14.map((d) => {
                  const v = byDate.get(d)?.[s.field] ?? null;
                  return (
                    <td key={d} title={`${shortDate(d)} ${s.label}: ${v ?? "–"}`}>
                      {v === null ? <span className="text-fg-muted/40">·</span> : v}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <ColumnChart
          title="Hours slept"
          data={days.map((d) => ({ key: d, label: shortDate(d), value: Number(byDate.get(d)?.sleep_hours ?? 0), tooltip: `${shortDate(d)}: ${byDate.get(d)?.sleep_hours ?? "not logged"} h` }))}
          unit=" h"
          height={120}
        />
      </Card>
    </div>
  );
}
