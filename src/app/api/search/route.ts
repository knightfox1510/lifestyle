import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

type SearchHit = { group: string; title: string; hint: string | null; href: string };

/**
 * Finds your things by name: medicines, supplements, recipes, foods, timeline
 * entries, lab tests, papers, documents, pantry and grocery items. Row-level
 * security limits it to what you can see; partner items say whose they are.
 */
export async function GET(request: Request) {
  const session = await getSession();
  const raw = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 60);
  if (raw.length < 2) return NextResponse.json({ results: [] });
  const q = `%${raw.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const on = (m: string) => session.isModuleEnabled(m);
  const nameOf = (id: string) => (id === session.userId ? null : (session.members.find((m) => m.user_id === id)?.display_name ?? null));
  const db = session.supabase;
  const none = Promise.resolve({ data: [] as never[] });

  const [meds, supps, recipes, foods, events, labs, papers, docs, pantry, groceries] = await Promise.all([
    on("medicines") ? db.from("medicines").select("id, name, strength, owner_id, active").ilike("name", q).limit(6) : none,
    on("supplements") ? db.from("supplements").select("id, name, owner_id").ilike("name", q).limit(5) : none,
    on("recipes") ? db.from("recipes").select("id, title").eq("household_id", session.household.id).ilike("title", q).limit(5) : none,
    on("food_diary") ? db.from("custom_foods").select("id, name, brand").eq("household_id", session.household.id).ilike("name", q).limit(5) : none,
    on("medical_records") ? db.from("medical_events").select("id, title, start_date, category, owner_id").ilike("title", q).order("start_date", { ascending: false }).limit(6) : none,
    on("medical_records") ? db.from("lab_results").select("marker, owner_id, test_date").ilike("marker", q).order("test_date", { ascending: false }).limit(20) : none,
    on("medical_records") ? db.from("medical_documents").select("id, title, document_date, owner_id").ilike("title", q).limit(5) : none,
    on("documents") ? db.from("documents").select("id, title, expires_on").ilike("title", q).limit(5) : none,
    on("pantry") ? db.from("pantry_items").select("id, name, quantity").eq("household_id", session.household.id).is("used_up_at", null).ilike("name", q).limit(5) : none,
    on("groceries") ? db.from("grocery_items").select("id, name, checked").eq("household_id", session.household.id).is("deleted_at", null).eq("checked", false).ilike("name", q).limit(5) : none,
  ]);

  const whose = (id: string, rest: string | null) => [nameOf(id) ? `${nameOf(id)}'s` : null, rest].filter(Boolean).join(" · ") || null;
  const results: SearchHit[] = [
    ...((meds.data ?? []) as { id: string; name: string; strength: string | null; owner_id: string; active: boolean }[]).map((m) => ({ group: "Medicines", title: m.name, hint: whose(m.owner_id, [m.strength, m.active ? null : "stopped"].filter(Boolean).join(" · ") || null), href: `/medicines/manage?edit=${m.id}` })),
    ...((supps.data ?? []) as { id: string; name: string; owner_id: string }[]).map((s) => ({ group: "Supplements", title: s.name, hint: whose(s.owner_id, null), href: "/supplements" })),
    ...((recipes.data ?? []) as { id: string; title: string }[]).map((r) => ({ group: "Recipes", title: r.title, hint: null, href: `/recipes/${r.id}` })),
    ...((foods.data ?? []) as { id: string; name: string; brand: string | null }[]).map((f) => ({ group: "My foods", title: f.name, hint: f.brand, href: "/food/foods" })),
    ...((events.data ?? []) as { id: string; title: string; start_date: string; category: string; owner_id: string }[]).map((e) => ({ group: "Medical timeline", title: e.title, hint: whose(e.owner_id, `${e.category} · ${e.start_date}`), href: `/medical?category=${e.category}` })),
    ...[...new Map(((labs.data ?? []) as { marker: string; owner_id: string; test_date: string }[]).map((l) => [`${l.owner_id}|${l.marker.toLowerCase()}`, l])).values()]
      .slice(0, 5)
      .map((l) => ({ group: "Lab tests", title: l.marker, hint: whose(l.owner_id, `latest ${l.test_date}`), href: `/medical/labs?marker=${encodeURIComponent(l.marker)}` })),
    ...((papers.data ?? []) as { id: string; title: string; document_date: string | null; owner_id: string }[]).map((p) => ({ group: "Medical papers", title: p.title, hint: whose(p.owner_id, p.document_date), href: `/medical/documents#${p.id}` })),
    ...((docs.data ?? []) as { id: string; title: string; expires_on: string | null }[]).map((d) => ({ group: "Documents", title: d.title, hint: d.expires_on ? `expires ${d.expires_on}` : null, href: "/documents" })),
    ...((pantry.data ?? []) as { id: string; name: string; quantity: string | null }[]).map((p) => ({ group: "Pantry", title: p.name, hint: p.quantity, href: "/pantry" })),
    ...((groceries.data ?? []) as { id: string; name: string }[]).map((g) => ({ group: "Grocery list", title: g.name, hint: null, href: "/groceries" })),
  ];
  return NextResponse.json({ results });
}
