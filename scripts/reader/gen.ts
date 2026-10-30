// Training data for an owned order reader: synthetic menus, and guest orders on them with their
// exact reading. Each menu is drawn from the shared dish dictionary (src/shared/dishNamesZh.ts:
// English and Chinese names) with add-on groups of its kind; each message is written in English,
// Manglish, Malay or Chinese, with counts, splits ("2 X, one with A, the other B"), add-ons, typos
// and dishes the menu doesn't have. Since the generator writes each message itself, it knows the
// reading exactly, and where in the message every dish, count and add-on is (`spans`, for an
// encoder that tags and links), as well as the JSON a generative reader should return (`target`).
//
// No benchmark menu or question is used, and the output is checked for any message that reads like
// a benchmark question (bench/ stays a test). Every target is also checked by the reader's own
// checks (checkReading), so the model learns only readings the brain would accept.
//
//   npx tsx scripts/reader/gen.ts <out.jsonl> [examples=60000] [seed=11]   (menus go to <out>.menus.json)
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { DISH_NAMES_ZH } from "../../src/shared/dishNamesZh";
import { checkReading, dishKey, linesKey, rulesLines, type RawOrderReading } from "../../src/server/ai/brain/reading";
import type { Dish } from "../../src/server/ai/brain/understand";
import { rng, typo } from "../brain/data";
import { loadCases } from "../../bench/run";

type Lang = "en" | "manglish" | "ms" | "zh";
interface Opt { name: string; price: number; en: string[]; ms: string[]; zh: string[] }
interface Group { name: string; min: number; max: number; options: Opt[] }
type Kind = "drink" | "main" | "side" | "dessert";
export interface Span { start: number; end: number; label: "DISH" | "COUNT" | "OPTION" | "SPLIT" | "UNMATCHED"; line?: number; ref?: string }
export type MenuOut = { key: string; name: string; zh?: string; groups: { name: string; min: number; max: number; options: { name: string; price: number }[] }[] }[];
/** One example; its menu is `menus[menu]` (each menu is written once, beside the examples). */
export interface Example { id: string; lang: Lang; menu: string; message: string; target: Required<RawOrderReading>; spans: Span[] }

