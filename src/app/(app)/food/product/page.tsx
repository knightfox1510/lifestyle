import { getSession } from "@/lib/session";
import { ProductScanner } from "./scanner";

export const metadata = { title: "Scan a packaged food" };

export default async function ProductPage() {
  const session = await getSession();
  const people = session.members.filter((m) => session.accessTo("food_diary", m.user_id) === "write").map((m) => ({ id: m.user_id, name: m.user_id === session.userId ? "Me" : m.display_name }));
  return <ProductScanner me={session.subject.user_id} people={people} />;
}
