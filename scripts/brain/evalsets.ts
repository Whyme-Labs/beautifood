// The eval sets the training gate scores, and the questions that must never be trained on.
import { EVAL_CASES, MORE_CASES, sampleDishes, score, type EvalCase } from "../../src/shared/assistantEval";
import { parseMenuText } from "../../src/shared/menuParser";
import { normalize } from "../../src/shared/brain/text";
import { answerGuest } from "../../src/server/ai/brain";
import { modelTokens, read, understand, type Dish } from "../../src/server/ai/brain/understand";
import type { AssistantContext } from "../../src/server/ai/local";
import { HELD_OUT } from "../../test/unit/brainIntents";
import { CAFE_MENU, FINAL_CASES } from "../../test/unit/brainFinal";
import { existsSync } from "node:fs";
import { loadCases, loadMenu } from "../../bench/run";

const asItems = (dishes: Dish[]) => dishes.map((d, n) => ({ ...d, categoryId: d.category, imageUrl: null, story: "", tags: [], modifiers: [], active: true, sort: n, soldOut: false, popularity: 0 }));
const hawker = sampleDishes() as unknown as Dish[];
const cafeDishes: Dish[] = parseMenuText(CAFE_MENU).items.map((p, n) => ({ id: `c${n}`, name: p.name, category: p.category, description: p.description, price: p.price, allergens: p.allergens, dietary: p.dietary, spiceLevel: p.spiceLevel, isSignature: p.isSignature }));
const context = (name: string, dishes: Dish[]) =>
  ({ restaurant: { name, cuisine: "", story: "", description: "" }, branchName: "Main", currency: "MYR", menuLanguage: "en", items: asItems(dishes) }) as unknown as AssistantContext;

/** A question as the intent model reads it, for comparing across menus. */
export const asRead = (items: Dish[], q: string) => modelTokens(read(items, q).delexicalized).join(" ");
/** The same for a logged question (already delexicalised): normalised like read() does, § tokens kept. */
export const asReadText = (delexicalized: string) =>
  modelTokens(delexicalized.split(/\s+/).flatMap((w) => (w.startsWith("§") ? [w] : normalize(w).split(" ")).filter(Boolean))).join(" ");

/** Every eval and held-out question, as the model reads it: none may be trained on. */
export function protectedQuestions(): Set<string> {
  return new Set([
    ...[...EVAL_CASES, ...MORE_CASES].flatMap((c) => [c.question, ...(c.before ?? []).map((b) => b.question)]).map((q) => asRead(hawker, q)),
    ...HELD_OUT.map(([q]) => asRead(hawker, q)),
    ...FINAL_CASES.flatMap((c) => [c.question, ...(c.before ?? []).map((b) => b.question)]).map((q) => asRead(cafeDishes, q)),
    // the benchmark, both splits (bench/): never trained on either
    ...(existsSync(new URL("../../bench/cases", import.meta.url)) ? [...loadCases("all"), ...loadCases("all", "heldout"), ...loadCases("all", "v3"), ...loadCases("all", "v4"), ...loadCases("all", "v5")] : []).flatMap((c) => {
      const items = loadMenu(c.menu).items as unknown as Dish[];
      return [c.question, ...(c.before ?? []).map((b) => b.user)].map((q) => asRead(items, q));
    }),
  ]);
}

function run(ctx: AssistantContext, cases: EvalCase[]) {
  return score(
    cases.map((c) => {
      const history = [...(c.before ?? []).flatMap((b) => [{ role: "user" as const, content: b.question }, { role: "assistant" as const, content: b.answer }]), { role: "user" as const, content: c.question }];
      const r = answerGuest(ctx, history, c.lang);
      return { c, r: { answer: r.answer, safetyNote: r.safetyNote, dishes: r.items.map((x) => ctx.items.find((d) => d.id === x.id)!).filter(Boolean) as never } };
    }),
  );
}

export interface Scores {
  core: number;
  more: number;
  final: number;
  unsafe: number;
  /** Held-out intent accuracy, 0..1. */
  intents: number;
}

/** The current intent model (see useWeights) on every eval set. */
export function evaluate(): Scores {
  const core = run(context("Ah Seng", hawker), EVAL_CASES);
  const more = run(context("Ah Seng", hawker), MORE_CASES);
  const final = run(context("Kopi & Co", cafeDishes), FINAL_CASES);
  const intents = HELD_OUT.filter(([q, want]) => understand(hawker, q).intent === want).length / HELD_OUT.length;
  return { core: core.passed, more: more.passed, final: final.passed, unsafe: core.unsafe.length + more.unsafe.length + final.unsafe.length, intents };
}

/** Whether a candidate is no worse than the current model on any set, and never unsafe. */
export function passesGate(candidate: Scores, current: Scores): { ok: boolean; why: string[] } {
  const why: string[] = [];
  if (candidate.unsafe > 0) why.push(`${candidate.unsafe} unsafe answers`);
  for (const k of ["core", "more", "final", "intents"] as const) if (candidate[k] < current[k]) why.push(`${k}: ${candidate[k]} < ${current[k]}`);
  return { ok: !why.length, why };
}
