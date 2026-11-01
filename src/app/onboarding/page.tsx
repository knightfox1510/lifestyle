import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { OnboardingForms } from "./forms";

export const metadata = { title: "Get started" };

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const { profile } = await getUser();
  if (profile?.active_household_id) redirect("/");
  const { code } = await searchParams;

  return (
    <main className="mx-auto max-w-lg space-y-6 p-6 pt-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Let&apos;s set up your household</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Create a household for you (and later your partner), or join one with an invite code.
        </p>
      </div>
      <OnboardingForms defaultName={profile?.display_name ?? ""} defaultCode={typeof code === "string" ? code : ""} />
    </main>
  );
}
