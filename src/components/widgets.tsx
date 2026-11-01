import Link from "next/link";
import type { AppSession } from "@/lib/session";
import type { MedicalEvent, WidgetSize } from "@/lib/types";
import { Card, cx } from "@/components/ui";
import { CATEGORY_META, formatRange } from "@/modules/medical/meta";
import { WIDGET_BY_KEY } from "@/modules/widgets";
import { QuickHealthLog } from "@/components/quick-health-log";
import { AskAiWidget } from "@/components/ask-ai-widget";
import { BladderQuickButtons, GroceryQuickAdd } from "@/components/phase1-widgets";
import { DoseButtons } from "@/app/(app)/medicines/dose-buttons";
import { SupplementChecklist } from "@/app/(app)/supplements/checklist";
import { CheckinForm } from "@/app/(app)/checkin/checkin-form";
import { HabitGrid } from "@/app/(app)/habits/habit-grid";
import { addDays, lastNDays, localDate, localTime, startOfLocalDayIso, todayIn } from "@/lib/dates";
import { streak } from "@/lib/streak";
import { slotsForDay, doseLabel } from "@/modules/medicines/logic";
import { dailyStats } from "@/modules/bladder/analysis";
import type { BladderEvent, DailyCheckin, FluidIntake, GroceryItem, Habit, HabitLog, Medicine, MedicineDose, PelvicFloorSession, Supplement } from "@/lib/types";

const span: Record<WidgetSize, string> = {
  sm: "col-span-1",
  md: "col-span-2 md:col-span-2",
  lg: "col-span-2 md:col-span-4",
};

export function WidgetFrame({ size, title, href, children }: { size: WidgetSize; title: string; href?: string; children: React.ReactNode }) {
  return (
    <Card className={cx(span[size], "flex min-w-0 flex-col gap-3")}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {href ? (
          <Link href={href} className="text-xs text-accent hover:underline">
            Open
          </Link>
        ) : null}
      </div>
      {children}
    </Card>
  );
}