const o = (name: string, price: number, en: string[], ms: string[], zh: string[]): Opt => ({ name, price, en, ms, zh });
// add-on groups by kind of dish; a menu gives each dish a few, with prices varied
// add-ons a menu may offer, by kind: many, so a model learns to read the menu's own choices rather
// than a short list (a menu draws a few of them, with prices varied)
const ADD_ONS: Opt[] = [
  o("Extra egg", 150, ["extra egg", "add egg", "egg"], ["tambah telur", "telur lebih"], ["加蛋"]),
  o("Fried egg", 150, ["fried egg", "sunny side up"], ["telur mata", "telur goreng"], ["荷包蛋", "煎蛋"]),
  o("Onsen egg", 250, ["onsen egg", "soft egg"], ["telur separuh masak"], ["温泉蛋"]),
  o("Extra meat", 300, ["extra meat", "more meat"], ["tambah daging", "daging lebih"], ["加肉"]),
  o("Extra chicken", 400, ["extra chicken", "more chicken"], ["tambah ayam", "ayam lebih"], ["加鸡肉"]),
  o("Extra vegetables", 150, ["extra vegetables", "more veg"], ["sayur lebih", "tambah sayur"], ["加菜"]),
  o("Cheese", 300, ["cheese", "extra cheese"], ["keju", "tambah keju"], ["芝士", "加芝士"]),
  o("Extra prawns", 400, ["extra prawns", "more prawns", "big prawns"], ["tambah udang", "udang lebih"], ["加虾"]),
  o("Cockles", 300, ["cockles", "add cockles"], ["kerang", "tambah kerang"], ["加蚶"]),
  o("Lap cheong", 200, ["lap cheong", "chinese sausage"], ["lap cheong"], ["腊肠"]),
  o("Fish balls", 250, ["fish balls", "fishball"], ["bebola ikan", "fishball"], ["鱼丸"]),
  o("Fish cake", 200, ["fish cake"], ["kek ikan"], ["鱼饼"]),
  o("Tofu puff", 150, ["tofu puff", "taupok"], ["tau pok"], ["豆卜"]),
  o("Corn", 200, ["corn"], ["jagung"], ["玉米"]),
  o("Spinach", 200, ["spinach"], ["bayam"], ["菠菜"]),
  o("Kimchi", 300, ["kimchi"], ["kimchi"], ["泡菜"]),
  o("Extra sambal", 100, ["extra sambal", "more sambal"], ["sambal lebih", "tambah sambal"], ["多参巴"]),
  o("Extra noodles", 200, ["extra noodles", "more noodles"], ["mee lebih", "tambah mee"], ["加面"]),
  o("Extra rice", 200, ["extra rice", "more rice"], ["nasi lebih", "tambah nasi"], ["加饭"]),
  o("Seaweed", 150, ["seaweed", "nori"], ["rumpai laut"], ["紫菜"]),
];
const FREE_PREFS: Opt[] = [
  o("No chilli", 0, ["no chilli", "not spicy"], ["tak nak pedas", "x pedas"], ["不要辣", "走辣"]),
  o("More chilli", 0, ["more chilli", "extra spicy"], ["pedas lebih", "lebih pedas"], ["多辣", "加辣"]),
  o("No onion", 0, ["no onion"], ["tak nak bawang"], ["不要洋葱"]),
  o("No spring onion", 0, ["no spring onion", "no green onion"], ["tak nak daun bawang"], ["不要葱", "走葱"]),
  o("Less oil", 0, ["less oil"], ["kurang minyak"], ["少油"]),
  o("Less salt", 0, ["less salt"], ["kurang masin"], ["少盐"]),
  o("No taugeh", 0, ["no taugeh", "no bean sprouts"], ["tak nak taugeh", "x taugeh"], ["不要豆芽"]),
  o("No coriander", 0, ["no coriander", "no cilantro"], ["tak nak daun ketumbar"], ["不要香菜"]),
];
const DRINK_ADDS: Opt[] = [
  o("Pearls", 150, ["pearls", "boba"], ["pearl"], ["珍珠"]), o("Grass jelly", 100, ["grass jelly", "cincau"], ["cincau"], ["仙草"]),
  o("Sour plum", 50, ["sour plum", "asam boi"], ["asam boi"], ["酸梅"]), o("Nata de coco", 100, ["nata de coco", "coconut jelly"], ["nata"], ["椰果"]),
  o("Aloe vera", 100, ["aloe vera", "aloe"], ["lidah buaya"], ["芦荟"]), o("Cheese foam", 200, ["cheese foam"], ["cheese foam"], ["奶盖"]),
  o("Lime", 50, ["lime", "add lime"], ["limau", "tambah limau"], ["加酸柑"]),
];
const DESSERT_ADDS: Opt[] = [
  o("Extra ice cream", 300, ["extra ice cream", "add ice cream", "ice cream"], ["tambah aiskrim", "aiskrim"], ["加雪糕", "雪糕"]),
  o("Red bean", 100, ["red bean"], ["kacang merah"], ["红豆"]), o("Durian", 400, ["durian"], ["durian"], ["榴莲"]),
  o("Pulut", 150, ["pulut", "glutinous rice"], ["pulut"], ["糯米"]), o("Attap chee", 150, ["attap chee", "attap seed"], ["atap"], ["亚答子"]),
  o("Peanuts", 50, ["peanuts", "nuts"], ["kacang"], ["花生"]),
];
const N_ZH = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
const level = (n: number, price: number) => o(`Level ${n}`, price, [`level ${n}`, `lvl ${n}`, `spicy level ${n}`], [`level ${n}`, `tahap ${n}`], [`${n}级辣`, `${N_ZH[n]}级辣`]);
const sample = <T,>(r: () => number, xs: T[], n: number) => [...xs].sort(() => r() - 0.5).slice(0, n);
const priced = (r: () => number, x: Opt) => ({ ...x, price: x.price ? x.price + pick(r, [-50, 0, 0, 50, 100]) : 0 });
const GROUPS: Record<Kind, (r: () => number) => Group[]> = {
  drink: (r) => [
    { name: "Temperature", min: 1, max: 1, options: [o("Hot", 0, ["hot"], ["panas"], ["热"]), o("Iced", pick(r, [30, 50, 80]), ["iced", "ice", "cold"], ["ais", "sejuk", "peng"], ["冰"])] },
    { name: "Sugar", min: 1, max: 1, options: [o("Normal sugar", 0, [], [], []), o("Less sweet", 0, ["less sweet", "less sugar"], ["kurang manis", "siew dai"], ["少甜", "少糖"]), o("No sugar", 0, ["no sugar"], ["kosong", "tak nak gula"], ["无糖", "走糖"])] },
    { name: "Size", min: 1, max: 1, options: [o("Regular", 0, [], [], []), o("Large", pick(r, [100, 150, 200]), ["large", "big"], ["besar"], ["大杯"])] },
    { name: "Ice", min: 1, max: 1, options: [o("Normal ice", 0, [], [], []), o("Less ice", 0, ["less ice"], ["kurang ais", "ais sikit"], ["少冰"]), o("No ice", 0, ["no ice"], ["tak nak ais", "x ais"], ["走冰", "去冰"])] },
    { name: "Milk", min: 1, max: 1, options: [o("Fresh milk", 0, [], [], []), o("Oat milk", pick(r, [150, 200]), ["oat milk", "oat"], ["susu oat"], ["燕麦奶"]), o("Soy milk", 100, ["soy milk"], ["susu soya"], ["豆奶"])] },
    { name: pick(r, ["Add", "Toppings"]), min: 0, max: 2, options: sample(r, DRINK_ADDS, 2 + Math.floor(r() * 3)).map((x) => priced(r, x)) },
  ],
  main: (r) => [
    pick(r, [
      { name: "Size", min: 1, max: 1, options: [o("Regular", 0, [], [], []), o("Large", pick(r, [200, 250, 300]), ["large", "big", "upsize"], ["besar"], ["大份", "加大"])] },
      { name: "Size", min: 1, max: 1, options: [o("Small", 0, ["small"], ["kecil"], ["小份", "小碗"]), o("Medium", pick(r, [200, 300]), ["medium"], ["sederhana"], ["中份", "中碗"]), o("Large", pick(r, [400, 600]), ["large", "big"], ["besar"], ["大份", "大碗"])] },
      { name: "Rice size", min: 1, max: 1, options: [o("Regular rice", 0, [], [], []), o("Large rice", 200, ["large rice", "more rice", "big rice"], ["nasi besar", "nasi lebih"], ["大饭", "饭多"]), o("Less rice", 0, ["less rice"], ["nasi kurang", "nasi sikit"], ["饭少", "少饭"])] },
    ]),
    { name: "Egg", min: 1, max: 1, options: [o("Chicken egg", 0, [], [], []), o("Duck egg", 100, ["duck egg"], ["telur itik"], ["鸭蛋"]), o("Salted egg", 150, ["salted egg"], ["telur masin"], ["咸蛋"]), o("No egg", 0, ["no egg"], ["tak nak telur", "tanpa telur"], ["不要蛋", "走蛋"])] },
    { name: "Noodles", min: 1, max: 1, options: [o("Yellow mee", 0, ["yellow mee", "mee"], ["mee kuning", "mee"], ["黄面"]), o("Bee hoon", 0, ["bee hoon", "bihun", "vermicelli"], ["bihun", "mihun"], ["米粉"]), o("Kway teow", 50, ["kway teow", "flat noodles"], ["kuey teow"], ["粿条"]), o("Udon", 200, ["udon"], ["udon"], ["乌冬"])] },
    { name: "Spice level", min: 1, max: 1, options: Array.from({ length: pick(r, [5, 10]) }, (_, k) => level(k + 1, k + 1 > 5 ? pick(r, [50, 100]) : 0)) },
    { name: pick(r, ["Add-ons", "Extras", "Toppings"]), min: 0, max: pick(r, [2, 3, 4]), options: sample(r, ADD_ONS, 3 + Math.floor(r() * 5)).map((x) => priced(r, x)) },
    { name: "Preferences", min: 0, max: 3, options: sample(r, FREE_PREFS, 3 + Math.floor(r() * 3)) },
  ],
  side: (r) => [
    { name: "Portion", min: 1, max: 1, options: [o("5 pcs", 0, ["5 pcs", "five pieces"], ["5 ketul"], ["五粒", "五个"]), o("10 pcs", pick(r, [500, 600, 800]), ["10 pcs", "ten pieces"], ["10 ketul"], ["十粒", "十个"])] },
    { name: "Dip", min: 0, max: 2, options: [o("Chilli sauce", 0, ["chilli sauce"], ["sos cili"], ["辣椒酱"]), o("Mayo", 0, ["mayo", "mayonnaise"], ["mayo"], ["美乃滋"]), o("Peanut sauce", 100, ["peanut sauce"], ["kuah kacang"], ["花生酱"]), o("Sweet sauce", 0, ["sweet sauce"], ["sos manis"], ["甜酱"])] },
  ],
  dessert: (r) => [{ name: pick(r, ["Add", "Toppings"]), min: 0, max: 3, options: sample(r, DESSERT_ADDS, 3 + Math.floor(r() * 3)).map((x) => priced(r, x)) }],
};
const pick = <T,>(r: () => number, xs: T[]): T => xs[Math.floor(r() * xs.length)];
const kindOf = (name: string): Kind =>
  /\b(tea|teh|kopi|coffee|latte|juice|soda|milo|milk|smoothie|lemonade|water|cham|yuzu|soy bean|barley|shake|frappe|mocha|cappuccino|americano|macchiato|cold brew|flat white|bandung|sirap|chocolate|matcha|beer|lager|wine|cocktail|kombucha)\b/i.test(name) ? "drink"
  : /\b(cendol|ice cream|cake|pudding|kuih|ais kacang|tart|bingsu|waffle|sago|mochi|brownie|jelly|tong sui|bubur|pancake|cheesecake|tiramisu|churros|sundae)\b/i.test(name) ? "dessert"
  : /\b(dumpling|gyoza|wonton|wantan|spring roll|fries|karaage|satay|edamame|siu mai|har gow|popiah|otak|keropok|salad|bun|pau|croquette|chips|wings|nuggets|tofu|lor bak|cucur)\b/i.test(name) ? "side" : "main";
