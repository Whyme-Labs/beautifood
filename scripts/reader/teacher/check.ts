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
/** A list of names however the teacher wrote it (a list, one string, null). */
const list = (x: unknown): string[] => (Array.isArray(x) ? x : typeof x === "string" && x.trim() ? [x] : []).filter((v) => typeof v === "string" || typeof v === "number").map((v) => String(v).trim());
const num = (x: unknown) => (x === null || x === undefined || x === "" || !Number.isFinite(Number(x)) ? undefined : Number(x));
/** An option as the menu names it: the teacher sometimes copies the menu's display ("Extra Egg +1.5",
 * "Size: Large"). Only ever mapped to a name this dish has; anything else is left as written (and fails). */
const canonOption = (d: Dish | undefined, name: string): string => {
  const names = (d?.modifiers ?? []).flatMap((g) => g.options.map((o) => o.name));
  if (!d || names.includes(name)) return name;
  const bare = name.replace(/\s*\(?[+]\s*(RM\s*)?\d+(\.\d+)?\)?\s*$/i, "").trim();
  for (const c of [bare, bare.replace(/^[^:]+:\s*/, "")]) {
    const hit = names.find((n) => n.toLowerCase() === c.toLowerCase());
    if (hit) return hit;
  }
  return name;
};
/** The option names the teacher meant, however it wrote them: a list of names; or a map, group -> option
 * name(s), or option name -> anything. Each is mapped to a name this dish has where one matches. Also,
 * for a map keyed by group, the option each group key stands for (to read quotes keyed by group). */
function optionsOf(x: unknown, d: Dish | undefined): { names: string[]; byGroup: Record<string, string> } {
  const known = new Set((d?.modifiers ?? []).flatMap((g) => g.options.map((o) => o.name)));
  const names: string[] = [];
  const byGroup: Record<string, string> = {};
  const add = (v: unknown, group?: string) => {
    for (const n of list(v)) {
      const c = canonOption(d, n);
      names.push(c);
      if (group) byGroup[group] = c;
    }
  };
  if (Array.isArray(x) || typeof x === "string") add(x);
  else if (x && typeof x === "object")
    for (const [k, v] of Object.entries(x)) {
      if (known.has(canonOption(d, k))) names.push(canonOption(d, k));
      else add(v, k);
    }
  return { names: [...new Set(names)], byGroup };
}
/** One of the teacher's items in the shape applyTurn takes (null if it isn't one). */
const asItem = (i: unknown, dishes: Dish[]): TeacherItem | null => {
  if (!i || typeof i !== "object") return null;
  const x = i as Record<string, unknown>;
  if (!(CHANGES as readonly string[]).includes(String(x.change)) || typeof x.dish !== "string") return null;
  const dish = x.dish.trim();
  const d = dishes.find((y) => y.name === dish);
  const q = (x.quotes && typeof x.quotes === "object" ? x.quotes : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : undefined);
  const on = optionsOf(x.options, d);
  const off = optionsOf(x.removeOptions, d);
  const groups = { ...on.byGroup, ...off.byGroup };
  const known = new Set((d?.modifiers ?? []).flatMap((g) => g.options.map((o) => o.name)));
  // quotes: keyed by option name, or by group (the option that group stands for)
  const quoteOpts: Record<string, string> = {};
  for (const [k, v] of Object.entries(q.options && typeof q.options === "object" ? q.options : {})) {
    if (typeof v !== "string") continue;
    const name = known.has(canonOption(d, k)) ? canonOption(d, k) : groups[k];
    if (name) quoteOpts[name] = v;
  }
  // (options left out but quoted: the quoted ones)
  const names = on.names.length || !["new", "more", "modify", "split_off"].includes(String(x.change)) ? on.names : Object.keys(quoteOpts);
  return {
    change: x.change as TurnItem["change"], dish,
    ...(num(x.count) !== undefined ? { count: num(x.count) } : {}),
    options: names, removeOptions: off.names,
    ...(owner(str(x.owner)) ? { owner: owner(str(x.owner)) } : {}),
    quotes: { dish: str(q.dish), count: str(q.count), owner: str(q.owner), options: quoteOpts },
  };
};
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

/** A menu name as a guest may write it: whole, without its bracketed part, or just the bracketed part
 * ("Kurang Minyak (Less Oil)": "Kurang Minyak", "Less Oil"); and the Chinese name. */
