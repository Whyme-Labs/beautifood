// The add-ons and sizes a guest asks for in their own words ("both iced", "with oat milk", "roti
// canai tambah telur", "large", "走冰", "12 pcs"), read against each dish's own options. Only priced
// options matter to a bill; a free one ("hot", "less sweet") changes nothing.
import { editDistance, normalize } from "../../../shared/brain/text";
import type { ModifierOption } from "../../../shared/types";

type WithOptions = { name: string; translations?: Record<string, { name?: string } | undefined>; modifiers?: { name: string; min?: number; max?: number; options: ModifierOption[] }[] };

// a guest's words for an option's own words (as menus name them: "Ais (iced)", "Oat milk", "Besar (large)")
const ALSO: Record<string, string[]> = {
  ais: ["ice", "iced", "cold", "peng", "sejuk"], iced: ["ice", "ais", "cold", "peng", "sejuk"],
  panas: ["hot", "warm"], hot: ["panas", "warm"], suam: ["warm"],
  besar: ["large", "big", "upsize", "bigger"], large: ["besar", "big", "upsize", "bigger"],
  telur: ["egg", "eggs"], egg: ["telur", "eggs"], bawang: ["onion"], onion: ["bawang"],
  mata: ["fried egg", "sunny side"], rebus: ["boiled egg", "hard boiled"],
  oat: ["oat", "oatmilk"], almond: ["badam", "almond"], shot: ["shot", "double"],
  kuah: ["kuah", "sauce", "peanut sauce"], laksa: ["laksa", "curry"], chilli: ["chilli", "chili", "sambal", "cili"],
  balls: ["ball", "fishball", "fishballs", "bebola"], fish: ["ikan"], minced: ["mince", "minced", "mincemeat"],
  bilis: ["anchovy", "anchovies"], hoon: ["bihun", "meehoon", "vermicelli"], prawns: ["prawn", "shrimp", "shrimps", "udang"],
  puffs: ["taupok", "tau pok", "tofu puff"], pearls: ["pearl", "boba", "tapioca"], pudding: ["puding"],
  grass: ["cincau"], coconut: ["kelapa", "nata"], bean: ["kacang merah"], foam: ["foam"],
  cheese: ["keju", "cheesy"], ramyeon: ["ramen", "ramyun", "ramyon", "noodle", "noodles", "maggi"], cake: ["cake"],
  fries: ["fry", "kentang", "kentang goreng", "chips"], soft: ["soda", "air", "minuman", "soft drink", "can drink"], drink: ["air", "minuman", "soda"], coleslaw: ["slaw"],
  mushrooms: ["mushroom", "cendawan"], pineapple: ["nanas"], pepperoni: ["pepperoni"], parmesan: ["parmesan"],
  cream: ["ice cream", "aiskrim", "icecream"], whey: ["whey"], plant: ["vegan protein"], chia: ["chia"],
  granola: ["granola"], flakes: ["flake"], honey: ["madu"], nuts: ["nut", "kacang"], cacao: ["cocoa", "cacao"],
  avocado: ["avo", "alpukat"], poached: ["poached"], salmon: ["salmon"], feta: ["feta"],
  kaya: ["kaya"], sambal: ["sambal"], rendang: ["rendang"], sotong: ["squid", "sotong"], udang: ["prawn", "prawns", "shrimp"],
  ayam: ["chicken"], goreng: ["fried"], lime: ["limau", "lemon"], plum: ["asam boi", "assam boi", "sour plum", "plum"], sour: ["asam", "assam", "masam"],
  peanut: ["pb", "kacang", "nut"], milo: ["milo"], noodles: ["noodle", "extra mee", "tambah mee", "more mee", "mee lagi"], peanuts: ["peanut", "kacang"], tofu: ["tauhu", "taufu"],
  strawberries: ["strawberry"], chocolate: ["choc", "coklat", "chocolate"], mayo: ["mayonnaise"],
  seaweed: ["nori"], spicy: ["spicy", "pedas", "hot"], yuja: ["yuzu", "citron"], cola: ["coke", "cola"], cider: ["cider", "chilsung"],
  bucket: ["bucket", "baldi"], crust: ["crust"], thin: ["thin"], stuffed: ["stuffed", "cheese crust"],
  chicken: ["ayam"], beef: ["daging"],
};
// ...and in Chinese, as a guest writes it
const ALSO_ZH: Record<string, RegExp> = {
  ais: /冰|凍|冻/, iced: /冰|凍|冻/, panas: /热(?!带|狗)/, hot: /热(?!带|狗)/, suam: /温/,
  besar: /大杯|大份|加大|大的|大碗|大包|大号/, large: /大杯|大份|加大|大的|大碗|大包|大号/,
  telur: /加蛋|蛋/, egg: /加蛋|鸡蛋|蛋/, mata: /荷包蛋|煎蛋|太阳蛋/, rebus: /水煮蛋|白煮蛋|煮蛋/, bawang: /洋葱/, onion: /洋葱/,
  oat: /燕麦/, almond: /杏仁(?!酱)/, shot: /加浓|浓缩|多一份咖啡/, laksa: /叻沙|咖喱汤/, curry: /咖喱/, chilli: /辣椒酱|辣椒碎|辣椒干|辣椒/, kuah: /花生酱|沙爹酱|花生酱汁/,
  salmon: /三文鱼|烟熏三文鱼/, bacon: /培根/, poached: /水波蛋/, dry: /干捞|干的/, soup: /汤的|汤底/,
  balls: /鱼丸/, minced: /肉碎|肉末|肉燥/, bilis: /江鱼仔|小鱼干/, hoon: /米粉/, prawns: /虾/, puffs: /豆卜|豆泡/,
  noodles: /加面|多面|面加倍/, mushrooms: /蘑菇|香菇/, skin: /腐竹|豆皮/, peanuts: /花生/, tofu: /豆腐/, milo: /美禄/,
  pearls: /珍珠|波霸/, pudding: /布丁/, grass: /仙草/, coconut: /椰果|椰子片|椰丝/, bean: /红豆/, foam: /奶盖/,
  cheese: /芝士|起司|奶酪/, ramyeon: /拉面|泡面|快熟面/, rice: /年糕/, cake: /年糕|鱼饼/, fries: /薯条/, coleslaw: /凉拌|卷心菜沙拉/, soft: /饮料|汽水|饮品/,
  kimchi: /泡菜/, yangnyeom: /甜辣/, garlic: /蒜/, butter: /黄油|牛油/, snow: /雪花/, honey: /蜂蜜/,
  pineapple: /菠萝|黄梨/, pepperoni: /意大利辣香肠|辣香肠/, parmesan: /帕玛森|帕马森/, cream: /冰淇淋|雪糕/, whey: /乳清/, plant: /植物蛋白/,
  chia: /奇亚籽/, peanut: /花生/, granola: /燕麦脆片|格兰诺拉|燕麦片/, flakes: /椰子片|椰丝/, nuts: /坚果/, cacao: /可可/, spirulina: /螺旋藻/,
  avocado: /牛油果|鳄梨/, feta: /菲达/, kaya: /咖椰|加椰/, sambal: /参巴|叁巴/, rendang: /仁当/, sotong: /苏东|鱿鱼/, udang: /虾/,
  ayam: /炸鸡|鸡肉|鸡(?!蛋)/, lime: /酸柑|桔子|桔仔|青柠/, plum: /酸梅/, strawberries: /草莓/, chocolate: /巧克力/, mayo: /美乃滋|蛋黄酱/,
  seaweed: /海苔/, matcha: /抹茶/, spicy: /加辣|特辣|很辣/, yuja: /柚子/, cola: /可乐/, cider: /七星|雪碧/, bucket: /一桶|桶/,
  thin: /薄底|薄饼底|薄脆/, stuffed: /芝心/, teh: /奶茶|茶/, kopi: /咖啡/, chicken: /鸡肉|鸡(?!蛋|翅)/, beef: /牛肉/,
};
// words that say nothing of which option ("milk" is every milk option, "extra" every add-on), and a
// count's unit ("12 pcs", "12 inch": the number is what names it)
const GENERIC = new Set(["milk", "extra", "add", "on", "the", "a", "with", "and", "of", "sauce", "set", "piece", "pieces", "smoked", "susu", "fresh", "tambah", "lebih", "more", "pcs", "pc", "inch", "inches", "make", "it", "combo", "upgrade", "level", "style", "x"]);
// "no ice", "without ice", "tak nak ais", "走冰": an option taken off ("less ice" is still ice)
const OFF = /\b(no|without|tak nak|tak mau|xnak|x nak|tanpa|hold the|minus|remove the|take off the|takeout the|tak payah|instead of(?: the)?|not the|bukan|change the|swap the|tukar)\s+(\w+)(?=\s+(?:to|for|kepada|jadi)\b|)/g;
const OFF_ZH = /走(冰|蛋|甜)|不要(冰|蛋|糖)|去冰/g;
// an option that is itself taken off or less of something ("Less ice", "No sugar", "Tanpa Kacang",
// "Kurang Manis", "Kosong"): said as the guest says it, it's chosen (free), never "ice taken off"
const PHRASES: [RegExp, RegExp][] = [
  [/^less ice$|^kurang ais$/, /\b(less ice|kurang ais|sikit ais|little ice|siu bing)\b|少冰/],
  [/^no ice$|^tanpa ais$/, /\b(no ice|without ice|tak nak ais|tak mau ais|xnak ais|tanpa ais|ice free)\b|走冰|去冰|不要冰|不加冰/],
  [/^less sweet$|^kurang manis$/, /\b(less sweet|kurang manis|less sugar|siew dai|siu dai|siu tai|not so sweet|not too sweet)\b|少甜|少糖|甜少|微糖/],
  [/^no sugar$|^kosong$|^no added sugar$|^0 ?%$/, /\b(no sugar|kosong|tanpa gula|sugar free|no added sugar|unsweetened|zero sugar|0 ?%)\b|走甜|无糖|不要糖|不加糖|零糖/],
  [/^lebih manis$/, /\b(lebih manis|extra sweet|more sweet|sweeter)\b|多糖|加甜/],
  [/^50 ?%$/, /\b(50 ?%|50 percent|half sugar|half sweet|separuh manis)\b|半糖|五分糖/],
  [/^25 ?%$/, /\b(25 ?%|25 percent)\b|三分糖|微糖/],
  [/^75 ?%$/, /\b(75 ?%|75 percent)\b|七分糖/],
  [/^less spicy$|^less chilli$|^mild$/, /\b(less spicy|less chilli|less chili|kurang pedas|not so spicy|mild|less hot|kurang cili)\b|少辣|微辣|不要太辣|小辣/],
  [/^no chilli$/, /\b(no chilli|no chili|tanpa cili|tak nak cili|without chilli|not spicy)\b|不要辣|走辣|不辣/],
  [/^extra hot$|^extra spicy$/, /\b(extra hot|extra spicy|more spicy|spicier|lebih pedas)\b|加辣|特辣|大辣/],
  [/^normal ice$/, /\b(normal ice|regular ice)\b|正常冰/],
  [/^tanpa kacang$/, /\b(no peanuts?|without peanuts?|tanpa kacang|tak nak kacang|no nuts)\b|不要花生|走花生|去花生/],
  [/^tanpa ikan bilis$/, /\b(no (ikan )?bilis|no anchov\w*|tanpa (ikan )?bilis|without anchov\w*)\b|不要江鱼仔|走江鱼仔/],
  [/^sambal asing$/, /\b(sambal asing|sambal (on the )?side|separate sambal|sambal separate)\b|参巴分开|叁巴另外|酱另外/],
  [/^tanpa mentega$/, /\b(no butter|without butter|tanpa mentega)\b|不要牛油|不要黄油/],
  [/^no bonito flakes$/, /\b(no bonito|without bonito|tanpa bonito|bonito off|hold the bonito)\b|不要柴鱼|走柴鱼/],
  [/^hot$|^panas$/, /\b(hot|panas|warm)\b|热(?!带|狗)/],
];
const phraseOf = (o: ModifierOption) => PHRASES.find(([name]) => name.test(normalize(o.name.replace(/\([^)]*\)/g, " ")).trim()))?.[1];