const title = (s: string) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());

const POOL = Object.entries(DISH_NAMES_ZH).map(([en, zh]) => ({ name: title(en), zh: zh[0], kind: kindOf(en) }));

/** A menu of 12 to 35 dishes, each kind's dishes with a few of its add-on groups. */
function menu(r: () => number): (Dish & { kind: Kind })[] {
  const n = 12 + Math.floor(r() * 24);
  const chosen = new Map<string, (typeof POOL)[number]>();
  while (chosen.size < n) {
    const d = pick(r, POOL);
    if (![...chosen.values()].some((x) => x.zh === d.zh)) chosen.set(d.name, d);
  }
  const price = (k: Kind) => 10 * Math.round((k === "drink" ? 200 + r() * 1000 : k === "main" ? 800 + r() * 2000 : 400 + r() * 1100) / 10);
  // confusers: a plain rice beside dishes with a large rice, and a dish's "Special" beside it
  const list = [...chosen.values()];
  if (r() < 0.5) list.push(pick(r, [{ name: "Steamed Rice", zh: "白饭", kind: "side" as Kind }, { name: "Nasi Putih", zh: "白饭", kind: "side" as Kind }, { name: "Japanese Rice", zh: "日本米饭", kind: "side" as Kind }]));
  for (const d of list.filter((x) => x.kind === "main").slice(0, 2)) if (r() < 0.3) list.push({ name: `${d.name} Special`, zh: `特别${d.zh}`, kind: "main" });
  // (each group only on dishes it fits: a noodle choice on noodles, spice levels on curries)
  const FITS: Record<string, RegExp> = {
    Noodles: /mee|noodle|laksa|kway teow|koay teow|hor fun|bihun|bee hoon|ramen|udon|pho|mee hoon|kolo/i,
    "Rice size": /rice|nasi|don\b|biryani|briyani|claypot|bowl/i,
    Egg: /fried|goreng|char |kway teow|koay teow|mee|nasi|rice|omelette|hor fun/i,
    "Spice level": /curry|kari|tom yum|laksa|mala|sambal|rendang|spicy|asam|jjigae|tikka|masala|penyet/i,
    Portion: /dumpling|gyoza|wonton|wantan|siu mai|har gow|wings|nuggets|karaage|satay|spring roll|\bbun|\bpau|popiah|croquette/i,
    Dip: /fried|goreng|wings|nuggets|karaage|satay|spring roll|fries|cucur|keropok|croquette|popiah/i,
    Milk: /latte|milk|teh\b|tea|coffee|kopi|matcha|chocolate|milo|mocha|cappuccino|flat white/i,
  };
  const plain = new Set(["Steamed Rice", "Nasi Putih", "Japanese Rice"]);
  return list.map((d, i) => {
    const groups = plain.has(d.name) ? [] : GROUPS[d.kind](r).filter((g) => (!FITS[g.name] || FITS[g.name].test(d.name)) && r() < 0.6);
    return {
      id: `d${i}`, name: d.name, category: d.kind, description: "", price: price(d.kind), allergens: [], dietary: [], spiceLevel: 0, isSignature: false, kind: d.kind,
      translations: r() < 0.8 ? { zh: { name: d.zh } } : undefined,
      modifiers: groups.map((g) => ({ name: g.name, min: g.min, max: g.max, options: g.options.map((x) => ({ name: x.name, price: x.price, said: x })) })),
    } as unknown as Dish & { kind: Kind };
  });
}

