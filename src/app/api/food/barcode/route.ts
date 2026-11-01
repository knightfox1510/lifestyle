import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { parseOffProduct, type OffProduct } from "@/modules/nutrition/sources";
import type { CustomFood } from "@/lib/types";

/** Barcode lookup: the household's saved foods first, then Open Food Facts. */
export async function GET(request: Request) {
  const session = await getSession();
  const code = (new URL(request.url).searchParams.get("code") ?? "").replace(/\D/g, "");
  if (code.length < 6 || code.length > 14) return NextResponse.json({ error: "That doesn't look like a barcode." }, { status: 400 });

  const { data: mine } = await session.supabase.from("custom_foods").select("*").eq("household_id", session.household.id).eq("barcode", code).maybeSingle();
  if (mine) return NextResponse.json({ found: "saved", food: mine as CustomFood });

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,brands,serving_size,serving_quantity,nutriments,ingredients_text`, {
      headers: { "User-Agent": "Hearth household app (https://github.com/knightfox1510/lifestyle)" },
      signal: ctrl.signal,
      next: { revalidate: 86400 },
    });
    const body = (await res.json().catch(() => null)) as { status?: number; product?: OffProduct } | null;
    if (!res.ok || !body || body.status !== 1 || !body.product) return NextResponse.json({ found: "none", code });
    return NextResponse.json({ found: "openfoodfacts", code, product: parseOffProduct(body.product) });
  } catch {
    return NextResponse.json({ found: "none", code, error: "Open Food Facts didn't respond. Try the label photo instead." });
  } finally {
    clearTimeout(t);
  }
}
