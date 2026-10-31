// Training data for the conversation reader (src/server/ai/brain/convReader.ts): guest conversations
// on synthetic menus (./gen.ts), a turn at a time, each with the order as it stands after it. A
// conversation starts with an order (or a question that gets a list back) and goes on with the edits
// guests make: remove a line, set a count, split one ("2 only, one of them iced"), swap a dish or
// one of several, change, add or take off an add-on, "one more of that", "same again", point at the
// list just given ("the first one, large"), say whose is whose ("I only had the X", "my friend had
// the Y, I had the rest"), or say something that changes nothing. In English, Manglish, Malay and
// Chinese, with typos. Some English orders are said the way guests said them in Google's Taskmaster
// ordering dialogues (./taskmaster-carriers.json, CC BY 4.0).
//
// The generator writes each turn itself, so it knows the order exactly. Each example is the reader's
// prompt (the order so far, the assistant's last reply, the message) and the order it should give.
// Every order is checked by the brain's own checks (checkBasket) first. No benchmark menu or question
// is used, and none that reads like a benchmark question is kept.
//
//   npx tsx scripts/reader/conv-gen.ts <out.jsonl> [conversations=14000] [seed=21]
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { basketLineText, basketPrompt, type BasketLine } from "../../src/server/ai/brain/convReader";
import { checkBasket, dishKey } from "../../src/server/ai/brain/reading";
import type { Dish } from "../../src/server/ai/brain/understand";
import { loadCases } from "../../bench/run";
import { rng, typo } from "../brain/data";
import { CHAT, JOIN, LEAD, MEASURE, NUM_EN, NUM_MS, NUM_ZH, TAIL, linePieces, menu, optsOf, pick, sayOpt, surface, type Kind, type Lang, type Opt } from "./gen";

type D = Dish & { kind: Kind };
export interface ConvExample { id: string; lang: Lang; turn: number; op: string; prompt: string; target: string }

const CARRIERS = (JSON.parse(readFileSync(new URL("./taskmaster-carriers.json", import.meta.url), "utf8")) as { templates: string[] }).templates;
const WHO: [string, string, string][] = [["friend", "kawan", "朋友"], ["sister", "kakak", "姐姐"], ["brother", "abang", "哥哥"], ["wife", "isteri", "老婆"], ["husband", "suami", "老公"], ["colleague", "kawan sekerja", "同事"]];
const KIND_WORDS: Record<Kind, [string[], string[], string[]]> = {
  drink: [["drinks", "drink", "anything to drink"], ["minuman", "air"], ["喝的", "饮料"]],
  main: [["food", "mains", "rice or noodles"], ["makanan", "nasi atau mee"], ["吃的", "主食"]],
  side: [["sides", "snacks", "small plates"], ["snek", "makanan ringan"], ["小吃", "配菜"]],
  dessert: [["desserts", "dessert", "sweets"], ["pencuci mulut", "manisan"], ["甜品", "甜点"]],
};
const ORD: [string[], string[], string][] = [[["first", "1st"], ["pertama"], "一"], [["second", "2nd"], ["kedua"], "二"], [["third", "3rd"], ["ketiga"], "三"]];

const money = (n: number) => `RM${(n / 100).toFixed(2)}`;
const saidOf = (d: Dish, name: string) => optsOf(d, [name])[0];
const sayable = (d: Dish, name: string) => !!saidOf(d, name)?.said?.en.length;
const groupOf = (d: Dish, name: string) => (d.modifiers ?? []).find((g) => g.options.some((o) => o.name === name));
const unitPrice = (l: BasketLine) => l.dish.price + l.options.reduce((n, x) => n + ((l.dish.modifiers ?? []).flatMap((g) => g.options).find((o) => o.name === x)?.price ?? 0), 0);
const same = (a: BasketLine, b: BasketLine) => a.dish === b.dish && [...a.options].sort().join() === [...b.options].sort().join() && a.owner === b.owner;
const clone = (o: BasketLine[]) => o.map((l) => ({ ...l, options: [...l.options] }));
function add(order: BasketLine[], l: BasketLine) {
  const had = order.find((x) => same(x, l));
  if (had) had.count += l.count;
  else order.push(l);
}

