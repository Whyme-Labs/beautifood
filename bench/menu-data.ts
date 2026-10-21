// How well the onboarding parser reads a pasted menu: its allergens, diet and spice against the
// benchmark's ground truth (bench/menus/<menu>.gold.json). A missed allergen is the dangerous kind
// of error (recall); a false one only hides a dish (precision).
//
//   npx tsx bench/menu-data.ts [--dishes]
import { readdirSync } from "node:fs";
import { loadGold, loadMenu } from "./run";

const DIR = new URL(".", import.meta.url).pathname;
const menus = readdirSync(`${DIR}menus`).filter((f) => f.endsWith(".gold.json")).map((f) => f.replace(".gold.json", ""));
const per = new Map<string, { tp: number; fp: number; fn: number }>();
const misses: string[] = [];
let veg = { right: 0, n: 0, unsafe: 0 };
let vegan = { right: 0, n: 0, unsafe: 0 };
let spiceErr = 0;
let spiceN = 0;
for (const m of menus) {
  const gold = loadGold(m)!;
  for (const d of loadMenu(m, "parser").items) {
    const g = gold[d.name];
    if (!g) continue;
    const all = new Set([...g.allergens, ...d.allergens]);
    for (const a of all) {
      const s = per.get(a) ?? { tp: 0, fp: 0, fn: 0 };
      const inGold = g.allergens.includes(a);
      const inParsed = (d.allergens as string[]).includes(a);
      if (inGold && inParsed) s.tp++;
      else if (inParsed) (s.fp++, misses.push(`  false ${a.padEnd(12)} ${m}: ${d.name}`));
      else (s.fn++, misses.push(`  MISSED ${a.padEnd(11)} ${m}: ${d.name}`));
      per.set(a, s);
    }
    const pv = d.dietary.includes("vegetarian") || d.dietary.includes("vegan");
    veg = { right: veg.right + Number(pv === g.vegetarian), n: veg.n + 1, unsafe: veg.unsafe + Number(pv && !g.vegetarian) };
    if (pv && !g.vegetarian) misses.push(`  UNSAFE vegetarian  ${m}: ${d.name}`);
    const pg = d.dietary.includes("vegan");
    vegan = { right: vegan.right + Number(pg === g.vegan), n: vegan.n + 1, unsafe: vegan.unsafe + Number(pg && !g.vegan) };
    if (pg && !g.vegan) misses.push(`  UNSAFE vegan       ${m}: ${d.name}`);
    spiceErr += Math.abs(d.spiceLevel - g.spice);
    spiceN++;
  }
}
const f = (x: number) => (Number.isFinite(x) ? (x * 100).toFixed(0).padStart(4) + "%" : "    –");
let TP = 0, FP = 0, FN = 0;
console.log("allergen        recall  precision   (missed = dangerous)");
for (const [a, s] of [...per].sort((x, y) => y[1].fn - x[1].fn)) {
  (TP += s.tp), (FP += s.fp), (FN += s.fn);
  console.log(`  ${a.padEnd(12)} ${f(s.tp / (s.tp + s.fn))}  ${f(s.tp / (s.tp + s.fp))}     missed ${s.fn}, false ${s.fp}`);
}
console.log(`  ${"all".padEnd(12)} ${f(TP / (TP + FN))}  ${f(TP / (TP + FP))}     missed ${FN}, false ${FP}`);
console.log(`vegetarian: ${f(veg.right / veg.n)} right, ${veg.unsafe} non-vegetarian dishes called vegetarian`);
console.log(`vegan:      ${f(vegan.right / vegan.n)} right, ${vegan.unsafe} non-vegan dishes called vegan`);
console.log(`spice:      mean error ${(spiceErr / spiceN).toFixed(2)} levels over ${spiceN} dishes`);
if (process.argv.includes("--dishes")) console.log(`\n${misses.join("\n")}`);
