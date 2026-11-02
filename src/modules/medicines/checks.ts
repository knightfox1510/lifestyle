import { makeT, type T } from "@/lib/i18n/core";

/**
 * Rule-based medicine safety checks (pure, unit-tested).
 *
 * Maps generic and common Indian brand names to ingredients, then looks for
 * duplicate ingredients, same-class duplicates, well-known interactions,
 * timing clashes (e.g. thyroid tablet with calcium) and bladder-relevant
 * notes. It is a safety net, not a full interaction database: it only knows
 * what's listed here. Always confirm with a doctor or pharmacist.
 */

export type CheckMed = {
  name: string;
  strength?: string | null;
  dose_amount?: number | null;
  times?: string[];
  kind: "medicine" | "supplement";
  /** Composition from the strip/box, so brand names the app doesn't know still get checked. */
  ingredients?: string | null;
};

export type Severity = "high" | "medium" | "info";
export type Finding = { id: string; severity: Severity; title: string; detail: string; medicines: string[] };

type Ingredient = {
  key: string;
  label: string;
  classes: string[];
  /** Lower-case words/brands that identify it in a medicine name. */
  match: string[];
};

/** Ingredients and common Indian brands. Combination brands list each ingredient. */
const INGREDIENTS: Ingredient[] = [
  { key: "paracetamol", label: "Paracetamol", classes: ["analgesic"], match: ["paracetamol", "acetaminophen", "crocin", "dolo", "calpol", "pacimol", "p-500", "p 500", "p-650", "combiflam", "sinarest", "saridon", "vicks action", "ultracet", "febrex", "coldact", "wikoryl", "zerodol-p", "zerodol p", "hifenac-p", "hifenac p", "fepanil"] },
  { key: "ibuprofen", label: "Ibuprofen", classes: ["nsaid"], match: ["ibuprofen", "brufen", "combiflam", "ibugesic"] },
  { key: "diclofenac", label: "Diclofenac", classes: ["nsaid"], match: ["diclofenac", "voveran", "voltaren", "dynapar", "reactin"] },
  { key: "aceclofenac", label: "Aceclofenac", classes: ["nsaid"], match: ["aceclofenac", "zerodol", "hifenac"] },
  { key: "naproxen", label: "Naproxen", classes: ["nsaid"], match: ["naproxen", "naprosyn"] },
  { key: "nimesulide", label: "Nimesulide", classes: ["nsaid"], match: ["nimesulide", "nise", "nimulid"] },
  { key: "mefenamic", label: "Mefenamic acid", classes: ["nsaid"], match: ["mefenamic", "meftal"] },
  { key: "etoricoxib", label: "Etoricoxib", classes: ["nsaid"], match: ["etoricoxib", "etoshine", "arcoxia", "nucoxia"] },
  { key: "aspirin", label: "Aspirin", classes: ["antiplatelet", "nsaid"], match: ["aspirin", "ecosprin", "disprin", "loprin"] },
  { key: "clopidogrel", label: "Clopidogrel", classes: ["antiplatelet"], match: ["clopidogrel", "clopilet", "plavix", "deplatt", "clavix"] },
  { key: "warfarin", label: "Warfarin / acenocoumarol", classes: ["anticoagulant", "vka"], match: ["warfarin", "warf", "acitrom", "acenocoumarol", "sintrom"] },
  { key: "doac", label: "Apixaban / rivaroxaban / dabigatran", classes: ["anticoagulant"], match: ["apixaban", "eliquis", "rivaroxaban", "xarelto", "dabigatran", "pradaxa"] },
  { key: "prednisolone", label: "Steroid (prednisolone etc.)", classes: ["steroid"], match: ["prednisolone", "wysolone", "omnacortil", "methylprednisolone", "medrol", "dexamethasone", "dexona", "deflazacort", "defcort"] },
  { key: "levothyroxine", label: "Levothyroxine (thyroid)", classes: ["thyroid"], match: ["levothyroxine", "thyroxine", "thyronorm", "eltroxin", "thyrox", "lethyrox"] },
  { key: "iron", label: "Iron", classes: ["mineral_binder"], match: ["iron", "ferrous", "ferric", "livogen", "autrin", "orofer", "dexorange", "fefol", "ferium", "hemfer", "feronia"] },
  { key: "calcium", label: "Calcium", classes: ["mineral_binder"], match: ["calcium", "shelcal", "calcimax", "cipcal", "ccm", "gemcal", "ostocalcium", "calcitas"] },
  { key: "antacid", label: "Antacid", classes: ["mineral_binder"], match: ["antacid", "digene", "gelusil", "mucaine", "rantac syrup", "aluminium hydroxide", "magnesium hydroxide"] },
  { key: "magnesium", label: "Magnesium", classes: ["mineral_binder"], match: ["magnesium"] },
  { key: "zinc", label: "Zinc", classes: ["mineral_binder"], match: ["zinc", "zincovit"] },
  { key: "ppi", label: "Acid reducer (PPI)", classes: ["ppi"], match: ["pantoprazole", "pan 40", "pan-40", "pan d", "pan-d", "pantocid", "omeprazole", "omez", "esomeprazole", "nexpro", "esoz", "rabeprazole", "razo", "rablet", "lansoprazole"] },
  { key: "metformin", label: "Metformin", classes: ["diabetes"], match: ["metformin", "glycomet", "gluformin", "obimet", "janumet", "galvus met", "istamet", "glycomet-gp"] },
  { key: "b12", label: "Vitamin B12", classes: [], match: ["b12", "methylcobalamin", "mecobalamin", "cyanocobalamin", "neurobion", "nurokind", "methycobal"] },
  { key: "quinolone", label: "Quinolone antibiotic", classes: ["quinolone", "antibiotic"], match: ["ciprofloxacin", "ciplox", "cifran", "levofloxacin", "levoflox", "levomac", "ofloxacin", "oflox", "zenflox", "norfloxacin", "norflox", "moxifloxacin"] },
  { key: "doxycycline", label: "Doxycycline", classes: ["tetracycline", "antibiotic"], match: ["doxycycline", "doxy", "doxt", "minocycline"] },
  { key: "macrolide", label: "Clarithromycin / erythromycin", classes: ["macrolide", "antibiotic"], match: ["clarithromycin", "claribid", "erythromycin", "althrocin"] },
  { key: "azithromycin", label: "Azithromycin", classes: ["antibiotic"], match: ["azithromycin", "azithral", "azee", "zithrox"] },
  { key: "metronidazole", label: "Metronidazole / tinidazole", classes: ["antibiotic", "nitroimidazole"], match: ["metronidazole", "flagyl", "metrogyl", "tinidazole", "tiniba", "ornidazole"] },
  { key: "fluconazole", label: "Fluconazole", classes: ["antifungal"], match: ["fluconazole", "forcan", "zocon"] },
  { key: "amoxicillin", label: "Amoxicillin (penicillin)", classes: ["penicillin", "antibiotic"], match: ["amoxicillin", "amoxycillin", "mox", "augmentin", "clavam", "moxikind", "ampicillin"] },
  { key: "cotrimoxazole", label: "Co-trimoxazole (sulfa)", classes: ["sulfa", "antibiotic"], match: ["cotrimoxazole", "co-trimoxazole", "septran", "bactrim"] },
  { key: "nitrofurantoin", label: "Nitrofurantoin", classes: ["antibiotic"], match: ["nitrofurantoin", "furadantin", "martifur", "niftas"] },
  { key: "cetirizine", label: "Cetirizine / levocetirizine", classes: ["antihistamine"], match: ["cetirizine", "cetzine", "okacet", "alerid", "levocetirizine", "levocet", "xyzal", "teczine", "montair lc", "montek lc"] },
  { key: "chlorpheniramine", label: "Chlorpheniramine", classes: ["antihistamine", "sedating_antihistamine", "anticholinergic"], match: ["chlorpheniramine", "sinarest", "coldact", "wikoryl", "piriton", "cheston"] },
  { key: "diphenhydramine", label: "Diphenhydramine / promethazine / hydroxyzine", classes: ["antihistamine", "sedating_antihistamine", "anticholinergic"], match: ["diphenhydramine", "benadryl", "promethazine", "phenergan", "avil", "pheniramine", "hydroxyzine", "atarax"] },
  { key: "bladder_antimuscarinic", label: "Bladder antimuscarinic", classes: ["bladder_antimuscarinic", "anticholinergic"], match: ["oxybutynin", "cystran", "oxyspas", "tolterodine", "roliten", "detrusitol", "solifenacin", "soliten", "vesicare", "darifenacin", "darifen", "trospium", "fesoterodine", "toviaz"] },
  { key: "mirabegron", label: "Mirabegron", classes: ["bladder_beta3"], match: ["mirabegron", "mirago", "betmiga", "vibegron"] },
  { key: "furosemide", label: "Loop diuretic", classes: ["diuretic"], match: ["furosemide", "frusemide", "lasix", "torsemide", "dytor", "tide"] },
  { key: "thiazide", label: "Thiazide diuretic", classes: ["diuretic"], match: ["hydrochlorothiazide", "hctz", "chlorthalidone", "indapamide", "natrilix", "telma-h", "telma h", "losar-h", "losar h", "telma-ct"] },
  { key: "spironolactone", label: "Spironolactone", classes: ["diuretic", "k_sparing"], match: ["spironolactone", "aldactone", "eplerenone"] },
  { key: "potassium", label: "Potassium supplement", classes: ["k_sparing"], match: ["potassium chloride", "k-cl", "potklor", "potrate"] },
  { key: "arb_ace", label: "BP medicine (ARB / ACE inhibitor)", classes: ["raas"], match: ["telmisartan", "telma", "losartan", "losar", "olmesartan", "olmezest", "valsartan", "ramipril", "cardace", "enalapril", "envas", "lisinopril"] },
  { key: "statin", label: "Statin", classes: ["statin"], match: ["atorvastatin", "atorva", "storvas", "lipitor", "rosuvastatin", "rosuvas", "rozavel", "crestor", "simvastatin"] },
  { key: "ssri", label: "SSRI antidepressant", classes: ["ssri", "serotonergic"], match: ["sertraline", "serta", "daxid", "escitalopram", "nexito", "cipralex", "fluoxetine", "fludac", "paroxetine", "pexep", "fluvoxamine"] },
  { key: "tramadol", label: "Tramadol", classes: ["serotonergic", "sedative", "opioid"], match: ["tramadol", "ultracet", "contramal", "tramazac"] },
  { key: "benzodiazepine", label: "Benzodiazepine (sleep/anxiety)", classes: ["sedative", "benzodiazepine"], match: ["alprazolam", "alprax", "restyl", "clonazepam", "clonotril", "rivotril", "lonazep", "lorazepam", "ativan", "diazepam", "valium", "etizolam", "etilaam", "zolpidem", "zolfresh"] },
  { key: "gabapentinoid", label: "Pregabalin / gabapentin", classes: ["sedative"], match: ["pregabalin", "pregalin", "lyrica", "gabapentin", "gabapin"] },
  { key: "amitriptyline", label: "Amitriptyline", classes: ["sedative", "anticholinergic", "serotonergic"], match: ["amitriptyline", "tryptomer", "amitone", "nortriptyline"] },
  { key: "nitrate", label: "Nitrate (angina)", classes: ["nitrate"], match: ["isosorbide", "sorbitrate", "nitroglycerin", "glyceryl trinitrate", "nitrocontin", "monotrate"] },
  { key: "pde5", label: "Sildenafil / tadalafil", classes: ["pde5"], match: ["sildenafil", "tadalafil", "manforce", "suhagra", "tadacip", "megalis"] },
  { key: "caffeine", label: "Caffeine", classes: ["caffeine"], match: ["saridon", "vicks action", "caffeine", "dart"] },
  { key: "vitamin_d", label: "Vitamin D", classes: [], match: ["vitamin d", "d3", "cholecalciferol", "uprise", "calcirol", "d-rise", "arachitol"] },
];

