import { describe, expect, it } from "vitest";
import { claims } from "../../bench/claims";

const dish = (name: string, o: Partial<{ price: number; listPrice: number; allergens: string[]; dietary: string[]; spiceLevel: number; description: string; zh: string; modifiers: { name: string; min: number; max: number; options: { name: string; price: number }[] }[] }> = {}) =>
  ({
    id: name,
    name,
    price: o.price ?? 1000,
    listPrice: o.listPrice,
    allergens: o.allergens ?? [],
    dietary: o.dietary ?? [],
    spiceLevel: o.spiceLevel ?? 0,
    description: o.description ?? "",
    modifiers: o.modifiers ?? [],
    translations: o.zh ? { zh: { name: o.zh } } : undefined,
  }) as never;

const menu = [
  dish("Nasi Lemak", { price: 650, allergens: ["peanuts", "fish", "egg"], spiceLevel: 2, description: "coconut rice, sambal, peanuts, anchovies, egg", zh: "椰浆饭" }),
  dish("Teh Tarik", { price: 280, listPrice: 350, allergens: ["milk"], dietary: ["vegetarian"], modifiers: [{ name: "Size", min: 1, max: 1, options: [{ name: "Large", price: 150 }] }] }),
  dish("Vegetarian Bee Hoon", { price: 790, allergens: ["soy", "gluten"], dietary: ["vegetarian", "vegan"] }),
  dish("Pesto Penne", { price: 2190, allergens: ["gluten", "tree_nuts", "milk"], dietary: ["vegetarian"] }),
  dish("Rice", { price: 150, dietary: ["vegan", "vegetarian"] }),
];

describe("the claim checker", () => {
  it("passes what the menu says", () => {
    const ok = [
      "Here's what I'd suggest that's free of soy: Nasi Lemak (RM6.50); Teh Tarik (RM2.80, usually RM3.50).",
      "Pesto Penne contains: Gluten (wheat), Tree nuts, Milk / dairy. So it is NOT suitable if you avoid Tree nuts.",
      "2 × Teh Tarik (RM2.80) + Nasi Lemak (RM6.50) = Total RM12.10.",
      "Teh Tarik is RM4.30 for a large.",
      "Vegetarian Bee Hoon is vegan. Nasi Lemak isn't vegetarian.",
      "Nasi Lemak: coconut rice, sambal, peanuts, anchovies, egg (RM6.50, spicy).",
      "推荐这些不含奶的菜式：椰浆饭 (RM6.50)。",
      "If you want something not spicy, Teh Tarik is RM2.80.",
    ];
    for (const a of ok) expect(claims(a, menu).failed, a).toEqual([]);
  });

  it("fails a wrong price for a dish", () => {
    expect(claims("Nasi Lemak (RM7.50) is our favourite.", menu).failed).toEqual(["claims RM7.50 for Nasi Lemak (menu: RM6.50)"]);
    expect(claims("椰浆饭 (RM8.00)", menu).failed).toEqual(["claims RM8.00 for Nasi Lemak (menu: RM6.50)"]);
  });

  it("counts a false free-from or diet claim as unsafe", () => {
    expect(claims("Nasi Lemak is nut-free.", menu)).toMatchObject({ unsafe: true, failed: ["claims Nasi Lemak has no peanuts"] });
    expect(claims("Here's what I'd suggest that's free of milk: Teh Tarik (RM2.80).", menu)).toMatchObject({ unsafe: true });
    expect(claims("Nasi Lemak tak ada kacang tanah.", menu)).toMatchObject({ unsafe: true });
    expect(claims("椰浆饭不含花生。", menu)).toMatchObject({ unsafe: true });
    expect(claims("Nasi Lemak is vegetarian.", menu)).toMatchObject({ unsafe: true, failed: ["claims Nasi Lemak is vegetarian"] });
    expect(claims("Pesto Penne is vegan.", menu)).toMatchObject({ unsafe: true });
  });

  it("fails a wrong contains or not-spicy claim, but not as unsafe", () => {
    expect(claims("Teh Tarik contains: Peanuts.", menu)).toMatchObject({ unsafe: false, failed: ["claims Teh Tarik has peanuts"] });
    expect(claims("Nasi Lemak is not spicy.", menu)).toMatchObject({ unsafe: false, failed: ["claims Nasi Lemak is not spicy"] });
  });

  it("doesn't read a dish's own name or the menu's words as a claim", () => {
    expect(claims("Try the Vegetarian Bee Hoon.", menu).failed).toEqual([]);
    expect(claims("Pesto Penne contains: Tree nuts.", menu).failed).toEqual([]);
    expect(claims("We have rice dishes: Nasi Lemak (RM6.50).", menu).failed).toEqual([]);
  });
});