// (a guest doesn't name a dish by "rice", "tea" or "cheese" alone)
const COMMON = new Set(["rice", "noodle", "noodles", "soup", "tea", "coffee", "milk", "juice", "cake", "fried", "chicken", "beef", "pork", "fish", "with", "special", "set", "spicy", "sweet", "iced", "small", "large", "mixed", "steamed", "roast", "grilled", "curry",
  "three", "black", "white", "green", "yellow", "double", "layer", "paste", "sauce", "style", "house", "mixed", "plain", "kung", "salted", "baked", "cheese", "golden", "crispy", "honey", "butter", "cereal", "paper", "stone"]);
const OPTION_WORDS = new Set([...ADD_ONS, ...FREE_PREFS, ...DRINK_ADDS, ...DESSERT_ADDS, ...Object.values(GROUPS).flatMap((g) => g(() => 0.5)).flatMap((g) => g.options)].flatMap((x) => [...x.en, ...x.ms].join(" ").split(/\s+/)).filter((w) => w.length >= 3));
const NUM_EN = ["", "one", "two", "three", "four", "five", "six"];
const NUM_MS = ["", "satu", "dua", "tiga", "empat", "lima", "enam"];
const NUM_ZH = ["", "一", "两", "三", "四", "五", "六"];
const MEASURE: Record<Kind, string[]> = { drink: ["杯"], main: ["份", "碗", "碟"], side: ["份", "盘"], dessert: ["份", "碗"] };

