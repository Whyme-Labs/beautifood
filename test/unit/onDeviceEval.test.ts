import { describe, expect, it } from "vitest";
import { EVAL_CASES, sampleDishes } from "../../src/shared/assistantEval";
import { caseMessages, menuLines, replyFromText, safetyNoteFor, withoutSystem } from "../../src/shared/onDeviceEval";

const dishes = sampleDishes();
const byKind = (k: string) => EVAL_CASES.find((c) => c.kind === k)!;

describe("the on-device lab prompt and scoring", () => {
  it("puts the whole menu in compact lines, with prices in RM", () => {
    const lines = menuLines(dishes).split("\n");
    expect(lines).toHaveLength(dishes.length);
    const ckt = JSON.parse(lines.find((l) => l.includes("Char Kway Teow"))!);
    expect(ckt).toMatchObject({ rm: 16.9, signature: true });
    expect(ckt.allergens).toContain("crustaceans");
  });

  it("replays an earlier exchange before a follow-up, and folds the system turn when asked", () => {
    const m = caseMessages(byKind("followup"), dishes);
    expect(m.map((x) => x.role)).toEqual(["system", "user", "assistant", "user"]);
    const folded = withoutSystem(m);
    expect(folded.map((x) => x.role)).toEqual(["user", "assistant", "user"]);
    expect(folded[0].content).toContain("MENU");
  });

  it("the safety note: allergy words count; 'check with staff' only counts on allergy cases", () => {
    const allergy = byKind("allergy");
    const diet = byKind("diet");
    expect(safetyNoteFor(diet, "Cendol has no peanuts; it is listed with the allergen milk.")).toBeTruthy();
    expect(safetyNoteFor(diet, "我对花生过敏")).toBeTruthy();
    expect(safetyNoteFor(diet, "Saya alergi kacang")).toBeTruthy();
    expect(safetyNoteFor(allergy, "Try the Garden Salad, but please check with our staff.")).toBeTruthy();
    expect(safetyNoteFor(diet, "Try the Garden Salad, but please check with our staff.")).toBeUndefined();
    expect(safetyNoteFor(allergy, "Try the Garden Salad, be careful.")).toBeUndefined();
  });

  it("a dish named without its bracketed note still counts (Satay is not safe for peanuts)", () => {
    const c = byKind("allergy");
    const r = replyFromText(c, "You could have the Satay or Garden Salad. Please tell staff about your allergy.", dishes);
    expect(r.dishes.map((d) => d.name)).toEqual(["Satay (6 sticks)", "Garden Salad"]);
    expect(c.check(r)).toBe(false);
  });
});
