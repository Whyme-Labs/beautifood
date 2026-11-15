// a1, the pre-registered comparison (totals only): both readers on the same rules, the rules' readings
// frozen in the cloud run (bench/avoid/results/a1-cloud.json). The device file's own "rules" column is the
// rules as deployed when it ran (after the false-alarm fix) and is not scored here.
import { readFileSync } from "node:fs";
import { mark, tally, type AvoidCase } from "../../src/shared/brain/avoidScore";

const json = (f: string) => JSON.parse(readFileSync(new URL(f, import.meta.url), "utf8"));
const cases: AvoidCase[] = json("../../public/hybrid/a1.json");
const byId = (f: string) => new Map<string, { rules: string[]; model: string[] | null; source?: string; ms?: number }>(json(f).rows.map((r: { id: string }) => [r.id, r]));
const cloud = byId("results/a1-cloud.json");
const device = byId("results/a1-device.json");
const rules = (id: string) => cloud.get(id)!.rules;
const line = (name: string, read: (id: string) => string[]) => {
  const t = tally(cases, cases.map((c) => mark(c, read(c.id))));
  const langs = (["en", "ms", "manglish", "zh"] as const).map((l) => {
    const cs = cases.filter((c) => c.lang === l);
    const tl = tally(cs, cs.map((c) => mark(c, read(c.id))));
    return `${l} ${tl.missed}/${tl.stating}`;
  });
  console.log(`${name.padEnd(24)} missed ${t.missed}/${t.stating} (${((100 * t.missed) / t.stating).toFixed(1)}%), false alarms ${t.falseAlarms}/${t.none} (${((100 * t.falseAlarms) / t.none).toFixed(1)}%), extra ${t.extra} | ${langs.join(", ")}`);
};
const dev = [...device.values()];
const ms = dev.map((r) => r.ms ?? 0).sort((a, b) => a - b);
console.log(`device run: ${dev.length} rows, ${dev.filter((r) => r.model).length} read, ${dev.filter((r) => r.source === "on_device").length} on device, median ${ms[ms.length >> 1]} ms, p90 ${ms[Math.floor(ms.length * 0.9)]} ms`);
line("rules alone", rules);
line("rules + cloud reader", (id) => [...new Set([...rules(id), ...(cloud.get(id)!.model ?? [])])]);
line("rules + on-device reader", (id) => [...new Set([...rules(id), ...(device.get(id)?.model ?? [])])]);
line("cloud reader alone", (id) => cloud.get(id)!.model ?? []);
line("on-device reader alone", (id) => device.get(id)?.model ?? []);
