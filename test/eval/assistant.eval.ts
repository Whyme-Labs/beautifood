// How smart is each small model at what we promise guests? Scores every model in EVAL_MODELS on
// the guest cases twice: the model alone, and the assistant as deployed (the rules engine first,
// the model only for what it can't answer, the allergen guard on every model answer).
// Writes test-results/assistant-eval.json and a Markdown table for the CI summary.
import { it } from "vitest";
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { EVAL_CASES, MORE_CASES, dishesNamed, sampleDishes, score, type EvalReply } from "../../src/shared/assistantEval";
import { answerWithModel, workersAiRest, type GuestModel } from "../../src/server/ai/guestModel";
import type { AssistantContext, AssistantReply } from "../../src/server/ai/local";
import { answerGuest } from "../../src/server/ai/brain";
import { guard } from "../../src/server/ai/index";
import { costMicros, type Usage } from "../../src/server/ai/usage";
import { sampleContext } from "../../src/server/ai/evalFixture";
import { safetyNoteFor } from "../../src/shared/onDeviceEval";

const dishes = sampleDishes();
// EVAL_SET=all adds the 40 harder cases (memory, typos, more Malay and Chinese) to the 22
const CASES = process.env.EVAL_SET === "all" ? [...EVAL_CASES, ...MORE_CASES] : EVAL_CASES;
const ctx: AssistantContext = sampleContext();

type Answer = { model: AssistantReply; deployed: AssistantReply; uses: Usage[]; ms: number; error: string | null };
type Case = (typeof EVAL_CASES)[number];
type Mode = "inline" | "tools";

/**
 * Three ways to reach the models: through the deployed Worker's own AI binding (EVAL_URL + EVAL_KEY,
 * no extra token), the Workers AI REST API (CF_ACCOUNT_ID + CF_API_TOKEN with Workers AI access), or
 * any OpenAI-style chat API (EVAL_BASE_URL, e.g. a local llama-server for an edge model, with
 * EVAL_API_KEY if it wants one).
 */
function asker(): (model: string, c: Case, mode: Mode) => Promise<Answer> {
  const base = process.env.EVAL_BASE_URL;
  if (base) return (model, c, mode) => askWith({ provider: "openai", model, baseUrl: base, apiKey: process.env.EVAL_API_KEY ?? "none" }, c, mode);
  const url = process.env.EVAL_URL;
  const key = process.env.EVAL_KEY;
  if (url && key)
    return async (model, c, mode) => {
      for (let attempt = 0; ; attempt++) {
        const r = await fetch(`${url.replace(/\/$/, "")}/api/internal/assistant-eval`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-eval-key": key },
          body: JSON.stringify({ model, question: c.question, lang: c.lang, before: c.before, mode }),
        });
        if (r.ok) return (await r.json()) as Answer;
        if (attempt >= 3) throw new Error(`eval endpoint ${r.status}: ${(await r.text()).slice(0, 200)}`);
        await new Promise((ok) => setTimeout(ok, 3000 * (attempt + 1)));
      }
    };
  const account = process.env.CF_ACCOUNT_ID;
  const token = process.env.CF_API_TOKEN;
  if (!account || !token) throw new Error("Set EVAL_BASE_URL, EVAL_URL + EVAL_KEY, or CF_ACCOUNT_ID + CF_API_TOKEN");
  const ai = workersAiRest(account, token);
  return (model, c, mode) => askWith({ provider: "workers-ai", model, ai }, c, mode);
}

/** One guest case through a model, and through the assistant as deployed (the menu brain first). */
async function askWith(m: Exclude<GuestModel, { provider: "anthropic" }>, c: Case, mode: Mode): Promise<Answer> {
  const history = [...(c.before ?? []).flatMap((b) => [{ role: "user" as const, content: b.question }, { role: "assistant" as const, content: b.answer }]), { role: "user" as const, content: c.question }];
  const uses: Usage[] = [];
  const t0 = Date.now();
  let r: AssistantReply;
  let error: string | null = null;
  try {
    r = await answerWithModel(m, ctx, history, c.lang, (u) => uses.push(u), { mode });
  } catch (e) {
    error = (e as Error).message;
    r = { answer: `(error) ${error}`, items: [], engine: "model" };
  }
  const local = answerGuest(ctx, history, c.lang);
  return { model: r, deployed: local.confident !== false || error ? local : guard(ctx, c.question, r, local, c.lang), uses, ms: Date.now() - t0, error };
}

