import { getSession } from "@/lib/session";
import { FromPage } from "./from-page";

export const metadata = { title: "Import a menu from a web page" };

export default async function FromPagePage() {
  const session = await getSession();
  const { data } = await session.supabase.from("dining_places").select("id, name").eq("household_id", session.household.id).order("name");
  return <FromPage places={(data ?? []) as { id: string; name: string }[]} />;
}
