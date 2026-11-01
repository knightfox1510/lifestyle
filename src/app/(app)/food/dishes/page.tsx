import { getSession } from "@/lib/session";
import { DISHES, dishNutrition, dishPer100 } from "@/modules/nutrition/dishes";
import { DishBrowser, type DishView } from "./dish-browser";

export const metadata = { title: "Indian dishes" };

export default async function DishesPage() {
  const session = await getSession();
  const people = session.members.filter((m) => session.accessTo("food_diary", m.user_id) === "write").map((m) => ({ id: m.user_id, name: m.user_id === session.userId ? "Me" : m.display_name }));
  const dishes: DishView[] = DISHES.map((d) => ({ key: d.key, name: d.name, aliases: d.aliases, region: d.region, serving: d.serving, servingG: d.servingG, irritants: d.irritants ?? [], perServing: dishNutrition(d), per100: dishPer100(d) }));
  return (
    <div className="space-y-4">
      <p className="text-sm text-fg-muted">
        Common home-style dishes with nutrition calculated from their ingredients (macros and micronutrients). Search by any name — “dosa”, “pohe”, “matki chi bhaji”. Home versions vary, so copy a dish to your recipes to match how you cook it.
      </p>
      <DishBrowser
        dishes={dishes}
        me={session.subject.user_id}
        people={people}
        canLog={session.accessTo("food_diary", session.subject.user_id) === "write"}
        recipesOn={session.isModuleEnabled("recipes")}
      />
    </div>
  );
}
