import { getSession } from "@/lib/session";
import type { GroceryItem } from "@/lib/types";
import Link from "next/link";
import { buttonClass } from "@/components/ui";
import { GroceryList } from "./grocery-list";
import { RunningOut } from "./running-out";

export const metadata = { title: "Grocery list" };

/** Checked-off/removed items stay visible for a week so partners see what was bought. */
function recentCutoff() {
  return new Date(Date.now() - 7 * 86400_000).toISOString();
}

export default async function GroceriesPage() {
  const session = await getSession();
  const since = recentCutoff();
  const pantryOn = session.isModuleEnabled("pantry");
  const [{ data }, pantry] = await Promise.all([
    session.supabase
      .from("grocery_items")
      .select("*")
      .eq("household_id", session.household.id)
      .or(`deleted_at.is.null,updated_at.gt.${since}`)
      .order("created_at"),
    pantryOn
      ? session.supabase.from("pantry_items").select("id, name, staple, running_low").eq("household_id", session.household.id).is("used_up_at", null).is("recipe_id", null).order("name").limit(400)
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <>
    {session.isModuleEnabled("pantry") ? (
      <div className="mb-3 flex flex-wrap gap-2">
        <Link href="/pantry/scan" className={buttonClass("secondary", "sm")}>📷 Scan a list or receipt</Link>
        {session.isModuleEnabled("food_diary") ? <Link href="/food/plan" className={buttonClass("ghost", "sm")}>From this week&apos;s meal plan</Link> : null}
      </div>
    ) : null}
    {pantryOn ? (
      <div className="mb-3">
        <RunningOut items={((pantry.data ?? []) as { id: string; name: string; staple?: boolean; running_low?: boolean }[]).map((p) => ({ id: p.id, name: p.name, staple: Boolean(p.staple), running_low: Boolean(p.running_low) }))} />
      </div>
    ) : null}
    <GroceryList
      pantryOn={pantryOn}
      householdId={session.household.id}
      userId={session.userId}
      initialItems={(data ?? []) as GroceryItem[]}
      names={Object.fromEntries(session.members.map((m) => [m.user_id, m.display_name]))}
    />
    </>
  );
}
