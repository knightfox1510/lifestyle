import { describe, expect, it } from "vitest";
import { dishesFromCsv, menuToCsv, parseCsv, splitMenuText } from "@/modules/dining/csv";

describe("menu CSV", () => {
  it("parses quotes, commas and newlines inside fields, and other separators", () => {
    expect(parseCsv('a,b\n"x, y","say ""hi""\nthere"\n')).toEqual([["a", "b"], ["x, y", 'say "hi"\nthere']]);
    expect(parseCsv("Dish;Price\nDosa;90")).toEqual([["Dish", "Price"], ["Dosa", "90"]]);
  });

  it("reads dishes by column name, and round-trips", () => {
    const csv = "Category,Item Name,Price (₹),Type,kcal\nStarters,Paneer Tikka,\"₹ 1,240\",Veg,\nMains,Chicken 65,320,Non-Veg,610\n,,,,\n";
    const d = dishesFromCsv(csv);
    expect(d).toEqual([
      { name: "Paneer Tikka", section: "Starters", description: null, price: 1240, veg: true, serves: 1, calories: null, protein_g: null, carbs_g: null, fat_g: null },
      { name: "Chicken 65", section: "Mains", description: null, price: 320, veg: false, serves: 1, calories: 610, protein_g: null, carbs_g: null, fat_g: null },
    ]);
    expect(dishesFromCsv(menuToCsv(d))).toEqual(d);
    expect(() => dishesFromCsv("Price,Veg\n90,veg")).toThrow(/Dish, Item or Name/);
  });

  it("splits a long menu into parts without losing lines", () => {
    const text = Array.from({ length: 400 }, (_, i) => `Dish number ${i} · ₹${100 + i}`).join("\n");
    const parts = splitMenuText(text, 2000);
    expect(parts.length).toBeGreaterThan(4);
    expect(parts.every((p) => p.length <= 2100)).toBe(true);
    expect(parts.join("\n").split("\n").filter(Boolean)).toHaveLength(400);
    expect(splitMenuText("x".repeat(5000), 2000).join("")).toHaveLength(5000);
    expect(splitMenuText("short")).toEqual(["short"]);
  });
});

describe("Copy menu to Hearth bookmark", () => {
  it("is valid JavaScript for this origin, and guesses the place from the page title", async () => {
    const { bookmarkletHref, placeFromTitle } = await import("@/modules/dining/bookmarklet");
    const href = bookmarkletHref("https://hearth.example.app");
    expect(href.startsWith("javascript:")).toBe(true);
    const code = decodeURIComponent(href.slice("javascript:".length));
    expect(code).toContain(`var H = "https://hearth.example.app"`);
    expect(code).toContain("/dining/from-page");
    expect(code).not.toContain("__HEARTH__");
    expect(() => new Function(code)).not.toThrow();
    expect(placeFromTitle("Order Burger Singh, Baner, Pune Online | Swiggy")).toBe("Burger Singh");
    expect(placeFromTitle("Vaishali menu, Fergusson College Road, Pune - Zomato")).toBe("Vaishali");
    expect(placeFromTitle("Malaka Spice | Koregaon Park")).toBe("Malaka Spice");
  });
});
