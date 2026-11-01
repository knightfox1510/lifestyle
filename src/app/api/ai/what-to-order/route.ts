import { z } from "zod";
import { getSession } from "@/lib/session";
import { AiError } from "@/lib/ai/gemini";
import { aiHandler, runJson } from "@/lib/ai/run";
import { orderSuggestionSchema } from "@/lib/ai/phase2-schemas";
import { SAFETY_INSTRUCTIONS, buildAiContext } from "@/lib/ai/context";
import { personFacts } from "@/lib/ai/person-facts";
import { addDays, localDate, startOfLocalDayIso, todayIn } from "@/lib/dates";
import { totals } from "@/modules/food/meta";
import type { DiningDish, DiningOrder, DiningPlace, FoodEntry } from "@/lib/types";

const body = z.object({
  people: z.array(z.uuid()).min(1).max(6),
  notes: z.string().trim().max(400).optional(),
  budget: z.number().min(0).max(100000).nullable().optional(),
  useMedicalHistory: z.boolean().optional(),
});

export async function POST(request: Request) {
  return aiHandler(async () => {
    const session = await getSession();
    if (!session.isModuleEnabled("dining")) throw new AiError("Dining is turned off.", 403);
    const input = body.parse(await request.json());
    const people = session.members.filter((m) => input.people.includes(m.user_id));
    if (!people.length) throw new AiError("Pick who's eating.");
    const tz = session.profile.timezone;
    const today = todayIn(tz);

    const [{ data: pl }, { data: di }, { data: or }] = await Promise.all([
      session.supabase.from("dining_places").select("*").eq("household_id", session.household.id),
      session.supabase.from("dining_dishes").select("*").eq("household_id", session.household.id),
      session.supabase.from("dining_orders").select("*").eq("household_id", session.household.id).gte("ordered_on", addDays(today, -21)).order("ordered_on", { ascending: false }),
    ]);
    const places = (pl ?? []) as DiningPlace[];
    if (!places.length) throw new AiError("Add a few places you order from first.");
    const dishes = (di ?? []) as DiningDish[];
    const orders = (or ?? []) as DiningOrder[];
    const nameOf = (id: string) => session.members.find((m) => m.user_id === id)?.display_name ?? "someone";

    const vault = places
      .map((p) => {
        const list = dishes.filter((d) => d.place_id === p.id);
        return `## ${p.name}${p.cuisine ? ` (${p.cuisine})` : ""}${p.area ? `, ${p.area}` : ""} · ${p.mode}${p.favorite ? " · favourite" : ""}\n${list
          .map((d) => `- ${d.name}${d.price != null ? ` ₹${d.price}` : ""}${d.veg === true ? " [veg]" : d.veg === false ? " [non-veg]" : ""}${d.calories ? ` ~${d.calories} kcal` : ""}${d.protein_g ? `, ${d.protein_g} g protein` : ""}${d.go_to_for.length ? ` (go-to for ${d.go_to_for.map(nameOf).join(", ")})` : ""}`)
          .join("\n") || "- (no dishes saved; suggest typical dishes for this place)"}`;
      })
      .join("\n\n");

    const personBlocks = await Promise.all(
      people.map(async (p) => {
        const [ctx, facts] = await Promise.all([buildAiContext(session, { subjectId: p.user_id, useMedicalHistory: input.useMedicalHistory }), personFacts(session, p.user_id)]);
        let eaten = "";
        if (session.isModuleEnabled("food_diary") && session.accessTo("food_diary", p.user_id) !== "none") {
          const { data } = await session.supabase.from("food_entries").select("eaten_at, calories, protein_g, carbs_g, fat_g, fiber_g").eq("owner_id", p.user_id).gte("eaten_at", startOfLocalDayIso(today));
          const t = totals(((data ?? []) as FoodEntry[]).filter((e) => localDate(e.eaten_at, tz) === today));
          eaten = facts.nutrition?.calories ? `Eaten today: ${t.calories} of ${facts.nutrition.calories} kcal (${facts.nutrition.calories - t.calories} left), ${t.protein_g} g protein.` : `Eaten today: ${t.calories} kcal.`;
        }
        return { name: p.display_name, used: ctx.usedMedical, text: `### ${p.display_name}\n${eaten}\n${facts.text}\n${ctx.text}` };
      }),
    );

    const prompt = `We don't feel like cooking tonight. Suggest up to 3 takeout options from OUR saved places only, with a dish for each person that fits their remaining calories, goals, diet and health data (allergies and conditions are hard limits).
Avoid repeating what we ordered in the last few days unless it's clearly the best fit.
${input.budget ? `Budget: about ₹${input.budget} total.` : ""}
${input.notes ? `Mood / wishes: ${input.notes}` : ""}

Recent orders: ${orders.slice(0, 8).map((o) => `${o.ordered_on}: ${o.items} (${places.find((p) => p.id === o.place_id)?.name ?? "?"})`).join("; ") || "none"}

Our places and dishes:
${vault}

People eating:
${personBlocks.map((b) => b.text).join("\n\n")}`;

    const result = await runJson(session, {
      feature: "what_to_order",
      schema: orderSuggestionSchema,
      parts: [{ text: prompt }],
      system: SAFETY_INSTRUCTIONS,
      usedHealth: personBlocks.some((b) => b.used),
      temperature: 0.6,
    });
    return result;
  });
}