const keyWords = (o: ModifierOption) => {
  const ws = normalize(o.name.replace(/[()]/g, " ")).split(" ");
  // (one letter counts in a longer name: Kopi O is not Kopi)
  return [...new Set(ws.filter((w) => (w.length > 1 || /\d/.test(w) || (ws.length > 1 && /^[a-z]$/.test(w) && !/^[ax]$/.test(w))) && !GENERIC.has(w)))];
};
const has = (w: string, words: Set<string>, joined: string) => (w.includes(" ") ? joined.includes(` ${w} `) : words.has(w));
// said as itself (or in Chinese), or only in the guest's other words for it ("ikan" for fish)
const typo = (w: string, words: Set<string>) => w.length >= 5 && !/\d/.test(w) && [...words].some((x) => x.length >= 4 && x[0] === w[0] && x !== w && (editDistance(x, w, 1) <= 1 || (w.startsWith(x) && w.length - x.length === 1)));
const direct = (w: string, words: Set<string>, joined: string, raw: string) =>
  has(w, words, joined) || typo(w, words) || (/^\d+$/.test(w) ? false : has(w.replace(/(es|s)$/, ""), words, joined) || has(`${w}s`, words, joined)) || !!ALSO_ZH[w]?.test(raw);
const alias = (w: string, words: Set<string>, joined: string) => (ALSO[w] ?? []).some((x) => has(x, words, joined));
const said = (w: string, words: Set<string>, joined: string, raw: string) => direct(w, words, joined, raw) || alias(w, words, joined);
// an option of two words or more needs one said as itself, or two in other words ("bebola ikan"): "ikan" alone isn't Fish Balls
// ("almond butter" isn't the Peanut Butter: one of its words said, after another food's)
// words of size, temperature and sweetness, said beside an option's word ("large iced", "kurang manis")
const SIZE_TEMP = /^(large|small|medium|regular|big|besar|kecil|hot|iced|ice|cold|warm|panas|ais|peng|sejuk|less|kurang|sweet|manis|sugar|gula|upsize|double|single|kosong)$/;
const LEAD = /^(extra|add|more|some|a|an|the|with|and|no|less|tambah|lebih|dengan|dan|plus|on|of|any|got|ada|nak|want|two|one|three|2|1|3|both|all|semua|kedua|please|pls|also|too|then|but|just|only|make|it|them|get|have|can|could|i|we|me|my|for|to|in|or|is|are|be|bagi|mau|dua|satu|tiga|sekali|juga|pun|yes|ok|okay|sure|that|this|those|these|one|each|lagi|jadi|and|or|ya|tu|ni|kasi|letak|put|request|order|cup|glass|bowl|plate|piece|pieces|pcs|x|times)$/;
const saysOption = (ks: string[], words: Set<string>, joined: string, raw: string) => {
  if (ks.length === 1) return said(ks[0], words, joined, raw);
  const hit = ks.filter((k) => direct(k, words, joined, raw));
  // ("a drink for her" isn't the combo's Soft drink: a course's word alone)
  if (hit.length === 1 && /^(drink|drinks|dessert|desserts|side|sides|sauce|dip|meal)$/.test(hit[0]) && !ks.filter((k) => alias(k, words, joined)).some((k) => k !== hit[0])) return false;
  if (hit.length === 1 && !ALSO_ZH[hit[0]]?.test(raw)) {
    const toks = joined.trim().split(" ");
    const at = toks.findIndex((t) => t === hit[0] || t === `${hit[0]}s` || t === hit[0].replace(/(es|s)$/, ""));
    const before = toks[at - 1];
    if (at > 0 && before && before.length > 2 && !LEAD.test(before) && !GENERIC.has(before) && !SIZE_TEMP.test(before) && !ks.includes(before) && !ks.some((k) => (ALSO[k] ?? []).includes(before))) return false;
  }
  return hit.length > 0 || ks.filter((k) => alias(k, words, joined)).length >= 2;
};
// a number names an option only as its count's unit says ("12 pcs", "12 wings", "十个", "12寸")
const numberSaid = (n: string, t: string, raw: string) => new RegExp(`(^| )${n} ?(pcs|pc|pieces?|ketul|inch|inches|in|wings?|keping|biji)?( |$)`).test(t) || new RegExp(`(^|[^0-9])${n}\\s*(个|件|只|粒|寸|块|片|pcs)`).test(raw) || (ZH_NUM[n] ? new RegExp(`${ZH_NUM[n]}(个|件|只|粒|寸|块|片)`).test(raw) : false);
const ZH_NUM: Record<string, string> = { "6": "六", "8": "八", "9": "九", "10": "十", "12": "十二", "16": "十六", "20": "二十" };

