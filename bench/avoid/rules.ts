// The rules' own avoid reading on the development sets (our 40 examples, d1, d2): totals, and with
// --show each miss and false alarm. Never run on a1 (bench/avoid/z7.json, z8.json).
//   npx tsx bench/avoid/rules.ts [--show]
import { existsSync, readFileSync } from "node:fs";
import { understand } from "../../src/server/ai/brain/understand";
import { contextAt, DEMO_MENUS } from "../../src/server/ai/demoMenus";
import { hintItems } from "../../src/shared/brain/avoidHint";
import { mark, tally, type AvoidCase } from "../../src/shared/brain/avoidScore";

const LUNCH = new Date("2026-11-11T12:30:00+08:00");
const items = contextAt(DEMO_MENUS[0], LUNCH as never).items;
/** What the rules alone read as avoided in `text` (as the /hybrid page reads it). */
export const rulesRead = (text: string) => {
  const u = understand(items as never, text);
  return hintItems({ allergens: u.stated.filter((a) => !u.leaveOff.includes(a)), diets: u.statedDiet, meats: u.noMeat, alcohol: u.saysNoAlcohol });
};
const show = process.argv.includes("--show");
for (const f of ["public/hybrid/dev.json", "bench/avoid/d1.json", "bench/avoid/d2.json"]) {
  const p = new URL(`../../${f}`, import.meta.url);
  if (!existsSync(p)) continue;
  const cases: AvoidCase[] = JSON.parse(readFileSync(p, "utf8"));
  const reads = cases.map((c) => rulesRead(c.text));
  const marks = cases.map((c, k) => mark(c, reads[k]));
  const t = tally(cases, marks);
  console.log(`${f}: missed ${t.missed}/${t.stating}, false alarms ${t.falseAlarms}/${t.none}, extra ${t.extra}`);
  if (show) cases.forEach((c, k) => {
    const m = marks[k];
    if (m.missed || m.falseAlarm || m.extra.length) console.log(`  ${m.falseAlarm ? "FA" : m.missed ? "MISS" : "EXTRA"} ${c.id} [${c.lang}] ${c.text}\n     read ${JSON.stringify(reads[k])} gold ${JSON.stringify(hintItems(c.gold as never))}`);
  });
}
