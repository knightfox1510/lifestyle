import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import Link from "next/link";
import { MODULES } from "@/modules/registry";
import { OnboardingForms } from "./forms";

export const metadata = { title: "Get started" };

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const { profile } = await getUser();
  const { code, new: addAnother } = await searchParams;
  if (profile?.active_household_id && !addAnother) redirect("/");

  return (
    <main className="mx-auto max-w-lg space-y-6 p-6 pt-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Let&apos;s set up your household</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Create a household for you (and later your partner), or join one with an invite code.
        </p>
      </div>
      <OnboardingForms
        defaultName={profile?.display_name ?? ""}
        defaultCode={typeof code === "string" ? code : ""}
        modules={MODULES.filter((m) => m.status === "available").map((m) => ({ key: m.key, name: m.name, icon: m.icon, group: m.group, defaultOn: m.key !== "child" }))}
      />
      {profile?.active_household_id ? (
        <p className="text-center text-sm"><Link href="/" className="text-fg-muted underline">Back to my household</Link></p>
      ) : null}
    </main>
  );
}
