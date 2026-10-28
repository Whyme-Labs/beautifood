// A language model on the benchmark, scored by the same checks as the menu brain (bench/run.ts):
//   alone     the model answers every question; what it shows is its cards plus the dishes it names
//             (with their bracketed notes dropped, as the guest eval counts them)
//   deployed  the assistant as it runs: the brain answers, and only what it isn't confident of goes
//             to the model, behind the allergen guard
// The model is any OpenAI-style chat API (a local llama-server for an edge model):
//   npx tsx bench/models.ts --base http://127.0.0.1:8090/v1 --model LFM3-1.7B --mode tools \
//     --what alone --sample 40 --sets v1:dev,heldout:test,v3:test,v4:test,v5:test,v6:test --out file.json
// --sample N takes every k-th case of each set (by id) so N are scored. Held-out sets are scored,
// never read case by case: keep the output out of the repo.
import { writeFileSync } from "node:fs";
import { check, loadCases, loadMenu, type Set } from "./run";
import type { Case } from "./schema";
import { answerGuest } from "../src/server/ai/brain";
import { guard, type AssistantContext, type AssistantReply } from "../src/server/ai/local";
import { answerWithModel } from "../src/server/ai/guestModel";
import { dishesNamed } from "../src/shared/assistantEval";
import { cleanAnswer } from "../src/shared/onDeviceEval";

const arg = (k: string, d: string) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : d;
};
const base = arg("--base", "http://127.0.0.1:8090/v1");
const model = arg("--model", "local");
const mode = arg("--mode", "tools") as "inline" | "tools";
const what = arg("--what", "deployed") as "alone" | "deployed";
const sample = Number(arg("--sample", "0"));
const sets = arg("--sets", "v1:dev,heldout:test,v3:test,v4:test,v5:test,v6:test").split(",").map((s) => s.split(":") as [Set, string]);
const out = arg("--out", "");

type Item = AssistantContext["items"][number];
const ALLERGY_WORD = /allerg|alergi|过敏/i;
const STAFF_WORD = /\bstaff\b|\bwaiter|\bserver\b|\bcrew\b|\bkitchen\b|\bstaf\b|\bpekerja\b|店员|服务员|员工|工作人员|厨房/i;

/** What a model's reply shows: its cards, then the dishes its text names. */
function shownBy(r: AssistantReply, items: Item[]): Item[] {
  const short = items.map((d) => ({ ...d, name: d.name.replace(/\s*\([^)]*\)\s*/g, " ").trim() || d.name }));
  const named = dishesNamed(r.answer, short as never).map((s) => items.find((d) => d.id === s.id)!);
  const cards = r.items.map((x) => items.find((d) => d.id === x.id)!).filter(Boolean);
  return [...new Map([...cards, ...named].map((d) => [d.id, d])).values()];
}

async function main() {
  const menus = new Map<string, AssistantContext>();
  const rows: Record<string, unknown>[] = [];
  for (const [set, split] of sets) {
    let cases = loadCases(split, set).sort((a, b) => a.id.localeCompare(b.id));
    if (sample && cases.length > sample) {
      const k = cases.length / sample;
      cases = Array.from({ length: sample }, (_, i) => cases[Math.floor(i * k)]);
    }
    // one menu at a time, so the server keeps the menu's prompt cached
    cases.sort((a, b) => a.menu.localeCompare(b.menu) || a.id.localeCompare(b.id));
    let n = 0;
    for (const c of cases as Case[]) {
      const ctx = menus.get(c.menu) ?? menus.set(c.menu, loadMenu(c.menu)).get(c.menu)!;
      const history = [...(c.before ?? []).flatMap((b) => [{ role: "user" as const, content: b.user }, { role: "assistant" as const, content: b.assistant }]), { role: "user" as const, content: c.question }];
      const brain = answerGuest(ctx, history, c.lang);
      const brainShown = brain.items.map((x) => ctx.items.find((d) => d.id === x.id)!).filter(Boolean);
      const b = check(c.expect, brainShown, brain.answer, !!brain.safetyNote);
      const asked = what === "alone" || brain.confident === false;
      let r: AssistantReply | null = null;
      let error: string | null = null;
      const t0 = Date.now();
      if (asked)
        try {
          r = await answerWithModel({ provider: "openai", model, baseUrl: base, apiKey: "none" }, ctx, history, c.lang, () => {}, { mode });
          r = { ...r, answer: cleanAnswer(r.answer.replace(/^[\s\S]*?<\/think>/, "")) };
        } catch (e) {
          error = (e as Error).message;
        }
      const ms = Date.now() - t0;
      let scored: { failed: string[]; unsafe: boolean };
      let shown: string[];
      if (what === "alone") {
        const s = r ? shownBy(r, ctx.items) : [];
        const note = !!r && (!!r.safetyNote || ALLERGY_WORD.test(r.answer) || (/allerg/.test(c.tags.join(" ")) && STAFF_WORD.test(r.answer)));
        scored = r ? check(c.expect, s, r.answer, note) : { failed: [`no answer: ${error}`], unsafe: false };
        shown = s.map((d) => d.name);
      } else {
        const final = !asked ? brain : r ? guard(ctx, c.question, r, brain, c.lang) : brain;
        const s = final === brain ? brainShown : shownBy(final, ctx.items);
        const note = !!final.safetyNote || (final !== brain && ALLERGY_WORD.test(final.answer));
        scored = check(c.expect, s, final.answer, note);
        shown = s.map((d) => d.name);
      }
      rows.push({ set, split, id: c.id, menu: c.menu, lang: c.lang, tags: c.tags, asked, ms, error, brain: { pass: !b.failed.length, unsafe: b.unsafe }, pass: !scored.failed.length, unsafe: scored.unsafe, failed: scored.failed, shown, answer: (r?.answer ?? "").slice(0, 400) });
      if (++n % 10 === 0) console.error(`${set} ${n}/${cases.length}`);
    }
  }
  const by = (xs: typeof rows, k: "brain" | "model") => {
    const pass = xs.filter((r) => (k === "brain" ? (r.brain as { pass: boolean }).pass : r.pass)).length;
    const unsafe = xs.filter((r) => (k === "brain" ? (r.brain as { unsafe: boolean }).unsafe : r.unsafe)).length;
    return `${pass}/${xs.length} (${((100 * pass) / Math.max(1, xs.length)).toFixed(1)}%), unsafe ${unsafe}`;
  };
  const summary: Record<string, unknown> = { model, mode, what, sample };
  for (const [set] of sets) {
    const xs = rows.filter((r) => r.set === set);
    summary[set] = { brain: by(xs, "brain"), [what]: by(xs, "model"), asked: xs.filter((r) => r.asked).length, avgSeconds: +(xs.filter((r) => r.asked).reduce((s, r) => s + (r.ms as number), 0) / Math.max(1, xs.filter((r) => r.asked).length) / 1000).toFixed(1), errors: xs.filter((r) => r.error).length };
  }
  summary.all = { brain: by(rows, "brain"), [what]: by(rows, "model") };
  console.log(JSON.stringify(summary, null, 2));
  if (out) writeFileSync(out, JSON.stringify({ summary, rows }, null, 2));
}
main();
