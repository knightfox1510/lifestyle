import { getSession } from "@/lib/session";
import { MealIdeas } from "./meal-ideas";

export const metadata = { title: "Meal ideas" };

export default async function MealIdeasPage({ searchParams }: PageProps<"/food/ideas">) {
  const session = await getSession();
  const { mode } = await searchParams;
  const people = session.members.map((m) => ({ id: m.user_id, name: m.user_id === session.userId ? `${m.display_name} (me)` : m.display_name }));
  return (
    <MealIdeas
      people={people}
      defaultSubject={session.subject.user_id}
      defaultUseHealth={session.profile.ai_use_medical_history}
      defaultMode={mode === "expiring" || mode === "any" ? mode : "pantry"}
      canLog={session.accessTo("food_diary", session.subject.user_id) === "write"}
      recipesOn={session.isModuleEnabled("recipes")}
      groceriesOn={session.isModuleEnabled("groceries")}
    />
  );
}