/** How a guest names an add-on to take it off: "egg", not "add egg" ("tambah telur" → "telur", "加蛋" → "蛋"). */
const bare = (s: string) => s.replace(/^(add|extra|more|tambah|lebih)\s+/i, "").replace(/^加/, "");
const sayCount = (n: number, kind: Kind, lang: Lang, r: () => number) =>
  lang === "zh" ? `${NUM_ZH[Math.min(n, 6)] || n}${pick(r, MEASURE[kind])}` : lang === "ms" ? (r() < 0.6 ? NUM_MS[Math.min(n, 6)] || String(n) : String(n)) : r() < 0.6 ? String(n) : NUM_EN[Math.min(n, 6)] || String(n);
const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");

/** One option a dish's group offers that a guest can say, other than those chosen. */
function anOption(d: Dish, chosen: string[], r: () => number, single?: boolean): string | null {
  const opts = (d.modifiers ?? []).filter((g) => (single ? (g.max ?? 1) === 1 : true)).flatMap((g) => g.options.filter((o) => sayable(d, o.name) && !chosen.includes(o.name)));
  return opts.length ? pick(r, opts).name : null;
}
/** `options` with `name` in its group's place (a group that takes one keeps one). */
function withOption(d: Dish, options: string[], name: string): string[] {
  const g = groupOf(d, name)!;
  const kept = (g.max ?? 1) === 1 ? options.filter((x) => !g.options.some((o) => o.name === x)) : options;
  const inGroup = kept.filter((x) => g.options.some((o) => o.name === x));
  return inGroup.length >= (g.max ?? 1) ? kept : [...kept, name];
}
function chooseOptions(d: Dish, r: () => number): string[] {
  const out: string[] = [];
  for (const g of d.modifiers ?? []) {
    if (r() > 0.4) continue;
    const opts = g.options.filter((o) => sayable(d, o.name));
    if (opts.length) out.push(pick(r, opts).name);
  }
  return out.slice(0, 3);
}

/** The assistant's reply after a turn, as the brain might write it. */
function reply(order: BasketLine[], lang: Lang, r: () => number): string {
  if (r() < 0.25) return pick(r, { en: ["Ok, noted.", "Done. Anything else?", "Sure."], manglish: ["Ok boss.", "Can, noted."], ms: ["Ok, baik.", "Boleh."], zh: ["好的。", "收到。"] }[lang]);
  const name = (d: Dish) => (lang === "zh" && d.translations?.zh?.name) || d.name;
  const lines = order.map((l) => `${l.count > 1 ? `${l.count} ` : ""}${name(l.dish)}${l.options.length ? ` (${l.options.join(", ")})` : ""} ${money(unitPrice(l) * l.count)}`);
  const total = money(order.reduce((n, l) => n + unitPrice(l) * l.count, 0));
  return lang === "zh" ? `好的：${lines.join("，")}，一共${total}。` : lang === "ms" ? `Ok: ${lines.join(", ")}. Jumlah ${total}.` : `OK: ${lines.join(", ")}. Total ${total}.`;
}

interface State { order: BasketLine[]; shown: D[]; lastAdded: BasketLine[]; reply: string; focus?: D }
interface Step { op: string; user: string; order: BasketLine[]; shown?: D[]; added?: BasketLine[]; reply?: string; end?: boolean; focus?: D }

const TAILS = (lang: Lang, r: () => number) => `${lang === "zh" ? pick(r, ["，", "。"]) : pick(r, [". ", ", ", " "])}${pick(r, TAIL[lang])}`;
const CHARGES: Record<Lang, string[]> = { en: ["total with service and tax?", "how much all in?", "total including tax?"], manglish: ["total with tax how much ah", "all in how much"], ms: ["berapa semua termasuk servis dan cukai?", "jumlah dengan cukai berapa?"], zh: ["含服务费和税多少？", "一共要付多少？"] };

