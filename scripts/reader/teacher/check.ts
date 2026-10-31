// Checks the teacher's output (teach.py) and turns what holds into training data for the browser
// reader. A turn is kept only if every quote is the guest's own words, every name is the menu's, and
// its changes, made by the brain's own code (applyTurn), give exactly the order the teacher says they
// do; a conversation stops at its first turn that doesn't (later turns build on an order now in
// doubt). No message that reads like a benchmark question is kept.
//
//   npx tsx scripts/reader/teacher/check.ts <teacher out dir> <train.jsonl> [valid share=0.05]
import { readFileSync, writeFileSync } from "node:fs";
import { loadCases } from "../../../bench/run";
import { grounded } from "../../../src/server/ai/brain/reading";
import { applyTurn, CHANGES, quoted, sameOrder, TURN_ACTS, type OrderLineT, type TurnItem } from "../../../src/server/ai/brain/turnReading";
import type { Dish } from "../../../src/server/ai/brain/understand";

type TeacherMenu = { id: string; name: string; dishes: { name: string; zh?: string | null; category?: string; price: number; groups?: { name: string; min?: number; max?: number; options: { name: string; price?: number }[] }[] }[] };
type Quotes = { dish?: string; count?: string; options?: Record<string, string>; owner?: string };
type TeacherItem = TurnItem & { quotes?: Quotes };
type TeacherTurn = { assistant_before?: string | null; guest: string; acts?: string[]; items?: TeacherItem[]; order_after?: OrderLineT[] };

const [dir, out, validShare = "0.05"] = process.argv.slice(2);
if (!dir || !out) {
  console.error("usage: npx tsx scripts/reader/teacher/check.ts <teacher out dir> <train.jsonl> [valid share]");
  process.exit(2);
}
const lines = (p: string) => readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const cents = (x: unknown) => Math.round(Number(x) * 100) || 0;
const toDishes = (m: TeacherMenu): Dish[] =>
  m.dishes.filter((d) => d?.name).map((d, i) => ({
    id: `${m.id}-d${i}`, name: String(d.name).trim(), price: cents(d.price), category: d.category ?? "", description: "", allergens: [], dietary: [], spiceLevel: 0, isSignature: false,
    translations: d.zh ? { zh: { name: String(d.zh) } } : undefined,
    modifiers: (d.groups ?? []).filter((g) => g?.options?.length).map((g) => ({ name: String(g.name), min: Number(g.min ?? 0), max: Math.max(1, Number(g.max ?? 1)), options: g.options.map((o) => ({ name: String(o.name).trim(), price: cents(o.price) })) })),
  }) as unknown as Dish);
