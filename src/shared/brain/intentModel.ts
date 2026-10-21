// The intent model: a fastText-style network small enough to ship inside the Worker. Hashed word
// and character n-grams are looked up in an embedding table, averaged, passed through one hidden
// layer, and scored per intent. It never sees a restaurant's dishes (they are replaced by §dish
// before it reads the question), so one model serves every menu and nothing needs re-indexing
// when a menu changes. Trained offline on synthetic guest questions (scripts/brain).
import { features } from "./text";

export const INTENTS = [
  "recommend", // what to eat, with or without filters ("something under RM10", "vegetarian?")
  "dish_allergen", // does this dish contain X / is it safe for me
  "dish_info", // tell me about / what is this dish
  "compare", // the difference between two dishes
  "pairing", // what goes well with a dish
  "group", // what a party should share
  "refine", // narrowing what was just shown ("which of those is cheapest?")
  "about", // the restaurant itself
  "greeting",
  "thanks",
  "order_help", // how to order, pay, call staff
  "out_of_scope",
] as const;
export type Intent = (typeof INTENTS)[number];

export interface IntentWeights {
  buckets: number;
  dim: number;
  hidden: number;
  intents: readonly string[];
  /** int8 tables, base64, with their scales. */
  emb: string;
  embScale: number;
  w1: string;
  w1Scale: number;
  b1: number[];
  w2: string;
  w2Scale: number;
  b2: number[];
  /** Words seen in training: a question with none of them is not one the model can read. */
  vocab?: string;
  /** A hash of the training data, so a test can tell when the weights are stale. */
  dataHash?: string;
}

export interface IntentModel {
  buckets: number;
  dim: number;
  hidden: number;
  intents: readonly string[];
  emb: Float32Array;
  w1: Float32Array;
  b1: Float32Array;
  w2: Float32Array;
  b2: Float32Array;
  vocab?: Set<string>;
}

const fromB64 = (s: string) => {
  const bin = atob(s);
  const out = new Int8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = (bin.charCodeAt(i) << 24) >> 24;
  return out;
};

const dequant = (s: string, scale: number) => Float32Array.from(fromB64(s), (v) => v * scale);

export function toB64(q: Int8Array): string {
  let bin = "";
  for (let i = 0; i < q.length; i++) bin += String.fromCharCode(q[i] & 0xff);
  return btoa(bin);
}

/** int8 with one scale per table: a quarter of the size, and no measurable loss here. */
export function quantize(a: Float32Array): { data: string; scale: number } {
  let max = 0;
  for (const v of a) max = Math.max(max, Math.abs(v));
  const scale = max / 127 || 1;
  return { data: toB64(Int8Array.from(a, (v) => Math.max(-127, Math.min(127, Math.round(v / scale))))), scale };
}

export function loadModel(w: IntentWeights): IntentModel {
  return {
    buckets: w.buckets,
    dim: w.dim,
    hidden: w.hidden,
    intents: w.intents,
    emb: dequant(w.emb, w.embScale),
    w1: dequant(w.w1, w.w1Scale),
    b1: Float32Array.from(w.b1),
    w2: dequant(w.w2, w.w2Scale),
    b2: Float32Array.from(w.b2),
    vocab: w.vocab ? new Set(w.vocab.split(" ")) : undefined,
  };
}

/** The forward pass, keeping what the backward pass needs. */
export function forward(m: IntentModel, feats: number[]) {
  const { dim, hidden } = m;
  const h0 = new Float32Array(dim);
  for (const f of feats) for (let j = 0; j < dim; j++) h0[j] += m.emb[f * dim + j];
  for (let j = 0; j < dim; j++) h0[j] /= feats.length;
  const h1 = new Float32Array(hidden);
  for (let k = 0; k < hidden; k++) {
    let s = m.b1[k];
    for (let j = 0; j < dim; j++) s += m.w1[k * dim + j] * h0[j];
    h1[k] = s > 0 ? s : 0;
  }
  const n = m.intents.length;
  const logits = new Float32Array(n);
  let max = -Infinity;
  for (let c = 0; c < n; c++) {
    let s = m.b2[c];
    for (let k = 0; k < hidden; k++) s += m.w2[c * hidden + k] * h1[k];
    logits[c] = s;
    max = Math.max(max, s);
  }
  let sum = 0;
  const probs = new Float32Array(n);
  for (let c = 0; c < n; c++) sum += probs[c] = Math.exp(logits[c] - max);
  for (let c = 0; c < n; c++) probs[c] /= sum;
  return { h0, h1, probs };
}

export interface IntentGuess {
  intent: Intent;
  confidence: number;
  /** Every intent's probability, highest first. */
  ranked: { intent: Intent; p: number }[];
}

export function classify(m: IntentModel, toks: string[]): IntentGuess {
  const { probs } = forward(m, features(toks, m.buckets));
  // open-set rejection: nothing in the question is a word the model learnt
  if (m.vocab && toks.length && !toks.some((t) => t.startsWith("§") || m.vocab!.has(t))) {
    const c = m.intents.indexOf("out_of_scope");
    if (c >= 0) probs.fill(0.01).set([0.99 - 0.01 * (m.intents.length - 2)], c);
  }
  const ranked = [...probs].map((p, c) => ({ intent: m.intents[c] as Intent, p })).sort((a, b) => b.p - a.p);
  return { intent: ranked[0].intent, confidence: ranked[0].p, ranked };
}
