import { PHRASES } from "./phrases";

export const LANGS = ["en", "hi", "mr"] as const;
export type Lang = (typeof LANGS)[number];

export const LANG_META: Record<Lang, { label: string; native: string; speech: string; locale: string }> = {
  en: { label: "English", native: "English", speech: "en-IN", locale: "en-IN" },
  hi: { label: "Hindi", native: "हिन्दी", speech: "hi-IN", locale: "hi-IN" },
  mr: { label: "Marathi", native: "मराठी", speech: "mr-IN", locale: "mr-IN" },
};

export const LANG_COOKIE = "hearth_lang";

export function isLang(v: unknown): v is Lang {
  return typeof v === "string" && (LANGS as readonly string[]).includes(v);
}

/**
 * gettext-style translation: the English text is the key. Missing
 * translations fall back to English, so screens never break.
 * `{name}` placeholders are filled from vars.
 */
export function translate(lang: Lang, text: string, vars?: Record<string, string | number>): string {
  const out = lang === "en" ? text : (PHRASES[text]?.[lang] ?? text);
  return vars ? out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : out;
}

export type T = (text: string, vars?: Record<string, string | number>) => string;
export const makeT = (lang: Lang): T => (text, vars) => translate(lang, text, vars);

/** Instruction added to every AI prompt so replies come back in the person's language. */
export function aiLanguageInstruction(lang: Lang): string {
  if (lang === "en") return "";
  const name = LANG_META[lang].label;
  return `Language: write every user-facing text field in ${name} (Devanagari script), in simple everyday ${name}. Keep medicine and brand names, numbers, units and JSON keys/enum values exactly as specified.`;
}