/** How a guest types a dish's name here: whole, lower case, a word only it has on this menu, with a typo, or in Chinese. */
function surface(d: Dish, all: Dish[], lang: Lang, r: () => number): string {
  const zh = d.translations?.zh?.name;
  if (lang === "zh" && zh) return zh;
  const words = d.name.toLowerCase().split(/\s+/);
  const own = words.filter((w) => w.length >= 4 && !COMMON.has(w) && !OPTION_WORDS.has(w) && !all.some((x) => x !== d && x.name.toLowerCase().split(/\s+/).includes(w)));
  const x = r();
  if (x < 0.3) return d.name;
  if (x < 0.65 || !own.length) return x < 0.85 || d.name.length < 6 ? d.name.toLowerCase() : typo(d.name.toLowerCase(), r);
  return own[0];
}

interface Piece { text: string; label?: Span["label"]; line?: number; ref?: string }
interface Line { dish: Dish; count: number; options: string[] }

const optsOf = (d: Dish, names: string[]) => names.map((name) => (d.modifiers ?? []).flatMap((g) => g.options).find((x) => x.name === name) as unknown as { said: Opt });
const sayOpt = (x: { said: Opt }, lang: Lang, r: () => number) => (lang === "zh" ? pick(r, x.said.zh) : lang === "ms" ? pick(r, x.said.ms.length ? x.said.ms : x.said.en) : lang === "manglish" ? pick(r, [...x.said.ms, ...x.said.en]) : pick(r, x.said.en));
/** A line's add-ons as pieces, with what joins them ("large, extra egg and no chilli", "大份加菜"). */
function optionPieces(d: Dish, names: string[], k: number, lang: Lang, r: () => number): Piece[] {
  return optsOf(d, names).flatMap((x, j, all): Piece[] => [
    { text: !j ? "" : lang === "zh" ? pick(r, ["，", ""]) : j === all.length - 1 ? pick(r, [" and ", ", ", " "]) : pick(r, [", ", " "]) },
    { text: sayOpt(x, lang, r), label: "OPTION", line: k, ref: x.said.name },
  ]);
}