/** `text` without the dish's own name, so its words aren't read as an option ("Nasi Lemak Ayam Goreng"). */
const withoutName = (text: string, dish: WithOptions) => {
  let t = ` ${normalize(text)} `;
  // (its name's words side by side, two or more: "chilli pan mee" of the Dry Chilli Pan Mee)
  const n = normalize(dish.name).split(" ");
  for (let len = n.length; len >= 2; len--) for (let k = 0; k + len <= n.length; k++) t = t.split(` ${n.slice(k, k + len).join(" ")} `).join("  ");
  let raw = text;
  for (const zh of Object.values(dish.translations ?? {}).map((x) => x?.name).filter((x): x is string => !!x && x.length > 1)) raw = raw.split(zh).join(" ");
  return { t: t.trim(), raw };
};

/** The options of `dish` that `text` asks for (priced only, unless `free`), and the ones it takes off ("no ice"). */
export function optionsSaid(text: string, dish: WithOptions, free = false, loose = false): { add: ModifierOption[]; off: ModifierOption[] } {
  const { t, raw } = withoutName(text, dish);
  const asked = new Set([...t.matchAll(/\b(?:add|tambah|with|extra|put|plus)\s+(?:some |a |an |the )?(\w+)/g)].map((m) => m[1]));
  const offWords = new Set([...t.matchAll(OFF)].map((m) => m[2]).filter((w) => !asked.has(w)));
  const offZh = [...raw.matchAll(OFF_ZH)].map((m) => m[1]);
  const words = new Set(t.split(" ").filter((w) => !offWords.has(w)));
  let joined = ` ${[...words].join(" ")} `;
  const all = (dish.modifiers ?? []).flatMap((g) => g.options);
  // a word two options share ("telur" of Telur Mata and Telur Rebus) doesn't say which
  const count = new Map<string, number>();
  // (not the ones said as a phrase: "Less chilli" doesn't share "chilli" with Chilli Flakes)
  for (const o of all) if (!phraseOf(o)) for (const k of keyWords(o)) count.set(k, (count.get(k) ?? 0) + 1);
  const add: ModifierOption[] = [];
  const off: ModifierOption[] = [];
  let zhLeft = raw.replace(OFF_ZH, "");
  // an option said as its phrase ("less chilli", "kurang manis", "走冰") takes those words: "less
  // chilli" isn't also the Chilli Flakes
  let rest = ` ${t} `;
  for (const o of all) {
    const phrase = phraseOf(o);
    if (!phrase) continue;
    const g = new RegExp(phrase.source, "g");
    if (!g.test(rest) && !new RegExp(phrase.source, "g").test(zhLeft)) continue;
    if (free || o.price > 0) add.push(o);
    rest = rest.replace(new RegExp(phrase.source, "g"), " ");
    zhLeft = zhLeft.replace(new RegExp(phrase.source, "g"), " ");
  }
  for (const w of [...words]) if (!rest.includes(` ${w} `)) words.delete(w);
  joined = ` ${[...words].join(" ")} `;
  for (const o of all) {
    if (!free && !(o.price > 0)) continue;
    if (phraseOf(o)) continue;
    const ks = keyWords(o);
    if (!ks.length) continue;
    // ("12 pcs", "12 inch": its number, said as a count of pieces or a size)
    const nums = ks.filter((k) => /^\d+$/.test(k));
    if (nums.length) {
      if (nums.every((k) => numberSaid(k, t, raw))) add.push(o);
      continue;
    }
    const own = ks.filter((k) => (count.get(k) ?? 0) < 2);
    const need = own.length ? own : ks;
    // ("those two noodles" isn't Extra Noodles: more of something is asked for as more)
    if (!loose && /^(extra|add|more|double|tambah|lebih)\b/i.test(o.name) && !/加|多/.test(raw)) {
      const toks = t.split(" ");
      const at = toks.findIndex((x) => need.some((k) => x === k || x === `${k}s` || x === k.replace(/(es|s)$/, "") || (ALSO[k] ?? []).includes(x)));
      const near = at >= 0 ? toks.slice(Math.max(0, at - 3), at) : toks;
      if (!near.some((x) => /^(extra|add|adding|added|more|double|tambah|lebih|another|plus|with|w|dinosaur|godzilla)$/.test(x)) && !/\b(dinosaur|godzilla)\b/.test(t)) continue;
    }
    // ("almond butter" isn't the Almond Milk: its word said, then another food's)
    const named = normalize(o.name.replace(/[()]/g, " ")).split(" ");
    if (named.length > ks.length && need.length === 1 && !ALSO_ZH[need[0]]?.test(raw)) {
      const toks = t.split(" ");
      const forms = [need[0], `${need[0]}s`, ...(ALSO[need[0]] ?? []).filter((x) => !x.includes(" "))];
      const at = toks.findIndex((x) => forms.includes(x));
      const near = [toks[at + 1], toks[at - 1]];
      const food = (x: string | undefined) => !!x && x.length > 2 && !named.includes(x) && !LEAD.test(x) && !GENERIC.has(x) && !SIZE_TEMP.test(x) && !/^(on|top|please|pls|and|or|to|in|for|with|inside|dalam|lah|la|ah|ok|boleh|too|also|one|the|how|berapa|not|tak|can|plus|then|extra|more|instead|nak|mau|want|add|put|letak|tambah|large|besar|cup|hot|iced|ais|panas)$/.test(x);
      if (at >= 0 && near.some(food)) continue;
    }
    const isOff = need.some((k) => offWords.has(k) || (ALSO[k] ?? []).some((x) => offWords.has(x)) || offZh.some((z) => ALSO_ZH[k]?.test(z)));
    if (isOff) off.push(o);
    else if (own.length ? saysOption(own, words, joined, zhLeft) : ks.every((k) => said(k, words, joined, zhLeft))) add.push(o);
  }
  // an option said by its whole name wins over one whose words it has ("chocolate sauce" isn't also
  // the Chocolate flavour; "巧克力酱" neither)
  const whole = (o: ModifierOption) => normalize(o.name.replace(/\([^)]*\)/g, " ")).trim();
  const fullySaid = add.filter((o) => whole(o).includes(" ") && ` ${t} `.includes(` ${whole(o)} `));
  const sauceZh = /酱/.test(raw);
  const kept = add.filter((o) => !fullySaid.some((x) => x !== o && keyWords(o).every((k) => whole(x).split(" ").includes(k))) && !(sauceZh && !/sauce|酱/i.test(o.name) && add.some((x) => x !== o && /sauce/i.test(x.name) && keyWords(o).every((k) => keyWords(x).includes(k)))));
  // one option of a group that takes one: the one whose words were said most fully
  const out = kept.filter((o) => {
    const g = (dish.modifiers ?? []).find((x) => x.options.includes(o));
    if (!g || (g.max ?? 1) > 1) return true;
    const rivals = add.filter((x) => x !== o && g.options.includes(x));
    return !rivals.some((x) => keyWords(x).length > keyWords(o).length && keyWords(o).every((k) => keyWords(x).includes(k)));
  });
  return { add: out, off };
}