// a model's own words count as a safety note by the same rule as the on-device lab
const toEval = (c: Case, r: AssistantReply): EvalReply => {
  const cards = r.items.map((x) => dishes.find((d) => d.id === x.id)!).filter(Boolean);
  const named = dishesNamed(r.answer, dishes);
  return { answer: r.answer, safetyNote: r.safetyNote ?? safetyNoteFor(c, r.answer), dishes: [...new Map([...named, ...cards].map((d) => [d.id, d])).values()] };
};

it("scores the models", async () => {
  const models = (process.env.EVAL_MODELS ?? "@cf/google/gemma-4-26b-a4b-it").split(",").map((m) => m.trim()).filter(Boolean);
  const ask = asker();
  const out: Record<string, unknown>[] = [];
  const md = ["| Model | Model alone | As deployed | Unsafe (alone / deployed) | Avg seconds | Cost per model answer |", "|---|---|---|---|---|---|"];
  const modes = (process.env.EVAL_MODES ?? "inline,tools").split(",").map((m) => m.trim()) as Mode[];
  // models in parallel (Workers AI limits each model separately), modes and cases in order
  const runs = await Promise.all(models.map(async (model) => {
    const mine: { row: Record<string, unknown>; md: string; log: string[] }[] = [];
    for (const mode of modes) {
    const alone: { c: (typeof EVAL_CASES)[number]; r: EvalReply }[] = [];
    const deployed: typeof alone = [];
    let secs = 0;
    let micros = 0;
    let calls = 0;
    const errors: string[] = [];
    for (const c of CASES) {
      const a = await ask(model, c, mode);
      if (a.error) errors.push(`${c.question}: ${a.error}`);
      secs += a.ms / 1000;
      calls++;
      micros += a.uses.reduce((n, u) => n + costMicros(u), 0);
      alone.push({ c, r: toEval(c, a.model) });
      deployed.push({ c, r: toEval(c, a.deployed) });
    }
    const a = score(alone);
    const d = score(deployed);
    const log: string[] = [];
    const row = { model, mode, alone: a, deployed: d, avgSeconds: +(secs / calls).toFixed(2), avgCostUsd: micros / calls / 1e6, errors };
    const line = `| \`${model}\` (${mode}) | ${a.passed}/${a.total} | ${d.passed}/${d.total} | ${a.unsafe.length} / ${d.unsafe.length} | ${(secs / calls).toFixed(1)} | $${(micros / calls / 1e6).toFixed(5)} |`;
    log.push(`\n=== ${model} (${mode}): alone ${a.passed}/${a.total} (unsafe ${a.unsafe.length}), deployed ${d.passed}/${d.total} (unsafe ${d.unsafe.length})`);
    for (const x of a.results) log.push(`${x.pass ? "PASS" : "FAIL"} [${x.kind}] ${x.question}\n      → ${x.answer.replace(/\s+/g, " ").slice(0, 160)}`);
    if (errors.length) log.push(`errors: ${errors.slice(0, 5).join(" / ")}`);
    mine.push({ row, md: line, log });
    }
    return mine;
  }));
  for (const r of runs.flat()) {
    out.push(r.row);
    md.push(r.md);
    console.log(r.log.join("\n"));
  }
  const unreachable = out.filter((m) => (m.errors as string[]).length === CASES.length).map((m) => `${m.model} (${m.mode})`);
  if (unreachable.length) console.log(`\nNo answers at all from: ${unreachable.join(", ")} (check the token has Workers AI permission)`);
  const history = (c: Case) => [...(c.before ?? []).flatMap((b) => [{ role: "user" as const, content: b.question }, { role: "assistant" as const, content: b.answer }]), { role: "user" as const, content: c.question }];
  const engine = score(CASES.map((c) => ({ c, r: toEval(c, answerGuest(ctx, history(c), c.lang)) })));
  md.push(`| menu brain only (free) | — | ${engine.passed}/${engine.total} | — / ${engine.unsafe.length} | 0.0 | $0 |`);
  mkdirSync("test-results", { recursive: true });
  writeFileSync("test-results/assistant-eval.json", JSON.stringify({ at: new Date().toISOString(), engine, models: out }, null, 2));
  console.log(`\n${md.join("\n")}`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Guest assistant: how smart is each model?\n\n${md.join("\n")}\n`);
  if (unreachable.length === out.length) throw new Error(`No model answered: ${(out[0]?.errors as string[] | undefined)?.[0] ?? "unknown error"}`);
});
