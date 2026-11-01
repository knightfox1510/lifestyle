import Link from "next/link";
import type { AppSession } from "@/lib/session";
import type { MedicalEvent, WidgetSize } from "@/lib/types";
import { Card, cx } from "@/components/ui";
import { CATEGORY_META, formatRange } from "@/modules/medical/meta";
import { WIDGET_BY_KEY } from "@/modules/widgets";
import { QuickHealthLog } from "@/components/quick-health-log";
import { AskAiWidget } from "@/components/ask-ai-widget";
import { BladderQuickButtons, GroceryQuickAdd, QuickWeighIn } from "@/components/phase1-widgets";
import { QuickLogBox } from "@/components/quick-log-box";
import { ClassButtons } from "@/app/(app)/fitness/client";
import { KIND_META as WORKOUT_META, classesOn } from "@/modules/fitness/meta";
import { LOG_META } from "@/modules/child/vaccines";
import { totals } from "@/modules/food/meta";
import { daysUntil } from "@/modules/pantry/match";
import { byMarker, valueLabel } from "@/modules/medical/labs";
import { DoseButtons } from "@/app/(app)/medicines/dose-buttons";
import { SupplementChecklist } from "@/app/(app)/supplements/checklist";
import { CheckinForm } from "@/app/(app)/checkin/checkin-form";
import { HabitGrid } from "@/app/(app)/habits/habit-grid";
import { addDays, lastNDays, localDate, localTime, startOfLocalDayIso, todayIn } from "@/lib/dates";
import { streak } from "@/lib/streak";
import { slotsForDay, doseLabel } from "@/modules/medicines/logic";
import { dailyStats } from "@/modules/bladder/analysis";
import type { ChildLog, Dependent, FitnessClass, WorkoutLog } from "@/lib/types";
import type { BodyGoals, BodyMetric, FoodEntry, LabResult, MealPlanEntry, NutritionGoals, PantryItem, Recipe } from "@/lib/types";
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

    case "core.quick_log": {
      const canSomething = ["food_diary", "bladder_diary", "body_recomp"].some((k) => session.isModuleEnabled(k) && session.accessTo(k, subject.user_id) === "write");
      if (!canSomething) return null;
      return (
        <WidgetFrame size={size} title={isSelf ? "✨ Quick log" : `✨ Log for ${subject.display_name}`} href="/log">
          <QuickLogBox ownerId={subject.user_id} compact />
        </WidgetFrame>
      );
    }

    case "food_diary.today": {
      const access = session.accessTo("food_diary", subject.user_id);
      if (access === "none") return <NotShared size={size} title="Food" name={subject.display_name} />;
      const tz = session.profile.timezone;
      const today = todayIn(tz);
      const [{ data: f }, { data: g }] = await Promise.all([
        session.supabase.from("food_entries").select("eaten_at, calories, protein_g, carbs_g, fat_g, fiber_g").eq("owner_id", subject.user_id).gte("eaten_at", startOfLocalDayIso(today)),
        session.supabase.from("nutrition_goals").select("*").eq("owner_id", subject.user_id).maybeSingle(),
      ]);
      const t = totals(((f ?? []) as FoodEntry[]).filter((x) => localDate(x.eaten_at, tz) === today));
      const goals = g as NutritionGoals | null;
      const pct = goals?.calories ? Math.min(100, (t.calories / goals.calories) * 100) : 0;
      return (
        <WidgetFrame size={size} title="Calories today" href="/food">
          <p className="text-2xl font-semibold tabular-nums">
            {t.calories.toLocaleString("en-IN")}
            <span className="text-sm font-normal text-fg-muted">{goals?.calories ? ` / ${goals.calories.toLocaleString("en-IN")} kcal` : " kcal"}</span>
          </p>
          {goals?.calories ? (
            <div className="h-2 overflow-hidden rounded-full bg-surface-2">
              <div className={cx("h-full rounded-full", t.calories > goals.calories * 1.05 ? "bg-danger" : "bg-series-1")} style={{ width: `${pct}%` }} />
            </div>
          ) : null}
          <p className="text-xs text-fg-muted">
            Protein {t.protein_g}{goals?.protein_g ? `/${goals.protein_g}` : ""} g · Carbs {t.carbs_g} g · Fat {t.fat_g} g
          </p>
          {access === "write" ? <Link href="/food" className="text-sm font-medium text-accent hover:underline">+ Add food</Link> : null}
        </WidgetFrame>
      );
    }

    case "body_recomp.weight": {
      const access = session.accessTo("body_recomp", subject.user_id);
      if (access === "none") return <NotShared size={size} title="Weight" name={subject.display_name} />;
      const [{ data: m }, { data: g }] = await Promise.all([
        session.supabase.from("body_metrics").select("weight_kg, measured_at").eq("owner_id", subject.user_id).not("weight_kg", "is", null).order("measured_at", { ascending: false }).limit(1),
        session.supabase.from("body_goals").select("*").eq("owner_id", subject.user_id).maybeSingle(),
      ]);
      const last = ((m ?? []) as Pick<BodyMetric, "weight_kg">[])[0]?.weight_kg ?? null;
      const goals = g as BodyGoals | null;
      return (
        <WidgetFrame size={size} title="Weight" href="/body">
          <p className="text-2xl font-semibold tabular-nums">{last ?? "–"}<span className="text-sm font-normal text-fg-muted"> kg</span></p>
          {goals?.target_weight_kg && last !== null ? (
            <p className="text-xs text-fg-muted">{Math.round(Math.abs(Number(last) - Number(goals.target_weight_kg)) * 10) / 10} kg to {goals.target_weight_kg} kg</p>
          ) : null}
          {access === "write" ? <QuickWeighIn ownerId={subject.user_id} last={last === null ? null : Number(last)} /> : null}
        </WidgetFrame>
      );
    }

    case "pantry.expiring": {
      const today = todayIn(session.profile.timezone);
      const { data } = await session.supabase
        .from("pantry_items")
        .select("*")
        .eq("household_id", session.household.id)
        .is("used_up_at", null)
        .lte("expires_on", addDays(today, 3))
        .order("expires_on")
        .limit(8);
      const items = (data ?? []) as PantryItem[];
      return (
        <WidgetFrame size={size} title="Expiring soon" href="/pantry">
          {items.length ? (
            <>
              <ul className="space-y-1 text-sm">
                {items.map((i) => {
                  const d = daysUntil(i.expires_on, today)!;
                  return (
                    <li key={i.id} className="flex justify-between gap-2">
                      <span className="truncate">{i.name}</span>
                      <span className={cx("shrink-0 text-xs", d < 0 ? "text-danger" : "text-fg-muted")}>{d < 0 ? "expired" : d === 0 ? "today" : `${d}d`}</span>
                    </li>
                  );
                })}
              </ul>
              <Link href="/food/ideas?mode=expiring" className="text-sm font-medium text-accent hover:underline">✨ Cook something with these</Link>
            </>
          ) : (
            <p className="text-sm text-fg-muted">Nothing expiring in the next 3 days.</p>
          )}
        </WidgetFrame>
      );
    }

    case "recipes.today": {
      const today = todayIn(session.profile.timezone);
      const { data } = await session.supabase.from("meal_plan").select("*").eq("household_id", session.household.id).eq("plan_date", today);
      const plan = (data ?? []) as MealPlanEntry[];
      const ids = plan.map((p) => p.recipe_id).filter(Boolean) as string[];
      const { data: r } = ids.length ? await session.supabase.from("recipes").select("id, title").in("id", ids) : { data: [] };
      const titles = new Map(((r ?? []) as Pick<Recipe, "id" | "title">[]).map((x) => [x.id, x.title]));
      return (
        <WidgetFrame size={size} title="Today's meals" href="/recipes/plan">
          {plan.length ? (
            <ul className="space-y-1 text-sm">
              {plan.map((p) => (
                <li key={p.id}>
                  <span className="capitalize text-fg-muted">{p.meal}:</span>{" "}
                  {p.recipe_id ? <Link href={`/recipes/${p.recipe_id}`} className="hover:underline">{titles.get(p.recipe_id) ?? "Recipe"}</Link> : p.title}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-fg-muted">
              Nothing planned. <Link href="/food/ideas" className="text-accent hover:underline">Get ideas</Link>
            </p>
          )}
        </WidgetFrame>
      );
    }

    case "medical_records.labs": {
      if (session.accessTo("medical_records", subject.user_id) === "none") return <NotShared size={size} title="Blood work" name={subject.display_name} />;
      const { data } = await session.supabase.from("lab_results").select("*").eq("owner_id", subject.user_id).order("test_date", { ascending: false }).limit(500);
      const flagged = byMarker((data ?? []) as LabResult[]).filter((g) => g[0].flag && g[0].flag !== "normal");
      return (
        <WidgetFrame size={size} title="Blood work" href="/medical/labs">
          {(data ?? []).length === 0 ? (
            <p className="text-sm text-fg-muted">No lab results yet. Upload a report and let AI read it.</p>
          ) : flagged.length ? (
            <ul className="space-y-1 text-sm">
              {flagged.slice(0, 6).map((g) => (
                <li key={g[0].id} className="flex justify-between gap-2">
                  <span className="truncate">{g[0].flag === "low" ? "↓" : "↑"} {g[0].marker}</span>
                  <span className="shrink-0 font-medium text-danger">{valueLabel(g[0])}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm">✓ Latest results are within range.</p>
          )}
        </WidgetFrame>
      );
    }

    case "fitness.today": {
      const access = session.accessTo("fitness", subject.user_id);
      if (access === "none") return <NotShared size={size} title="Fitness" name={subject.display_name} />;
      const today = todayIn(session.profile.timezone);
      const [{ data: c }, { data: l }] = await Promise.all([
        session.supabase.from("fitness_classes").select("*").eq("owner_id", subject.user_id).eq("active", true),
        session.supabase.from("workout_logs").select("*").eq("owner_id", subject.user_id).eq("performed_on", today),
      ]);
      const classes = classesOn((c ?? []) as FitnessClass[], today);
      const logs = (l ?? []) as WorkoutLog[];
      return (
        <WidgetFrame size={size} title="Workout today" href="/fitness">
          {classes.length ? (
            <ul className="space-y-2 text-sm">
              {classes.map((cl) => {
                const log = logs.find((x) => x.class_id === cl.id);
                return (
                  <li key={cl.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <span className="mr-1.5 font-mono text-fg-muted">{cl.start_time}</span>
                      {WORKOUT_META[cl.kind].icon} {cl.name}
                    </span>
                    {access === "write" ? <ClassButtons classId={cl.id} ownerId={subject.user_id} date={today} status={log?.status ?? null} /> : log ? <span className="text-xs">{log.status}</span> : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-fg-muted">{logs.length ? `✓ ${logs.filter((x) => x.status === "done").length} workout logged today.` : "Rest day. Nothing scheduled."}</p>
          )}
        </WidgetFrame>
      );
    }

    case "child.today": {
      const tz = session.profile.timezone;
      const today = todayIn(tz);
      const { data: deps } = await session.supabase.from("dependents").select("*").eq("household_id", session.household.id).eq("kind", "child").order("created_at").limit(1);
      const dep = ((deps ?? []) as Dependent[])[0];
      if (!dep) {
        return (
          <WidgetFrame size={size} title="Child" href="/child">
            <p className="text-sm text-fg-muted">Add your child to start tracking.</p>
          </WidgetFrame>
        );
      }
      const { data } = await session.supabase.from("child_logs").select("*").eq("dependent_id", dep.id).gte("started_at", startOfLocalDayIso(addDays(today, -1))).order("started_at", { ascending: false });
      const logs = (data ?? []) as ChildLog[];
      const todays = logs.filter((x) => localDate(x.started_at, tz) === today);
      const lastFeed = logs.find((x) => x.kind === "feed");
      const lastMed = logs.find((x) => x.kind === "medicine");
      const sleeping = logs.find((x) => x.kind === "sleep" && !x.ended_at);
      return (
        <WidgetFrame size={size} title={`👶 ${dep.name}`} href={`/child?c=${dep.id}`}>
          <p className="text-sm">
            {LOG_META.feed.icon} {todays.filter((x) => x.kind === "feed").length} feeds · {LOG_META.diaper.icon} {todays.filter((x) => x.kind === "diaper").length} nappies
            {sleeping ? " · 😴 sleeping now" : ""}
          </p>
          <ul className="space-y-0.5 text-xs text-fg-muted">
            {lastFeed ? <li>Last feed {localTime(lastFeed.started_at, tz)}{lastFeed.detail ? ` · ${lastFeed.detail}` : ""}</li> : null}
            {lastMed ? <li className="text-danger">Last medicine {localTime(lastMed.started_at, tz)} · {lastMed.detail}</li> : null}
          </ul>
          <Link href={`/child?c=${dep.id}`} className="text-sm font-medium text-accent hover:underline">+ Log</Link>
        </WidgetFrame>
      );
    }

    case "core.coming_up": {
      const today = todayIn(session.profile.timezone);
      const until = addDays(today, 30);
      const on = (k: string) => session.isModuleEnabled(k);
      const [m, d, sb] = await Promise.all([
        on("maintenance") ? session.supabase.from("maintenance_tasks").select("title, next_due_on").eq("household_id", session.household.id).lte("next_due_on", until) : null,
        on("documents") ? session.supabase.from("documents").select("title, expires_on").eq("household_id", session.household.id).lte("expires_on", addDays(today, 60)) : null,
        on("subscriptions") ? session.supabase.from("subscriptions").select("name, next_renewal_on").eq("household_id", session.household.id).eq("active", true).lte("next_renewal_on", addDays(today, 7)) : null,
      ]);
      const items = [
        ...((m?.data ?? []) as { title: string; next_due_on: string }[]).map((x) => ({ icon: "🛠️", label: x.title, date: x.next_due_on, href: "/maintenance" })),
        ...((d?.data ?? []) as { title: string; expires_on: string }[]).map((x) => ({ icon: "🛂", label: `${x.title} expires`, date: x.expires_on, href: "/documents" })),
        ...((sb?.data ?? []) as { name: string; next_renewal_on: string }[]).map((x) => ({ icon: "🔁", label: `${x.name} renews`, date: x.next_renewal_on, href: "/subscriptions" })),
      ].sort((a, b) => a.date.localeCompare(b.date));
      if (!on("maintenance") && !on("documents") && !on("subscriptions")) return null;
      return (
        <WidgetFrame size={size} title="Coming up">
          {items.length ? (
            <ul className="space-y-1 text-sm">
              {items.slice(0, 6).map((x, i) => {
                const left = daysUntil(x.date, today)!;
                return (
                  <li key={i} className="flex justify-between gap-2">
                    <Link href={x.href} className="truncate hover:underline">{x.icon} {x.label}</Link>
                    <span className={cx("shrink-0 text-xs", left < 0 ? "text-danger" : "text-fg-muted")}>{left < 0 ? "overdue" : left === 0 ? "today" : `${left}d`}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-fg-muted">Nothing due in the next month.</p>
          )}
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
