// Scores the browser reader (serve_gl.py) on the benchmark, as pre-registered in bench/CHANGES.md:
// each case's turns are replayed from an empty order (with the written assistant replies), the order
// the reader's reading gives (turnReading.applyTurn) feeding the next turn; its order after the last
// turn is what the brain bills. A turn it can't read, or whose changes don't fit, keeps the order as it
// was. Prints the rules alone, each policy (fixed, broke, unsafe), the best of them case by case, the
// whole set's unsafe count under each, and the reader's time a turn.
//
//   npx tsx scripts/reader/gl-replay.ts --url http://127.0.0.1:8084 [--set v11] [--split all] [--tags bill,modifier,followup] [--cache <file.json>]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { loadCases, loadMenu, readable, runEngine } from "../../bench/run";
import { readTurn, type GlCall } from "../../src/server/ai/brain/glReader";
import { sameOrder, type OrderLineT } from "../../src/server/ai/brain/turnReading";
import type { RawOrderReading } from "../../src/server/ai/brain/reading";

const arg = (k: string, d = "") => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const url = arg("url");
const set = arg("set", "v11");
const split = arg("split", "all");
const tags = arg("tags", "bill,modifier,followup").split(",");
const cachePath = arg("cache");

type Cached = { order: OrderLineT[]; changed: boolean; ms: number[]; read: number; turns: number };
const call: GlCall = async (text, menu, order) => {
  const res = await fetch(`${url}/`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, menu, order }) });
  if (!res.ok) throw new Error(`reader ${res.status}`);
  return res.json();
};

void (async () => {
  const all = loadCases(split, set as never);
  const cases = all.filter((c) => (c.tags ?? []).some((t) => tags.includes(t)));
  const cache: Record<string, Cached> = cachePath && existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, "utf8")) : {};
  let done = 0;
  for (const c of all) {
    if (cache[c.id]) continue;
    if (!url) throw new Error(`no reading cached for ${c.id} and no --url`);
    const dishes = readable(loadMenu(c.menu, "gold", c.at));
    const turns = [...(c.before ?? []).map((b) => ({ user: b.user, after: b.assistant })), { user: c.question, after: "" }];
    let order: OrderLineT[] = [];
    let reply = "";
    let changed = false;
    let read = 0;
    const ms: number[] = [];
    for (const t of turns) {
      const t0 = performance.now();
      const r = await readTurn(call, dishes, order, reply, t.user);
      ms.push(Math.round(performance.now() - t0));
      if (r) read++;
      const next = r ? r.order : order;
      changed = !sameOrder(next, order);
      order = next;
      reply = t.after;
    }
    cache[c.id] = { order, changed, ms, read, turns: turns.length };
    if (cachePath && ++done % 25 === 0) writeFileSync(cachePath, JSON.stringify(cache));
  }
  if (cachePath) writeFileSync(cachePath, JSON.stringify(cache));

  const basketOf = (id: string): (RawOrderReading & { changed?: boolean }) | null => {
    const k = cache[id];
    return k?.order.length ? { lines: k.order.map((l) => ({ dish: l.dish, count: l.count, options: l.options, ...(l.owner ? { owner: l.owner } : {}) })), changed: k.changed } : null;
  };
  const score = (cs: typeof all) => {
    const baskets = new Map(cs.map((c) => [c.id, basketOf(c.id)]));
    const rules = runEngine("brain", cs, "gold");
    const runs = { replace: runEngine("brain", cs, "gold", undefined, undefined, { baskets, policy: "replace" }), edits: runEngine("brain", cs, "gold", undefined, undefined, { baskets, policy: "edits" }) };
    return { rules, runs };
  };
  const pct = (n: number, d: number) => `${n}/${d} (${((100 * n) / d).toFixed(1)}%)`;
  const { rules, runs } = score(cases);
  const base = new Map(rules.map((r) => [r.id, r]));
  console.log(`${set} ${split}, ${cases.length} cases tagged ${tags.join("/")}`);
  console.log(`rules    ${pct(rules.filter((r) => r.pass).length, cases.length)} unsafe ${rules.filter((r) => r.unsafe).length}`);
  for (const [k, rows] of Object.entries(runs)) {
    const fixed = rows.filter((r) => r.pass && !base.get(r.id)!.pass).length;
    const broke = rows.filter((r) => !r.pass && base.get(r.id)!.pass).length;
    console.log(`${k.padEnd(8)} ${pct(rows.filter((r) => r.pass).length, cases.length)} unsafe ${rows.filter((r) => r.unsafe).length} fixed ${fixed} broke ${broke}`);
  }
  const any = rules.filter((r) => r.pass || Object.values(runs).some((rows) => rows.find((x) => x.id === r.id)!.pass)).length;
  console.log(`upper bound (rules or a policy passes): ${pct(any, cases.length)}; the bar: a policy at least ${rules.filter((r) => r.pass).length + Math.ceil(0.03 * cases.length)}, fixing twice what it breaks`);
  // (unsafe over the whole set, every tag)
  const whole = score(all);
  console.log(`whole ${set} (${all.length}): rules unsafe ${whole.rules.filter((r) => r.unsafe).length}; ${Object.entries(whole.runs).map(([k, rows]) => `${k} unsafe ${rows.filter((r) => r.unsafe).length}`).join(", ")}`);
  const ms = all.flatMap((c) => cache[c.id]?.ms ?? []).sort((a, b) => a - b);
  const turns = all.reduce((n, c) => n + (cache[c.id]?.turns ?? 0), 0);
  const read = all.reduce((n, c) => n + (cache[c.id]?.read ?? 0), 0);
  if (ms.length) console.log(`turns read ${read}/${turns}; reader time a turn (server, with the HTTP round trip): median ${ms[Math.floor(ms.length / 2)]} ms, p90 ${ms[Math.floor(ms.length * 0.9)]} ms`);
})();
