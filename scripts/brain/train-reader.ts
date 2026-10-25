// Trains the reader: a second model of the intent model's shape that tells what kind of message a
// guest sent (about the food, about the restaurant's service, or small talk), so a question about
// paying by Grab or a "hola!" isn't answered with dishes. Its own data (./reader-templates.json,
// written from scratch, never from a benchmark) and the intent model's templates, mapped to the
// three kinds. Gated like the intent model: no eval question is trained on.
//
//   npx tsx scripts/brain/train-reader.ts
import { readFileSync, writeFileSync } from "node:fs";
import { forward, quantize, type IntentModel, type IntentWeights } from "../../src/shared/brain/intentModel";
import { features, hash } from "../../src/shared/brain/text";
import { modelTokens, read, type Dish } from "../../src/server/ai/brain/understand";
import { asReadText, protectedQuestions } from "./evalsets";
import { dishSurface, FILLERS, PREFIX, rng, SUFFIX, TEMPLATES, typo } from "./data";
import { trainingMenus } from "./menus";

// as in src/server/ai/brain/reader.ts (the weights carry them, so the two can't drift apart unseen)
const KINDS = ["food", "service", "smalltalk"] as const;
type Kind = (typeof KINDS)[number];

const BUCKETS = 1 << 13;
const DIM = 16;
const HIDDEN = 24;
const EPOCHS = 10;
const PER_KIND = 4000;

const OWN: Record<Kind, string[]> = JSON.parse(readFileSync(new URL("./reader-templates.json", import.meta.url), "utf8"));
const FROM_INTENT: Record<string, Kind> = {
  recommend: "food", dish_allergen: "food", dish_info: "food", compare: "food", pairing: "food", group: "food", refine: "food",
  order_help: "service", about: "service", greeting: "smalltalk", thanks: "smalltalk", out_of_scope: "smalltalk",
};
const templates: Record<Kind, string[]> = { food: [], service: [], smalltalk: [] };
for (const k of KINDS) templates[k].push(...OWN[k]);
for (const [intent, ts] of Object.entries(TEMPLATES)) templates[FROM_INTENT[intent]].push(...ts);

export const readerDataHash = () => hash(JSON.stringify([OWN, TEMPLATES, FILLERS])).toString(16);

const r = rng(23);
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
const weights: IntentWeights = { buckets: BUCKETS, dim: DIM, hidden: HIDDEN, intents: KINDS, emb: emb.data, embScale: emb.scale, w1: w1.data, w1Scale: w1.scale, b1: round(m.b1), w2: w2.data, w2Scale: w2.scale, b2: round(m.b2), dataHash: readerDataHash() };
const out = `// Generated by scripts/brain/train-reader.ts from scripts/brain/reader-templates.json and the intent templates. Do not edit.
import type { IntentWeights } from "./intentModel";
export const READER_WEIGHTS: IntentWeights = ${JSON.stringify(weights)};
`;
const target = new URL("../../src/shared/brain/reader.gen.ts", import.meta.url);
writeFileSync(target, out);
console.log(`wrote ${(out.length / 1024).toFixed(0)} KB, dev accuracy ${(accuracy(dev) * 100).toFixed(1)}%`);
