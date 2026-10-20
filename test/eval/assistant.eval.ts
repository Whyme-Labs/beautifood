// How smart is each small model at what we promise guests? Scores every model in EVAL_MODELS on
// the guest cases twice: the model alone, and the assistant as deployed (the rules engine first,
// the model only for what it can't answer, the allergen guard on every model answer).
// Writes test-results/assistant-eval.json and a Markdown table for the CI summary.
import { it } from "vitest";
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { EVAL_CASES, dishesNamed, sampleDishes, score, type EvalReply } from "../../src/shared/assistantEval";
import { answerWithModel, workersAiRest } from "../../src/server/ai/guestModel";
import { answerLocally, type AssistantContext, type AssistantReply } from "../../src/server/ai/local";
import { guard } from "../../src/server/ai/index";
import { costMicros } from "../../src/server/ai/usage";

const dishes = sampleDishes();
const ctx = {
  restaurant: { name: "Ah Seng", cuisine: "Malaysian hawker", story: "We started in 1998 as a Penang hawker stall.", description: "" },
  branchName: "KLCC",
  currency: "MYR",
  menuLanguage: "en",
  items: dishes.map((d, n) => ({ ...d, categoryId: d.category, imageUrl: null, story: "", tags: [], modifiers: [], active: true, sort: n, soldOut: false, popularity: 0 })),
} as unknown as AssistantContext;

const toEval = (r: AssistantReply): EvalReply => {
  const cards = r.items.map((x) => dishes.find((d) => d.id === x.id)!).filter(Boolean);
  const named = dishesNamed(r.answer, dishes);
  return { answer: r.answer, safetyNote: r.safetyNote ?? (/allerg|过敏|alergi|confirm with staff|check with/i.test(r.answer) ? "said" : undefined), dishes: [...new Map([...named, ...cards].map((d) => [d.id, d])).values()] };
};

it("scores the models", async () => {
  const account = process.env.CF_ACCOUNT_ID;
  const token = process.env.CF_API_TOKEN;
  const models = (process.env.EVAL_MODELS ?? "@cf/google/gemma-4-26b-a4b-it").split(",").map((m) => m.trim()).filter(Boolean);
  if (!account || !token) throw new Error("Set CF_ACCOUNT_ID and CF_API_TOKEN");
  const ai = workersAiRest(account, token);
  const out: Record<string, unknown>[] = [];
  const md = ["| Model | Model alone | As deployed | Unsafe (alone / deployed) | Avg seconds | Cost per model answer |", "|---|---|---|---|---|---|"];
  for (const model of models) {
    const alone: { c: (typeof EVAL_CASES)[number]; r: EvalReply }[] = [];
    const deployed: typeof alone = [];
    let secs = 0;
    let micros = 0;
    let calls = 0;
    const errors: string[] = [];
    for (const c of EVAL_CASES) {
      const history = [...(c.before ?? []).flatMap((b) => [{ role: "user" as const, content: b.question }, { role: "assistant" as const, content: b.answer }]), { role: "user" as const, content: c.question }];
      const uses: { model: string; input: number; output: number }[] = [];
      const t0 = Date.now();
      let r: AssistantReply;
      try {
        r = await answerWithModel({ provider: "workers-ai", model, ai }, ctx, history, c.lang, (u) => uses.push(u));
      } catch (e) {
        errors.push(`${c.question}: ${(e as Error).message}`);
        r = { answer: `(error) ${(e as Error).message}`, items: [], engine: "model" };
      }
      secs += (Date.now() - t0) / 1000;
      calls++;
      micros += uses.reduce((n, u) => n + costMicros(u), 0);
      alone.push({ c, r: toEval(r) });
      const local = answerLocally(ctx, c.question, c.lang);
      deployed.push({ c, r: toEval(local.confident ? local : guard(ctx, c.question, r, local, c.lang)) });
    }
    const a = score(alone);
    const d = score(deployed);
    out.push({ model, alone: a, deployed: d, avgSeconds: +(secs / calls).toFixed(2), avgCostUsd: micros / calls / 1e6, errors });
    md.push(`| \`${model}\` | ${a.passed}/${a.total} | ${d.passed}/${d.total} | ${a.unsafe.length} / ${d.unsafe.length} | ${(secs / calls).toFixed(1)} | $${(micros / calls / 1e6).toFixed(5)} |`);
    console.log(`\n=== ${model}: alone ${a.passed}/${a.total} (unsafe ${a.unsafe.length}), deployed ${d.passed}/${d.total} (unsafe ${d.unsafe.length})`);
    for (const x of a.results) console.log(`${x.pass ? "PASS" : "FAIL"} [${x.kind}] ${x.question}\n      → ${x.answer.replace(/\s+/g, " ").slice(0, 160)}`);
    if (errors.length) console.log("errors:", errors.slice(0, 5));
  }
  const unreachable = out.filter((m) => (m.errors as string[]).length === EVAL_CASES.length).map((m) => m.model);
  if (unreachable.length) console.log(`\nNo answers at all from: ${unreachable.join(", ")} (check the token has Workers AI permission)`);
  const engine = score(EVAL_CASES.map((c) => ({ c, r: toEval(answerLocally(ctx, c.question, c.lang)) })));
  md.push(`| rules engine only (free) | — | ${engine.passed}/${engine.total} | — / ${engine.unsafe.length} | 0.0 | $0 |`);
  mkdirSync("test-results", { recursive: true });
  writeFileSync("test-results/assistant-eval.json", JSON.stringify({ at: new Date().toISOString(), engine, models: out }, null, 2));
  console.log(`\n${md.join("\n")}`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Guest assistant: how smart is each model?\n\n${md.join("\n")}\n`);
  if (unreachable.length === models.length) throw new Error(`No model answered: ${(out[0]?.errors as string[] | undefined)?.[0] ?? "unknown error"}`);
});
