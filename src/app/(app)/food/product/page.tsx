import { getSession } from "@/lib/session";
import { ProductScanner } from "./scanner";

export const metadata = { title: "Scan a packaged food" };

export default async function ProductPage() {
  const session = await getSession();
  const people = session.members.filter((m) => session.accessTo("food_diary", m.user_id) === "write").map((m) => ({ id: m.user_id, name: m.user_id === session.userId ? `${m.display_name} (me)` : m.display_name }));
  // Packaged foods the household scanned before: one tap brings them back.
  const { data } = await session.supabase.from("custom_foods").select("name, brand, barcode").eq("household_id", session.household.id).not("barcode", "is", null).order("updated_at", { ascending: false }).limit(12);
  const recent = (data ?? []) as { name: string; brand: string | null; barcode: string }[];
  return <ProductScanner me={session.subject.user_id} people={people} recent={recent} />;
}
