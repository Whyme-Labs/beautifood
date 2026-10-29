// An order as the guest says it, line by line: "2 large iced teh tarik, one of them less sweet",
// "2 kopi peng siew dai, 1 kopi peng kosong", "两碗汤板面，一碗加鱼丸，一碗加肉碎", "Nasi lemak
// special dua, satu besar", "12 fire wings". Each mention of a dish is a line with its own count and
// add-ons; a clause naming no dish ("one of them with extra egg") changes the lines before it.
import { normalize } from "../../../shared/brain/text";
import type { ModifierOption } from "../../../shared/types";
import { optionsSaid, optionWords } from "./modifiers";
import type { Dish, Spot } from "./understand";

/** `ref`: named as one already there ("the lime juice", "my kopi"), with no count: not more of it. */
export type Line = { dish: Dish; count: number; options: ModifierOption[]; ref?: boolean };

const NUM: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20,
  satu: 1, sebiji: 1, secawan: 1, sebungkus: 1, sepinggan: 1, semangkuk: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, lapan: 8, sembilan: 9, sepuluh: 10,
  一: 1, 两: 2, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
};
const ZH_DIGIT = /^[一两二三四五六七八九十]$/;
// a count's measure word, said between the count and the dish ("2 cups of", "两杯", "dua pinggan")
const COUNTER = /^(个|份|杯|碗|碟|盘|包|块|粒|只|支|串|根|罐|瓶|件|条|片|盒|客|套|樽|x|×|of|the|cups?|glass|glasses|plates?|bowls?|pieces?|pcs|orders?|servings?|portions?|sets?|packets?|packs?|bungkus|pinggan|mangkuk|cawan|gelas|biji|ketul|cucuk|sticks?|cans?|bottles?|tin|botol|ekor|keping)$/;
// words that join two lines of an order
const JOIN = /^(and|dan|n|plus|then|also|lepas|和|跟|还有|再|以及|另外|&)$/;
// words that describe the dish, not count it ("2 large iced", "两杯大杯", "dua besar")
const DESCRIBES = /^(hot|iced|ice|cold|warm|large|small|big|regular|medium|plain|biasa|besar|kecil|panas|ais|peng|sejuk|suam|less|more|extra|no|kurang|kosong|siew|siu|dai|sweet|manis|sugar|spicy|pedas|mild|same|fresh|whole|half|new|my|our|the|of|大|小|中|冰|热|温|的|走|少|多|加|甜|辣|大杯|中杯|小杯)$/;

/** The number a word is, with Chinese ones read across their characters ("十二"). */
function numberBefore(toks: string[], end: number): { n: number; at: number } | null {
  const t = toks[end];
  if (t === undefined) return null;
  if (/^\d{1,3}$/.test(t)) return { n: Number(t), at: end };
  if (ZH_DIGIT.test(t)) {
    let at = end;
    while (at > 0 && ZH_DIGIT.test(toks[at - 1])) at--;
    const s = toks.slice(at, end + 1).join("");
    const n = s === "十" ? 10 : s.startsWith("十") ? 10 + (NUM[s[1]] ?? 0) : s.includes("十") ? (NUM[s[0]] ?? 1) * 10 + (NUM[s[2]] ?? 0) : NUM[s[s.length - 1]];
    return n ? { n, at } : null;
  }
  return NUM[t] !== undefined ? { n: NUM[t], at: end } : null;
}
function numberAfter(toks: string[], from: number): { n: number; end: number } | null {
  const t = toks[from];
  if (t === undefined) return null;
  if (/^\d{1,3}$/.test(t)) return { n: Number(t), end: from + 1 };
  if (/^x\d{1,2}$/.test(t)) return { n: Number(t.slice(1)), end: from + 1 };
  if (ZH_DIGIT.test(t)) {
    let end = from;
    while (end < toks.length && ZH_DIGIT.test(toks[end])) end++;
    const r = numberBefore(toks, end - 1);
    return r ? { n: r.n, end } : null;
  }
  return NUM[t] !== undefined && !/^(a|an)$/.test(t) ? { n: NUM[t], end: from + 1 } : null;
}

