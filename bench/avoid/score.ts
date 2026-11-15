// a1, aggregates only (the pre-registration: its failures are not read case by case).
// npx tsx bench/avoid/score.ts bench/avoid/results/a1-*.json
import { readFileSync, existsSync } from "node:fs";
import { mark, tally } from "../../src/shared/brain/avoidScore";
const cases = JSON.parse(readFileSync(new URL("../../public/hybrid/a1.json", import.meta.url), "utf8"));
const runs: Record<string, any> = {};
for (const f of process.argv.slice(2)) if (existsSync(f)) runs[f.replace(/.*\//, "").replace(".json", "")] = JSON.parse(readFileSync(f, "utf8"));
const pct = (n: number, d: number) => (d ? `${n}/${d} (${((100 * n) / d).toFixed(1)}%)` : "–");
const report = (name: string, pick: (c: any, row: any) => string[] | null, rowsOf: Map<string, any>) => {
  const idx = cases.map((c: any, k: number) => k).filter((k: number) => pick(cases[k], rowsOf.get(cases[k].id)) !== null);
  const cs = idx.map((k: number) => cases[k]);
  const t = tally(cs, idx.map((k: number) => mark(cases[k], pick(cases[k], rowsOf.get(cases[k].id))!)));
  const langs = ["en", "ms", "manglish", "zh"].map((l) => {
    const ix = idx.filter((k: number) => cases[k].lang === l);
    const tl = tally(ix.map((k: number) => cases[k]), ix.map((k: number) => mark(cases[k], pick(cases[k], rowsOf.get(cases[k].id))!)));
    return `${l} ${pct(tl.missed, tl.stating)}`;
  });
  console.log(`  ${name.padEnd(22)} n=${cs.length}  missed ${pct(t.missed, t.stating)}  false alarms ${pct(t.falseAlarms, t.none)}  extra ${t.extra} | missed by lang: ${langs.join(", ")}`);
};
for (const [name, r] of Object.entries(runs)) {
  const rows = new Map<string, any>(r.rows.map((x: any) => [x.id, x]));
  const read = r.rows.filter((x: any) => x.model);
  const ms = read.map((x: any) => x.ms).sort((a: number, b: number) => a - b);
  console.log(`${name}: ${r.rows.length} run, ${read.length} read by the model (${read.filter((x: any) => x.source === "on_device").length} on device), median ${ms[Math.floor(ms.length / 2)]} ms`);
  report("rules alone (all run)", (c, x) => (x ? x.rules : null), rows);
  report("rules + model", (c, x) => (x ? [...new Set([...x.rules, ...(x.model ?? [])])] : null), rows);
  report("rules alone (same n)", (c, x) => (x?.model ? x.rules : null), rows);
  report("rules + model (read)", (c, x) => (x?.model ? [...new Set([...x.rules, ...x.model])] : null), rows);
  report("model alone (read)", (c, x) => (x?.model ? x.model : null), rows);
}
