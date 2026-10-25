// How well the brain finds the dishes a guest names, and the dishes an earlier answer named, on the
// readable sets (never v6): a question about a dish needs that dish found, and a follow-up needs
// the dishes just shown. A miss here sends the answer to a plain recommendation.
//   npx tsx bench/dishes.ts [--misses]
import { loadCases, loadMenu, type Set } from "./run";
import { read, type Dish } from "../src/server/ai/brain/understand";
import { dishesIn } from "../src/server/ai/brain";

const SETS: [Set, string][] = [["v1", "dev"], ["heldout", "test"], ["v3", "test"], ["v4", "test"], ["v5", "test"]];
const show = process.argv.includes("--misses");
const q = { n: 0, found: 0 };
const turn = { n: 0, found: 0 };
for (const [set, split] of SETS)
  for (const c of loadCases(split, set)) {
    const ctx = loadMenu(c.menu);
    const items = ctx.items as unknown as Dish[];
    const named = [...(c.expect.includes ?? [])];
    // the question names the dish it asks about (no earlier turn to take it from)
    if (!c.before?.length && named.length && c.tags.some((t) => ["dish_info", "dish_allergen", "compare"].includes(t))) {
      const got = read(items, c.question).dishes.map((d) => d.name);
      for (const n of named) {
        q.n++;
        if (got.includes(n)) q.found++;
        else if (show) console.log(`Q  ${c.id}: "${c.question}" → [${got.join(", ")}], missing ${n}`);
      }
    }
    // the dishes an earlier answer named, which a follow-up chooses among
    const last = c.before?.at(-1)?.assistant;
    if (last && c.expect.onlyFrom?.length) {
      const got = dishesIn(ctx, last).map((i) => i.name);
      for (const n of c.expect.onlyFrom) {
        turn.n++;
        if (got.includes(n)) turn.found++;
        else if (show) console.log(`A  ${c.id}: "${last.slice(0, 90)}" → [${got.join(", ")}], missing ${n}`);
      }
    }
  }
const pct = (x: { n: number; found: number }) => `${x.found}/${x.n} (${((100 * x.found) / x.n).toFixed(1)}%)`;
console.log(`dishes named in a question, found: ${pct(q)}`);
console.log(`dishes an earlier answer named, found: ${pct(turn)}`);
