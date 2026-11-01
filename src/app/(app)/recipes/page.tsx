import Link from "next/link";
import { getSession } from "@/lib/session";
import { Badge, Card, EmptyState, Input, buttonClass } from "@/components/ui";
import type { Recipe } from "@/lib/types";

export const metadata = { title: "Recipes" };

export default async function RecipesPage({ searchParams }: PageProps<"/recipes">) {
  const session = await getSession();
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim().slice(0, 80) : "";
  let req = session.supabase
    .from("recipes")
    .select("*")
    .eq("household_id", session.household.id)
    .order("favorite", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(200);
  if (query) req = req.ilike("title", `%${query.replace(/[%_]/g, "")}%`);
  const { data } = await req;
  const recipes = (data ?? []) as Recipe[];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <form className="flex-1">
          <Input name="q" defaultValue={query} placeholder="Search recipes" aria-label="Search recipes" />
        </form>
        <Link href="/recipes/new" className={buttonClass("primary")}>+ New recipe</Link>
        <Link href="/food/ideas" className={buttonClass("secondary")}>✨ Get ideas</Link>
      </div>
      {recipes.length === 0 ? (
        <EmptyState title={query ? "No matching recipes" : "No recipes yet"}>Add your family favourites, or save AI meal ideas you liked.</EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {recipes.map((r) => (
            <Link key={r.id} href={`/recipes/${r.id}`}>
              <Card className="h-full space-y-1.5 hover:bg-surface-2">
                <p className="font-medium">{r.favorite ? "★ " : ""}{r.title}</p>
                {r.description ? <p className="line-clamp-2 text-sm text-fg-muted">{r.description}</p> : null}
                <div className="flex flex-wrap gap-1">
                  {r.prep_minutes || r.cook_minutes ? <Badge>{(r.prep_minutes ?? 0) + (r.cook_minutes ?? 0)} min</Badge> : null}
                  {r.calories_per_serving ? <Badge tone="accent">{r.calories_per_serving} kcal</Badge> : null}
                  {r.ai_generated ? <Badge>AI</Badge> : null}
                  {r.tags.slice(0, 3).map((t) => (
                    <Badge key={t}>{t}</Badge>
                  ))}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
