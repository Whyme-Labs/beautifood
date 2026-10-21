// Labels harvested guest questions (./harvest.ts) with a large model, offline, and adds the ones
// it is sure of to ./harvested.json, which the next training run learns from. The large model
// is a teacher here: it never answers guests. Without ANTHROPIC_API_KEY (or with --dry-run) it
// only shows what it would send.
//
//   ANTHROPIC_API_KEY=... npx tsx scripts/brain/label.ts [scripts/brain/to-label.json]
import { readFileSync, writeFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { INTENTS, type Intent } from "../../src/shared/brain/intentModel";
import { HARVESTED, type Harvested } from "./data";
import { asReadText, protectedQuestions } from "./evalsets";
import type { ToLabel } from "./harvest";

const MODEL = "claude-opus-5-5";
const BATCH = 40;

const MEANINGS: Record<Intent, string> = {
  recommend: "wants dish suggestions, with or without filters (diet, allergy, spice, budget, a course like drinks or desserts, appetite)",
  dish_allergen: "asks whether a specific dish contains an allergen or ingredient, or is safe or suitable for a diet",
  dish_info: "asks about one specific dish: what it is, its story, taste, size, spice, price",
  compare: "asks how two or more specific dishes differ, or which to choose between them",
  pairing: "asks what goes well with a specific dish (a drink, side or dessert)",
  group: "wants a plan for several people to share",
  refine: "narrows down dishes that were just shown (which of those is cheapest, any of them vegetarian)",
  about: "asks about the restaurant itself: its story, owners, cuisine",
  greeting: "says hello or asks for help without a question yet",
  thanks: "thanks or closes the conversation",
  order_help: "asks how to order or pay, or about service: the bill, toilets, wifi, takeaway, staff",
  out_of_scope: "anything not about this restaurant or its menu",
};

const prompt = (qs: ToLabel[]) => `You label questions guests type into a restaurant's menu assistant, so a small intent model can learn from them.
In each question, §dish stands for a dish on the menu and §num for a number. Questions may be in English, Malay, Manglish or Chinese.

Intents:
${INTENTS.map((i) => `- ${i}: ${MEANINGS[i]}`).join("\n")}

Label each question with exactly one intent. Set "sure" to false when the question is ambiguous, garbled, or could reasonably be two intents.
Reply with only a JSON array, one object per question, in order: [{"n": 1, "intent": "...", "sure": true}, ...]

Questions:
${qs.map((q, n) => `${n + 1}. ${q.question}`).join("\n")}`;

async function main() {
  const input = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "scripts/brain/to-label.json";
  const todo = JSON.parse(readFileSync(input, "utf8")) as ToLabel[];
  const dry = process.argv.includes("--dry-run") || !process.env.ANTHROPIC_API_KEY;
  if (dry) {
    console.log(`Dry run (${process.env.ANTHROPIC_API_KEY ? "--dry-run" : "no ANTHROPIC_API_KEY"}): ${todo.length} questions in ${Math.ceil(todo.length / BATCH)} requests to ${MODEL}.`);
    if (todo.length) console.log(prompt(todo.slice(0, Math.min(BATCH, todo.length))));
    return;
  }
  const client = new Anthropic();
  const guarded = protectedQuestions();
  const have = new Map(HARVESTED.map((h) => [asReadText(h.text), h]));
  let added = 0;
  let unsure = 0;
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const msg = await client.messages.create({ model: MODEL, max_tokens: 4000, messages: [{ role: "user", content: prompt(batch) }] });
    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const labels = JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1)) as { n: number; intent: string; sure: boolean }[];
    for (const l of labels) {
      const q = batch[l.n - 1];
      if (!q || !INTENTS.includes(l.intent as Intent)) continue;
      if (!l.sure) {
        unsure++;
        continue;
      }
      const key = asReadText(q.question);
      // never an eval question, never twice
      if (guarded.has(key) || have.has(key)) continue;
      have.set(key, { text: key, intent: l.intent as Intent });
      added++;
    }
    console.log(`labelled ${Math.min(i + BATCH, todo.length)} of ${todo.length}`);
  }
  const out: Harvested[] = [...have.values()].sort((a, b) => a.intent.localeCompare(b.intent) || a.text.localeCompare(b.text));
  writeFileSync(new URL("./harvested.json", import.meta.url), `${JSON.stringify(out, null, 2)}\n`);
  console.log(`${added} new examples (${unsure} left out as unsure); ${out.length} harvested in all. Next: npx tsx scripts/brain/train.ts`);
}

await main();
