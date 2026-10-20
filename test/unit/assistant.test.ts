import { describe, expect, it } from "vitest";
import { parseMenuText } from "../../src/shared/menuParser";
import { SAMPLE_MENU } from "../../src/server/dev/sample";
import { answerLocally, type AssistantContext } from "../../src/server/ai/local";

// The sample hawker menu, as the free engine sees it.
const items = parseMenuText(SAMPLE_MENU).items.map((p, n) => ({
  id: `it${n}`, categoryId: p.category, category: p.category, name: p.name, description: p.description, price: p.price, imageUrl: null,
  allergens: p.allergens, dietary: p.dietary, spiceLevel: p.spiceLevel, story: "", isSignature: p.isSignature,
  tags: [], station: p.station, modifiers: [], active: true, sort: n, soldOut: false, popularity: 0,
}));
const ctx = { restaurant: { name: "Ah Seng", cuisine: "", story: "", description: "" }, branchName: "KLCC", currency: "MYR", items, menuLanguage: "en" } as unknown as AssistantContext;
const picks = (q: string) => answerLocally(ctx, q, "en").items.map((x) => items.find((i) => i.id === x.id)!);

describe("the free menu assistant in Malay and Manglish", () => {
  it("'tak pedas' / 'not pedas' means not spicy, never the spiciest dishes", () => {
    for (const q of ["ada makanan tak pedas?", "got anything not pedas ah?", "kurang pedas boleh?", "tak nak pedas"]) {
      const p = picks(q);
      expect(p.length, q).toBeGreaterThan(0);
      expect(p.every((i) => i.spiceLevel === 0), q).toBe(true);
    }
    expect(picks("nak yang pedas").every((i) => i.spiceLevel > 0)).toBe(true);
  });

  it("'alergi kacang' is a nut allergy: it suggests dishes without nuts and carries the safety note", () => {
    const r = answerLocally(ctx, "saya alergi kacang, boleh makan apa?", "en");
    expect(r.safetyNote).toBeTruthy();
    expect(r.items.length).toBeGreaterThan(0);
    for (const x of r.items) expect(items.find((i) => i.id === x.id)!.allergens).not.toContain("peanuts");
  });

  it("Malay seafood words are allergens", () => {
    const p = picks("alergi udang dan sotong");
    expect(p.length).toBeGreaterThan(0);
    expect(p.every((i) => !i.allergens.includes("crustaceans") && !i.allergens.includes("molluscs"))).toBe(true);
  });

  it("the dish Ais Kacang is still a dish", () => {
    expect(answerLocally(ctx, "what is ais kacang?", "en").items[0]?.name).toBe("Ais Kacang");
  });
});

describe("the free engine against the guest promises", () => {
  it("passes every safety case, and the plain asks", async () => {
    const { EVAL_CASES, score, sampleDishes } = await import("../../src/shared/assistantEval");
    const dishes = sampleDishes();
    const c2 = { ...ctx, items: dishes.map((d, n) => ({ ...d, categoryId: d.category, imageUrl: null, story: "", tags: [], modifiers: [], active: true, sort: n, soldOut: false, popularity: 0 })) } as unknown as AssistantContext;
    const s = score(
      EVAL_CASES.map((c) => {
        const r = answerLocally(c2, c.question, c.lang);
        return { c, r: { answer: r.answer, safetyNote: r.safetyNote, dishes: r.items.map((x) => dishes.find((d) => d.id === x.id)!).filter(Boolean) } };
      }),
    );
    expect(s.unsafe).toEqual([]);
    // conversational asks (vague, pairing, group, follow-up, compare) are what a model is for
    expect(s.passed).toBeGreaterThanOrEqual(17);
  });
});
