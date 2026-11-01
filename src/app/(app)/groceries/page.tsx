import { getSession } from "@/lib/session";
import type { GroceryItem } from "@/lib/types";
import Link from "next/link";
import { buttonClass } from "@/components/ui";
import { GroceryList } from "./grocery-list";

export const metadata = { title: "Grocery list" };

/** Checked-off/removed items stay visible for a week so partners see what was bought. */
function recentCutoff() {
  return new Date(Date.now() - 7 * 86400_000).toISOString();
}

export default async function GroceriesPage() {
  const session = await getSession();
  const since = recentCutoff();
  const { data } = await session.supabase
    .from("grocery_items")
    .select("*")
    .eq("household_id", session.household.id)
    .or(`deleted_at.is.null,updated_at.gt.${since}`)
    .order("created_at");

  return (
    <>
    {session.isModuleEnabled("pantry") ? (
      <div className="mb-3 flex flex-wrap gap-2">
        <Link href="/pantry/scan" className={buttonClass("secondary", "sm")}>📷 Scan a list or receipt</Link>
        {session.isModuleEnabled("recipes") ? <Link href="/recipes/plan" className={buttonClass("ghost", "sm")}>From this week&apos;s meal plan</Link> : null}
      </div>
    ) : null}
    <GroceryList
      householdId={session.household.id}
      userId={session.userId}
      initialItems={(data ?? []) as GroceryItem[]}
      names={Object.fromEntries(session.members.map((m) => [m.user_id, m.display_name]))}
    />
    </>
  );
}
