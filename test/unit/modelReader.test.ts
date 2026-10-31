import { describe, expect, it } from "vitest";
import { answerGuest } from "../../src/server/ai/brain";
import { checkBasket, checkReading, grounded, linesKey, rulesLines } from "../../src/server/ai/brain/reading";
import { readWithModel, readerSchema, type ReaderCall } from "../../src/server/ai/brain/modelReader";
import type { Dish } from "../../src/server/ai/brain/understand";
import type { AssistantContext } from "../../src/server/ai/local";

const dish = (id: string, name: string, price: number, extra: Partial<Dish> = {}) =>
  ({ id, name, category: "Mains", categoryId: "Mains", description: "", price, allergens: [], dietary: [], spiceLevel: 0, isSignature: false, imageUrl: null, story: "", tags: [], modifiers: [], active: true, sort: 0, soldOut: false, popularity: 0, ...extra }) as unknown as Dish;

const menu: Dish[] = [
  dish("ckt", "Char Kway Teow", 1000, {
    translations: { zh: { name: "炒粿条" } },
    modifiers: [
      { name: "Size", min: 1, max: 1, options: [{ name: "Regular", price: 0 }, { name: "Large", price: 300 }] },
      { name: "Egg", min: 1, max: 1, options: [{ name: "Chicken egg", price: 0 }, { name: "Duck egg", price: 100 }] },
    ],
  } as Partial<Dish>),
  dish("cur", "Chicken Curry", 1200, { allergens: ["peanuts"] } as Partial<Dish>),
  dish("sug", "Sugarcane Juice", 350),
];
const ctx = { restaurant: { name: "Stall", cuisine: "", story: "", description: "" }, branchName: "KL", currency: "MYR", menuLanguage: "en", items: menu } as unknown as AssistantContext;
const money = (n: number) => `RM${(n / 100).toFixed(2)}`;
const fake = (json: unknown): ReaderCall => async () => JSON.stringify(json);

describe("a model's reading, checked against the menu", () => {
  it("drops a dish the menu doesn't have, an add-on that isn't the dish's, two sizes, and a silly count", () => {
    const r = checkReading(
      { lines: [{ dish: "D9", count: 1 }, { dish: "D1", count: 1, options: ["Large", "Regular"] }, { dish: "D1", count: 1, options: ["Extra cheese"] }, { dish: "D3", count: 50 }], unmatched: ["mee rebus"] },
      menu,
      () => true,
    );
    expect(r.lines.map((l) => [l.dish.name, l.options.map((o) => o.name)])).toEqual([["Char Kway Teow", []], ["Char Kway Teow", []]]);
    expect(r.unmatched).toEqual(["mee rebus", "D9"]);
    expect(r.dropped.join("; ")).toMatch(/2 of Size.*no "Extra cheese".*count 50/);
  });
  it("keeps only dishes the guest's own words name", () => {
    expect(grounded(menu[1], "nak kari ayam satu", menu)).toBe(true);
    expect(grounded(menu[0], "两碟炒粿条", menu)).toBe(true);
    expect(grounded(menu[2], "2 char kway teow", menu)).toBe(false);
    const r = checkReading({ lines: [{ dish: "D1", count: 2 }, { dish: "D2", count: 1 }] }, menu, () => true, "2 char kway teow please");
    expect(r.lines.map((l) => l.dish.name)).toEqual(["Char Kway Teow"]);
    expect(r.dropped).toContain("Chicken Curry isn't named in the message");
  });
  it("asks the model only for this menu's dish keys", () => {
    expect(JSON.stringify(readerSchema(menu))).toContain('"enum":["D1","D2","D3"]');
  });
  it("falls back to the rules when the model fails or returns no JSON", async () => {
    expect(await readWithModel(async () => "sorry, I can't", menu, "2 ckt", money)).toBeNull();
    expect(await readWithModel(async () => { throw new Error("down"); }, menu, "2 ckt", money)).toBeNull();
  });
});