/** A dish's option numbers ("12" of "12 pcs", "10" of "10 pcs"): said before the dish, they name the option, not a count. */
const optionNumbers = (d: Dish) => new Set((d.modifiers ?? []).flatMap((g) => g.options.flatMap((o) => optionWords(o).filter((w) => /^\d+$/.test(w)))));

/** The words as a phrase, Chinese characters joined again. */
export const phrase = (toks: string[]) => toks.join(" ").replace(/(?<=[㐀-鿿]) (?=[㐀-鿿])/g, "");

/**
 * The dishes named only as another's option: "Hokkaido milk tea with pudding and pearls" (not the Egg
 * Pudding or the Pearl Milk Tea), "ban mian with fish balls", "加鱼丸", "kopi o kosong", "barley add
 * lime". `others` are dishes on the order or just talked about, whose options count too.
 */
export function optionSpots(toks: string[], spots: Spot[], others: Dish[] = [], breaks: number[] = []): Set<Spot> {
  const out = new Set<Spot>();
  const CUE = /^(with|w|add|added|adding|extra|plus|tambah|dengan|topping|toppings|on|put|in|upgrade|upgraded|upsize|drink|minuman|sauce|sos|加|换|换成|配|要|走|少|多)$/;
  for (const x of spots) {
    if (x.from < 0) continue;
    // (its own words: not the "milk tea" another dish named takes)
    const mine = x.covered.filter((i) => !spots.some((y) => y !== x && y.covered.includes(i)));
    const words = (mine.length ? mine : x.covered).map((i) => toks[i]);
    const text = phrase(words);
    // (its whole name said is the dish: "2 fish ball soup", "a lime juice")
    const name = normalize(x.dish.name).split(" ");
    const zhName = Object.values(x.dish.translations ?? {}).map((t) => t?.name ?? "").find((z) => z.length > 1);
    const whole = /[㐀-鿿]/.test(text) ? !!zhName && text === zhName : words.length >= name.length;
    // ("upgrade to kimchi fries", "change it to the soy garlic")
    const cued = toks.slice(Math.max(0, x.from - 2), x.from).some((t) => CUE.test(t)) || (toks[x.from - 1] === "to" && toks.slice(Math.max(0, x.from - 5), x.from - 1).some((t) => /^(upgrade|change|swap|switch|tukar|ganti|make)$/.test(t))) || (x.from > 0 && /^(and|dan|n|和)$/.test(toks[x.from - 1]) && toks.slice(Math.max(0, x.from - 6), x.from - 1).some((t) => CUE.test(t)));
    // (a count of its own before it makes it ordered: "two fish ball soup")
    let k = x.from - 1;
    while (k >= 0 && (COUNTER.test(toks[k]) || DESCRIBES.test(toks[k]))) k--;
    const counted = k >= 0 && !!numberBefore(toks, k) && (!cued || whole);
    // ("whole chicken half yangnyeom half original": "half" there is the sauce's half, not the Half Chicken)
    if (words.length && words.every((w) => /^(half|separuh|setengah|一|半)$/.test(w)) && spots.some((y) => y !== x && y.from >= 0 && y.from < x.from)) {
      out.add(x);
      continue;
    }
    // ("boneless saiz besar sos honey butter": said right after another dish, with no count and nothing
    // joining them, it's that dish's choice)
    const host = [...spots].filter((y) => y !== x && y.from >= 0 && y.to <= x.from && !breaks.some((b) => b > y.from && b <= x.from) && !toks.slice(y.to, x.from).some((t) => JOIN.test(t))).sort((a, b) => b.to - a.to)[0];
    const follows = !!host && whole && !counted && !cued && optionsSaid(text, host.dish, true).add.length > 0 && !/[\u3400-\u9fff]/.test(text);
    if (counted || (whole && !cued && !follows)) continue;
    const hosts = [...spots.filter((y) => y !== x && y.from >= 0 && y.from < x.from).map((y) => y.dish), ...(cued ? spots.filter((y) => y !== x && y.from > x.to).map((y) => y.dish) : []), ...others].filter((d) => d.id !== x.dish.id && d.modifiers?.length);
    // (with the words just before it: "extra chili sauce" asks for the Extra chilli sauce)
    const lead = [x.from - 2, x.from - 1].filter((i) => i >= 0 && !spots.some((y) => y !== x && y.covered.includes(i))).map((i) => toks[i]);
    const said = phrase([...lead, ...words]);
    if (hosts.some((d) => optionsSaid(said, d, true).add.length)) out.add(x);
  }
  return out;
}

