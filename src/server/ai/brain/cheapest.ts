// "What's the cheapest way to get half a chicken with fries, coleslaw and a drink?", "nasi lemak with
// ayam goreng, sambal sotong and a fried egg", "四瓶啤酒怎样买最便宜？": what the guest wants, as a few
// things with counts, bought for the least from what's served now. A set or a dish with its combo
// add-ons can cover several of them at once ("Half Fried Chicken" + Fries + Coleslaw + Soft drink), an
// option can cover several of one ("Bucket of 4").
import { editDistance, normalize } from "../../../shared/brain/text";
import type { ModifierOption } from "../../../shared/types";
import { courseOfWord, isDrink, same, type Course, type Dish } from "./understand";

/** One thing wanted: its words (or its Chinese), the kind of dish it must be, how many. */
export interface Need {
  words: string[];
  zh?: string;
  course?: Course;
  count: number;
}
/** One line bought: the dish, the add-ons chosen, and how many of each need it covers. */
export interface Buy {
  dish: Dish;
  options: ModifierOption[];
  covers: number[];
  price: number;
}

export const CHEAPEST_WAY = /\b(cheapest|cheaper|most economical|best value) way\b|\bcheaper (to|if i|if we) (get|order|buy)\b|\bcara (paling )?murah\b/;
export const CHEAPEST_WAY_ZH = /怎(样|么)(买|点)(最)?(便宜|划算)|最(便宜|划算)的(买法|点法|方法)/;

const NUM: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5 };
const ZH_NUM: Record<string, number> = { 一: 1, 两: 2, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 };
// words that say nothing about the food: the ask itself, and how it's served
const STOP = /^(i|we|want|wanna|need|would|like|what|whats|s|is|it|its|the|a|an|some|me|my|please|pls|can|could|how|do|does|to|get|order|buy|have|that|this|those|them|all|of|for|cheapest|cheaper|economical|best|value|way|way to|or|in|on|which|nak|mau|saya|kami|hot|iced|cold|warm|panas|ais|sejuk|cara|paling|murah)$/;
const WITH = /^(with|plus|dengan|tambah)$/;
const SPLIT = /^(and|dan|n|plus|then|also|&)$/;

const singular = (w: string) => (w.length <= 3 ? w : /ies$/.test(w) ? w.replace(/ies$/, "y") : /(s|x|z|ch|sh)es$/.test(w) ? w.slice(0, -2) : /[^s]s$/.test(w) ? w.slice(0, -1) : w);
// (a typo only in a longer word: "fries" isn't "fried")
const like = (a: string, b: string) => singular(a) === singular(b) || (same(a, b) && (Math.min(a.length, b.length) >= 6 || editDistance(a, b, 1) > 1));
const courseOnly = (n: Need) => n.words.length > 0 && n.words.every((w) => courseOfWord(w) || courseOfWord(singular(w)));

