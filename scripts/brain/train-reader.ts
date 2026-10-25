// Trains a reader: a small model of the intent model's shape for one question about a message.
// "kind": about the food, the restaurant's service, or small talk (so a question about paying by Grab
// or a "hola!" isn't answered with dishes). "followup": a new request, about the dishes just shown,
// about the one dish being talked about, or the bill. Each is trained on its own utterances (written
// from scratch, never from a benchmark) and the intent templates (./reader-data). Gated like the
// intent model: no eval question is trained on.
//
//   npx tsx scripts/brain/train-reader.ts [kind|followup]
import { writeFileSync } from "node:fs";
import { forward, quantize, type IntentModel, type IntentWeights } from "../../src/shared/brain/intentModel";
import { features } from "../../src/shared/brain/text";
import { modelTokens, read, type Dish } from "../../src/server/ai/brain/understand";
import { protectedQuestions } from "./evalsets";
import { dishSurface, FILLERS, PREFIX, rng, SUFFIX, typo } from "./data";
import { READERS } from "./reader-data";
import { trainingMenus } from "./menus";

const BUCKETS = 1 << 13;
const DIM = 16;
const HIDDEN = 24;
const EPOCHS = 10;
const PER_KIND = 4000;

const which = (process.argv[2] ?? "kind") as keyof typeof READERS;
const spec = READERS[which];
if (!spec) throw new Error(`no reader "${which}" (kind or followup)`);
const KINDS = spec.labels as readonly string[];
const templates = spec.templates as Record<string, string[]>;

const r = rng(spec.seed);
const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
const HAN = /\p{Script=Han}/u;
const menus = trainingMenus();
const guarded = protectedQuestions();

const examples: { toks: string[]; feats: number[]; y: number }[] = [];
let dropped = 0;
for (const [y, kind] of KINDS.entries()) {
  for (let k = 0; k < PER_KIND; k++) {
    const tpl = pick(templates[kind]);
    const zh = HAN.test(tpl);
    const { items } = pick(menus);
    const d = pick(items) as Dish;
    let d2 = pick(items) as Dish;
    while (d2.id === d.id) d2 = pick(items) as Dish;
    let text = tpl
      .replace("{d2}", dishSurface(d2, zh, r))
      .replace(/\{d\}/g, dishSurface(d, zh, r))
      .replace("{a}", zh ? pick(FILLERS.aZh) : pick(FILLERS.a))
      .replace("{diet}", zh ? pick(FILLERS.dietZh) : pick(FILLERS.diet))
      .replace("{c}", zh ? pick(FILLERS.cZh) : pick(FILLERS.c))
      .replace(/\{p\}/g, zh ? pick(FILLERS.pZh) : pick(FILLERS.p))
      .replace("{n2}", pick(FILLERS.n))
      .replace(/\{n\}/g, zh ? pick(FILLERS.nZh) : pick(FILLERS.n));
    if (!zh && r() < 0.4) text = pick(PREFIX) + text + pick(SUFFIX);
    if (r() < 0.3) text = text.replace(/[?!,.']/g, "");
    if (r() < 0.12) text = typo(text, r);
    const toks = modelTokens(read(items as Dish[], text).delexicalized);
    if (toks.length > 2 && guarded.has(toks.join(" "))) {
      dropped++;
      continue;
    }
    examples.push({ toks, feats: features(toks, BUCKETS), y });
  }
}
console.log(`${examples.length} examples, ${dropped} dropped as eval questions`);
for (let i = examples.length - 1; i > 0; i--) {
  const j = Math.floor(r() * (i + 1));
  [examples[i], examples[j]] = [examples[j], examples[i]];
}
// the words it has seen (at least twice): it only judges a message it can mostly read
const counts = new Map<string, number>();
for (const e of examples) for (const t of new Set(e.toks)) counts.set(t, (counts.get(t) ?? 0) + 1);
const vocab = [...counts].filter(([t, n]) => n >= 2 && !t.startsWith("§")).map(([t]) => t).sort();
const dev = examples.splice(0, Math.floor(examples.length * 0.1));

const uniform = (n: number, scale: number) => Float32Array.from({ length: n }, () => (r() * 2 - 1) * scale);
const K = KINDS.length;
const m: IntentModel = {
  buckets: BUCKETS,
  dim: DIM,
  hidden: HIDDEN,
  intents: KINDS,
  emb: uniform(BUCKETS * DIM, 1 / DIM),
  w1: uniform(HIDDEN * DIM, Math.sqrt(6 / (DIM + HIDDEN))),
  b1: new Float32Array(HIDDEN),
  w2: uniform(K * HIDDEN, Math.sqrt(6 / (HIDDEN + K))),
  b2: new Float32Array(K),
};

function step(feats: number[], y: number, lr: number) {
  const { h0, h1, probs } = forward(m, feats);
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

const round = (a: Float32Array) => [...a].map((v) => Math.round(v * 1e4) / 1e4);
const [emb, w1, w2] = [m.emb, m.w1, m.w2].map((a) => quantize(a));
const weights: IntentWeights = { buckets: BUCKETS, dim: DIM, hidden: HIDDEN, intents: KINDS, emb: emb.data, embScale: emb.scale, w1: w1.data, w1Scale: w1.scale, b1: round(m.b1), w2: w2.data, w2Scale: w2.scale, b2: round(m.b2), vocab: vocab.join(" "), dataHash: spec.hash() };
const out = `// Generated by scripts/brain/train-reader.ts (${which}) from its templates in scripts/brain and the intent templates. Do not edit.
import type { IntentWeights } from "./intentModel";
export const ${spec.constant}: IntentWeights = ${JSON.stringify(weights)};
`;
const target = new URL(`../../src/shared/brain/${spec.out}`, import.meta.url);
writeFileSync(target, out);
console.log(`wrote ${(out.length / 1024).toFixed(0)} KB, dev accuracy ${(accuracy(dev) * 100).toFixed(1)}%`);