/**
 * The order the text spells out, a line per mention: its count (before the dish, or after it as
 * Malay and Chinese say it), and the add-ons said with it; then the clauses that only change them.
 */
export function linesOf(toks: string[], spots: Spot[], breaks: number[]): Line[] {
  // (a name's words just around where it's named are its own: the "mee" of "dry chilli pan mee")
  const placed = spots.filter((s) => s.from >= 0).map((s) => {
    const name = new Set(normalize(s.dish.name).split(" "));
    let { from, to } = s;
    while (to < toks.length && name.has(toks[to]) && !spots.some((o) => o !== s && o.from === to)) to++;
    while (from > 0 && name.has(toks[from - 1]) && !spots.some((o) => o !== s && o.to === from)) from--;
    return { ...s, from, to };
  }).sort((a, b) => a.from - b.from);
  // the same dish named again elsewhere ("2 kopi peng siew dai, 1 kopi peng kosong")
  const taken = (i: number, all: Spot[]) => all.some((s) => i >= s.from && i < s.to);
  for (const s of [...placed]) {
    const seq = toks.slice(s.from, s.to);
    for (let i = 0; i + seq.length <= toks.length; i++)
      if (seq.every((w, k) => toks[i + k] === w) && !seq.some((_, k) => taken(i + k, placed))) placed.push({ dish: s.dish, from: i, to: i + seq.length, covered: seq.map((_, k) => i + k) });
  }
  placed.sort((a, b) => a.from - b.from);
  // clauses: at the punctuation, and at a joining word outside a dish's name
  const starts = new Set(breaks);
  toks.forEach((t, i) => {
    if (JOIN.test(t) && !taken(i, placed)) starts.add(i + 1);
  });
  const clauseOf = (i: number) => Math.max(...[...starts].filter((b) => b <= i), 0);
  const lines: (Line & { clause: number; counted?: boolean })[] = [];
  let lastClause: (Line & { clause: number })[] = [];
  const bounds = [...starts].sort((a, b) => a - b);
  const clauseEnd = (c: number) => bounds.find((b) => b > c) ?? toks.length;
  for (const c of bounds) {
    const end = clauseEnd(c);
    const here = placed.filter((s) => s.from >= c && s.from < end);
    if (here.length) {
      const made: (Line & { clause: number })[] = [];
      here.forEach((s, k) => {
        const nums = optionNumbers(s.dish);
        // what goes with it: from the last dish (or the clause's start) to the next dish's words
        let from = k ? here[k - 1].to : c;
        let to = k + 1 < here.length ? here[k + 1].from : end;
        // (the next dish's own count and what describes it: "…, 2 large iced latte"; not "saiz besar" said of this one)
        if (k + 1 < here.length) {
          let j = to;
          while (j > s.to && (DESCRIBES.test(toks[j - 1]) || COUNTER.test(toks[j - 1])) && !numberBefore(toks, j - 1)) j--;
          if (j > s.to && numberBefore(toks, j - 1)) to = numberBefore(toks, j - 1)!.at;
        }
        if (k) while (from < s.from && from < here[k - 1].to) from++;
        let count: number | null = null;
        // before it: "2 large iced", "两杯大杯", skipping what describes it (and a number of its own option, "12 wings")
        for (let i = s.from - 1; i >= from; i--) {
          const t = toks[i];
          if (COUNTER.test(t) || DESCRIBES.test(t) || optionsSaid(t, s.dish, true).add.length) continue;
          const n = numberBefore(toks, i);
          if (!n) break;
          if (nums.has(String(n.n)) && count === null && !/^(x|×)$/.test(toks[n.at + 1] ?? "")) {
            // ("2 × 12 wings": the 2 before it is the count)
            i = n.at;
            continue;
          }
          count = n.n;
          break;
        }
        // after it: "teh tarik panas dua", "咖啡乌冰两杯", "nasi lemak x2"
        if (count === null) {
          let j = s.to;
          while (j < to && (DESCRIBES.test(toks[j]) || /^(x|×|times)$/.test(toks[j]) || optionsSaid(toks[j], s.dish, true).add.length) && !numberAfter(toks, j)) j++;
          const n = j < to ? numberAfter(toks, j) : null;
          // (not "mixed grill for 2": a number of its own name, or after "for")
          const ownNumber = normalize(s.dish.name).split(" ").some((w) => w === String(n?.n) || NUM[w] === n?.n);
          if (n && !nums.has(String(n.n)) && !ownNumber && toks[j - 1] !== "for" && (n.end >= to || COUNTER.test(toks[n.end] ?? "") || JOIN.test(toks[n.end] ?? "") || /^(please|pls|total|how|berapa|jumlah|lah|je|sahaja|多少|一共|总共)$/.test(toks[n.end] ?? ""))) count = n.n;
        }
        // "another teh", "satu lagi": one more
        const options = optionsSaid(phrase([...toks.slice(from, s.from), ...toks.slice(s.to, to)]), s.dish).add;
        const ref = count === null && /^(the|my|our|that|this|tu|itu|ni)$/.test(toks[s.from - 1] ?? "") && !/^(add|another|more|plus|tambah|order|get|have)$/.test(toks[s.from - 2] ?? "");
        const line = { dish: s.dish, count: count ?? 1, options, clause: c, counted: count !== null, ref };
        lines.push(line);
        made.push(line);
      });
      lastClause = made;
      continue;
    }
    // a clause that names no dish changes the lines before it: "one of them with extra egg", "一碗加鱼丸", "satu besar", "both iced"
    const words = toks.slice(c, end);
    if (!words.length || !lastClause.length) continue;
    const text = phrase(words);
    let n: number | null = null;
    const first = numberAfter(words, 0);
    if (first && (first.end === words.length || COUNTER.test(words[first.end] ?? "") || /^(of|daripadanya|with|w|less|no|extra|large|besar|tambah|add|加|换|要|走|少|冰|热|大)$/.test(words[first.end] ?? "") || /[㐀-鿿]/.test(words[first.end] ?? ""))) n = first.n;
    if (/^(both|all|semua|kedua|dua dua|全部|都)$/.test(words[0])) n = null;
    const targets = lastClause.filter((l) => optionsSaid(text, l.dish, true).add.length || optionsSaid(text, l.dish, true).off.length);
    if (!targets.length) continue;
    for (const l of n === null ? targets : targets.slice(-1)) {
      const { add, off } = optionsSaid(text, l.dish);
      const opts = [...l.options.filter((o) => !off.some((x) => x.name === o.name)), ...add.filter((o) => !l.options.some((x) => x.name === o.name))];
      if (n !== null && l.count > n) {
        l.count -= n;
        const split = { dish: l.dish, count: n, options: opts, clause: l.clause, counted: true };
        lines.splice(lines.indexOf(l) + 1, 0, split);
      } else l.options = opts;
    }
  }
  // a dish named again with a count is the one ordered ("still got lontong? one lontong and a teh o")
  const counted = new Set(lines.filter((l) => l.counted).map((l) => l.dish.id));
  // the same dish with the same add-ons is one line
  const out: Line[] = [];
  for (const l of lines) {
    if (!l.counted && counted.has(l.dish.id) && lines.filter((x) => x.dish.id === l.dish.id).length > 1 && !l.options.length) continue;
    // ("soju is free with any whole chicken. So whole chicken plus soju": named twice, counted never, one)
    if (!l.counted && !counted.has(l.dish.id) && !l.options.length && out.some((o) => o.dish.id === l.dish.id)) continue;
    const key = (x: Line) => `${x.dish.id}|${x.options.map((o) => o.name).sort().join(",")}`;
    const had = out.find((o) => key(o) === key(l));
    if (had) had.count += l.count;
    else out.push({ dish: l.dish, count: l.count, options: l.options, ref: l.ref });
  }
  return out;
}
