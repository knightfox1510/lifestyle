import { getSession } from "@/lib/session";
import { Scanner } from "./scanner";

export const metadata = { title: "Scan groceries" };

export default async function ScanPage() {
  const session = await getSession();
  return <Scanner pantryOn={session.isModuleEnabled("pantry")} groceriesOn={session.isModuleEnabled("groceries")} />;
}
