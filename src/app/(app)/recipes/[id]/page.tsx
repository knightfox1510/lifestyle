import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { todayIn } from "@/lib/dates";
import { Badge, Card, buttonClass } from "@/components/ui";
import type { PantryItem, Recipe } from "@/lib/types";
import { inPantry } from "@/modules/pantry/match";
import { RecipeForm } from "../recipe-form";
import { RecipeActions } from "./recipe-actions";
import { RecipeNutrition } from "./recipe-nutrition";
import { deleteRecipe, toggleFavorite } from "../actions";

export default async function RecipePage({ params, searchParams }: PageProps<"/recipes/[id]">) {
  const { id } = await params;
  const { edit } = await searchParams;
  const session = await getSession();
  const [{ data }, pantryRes] = await Promise.all([
    session.supabase.from("recipes").select("*").eq("id", id).eq("household_id", session.household.id).maybeSingle(),
    session.isModuleEnabled("pantry")
      ? session.supabase.from("pantry_items").select("name, used_up_at").eq("household_id", session.household.id).is("used_up_at", null)
      : Promise.resolve({ data: [] }),
  ]);
  if (!data) notFound();
  const recipe = data as Recipe;
  if (edit === "1") return <RecipeForm recipe={recipe} />;

  const pantry = (pantryRes.data ?? []) as Pick<PantryItem, "name" | "used_up_at">[];
  const tracked = pantry.length > 0;
  const ingredients = recipe.ingredients.map((i) => ({ ...i, have: tracked && inPantry(i.name, pantry) }));

  return (
    <div className="space-y-4">
      <Card className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-xl font-semibold">{recipe.title}</h2>
          <div className="flex gap-1">
            <form action={toggleFavorite.bind(null, recipe.id, !recipe.favorite)}>
              <button className={buttonClass("ghost", "sm")} aria-label={recipe.favorite ? "Unfavourite" : "Favourite"}>{recipe.favorite ? "★" : "☆"}</button>
            </form>
            <Link href={`/recipes/${recipe.id}?edit=1`} className={buttonClass("ghost", "sm")}>Edit</Link>
            <form action={deleteRecipe.bind(null, recipe.id)}>
              <button className={buttonClass("danger", "sm")}>Delete</button>
            </form>
          </div>
        </div>
        {recipe.description ? <p className="text-sm text-fg-muted">{recipe.description}</p> : null}
        <div className="flex flex-wrap gap-1">
          {recipe.prep_minutes != null ? <Badge>prep {recipe.prep_minutes} min</Badge> : null}
          {recipe.cook_minutes != null ? <Badge>cook {recipe.cook_minutes} min</Badge> : null}
          {recipe.calories_per_serving ? <Badge tone="accent">{recipe.calories_per_serving} kcal/serving</Badge> : null}
          {recipe.protein_g ? <Badge>P {recipe.protein_g} g</Badge> : null}
          {recipe.carbs_g ? <Badge>C {recipe.carbs_g} g</Badge> : null}
          {recipe.fat_g ? <Badge>F {recipe.fat_g} g</Badge> : null}
          {recipe.tags.map((t) => (
            <Badge key={t}>{t}</Badge>
          ))}
        </div>
        {recipe.source_url ? <a href={recipe.source_url} target="_blank" rel="noopener noreferrer" className="text-sm text-accent underline">Source</a> : null}
      </Card>

      <RecipeActions
        recipe={recipe}
        ingredients={ingredients}
        pantryTracked={tracked}
        people={session.members.filter((m) => session.accessTo("food_diary", m.user_id) === "write").map((m) => ({ id: m.user_id, name: m.user_id === session.userId ? "Me" : m.display_name }))}
        pantryOn={session.isModuleEnabled("pantry")}
        canLog={session.isModuleEnabled("food_diary")}
        groceriesOn={session.isModuleEnabled("groceries")}
        today={todayIn(session.profile.timezone)}
      />

      {recipe.ingredients.length ? <RecipeNutrition recipe={recipe} /> : null}

      {recipe.steps.length ? (
        <Card>
          <h3 className="mb-2 font-semibold">Method</h3>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            {recipe.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </Card>
      ) : null}
    </div>
  );
}