/** A new order (or more of it): lines of dishes, each with a count and add-ons, said in one message. */
function orderStep(m: D[], s: State, lang: Lang, r: () => number, more: boolean): Step | null {
  const pool = m.filter((d) => lang !== "zh" || d.translations?.zh?.name);
  if (!pool.length) return null;
  const n = pick(r, [1, 1, 2, 2, 3]);
  const lines: BasketLine[] = [];
  for (const d of [...pool].sort(() => r() - 0.5).slice(0, n)) lines.push({ dish: d, count: r() < 0.6 ? 1 : 2 + Math.floor(r() * 3), options: chooseOptions(d, r) });
  const items = lines.map((l, k) => (k ? pick(r, JOIN[lang]) : "") + linePieces({ dish: l.dish, count: l.count, options: l.options }, k, m, lang, r).map((p) => p.text).join("")).join("");
  const lead = more ? pick(r, { en: ["add ", "also ", "and ", "plus ", "add on "], manglish: ["add ", "tambah ", "also "], ms: ["tambah ", "lagi ", "tambah lagi "], zh: ["再加", "再来", "加"] }[lang]) : pick(r, LEAD[lang]);
  const user = lang === "en" && r() < 0.4 ? pick(r, CARRIERS).replace("{item}", items) : `${lead}${items}`;
  const order = clone(s.order);
  for (const l of lines) add(order, { ...l, options: [...l.options] });
  return { op: more ? "add" : "order", user, order, added: lines };
}

function listStep(m: D[], lang: Lang, r: () => number): Step | null {
  const kinds = (["drink", "main", "side", "dessert"] as Kind[]).filter((k) => m.filter((d) => d.kind === k && (lang !== "zh" || d.translations?.zh?.name)).length >= 2);
  if (!kinds.length) return null;
  const k = pick(r, kinds);
  const shown = m.filter((d) => d.kind === k && (lang !== "zh" || d.translations?.zh?.name)).sort(() => r() - 0.5).slice(0, 2 + Math.floor(r() * 2));
  const [en, ms, zh] = KIND_WORDS[k];
  const user = lang === "zh" ? pick(r, [`有什么${pick(r, zh)}？`, `${pick(r, zh)}有哪些？`]) : lang === "ms" ? pick(r, [`ada ${pick(r, ms)} apa?`, `${pick(r, ms)} apa yang ada?`]) : pick(r, [`what ${pick(r, en)} got?`, `any ${pick(r, en)}?`, `${pick(r, en)} what you have`]);
  const list = shown.map((d) => `${(lang === "zh" && d.translations?.zh?.name) || d.name} (${money(d.price)})`);
  const rep = lang === "zh" ? `有：${list.join("、")}。` : lang === "ms" ? `Ada ${list.join(", ")}.` : `We have ${list.join(", ")}.`;
  return { op: "list", user, order: [], shown, reply: rep };
}

/** "the first one, large", "2 of the second one", "第二个要大的": a dish from the list just given. */
function pointerStep(s: State, lang: Lang, r: () => number): Step | null {
  if (!s.shown.length) return null;
  const k = Math.floor(r() * Math.min(3, s.shown.length));
  const last = k === s.shown.length - 1 && r() < 0.3;
  const d = s.shown[k];
  const n = r() < 0.7 ? 1 : 2;
  const opt = r() < 0.4 ? anOption(d, [], r, true) : null;
  const [en, ms, zh] = ORD[k];
  const o = opt ? sayOpt(saidOf(d, opt), lang, r) : "";
  const user = lang === "zh"
    ? `${n > 1 ? `${NUM_ZH[n]}${pick(r, MEASURE[d.kind])}` : ""}${last ? "最后一个" : `第${zh}个`}${opt ? `要${o}` : ""}`
    : lang === "ms"
      ? `${pick(r, ["", "nak ", "ok "])}yang ${last ? "terakhir" : pick(r, ms)}${n > 1 ? ` ${NUM_MS[n]}` : ""}${opt ? `, ${o}` : ""}`
      : `${pick(r, ["", "ok ", "i'll take "])}${n > 1 ? `${n} of ` : ""}the ${last ? "last" : pick(r, en)} one${opt ? `, ${o}` : ""}`;
  const l: BasketLine = { dish: d, count: n, options: opt ? [opt] : [] };
  const order = clone(s.order);
  add(order, l);
  return { op: "pointer", user, order, added: [l] };
}

