import { describe, expect, it } from "vitest";
import { fromMilli, servingsLeft, showQty, stockStatus, toMilli, totals, unavailable, usage, type RecipeLine } from "../../src/shared/inventory";

const recipes: RecipeLine[] = [
  { itemId: "rojak", ingredientId: "peanut", qty: toMilli(100) },
  { itemId: "rojak", ingredientId: "sugar", qty: toMilli(20) },
  { itemId: "cendol", ingredientId: "sugar", qty: toMilli(50) },
  { itemId: "rice", ingredientId: "rice_kg", qty: toMilli(0.15) },
];

describe("quantities", () => {
  it("are kept as exact thousandths of the unit", () => {
    expect(toMilli(1.5)).toBe(1500);
    expect(toMilli(0.1) + toMilli(0.2)).toBe(toMilli(0.3));
    expect(fromMilli(toMilli(0.15) * 3)).toBe(0.45);
    expect(showQty(1500, "kg")).toBe("1.5 kg");
    expect(showQty(-50000, "g")).toBe("-50 g");
  });
});

describe("what an order round uses", () => {
  it("is each line's recipe times its quantity, one entry per line and ingredient", () => {
    const uses = usage(recipes, [
      { id: "l1", itemId: "rojak", qty: 2 },
      { id: "l2", itemId: "cendol", qty: 1 },
      { id: "l3", itemId: "teh", qty: 4 },
    ]);
    expect(uses).toEqual([
      { lineId: "l1", ingredientId: "peanut", qty: 200_000 },
      { lineId: "l1", ingredientId: "sugar", qty: 40_000 },
      { lineId: "l2", ingredientId: "sugar", qty: 50_000 },
    ]);
    expect(Object.fromEntries(totals(uses))).toEqual({ peanut: 200_000, sugar: 90_000 });
  });

  it("is nothing for dishes without a recipe", () => {
    expect(usage(recipes, [{ id: "l1", itemId: "teh", qty: 3 }])).toEqual([]);
  });
});

describe("stock status and sold-out", () => {
  it("reads untracked, ok, low and out", () => {
    expect(stockStatus(null)).toBe("untracked");
    expect(stockStatus({ onHand: 500, lowAt: 100 })).toBe("ok");
    expect(stockStatus({ onHand: 100, lowAt: 100 })).toBe("low");
    expect(stockStatus({ onHand: 0, lowAt: 0 })).toBe("out");
    expect(stockStatus({ onHand: -50, lowAt: 100 })).toBe("out");
  });

  it("a dish can't be made when any tracked ingredient is at or below zero; untracked ones never stop it", () => {
    expect([...unavailable(recipes, new Map([["sugar", 0]]))].sort()).toEqual(["cendol", "rojak"]);
    expect([...unavailable(recipes, new Map([["peanut", -1], ["sugar", 10]]))]).toEqual(["rojak"]);
    expect(unavailable(recipes, new Map()).size).toBe(0);
  });

  it("counts the servings the tracked stock still covers", () => {
    const rojak = recipes.filter((r) => r.itemId === "rojak");
    expect(servingsLeft(rojak, new Map([["peanut", toMilli(250)], ["sugar", toMilli(200)]]))).toBe(2);
    expect(servingsLeft(rojak, new Map([["sugar", toMilli(30)]]))).toBe(1);
    expect(servingsLeft(rojak, new Map([["peanut", -5]]))).toBe(0);
    expect(servingsLeft(rojak, new Map())).toBeNull();
  });
});
