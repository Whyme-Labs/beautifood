// Which generated training questions read exactly like an eval or benchmark question, and from which set.
//   npx tsx scripts/brain/leaks.ts
import { generate } from "./data";
import { asRead } from "./evalsets";
import { EVAL_CASES, MORE_CASES, sampleDishes } from "../../src/shared/assistantEval";
import { HELD_OUT } from "../../test/unit/brainIntents";
import { FINAL_CASES } from "../../test/unit/brainFinal";
import { loadCases, loadMenu } from "../../bench/run";
import { modelTokens, read, type Dish } from "../../src/server/ai/brain/understand";

const hawker = sampleDishes() as unknown as Dish[];
const sets: [string, string[]][] = [
  ["eval", [...EVAL_CASES, ...MORE_CASES].flatMap((c) => [c.question, ...(c.before ?? []).map((b) => b.question)]).map((q) => asRead(hawker, q))],
  ["held-out", HELD_OUT.map(([q]) => asRead(hawker, q))],
  ["final", FINAL_CASES.flatMap((c) => [c.question]).map((q) => asRead(hawker, q))],
  ["bench", [...loadCases("all"), ...loadCases("all", "heldout"), ...loadCases("all", "v3")].flatMap((c) => [c.question, ...(c.before ?? []).map((b) => b.user)].map((q) => asRead(loadMenu(c.menu).items as unknown as Dish[], q)))],
];
const seen = new Map<string, number>();
for (const e of generate(2500)) {
  const t = modelTokens(read(e.items, e.text).delexicalized).join(" ");
  if (t.split(" ").length > 2) seen.set(t, (seen.get(t) ?? 0) + 1);
}
for (const [name, qs] of sets) {
  const hit = [...new Set(qs)].filter((q) => seen.has(q));
  console.log(`${name}: ${hit.length} of ${new Set(qs).size} questions appear in training (${hit.reduce((s, q) => s + seen.get(q)!, 0)} examples)`);
  for (const q of hit.slice(0, 40)) console.log(`   ${q}  ×${seen.get(q)}`);
}
