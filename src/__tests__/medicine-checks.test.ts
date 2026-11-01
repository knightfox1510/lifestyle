import { describe, expect, it } from "vitest";
import { checkMedicines, ingredientsOf, strengthMg, unrecognised, type CheckMed } from "@/modules/medicines/checks";

const med = (name: string, extra: Partial<CheckMed> = {}): CheckMed => ({ name, kind: "medicine", times: ["09:00"], ...extra });
const ids = (ms: CheckMed[], opts?: Parameters<typeof checkMedicines>[1]) => checkMedicines(ms, opts).map((f) => f.id);

describe("ingredient recognition", () => {
  it("knows Indian brands and combinations", () => {
    expect(ingredientsOf("Dolo 650").map((i) => i.key)).toEqual(["paracetamol"]);
    expect(ingredientsOf("Combiflam").map((i) => i.key).sort()).toEqual(["ibuprofen", "paracetamol"]);
    expect(ingredientsOf("Shelcal-500").map((i) => i.key)).toEqual(["calcium"]);
    expect(ingredientsOf("Telma-H 40").map((i) => i.key).sort()).toEqual(["arb_ace", "thiazide"]);
    expect(ingredientsOf("Pan 40").map((i) => i.key)).toEqual(["ppi"]);
    expect(ingredientsOf("Panadol pantry")).toEqual([]);
    expect(unrecognised([med("Mystery tonic"), med("Thyronorm 50")])).toEqual(["Mystery tonic"]);
  });
  it("reads strengths", () => {
    expect(strengthMg("650 mg")).toBe(650);
    expect(strengthMg("0.5 g")).toBe(500);
    expect(strengthMg("2 puffs")).toBeNull();
  });
});

describe("checks", () => {
  it("flags the same ingredient in two products", () => {
    const f = checkMedicines([med("Dolo 650"), med("Sinarest")]);
    expect(f[0]).toMatchObject({ id: "dup:paracetamol", severity: "high" });
  });
  it("adds up paracetamol per day", () => {
    expect(ids([med("Dolo 650", { strength: "650 mg", times: ["08:00", "14:00", "20:00", "23:00", "04:00"] })])).toContain("para-total");
    expect(ids([med("Dolo 650", { strength: "650 mg", times: ["08:00", "20:00"] })])).not.toContain("para-total");
  });
  it("catches dangerous interactions", () => {
    expect(ids([med("Brufen 400"), med("Ecosprin 75")])).toContain("nsaid-thinner");
    expect(ids([med("Brufen 400"), med("Voveran 50")])).toContain("class:nsaid");
    expect(ids([med("Ecosprin 75"), med("Clopilet 75")])).not.toContain("class:nsaid");
    expect(ids([med("Ultracet"), med("Nexito 10")])).toContain("serotonin");
    expect(ids([med("Voveran"), med("Telma 40"), med("Lasix")])).toContain("triple-whammy");
    expect(ids([med("Sildenafil 50"), med("Sorbitrate 5")])).toContain("pde5-nitrate");
  });
  it("checks timing for thyroid, iron and antibiotics", () => {
    expect(ids([med("Thyronorm 50", { times: ["07:00"] }), med("Shelcal 500", { times: ["09:00"] })])).toContain("thyroid-timing:Thyronorm 50");
    expect(ids([med("Thyronorm 50", { times: ["07:00"] }), med("Shelcal 500", { times: ["14:00"] })])).not.toContain("thyroid-timing:Thyronorm 50");
    expect(ids([med("Ciplox 500", { times: ["09:00"] }), med("Livogen", { times: ["09:30"] })])).toContain("antibiotic-timing:Ciplox 500");
  });
  it("adds bladder-relevant notes", () => {
    expect(ids([med("Lasix 40", { times: ["20:00"] })], { bladder: true })).toContain("diuretic-evening");
    expect(ids([med("Lasix 40", { times: ["08:00"] })], { bladder: true })).not.toContain("diuretic-evening");
    expect(ids([med("Soliten 5"), med("Avil 25")])).toContain("anticholinergic");
    expect(ids([med("Saridon")], { bladder: true })).toContain("caffeine-bladder");
  });
  it("matches recorded allergies", () => {
    const f = checkMedicines([med("Augmentin 625")], { allergies: ["Penicillin allergy (rash)"] });
    expect(f[0].severity).toBe("high");
    expect(ids([med("Dolo 650")], { allergies: ["Penicillin"] })).not.toContain("allergy:penicillin");
  });
  it("is quiet for a simple, safe list", () => {
    expect(checkMedicines([med("Thyronorm 50", { times: ["07:00"] })]).filter((f) => f.severity !== "info")).toEqual([]);
  });
});