/** One order line as pieces of text: its count, its dish, its add-ons, in the language's own order. */
function linePieces(l: Line, k: number, all: Dish[], lang: Lang, r: () => number): Piece[] {
  const d = l.dish as Dish & { kind: Kind };
  const opts = optsOf(d, l.options);
  const dish: Piece = { text: surface(d, all, lang, r), label: "DISH", line: k, ref: d.id };
  const optPieces = optionPieces(d, l.options, k, lang, r);
  if (lang === "zh") {
    const count: Piece = { text: `${l.count <= 6 ? NUM_ZH[l.count] : String(l.count)}${pick(r, MEASURE[d.kind])}`, label: "COUNT", line: k };
    // "两杯冰奶茶", "一份炒粿条加蛋"
    const before = opts.length && r() < 0.5 && opts.every((x) => x.said.zh.every((z) => /^[冰热大少]/.test(z)));
    return before ? [count, ...optPieces, dish] : [count, dish, ...(opts.length ? [{ text: pick(r, ["", "，", " "]) }, ...optPieces] : [])];
  }
  if (lang === "ms" || (lang === "manglish" && r() < 0.5)) {
    // "teh o ais dua", "nasi lemak satu, tambah telur"
    const count: Piece = { text: l.count === 1 && r() < 0.3 ? "" : r() < 0.6 ? NUM_MS[Math.min(l.count, 6)] || String(l.count) : String(l.count), label: "COUNT", line: k };
    const head: Piece[] = r() < 0.5 ? [dish, ...(opts.length ? [{ text: " " }, ...optPieces] : []), { text: count.text ? " " : "" }, count] : [count, { text: count.text ? " " : "" }, dish, ...(opts.length ? [{ text: " " }, ...optPieces] : [])];
    return head;
  }
  const countText = l.count === 1 ? pick(r, ["1", "one", "a", ""]) : r() < 0.7 ? String(l.count) : NUM_EN[Math.min(l.count, 6)];
  const count: Piece = { text: countText, label: "COUNT", line: k };
  const sizeFirst = opts.length === 1 && r() < 0.4;
  if (r() < 0.15 && l.count > 1) return [dish, ...(opts.length ? [{ text: " " }, ...optPieces] : []), { text: " x" }, { text: String(l.count), label: "COUNT", line: k }];
  if (sizeFirst) return [count, { text: count.text ? " " : "" }, ...optPieces, { text: " " }, dish];
  return [count, { text: count.text ? " " : "" }, dish, ...(opts.length ? [{ text: pick(r, [" with ", " ", " add ", ", "]) }, ...optPieces] : [])];
}

/** "2 nasi lemak, one with egg, the other large": a count of one dish split by its add-ons. */
function splitPieces(d: Dish, a: Line, b: Line, k: number, all: Dish[], lang: Lang, r: () => number): Piece[] {
  const head = linePieces({ dish: d, count: 2, options: [] }, k, all, lang, r).map((p) => (p.label === "COUNT" || p.label === "DISH" ? { ...p, line: k } : p));
  const optText = (l: Line, kk: number) => optionPieces(d, l.options, kk, lang, r);
  const [one, other] = lang === "zh" ? [pick(r, ["一份", "其中一份", "一个"]), pick(r, ["另一份", "一份", "另外一个"])] : lang === "ms" ? ["satu", pick(r, ["satu lagi", "lagi satu"])] : [pick(r, ["one", "1"]), pick(r, ["the other", "the other one", "another one"])];
  const sep = lang === "zh" ? "，" : ", ";
  return [...head, { text: sep }, { text: one, label: "SPLIT", line: k }, { text: lang === "zh" ? "" : pick(r, [" with ", " ", " add "]) }, ...optText(a, k), { text: sep }, { text: other, label: "SPLIT", line: k + 1 }, { text: lang === "zh" ? "" : " " }, ...optText(b, k + 1)];
}

// what a guest says around an order ("hi", "can pay by card?", "ada promosi hari ni?"): the reader's
// own service and small-talk templates (scripts/brain/reader-templates.json), none of it a dish
const CHAT = (() => {
  const t = JSON.parse(readFileSync(new URL("../brain/reader-templates.json", import.meta.url), "utf8")) as Record<string, string[]>;
  return [...t.service, ...t.smalltalk].filter((x) => !x.includes("{") && x.length < 60);
})();
const TAIL: Record<Lang, string[]> = {
  en: ["total?", "how much?", "how much altogether?", "total how much", "what's the total"],
  manglish: ["total how much ah", "berapa ah", "how much ah", "total?"],
  ms: ["berapa?", "semua berapa?", "jumlah berapa", "berapa semua"],
  zh: ["多少钱？", "一共多少？", "总共多少钱", "一共几多钱"],
};
const EACH: Record<Lang, string[]> = { en: ["split 3, how much each?", "each pay how much?"], manglish: ["split 2 how much each ah"], ms: ["seorang berapa?", "bayar asing, seorang berapa"], zh: ["每人多少？", "平分，每人几多"] };
const JOIN: Record<Lang, string[]> = { en: [", ", " and ", " + ", ", and ", " n "], manglish: [", ", " n ", " + ", " and "], ms: [", ", " dan ", " + "], zh: ["，", "、", "，还有", "，再来"] };
const LEAD: Record<Lang, string[]> = { en: ["", "", "can i get ", "i want ", "hi, ", "boss, ", "we'll have "], manglish: ["", "boss ", "uncle ", "", "nak "], ms: ["", "nak ", "saya nak ", "bagi "], zh: ["", "我要", "老板，", "要"] };

