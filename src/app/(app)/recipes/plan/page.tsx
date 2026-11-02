import { redirect } from "next/navigation";

/** The meal plan now lives in Food → Week plan (it starts on your shopping day and learns your usual meals). */
export default async function OldMealPlanPage({ searchParams }: PageProps<"/recipes/plan">) {
  const { week } = await searchParams;
  redirect(typeof week === "string" ? `/food/plan?week=${week}` : "/food/plan");
}
