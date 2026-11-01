import Link from "next/link";
import { getSession } from "@/lib/session";
import { Badge, Card, EmptyState, buttonClass } from "@/components/ui";
import type { CustomFood } from "@/lib/types";
import type { Nutrients } from "@/modules/nutrition/nutrients";
import { FoodAmountLogger } from "../food-logger";
import { ManualFoodCreator } from "./manual-food";
import { deleteCustomFood } from "../actions";

export const metadata = { title: "My foods" };

const SOURCE_LABEL = { manual: "added by hand", label: "from label", openfoodfacts: "Open Food Facts", usda: "USDA" } as const;

export default async function FoodsPage() {
  const session = await getSession();
  const { data } = await session.supabase.from("custom_foods").select("*").eq("household_id", session.household.id).order("name");
  const foods = (data ?? []) as CustomFood[];
  const people = session.members.filter((m) => session.accessTo("food_diary", m.user_id) === "write").map((m) => ({ id: m.user_id, name: m.user_id === session.userId ? "Me" : m.display_name }));
  const canLog = session.accessTo("food_diary", session.subject.user_id) === "write";

  return (
    <div className="space-y-4">
      <p className="text-sm text-fg-muted">
        Foods your household uses often: packaged products (scan the barcode or label), your atta or ghee brand, homemade staples. They&apos;re matched first when AI works out a meal or recipe.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href="/food/product" className={buttonClass("primary", "sm")}>▥ Scan a packaged food</Link>
      </div>
      <ManualFoodCreator />
      {foods.length === 0 ? (
        <EmptyState title="No saved foods yet" />
      ) : (
        <ul className="space-y-2">
          {foods.map((f) => (
            <li key={f.id}>
              <Card className="space-y-2 !p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{f.name}{f.brand && !f.name.includes(f.brand) ? <span className="text-fg-muted"> · {f.brand}</span> : null}</p>
                    <p className="text-xs text-fg-muted">
                      per 100 g: {Math.round(Number(f.nutrients.calories ?? 0))} kcal · P {f.nutrients.protein_g ?? "–"} · C {f.nutrients.carbs_g ?? "–"} · F {f.nutrients.fat_g ?? "–"}
                      {f.serving_g ? ` · serving ${f.serving_label ?? `${f.serving_g} g`}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge>{SOURCE_LABEL[f.source]}</Badge>
                    {f.barcode ? <Badge>▥ {f.barcode}</Badge> : null}
                    <form action={deleteCustomFood.bind(null, f.id)}>
                      <button className="px-1 text-xs text-fg-muted hover:text-danger" aria-label={`Delete ${f.name}`}>✕</button>
                    </form>
                  </div>
                </div>
                {canLog ? (
                  <details>
                    <summary className="cursor-pointer text-sm text-accent">Log some</summary>
                    <div className="mt-2">
                      <FoodAmountLogger name={f.name} per100={f.nutrients as Nutrients} servingG={f.serving_g ? Number(f.serving_g) : null} servingLabel={f.serving_label} irritants={f.irritants} accuracy={f.source === "manual" ? "calculated" : "label"} me={session.subject.user_id} people={people} />
                    </div>
                  </details>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