const norm = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9+ -]/g, " ").replace(/\s+/g, " ").trim()} `;

/** Ingredients found in a medicine's name (word-boundary match so "pan" doesn't hit "pantry"). */
export function ingredientsOf(name: string): Ingredient[] {
  const n = norm(name);
  // A brand must start a word and be followed by a space, digit or hyphen ("Dolo 650", "Shelcal-500", "Dolo650").
  return INGREDIENTS.filter((i) => i.match.some((m) => new RegExp(`\\s${m.replace(/[-+]/g, "\\$&")}(?=[\\s\\d-])`).test(n)));
}

/** mg in a strength like "500 mg", "650mg", "0.5 g". Null when unknown. */
export function strengthMg(strength: string | null | undefined): number | null {
  if (!strength) return null;
  const m = strength.toLowerCase().match(/(\d+(?:\.\d+)?)\s*(mg|g)\b/);
  if (!m) return null;
  return m[2] === "g" ? Number(m[1]) * 1000 : Number(m[1]);
}

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/** True when two schedules have doses within `gap` minutes of each other. */
function closeTimes(a: string[] | undefined, b: string[] | undefined, gap: number) {
  if (!a?.length || !b?.length) return false;
  return a.some((x) => b.some((y) => Math.abs(toMin(x) - toMin(y)) < gap));
}

type Tagged = CheckMed & { ings: Ingredient[] };

export function checkMedicines(meds: CheckMed[], opts: { allergies?: string[]; bladder?: boolean; t?: T } = {}): Finding[] {
  const list: Tagged[] = meds.map((m) => ({ ...m, ings: ingredientsOf(m.ingredients ? `${m.name} ${m.ingredients}` : m.name) }));
  const out: Finding[] = [];
  const tr = opts.t ?? makeT("en");
  // Titles/details are English keys with {placeholders}, translated here.
  const add = (f: Finding & { vars?: Record<string, string | number> }) => {
    const { vars, ...rest } = f;
    if (!out.some((x) => x.id === f.id)) out.push({ ...rest, title: tr(f.title, vars), detail: tr(f.detail, vars) });
  };
  const withIng = (key: string) => list.filter((m) => m.ings.some((i) => i.key === key));
  const withClass = (c: string) => list.filter((m) => m.ings.some((i) => i.classes.includes(c)));
  const names = (ms: Tagged[]) => [...new Set(ms.map((m) => m.name))];
  const has = (ms: Tagged[]) => ms.length > 0;
  const both = (a: Tagged[], b: Tagged[]) => has(a) && has(b) && names([...a, ...b]).length > 1;

  // 1. Same ingredient in two products (e.g. Dolo + Sinarest both contain paracetamol).
  for (const ing of INGREDIENTS) {
    const ms = withIng(ing.key);
    if (names(ms).length > 1) {
      add({
        id: `dup:${ing.key}`,
        severity: ing.key === "paracetamol" || ing.classes.some((c) => ["nsaid", "anticoagulant", "sedative"].includes(c)) ? "high" : "medium",
        title: "{ingredient} is in more than one product",
        detail: "{meds} all contain {ingredient}. Taking them together can double the dose. Check with your pharmacist which one to keep.",
        vars: { ingredient: ing.label, meds: names(ms).join(", ") },
        medicines: names(ms),
      });
    }
  }

  // 2. Paracetamol daily total.
  const para = withIng("paracetamol");
  const paraMg = para.reduce((a, m) => {
    const mg = strengthMg(m.strength);
    return mg && m.times?.length ? a + mg * (m.dose_amount ?? 1) * m.times.length : a;
  }, 0);
  if (paraMg > 3000) {
    add({ id: "para-total", severity: "high", title: "About {g} g paracetamol a day", vars: { g: (paraMg / 1000).toFixed(1) }, detail: "Scheduled doses add up to more than 3 g a day. Most adults shouldn't exceed 3–4 g a day (less with liver disease or regular alcohol). Ask your doctor before continuing.", medicines: names(para) });
  }

  // 3. Same class, different ingredients.
  const classDupes: [string, string, Severity][] = [
    ["nsaid", "Two anti-inflammatory painkillers (NSAIDs)", "high"],
    ["ppi", "Two acid reducers", "medium"],
    ["statin", "Two cholesterol medicines (statins)", "medium"],
    ["raas", "Two BP medicines of the same type (ARB/ACE)", "high"],
    ["ssri", "Two SSRI antidepressants", "high"],
    ["antihistamine", "Two antihistamines", "medium"],
    ["bladder_antimuscarinic", "Two bladder antimuscarinics", "high"],
    ["benzodiazepine", "Two sleep/anxiety medicines", "high"],
    ["anticoagulant", "Two blood thinners", "high"],
  ];
  for (const [c, title, severity] of classDupes) {
    // Aspirin with another NSAID is covered by the bleeding rule below.
    const ms = withClass(c).filter((m) => c !== "nsaid" || m.ings.some((i) => i.classes.includes("nsaid") && i.key !== "aspirin"));
    const ings = new Set(ms.flatMap((m) => m.ings.filter((i) => i.classes.includes(c) && !(c === "nsaid" && i.key === "aspirin")).map((i) => i.key)));
    if (names(ms).length > 1 && ings.size > 1) {
      add({ id: `class:${c}`, severity, title, detail: "{meds} do the same job. Usually only one is needed; taking both raises the risk of side effects. Ask your doctor.", vars: { meds: names(ms).join(" + ") }, medicines: names(ms) });
    }
  }

  // 4. Interactions.
  const nsaids = withClass("nsaid").filter((m) => m.ings.some((i) => i.classes.includes("nsaid") && i.key !== "aspirin"));
  const thinners = [...withClass("anticoagulant"), ...withClass("antiplatelet")];
  if (both(nsaids, thinners)) {
    add({ id: "nsaid-thinner", severity: "high", title: "Painkiller + blood thinner: bleeding risk", detail: "NSAID painkillers (ibuprofen, diclofenac, etc.) with blood thinners or antiplatelets raise the risk of stomach and other bleeding. Paracetamol is usually the safer painkiller — check with your doctor.", medicines: names([...nsaids, ...thinners]) });
  }
  if (both(nsaids, withClass("steroid"))) {
    add({ id: "nsaid-steroid", severity: "medium", title: "Painkiller + steroid: stomach risk", detail: "Together they raise the risk of stomach ulcers and bleeding. Doctors often add a stomach protector; ask if you need one.", medicines: names([...nsaids, ...withClass("steroid")]) });
  }
  const raas = withClass("raas");
  const diuretics = withClass("diuretic");
  if (has(nsaids) && has(raas) && has(diuretics)) {
    add({ id: "triple-whammy", severity: "high", title: "Painkiller + BP medicine + water tablet: kidney risk", detail: "This combination (sometimes called the 'triple whammy') can harm the kidneys, especially if you're dehydrated or unwell. Ask your doctor before taking NSAIDs regularly.", medicines: names([...nsaids, ...raas, ...diuretics]) });
  } else if (both(nsaids, [...raas, ...diuretics])) {
    add({ id: "nsaid-bp", severity: "medium", title: "Painkiller may weaken BP medicine", detail: "Regular NSAIDs can raise blood pressure and strain the kidneys alongside BP medicines or water tablets. Occasional use is usually fine; ask about regular use.", medicines: names([...nsaids, ...raas, ...diuretics]) });
  }
  if (both(raas, withClass("k_sparing"))) {
    add({ id: "potassium", severity: "medium", title: "Potassium can build up", detail: "ARB/ACE BP medicines with spironolactone or potassium supplements can raise blood potassium. Your doctor may want a periodic potassium/kidney blood test.", medicines: names([...raas, ...withClass("k_sparing")]) });
  }
  if (both(withClass("serotonergic").filter((m) => m.ings.some((i) => i.key === "tramadol")), withClass("ssri"))) {
    add({ id: "serotonin", severity: "high", title: "Tramadol + antidepressant: serotonin risk", detail: "Together they can rarely cause serotonin syndrome (agitation, fever, shaking) and fits. Talk to your doctor before combining.", medicines: names([...withIng("tramadol"), ...withClass("ssri")]) });
  }
  if (both(withClass("ssri"), [...nsaids, ...thinners])) {
    add({ id: "ssri-bleed", severity: "medium", title: "Antidepressant + painkiller/blood thinner: bleeding risk", detail: "SSRIs slightly raise bleeding risk, more so with NSAIDs or blood thinners. A stomach protector may be advised.", medicines: names([...withClass("ssri"), ...nsaids, ...thinners]) });
  }
  const sedatives = [...withClass("sedative"), ...withClass("sedating_antihistamine")];
  if (names(sedatives).length > 1) {
    add({ id: "sedation", severity: "medium", title: "Several medicines that cause drowsiness", detail: "Combined they can cause heavy drowsiness, slowed breathing and falls (especially at night on the way to the bathroom). Avoid alcohol and driving; ask if all are needed.", medicines: names(sedatives) });
  }
  if (both(withClass("statin"), withClass("macrolide"))) {
    add({ id: "statin-macrolide", severity: "high", title: "Statin + clarithromycin/erythromycin", detail: "These antibiotics raise statin levels and the risk of muscle damage. Doctors often pause the statin during the course — ask yours.", medicines: names([...withClass("statin"), ...withClass("macrolide")]) });
  }
  if (both(withClass("pde5"), withClass("nitrate"))) {
    add({ id: "pde5-nitrate", severity: "high", title: "Sildenafil/tadalafil + nitrate: dangerous BP drop", detail: "This combination can cause a severe fall in blood pressure. Don't take them together; speak to your doctor.", medicines: names([...withClass("pde5"), ...withClass("nitrate")]) });
  }
  if (both(withClass("vka"), [...withClass("antibiotic"), ...withClass("antifungal")])) {
    add({ id: "warfarin-antibiotic", severity: "medium", title: "Blood thinner + antibiotic/antifungal", detail: "Many antibiotics and fluconazole change warfarin/acitrom levels. Your INR may need checking during and after the course.", medicines: names([...withClass("vka"), ...withClass("antibiotic"), ...withClass("antifungal")]) });
  }
  const anticholinergic = withClass("anticholinergic");
  if (names(anticholinergic).length > 1) {
    add({ id: "anticholinergic", severity: "medium", title: "Anticholinergic load", detail: "Several of these medicines have 'anticholinergic' effects (dry mouth, constipation, blurred vision, confusion in older adults, and they can make it harder to empty the bladder). Ask whether a less sedating option would do.", medicines: names(anticholinergic) });
  }

  // 5. Timing clashes (absorption).
  const binders = withClass("mineral_binder");
  for (const thy of withIng("levothyroxine")) {
    const clash = [...binders, ...withClass("ppi")].filter((b) => b.name !== thy.name);
    const sameTime = clash.filter((b) => closeTimes(thy.times, b.times, 240));
    if (sameTime.length) {
      add({ id: `thyroid-timing:${thy.name}`, severity: "medium", title: "Thyroid tablet too close to calcium/iron/antacid", detail: "Keep {med} at least 4 hours away from {others} — they block its absorption. Take the thyroid tablet alone on an empty stomach, 30–60 min before breakfast or tea.", vars: { med: thy.name, others: names(sameTime).join(", ") }, medicines: names([thy, ...sameTime]) });
    }
  }
  for (const fe of withIng("iron")) {
    const sameTime = [...withIng("calcium"), ...withIng("antacid"), ...withClass("ppi")].filter((b) => b.name !== fe.name && closeTimes(fe.times, b.times, 120));
    if (sameTime.length) {
      add({ id: `iron-timing:${fe.name}`, severity: "medium", title: "Iron taken with calcium/antacid", detail: "Calcium, antacids and acid reducers cut iron absorption. Keep {med} 2 hours apart from {others}.", vars: { med: fe.name, others: names(sameTime).join(", ") }, medicines: names([fe, ...sameTime]) });
    }
  }
  for (const ab of [...withClass("quinolone"), ...withClass("tetracycline")]) {
    const sameTime = binders.filter((b) => b.name !== ab.name && closeTimes(ab.times, b.times, 180));
    if (sameTime.length) {
      add({ id: `antibiotic-timing:${ab.name}`, severity: "medium", title: "Antibiotic blocked by minerals", detail: "{med} binds to calcium, iron, zinc, magnesium and antacids (and milk/curd). Take it 2 hours before or 6 hours after {others}.", vars: { med: ab.name, others: names(sameTime).join(", ") }, medicines: names([ab, ...sameTime]) });
    }
  }

  // 6. Helpful notes.
  if (has(withIng("metformin")) && !has(withIng("b12"))) {
    add({ id: "metformin-b12", severity: "info", title: "Metformin and vitamin B12", detail: "Long-term metformin can lower B12. Ask for a B12 test once a year, especially if you have tingling, tiredness or low mood.", medicines: names(withIng("metformin")) });
  }
  if (has(withClass("ppi"))) {
    add({ id: "ppi-long", severity: "info", title: "Acid reducers long-term", detail: "Taken for months, PPIs can lower B12, magnesium and calcium absorption. Ask your doctor whether you still need it daily.", medicines: names(withClass("ppi")) });
  }
  if (has(withIng("iron"))) {
    add({ id: "iron-tea", severity: "info", title: "Iron and tea/coffee", detail: "Tea and coffee block iron. Take iron 1 hour before or 2 hours after chai; vitamin C (lemon, amla, orange) helps absorption.", medicines: names(withIng("iron")) });
  }
  if (has(withClass("quinolone")) || has(withClass("tetracycline"))) {
    add({ id: "antibiotic-dairy", severity: "info", title: "Antibiotic and milk/curd", detail: "Keep doses 2 hours away from milk, curd, paneer and chaas — calcium blocks absorption.", medicines: names([...withClass("quinolone"), ...withClass("tetracycline")]) });
  }
  if (has(withClass("nitroimidazole"))) {
    add({ id: "metronidazole-alcohol", severity: "info", title: "No alcohol with metronidazole/tinidazole", detail: "Avoid alcohol during the course and for 2–3 days after — it can cause vomiting, flushing and a racing heart.", medicines: names(withClass("nitroimidazole")) });
  }
  const eveningDiuretics = diuretics.filter((m) => m.times?.some((t) => toMin(t) >= 16 * 60));
  if (eveningDiuretics.length) {
    add({ id: "diuretic-evening", severity: opts.bladder ? "medium" : "info", title: "Water tablet taken in the evening", detail: "Diuretics make you pass urine for several hours. Taking them in the morning (if your doctor agrees) means fewer night-time bathroom trips and less leakage at night.", medicines: names(eveningDiuretics) });
  }
  if (opts.bladder && has(withClass("caffeine"))) {
    add({ id: "caffeine-bladder", severity: "info", title: "Contains caffeine", detail: "Caffeine irritates the bladder and can increase urgency. A caffeine-free option may help on bad days.", medicines: names(withClass("caffeine")) });
  }
  if (opts.bladder && has(withClass("bladder_antimuscarinic"))) {
    add({ id: "antimuscarinic-tips", severity: "info", title: "Bladder medicine tips", detail: "Antimuscarinics often cause dry mouth and constipation — sip water through the day and keep fibre up. Tell your doctor if you have trouble emptying your bladder, or before eye-pressure (glaucoma) checks.", medicines: names(withClass("bladder_antimuscarinic")) });
  }

  // 7. Allergies recorded in the medical timeline.
  const CLASS_WORDS: Record<string, string[]> = { penicillin: ["penicillin", "amoxicillin", "augmentin"], sulfa: ["sulfa", "sulpha", "sulphonamide", "sulfonamide"], nsaid: ["nsaid", "painkiller"], quinolone: ["quinolone", "ciprofloxacin"], statin: ["statin"], macrolide: ["macrolide"] };
  for (const allergy of opts.allergies ?? []) {
    const a = allergy.toLowerCase();
    const first = (x: string) => x.toLowerCase().split(/[\s(/-]/)[0];
    const hit = list.filter(
      (m) =>
        (first(m.name).length >= 4 && a.includes(first(m.name))) ||
        m.ings.some((i) => a.includes(i.key) || (first(i.label).length >= 4 && a.includes(first(i.label))) || i.classes.some((c) => (CLASS_WORDS[c] ?? []).some((w) => a.includes(w)))),
    );
    if (hit.length) {
      add({ id: `allergy:${a}`, severity: "high", title: "Recorded allergy: {allergy}", detail: "{meds} may match an allergy in your medical history. Don't take it until a doctor or pharmacist confirms it's safe.", vars: { allergy, meds: names(hit).join(", ") }, medicines: names(hit) });
    }
  }

  const rank = { high: 0, medium: 1, info: 2 } as const;
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

/** Which listed medicines weren't recognised (so the UI can say what wasn't checked). */
export function unrecognised(meds: CheckMed[]) {
  return meds.filter((m) => ingredientsOf(m.ingredients ? `${m.name} ${m.ingredients}` : m.name).length === 0).map((m) => m.name);
}
