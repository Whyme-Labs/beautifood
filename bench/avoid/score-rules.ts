// The rules as they are now, on a1, totals only (never a case): alone, and with the cloud reader's
// readings already on file (bench/avoid/results/a1-cloud.json). Run once per rules change that is
// recorded in bench/CHANGES.md; it prints no message and no id.
import { readFileSync } from "node:fs";
import { understand } from "../../src/server/ai/brain/understand";
import { contextAt, DEMO_MENUS } from "../../src/server/ai/demoMenus";
import { hintItems } from "../../src/shared/brain/avoidHint";
import { mark, tally, type AvoidCase } from "../../src/shared/brain/avoidScore";

const items = contextAt(DEMO_MENUS[0], { weekday: 3, minutes: 12 * 60 + 30, date: "2026-10-21" } as never).items;
const rulesRead = (text: string) => {
  const u = understand(items as never, text);
  return hintItems({ allergens: u.stated.filter((a) => !u.leaveOff.includes(a)), diets: u.statedDiet, meats: u.noMeat, alcohol: u.saysNoAlcohol });
};
const cases: AvoidCase[] = JSON.parse(readFileSync(new URL("../../public/hybrid/a1.json", import.meta.url), "utf8"));
const cloud = new Map<string, string[]>(JSON.parse(readFileSync(new URL("results/a1-cloud.json", import.meta.url), "utf8")).rows.map((r: { id: string; model: string[] }) => [r.id, r.model]));
const reads = cases.map((c) => rulesRead(c.text));
const line = (name: string, read: (k: number) => string[]) => {
  const t = tally(cases, cases.map((c, k) => mark(c, read(k))));
  const langs = (["en", "ms", "manglish", "zh"] as const).map((l) => {
    const ix = cases.map((c, k) => k).filter((k) => cases[k].lang === l);
    const tl = tally(ix.map((k) => cases[k]), ix.map((k) => mark(cases[k], read(k))));
    return `${l} ${tl.missed}/${tl.stating}, fa ${tl.falseAlarms}/${tl.none}`;
  });
  console.log(`${name}: missed ${t.missed}/${t.stating}, false alarms ${t.falseAlarms}/${t.none}, extra ${t.extra} | ${langs.join("; ")}`);
};
line("rules alone", (k) => reads[k]);
line("rules + cloud reader", (k) => [...new Set([...reads[k], ...(cloud.get(cases[k].id) ?? [])])]);
