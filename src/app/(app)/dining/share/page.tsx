import { getSession } from "@/lib/session";
import { ShareInbox } from "./share-inbox";

export const metadata = { title: "Import shared menu" };

export default async function SharePage() {
  const session = await getSession();
  const { data } = await session.supabase.from("dining_places").select("id, name").eq("household_id", session.household.id).order("favorite", { ascending: false }).order("name");
  return <ShareInbox places={(data ?? []) as { id: string; name: string }[]} />;
}
