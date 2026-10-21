import { loadMenu } from "./run";
import { read } from "../src/server/ai/brain/understand";
const [menu, ...q] = process.argv.slice(2);
const items = loadMenu(menu).items as never;
for (const s of q.join(" ").split(" || ")) { const r = read(items, s); console.log(s, JSON.stringify({ d: r.dishes.map((x: any) => x.name), al: r.allergens, av: r.avoid, ch: r.choosing, ord: r.ordinal, cat: r.categories, courses: r.courses, b: r.budget, delex: r.delexicalized.join(" ") })); }
