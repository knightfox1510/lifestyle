import { z } from "zod";
import { getSession } from "@/lib/session";
import { AiError } from "@/lib/ai/gemini";
import { aiHandler, runJson } from "@/lib/ai/run";
import { recipeCalcSchema } from "@/lib/ai/phase2-schemas";
import { householdFoods, matchIngredient } from "@/lib/nutrition/resolve";
import { MEASURE_HINTS, STAPLES } from "@/modules/nutrition/staples";
import type { Recipe } from "@/lib/types";

/** Photo and long AI requests can take a while; allow up to a minute on Vercel. */
export const maxDuration = 60;

/** Works out grams for each recipe ingredient line and matches it to food data. */
export async function POST(request: Request) {
  return aiHandler(async () => {
    const session = await getSession();
    const { recipeId } = z.object({ recipeId: z.uuid() }).parse(await request.json());
    const { data } = await session.supabase.from("recipes").select("*").eq("id", recipeId).eq("household_id", session.household.id).maybeSingle();
    if (!data) throw new AiError("Recipe not found.", 404);
    const recipe = data as Recipe;
    if (!recipe.ingredients.length) throw new AiError("Add the ingredients first.");
    const hh = await householdFoods(session);

    const lines = recipe.ingredients.map((i, idx) => `${idx}. ${[i.quantity, i.name].filter(Boolean).join(" ")}`).join("\n");
    const result = await runJson(session, {
      feature: "recipe_calc",
      schema: recipeCalcSchema,
      parts: [
        {
          text: `Recipe: ${recipe.title} (makes ${recipe.servings} servings).
Ingredient lines:
${lines}

For each line give grams for the WHOLE recipe (raw/dry weight), and match it: staple_key if one fits, custom_food if it's one of the household's own foods, else an English 'search' term for the USDA database. Skip water and negligible whole spices (set grams 0). Estimate the total cooked weight if you reasonably can.

Built-in staples (key: name): ${STAPLES.map((s) => `${s.key}: ${s.name}`).join("; ")}
${hh.foods.length ? `Household's own foods: ${hh.foods.map((f) => f.name).join("; ")}` : ""}
${MEASURE_HINTS}`,
        },
      ],
      temperature: 0.1,
    });

    const rows = await Promise.all(
      result.ingredients.map(async (c) => {
        const m = c.grams > 0 ? await matchIngredient(session, { staple_key: c.staple_key, custom_food: c.custom_food, search: c.search, name: c.name }, hh) : null;
        return { index: c.index, grams: c.grams, ref: m?.ref ?? null, match_name: m?.name ?? null, source: m?.source ?? null, per100: m?.per100 ?? null };
      }),
    );
    return { rows, estimated_cooked_weight_g: result.estimated_cooked_weight_g, irritants: result.irritants };
  });
}
