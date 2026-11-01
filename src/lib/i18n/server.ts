import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import type { AppSession } from "@/lib/session";
import { aiLanguageInstruction, isLang, LANG_COOKIE, makeT, type Lang } from "./core";

export function langOf(session: Pick<AppSession, "profile">): Lang {
  const l = (session.profile as { language?: string }).language;
  return isLang(l) ? l : "en";
}

/** Language for this request: the signed-in person's setting, else the cookie (login pages). */
export const getLang = cache(async (session?: Pick<AppSession, "profile">): Promise<Lang> => {
  if (session) return langOf(session);
  const c = (await cookies()).get(LANG_COOKIE)?.value;
  return isLang(c) ? c : "en";
});

export async function getT(session?: Pick<AppSession, "profile">) {
  return makeT(await getLang(session));
}

export function aiLanguageLine(session: Pick<AppSession, "profile">) {
  return aiLanguageInstruction(langOf(session));
}