/** The options a question names on any dish ("Ada susu badam? Berapa tambah?"), with the dishes that have them. */
export function optionsAsked<T extends WithOptions>(text: string, dishes: T[]): { option: ModifierOption; dishes: T[] }[] {
  const out = new Map<string, { option: ModifierOption; dishes: T[] }>();
  for (const d of dishes)
    for (const o of optionsSaid(text, d).add) {
      const k = normalize(o.name);
      if (!out.has(k)) out.set(k, { option: o, dishes: [] });
      out.get(k)!.dishes.push(d);
    }
  return [...out.values()];
}

/** An option's name as a guest reads it: "Ais (iced)" is "iced", "Oat milk" stays. */
export const optionLabel = (o: ModifierOption) => o.name.match(/\(([^)]+)\)/)?.[1] ?? o.name;

/** A dish's choices as a guest reads them: "Base: Soup, Dry, Curry Laksa (+RM2.00)". */
export function choicesText(dish: WithOptions, money: (n: number) => string): string {
  return (dish.modifiers ?? []).map((g) => `${g.name}: ${g.options.map((o) => `${optionLabel(o)}${o.price ? ` (+${money(o.price)})` : ""}`).join(", ")}`).join("; ");
}
/** The option words a text uses for any of `dishes`' options (to keep "extra chilli sauce" from naming a chilli dish). */
export function optionWordsSaid(text: string, dishes: WithOptions[]): Set<string> {
  const out = new Set<string>();
  for (const d of dishes) for (const o of optionsSaid(text, d, true).add) for (const w of keyWords(o)) out.add(w);
  return out;
}

/** The words of an option, for telling a dish named only by them ("pudding", "fish balls") from one ordered. */
export const optionWords = keyWords;

/**
 * Whether a word or phrase the guest said is one of `dish`'s options, by its words or the guest's
 * words for them: "fish balls", "pearls", "鱼丸".
 */
export function isOptionOf(phrase: string, dish: WithOptions): ModifierOption | null {
  return optionsSaid(phrase, dish, true).add[0] ?? null;
}
