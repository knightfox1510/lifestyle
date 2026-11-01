import { getSession } from "@/lib/session";
import { Card } from "@/components/ui";
import type { NutritionGoals } from "@/lib/types";
import { personFacts } from "@/lib/ai/person-facts";
import { GoalsForm } from "./goals-form";

export const metadata = { title: "Nutrition goals" };

export default async function GoalsPage() {
  const session = await getSession();
  const ownerId = session.subject.user_id;
  const canWrite = session.accessTo("food_diary", ownerId) === "write";
  const facts = await personFacts(session, ownerId);
  return (
    <div className="space-y-4">
      <Card>
        <GoalsForm
          ownerId={ownerId}
          goals={facts.nutrition as NutritionGoals | null}
          canWrite={canWrite}
          maintenance={facts.maintenance}
          weight={facts.weight}
          defaultUseHealth={session.profile.ai_use_medical_history}
        />
      </Card>
    </div>
  );
}
