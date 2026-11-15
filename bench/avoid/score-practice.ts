// A run of the practice sets (d1 + d2) downloaded from /hybrid: totals for the rules, the model and both,
// and with --show each miss and false alarm (practice sets are for reading; a1 never is).
//   npx tsx bench/avoid/score-practice.ts <run.json> [more runs…] [--show]
import { readFileSync } from "node:fs";
import { hintItems } from "../../src/shared/brain/avoidHint";
import { mark, tally, type AvoidCase } from "../../src/shared/brain/avoidScore";

const cases: AvoidCase[] = JSON.parse(readFileSync(new URL("../../public/hybrid/practice.json", import.meta.url), "utf8"));
const show = process.argv.includes("--show");
for (const f of process.argv.slice(2).filter((a) => !a.startsWith("--"))) {
  const run = JSON.parse(readFileSync(f, "utf8"));
  const rows = new Map<string, { rules: string[]; model: string[] | null; source?: string; ms?: number }>(run.rows.map((r: { id: string }) => [r.id, r]));
  const cs = cases.filter((c) => rows.has(c.id));
  const ms = cs.map((c) => rows.get(c.id)!.ms ?? 0).sort((a, b) => a - b);
  console.log(`${f.replace(/.*\//, "")}: instruction ${run.prompt ?? "v1"}, ${cs.length} rows, ${cs.filter((c) => rows.get(c.id)!.source === "on_device").length} on device, median ${ms[ms.length >> 1]} ms`);
  const line = (name: string, read: (c: AvoidCase) => string[]) => {
    const t = tally(cs, cs.map((c) => mark(c, read(c))));
    console.log(`  ${name.padEnd(16)} missed ${t.missed}/${t.stating}, false alarms ${t.falseAlarms}/${t.none}, extra ${t.extra}`);
  };
  const model = (c: AvoidCase) => rows.get(c.id)!.model ?? [];
  const rules = (c: AvoidCase) => rows.get(c.id)!.rules;
  line("rules alone", rules);
  line("model alone", model);
  line("rules + model", (c) => [...new Set([...rules(c), ...model(c)])]);
  if (show)
    for (const c of cs) {
      const m = mark(c, model(c));
      if (m.missed || m.falseAlarm || m.extra.length) console.log(`  ${m.falseAlarm ? "FA   " : m.missed ? "MISS " : "EXTRA"} ${c.id} [${c.lang}] ${c.text}\n        model ${JSON.stringify(model(c))} gold ${JSON.stringify(hintItems(c.gold as never))}`);
    }
}
