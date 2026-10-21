import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { EVAL_CASES, MORE_CASES, sampleDishes, score, type EvalCase } from "../../src/shared/assistantEval";
import { parseMenuText } from "../../src/shared/menuParser";
import { WEIGHTS } from "../../src/shared/brain/weights.gen";
import { normalize } from "../../src/shared/brain/text";
import { answerGuest } from "../../src/server/ai/brain";
import { correct, read, understand, type Dish } from "../../src/server/ai/brain/understand";
import type { AssistantContext } from "../../src/server/ai/local";
import { dataHash, TEMPLATES } from "../../scripts/brain/data";
import { HELD_OUT } from "./brainIntents";
import { CAFE_MENU, FINAL_CASES } from "./brainFinal";

const asItems = (dishes: Omit<Dish, "translations">[]) =>
  dishes.map((d, n) => ({ ...d, categoryId: d.category, imageUrl: null, story: "", tags: [], modifiers: [], active: true, sort: n, soldOut: false, popularity: 0 }));
const hawker = sampleDishes();
const ctx = { restaurant: { name: "Ah Seng", cuisine: "Malaysian", story: "", description: "" }, branchName: "KLCC", currency: "MYR", menuLanguage: "en", items: asItems(hawker) } as unknown as AssistantContext;
const cafeDishes = parseMenuText(CAFE_MENU).items.map((p, n) => ({ id: `c${n}`, name: p.name, category: p.category, description: p.description, price: p.price, allergens: p.allergens, dietary: p.dietary, spiceLevel: p.spiceLevel, isSignature: p.isSignature }));
const cafe = { ...ctx, restaurant: { name: "Kopi & Co", cuisine: "", story: "", description: "" }, items: asItems(cafeDishes) } as unknown as AssistantContext;

const turns = (c: EvalCase) => [...(c.before ?? []).flatMap((b) => [{ role: "user" as const, content: b.question }, { role: "assistant" as const, content: b.answer }]), { role: "user" as const, content: c.question }];
function run(context: AssistantContext, dishes: { id: string }[], cases: EvalCase[]) {
  return score(
    cases.map((c) => {
      const r = answerGuest(context, turns(c), c.lang);
      return { c, r: { answer: r.answer, safetyNote: r.safetyNote, dishes: r.items.map((x) => dishes.find((d) => d.id === x.id)!).filter(Boolean) as never } };
    }),
  );
}

describe("the intent model", () => {
  it("was trained on the current data (retrain with scripts/brain/train.ts)", () => {
    expect(WEIGHTS.dataHash).toBe(dataHash());
  });

  it("is small enough to ship in the Worker", () => {
    expect(readFileSync("src/shared/brain/weights.gen.ts").length).toBeLessThan(400_000);
  });

  it("reads questions it never trained on, about a menu it never saw", () => {
    const items = hawker as unknown as Dish[];
    const wrong = HELD_OUT.filter(([q, want]) => understand(items, q).intent !== want);
    expect(1 - wrong.length / HELD_OUT.length, wrong.map(([q]) => q).join(" | ")).toBeGreaterThanOrEqual(0.9);
  });

  it("didn't see the held-out questions in training", () => {
    const templates = new Set(Object.values(TEMPLATES).flat().map((t) => normalize(t)));
    expect(HELD_OUT.filter(([q]) => templates.has(normalize(q)))).toEqual([]);
  });

  it("says when a question isn't one it can read", () => {
    for (const q of ["zxqvbn", "lorem ipsum dolor", "ggggg"]) expect(understand(hawker as unknown as Dish[], q).intent, q).toBe("out_of_scope");
  });
});

