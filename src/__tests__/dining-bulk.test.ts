import { describe, expect, it } from "vitest";
import { orderText, placeKey, planImport } from "@/modules/dining/bulk";
import { diningImportSchema } from "@/lib/ai/phase2-schemas";
import { toGeminiSchema } from "@/lib/ai/schemas";

const item = (name: string, quantity = 1) => ({ name, quantity, price: 200, veg: true, calories: 400, protein_g: 12, carbs_g: 50, fat_g: 15 });

describe("bulk dining import", () => {
  it("matches names loosely", () => {
    expect(placeKey("The Bombay Canteen")).toBe(placeKey("bombay canteen restaurant"));
    expect(placeKey("Behrouz Biryani")).not.toBe(placeKey("Biryani By Kilo"));
    expect(placeKey("Café Goodluck")).toBe(placeKey("Cafe Goodluck"));
    expect(orderText([item("Butter Naan", 2), item("Dal Makhani")])).toBe("2× Butter Naan, 1× Dal Makhani");
  });

  it("adds new places, merges duplicates, skips known dishes and already-imported orders, marks go-tos", () => {
    const plan = planImport(
      [
        { name: "Burger Singh", cuisine: "Burgers", area: "Baner", platform: "swiggy", orders: [{ date: "2026-10-20", items: [item("Udta Punjab Burger"), item("Fries")], total: 350 }] },
        { name: "burger singh", cuisine: null, area: null, platform: null, orders: [{ date: "2026-10-28", items: [item("Udta Punjab Burger", 2)], total: 400 }, { date: "2026-10-20", items: [item("Udta Punjab Burger"), item("Fries")], total: 350 }] },
        { name: "The Vaishali", cuisine: "South Indian", area: "FC Road", platform: "dine_in", orders: [{ date: "2026-11-01", items: [item("Masala Dosa"), item("Filter Coffee")], total: 260 }, { date: "2026-12-25", items: [item("SPDP")], total: 90 }] },
        { name: "Malaka Spice", cuisine: "Pan-Asian", area: null, platform: null, orders: [] },
      ],
      {
        places: [{ id: "v1", name: "Vaishali" }],
        dishes: [{ place_id: "v1", name: "masala dosa" }],
        orders: [{ place_id: "v1", ordered_on: "2026-11-01", items: "1× Masala Dosa, 1× Filter Coffee" }],
      },
      "2026-11-03",
    );
    expect(plan.places).toHaveLength(3);
    const [bs, v, m] = plan.places;
    expect(bs.insert).toMatchObject({ name: "Burger Singh", mode: "delivery", order_via: "Swiggy", area: "Baner" });
    expect(bs.orders.map((o) => o.ordered_on)).toEqual(["2026-10-20", "2026-10-28"]);
    expect(bs.dishes).toEqual([expect.objectContaining({ name: "Udta Punjab Burger", goTo: true }), expect.objectContaining({ name: "Fries", goTo: false })]);
    expect(v.existingId).toBe("v1");
    expect(v.insert).toBeNull();
    expect(v.dishes.map((d) => d.name)).toEqual(["Filter Coffee", "SPDP"]);
    // The 1 Nov order was imported before; a future date becomes today.
    expect(v.orders).toEqual([{ ordered_on: "2026-11-03", items: "1× SPDP", total: 90 }]);
    expect(m.insert).toMatchObject({ name: "Malaka Spice", mode: "both", order_via: null });
    expect(m.orders).toEqual([]);
  });

  it("the answer schema is one Gemini accepts", () => {
    expect(JSON.stringify(toGeminiSchema(diningImportSchema))).not.toMatch(/"(maxItems|minItems)"/);
  });
});

describe("AI answers", () => {
  it("over-long texts are cut to fit instead of failing the answer", async () => {
    const { menuExtractSchema } = await import("@/lib/ai/phase2-schemas");
    const { clampToSchema } = await import("@/lib/ai/schemas");
    const raw = { restaurant_name: "X", note: "n".repeat(500), items: [{ section: null, name: "Dosa", description: "d".repeat(400), price: 90, veg: true, serves: 1, calories: 300, protein_g: 6, carbs_g: 45, fat_g: 10 }] };
    const parsed = menuExtractSchema.parse(clampToSchema(raw, menuExtractSchema));
    expect(parsed.note!.length).toBe(300);
    expect(parsed.items[0].description!.length).toBe(300);
    expect(parsed.items[0].name).toBe("Dosa");
  });
});
