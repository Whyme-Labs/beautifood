// The hybrid avoid reader's contract: a model's reading is checked against a fixed vocabulary and only
// ever added to what the rules read, so it can make an answer more careful but never less safe.
import { describe, expect, it } from "vitest";
import { cleanHint, hintIsEmpty, hintItems, parseHint, EMPTY_HINT, type AvoidHint } from "../../src/shared/brain/avoidHint";
import { hintAdds, withHint } from "../../src/server/ai/brain/hint";
import { answerGuest } from "../../src/server/ai/brain";
import { understand, type Dish } from "../../src/server/ai/brain/understand";
import { sampleDishes } from "../../src/shared/assistantEval";
import type { AssistantContext } from "../../src/server/ai/local";

const items = (sampleDishes() as Omit<Dish, "translations">[]).map((d, n) => ({ ...d, categoryId: d.category, imageUrl: null, story: "", tags: [], modifiers: [], active: true, sort: n, soldOut: false, popularity: 0 }));
const ctx = { restaurant: { name: "Ah Seng", cuisine: "Malaysian", story: "", description: "" }, branchName: "KLCC", currency: "MYR", menuLanguage: "en", items } as unknown as AssistantContext;
const seafood: AvoidHint = { allergens: ["fish", "crustaceans", "molluscs"], diets: [], meats: [], alcohol: false };
const SEAFOOD_DISHES = ["Char Kway Teow", "Penang Assam Laksa", "Curry Mee", "Nasi Lemak Ayam Rempah", "Nasi Kerabu", "Rojak"];

describe("avoid hint: the vocabulary check", () => {
  it("keeps only the app's own allergens, diets and meats", () => {
    expect(cleanHint({ allergens: ["fish", "shellfish", "peanuts", 3], diets: ["vegan", "keto"], meats: ["pork", "goat"], alcohol: "yes" })).toEqual({ allergens: ["fish", "peanuts"], diets: ["vegan"], meats: ["pork"], alcohol: false });
    expect(cleanHint(null)).toBeNull();
    expect(cleanHint("fish")).toBeNull();
  });
  it("reads the model's JSON, in a code fence or not", () => {
    expect(parseHint('```json\n{"allergens":["egg"],"diets":[],"meats":[],"alcohol":true}\n```')).toEqual({ allergens: ["egg"], diets: [], meats: [], alcohol: true });
    expect(parseHint("I can't tell")).toBeNull();
    expect(parseHint("{not json}")).toBeNull();
  });
  it("lists a hint as flat items", () => {
    expect(hintItems({ allergens: ["egg"], diets: ["halal"], meats: ["beef"], alcohol: true })).toEqual(["allergen:egg", "diet:halal", "meat:beef", "alcohol"]);
    expect(hintIsEmpty(EMPTY_HINT)).toBe(true);
  });
});

describe("avoid hint: only ever added", () => {
  it("adds what the rules missed and keeps what they read", () => {
    const u = understand(items as never, "I'm allergic to peanuts, what's good?");
    const h = withHint(u, { allergens: ["egg"], diets: ["vegan"], meats: ["beef"], alcohol: true });
    expect(h.avoid).toEqual(expect.arrayContaining(["peanuts", "egg"]));
    expect(h.stated).toEqual(expect.arrayContaining(["peanuts", "egg"]));
    expect(h.statedDiet).toContain("vegan");
    expect(h.noMeat).toContain("beef");
    expect(h.noAlcohol).toBe(true);
  });
  it("an empty hint, or one that says less, takes nothing away", () => {
    const u = understand(items as never, "I'm allergic to peanuts and I don't drink");
    for (const hint of [EMPTY_HINT, null, undefined]) {
      const h = withHint(u, hint);
      expect(h.avoid).toEqual(expect.arrayContaining(u.avoid));
      expect(h.noAlcohol).toBe(u.noAlcohol);
    }
  });
  it("says what the hint added beyond the rules", () => {
    const u = understand(items as never, "I'm allergic to peanuts");
    expect(hintAdds(u, { allergens: ["peanuts", "sesame"], diets: [], meats: [], alcohol: false })).toEqual(["allergen:sesame"]);
  });
});

describe("avoid hint: in an answer", () => {
  const ask = (q: string, hint?: AvoidHint) => answerGuest(ctx, [{ role: "user", content: q, hint }]);
  it("keeps seafood off the recommendations when the hint reads it", () => {
    const r = ask("what do you recommend? doctor says no ocean stuff for me", seafood);
    expect(ask("what do you recommend? doctor says no ocean stuff for me").items.some((i) => SEAFOOD_DISHES.includes(i.name))).toBe(true);
    expect(r.items.map((i) => i.name).filter((n) => SEAFOOD_DISHES.includes(n))).toEqual([]);
    expect(r.hintAdded?.length).toBeGreaterThan(0);
  });
  it("still applies a hint from an earlier turn", () => {
    const r = answerGuest(ctx, [
      { role: "user", content: "hi, doctor says no ocean stuff for me", hint: seafood },
      { role: "assistant", content: "Noted." },
      { role: "user", content: "what's good for lunch?" },
    ]);
    expect(r.items.map((i) => i.name).filter((n) => SEAFOOD_DISHES.includes(n))).toEqual([]);
  });
  it("without a hint the rules answer as before", () => {
    const plain = ask("what do you recommend?");
    const hinted = ask("what do you recommend?", EMPTY_HINT);
    expect(hinted.answer).toBe(plain.answer);
    expect(hinted.hintAdded).toBeUndefined();
  });
});