const nameForms = (name: string, zh?: string) => {
  const inner = [...name.matchAll(/\(([^)]+)\)/g)].map((m) => m[1]);
  return [name, name.replace(/\s*\([^)]*\)/g, "").trim(), ...inner, ...(zh ? [zh] : [])].filter((x) => x && x.length >= 2);
};
const EN = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const MS = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "lapan", "sembilan", "sepuluh"];
const ZH = ["", "一", "两|二", "三", "四", "五", "六", "七", "八", "九", "十"];
/** How a count may be written: "2", "2x", "x2", "two", "dua", "两". */
const countForms = (n: number) => [`${n}x`, `x${n}`, `${n}`, ...(n <= 10 ? [EN[n], MS[n], ...ZH[n].split("|")] : [])].filter(Boolean);
/** The first form found as a whole word (any form, for Chinese), nearest `near`. */
function firstFound(text: string, forms: string[], near?: [number, number] | null): [number, number] | null {
  for (const f of forms) {
    const cjk = /[\u3400-\u9fff]/.test(f);
    // (Latin words end at anything but a Latin letter or digit: "2份", "dua碗" still count)
    const re = new RegExp((cjk ? "" : "(?<![A-Za-z0-9])") + f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+") + (cjk ? "" : "(?![A-Za-z0-9])"), "giu");
    const all = [...text.matchAll(re)].map((m) => [m.index!, m.index! + m[0].length] as [number, number]);
    if (!all.length) continue;
    const gap = (sp: [number, number]) => (near ? Math.min(Math.abs(sp[0] - near[1]), Math.abs(near[0] - sp[1])) : 0);
    return all.sort((a, b) => gap(a) - gap(b))[0];
  }
  return null;
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
      const acts = list(t.acts).filter((a) => (TURN_ACTS as readonly string[]).includes(a));
      const raw = Array.isArray(t.items) ? t.items : [];
      const items = raw.map((i) => asItem(i, dishes)).filter((i): i is TeacherItem => !!i);
      if (items.length !== raw.length) return "a change of no known kind";
      for (const i of items) {
        const q = i.quotes ?? {};
        for (const x of [q.dish, q.count, q.owner, ...Object.values(q.options ?? {})]) if (x && !quoted(x, text)) return "a quote isn't the guest's words";
      }
      const r = applyTurn(order, { acts: acts as never, items }, dishes);
      if (r.errors.length) return `the changes don't fit: ${r.errors[0].replace(/".*"/, "…").replace(/^.*?(has no add-on|isn't on the order|no dish)/, "$1").replace(/^(no dish) .*/, "$1")}`;
      const after = (Array.isArray(t.order_after) ? t.order_after : []).filter((l) => l && typeof l === "object").map((l) => ({ dish: String(l.dish), count: Number(l.count ?? 1), options: optionsOf(l.options, dishes.find((x) => x.name === String(l.dish))).names, ...(owner(typeof l.owner === "string" ? l.owner : undefined) ? { owner: owner(l.owner) } : {}) }));
      if (!sameOrder(r.order, after)) {
        if (process.env.CHECK_DEBUG && Math.random() < Number(process.env.CHECK_DEBUG)) console.error(JSON.stringify({ text, before: order, items: items.map(({ quotes, ...i }) => i), got: r.order, said: after }));
        return "the changes don't give the order it says";
      }
      // the training example: each part where it is in the message
      // the training example: each part where it is in the message. A part the teacher applied but didn't
      // quote is looked for by its menu name (or the count by its number); a turn with a part still not
      // found isn't trained on (its words would be taught as nothing), though the chat goes on.
      let missing = "";
      const located = items.map((i) => {
        const q = i.quotes ?? {};
        const d = dishes.find((x) => x.name === i.dish)!;
        const dishSpan = find(text, q.dish) ?? firstFound(text, nameForms(d.name, d.translations?.zh?.name));
        if (!dishSpan) missing ||= "dish";
        const optionSpans: Record<string, [number, number]> = {};
        for (const o of [...(i.options ?? []), ...(i.removeOptions ?? [])]) {
          const sp = find(text, q.options?.[o], dishSpan) ?? firstFound(text, nameForms(o), dishSpan);
          if (sp) optionSpans[o] = sp;
          else missing ||= "add-on";
        }
        const countSpan = find(text, q.count, dishSpan) ?? (i.count !== undefined ? firstFound(text, countForms(i.count), dishSpan) : null);
        if (!countSpan && i.count !== undefined && i.count !== 1) missing ||= "count";
        const ownerSpan = find(text, q.owner, dishSpan) ?? (i.owner ? firstFound(text, i.owner === "me" ? ["I", "me", "saya", "aku", "我"] : [i.owner], dishSpan) : null);
        if (!ownerSpan && i.owner) missing ||= "owner";
        return {
          change: i.change, dish: i.dish, count: i.count, options: i.options ?? [], removeOptions: i.removeOptions ?? [], owner: i.owner,
          dishSpan, dishKind: dishSpan && !grounded(d, text.slice(dishSpan[0], dishSpan[1]), dishes) ? "pointer" : "name",
          countSpan, ownerSpan, optionSpans,
        };
      });
      if (missing) bump(`not trained on: ${missing} not found in the message`);
      else examples.push({ id: `t${ci}-${ti}`, lang: c.lang, menu: c.menu, text, assistant: t.assistant_before ?? "", before: order, acts, items: located, after: r.order });
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
