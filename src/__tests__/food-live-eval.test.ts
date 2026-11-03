/**
 * Live accuracy check of the whole meal pipeline: real Gemini breakdown with
 * the app's own prompt, numbers from built-in foods and dishes (as the app
 * does when there's no better match), compared with reference ranges for 20
 * everyday meals. Calls the AI, so it only runs when asked:
 *   LIVE_FOOD_EVAL=1 GEMINI_API_KEY=… npx vitest run src/__tests__/food-live-eval.test.ts
 */
import { describe, expect, it } from "vitest";
import { GoogleGenAI } from "@google/genai";
import { mealCalcSchema } from "@/lib/ai/phase2-schemas";
import { clampToSchema, toGeminiSchema } from "@/lib/ai/schemas";
import { mealCalcSystemPrompt } from "@/lib/nutrition/meal-prompt";
import { STAPLE_BY_KEY, searchStaples } from "@/modules/nutrition/staples";
import { DISH_BY_KEY, dishNutrition } from "@/modules/nutrition/dishes";
import { computeItem, type CalcItem } from "@/modules/nutrition/compute";
import { plausibleKcal } from "@/modules/nutrition/usda-rank";

// [what was eaten, min kcal, max kcal] from typical reference values.
const MEALS: [string, number, number][] = [
  ["100 g pink guava", 55, 80],
  ["2 rotis and a katori of toor dal", 290, 430],
  ["1 plate kanda poha", 220, 340],
  ["2 idlis with sambar and coconut chutney", 260, 420],
  ["1 banana", 85, 125],
  ["1 glass full cream milk", 140, 180],
  ["2 boiled eggs", 120, 170],
  ["1 cup cooked rice with a katori of rajma", 340, 470],
  ["a cup of chai with sugar", 55, 115],
  ["1 vada pav", 280, 420],
  ["10 almonds", 55, 90],
  ["100 g paneer bhurji", 150, 260],
  ["1 apple", 75, 115],
  ["1 katori plain curd", 75, 115],
  ["1 masala dosa", 250, 420],
  ["30 g oats cooked in 200 ml toned milk", 200, 270],
  ["1 tablespoon ghee", 105, 130],
  ["2 slices brown bread with 1 tbsp peanut butter", 200, 300],
  ["1 bowl moong dal khichdi", 180, 300],
  ["1 samosa", 220, 320],
];

const strongStaple = (name: string) =>
  searchStaples(name, 3).find((s) => name.toLowerCase().split(/\s+/).filter((w) => w.length > 2 && !["pink", "fresh", "raw", "ripe"].includes(w)).every((w) => `${s.name} ${s.aliases}`.toLowerCase().includes(w)));

describe.skipIf(!process.env.LIVE_FOOD_EVAL)("live food accuracy", () => {
  it("lands everyday meals in their reference ranges", async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY!.trim() });
    const system = mealCalcSystemPrompt({ foods: [], recipes: [] });
    const rows = await Promise.all(
      MEALS.map(async ([text, min, max]) => {
        const r = await ai.models.generateContent({
          model: process.env.EVAL_MODEL ?? "gemini-flash-latest",
          contents: `What I ate: ${text}`,
          config: { systemInstruction: system, responseMimeType: "application/json", responseJsonSchema: toGeminiSchema(mealCalcSchema), temperature: 0.1 },
        });
        const parsed = mealCalcSchema.parse(clampToSchema(JSON.parse(r.text!), mealCalcSchema));
        let kcal = 0;
        const how: string[] = [];
        for (const it of parsed.items) {
          const dish = it.dish_key ? DISH_BY_KEY[it.dish_key] : undefined;
          const calc: CalcItem = {
            description: it.description,
            quantity: it.quantity,
            recipe: dish ? { id: dish.key, title: dish.name, servings: it.dish_servings ?? 1, perServing: dishNutrition(dish), servingG: dish.servingG, kind: "dish" } : null,
            components: dish
              ? []
              : it.components.map((c) => {
                  const byKey = c.staple_key ? STAPLE_BY_KEY[c.staple_key] : undefined;
                  const s = byKey && plausibleKcal(byKey.per100.calories, c.kcal_per_100g, 3) ? byKey : strongStaple(c.name);
                  const ok = s && plausibleKcal(s.per100.calories, c.kcal_per_100g);
                  return { name: c.name, grams: c.grams, per100: ok ? s!.per100 : null, matchName: ok ? s!.name : null };
                }),
            estimate: it.estimate,
            irritants: [],
          };
          const out = computeItem(calc);
          kcal += out.nutrients.calories ?? 0;
          how.push(dish ? `dish ${dish.key}×${it.dish_servings ?? 1}` : `${out.accuracy}: ${calc.components.map((c) => `${c.name} ${c.grams}g`).join(", ")}`);
        }
        kcal = Math.round(kcal);
        return { text, min, max, kcal, pass: kcal >= min && kcal <= max, how: how.join(" | ") };
      }),
    );
    for (const r of rows) process.stdout.write(`\n${r.pass ? "PASS" : "MISS"} ${r.kcal} kcal (${r.min}–${r.max}) ${r.text}  ⟶ ${r.how}`);
    const passRate = rows.filter((r) => r.pass).length / rows.length;
    process.stdout.write(`\n\n${Math.round(passRate * 100)}% within range\n`);
    expect(passRate).toBeGreaterThanOrEqual(0.85);
  }, 300_000);
});
