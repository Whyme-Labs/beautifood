// Reads benchmark results and says what they mean, with the uncertainty that comes with them:
// pass rates with bootstrap 95% intervals, failures by stage and by tag, how the intent model's
// confidence and logits relate to failure (calibration, logit gap, entropy), and, given two runs,
// whether one is really better than the other (McNemar's paired test on the same cases).
//
//   npx tsx bench/analyse.ts results/<a>.json [results/<b>.json]
import { readFileSync } from "node:fs";

interface Row {
  id: string;
  tags: string[];
  lang: string;
  menu: string;
  pass: boolean;
  unsafe: boolean;
  stage: string | null;
  trace: { modelIntent: string; decided: string; confidence: number; logitGap: number; entropy: number; rejected: boolean };
}
const load = (f: string) => JSON.parse(readFileSync(f, "utf8")) as { engine: string; split: string; sha: string; rows: Row[] };

/** Seeded PRNG, so the intervals are the same every run. */
function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pass rate with a bootstrap 95% interval (2,000 resamples). */
export function rate(xs: boolean[]): { p: number; lo: number; hi: number; n: number } {
  const n = xs.length;
  if (!n) return { p: NaN, lo: NaN, hi: NaN, n };
  const r = rng(7);
  const means: number[] = [];
  for (let b = 0; b < 2000; b++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += xs[Math.floor(r() * n)] ? 1 : 0;
    means.push(s / n);
  }
  means.sort((a, b) => a - b);
  const pct = (v: number) => Math.round(v * 1000) / 10;
  return { p: pct(xs.filter(Boolean).length / n), lo: pct(means[49]), hi: pct(means[1949]), n };
}

/** Expected calibration error: how far the intent model's confidence is from how often it's right. */
function calibration(rows: Row[]) {
  const bins = Array.from({ length: 5 }, (_, i) => ({ lo: i * 0.2, hi: (i + 1) * 0.2, rows: [] as Row[] }));
  for (const r of rows) bins[Math.min(4, Math.floor(r.trace.confidence * 5))].rows.push(r);
  let ece = 0;
  const table = bins.map((b) => {
    const acc = b.rows.length ? b.rows.filter((r) => r.pass).length / b.rows.length : NaN;
    const conf = b.rows.length ? b.rows.reduce((s, r) => s + r.trace.confidence, 0) / b.rows.length : NaN;
    if (b.rows.length) ece += (b.rows.length / rows.length) * Math.abs(acc - conf);
    return { bin: `${b.lo.toFixed(1)}–${b.hi.toFixed(1)}`, n: b.rows.length, confidence: +conf.toFixed(2), passRate: +acc.toFixed(2) };
  });
  return { ece: +ece.toFixed(3), table };
}

const mean = (xs: number[]) => (xs.length ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(3) : null);

/** McNemar's test on paired outcomes: is B's pass rate different from A's beyond chance? */
function mcnemar(a: Row[], b: Row[]) {
  const byId = new Map(b.map((r) => [r.id, r]));
  let onlyA = 0;
  let onlyB = 0;
  for (const r of a) {
    const s = byId.get(r.id);
    if (!s) continue;
    if (r.pass && !s.pass) onlyA++;
    if (!r.pass && s.pass) onlyB++;
  }
  const n = onlyA + onlyB;
  // exact two-sided binomial p-value
  const binom = (k: number) => {
    let p = 0;
    let c = 1;
    for (let i = 0; i <= n; i++) {
      if (i > 0) c = (c * (n - i + 1)) / i;
      if (i <= k) p += c;
    }
    return p / 2 ** n;
  };
  const p = n ? Math.min(1, 2 * binom(Math.min(onlyA, onlyB))) : 1;
  return { fixed: onlyB, broke: onlyA, p: +p.toFixed(4) };
}

function report(name: string, rows: Row[]) {
  const by = (key: (r: Row) => string[]) => {
    const m = new Map<string, Row[]>();
    for (const r of rows) for (const k of key(r)) m.set(k, [...(m.get(k) ?? []), r]);
    return [...m].sort((x, y) => rate(x[1].map((r) => r.pass)).p - rate(y[1].map((r) => r.pass)).p).map(([k, xs]) => ({ k, ...rate(xs.map((r) => r.pass)), unsafe: xs.filter((r) => r.unsafe).length }));
  };
  const fail = rows.filter((r) => !r.pass);
  const pass = rows.filter((r) => r.pass);
  console.log(`\n## ${name}\n`);
  const all = rate(rows.map((r) => r.pass));
  console.log(`pass ${all.p}% (95% CI ${all.lo}–${all.hi}, n=${all.n}); unsafe ${rows.filter((r) => r.unsafe).length}`);
  console.log("\nfailures by stage:");
  const st = new Map<string, number>();
  for (const r of fail) st.set(r.stage ?? "?", (st.get(r.stage ?? "?") ?? 0) + 1);
  for (const [k, v] of [...st].sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`);
  console.log("\nweakest tags (pass %, 95% CI):");
  for (const t of by((r) => r.tags).slice(0, 12)) console.log(`  ${t.k.padEnd(14)} ${String(t.p).padStart(5)}%  (${t.lo}–${t.hi}, n=${t.n})${t.unsafe ? `  unsafe ${t.unsafe}` : ""}`);
  console.log("\nby language:");
  for (const t of by((r) => [r.lang === "zh" ? "zh" : r.tags.includes("manglish") ? "manglish" : r.tags.includes("malay") ? "malay" : "en"])) console.log(`  ${t.k.padEnd(14)} ${String(t.p).padStart(5)}%  (${t.lo}–${t.hi}, n=${t.n})`);
  console.log("\nby menu:");
  for (const t of by((r) => [r.menu])) console.log(`  ${t.k.padEnd(14)} ${String(t.p).padStart(5)}%  (${t.lo}–${t.hi}, n=${t.n})`);
  console.log("\nthe intent model on passing vs failing cases:");
  console.log(`  confidence  ${mean(pass.map((r) => r.trace.confidence))} vs ${mean(fail.map((r) => r.trace.confidence))}`);
  console.log(`  logit gap   ${mean(pass.map((r) => r.trace.logitGap))} vs ${mean(fail.map((r) => r.trace.logitGap))}`);
  console.log(`  entropy     ${mean(pass.map((r) => r.trace.entropy))} vs ${mean(fail.map((r) => r.trace.entropy))} bits`);
  console.log(`  rejected as out of vocabulary: ${rows.filter((r) => r.trace.rejected).length} (${fail.filter((r) => r.trace.rejected).length} of them failed)`);
  console.log(`  decision rules overrode the model: ${rows.filter((r) => r.trace.modelIntent !== r.trace.decided).length} cases`);
  const cal = calibration(rows);
  console.log(`  calibration (ECE ${cal.ece}):`);
  for (const b of cal.table) console.log(`    conf ${b.bin}  n=${String(b.n).padStart(4)}  mean conf ${b.confidence}  pass ${b.passRate}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [fa, fb] = process.argv.slice(2);
  const a = load(fa);
  report(`${a.engine} on ${a.split} (${a.sha})`, a.rows);
  if (fb) {
    const b = load(fb);
    report(`${b.engine} on ${b.split} (${b.sha})`, b.rows);
    const m = mcnemar(a.rows, b.rows);
    console.log(`\n## ${b.engine}@${b.sha} vs ${a.engine}@${a.sha}\n\nfixed ${m.fixed}, broke ${m.broke}; McNemar p = ${m.p}${m.p < 0.05 ? " (a real difference)" : " (not distinguishable from chance)"}`);
  }
}
