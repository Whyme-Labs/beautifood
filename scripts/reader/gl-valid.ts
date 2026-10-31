// The browser reader (serve_gl.py) on the teacher's validation turns (check.ts's train.valid.jsonl),
// judged the way it's used: its reading applied to the order before the turn (applyTurn) must give the
// order after it, which the teacher's labels were checked to give. Prints how many do, how many readings
// are refused (null: the rules would answer), and how many give a wrong order, by language.
//
//   npx tsx scripts/reader/gl-valid.ts --url http://127.0.0.1:8084 --valid <train.valid.jsonl> --menus <train.menus.json> [--show 10]
import { readFileSync } from "node:fs";
import { readTurn, type GlCall } from "../../src/server/ai/brain/glReader";
import { sameOrder, type OrderLineT } from "../../src/server/ai/brain/turnReading";
import type { Dish } from "../../src/server/ai/brain/understand";

const arg = (k: string, d = "") => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
type MenuDish = { name: string; zh?: string; price: number; groups: { name: string; min: number; max: number; options: string[] }[] };
const menus: Record<string, MenuDish[]> = JSON.parse(readFileSync(arg("menus"), "utf8"));
const rows = readFileSync(arg("valid"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const show = Number(arg("show", "0"));
const toDish = (d: MenuDish, i: number) =>
  ({ id: `d${i}`, name: d.name, price: d.price, category: "", description: "", allergens: [], dietary: [], spiceLevel: 0, isSignature: false,
    translations: d.zh ? { zh: { name: d.zh } } : undefined,
    modifiers: d.groups.map((g) => ({ name: g.name, min: g.min, max: g.max, options: g.options.map((o) => ({ name: o, price: 0 })) })) }) as unknown as Dish;
const call: GlCall = async (text, menu, order) => {
  const res = await fetch(`${arg("url")}/`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, menu, order }) });
  return res.json();
};

void (async () => {
  const by: Record<string, { right: number; refused: number; wrong: number }> = {};
  let shown = 0;
  for (const e of rows) {
    const dishes = menus[e.menu].map(toDish);
    const r = await readTurn(call, dishes, e.before as OrderLineT[], e.assistant ?? "", e.text);
    const k = (by[e.lang ?? "?"] ??= { right: 0, refused: 0, wrong: 0 });
    const all = (by.all ??= { right: 0, refused: 0, wrong: 0 });
    const verdict = !r ? "refused" : sameOrder(r.order, e.after) ? "right" : "wrong";
    k[verdict]++;
    all[verdict]++;
    if (verdict !== "right" && shown < show) {
      shown++;
      console.log(JSON.stringify({ verdict, text: e.text, before: e.before, got: r?.order ?? null, want: e.after }));
    }
  }
  for (const [lang, v] of Object.entries(by)) {
    const n = v.right + v.refused + v.wrong;
    console.log(`${lang.padEnd(10)} ${n} turns: right ${v.right} (${((100 * v.right) / n).toFixed(1)}%), refused ${v.refused}, wrong ${v.wrong}`);
  }
})();
