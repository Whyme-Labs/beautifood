// a2, scored once per system, totals only (by language too): a2 is never read case by case. The rules'
// and the reader's readings are those the page made (the deployed rules, the reader with its check).
//   npx tsx bench/avoid/score-a2.ts bench/avoid/results/a2-device.json [bench/avoid/results/a2-cloud.json]
import { readFileSync } from "node:fs";
import { mark, tally, type AvoidCase } from "../../src/shared/brain/avoidScore";

const cases: AvoidCase[] = JSON.parse(readFileSync(new URL("../../public/hybrid/a2.json", import.meta.url), "utf8"));
const pct = (n: number, d: number) => `${n}/${d} (${((100 * n) / d).toFixed(1)}%)`;
for (const f of process.argv.slice(2)) {
  const run = JSON.parse(readFileSync(f, "utf8"));
  const rows = new Map<string, { rules: string[]; model: string[] | null; source?: string; ms?: number }>(run.rows.map((r: { id: string }) => [r.id, r]));
  const ms = [...rows.values()].map((r) => r.ms ?? 0).sort((a, b) => a - b);
  console.log(`${f.replace(/.*\//, "")}: ${run.mode}, instruction ${run.prompt}, ${rows.size} of ${cases.length} run, ${[...rows.values()].filter((r) => r.model).length} read (${[...rows.values()].filter((r) => r.source === "on_device").length} on device), median ${ms[ms.length >> 1]} ms`);
  const line = (name: string, read: (id: string) => string[]) => {
    const cs = cases.filter((c) => rows.has(c.id));
    const t = tally(cs, cs.map((c) => mark(c, read(c.id))));
    const langs = (["en", "ms", "manglish", "zh"] as const).map((l) => {
      const ls = cs.filter((c) => c.lang === l);
      const tl = tally(ls, ls.map((c) => mark(c, read(c.id))));
      return `${l} ${tl.missed}/${tl.stating}`;
    });
    console.log(`  ${name.padEnd(16)} missed ${pct(t.missed, t.stating)}, false alarms ${pct(t.falseAlarms, t.none)}, extra ${t.extra} | missed by lang: ${langs.join(", ")}`);
  };
  line("rules alone", (id) => rows.get(id)!.rules);
  line("reader alone", (id) => rows.get(id)!.model ?? []);
  line("rules + reader", (id) => [...new Set([...rows.get(id)!.rules, ...(rows.get(id)!.model ?? [])])]);
}
