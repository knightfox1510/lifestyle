"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { LANG_META, makeT, type Lang, type T } from "./core";

const Ctx = createContext<Lang>("en");

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <Ctx.Provider value={lang}>{children}</Ctx.Provider>;
}

export function useLang(): Lang {
  return useContext(Ctx);
}

export function useT(): T {
  const lang = useContext(Ctx);
  return useMemo(() => makeT(lang), [lang]);
}

/** Speech-recognition language for voice input. */
export function useSpeechLang() {
  return LANG_META[useContext(Ctx)].speech;
}