/** An edit to the order so far, of a line whose dish is on it once. */
function editStep(m: D[], s: State, lang: Lang, r: () => number, op: string): Step | null {
  const lone = s.order.filter((l) => s.order.filter((x) => x.dish === l.dish).length === 1);
  if (!lone.length) return null;
  const l = pick(r, lone);
  const k = s.order.indexOf(l);
  const d = l.dish as D;
  const name = surface(d, m, lang, r);
  const order = clone(s.order);
  const line = order[k];
  const the = lang === "en" || lang === "manglish" ? pick(r, ["the ", "the ", ""]) : "";
  switch (op) {
    case "remove": {
      if (s.order.length < 2) return null;
      order.splice(k, 1);
      const t = { en: ["cancel {t}{d}", "remove {t}{d}", "no need {t}{d} already", "take out {t}{d}", "actually don't want {t}{d}"], manglish: ["{d} cancel ah", "{d} dun want liao", "no need {d} la", "remove {d}"], ms: ["{d} tak nak", "batal {d}", "{d} tak jadi", "{d} cancel"], zh: ["{d}不要了", "取消{d}", "{d}不用了"] }[lang];
      return { op, user: fill(pick(r, t), { d: name, t: the }), order };
    }
    case "count": {
      const n = pick(r, [1, 2, 3, 4].filter((x) => x !== l.count));
      line.count = n;
      const c = sayCount(n, d.kind, lang, r);
      const t = { en: ["make {t}{d} {n} only", "{d} {n} only", "change {t}{d} to {n}", "make it {n} {d}"], manglish: ["{d} {n} only la", "{d} {n} je", "make it {n} {d}"], ms: ["{d} jadi {n}", "{d} {n} je", "tukar {d} jadi {n}"], zh: ["{d}改成{n}", "{d}只要{n}"] }[lang];
      return { op, user: fill(pick(r, t), { d: name, n: c, t: the }), order };
    }
    case "split": {
      // "make the teh tarik 2 only, and one of them iced", "one of the laksa large"
      const opt = anOption(d, l.options, r, true);
      if (!opt) return null;
      const n = l.count >= 2 && r() < 0.5 ? l.count : pick(r, [2, 3]);
      const setCount = n !== l.count;
      if (n < 2) return null;
      const o = sayOpt(saidOf(d, opt), lang, r);
      order.splice(k, 1, { ...line, count: n - 1 }, { ...line, count: 1, options: withOption(d, line.options, opt) });
      const c = sayCount(n, d.kind, lang, r);
      const head = setCount ? fill(pick(r, { en: ["make {t}{d} {n} only, and ", "{d} {n}, "], manglish: ["{d} {n} only, ", "make {d} {n}, "], ms: ["{d} jadi {n}, ", "{d} {n}, "], zh: ["{d}改成{n}，", "{d}要{n}，"] }[lang]), { d: name, n: c, t: the }) : "";
      const tail = setCount
        ? pick(r, { en: [`one of them ${o}`, `1 ${o}`], manglish: [`one ${o}`, `1 ${o}`], ms: [`satu ${o}`], zh: [`其中一${pick(r, MEASURE[d.kind])}要${o}`, `一${pick(r, MEASURE[d.kind])}${o}`] }[lang])
        : fill(pick(r, { en: [`one of {t}{d} ${o}`, `make one of {t}{d} ${o}`], manglish: [`one of the {d} ${o}`, `{d} one ${o}`], ms: [`{d} satu ${o}`, `satu {d} ${o}`], zh: [`{d}其中一${pick(r, MEASURE[d.kind])}要${o}`] }[lang]), { d: name, t: the });
      return { op, user: head + tail, order };
    }
    case "swap": {
      const others = m.filter((x) => x !== d && x.kind === d.kind && !s.order.some((y) => y.dish === x) && (lang !== "zh" || x.translations?.zh?.name));
      if (!others.length) return null;
      const y = pick(r, others);
      const yName = surface(y, m, lang, r);
      const one = l.count >= 2 && r() < 0.45;
      if (one) {
        line.count -= 1;
        add(order, { dish: y, count: 1, options: [] });
      } else order.splice(k, 1, { dish: y, count: l.count, options: [] });
      const t = one
        ? { en: ["one of {t}{d} change to {y}", "change one {d} to {y}"], manglish: ["one {d} change to {y}", "1 {d} tukar {y}"], ms: ["satu {d} tukar {y}", "tukar satu {d} jadi {y}"], zh: ["其中一个{d}换成{y}", "一个{d}改{y}"] }[lang]
        : { en: ["swap {t}{d} for {y}", "change {t}{d} to {y}", "{d} change to {y}", "instead of {d}, {y}"], manglish: ["{d} change to {y}", "{d} tukar {y}", "change {d} to {y} la"], ms: ["{d} tukar {y}", "tukar {d} jadi {y}"], zh: ["{d}换成{y}", "{d}改{y}", "不要{d}，换{y}"] }[lang];
      return { op: one ? "swap-one" : "swap", user: fill(pick(r, t), { d: name, y: yName, t: the }), order };
    }
    case "option": {
      const opt = anOption(d, l.options, r, r() < 0.6);
      if (!opt) return null;
      line.options = withOption(d, line.options, opt);
      if (line.options.join() === l.options.join()) return null;
      const o = sayOpt(saidOf(d, opt), lang, r);
      const t = { en: ["make {t}{d} {o}", "{t}{d} {o} pls", "add {o} to {t}{d}", "{d} i want {o}", "change {t}{d} to {o}"], manglish: ["{d} {o} ah", "{d} add {o}", "{d} want {o}"], ms: ["{d} nak {o}", "{d} tukar {o}", "{d} {o}"], zh: ["{d}要{o}", "{d}改{o}", "{d}{o}"] }[lang];
      return { op, user: fill(pick(r, t), { d: name, o, t: the }), order };
    }
    case "unoption": {
      const priced = l.options.filter((x) => sayable(d, x) && (groupOf(d, x)?.max ?? 1) > 1);
      if (!priced.length) return null;
      const x = pick(r, priced);
      line.options = line.options.filter((y) => y !== x);
      const o = bare(sayOpt(saidOf(d, x), lang, r));
      const t = { en: ["no need the {o}", "{t}{d} no {o} already", "remove the {o} from {t}{d}", "take out the {o}"], manglish: ["{o} no need la", "{d} dun want {o}"], ms: ["{o} tak nak", "{d} tak payah {o}", "{d} tanpa {o}"], zh: ["{o}不要了", "{d}不要{o}", "{d}的{o}不要了"] }[lang];
      return { op, user: fill(pick(r, t), { d: name, o, t: the }), order };
    }
  }
  return null;
}

