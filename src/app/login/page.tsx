import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { LogoMark } from "@/components/logo";
import { I18nProvider } from "@/lib/i18n/client";
import { getLang } from "@/lib/i18n/server";
import { makeT } from "@/lib/i18n/core";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const lang = await getLang();
  const t = makeT(lang);
  return (
    <I18nProvider lang={lang}>
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
        <div className="space-y-2 text-center">
          <LogoMark className="mx-auto size-16 drop-shadow" />
          <h1 className="text-[28px] font-semibold tracking-[-0.03em]">{t("Welcome to Hearth")}</h1>
          <p className="text-sm text-fg-muted">{t("Health, food and household life, in one place, for you and your partner.")}</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </main>
    </I18nProvider>
  );
}