const owner = (o?: string) => {
  const x = (o ?? "").trim().toLowerCase();
  return !x ? undefined : /^(i|me|myself|mine|saya|aku|我|我的)$/.test(x) ? "me" : x.slice(0, 20);
};
/** Where `quote` is in `text`, any case and spacing: [start, end) in characters, the one nearest `near` if it's there more than once; or null. */
function find(text: string, quote: string | undefined, near?: [number, number] | null): [number, number] | null {
  if (!quote?.trim()) return null;
  const re = new RegExp(quote.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"), "gi");
  const all = [...text.matchAll(re)].map((m) => [m.index!, m.index! + m[0].length] as [number, number]);
  if (!all.length) return null;
  const gap = (s: [number, number]) => (near ? Math.min(Math.abs(s[0] - near[1]), Math.abs(near[0] - s[1])) : 0);
  return all.sort((a, b) => gap(a) - gap(b))[0];
}

const flat = (q: string) => q.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const sets = ["v1", "heldout", "v3", "v4", "v5", "v6", "v7", "v8", "v9", "v10", "v11"] as const;
const bench = new Set(sets.flatMap((s) => { try { return loadCases("all", s as never); } catch { return []; } }).flatMap((c) => [c.question, ...(c.before ?? []).map((b) => b.user)]).map(flat));

const menus = new Map<string, Dish[]>(lines(`${dir}/menus.jsonl`).map((m: TeacherMenu) => [m.id, toDishes(m)]));
const stats: Record<string, number> = {};
const bump = (k: string) => (stats[k] = (stats[k] ?? 0) + 1);
const examples: unknown[] = [];
for (const [ci, c] of lines(`${dir}/convs.jsonl`).entries()) {
  const dishes = menus.get(c.menu);
  if (!dishes || !Array.isArray(c.turns)) { bump("conversation unreadable"); continue; }
  let order: OrderLineT[] = [];
  for (const [ti, t] of (c.turns as TeacherTurn[]).entries()) {
    bump("turns");
    const text = String(t.guest ?? "");
    const why = (() => {
      if (!text.trim()) return "empty message";
      if (bench.has(flat(text)) && flat(text).split(" ").length > 2) return "reads like a benchmark question";
      const acts = (t.acts ?? []).filter((a) => (TURN_ACTS as readonly string[]).includes(a));
      const items: TeacherItem[] = (t.items ?? []).filter((i) => i && (CHANGES as readonly string[]).includes(i.change)).map((i) => ({ ...i, owner: owner(i.owner) }));
      if (items.length !== (t.items ?? []).length) return "a change of no known kind";
      for (const i of items) {
        const q = i.quotes ?? {};
        for (const x of [q.dish, q.count, q.owner, ...Object.values(q.options ?? {})]) if (x && !quoted(x, text)) return "a quote isn't the guest's words";
      }
      const r = applyTurn(order, { acts: acts as never, items }, dishes);
      if (r.errors.length) return `the changes don't fit: ${r.errors[0].replace(/".*"/, "…")}`;
      const after = (t.order_after ?? []).map((l) => ({ dish: String(l.dish), count: Number(l.count), options: (l.options ?? []).map(String), ...(owner(l.owner) ? { owner: owner(l.owner) } : {}) }));
      if (!sameOrder(r.order, after)) return "the changes don't give the order it says";
      // the training example: each part where it is in the message
      examples.push({
        id: `t${ci}-${ti}`, lang: c.lang, menu: c.menu, text, assistant: t.assistant_before ?? "", before: order, acts,
        items: items.map((i) => {
          const q = i.quotes ?? {};
          const dishSpan = find(text, q.dish);
          const d = dishes.find((x) => x.name === i.dish)!;
          return {
            change: i.change, dish: i.dish, count: i.count, options: i.options ?? [], removeOptions: i.removeOptions ?? [], owner: i.owner,
            dishSpan, dishKind: dishSpan && !grounded(d, text.slice(dishSpan[0], dishSpan[1]), dishes) ? "pointer" : "name",
            countSpan: find(text, q.count, dishSpan), ownerSpan: find(text, q.owner, dishSpan),
            optionSpans: Object.fromEntries(Object.entries(q.options ?? {}).map(([k, v]) => [k, find(text, v, dishSpan)]).filter(([, s]) => s)),
          };
        }),
        after: r.order,
      });
      order = r.order;
      return null;
    })();
    if (why) { bump(`dropped: ${why}`); break; }
    bump("kept");
  }
}
// (a few menus whole for validation: none of their turns are trained on)
const menuIds = [...menus.keys()];
const validMenus = new Set(menuIds.filter((_, i) => i % Math.round(1 / Number(validShare)) === 0));
const train = examples.filter((e) => !validMenus.has((e as { menu: string }).menu));
const valid = examples.filter((e) => validMenus.has((e as { menu: string }).menu));
writeFileSync(out, train.map((e) => JSON.stringify(e)).join("\n") + "\n");
writeFileSync(out.replace(/\.jsonl$/, ".valid.jsonl"), valid.map((e) => JSON.stringify(e)).join("\n") + "\n");
writeFileSync(out.replace(/\.jsonl$/, ".menus.json"), JSON.stringify(Object.fromEntries([...menus].map(([k, ds]) => [k, ds.map((d) => ({ name: d.name, zh: d.translations?.zh?.name, price: d.price, groups: (d.modifiers ?? []).map((g) => ({ name: g.name, min: g.min, max: g.max, options: g.options.map((o) => o.name) })) }))]))));
console.log(JSON.stringify({ train: train.length, valid: valid.length, ...stats }, null, 1));
