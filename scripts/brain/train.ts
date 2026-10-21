// Trains the menu brain's intent model on the synthetic questions (./data) and the harvested ones
// (./harvested.json), then gates it: the new weights are written only if they do no worse than the
// shipped ones on every eval set, with no unsafe answer. Deterministic: the same data and seed give
// the same model.
//
//   npx tsx scripts/brain/train.ts [--out path/to/weights.gen.ts]
import { writeFileSync } from "node:fs";
import { WEIGHTS } from "../../src/shared/brain/weights.gen";
import type { IntentWeights } from "../../src/shared/brain/intentModel";
import { useWeights } from "../../src/server/ai/brain/understand";
import { asReadText, evaluate, passesGate, protectedQuestions } from "./evalsets";
import { INTENTS, quantize, forward, type IntentModel } from "../../src/shared/brain/intentModel";
import { features } from "../../src/shared/brain/text";
import { modelTokens, read } from "../../src/server/ai/brain/understand";
import { dataHash, generate, HARVESTED, rng } from "./data";

const BUCKETS = 1 << 13;
const DIM = 24;
const HIDDEN = 32;
const EPOCHS = 12;
const PER_INTENT = 2500;

const r = rng(11);
const uniform = (n: number, scale: number) => Float32Array.from({ length: n }, () => (r() * 2 - 1) * scale);

// an eval question in the training data would make every score a lie
const guarded = protectedQuestions();
const leaked = HARVESTED.filter((h) => guarded.has(asReadText(h.text)));
if (leaked.length) {
  console.error(`Refusing to train: ${leaked.length} harvested questions are eval questions:\n${leaked.map((h) => `  ${h.text}`).join("\n")}`);
  process.exit(1);
}

const generated = generate(PER_INTENT).map((e) => {
  const toks = e.delex ? asReadText(e.text).split(" ") : modelTokens(read(e.items, e.text).delexicalized);
  return { ...e, toks, feats: features(toks, BUCKETS), y: INTENTS.indexOf(e.intent) };
});
// a template that happens to read exactly like an eval question is dropped too; a phrase of one or
// two words ("hi", "你好", "thank you") is everyone's, and leaks nothing
const examples = generated.filter((e) => e.toks.length <= 2 || !guarded.has(e.toks.join(" ")));
console.log(`${generated.length - examples.length} generated examples dropped as eval questions`);
// the words of on-topic questions (seen at least twice), for open-set rejection
const counts = new Map<string, number>();
for (const e of examples) if (e.intent !== "out_of_scope") for (const t of new Set(e.toks)) counts.set(t, (counts.get(t) ?? 0) + 1);
const vocab = [...counts].filter(([t, n]) => n >= 2 && !t.startsWith("§")).map(([t]) => t).sort();
const dev = examples.splice(0, Math.floor(examples.length * 0.1));

const m: IntentModel = {
  buckets: BUCKETS,
  dim: DIM,
  hidden: HIDDEN,
  intents: INTENTS,
  emb: uniform(BUCKETS * DIM, 1 / DIM),
  w1: uniform(HIDDEN * DIM, Math.sqrt(6 / (DIM + HIDDEN))),
  b1: new Float32Array(HIDDEN),
  w2: uniform(INTENTS.length * HIDDEN, Math.sqrt(6 / (HIDDEN + INTENTS.length))),
  b2: new Float32Array(INTENTS.length),
};

function step(feats: number[], y: number, lr: number) {
  const { h0, h1, probs } = forward(m, feats);
  const K = INTENTS.length;
  // light label smoothing keeps the confidence honest, so "unsure" means something
  const dl = Float32Array.from(probs, (p, c) => p - ((c === y ? 0.95 : 0) + 0.05 / K));
  const dh1 = new Float32Array(HIDDEN);
  for (let c = 0; c < K; c++) {
    for (let k = 0; k < HIDDEN; k++) {
      dh1[k] += m.w2[c * HIDDEN + k] * dl[c];
      m.w2[c * HIDDEN + k] -= lr * dl[c] * h1[k];
    }
    m.b2[c] -= lr * dl[c];
  }
  const dh0 = new Float32Array(DIM);
  for (let k = 0; k < HIDDEN; k++) {
    if (h1[k] <= 0) continue;
    for (let j = 0; j < DIM; j++) {
      dh0[j] += m.w1[k * DIM + j] * dh1[k];
      m.w1[k * DIM + j] -= lr * dh1[k] * h0[j];
    }
    m.b1[k] -= lr * dh1[k];
  }
  const g = lr / feats.length;
  for (const f of feats) for (let j = 0; j < DIM; j++) m.emb[f * DIM + j] -= g * dh0[j] * 4;
  return -Math.log(Math.max(probs[y], 1e-9));
}

const accuracy = (set: typeof dev) => set.filter((e) => {
  const p = forward(m, e.feats).probs;
  return p.indexOf(Math.max(...p)) === e.y;
}).length / set.length;

for (let epoch = 0; epoch < EPOCHS; epoch++) {
  const lr = 0.1 * (1 - epoch / EPOCHS) + 0.005;
  let loss = 0;
  for (let i = examples.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [examples[i], examples[j]] = [examples[j], examples[i]];
  }
  for (const e of examples) loss += step(e.feats, e.y, lr);
  console.log(`epoch ${epoch + 1}: loss ${(loss / examples.length).toFixed(4)}, dev accuracy ${(accuracy(dev) * 100).toFixed(1)}%`);
}

const q = (a: Float32Array) => quantize(a);
const emb = q(m.emb);
const w1 = q(m.w1);
const w2 = q(m.w2);
const round = (a: Float32Array) => [...a].map((v) => Math.round(v * 1e4) / 1e4);
const weights: IntentWeights = {
  buckets: BUCKETS,
  dim: DIM,
  hidden: HIDDEN,
  intents: INTENTS,
  emb: emb.data,
  embScale: emb.scale,
  w1: w1.data,
  w1Scale: w1.scale,
  b1: round(m.b1),
  w2: w2.data,
  w2Scale: w2.scale,
  b2: round(m.b2),
  vocab: vocab.join(" "),
  dataHash: dataHash(),
};

// the gate: no worse than what ships on any eval set, and never unsafe
useWeights(WEIGHTS);
const current = evaluate();
useWeights(weights);
const candidate = evaluate();
console.log(`shipped:   ${JSON.stringify(current)}\ncandidate: ${JSON.stringify(candidate)}`);
const gate = passesGate(candidate, current);
if (!gate.ok) {
  console.error(`Not writing the new weights: ${gate.why.join("; ")}`);
  process.exit(1);
}

const out = `// Generated by scripts/brain/train.ts from the synthetic questions in scripts/brain/data.ts. Do not edit.
import type { IntentWeights } from "./intentModel";
export const WEIGHTS: IntentWeights = ${JSON.stringify(weights)};
`;
const outArg = process.argv.indexOf("--out");
const target = outArg > 0 ? process.argv[outArg + 1] : new URL("../../src/shared/brain/weights.gen.ts", import.meta.url);
writeFileSync(target, out);
console.log(`wrote ${(out.length / 1024).toFixed(0)} KB to ${target}, ${examples.length} training questions (${HARVESTED.length} harvested), dev accuracy ${(accuracy(dev) * 100).toFixed(1)}%`);