describe("what it reads from a question", () => {
  const items = hawker as unknown as Dish[];
  const r = (q: string) => read(items, q);

  it("handles negation around spice, in every language guests use", () => {
    for (const q of ["not spicy please", "tak pedas", "x pedas", "no chilli", "can't take spicy food", "我不吃辣", "for my kid"]) expect(r(q).maxSpice, q).toBe(0);
    for (const q of ["not too spicy", "a little spicy", "pedas sikit", "微辣"]) expect(r(q).maxSpice, q).toBe(1);
    for (const q of ["very spicy", "pedas gila", "特辣"]) expect(r(q).minSpice, q).toBe(2);
    expect(r("something spicy").minSpice).toBe(1);
  });

  it("finds dishes by part of the name and through typos, but not by an allergen word", () => {
    expect(r("does the char kuey teow have prawns").dishes.map((d) => d.name)).toEqual(["Char Kway Teow"]);
    expect(r("laksa or curry mee").dishes.map((d) => d.name)).toEqual(["Penang Assam Laksa", "Curry Mee"]);
    expect(r("tell me abt the nasi lemack").dishes[0]?.name).toBe("Nasi Lemak Ayam Rempah");
    expect(r("saya alergi kacang").dishes).toEqual([]);
    expect(r("satay ada kacang tak").dishes.map((d) => d.name)).toEqual(["Satay (6 sticks)"]);
    expect(r("what is ais kacang").dishes[0]?.name).toBe("Ais Kacang");
    // "vegetarian" is a diet, not the dish Vegetarian Mee Goreng
    expect(r("anything vegetarian?")).toMatchObject({ dishes: [], diet: ["vegetarian"] });
  });

  it("reads party sizes, budgets and allergens to avoid", () => {
    expect(r("we are 4 people").party).toBe(4);
    expect(r("kami berlima").party).toBe(5);
    expect(r("我们六个人").party).toBe(6);
    expect(r("table of 5").party).toBe(5);
    expect(r("satay (6 sticks)").party).toBeNull();
    expect(r("under RM15.50").budget).toBe(1550);
    expect(r("15块以下").budget).toBe(1500);
    expect(r("two of us, about RM40").amount).toBe(4000);
    expect(r("no seafood please").avoid).toEqual(expect.arrayContaining(["fish", "crustaceans", "molluscs"]));
    expect(r("我不能吃海鲜").avoid).toContain("fish");
    // asking about a dish isn't avoiding: "does it have nuts" wants the answer, not a filter
    expect(r("does satay have peanuts").avoid).toEqual([]);
  });

  it("puts misspelt keywords right, and leaves real words alone", () => {
    expect(correct("vegeterian")).toBe("vegetarian");
    expect(correct("reccomend")).toBe("recommend");
    expect(correct("desert")).toBe("dessert");
    for (const w of ["there", "these", "daily", "price"]) expect(correct(w)).toBe(w);
  });
});

describe("the menu brain against the guest promises", () => {
  it("passes the core cases, every safety case among them", () => {
    const s = run(ctx, hawker, EVAL_CASES);
    expect(s.unsafe).toEqual([]);
    expect(s.passed, JSON.stringify(s.results.filter((x) => !x.pass))).toBe(s.total);
  });

  it("passes the conversations, typos, Malay and Chinese", () => {
    const s = run(ctx, hawker, MORE_CASES);
    expect(s.unsafe).toEqual([]);
    expect(s.passed, JSON.stringify(s.results.filter((x) => !x.pass))).toBe(s.total);
  });

  it("does as well on a café it was never tuned on (first run: 35 of 38, none unsafe)", () => {
    const s = run(cafe, cafeDishes, FINAL_CASES);
    expect(s.unsafe).toEqual([]);
    expect(s.passed / s.total, JSON.stringify(s.results.filter((x) => !x.pass))).toBeGreaterThanOrEqual(0.9);
  });
});

describe("what it learns from orders", () => {
  it("pairs dishes guests here order together", () => {
    const curry = ctx.items.find((i) => i.name === "Curry Mee")!;
    const teh = ctx.items.find((i) => i.name === "Teh Tarik")!;
    const without = answerGuest(ctx, [{ role: "user", content: "what drink goes with curry mee?" }]);
    expect(without.items[0].name).not.toBe("Teh Tarik");
    const counts = Object.fromEntries(ctx.items.map((i) => [i.id, 20]));
    const learnt = { ...ctx, totalOrders: 200, orderCounts: { ...counts, [curry.id]: 40, [teh.id]: 40 }, together: { [curry.id]: { [teh.id]: 30 } } } as AssistantContext;
    const r = answerGuest(learnt, [{ role: "user", content: "what drink goes with curry mee?" }]);
    expect(r.items[0].name).toBe("Teh Tarik");
    expect(r.answer).toMatch(/often order them together/);
  });

  it("only suggests what's on now", () => {
    const soldOut = { ...ctx, items: ctx.items.map((i) => (i.name === "Fresh Lime Juice" ? { ...i, soldOut: true } : i)) } as AssistantContext;
    const r = answerGuest(soldOut, [{ role: "user", content: "what drink goes with curry mee?" }]);
    expect(r.items.map((i) => i.name)).not.toContain("Fresh Lime Juice");
  });
});

describe("conversation", () => {
  it("keeps an allergy for the rest of the chat", () => {
    const r = answerGuest(ctx, [
      { role: "user", content: "my daughter is allergic to peanuts" },
      { role: "assistant", content: "Noted." },
      { role: "user", content: "we're 3, what should we share?" },
    ]);
    expect(r.items.length).toBeGreaterThanOrEqual(3);
    for (const x of r.items) expect(ctx.items.find((i) => i.id === x.id)!.allergens).not.toContain("peanuts");
    expect(r.safetyNote).toBeTruthy();
  });

  it("answers in Chinese, with the dish names the menu gives in Chinese", () => {
    const zhCtx = { ...ctx, items: ctx.items.map((i) => (i.name === "Char Kway Teow" ? { ...i, translations: { zh: { name: "炒粿条" } } } : i)) } as AssistantContext;
    const r = answerGuest(zhCtx, [{ role: "user", content: "炒粿条有虾吗？" }], "zh");
    expect(r.items[0].name).toBe("Char Kway Teow");
    expect(r.answer).toContain("炒粿条");
    expect(r.answer).toContain("甲壳");
  });
});
