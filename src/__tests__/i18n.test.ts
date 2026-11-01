import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PHRASES } from "@/lib/i18n/phrases";
import { aiLanguageInstruction, makeT, translate } from "@/lib/i18n/core";
import { MODULES } from "@/modules/registry";
import { MEAL_META } from "@/modules/food/meta";
import { IRRITANT_META } from "@/modules/nutrition/irritants";
import { DISHES } from "@/modules/nutrition/dishes";
import { TRIGGER_LABEL } from "@/modules/bladder/meta";
import { checkMedicines, type CheckMed } from "@/modules/medicines/checks";
import { MILESTONES } from "@/modules/engagement/rings";
import { NUTRIENT_META } from "@/modules/nutrition/nutrients";
import { SUPPLEMENT_KEYS } from "@/modules/nutrition/supplements";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("translations", () => {
  it("covers every t(\"…\") literal in the app, in Hindi and Marathi", () => {
    const missing: string[] = [];
    for (const f of files("src")) {
      if (f.includes("__tests__") || f.endsWith("phrases.ts")) continue;
      for (const m of readFileSync(f, "utf8").matchAll(/\b(?:t|tr)\(\s*"((?:[^"\\]|\\.)*)"/g)) {
        const key = m[1].replace(/\\"/g, '"');
        if (!PHRASES[key]?.hi || !PHRASES[key]?.mr) missing.push(`${f}: ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("keeps placeholders intact", () => {
    for (const [en, tr] of Object.entries(PHRASES)) {
      expect(placeholders(tr.hi), en).toEqual(placeholders(en));
      expect(placeholders(tr.mr), en).toEqual(placeholders(en));
    }
  });

  it("covers labels that are translated by value", () => {
    const labels = [
      ...MODULES.map((m) => m.name),
      ...Object.values(MEAL_META).map((m) => m.label),
      ...Object.values(IRRITANT_META).map((m) => m.label),
      ...new Set(DISHES.map((d) => d.region)),
      ...Object.values(TRIGGER_LABEL),
      ...MILESTONES.flatMap((m) => [m.title, m.detail]),
      "Water", "Meals", "Medicines", "Check-in",
      "Health", "Food", "Family & home", "Leisure", "Admin",
      ...SUPPLEMENT_KEYS.map((k) => NUTRIENT_META[k].label),
    ];
    expect(labels.filter((l) => !PHRASES[l])).toEqual([]);
  });

  it("translates every medicine-check message", () => {
    const med = (name: string, times = ["09:00"]): CheckMed => ({ name, kind: "medicine", times, strength: "650 mg" });
    const all = checkMedicines(
      [med("Dolo 650", ["06:00", "10:00", "14:00", "18:00", "22:00"]), med("Sinarest"), med("Brufen"), med("Voveran"), med("Ecosprin"), med("Wysolone"), med("Telma 40"), med("Lasix", ["20:00"]), med("Aldactone"), med("Ultracet"), med("Nexito"), med("Alprax"), med("Atorva"), med("Claribid"), med("Sildenafil"), med("Sorbitrate"), med("Acitrom"), med("Ciplox"), med("Soliten"), med("Avil"), med("Thyronorm", ["07:00"]), med("Shelcal", ["08:00"]), med("Livogen", ["08:30"]), med("Glycomet"), med("Pan 40"), med("Flagyl"), med("Saridon"), med("Augmentin")],
      { bladder: true, allergies: ["Penicillin"] },
    );
    expect(all.length).toBeGreaterThan(25);
    const hi = checkMedicines(
      [med("Dolo 650", ["06:00", "10:00", "14:00", "18:00", "22:00"]), med("Sinarest"), med("Brufen"), med("Voveran"), med("Ecosprin"), med("Wysolone"), med("Telma 40"), med("Lasix", ["20:00"]), med("Aldactone"), med("Ultracet"), med("Nexito"), med("Alprax"), med("Atorva"), med("Claribid"), med("Sildenafil"), med("Sorbitrate"), med("Acitrom"), med("Ciplox"), med("Soliten"), med("Avil"), med("Thyronorm", ["07:00"]), med("Shelcal", ["08:00"]), med("Livogen", ["08:30"]), med("Glycomet"), med("Pan 40"), med("Flagyl"), med("Saridon"), med("Augmentin")],
      { bladder: true, allergies: ["Penicillin"], t: makeT("hi") },
    );
    const untranslated = hi.filter((f, i) => f.title === all[i].title || f.detail === all[i].detail).map((f) => f.id);
    expect(untranslated).toEqual([]);
  });

  it("falls back to English and fills placeholders", () => {
    expect(translate("mr", "Not a real key {x}", { x: 1 })).toBe("Not a real key 1");
    expect(translate("mr", "Time for {name}", { name: "Dolo 650" })).toBe("Dolo 650 घेण्याची वेळ");
    expect(translate("en", "Time for {name}", { name: "Dolo" })).toBe("Time for Dolo");
    expect(aiLanguageInstruction("en")).toBe("");
    expect(aiLanguageInstruction("mr")).toContain("Marathi");
  });
});
