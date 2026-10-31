import { describe, expect, it } from "vitest";
import { applyTurn, sameOrder, type OrderLineT } from "../../src/server/ai/brain/turnReading";
import { countOf, pointedDish, toTurnReading } from "../../src/server/ai/brain/glReader";
import type { Dish } from "../../src/server/ai/brain/understand";

const dish = (name: string, price: number, modifiers: { name: string; max?: number; options: string[] }[] = []) =>
  ({ id: name, name, price, allergens: [], dietary: [], modifiers: modifiers.map((g) => ({ name: g.name, min: 0, max: g.max ?? 1, options: g.options.map((o) => ({ name: o, price: 0 })) })) }) as unknown as Dish;
const menu = [
  dish("Curry Laksa", 1390, [{ name: "Size", options: ["Small", "Regular", "Large"] }, { name: "Add-ons", max: 3, options: ["Tau Pok", "Hard-boiled Egg", "Prawns"] }]),
  dish("Penang Asam Laksa", 1300),
  dish("Teh Tarik", 300, [{ name: "Temperature", options: ["Hot", "Iced"] }]),
];
const order: OrderLineT[] = [
  { dish: "Curry Laksa", count: 3, options: ["Regular"] },
  { dish: "Teh Tarik", count: 2, options: ["Iced"] },
];

describe("applying a turn's changes to the order", () => {
  it("swaps one of several for another dish, and adds one more of a line", () => {
    const r = applyTurn(order, { acts: ["change", "ask_total"], items: [{ change: "swap_out", dish: "Curry Laksa", count: 1 }, { change: "swap_in", dish: "Penang Asam Laksa" }, { change: "more", dish: "Teh Tarik", count: 1 }] }, menu);
    expect(r.errors).toEqual([]);
    expect(sameOrder(r.order, [{ dish: "Curry Laksa", count: 2, options: ["Regular"] }, { dish: "Penang Asam Laksa", count: 1, options: [] }, { dish: "Teh Tarik", count: 3, options: ["Iced"] }])).toBe(true);
  });
  it("sets a count, splits one off with another add-on, and takes an add-on off", () => {
    const r = applyTurn(order, { acts: ["change"], items: [{ change: "set_count", dish: "Teh Tarik", count: 2 }, { change: "split_off", dish: "Teh Tarik", count: 1, options: ["Hot"] }, { change: "modify", dish: "Curry Laksa", options: ["Large", "Hard-boiled Egg"] }] }, menu);
    expect(r.errors).toEqual([]);
    expect(sameOrder(r.order, [{ dish: "Curry Laksa", count: 3, options: ["Large", "Hard-boiled Egg"] }, { dish: "Teh Tarik", count: 1, options: ["Iced"] }, { dish: "Teh Tarik", count: 1, options: ["Hot"] }])).toBe(true);
  });
  it("says whose a line is, all of it or one of several", () => {
    const r = applyTurn(order, { acts: ["split"], items: [{ change: "assign", dish: "Teh Tarik", count: 1, owner: "friend" }, { change: "assign", dish: "Curry Laksa", owner: "me" }] }, menu);
    expect(r.errors).toEqual([]);
    expect(sameOrder(r.order, [{ dish: "Curry Laksa", count: 3, options: ["Regular"], owner: "me" }, { dish: "Teh Tarik", count: 1, options: ["Iced"] }, { dish: "Teh Tarik", count: 1, options: ["Iced"], owner: "friend" }])).toBe(true);
  });
  it("refuses what doesn't fit: a dish the menu lacks, another dish's add-on, a change to a line not ordered", () => {
    const r = applyTurn(order, { acts: ["order"], items: [{ change: "new", dish: "Mee Goreng" }, { change: "new", dish: "Penang Asam Laksa", options: ["Iced"] }, { change: "remove", dish: "Penang Asam Laksa" }] }, menu);
    expect(r.errors).toEqual(['no dish "Mee Goreng"', 'Penang Asam Laksa has no add-on "Iced"', "Penang Asam Laksa isn't on the order (remove)"]);
  });
});

describe("the browser reader's output, made a turn reading", () => {
  it("reads counts in digits, words, Malay and Chinese", () => {
    expect([countOf("2"), countOf("two"), countOf("dua"), countOf("两"), countOf("十二"), countOf("x3"), countOf("lots")]).toEqual([2, 2, 2, 2, 12, 3, undefined]);
  });
  it("resolves a pointer to the reply's list, or to the order", () => {
    const reply = "We have Teh Tarik (RM3.00) and Curry Laksa (RM13.90).";
    expect(pointedDish("the second one", reply, [], menu)).toBe("Curry Laksa");
    expect(pointedDish("第一个", reply, [], menu)).toBe("Teh Tarik");
    expect(pointedDish("that one", "OK.", order, menu)).toBe("Teh Tarik");
  });
  it("names whose a line is, and leaves out a dish it can't place", () => {
    const r = toTurnReading({ acts: ["split"], items: [{ dish: "Teh Tarik", text: "teh tarik", change: "assign", count: "one", owner: "my friend" }, { pointer: true, text: "the first one", change: "new" }] }, "OK.", [], menu);
    expect(r.items).toEqual([{ change: "assign", dish: "Teh Tarik", count: 1, owner: "friend" }]);
  });
});