/** One example on `m`: an order (or a question about a dish, or no dish at all) with its reading. */
function example(m: (Dish & { kind: Kind })[], menuId: string, id: string, r: () => number): Example | null {
  let lang: Lang = pick(r, ["en", "en", "en", "manglish", "manglish", "ms", "zh", "zh"]);
  const kind = r();
  const pieces: Piece[] = [];
  const lines: Line[] = [];
  const unmatched: string[] = [];
  let total = false;
  let each = false;
  const zhOk = (d: Dish) => !!d.translations?.zh?.name;
  if (kind < 0.12) {
    // a question about one dish: the dish, once, as the reading's line
    const d = pick(r, m);
    if (lang === "zh" && !zhOk(d)) lang = "en";
    const q = { en: ["is the {} spicy?", "what's in the {}?", "{} got egg?", "how much is the {}"], manglish: ["{} spicy or not", "{} got what inside ah"], ms: ["{} pedas tak?", "{} ada apa?", "{} berapa?"], zh: ["{}辣吗？", "{}有什么？", "{}多少钱？"] }[lang];
    const [a, b] = pick(r, q).split("{}");
    pieces.push({ text: a }, { text: surface(d, m, lang, r), label: "DISH", line: 0, ref: d.id }, { text: b });
    lines.push({ dish: d, count: 1, options: [] });
  } else if (kind < 0.16) {
    // no dish at all
    pieces.push({ text: pick(r, { en: ["thanks!", "can i pay by card?", "where's the toilet", "how long is the wait?"], manglish: ["ok thanks boss", "got wifi ah"], ms: ["terima kasih", "boleh bayar kad?"], zh: ["谢谢", "可以刷卡吗？"] }[lang]) });
  } else {
    const n = pick(r, [1, 1, 2, 2, 2, 3, 3, 4]);
    pieces.push({ text: pick(r, LEAD[lang]) });
    const used = new Set<string>();
    for (let i = 0; i < n; i++) {
      const pool = m.filter((d) => !used.has(d.id) && (lang !== "zh" || zhOk(d)));
      if (!pool.length) break;
      const d = pick(r, pool);
      used.add(d.id);
      const join: Piece = { text: i ? pick(r, JOIN[lang]) : "" };
      const groups = d.modifiers ?? [];
      const choose = () => {
        const out: string[] = [];
        for (const g of groups) {
          if (r() > 0.45) continue;
          const sayable = g.options.filter((x) => (x as unknown as { said: Opt }).said.en.length);
          const take = Math.min(g.max ?? 1, 1 + (r() < 0.25 ? 1 : 0));
          for (const x of [...sayable].sort(() => r() - 0.5).slice(0, take)) out.push(x.name);
        }
        return out.slice(0, 3);
      };
      if (groups.length && r() < 0.15) {
        // a split: two of it, each with its own add-ons
        const [a, b] = [choose(), choose()];
        if (!a.length || !b.length || a.join() === b.join()) {
          i--;
          used.delete(d.id);
          continue;
        }
        const la = { dish: d, count: 1, options: a };
        const lb = { dish: d, count: 1, options: b };
        pieces.push(join, ...splitPieces(d, la, lb, lines.length, m, lang, r));
        lines.push(la, lb);
        continue;
      }
      const count = r() < 0.55 ? 1 : r() < 0.85 ? 2 + Math.floor(r() * 2) : 4 + Math.floor(r() * 3);
      const l = { dish: d, count, options: choose() };
      pieces.push(join, ...linePieces(l, lines.length, m, lang, r));
      lines.push(l);
    }
    // a dish this menu doesn't have, anywhere in the order (first, between lines, or last)
    if (r() < 0.15) {
      const other = pick(r, POOL.filter((p) => !m.some((d) => d.name === p.name || d.translations?.zh?.name === p.zh)));
      const text = lang === "zh" ? other.zh : other.name.toLowerCase();
      const piece: Piece[] = [{ text: pick(r, JOIN[lang]) }, { text: lang === "zh" ? "一份" : pick(r, ["1 ", "a ", "", "2 "]) }, { text, label: "UNMATCHED" }];
      const joins = pieces.map((p, k) => (!p.label && JOIN[lang].includes(p.text) ? k : -1)).filter((k) => k > 0);
      if (joins.length && r() < 0.6) pieces.splice(pick(r, joins), 0, ...piece);
      else pieces.push(...piece);
      unmatched.push(text);
    }
    if (r() < 0.45) {
      total = true;
      pieces.push({ text: pick(r, [". ", " ", ", ", "? "]).replace(/^\. $/, lang === "zh" ? "。" : ". ") }, { text: pick(r, TAIL[lang]) });
    } else if (r() < 0.06) {
      each = true;
      pieces.push({ text: lang === "zh" ? "。" : ". " }, { text: pick(r, EACH[lang]) });
    }
  }
  // and what else the guest says, before or after the order
  if (r() < 0.35) {
    const chat = pick(r, CHAT);
    if (r() < 0.5) pieces.unshift({ text: `${chat}${pick(r, [" ", ". ", ", ", "? "])}` });
    else pieces.push({ text: `${pick(r, [". ", " ", "? ", ", "])}${chat}` });
  }
  // the message, and where each labelled piece is
  let message = "";
  const spans: Span[] = [];
  for (const p of pieces) {
    if (p.label && p.text) spans.push({ start: message.length, end: message.length + p.text.length, label: p.label, line: p.line, ref: p.ref });
    message += p.text;
  }
  message = message.replace(/\s+$/, "");
  if (!message.trim()) return null;
  const key = (d: Dish) => dishKey(m.indexOf(d as Dish & { kind: Kind }));
  const target = { lines: lines.map((l) => ({ dish: key(l.dish), count: l.count, options: l.options, off: [] as string[] })), unmatched, total, each };
  return {
    id, lang, message, target,
    spans: spans.map((s) => (s.label === "DISH" && s.ref ? { ...s, ref: key(m.find((d) => d.id === s.ref)!) } : s)),
    menu: menuId,
  };
}