describe("the brain with a model's reading", () => {
  const q = "2 char kway teow, one large, the other duck egg. and 1 sugarcane. total?";
  const reading = (json: unknown) => readWithModel(fake(json), menu, q, money);
  const lines = { lines: [{ dish: "D1", count: 1, options: ["Large"], off: [] }, { dish: "D1", count: 1, options: ["Duck egg"], off: [] }, { dish: "D3", count: 1, options: [], off: [] }], unmatched: [], total: true, each: false };
  it("prices what was read, the same as the rules read it, under either policy", async () => {
    const rules = answerGuest(ctx, [{ role: "user", content: q }]).answer;
    for (const readerPolicy of ["fill", "replace"] as const) {
      const r = answerGuest({ ...ctx, reading: (await reading(lines))!, readerPolicy }, [{ role: "user", content: q }]);
      expect(r.answer).toMatch(/RM27\.50/);
    }
    expect(rules).toMatch(/RM27\.50/);
    expect(linesKey((await reading(lines))!.lines)).toBe(linesKey(rulesLines(menu, q)));
  });
  it("under \"fill\" keeps the rules' reading when the model found fewer dishes; \"replace\" takes the model's", async () => {
    const said = "1 char kway teow and a tebu pls, berapa?";
    const r = (await readWithModel(fake({ lines: [{ dish: "D1", count: 1, options: [], off: [] }], unmatched: [], total: true, each: false }), menu, said, money))!;
    expect(answerGuest({ ...ctx, reading: r }, [{ role: "user", content: said }]).answer).toMatch(/RM13\.50/);
    expect(answerGuest({ ...ctx, reading: r, readerPolicy: "fill" }, [{ role: "user", content: said }]).answer).toMatch(/RM13\.50/);
    expect(answerGuest({ ...ctx, reading: r, readerPolicy: "replace" }, [{ role: "user", content: said }]).answer).toMatch(/RM10\.00\b(?!.*RM3\.50)/);
  });
  it("never makes an allergy answer less safe", async () => {
    const said = "allergic to peanuts. 1 chicken curry ok?";
    const r = (await readWithModel(fake({ lines: [{ dish: "D2", count: 1, options: [], off: [] }], unmatched: [], total: false, each: false }), menu, said, money))!;
    const a = answerGuest({ ...ctx, reading: r, readerPolicy: "replace" }, [{ role: "user", content: said }]);
    expect(a.answer).toMatch(/peanut/i);
    expect(a.answer).toMatch(/not safe/);
  });
});

describe("the brain with a conversation reader's order", () => {
  const history = [
    { role: "user" as const, content: "2 char kway teow and 2 sugarcane" },
    { role: "assistant" as const, content: "2 Char Kway Teow RM20.00 and 2 Sugarcane Juice RM7.00: RM27.00." },
  ];
  const q = "make it 1 sugarcane only, and one of the kway teow large. total?";
  const conversation = [...history.map((h) => h.content), q];
  const basket = checkBasket({ lines: [{ dish: "D1", count: 1, options: ["Large"] }, { dish: "D1", count: 1 }, { dish: "D3", count: 1 }] }, menu, () => true, conversation);
  it("checks dishes against the whole conversation, not only the latest message", () => {
    expect(basket.lines.map((l) => l.dish.name)).toEqual(["Char Kway Teow", "Char Kway Teow", "Sugarcane Juice"]);
    expect(checkBasket({ lines: [{ dish: "D2", count: 1 }] }, menu, () => true, conversation).dropped).toContain("Chicken Curry isn't named in the message");
  });
  it("bills the order as it now stands, in place of the rules' edits to it", () => {
    const a = answerGuest({ ...ctx, basket, basketChanged: true, basketPolicy: "replace" }, [...history, { role: "user", content: q }]);
    expect(a.answer).toMatch(/RM26\.50/);
  });
  it("splits by whose each line is", () => {
    const owned = checkBasket({ lines: [{ dish: "D1", count: 2, owner: "me" }, { dish: "D3", count: 1, owner: "me" }, { dish: "D3", count: 1, owner: "friend" }] }, menu, () => true, conversation);
    const a = answerGuest({ ...ctx, basket: owned, basketPolicy: "replace" }, [...history, { role: "user", content: "my friend had one sugarcane, I had the rest. how much each?" }]);
    expect(a.answer).toMatch(/RM23\.50/);
    expect(a.answer).toMatch(/Friend.*RM3\.50/);
  });
  it("without a policy, leaves the rules' bill alone", () => {
    const rules = answerGuest(ctx, [...history, { role: "user", content: q }]).answer;
    expect(answerGuest({ ...ctx, basket }, [...history, { role: "user", content: q }]).answer).toBe(rules);
  });
});