/** The things wanted, in the guest's words, or null when there aren't at least two to weigh. */
export function needsOf(text: string): Need[] | null {
  if (/[一-鿿]/.test(text) && !/[a-z]{3}/i.test(text.replace(/RM/gi, ""))) {
    const parts = text
      .replace(CHEAPEST_WAY_ZH, " ")
      .replace(/我(想)?要|想要|请问|一共|多少钱|[？?。！!]/g, " ")
      .split(/[，,、和跟加还有]|\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const needs = parts.flatMap((p): Need[] => {
      const m = p.match(/^(\d+|[一两二三四五六]?)(个|份|杯|碗|瓶|罐|包|块|只|盘|碟)?(.+)$/);
      if (!m || !m[3]) return [];
      return [{ words: [], zh: m[3], count: m[1] ? Number(m[1]) || ZH_NUM[m[1]] || 1 : 1 }];
    });
    return needs.length && (needs.length >= 2 || needs[0].count >= 2) ? needs : null;
  }
  const toks = normalize(text.replace(CHEAPEST_WAY, " ").replace(/[,;]/g, " and ")).split(" ").filter(Boolean);
  const needs: Need[] = [];
  let cur: string[] = [];
  let count = 1;
  let joinedBy = "";
  const flush = (next: string) => {
    const words = cur.filter((w) => !STOP.test(w) && !NUM[w] && !/^\d+$/.test(w));
    const prev = needs[needs.length - 1];
    // ("two drinks with cheese foam": drinks that have it, not two drinks and some cheese foam)
    if (words.length && prev && WITH.test(joinedBy) && courseOnly(prev) && !prev.course) {
      prev.course = courseOfWord(prev.words[0]) ?? courseOfWord(singular(prev.words[0])) ?? undefined;
      prev.words = words;
    } else if (words.length) needs.push({ words, count });
    cur = [];
    count = 1;
    joinedBy = next;
  };
  for (const w of toks) {
    if (SPLIT.test(w) || WITH.test(w)) {
      flush(w);
      continue;
    }
    if (cur.every((x) => STOP.test(x)) && (NUM[w] || /^\d{1,2}$/.test(w))) count = NUM[w] ?? Number(w);
    cur.push(w);
  }
  flush("");
  return needs.length && (needs.length >= 2 || needs[0].count >= 2) ? needs : null;
}

const nameWords = (s: string) => normalize(s).split(" ").filter(Boolean);
const hasAll = (words: string[], have: string[]) => words.every((w) => have.some((h) => like(w, h)));
const zhName = (d: Dish) => Object.values(d.translations ?? {}).map((x) => x?.name ?? "").find((n) => /[一-鿿]/.test(n)) ?? "";
const ofCourse = (d: Dish, c: Course | undefined) => !c || (c === "drinks" ? isDrink(d) : true);

/** Whether `need` is the dish itself, by its name (or its Chinese one, or its course: "a drink"). */
function namedBy(d: Dish, n: Need): boolean {
  if (n.zh) {
    const z = zhName(d);
    return !!z && (z.includes(n.zh) || (n.zh.length >= 2 && n.zh.includes(z)));
  }
  if (!ofCourse(d, n.course)) return false;
  if (courseOnly(n)) return n.words.some((w) => (courseOfWord(w) ?? courseOfWord(singular(w))) === "drinks") ? isDrink(d) : false;
  return hasAll(n.words, nameWords(d.name));
}
/** Whether `need` is part of what the dish comes with, by one clause of its description ("a soft drink"). */
function inDescription(d: Dish, n: Need): boolean {
  if (n.zh || n.course) return false;
  return (d.description ?? "")
    .split(/[,;()]|\band\b|\bwith\b/)
    .map(nameWords)
    .some((clause) => clause.length > 0 && (courseOnly(n) ? n.words.some((w) => clause.some((c) => like(w, c))) : hasAll(n.words, clause)));
}
/** Whether an add-on is the thing wanted ("Fries", "Soft drink" for "a drink"). */
function optionIs(o: ModifierOption, n: Need): boolean {
  if (n.zh || n.course) return false;
  const ws = nameWords(o.name);
  return courseOnly(n) ? n.words.some((w) => ws.some((x) => like(w, x))) : hasAll(n.words, ws);
}
/** How many of the dish an option makes it ("Bucket of 4"). */
const unitsOf = (o: ModifierOption) => Number(normalize(o.name).match(/\b(?:bucket|set|pack|tower|jug) of (\d+)\b|\b(\d+) (?:bottles|cans|glasses)\b/)?.slice(1).find(Boolean) ?? 1);

/** Every way of buying one dish that covers something wanted. */
function buysOf(d: Dish, needs: Need[]): Buy[] {
  const groups = d.modifiers ?? [];
  // the choices it can't be ordered without, at their cheapest
  const required = groups.filter((g) => (g.min ?? 0) >= 1).map((g) => [...g.options].sort((a, b) => a.price - b.price)[0]).filter((o): o is ModifierOption => !!o);
  const base = needs.map((n) => (namedBy(d, n) ? 1 : 0));
  const described = needs.map((n, k) => (!base[k] && inDescription(d, n) ? 1 : 0));
  const adds = groups.flatMap((g) => g.options.filter((o) => needs.some((n) => optionIs(o, n)) || unitsOf(o) > 1).map((o) => ({ o, g })));
  const out: Buy[] = [];
  // each set of the add-ons that matter (a few at most), one from a group that takes one
  for (let mask = 0; mask < 1 << Math.min(adds.length, 6); mask++) {
    const chosen = adds.filter((_, k) => mask & (1 << k));
    if (chosen.some((x, k) => chosen.findIndex((y) => y.g === x.g) !== k && (x.g.max ?? 1) <= 1)) continue;
    if (groups.some((g) => chosen.filter((x) => x.g === g).length > (g.max ?? 1))) continue;
    const options = [...required.filter((r) => !chosen.some((x) => x.g.options.includes(r))), ...chosen.map((x) => x.o)];
    const units = Math.max(1, ...chosen.map((x) => unitsOf(x.o)));
    const covers = needs.map((n, k) => (base[k] ? units : 0) + (chosen.some((x) => optionIs(x.o, n)) ? 1 : 0));
    // (what the description says it comes with counts only for a set: a dish that's two of the things)
    const many = covers.filter(Boolean).length + described.filter(Boolean).length;
    const all = covers.map((c, k) => c || (many >= 2 && described[k] ? 1 : 0));
    if (!all.some(Boolean)) continue;
    out.push({ dish: d, options, covers: all, price: d.price + options.reduce((s, o) => s + o.price, 0) });
  }
  return out;
}

/** The least the wanted things cost, bought from `dishes` (each a dish with its add-ons), or null. */
export function cheapestWay(dishes: Dish[], needs: Need[], apart = false): { buys: Buy[]; total: number } | null {
  // (`apart`: each thing on its own, by its own name, as a guest would without the set)
  const buys = dishes.flatMap((d) => buysOf(d, needs)).filter((b) => !apart || (b.covers.filter(Boolean).length === 1 && b.options.every((o) => !o.price) && needs.some((n, k) => b.covers[k] && namedBy(b.dish, n))));
  if (needs.some((_, k) => !buys.some((b) => b.covers[k]))) return null;
  const memo = new Map<string, { buys: Buy[]; total: number } | null>();
  const solve = (left: number[]): { buys: Buy[]; total: number } | null => {
    const k = left.findIndex((n) => n > 0);
    if (k < 0) return { buys: [], total: 0 };
    const key = left.join(",");
    if (memo.has(key)) return memo.get(key)!;
    let best: { buys: Buy[]; total: number } | null = null;
    for (const b of buys) {
      if (!b.covers[k]) continue;
      const rest = solve(left.map((n, j) => Math.max(0, n - b.covers[j])));
      if (rest && (!best || rest.total + b.price < best.total)) best = { buys: [b, ...rest.buys], total: rest.total + b.price };
    }
    memo.set(key, best);
    return best;
  };
  return solve(needs.map((n) => n.count));
}