/** `n` examples, 20 to a menu, each target accepted by the reader's own checks. */
const menuOut = (m: Dish[]): MenuOut => m.map((d, k) => ({ key: dishKey(k), name: d.name, zh: d.translations?.zh?.name, groups: (d.modifiers ?? []).map((g) => ({ name: g.name, min: g.min ?? 0, max: g.max ?? 1, options: g.options.map((x) => ({ name: x.name, price: x.price })) })) }));

export function generate(n: number, seed = 11): { examples: Example[]; menus: Record<string, MenuOut>; rejected: number; rulesAgree: number } {
  const r = rng(seed);
  const out: Example[] = [];
  const menus: Record<string, MenuOut> = {};
  let rejected = 0;
  let rulesAgree = 0;
  let m = menu(r);
  let menuId = "";
  for (let k = 0; out.length < n; k++) {
    if (k % 20 === 0) {
      m = menu(r);
      menuId = `m${seed}-${k / 20}`;
      menus[menuId] = menuOut(m);
    }
    const e = example(m, menuId, `s${seed}-${k}`, r);
    if (!e) continue;
    const checked = checkReading(e.target, m, () => true, e.message);
    // (an add-on said in words the checks don't know is fine; a dish or count they'd drop isn't)
    if (checked.lines.length !== e.target.lines.length || checked.lines.some((l, i) => l.count !== e.target.lines[i].count)) {
      rejected++;
      continue;
    }
    if (linesKey(checked.lines) === linesKey(rulesLines(m, e.message))) rulesAgree++;
    out.push(e);
  }
  return { examples: out, menus, rejected, rulesAgree };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [path, n = "60000", seed = "11"] = process.argv.slice(2);
  if (!path) {
    console.error("usage: npx tsx scripts/reader/gen.ts <out.jsonl> [examples] [seed]");
    process.exit(2);
  }
  const { examples: all, menus, rejected, rulesAgree } = generate(Number(n), Number(seed));
  // (none that reads like a benchmark question: the benchmark stays a test)
  const flat = (q: string) => q.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const sets = ["v1", "heldout", "v3", "v4", "v5", "v6", "v7", "v8", "v9", "v10"] as const;
  const bench = new Set(sets.flatMap((set) => loadCases("all", set).flatMap((c) => [c.question, ...(c.before ?? []).map((b) => b.user)])).map(flat));
  const examples = all.filter((e) => !bench.has(flat(e.message)) || flat(e.message).split(" ").length <= 2);
  const leaked = all.length - examples.length;
  // (written a thousand at a time: one string of 60,000 is too long)
  writeFileSync(path, "");
  for (let k = 0; k < examples.length; k += 1000) appendFileSync(path, examples.slice(k, k + 1000).map((e) => JSON.stringify(e)).join("\n") + "\n");
  writeFileSync(path.replace(/\.jsonl$/, ".menus.json"), JSON.stringify(menus));
  const byLang = examples.reduce<Record<string, number>>((a, e) => ((a[e.lang] = (a[e.lang] ?? 0) + 1), a), {});
  console.log(JSON.stringify({ examples: examples.length, rejected, leaked, rulesAgreeShare: +(rulesAgree / examples.length).toFixed(3), byLang }));
}
