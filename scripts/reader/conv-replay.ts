// Scores a conversation reader on the benchmark, as pre-registered in bench/CHANGES.md: each case's
// earlier turns are replayed in order from an empty order (with the written assistant replies), the
// reader's order after each turn feeding the next, and its order after the last turn is what the
// brain bills. Prints the rules alone, each policy (fixed, broke, unsafe), the best of the rules and
// the policies case by case, and the reader's time a turn.
//
//   npx tsx scripts/reader/conv-replay.ts --url http://127.0.0.1:8083 [--set v10] [--tags bill,modifier] [--cache <file.json>]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { loadCases, loadMenu, readable, runEngine } from "../../bench/run";
import { llamaBasketCall, readBasket, type BasketLine } from "../../src/server/ai/brain/convReader";
import { checkBasket, linesKey, type RawOrderReading } from "../../src/server/ai/brain/reading";

const arg = (k: string, d = "") => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const url = arg("url");
const set = arg("set", "v10");
const tags = arg("tags", "bill,modifier").split(",");
const cachePath = arg("cache");

type Cached = { raw: RawOrderReading | null; changed: boolean; ms: number[] };

void (async () => {
  const cases = loadCases("dev", set as never).filter((c) => (c.tags ?? []).some((t) => tags.includes(t)));
  const cache: Record<string, Cached> = cachePath && existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, "utf8")) : {};
  const call = url ? llamaBasketCall(url, 30000) : null;
  let done = 0;
  for (const c of cases) {
    if (cache[c.id]) continue;
    if (!call) throw new Error(`no reading cached for ${c.id} and no --url`);
    const dishes = readable(loadMenu(c.menu, "gold", c.at));
    const turns = [...(c.before ?? []).map((b) => ({ user: b.user, after: b.assistant })), { user: c.question, after: "" }];
    let order: BasketLine[] = [];
    let reply = "";
    let raw: RawOrderReading | null = null;
    let changed = false;
    const said: string[] = [];
    const ms: number[] = [];
    for (const t of turns) {
      said.push(reply, t.user);
      const t0 = performance.now();
      raw = await readBasket(call, dishes, order, reply, t.user);
      ms.push(Math.round(performance.now() - t0));
      // (what the checks keep is the order the next turn starts from)
      const checked = raw ? checkBasket(raw, dishes, () => true, said) : null;
      const next: BasketLine[] = checked ? checked.lines.map((l) => ({ dish: l.dish, count: l.count, options: l.options.map((o) => o.name), ...(l.owner ? { owner: l.owner } : {}) })) : order;
      changed = linesKey(next.map((l) => ({ ...l, options: l.options.map((name) => ({ name })) }))) !== linesKey(order.map((l) => ({ ...l, options: l.options.map((name) => ({ name })) })));
      order = next;
      reply = t.after;
    }
    cache[c.id] = { raw, changed, ms };
    if (cachePath && ++done % 20 === 0) writeFileSync(cachePath, JSON.stringify(cache));
  }
  if (cachePath) writeFileSync(cachePath, JSON.stringify(cache));

  const baskets = new Map(cases.map((c) => [c.id, cache[c.id]?.raw ? { ...cache[c.id].raw!, changed: cache[c.id].changed } : null]));
  const rules = runEngine("brain", cases, "gold");
  const base = new Map(rules.map((r) => [r.id, r]));
  const runs = { replace: runEngine("brain", cases, "gold", undefined, undefined, { baskets, policy: "replace" }), edits: runEngine("brain", cases, "gold", undefined, undefined, { baskets, policy: "edits" }) };
  const pct = (n: number) => `${n}/${cases.length} (${((100 * n) / cases.length).toFixed(1)}%)`;
  console.log(`rules    ${pct(rules.filter((r) => r.pass).length)} unsafe ${rules.filter((r) => r.unsafe).length}`);
  for (const [k, rows] of Object.entries(runs)) {
    const fixed = rows.filter((r) => r.pass && !base.get(r.id)!.pass).map((r) => r.id);
    const broke = rows.filter((r) => !r.pass && base.get(r.id)!.pass).map((r) => r.id);
    console.log(`${k.padEnd(8)} ${pct(rows.filter((r) => r.pass).length)} unsafe ${rows.filter((r) => r.unsafe).length} fixed ${fixed.length} broke ${broke.length}`);
    console.log(`   fixed: ${fixed.join(" ")}\n   broke: ${broke.join(" ")}`);
  }
  const any = rules.filter((r) => r.pass || Object.values(runs).some((rows) => rows.find((x) => x.id === r.id)!.pass)).length;
  console.log(`upper bound (rules or a policy passes): ${pct(any)}; the bar: at least ${rules.filter((r) => r.pass).length + Math.ceil(0.03 * cases.length)}`);
  const ms = cases.flatMap((c) => cache[c.id]?.ms ?? []).sort((a, b) => a - b);
  if (ms.length) console.log(`reader time a turn: median ${ms[Math.floor(ms.length / 2)]} ms, p90 ${ms[Math.floor(ms.length * 0.9)]} ms (${ms.length} turns)`);
})();
