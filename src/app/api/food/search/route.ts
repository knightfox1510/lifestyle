import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { searchFoods } from "@/lib/nutrition/resolve";

/** Food search for the calculators: your foods, recipes, built-in staples, USDA. */
export async function GET(request: Request) {
  const session = await getSession();
  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (q.trim().length < 2) return NextResponse.json({ results: [] });
  const results = await searchFoods(session, q.slice(0, 80));
  return NextResponse.json({ results });
}