function againStep(s: State, lang: Lang, r: () => number): Step | null {
  if (!s.lastAdded.length) return null;
  const order = clone(s.order);
  if (s.lastAdded.length === 1 || r() < 0.6) {
    const l = s.lastAdded[s.lastAdded.length - 1];
    add(order, { ...l, count: 1, options: [...l.options] });
    return { op: "one-more", user: pick(r, { en: ["one more of that", "another one", "one more", "add one more of that"], manglish: ["one more", "tambah satu lagi", "another one la"], ms: ["satu lagi", "tambah satu lagi", "lagi satu"], zh: ["再来一个", "再来一份", "再加一个"] }[lang]), order, added: [{ ...l, count: 1 }] };
  }
  for (const l of s.lastAdded) add(order, { ...l, options: [...l.options] });
  return { op: "same-again", user: pick(r, { en: ["same again", "same thing again for my friend", "same order again"], manglish: ["same again", "sama lagi satu set"], ms: ["sama lagi", "yang sama sekali lagi"], zh: ["一样的再来一份", "同样的再来一份"] }[lang]), order, added: s.lastAdded };
}

/** "I only had the X and the Y, how much is mine?", "my friend had the X, I had the rest. how much each?" */
function ownersStep(m: D[], s: State, lang: Lang, r: () => number, each: boolean): Step | null {
  if (s.order.length < 2 || s.order.some((l) => l.owner)) return null;
  const k = 1 + Math.floor(r() * Math.min(2, s.order.length - 1));
  const picked = [...s.order].sort(() => r() - 0.5).slice(0, k);
  const order = clone(s.order);
  const names = picked.map((l) => surface(l.dish, m, lang, r));
  const both = lang === "zh" ? names.join("和") : names.join(lang === "ms" ? " dan " : pick(r, [" and the ", " and ", ", "]));
  if (!each) {
    for (const l of order) if (picked.some((p) => same(p, l))) l.owner = "me";
    const t = { en: ["i only had the {x}. how much is mine?", "i had the {x}, mine how much", "mine is the {x}, how much?"], manglish: ["i only had {x}, mine how much ah", "mine is {x} only, how much"], ms: ["saya makan {x} je, saya kena bayar berapa?", "saya punya {x}, berapa?"], zh: ["我只吃了{x}，我的多少？", "我付{x}，多少钱？"] }[lang];
    return { op: "mine", user: fill(pick(r, t), { x: both }), order, end: true };
  }
  const [who, whoMs, whoZh] = pick(r, WHO);
  for (const l of order) l.owner = picked.some((p) => same(p, l)) ? who : "me";
  const t = { en: [`my ${who} had the {x}, i had the rest. how much each?`, `i pay for the rest, my ${who} pays the {x}. how much each?`], manglish: [`my ${who} the {x}, rest is mine. each how much`], ms: [`${whoMs} saya makan {x}, yang lain saya. seorang berapa?`], zh: [`我${whoZh}吃了{x}，其他是我的。各自多少？`] }[lang];
  return { op: "each", user: fill(pick(r, t), { x: both }), order, end: true };
}