export async function Widget({ widgetKey, size, session }: { widgetKey: string; size: WidgetSize; session: AppSession }) {
  const def = WIDGET_BY_KEY[widgetKey];
  if (!def) return null;
  if (def.module && !session.isModuleEnabled(def.module)) return null;
  const subject = session.subject;
  const isSelf = subject.user_id === session.userId;

  switch (widgetKey) {
    case "core.today": {
      const now = new Date();
      const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: session.profile.timezone }).format(now));
      const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
      return (
        <WidgetFrame size={size} title="Today">
          <div>
            <p className="text-xl font-semibold">
              {greeting}, {session.me.display_name}
            </p>
            <p className="text-sm text-fg-muted">
              {now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: session.profile.timezone })}
              {!isSelf ? ` · viewing ${subject.display_name}'s shared data` : ""}
            </p>
          </div>
        </WidgetFrame>
      );
    }

    case "core.ask_ai":
      return (
        <WidgetFrame size={size} title="✨ Ask AI" href="/assistant">
          <AskAiWidget />
        </WidgetFrame>
      );

    case "core.household": {
      const sharedOut = session.shares.filter((s) => s.owner_id === session.userId).length;
      const sharedIn = session.shares.filter((s) => s.grantee_id === session.userId).length;
      return (
        <WidgetFrame size={size} title="Household" href="/settings/household">
          <p className="text-sm">
            {session.household.name} · {session.members.map((m) => m.display_name).join(" & ")}
          </p>
          <p className="text-xs text-fg-muted">
            {session.partner
              ? `You share ${sharedOut} feature${sharedOut === 1 ? "" : "s"}; ${session.partner.display_name} shares ${sharedIn} with you.`
              : "Invite your partner to share and see each other's updates."}
          </p>
        </WidgetFrame>
      );
    }

    case "medical_records.timeline": {
      const access = session.accessTo("medical_records", subject.user_id);
      if (access === "none") {
        return (
          <WidgetFrame size={size} title="Health timeline">
            <p className="text-sm text-fg-muted">{subject.display_name} hasn&apos;t shared medical records.</p>
          </WidgetFrame>
        );
      }
      const { data } = await session.supabase
        .from("medical_events")
        .select("*")
        .eq("owner_id", subject.user_id)
        .order("start_date", { ascending: false })
        .limit(5);
      const events = (data ?? []) as MedicalEvent[];
      return (
        <WidgetFrame size={size} title={isSelf ? "Health timeline" : `${subject.display_name}'s health`} href="/medical">
          {events.length ? (
            <ul className="space-y-1.5 text-sm">
              {events.map((e) => (
                <li key={e.id} className="flex items-baseline justify-between gap-2">
                  <span className="truncate">
                    {CATEGORY_META[e.category].icon} {e.title}
                  </span>
                  <span className="shrink-0 text-xs text-fg-muted">{formatRange(e.start_date, e.end_date, e.ongoing)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-fg-muted">Nothing logged yet.</p>
          )}
        </WidgetFrame>
      );
    }

    case "medical_records.quick_log": {
      const canWrite = session.accessTo("medical_records", subject.user_id) === "write";
      return (
        <WidgetFrame size={size} title={isSelf ? "Quick health log" : `Log for ${subject.display_name}`}>
          {canWrite ? (
            <QuickHealthLog ownerId={subject.user_id} />
          ) : (
            <p className="text-sm text-fg-muted">You can&apos;t add entries for {subject.display_name}.</p>
          )}
        </WidgetFrame>
      );
    }

    case "medicines.today": {
      const access = session.accessTo("medicines", subject.user_id);
      if (access === "none") return <NotShared size={size} title="Medicines" name={subject.display_name} />;
      const tz = session.profile.timezone;
      const today = todayIn(tz);
      const [{ data: m }, { data: d }] = await Promise.all([
        session.supabase.from("medicines").select("*").eq("owner_id", subject.user_id).eq("active", true),
        session.supabase.from("medicine_doses").select("*").eq("owner_id", subject.user_id).eq("scheduled_date", today),
      ]);
      const slots = slotsForDay((m ?? []) as Medicine[], (d ?? []) as MedicineDose[], today);
      const open = slots.filter((x) => !x.dose);
      const now = localTime(new Date(), tz);
      return (
        <WidgetFrame size={size} title={isSelf ? "Medicines due" : `${subject.display_name}'s medicines`} href="/medicines">
          {slots.length === 0 ? (
            <p className="text-sm text-fg-muted">Nothing scheduled today.</p>
          ) : open.length === 0 ? (
            <p className="text-sm">✓ All {slots.length} doses done today.</p>
          ) : (
            <ul className="space-y-2">
              {open.slice(0, 4).map((x) => (
                <li key={`${x.medicine.id}-${x.time}`} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">
                    <span className={cx("mr-1.5 font-mono", x.time < now ? "text-danger" : "text-fg-muted")}>{x.time}</span>
                    {x.medicine.name} <span className="text-xs text-fg-muted">{doseLabel(x.medicine)}</span>
                  </span>
                  {access === "write" ? <DoseButtons medicineId={x.medicine.id} ownerId={subject.user_id} date={today} time={x.time} doseId={null} /> : null}
                </li>
              ))}
              {open.length > 4 ? <li className="text-xs text-fg-muted">+{open.length - 4} more</li> : null}
            </ul>
          )}
        </WidgetFrame>
      );
    }

    case "supplements.today": {
      const access = session.accessTo("supplements", subject.user_id);
      if (access === "none") return <NotShared size={size} title="Supplements" name={subject.display_name} />;
      const today = todayIn(session.profile.timezone);
      const [{ data: s }, { data: l }] = await Promise.all([
        session.supabase.from("supplements").select("*").eq("owner_id", subject.user_id).eq("active", true).order("sort"),
        session.supabase.from("supplement_logs").select("supplement_id").eq("owner_id", subject.user_id).eq("log_date", today),
      ]);
      const sups = (s ?? []) as Supplement[];
      return (
        <WidgetFrame size={size} title="Supplements" href="/supplements">
          {sups.length ? (
            <SupplementChecklist
              supplements={sups}
              takenIds={(l ?? []).map((x: { supplement_id: string }) => x.supplement_id)}
              ownerId={subject.user_id}
              date={today}
              canWrite={access === "write"}
              grouped={false}
            />
          ) : (
            <p className="text-sm text-fg-muted">No supplements set up.</p>
          )}
        </WidgetFrame>
      );
    }

    case "bladder_diary.quick": {
      const access = session.accessTo("bladder_diary", subject.user_id);
      if (access === "none") return <NotShared size={size} title="Bladder diary" name={subject.display_name} />;
      const tz = session.profile.timezone;
      const today = todayIn(tz);
      const from = startOfLocalDayIso(today);
      const [{ data: e }, { data: f }] = await Promise.all([
        session.supabase.from("bladder_events").select("*").eq("owner_id", subject.user_id).gte("occurred_at", from),
        session.supabase.from("fluid_intake").select("*").eq("owner_id", subject.user_id).gte("occurred_at", from),
      ]);
      const [stats] = dailyStats([today], (e ?? []) as BladderEvent[], (f ?? []) as FluidIntake[], tz);
      return (
        <WidgetFrame size={size} title="Bladder diary" href="/bladder">
          {access === "write" ? (
            <BladderQuickButtons ownerId={subject.user_id} counts={stats} />
          ) : (
            <p className="text-sm">Today: {stats.leaks} leaks · {stats.voids} bathroom · {stats.fluidMl} ml</p>
          )}
        </WidgetFrame>
      );
    }

    case "checkin.today": {
      const access = session.accessTo("checkin", subject.user_id);
      if (access === "none") return <NotShared size={size} title="Check-in" name={subject.display_name} />;
      const today = todayIn(session.profile.timezone);
      const { data } = await session.supabase.from("daily_checkins").select("*").eq("owner_id", subject.user_id).eq("checkin_date", today).maybeSingle();
      return (
        <WidgetFrame size={size} title="How are you today?" href="/checkin">
          <CheckinForm key={today} ownerId={subject.user_id} date={today} checkin={data as DailyCheckin | null} compact canWrite={access === "write"} />
        </WidgetFrame>
      );
    }

    case "habits.today": {
      const access = session.accessTo("habits", subject.user_id);
      if (access === "none") return <NotShared size={size} title="Habits" name={subject.display_name} />;
      const today = todayIn(session.profile.timezone);
      const [{ data: h }, { data: l }] = await Promise.all([
        session.supabase.from("habits").select("*").eq("owner_id", subject.user_id).eq("active", true).order("sort"),
        session.supabase.from("habit_logs").select("*").eq("owner_id", subject.user_id).eq("log_date", today),
      ]);
      const habits = (h ?? []) as Habit[];
      return (
        <WidgetFrame size={size} title="Today's habits" href="/habits">
          {habits.length ? (
            <HabitGrid
              habits={habits}
              done={((l ?? []) as HabitLog[]).map((x) => `${x.habit_id}|${x.log_date}`)}
              days={[today]}
              dayLabels={["Today"]}
              ownerId={subject.user_id}
              canWrite={access === "write"}
            />
          ) : (
            <p className="text-sm text-fg-muted">No habits yet.</p>
          )}
        </WidgetFrame>
      );
    }

    case "pelvic_floor.today": {
      const access = session.accessTo("pelvic_floor", subject.user_id);
      if (access === "none") return <NotShared size={size} title="Pelvic floor" name={subject.display_name} />;
      const tz = session.profile.timezone;
      const today = todayIn(tz);
      const { data } = await session.supabase
        .from("pelvic_floor_sessions")
        .select("performed_at, completed")
        .eq("owner_id", subject.user_id)
        .gte("performed_at", startOfLocalDayIso(addDays(today, -60)));
      const days = ((data ?? []) as Pick<PelvicFloorSession, "performed_at" | "completed">[]).filter((x) => x.completed).map((x) => localDate(x.performed_at, tz));
      const todayCount = days.filter((d) => d === today).length;
      return (
        <WidgetFrame size={size} title="Pelvic floor" href="/pelvic-floor">
          <p className="text-2xl font-semibold">
            {todayCount}
            <span className="text-sm font-normal text-fg-muted"> / 3 today</span>
          </p>
          <p className="text-xs text-fg-muted">Streak: {streak(new Set(days), today)} days · {lastNDays(today, 7).filter((d) => days.includes(d)).length}/7 days this week</p>
          {access === "write" ? (
            <Link href="/pelvic-floor" className="text-sm font-medium text-accent hover:underline">▶ Start a session</Link>
          ) : null}
        </WidgetFrame>
      );
    }

    case "groceries.list": {
      const { data } = await session.supabase
        .from("grocery_items")
        .select("*")
        .eq("household_id", session.household.id)
        .is("deleted_at", null)
        .eq("checked", false)
        .order("created_at")
        .limit(50);
      const items = (data ?? []) as GroceryItem[];
      return (
        <WidgetFrame size={size} title={`Grocery list · ${items.length}`} href="/groceries">
          {items.length ? (
            <p className="line-clamp-2 text-sm">{items.map((i) => i.name).join(", ")}</p>
          ) : (
            <p className="text-sm text-fg-muted">Nothing to buy.</p>
          )}
          <GroceryQuickAdd />
        </WidgetFrame>
      );
    }

    default:
      return null;
  }
}

function NotShared({ size, title, name }: { size: WidgetSize; title: string; name: string }) {
  return (
    <WidgetFrame size={size} title={title}>
      <p className="text-sm text-fg-muted">{name} hasn&apos;t shared this with you.</p>
    </WidgetFrame>
  );
}