function neutralStep(m: D[], s: State, lang: Lang, r: () => number): Step {
  const d = pick(r, m.filter((x) => lang !== "zh" || x.translations?.zh?.name).length ? m.filter((x) => lang !== "zh" || x.translations?.zh?.name) : m);
  if (r() < 0.5) {
    // a question about one dish, answered with its name and price: the dish a next "ok, two" means
    const name = (lang === "zh" && d.translations?.zh?.name) || d.name;
    const q = fill(pick(r, { en: ["is the {d} spicy?", "{d} got large size?", "what's in the {d}?", "how much is the {d}"], manglish: ["{d} spicy or not", "{d} got what inside ah", "{d} how much ah"], ms: ["{d} pedas tak?", "{d} ada saiz besar?", "{d} berapa?"], zh: ["{d}辣吗？", "{d}有大份吗？", "{d}多少钱？"] }[lang]), { d: lang === "zh" ? name : surface(d, m, lang, r) });
    const rep = lang === "zh" ? `${name}是${money(d.price)}。` : lang === "ms" ? `${name} ${money(d.price)}.` : `The ${name} is ${money(d.price)}.`;
    return { op: "none", user: q, order: clone(s.order), reply: rep, focus: d };
  }
  const q = pick(r, CHAT);
  return { op: "none", user: q, order: clone(s.order), reply: pick(r, { en: ["Sure.", "Yes, can.", "Ok, noted."], manglish: ["Can boss.", "Ok can."], ms: ["Boleh.", "Ada."], zh: ["可以。", "有的。"] }[lang]) };
}

/** "ok, two", "那两碗大碗", "ok satu, besar": the dish just asked about, ordered without its name. */
function focusStep(s: State, lang: Lang, r: () => number): Step | null {
  const d = s.focus;
  if (!d) return null;
  const n = r() < 0.6 ? 1 : 2;
  const opt = r() < 0.5 ? anOption(d, [], r) : null;
  const o = opt ? sayOpt(saidOf(d, opt), lang, r) : "";
  const c = sayCount(n, d.kind, lang, r);
  const user = lang === "zh" ? pick(r, [`那${c}${o}`, `好，要${c}${o ? `，${o}` : ""}`, `来${c}${o}`]) : lang === "ms" ? `${pick(r, ["ok ", "ok nak ", "bagi "])}${c}${o ? `, ${o}` : ""}` : `${pick(r, ["ok ", "ok i take ", "ok ", ""])}${c}${o ? `, ${o}` : ""}${pick(r, ["", " pls", " please"])}`;
  const l: BasketLine = { dish: d, count: n, options: opt ? [opt] : [] };
  const order = clone(s.order);
  add(order, l);
  return { op: "focus", user, order, added: [l] };
}

const EDITS = ["remove", "count", "split", "swap", "option", "unoption"];
function nextStep(m: D[], s: State, lang: Lang, r: () => number, first: boolean): Step | null {
  if (first) return r() < 0.8 ? orderStep(m, s, lang, r, false) : listStep(m, lang, r);
  if (s.shown.length && r() < 0.7) return pointerStep(s, lang, r);
  if (s.focus && r() < 0.6) return focusStep(s, lang, r);
  const x = r();
  if (x < 0.55) return editStep(m, s, lang, r, pick(r, EDITS));
  if (x < 0.67) return orderStep(m, s, lang, r, true);
  if (x < 0.74) return againStep(s, lang, r);
  if (x < 0.84) return ownersStep(m, s, lang, r, r() < 0.5);
  if (x < 0.9) return listStep(m, lang, r);
  return neutralStep(m, s, lang, r);
}

/** One conversation on `m`: its turns as examples (stopping at the first whose order the checks would change). */
function conversation(m: D[], id: string, r: () => number, stats: Record<string, number>): ConvExample[] {
  const lang: Lang = pick(r, ["en", "en", "manglish", "manglish", "ms", "zh", "zh"]);
  const s: State = { order: [], shown: [], lastAdded: [], reply: "" };
  const said: string[] = [];
  const out: ConvExample[] = [];
  const turns = 2 + Math.floor(r() * 3);
  for (let t = 0; t < turns; t++) {
    let step: Step | null = null;
    for (let tries = 0; tries < 6 && !step; tries++) step = nextStep(m, s, lang, r, t === 0);
    if (!step) break;
    let user = step.user;
    if (!["list", "none", "mine", "each"].includes(step.op) && r() < 0.4) user += TAILS(lang, r);
    else if (["mine", "each"].includes(step.op) && r() < 0.3) user = user.replace(/[?？]$/, "") + (lang === "zh" ? "，含税" : lang === "ms" ? " termasuk cukai?" : " with tax?");
    else if (!["list", "none", "mine", "each"].includes(step.op) && r() < 0.08) user += `${lang === "zh" ? "，" : ". "}${pick(r, CHARGES[lang])}`;
    if (lang !== "zh" && r() < 0.1) user = typo(user, r);
    said.push(s.reply, user);
    // (the order as the checks would take it: a turn they'd change ends the conversation)
    const raw = { lines: step.order.map((l) => ({ dish: dishKey(m.indexOf(l.dish as D)), count: l.count, options: l.options, ...(l.owner ? { owner: l.owner } : {}) })) };
    const checked = checkBasket(raw, m, () => true, said);
    if (checked.lines.length !== step.order.length || checked.dropped.length) {
      stats.dropped = (stats.dropped ?? 0) + 1;
      break;
    }
    const { prompt, menu: shortMenu } = basketPrompt(m, s.order, s.reply, user);
    if (step.order.some((l) => !shortMenu.includes(l.dish))) {
      stats.notInPrompt = (stats.notInPrompt ?? 0) + 1;
      break;
    }
    const target = step.order.length ? step.order.map((l) => basketLineText(l, shortMenu)).join("\n") : "(nothing)";
    out.push({ id: `${id}-${t}`, lang, turn: t, op: step.op, prompt, target });
    stats[step.op] = (stats[step.op] ?? 0) + 1;
    s.order = step.order;
    s.shown = step.shown ?? [];
    s.focus = step.focus;
    if (step.added) s.lastAdded = step.added;
    s.reply = step.reply ?? reply(s.order, lang, r);
    if (step.end) break;
  }
  return out;
}

export function generateConversations(n: number, seed = 21) {
  const r = rng(seed);
  const stats: Record<string, number> = {};
  const out: ConvExample[] = [];
  let m = menu(r) as D[];
  for (let k = 0; k < n; k++) {
    if (k % 15 === 0) m = menu(r) as D[];
    out.push(...conversation(m, `c${seed}-${k}`, r, stats));
  }
  return { examples: out, stats };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [path, n = "14000", seed = "21"] = process.argv.slice(2);
  if (!path) {
    console.error("usage: npx tsx scripts/reader/conv-gen.ts <out.jsonl> [conversations] [seed]");
    process.exit(2);
  }
  const { examples: all, stats } = generateConversations(Number(n), Number(seed));
  // (none that reads like a benchmark question: the benchmark stays a test)
  const flat = (q: string) => q.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const sets = ["v1", "heldout", "v3", "v4", "v5", "v6", "v7", "v8", "v9", "v10"] as const;
  const bench = new Set(sets.flatMap((set) => loadCases("all", set).flatMap((c) => [c.question, ...(c.before ?? []).map((b) => b.user)])).map(flat));
  const guest = (e: ConvExample) => flat(e.prompt.split("\nGuest: ")[1]?.split("\nOrder now:")[0] ?? "");
  const examples = all.filter((e) => !bench.has(guest(e)) || guest(e).split(" ").length <= 2);
  writeFileSync(path, "");
  for (let k = 0; k < examples.length; k += 1000) appendFileSync(path, examples.slice(k, k + 1000).map((e) => JSON.stringify(e)).join("\n") + "\n");
  const byLang = examples.reduce<Record<string, number>>((a, e) => ((a[e.lang] = (a[e.lang] ?? 0) + 1), a), {});
  console.log(JSON.stringify({ examples: examples.length, leaked: all.length - examples.length, byLang, stats }));
}
